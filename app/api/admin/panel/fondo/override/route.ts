// Corrección (override) de un cierre publicado. Es la ÚNICA vía que pisa un
// valor en conflicto: exige motivo, salta la banda día-a-día (una corrección
// legítima puede ser un salto grande), pero mantiene los chequeos absolutos
// (fecha real, no futura, positividad, banda absoluta). Queda auditado como
// 'superseded' con el valor previo a la vista.

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { validateNav, isRealDate } from "@/lib/fondoIngest";
import { getNavRow, upsertNavStmt, auditStmt } from "@/lib/fondoStore";
import { panelAuditStmt } from "@/lib/panelStore";
import { OverrideSchema } from "@/lib/panelSchemas";
import { eventBaseFromRequest } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

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
  const parsed = OverrideSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ error: "bad_request", detalle: msg }, { status: 400, headers: NO_STORE });
  }
  const input = parsed.data;
  const nowMs = Date.now();
  const ipHash = eventBaseFromRequest(req).ipHash;

  // Sin prevRow ni existingRow a propósito: el override salta la banda
  // día-a-día y el chequeo de conflicto. La banda ABSOLUTA y las fechas siguen.
  const v = validateNav(
    { dia: input.dia, nav: input.nav, aum: input.aum },
    { nowMs, bands: { maxDailyMove: Number.MAX_SAFE_INTEGER } },
  );
  if (!v.ok) {
    return NextResponse.json({ error: "rechazado", detalle: v.message }, { status: 400, headers: NO_STORE });
  }

  const previo = isRealDate(input.dia) ? await getNavRow(db, input.dia) : null;
  await db.batch([
    upsertNavStmt(db, { ...v.value, nota: `override: ${input.motivo}` }, { source: "override", nowMs }),
    auditStmt(db, {
      actor: "admin", channel: "http", action: "override",
      decision: previo ? "superseded" : "accepted", reason: "ok",
      targetDia: v.value.dia, parsedNav: v.value.nav, parsedAum: v.value.aum,
      prevNav: previo?.nav ?? null, ipHash, rawExcerpt: input.motivo.slice(0, 200), nowMs,
    }),
    panelAuditStmt(db, {
      actorId: user.id, actorEmail: user.email, ipHash, section: "fondo", action: "override",
      target: v.value.dia, decision: "ok",
      detail: { nav: v.value.nav, prevNav: previo?.nav ?? null, motivo: input.motivo.slice(0, 200) }, nowMs,
    }),
  ]);
  return NextResponse.json({ ok: true, value: v.value, prevNav: previo?.nav ?? null }, { headers: NO_STORE });
}
