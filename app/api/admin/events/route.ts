import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";

export const dynamic = "force-dynamic";

interface EventRow {
  id: number;
  ts: number;
  ticker: string;
  status: string;
  duration_ms: number | null;
  sankey_source: string | null;
  sankey_stale: number | null;
  quality_score: number | null;
  segment_balance_pct: number | null;
  cost_balance_pct: number | null;
  opex_balance_pct: number | null;
  op_chain_balance_pct: number | null;
  quality_findings: string | null;
  sankey_snapshot: string | null;
  error_stage: string | null;
  error_msg: string | null;
  verdict_rating: string | null;
  verdict_conviction: string | null;
  verdict_rationale: string | null;
  company_name: string | null;
  current_price: number | null;
  market_cap: number | null;
  bull_target: string | null;
  bear_target: string | null;
}

// Returns the most recent N events for a ticker, with full diagnostic JSON
// (findings + snapshot). Used by the dashboard's drill-down drawer.
export async function GET(req: NextRequest) {
  const gate = await requirePanelSession(req, "monitor");
  if (!gate.ok) return gate.res;
  const { db } = gate;

  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: "ticker required" }, { status: 400 });
  }
  const limitParam = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 100
    ? Math.floor(limitParam)
    : 25;

  const rows = await db
    .prepare(
      "SELECT id, ts, ticker, status, duration_ms, " +
      "       sankey_source, sankey_stale, quality_score, " +
      "       segment_balance_pct, cost_balance_pct, opex_balance_pct, op_chain_balance_pct, " +
      "       quality_findings, sankey_snapshot, " +
      "       error_stage, error_msg, " +
      "       verdict_rating, verdict_conviction, verdict_rationale, " +
      "       company_name, current_price, market_cap, bull_target, bear_target " +
      "FROM analyze_events " +
      "WHERE ticker = ? " +
      "ORDER BY ts DESC " +
      "LIMIT ?"
    )
    .bind(ticker, limit)
    .all<EventRow>();

  // Parse JSON columns server-side so the client doesn't have to. Findings
  // and snapshot are stored as TEXT but they're always valid JSON we wrote.
  const events = rows.results.map((r) => {
    let findings: unknown = null;
    let snapshot: unknown = null;
    if (r.quality_findings) {
      try { findings = JSON.parse(r.quality_findings); } catch { /* leave null */ }
    }
    if (r.sankey_snapshot) {
      try { snapshot = JSON.parse(r.sankey_snapshot); } catch { /* leave null */ }
    }
    return {
      id: r.id,
      ts: r.ts,
      ticker: r.ticker,
      status: r.status,
      durationMs: r.duration_ms,
      sankeySource: r.sankey_source,
      sankeyStale: r.sankey_stale === 1,
      qualityScore: r.quality_score,
      balances: {
        segment: r.segment_balance_pct,
        cost: r.cost_balance_pct,
        opex: r.opex_balance_pct,
        opChain: r.op_chain_balance_pct,
      },
      findings,
      snapshot,
      errorStage: r.error_stage,
      errorMsg: r.error_msg,
      verdict: r.verdict_rating
        ? {
            rating: r.verdict_rating,
            conviction: r.verdict_conviction,
            rationale: r.verdict_rationale,
          }
        : null,
      market: {
        companyName: r.company_name,
        currentPrice: r.current_price,
        marketCap: r.market_cap,
      },
      priceTargets: {
        bull: r.bull_target,
        bear: r.bear_target,
      },
    };
  });

  return NextResponse.json({ ticker, count: events.length, events });
}
