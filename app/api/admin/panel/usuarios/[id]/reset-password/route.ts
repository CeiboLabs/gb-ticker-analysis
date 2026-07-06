// Reset de contraseña de OTRO usuario (rol admin): clave temporal + cambio
// obligatorio en el próximo login + todas sus sesiones revocadas. La propia
// contraseña se cambia en «Mi seguridad», nunca por acá.

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { hashPassword } from "@/lib/panelCrypto";
import { getUserById, setPassword, revokeUserSessions, writePanelAudit } from "@/lib/panelStore";
import { ResetPasswordSchema } from "@/lib/panelSchemas";
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
      { error: "auto_bloqueo", detalle: "Tu contraseña se cambia en «Mi seguridad»." },
      { status: 400, headers: NO_STORE },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }
  const parsed = ResetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ error: "bad_request", detalle: msg }, { status: 400, headers: NO_STORE });
  }
  const row = await getUserById(db, id);
  if (!row) {
    return NextResponse.json({ error: "no_existe" }, { status: 404, headers: NO_STORE });
  }

  await setPassword(db, id, await hashPassword(parsed.data.tempPassword), { mustChange: true });
  await revokeUserSessions(db, id);
  await writePanelAudit(db, {
    actorId: user.id, actorEmail: user.email, ipHash: eventBaseFromRequest(req).ipHash,
    section: "usuarios", action: "reset_password", target: row.email, decision: "ok",
  });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
