// Carga manual del cierre diario del fondo. La validación es la MISMA que la
// ingesta por mail (lib/fondoIngest.validateNav, bandas incluidas); el dato,
// la auditoría del fondo y la del panel entran en UN batch atómico. Un
// conflicto con lo ya publicado NO se pisa desde acá: va por override.

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { validateNav, isRealDate } from "@/lib/fondoIngest";
import { getPrevNav, getNavRow, upsertNavStmt, auditStmt } from "@/lib/fondoStore";
import { panelAuditStmt, writePanelAudit } from "@/lib/panelStore";
import { NavManualSchema } from "@/lib/panelSchemas";
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
  const parsed = NavManualSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ error: "bad_request", detalle: msg }, { status: 400, headers: NO_STORE });
  }
  const input = parsed.data;
  const nowMs = Date.now();
  const ipHash = eventBaseFromRequest(req).ipHash;

  // Contexto de serie sólo si la fecha tiene forma real (si no, validateNav
  // rechaza por estructura sin gastar queries).
  const ctx = isRealDate(input.dia)
    ? { prevRow: await getPrevNav(db, input.dia), existingRow: await getNavRow(db, input.dia), nowMs }
    : { nowMs };
  const v = validateNav({ dia: input.dia, nav: input.nav, aum: input.aum, nota: input.nota }, ctx);

  if (!v.ok) {
    // Rechazo: auditoría del fondo (mismo vocabulario que el worker) + panel.
    await db.batch([
      auditStmt(db, {
        actor: "admin", channel: "http", action: "backfill", decision: "rejected", reason: v.reason,
        targetDia: isRealDate(input.dia) ? input.dia : null, ipHash, nowMs,
      }),
      panelAuditStmt(db, {
        actorId: user.id, actorEmail: user.email, ipHash, section: "fondo", action: "nav",
        target: String(input.dia), decision: "rejected", detail: { reason: v.reason }, nowMs,
      }),
    ]);
    const status = v.reason === "conflict" ? 409 : 400;
    return NextResponse.json(
      { error: v.reason === "conflict" ? "conflicto" : "rechazado", detalle: v.message },
      { status, headers: NO_STORE },
    );
  }

  if (v.decision === "duplicate") {
    // Mismo valor ya publicado: no-op honesto (no se re-escribe ni re-audita el dato).
    await writePanelAudit(db, {
      actorId: user.id, actorEmail: user.email, ipHash, section: "fondo", action: "nav",
      target: v.value.dia, decision: "ok", detail: { duplicate: true }, nowMs,
    });
    return NextResponse.json({ ok: true, decision: "duplicate", value: v.value }, { headers: NO_STORE });
  }

  await db.batch([
    upsertNavStmt(db, v.value, { source: "backfill", nowMs }),
    auditStmt(db, {
      actor: "admin", channel: "http", action: "backfill", decision: "accepted", reason: "ok",
      targetDia: v.value.dia, parsedNav: v.value.nav, parsedAum: v.value.aum, ipHash, nowMs,
    }),
    panelAuditStmt(db, {
      actorId: user.id, actorEmail: user.email, ipHash, section: "fondo", action: "nav",
      target: v.value.dia, decision: "ok", detail: { nav: v.value.nav, aum: v.value.aum }, nowMs,
    }),
  ]);
  return NextResponse.json({ ok: true, decision: "accepted", value: v.value }, { headers: NO_STORE });
}
