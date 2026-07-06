// Reset del segundo factor de OTRO usuario (rol admin): borra el secret y
// revoca sus sesiones — el próximo login re-enrola. El propio TOTP no se
// resetea a sí mismo (si funciona no hace falta; si se perdió, lo hace otro
// admin o el runbook por SQL).

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { getUserById, clearTotp, revokeUserSessions, writePanelAudit } from "@/lib/panelStore";
import { eventBaseFromRequest } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requirePanelSession(req, "usuarios");
  if (!gate.ok) return gate.res;
  const { db, user } = gate;

  const { id: rawId } = await ctx.params;
  const id = parseInt(rawId, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }
  if (id === user.id) {
    return NextResponse.json(
      { error: "auto_bloqueo", detalle: "Tu segundo factor lo resetea otro administrador." },
      { status: 400, headers: NO_STORE },
    );
  }
  const row = await getUserById(db, id);
  if (!row) {
    return NextResponse.json({ error: "no_existe" }, { status: 404, headers: NO_STORE });
  }

  await clearTotp(db, id);
  await revokeUserSessions(db, id);
  await writePanelAudit(db, {
    actorId: user.id, actorEmail: user.email, ipHash: eventBaseFromRequest(req).ipHash,
    section: "usuarios", action: "reset_totp", target: row.email, decision: "ok",
  });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
