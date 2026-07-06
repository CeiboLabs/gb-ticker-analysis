// Logout del panel: revoca la sesión server-side (la fila muere, no sólo la
// cookie) y limpia la cookie. Acepta también sesiones scope='setup'.

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession, clearSessionCookie } from "@/lib/panelAuth";
import { revokeSession, writePanelAudit } from "@/lib/panelStore";
import { eventBaseFromRequest } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const gate = await requirePanelSession(req, undefined, { scope: "setup" });
  if (!gate.ok) return gate.res;
  await revokeSession(gate.db, gate.sessionId);
  await writePanelAudit(gate.db, {
    actorId: gate.user.id,
    actorEmail: gate.user.email,
    ipHash: eventBaseFromRequest(req).ipHash,
    section: "auth",
    action: "logout",
    decision: "ok",
  });
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store", "Set-Cookie": clearSessionCookie() } },
  );
}
