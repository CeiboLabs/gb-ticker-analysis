// Cierre del enrolamiento TOTP: verifica el primer código contra el secret
// pendiente y recién ahí lo promueve a definitivo (con el timestep quemado —
// ese primer código ya no se puede reusar). Promueve la sesión setup → full
// ROTANDO el token.

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession, createSession } from "@/lib/panelAuth";
import { verifyTotp, decryptSecret, sha256Hex } from "@/lib/panelCrypto";
import { getUserById, promoteTotpPending, revokeSession, writePanelAudit } from "@/lib/panelStore";
import { TotpVerifySchema } from "@/lib/panelSchemas";
import { checkFailedAuthLimit } from "@/lib/rateLimiter";
import { eventBaseFromRequest } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const PENDING_TTL_MS = 15 * 60 * 1000;

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
  const parsed = TotpVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }
  const nowMs = Date.now();
  const ipHash = eventBaseFromRequest(req).ipHash;

  const row = await getUserById(db, user.id);
  if (!row || row.status !== "active") {
    return NextResponse.json({ error: "sin_sesion" }, { status: 401, headers: NO_STORE });
  }
  if (row.totp_secret != null) {
    return NextResponse.json({ error: "ya_enrolado" }, { status: 409, headers: NO_STORE });
  }
  if (!row.totp_pending_secret || !row.totp_pending_created_at || nowMs - row.totp_pending_created_at > PENDING_TTL_MS) {
    return NextResponse.json({ error: "pending_vencido" }, { status: 400, headers: NO_STORE });
  }
  const secret = await decryptSecret(row.totp_pending_secret);
  if (!secret) {
    return NextResponse.json({ error: "config" }, { status: 503, headers: NO_STORE });
  }

  const totpRes = await verifyTotp(secret, parsed.data.code, 0, nowMs);
  if (!totpRes.ok) {
    const accountKey = (await sha256Hex(`panel-login:${row.email}`)).slice(0, 32);
    const acctGate = await checkFailedAuthLimit(accountKey, 10, "panelfailu");
    await writePanelAudit(db, {
      actorId: row.id, actorEmail: row.email, ipHash, section: "auth", action: "enroll_totp",
      decision: "rejected", detail: { fase: "verify" }, nowMs,
    });
    if (!acctGate.allowed) {
      return NextResponse.json(
        { error: "rate_limited" },
        { status: 429, headers: { ...NO_STORE, "Retry-After": String(acctGate.retryAfter) } },
      );
    }
    return NextResponse.json({ error: "codigo" }, { status: 401, headers: NO_STORE });
  }

  await promoteTotpPending(db, row.id, totpRes.step, nowMs);
  // Promoción de privilegio ⇒ token nuevo (la cookie setup queda revocada).
  await revokeSession(db, sessionId, nowMs);
  const { setCookie } = await createSession(db, row.id, "full", req, nowMs);
  await writePanelAudit(db, {
    actorId: row.id, actorEmail: row.email, ipHash, section: "auth", action: "enroll_totp",
    decision: "ok", detail: { fase: "verify" }, nowMs,
  });
  return NextResponse.json({ ok: true, next: "/admin" }, { headers: { ...NO_STORE, "Set-Cookie": setCookie } });
}
