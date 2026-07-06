// Edición de un usuario (rol/permisos/estado/nombre) — sólo rol admin, con
// guardas de integridad: nadie se degrada ni se deshabilita a sí mismo, y el
// ÚLTIMO admin activo es intocable (el panel no puede quedarse sin llaves).
// Deshabilitar revoca todas las sesiones vivas del usuario en el acto.

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import {
  getUserById,
  updateUserProfile,
  countOtherActiveAdmins,
  revokeUserSessions,
  writePanelAudit,
  parsePerms,
} from "@/lib/panelStore";
import { UsuarioPatchSchema } from "@/lib/panelSchemas";
import { eventBaseFromRequest } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requirePanelSession(req, "usuarios");
  if (!gate.ok) return gate.res;
  const { db, user } = gate;

  const { id: rawId } = await ctx.params;
  const id = parseInt(rawId, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }
  const parsed = UsuarioPatchSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ error: "bad_request", detalle: msg }, { status: 400, headers: NO_STORE });
  }
  const fields = parsed.data;

  const row = await getUserById(db, id);
  if (!row) {
    return NextResponse.json({ error: "no_existe" }, { status: 404, headers: NO_STORE });
  }

  // Guardas de integridad del control de acceso.
  if (id === user.id && (fields.role === "editor" || fields.status === "disabled")) {
    return NextResponse.json(
      { error: "auto_bloqueo", detalle: "No podés degradarte ni deshabilitarte a vos mismo." },
      { status: 400, headers: NO_STORE },
    );
  }
  const pierdeAdmin =
    row.role === "admin" && row.status === "active" && (fields.role === "editor" || fields.status === "disabled");
  if (pierdeAdmin && (await countOtherActiveAdmins(db, id)) === 0) {
    return NextResponse.json(
      { error: "ultimo_admin", detalle: "Es el último administrador activo: primero nombrá otro." },
      { status: 409, headers: NO_STORE },
    );
  }

  const merged = {
    nombre: fields.nombre ?? row.nombre,
    role: fields.role ?? row.role,
    perms: fields.perms ?? parsePerms(row.perms),
    status: fields.status ?? row.status,
  };
  await updateUserProfile(db, id, merged);
  // Un usuario deshabilitado no conserva sesiones vivas ni un segundo.
  if (merged.status === "disabled") {
    await revokeUserSessions(db, id);
  }
  await writePanelAudit(db, {
    actorId: user.id, actorEmail: user.email, ipHash: eventBaseFromRequest(req).ipHash,
    section: "usuarios", action: "update", target: row.email, decision: "ok",
    detail: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : String(v)])),
  });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
