// Sesiones vivas del usuario logueado: GET lista (metadata, sin hashes) y
// DELETE revoca todas MENOS la actual («cerrar las demás sesiones»).

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { listUserSessions, revokeUserSessions, writePanelAudit } from "@/lib/panelStore";
import { eventBaseFromRequest } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const gate = await requirePanelSession(req);
  if (!gate.ok) return gate.res;
  const sesiones = (await listUserSessions(gate.db, gate.user.id)).map((s) => ({
    id: s.id,
    actual: s.id === gate.sessionId,
    creada: s.created_at,
    ultimaActividad: s.last_seen_at,
    vence: s.expires_at,
    userAgent: s.user_agent,
  }));
  return NextResponse.json({ sesiones }, { headers: NO_STORE });
}

export async function DELETE(req: NextRequest) {
  const gate = await requirePanelSession(req);
  if (!gate.ok) return gate.res;
  await revokeUserSessions(gate.db, gate.user.id, { exceptId: gate.sessionId });
  await writePanelAudit(gate.db, {
    actorId: gate.user.id, actorEmail: gate.user.email, ipHash: eventBaseFromRequest(req).ipHash,
    section: "auth", action: "logout", target: "otras_sesiones", decision: "ok",
  });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
