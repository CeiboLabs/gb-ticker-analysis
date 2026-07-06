// Arranque del enrolamiento TOTP: genera el secret, lo guarda CIFRADO como
// pendiente (TTL 15 min) y lo devuelve una única vez para el QR / alta manual.
// Sólo para usuarios SIN TOTP: el re-enrolamiento va por reset de un admin —
// si no, una sesión robada podría rotar el segundo factor y quedarse la cuenta.

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { generateTotpSecret, otpauthUrl, encryptSecret } from "@/lib/panelCrypto";
import { getUserById, setTotpPending, writePanelAudit } from "@/lib/panelStore";
import { eventBaseFromRequest } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest) {
  const gate = await requirePanelSession(req, undefined, { scope: "setup" });
  if (!gate.ok) return gate.res;
  const { db, user } = gate;

  const row = await getUserById(db, user.id);
  if (!row || row.status !== "active") {
    return NextResponse.json({ error: "sin_sesion" }, { status: 401, headers: NO_STORE });
  }
  if (row.totp_secret != null) {
    return NextResponse.json({ error: "ya_enrolado" }, { status: 409, headers: NO_STORE });
  }
  // El orden del primer acceso es contraseña propia PRIMERO, TOTP después.
  if (row.must_change_password === 1) {
    return NextResponse.json({ error: "password_primero" }, { status: 409, headers: NO_STORE });
  }

  const secret = generateTotpSecret();
  await setTotpPending(db, row.id, await encryptSecret(secret));
  await writePanelAudit(db, {
    actorId: row.id, actorEmail: row.email, ipHash: eventBaseFromRequest(req).ipHash,
    section: "auth", action: "enroll_totp", decision: "ok", detail: { fase: "start" },
  });
  return NextResponse.json({ ok: true, secret, otpauth: otpauthUrl(row.email, secret) }, { headers: NO_STORE });
}
