// Leads del embudo de /analisis para la mesa. Sólo lectura: acá no se edita ni
// se borra nada — el alta la hace el sitio (/api/newsletter) y la baja, la
// persona.

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { writePanelAudit } from "@/lib/panelStore";
import { eventBaseFromRequest } from "@/lib/metrics";
import { listLeads, leadsResumen } from "@/lib/leadStore";

export const dynamic = "force-dynamic";

function intParam(raw: string | null, def: number): number {
  const n = parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

export async function GET(req: NextRequest) {
  const gate = await requirePanelSession(req, "leads");
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const limit = intParam(url.searchParams.get("limit"), 200);
  const offset = intParam(url.searchParams.get("offset"), 0);

  const [resumen, { rows, total }] = await Promise.all([
    leadsResumen(gate.db),
    listLeads(gate.db, { limit, offset }),
  ]);

  // La LECTURA se audita, cosa que el resto del panel no hace: las demás
  // secciones sólo dejan rastro de las mutaciones porque leer un informe o el
  // NAV del fondo no es leer datos de nadie. Acá sí — son correos de personas
  // identificadas y su historial de navegación —, así que queda registrado
  // quién los miró y cuándo. No bloquea la respuesta si falla.
  void writePanelAudit(gate.db, {
    actorId: gate.user.id,
    actorEmail: gate.user.email,
    ipHash: eventBaseFromRequest(req).ipHash,
    section: "leads",
    action: "list",
    decision: "ok",
    detail: { devueltos: rows.length, offset },
  }).catch(() => {});

  return NextResponse.json(
    { resumen, rows, total },
    { headers: { "Cache-Control": "no-store" } },
  );
}
