// Récord del analizador — estado y recómputo, desde el panel.
//
// El recómputo NO es automático por request: pide una serie diaria por ticker a
// Yahoo (~53 llamadas) y tarda decenas de segundos. Lo dispara una persona desde
// /admin/leads, o un cron que pegue a este mismo POST.

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { writePanelAudit } from "@/lib/panelStore";
import { eventBaseFromRequest } from "@/lib/metrics";
import { readRecord, recomputeRecord, recordIsStale } from "@/lib/recordStore";

export const dynamic = "force-dynamic";
// El recómputo serializa ~53 llamadas a Yahoo con una pausa entre cada una.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const gate = await requirePanelSession(req, "leads");
  if (!gate.ok) return gate.res;

  const [snap, stale] = await Promise.all([readRecord(gate.db), recordIsStale(gate.db)]);
  return NextResponse.json({ ...snap, stale }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const gate = await requirePanelSession(req, "leads");
  if (!gate.ok) return gate.res;

  try {
    const resumen = await recomputeRecord(gate.db);
    void writePanelAudit(gate.db, {
      actorId: gate.user.id,
      actorEmail: gate.user.email,
      ipHash: eventBaseFromRequest(req).ipHash,
      section: "leads",
      action: "record_recompute",
      decision: "ok",
      detail: resumen,
    }).catch(() => {});

    const snap = await readRecord(gate.db);
    return NextResponse.json({ ...snap, resumen }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    void writePanelAudit(gate.db, {
      actorId: gate.user.id,
      actorEmail: gate.user.email,
      ipHash: eventBaseFromRequest(req).ipHash,
      section: "leads",
      action: "record_recompute",
      decision: "error",
      detail: { msg: err instanceof Error ? err.message : String(err) },
    }).catch(() => {});
    return NextResponse.json(
      { error: "recompute_failed", detalle: err instanceof Error ? err.message : "Error inesperado" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
