// Cambio de contraseña (self-service). Exige la contraseña ACTUAL y, si el
// usuario ya tiene TOTP enrolado, un código vigente — una sesión robada sola
// no puede rotar la credencial. Cambiarla revoca las DEMÁS sesiones.
//
// Sirve a dos flujos: el self-service normal (scope full) y el primer acceso /
// post-reset (scope setup, must_change_password=1). En el segundo caso, si el
// usuario ya tenía TOTP (reset de clave solamente), la sesión se promueve a
// full acá mismo; si no, el cliente sigue al enrolamiento TOTP.

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession, createSession } from "@/lib/panelAuth";
import { verifyPassword, hashPassword, verifyTotp, decryptSecret, sha256Hex } from "@/lib/panelCrypto";
import { getUserById, setPassword, bumpTotpStep, revokeSession, revokeUserSessions, writePanelAudit } from "@/lib/panelStore";
import { PasswordChangeSchema } from "@/lib/panelSchemas";
import { checkFailedAuthLimit } from "@/lib/rateLimiter";
import { eventBaseFromRequest } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const gate = await requirePanelSession(req, undefined, { scope: "setup" });
  if (!gate.ok) return gate.res;
  const { db, user, sessionId } = gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }
  const parsed = PasswordChangeSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ error: "bad_request", detalle: msg }, { status: 400, headers: NO_STORE });
  }
  const { actual, nueva, totp } = parsed.data;
  const nowMs = Date.now();
  const ipHash = eventBaseFromRequest(req).ipHash;

  const row = await getUserById(db, user.id);
  if (!row || row.status !== "active") {
    return NextResponse.json({ error: "sin_sesion" }, { status: 401, headers: NO_STORE });
  }

  // Verificación de la credencial vigente; las fallas consumen el bucket por
  // cuenta (mismo que el login) para que esto no sea un oráculo de guessing.
  const accountKey = (await sha256Hex(`panel-login:${row.email}`)).slice(0, 32);
  const failVerification = async (reason: string): Promise<NextResponse> => {
    const acctGate = await checkFailedAuthLimit(accountKey, 10, "panelfailu");
    await writePanelAudit(db, {
      actorId: row.id, actorEmail: row.email, ipHash, section: "auth", action: "change_password",
      decision: "rejected", detail: { reason }, nowMs,
    });
    if (!acctGate.allowed) {
      return NextResponse.json(
        { error: "rate_limited" },
        { status: 429, headers: { ...NO_STORE, "Retry-After": String(acctGate.retryAfter) } },
      );
    }
    return NextResponse.json({ error: "credenciales" }, { status: 401, headers: NO_STORE });
  };

  if (!(await verifyPassword(actual, row.password_hash))) return failVerification("password_actual");
  if (nueva === actual) {
    return NextResponse.json({ error: "misma_password" }, { status: 400, headers: NO_STORE });
  }

  if (row.totp_secret != null) {
    if (!totp) return failVerification("totp_ausente");
    const secret = await decryptSecret(row.totp_secret);
    if (!secret) {
      return NextResponse.json({ error: "config" }, { status: 503, headers: NO_STORE });
    }
    const totpRes = await verifyTotp(secret, totp, row.totp_last_step, nowMs);
    if (!totpRes.ok) return failVerification("totp");
    await bumpTotpStep(db, row.id, totpRes.step);
  }

  await setPassword(db, row.id, await hashPassword(nueva), { mustChange: false, nowMs });
  // Rotación de credencial ⇒ las otras sesiones mueren (la actual sigue).
  await revokeUserSessions(db, row.id, { exceptId: sessionId, nowMs });
  await writePanelAudit(db, {
    actorId: row.id, actorEmail: row.email, ipHash, section: "auth", action: "change_password",
    decision: "ok", nowMs,
  });

  // Flujo de setup con TOTP ya enrolado (reset de clave): promover a full acá,
  // rotando el token. Sin TOTP, el cliente sigue al enrolamiento.
  if (gate.scope === "setup" && row.totp_secret != null) {
    await revokeSession(db, sessionId, nowMs);
    const { setCookie } = await createSession(db, row.id, "full", req, nowMs);
    return NextResponse.json(
      { ok: true, next: "/admin" },
      { headers: { ...NO_STORE, "Set-Cookie": setCookie } },
    );
  }
  return NextResponse.json({ ok: true, next: null }, { headers: NO_STORE });
}
