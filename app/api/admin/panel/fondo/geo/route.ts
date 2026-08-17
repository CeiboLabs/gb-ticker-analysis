// Exposición geográfica del fondo: los cinco pesos de la asignación OBJETIVO
// del mandato. GET devuelve lo vigente (o la línea de base del deploy si nunca
// se cargó), POST lo reemplaza entero.
//
// Es un documento indivisible —los pesos suman 100— así que no hay PATCH por
// región: se guardan los cinco o ninguno.
//
// Auditoría: sólo `admin_audit`. `fund_audit` es el registro de la ingesta de
// HECHOS DATADOS del fondo (valor cuota, tenencias a una fecha) y su `action`
// es un enum cerrado de eso; un objetivo del mandato no tiene día ni entra en
// esa taxonomía. La mutación igual queda auditada, que es la regla del panel.

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { readGeoTarget, readGeoMeta, upsertGeoTargetStmt } from "@/lib/fondoStore";
import { panelAuditStmt } from "@/lib/panelStore";
import { GeoTargetSchema } from "@/lib/panelSchemas";
import { GEO_BASELINE, GEO_REGIONES } from "@/lib/fondoGeo";
import { eventBaseFromRequest } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const gate = await requirePanelSession(req, "fondo");
  if (!gate.ok) return gate.res;
  const { db } = gate;

  const [target, meta] = await Promise.all([readGeoTarget(db), readGeoMeta(db)]);

  return NextResponse.json(
    {
      // `guardado` distingue "nunca se cargó" de "se cargó y coincide con la
      // base": el panel lo usa para avisar que lo que se ve viene del deploy.
      guardado: target !== null,
      pesos: target ?? GEO_BASELINE,
      baseline: GEO_BASELINE,
      regiones: GEO_REGIONES,
      meta,
    },
    { headers: NO_STORE },
  );
}

export async function POST(req: NextRequest) {
  const gate = await requirePanelSession(req, "fondo");
  if (!gate.ok) return gate.res;
  const { db, user } = gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }
  const parsed = GeoTargetSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ error: "bad_request", detalle: msg }, { status: 400, headers: NO_STORE });
  }
  const pesos = parsed.data;
  const nowMs = Date.now();
  const ipHash = eventBaseFromRequest(req).ipHash;

  // Guardado y auditoría en un batch: no puede quedar el dato sin su rastro.
  await db.batch([
    upsertGeoTargetStmt(db, pesos, user.email, nowMs),
    panelAuditStmt(db, {
      actorId: user.id,
      actorEmail: user.email,
      ipHash,
      section: "fondo",
      action: "geo",
      decision: "ok",
      detail: pesos,
      nowMs,
    }),
  ]);

  return NextResponse.json({ ok: true, pesos }, { headers: NO_STORE });
}
