// Usuarios del panel — sólo rol admin. El alta entrega una clave TEMPORAL
// (el empleado la cambia obligatoriamente en el primer login y recién ahí
// enrola su TOTP). La respuesta NUNCA incluye hashes ni secretos.

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { hashPassword } from "@/lib/panelCrypto";
import { listUsers, insertUser, writePanelAudit, parsePerms, type AdminUserRow } from "@/lib/panelStore";
import { UsuarioCreateSchema } from "@/lib/panelSchemas";
import { eventBaseFromRequest } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function toSafe(u: AdminUserRow) {
  return {
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    role: u.role,
    perms: parsePerms(u.perms),
    status: u.status,
    totpEnrolled: u.totp_secret != null,
    mustChangePassword: u.must_change_password === 1,
    createdAt: u.created_at,
    createdBy: u.created_by,
    updatedAt: u.updated_at,
  };
}

export async function GET(req: NextRequest) {
  const gate = await requirePanelSession(req, "usuarios");
  if (!gate.ok) return gate.res;
  const usuarios = (await listUsers(gate.db)).map(toSafe);
  return NextResponse.json({ usuarios, yo: gate.user.id }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const gate = await requirePanelSession(req, "usuarios");
  if (!gate.ok) return gate.res;
  const { db, user } = gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }
  const parsed = UsuarioCreateSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ error: "bad_request", detalle: msg }, { status: 400, headers: NO_STORE });
  }
  const u = parsed.data;

  try {
    await insertUser(db, {
      email: u.email,
      nombre: u.nombre,
      passwordHash: await hashPassword(u.tempPassword),
      role: u.role,
      perms: u.perms,
      createdBy: user.email,
    });
  } catch (err) {
    if (String(err).includes("UNIQUE")) {
      return NextResponse.json({ error: "email_existente" }, { status: 409, headers: NO_STORE });
    }
    throw err;
  }
  await writePanelAudit(db, {
    actorId: user.id, actorEmail: user.email, ipHash: eventBaseFromRequest(req).ipHash,
    section: "usuarios", action: "create", target: u.email, decision: "ok",
    detail: { role: u.role, perms: u.perms },
  });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
