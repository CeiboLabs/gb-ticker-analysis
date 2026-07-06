// Snapshot de tenencias del fondo: pesos en basis points enteros (Σ≈10000,
// validado por schema), clase de activo de enum cerrado. Reemplaza el snapshot
// del mismo as_of de forma atómica (upsert de la meta + delete/insert de las
// líneas + auditorías, todo en un batch). El sitio recién lo publica cuando
// pasa el rezago anti front-running (HOLDINGS_LAG_DAYS en fondoStore).

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { todayUY } from "@/lib/fondoIngest";
import { auditStmt } from "@/lib/fondoStore";
import { panelAuditStmt } from "@/lib/panelStore";
import { HoldingsSchema } from "@/lib/panelSchemas";
import { eventBaseFromRequest, type D1PreparedStatement } from "@/lib/metrics";

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
  const parsed = HoldingsSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ error: "bad_request", detalle: msg }, { status: 400, headers: NO_STORE });
  }
  const { asOf, note, items } = parsed.data;
  const nowMs = Date.now();
  if (asOf > todayUY(nowMs)) {
    return NextResponse.json(
      { error: "bad_request", detalle: "La fecha de cartera no puede ser futura." },
      { status: 400, headers: NO_STORE },
    );
  }
  const ipHash = eventBaseFromRequest(req).ipHash;

  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        "INSERT INTO fund_holdings_snapshot (as_of, status, source, note, ingested_at) VALUES (?, 'live', 'admin', ?, ?) " +
          "ON CONFLICT(as_of) DO UPDATE SET status = 'live', source = 'admin', note = excluded.note, ingested_at = excluded.ingested_at",
      )
      .bind(asOf, note ?? null, nowMs),
    db.prepare("DELETE FROM fund_holdings_item WHERE as_of = ?").bind(asOf),
    ...items.map((it, ord) =>
      db
        .prepare("INSERT INTO fund_holdings_item (as_of, ord, name, short, asset_class, weight_bps) VALUES (?,?,?,?,?,?)")
        .bind(asOf, ord, it.name, it.short ?? null, it.assetClass, it.weightBps),
    ),
    auditStmt(db, {
      actor: "admin", channel: "http", action: "holdings", decision: "accepted", reason: "ok",
      targetDia: asOf, ipHash, rawExcerpt: `${items.length} líneas`, nowMs,
    }),
    panelAuditStmt(db, {
      actorId: user.id, actorEmail: user.email, ipHash, section: "fondo", action: "holdings",
      target: asOf, decision: "ok",
      detail: { lineas: items.length, sumaBps: items.reduce((a, i) => a + i.weightBps, 0) }, nowMs,
    }),
  ];
  await db.batch(stmts);
  return NextResponse.json({ ok: true, asOf, lineas: items.length }, { headers: NO_STORE });
}
