import { NextRequest, NextResponse } from "next/server";
import { yahooFinance, fetchStockData } from "@/lib/fetchStockData";
import { fetchEdgarQuarterlyRevenue } from "@/lib/fetchEdgarSegments";
import { fetchSegmentData } from "@/lib/fetchSegmentData";
import { fetchEdgar8KIncomeStatement, debugEdgar8K } from "@/lib/fetchEdgar8K";
import { requireAdminToken } from "@/lib/adminAuth";
import { normalizeTicker } from "@/lib/validators";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

function fmtDate(d: unknown): string | null {
  if (d instanceof Date) return d.toISOString().split("T")[0];
  if (typeof d === "string") return d.slice(0, 10);
  return null;
}

export async function GET(req: NextRequest) {
  // Admin-only: each call fans out 7 upstream requests (EDGAR + Yahoo + 8-K
  // debug) and returns raw parser internals — both a quota burner and an
  // information-disclosure surface for someone fingerprinting the scraper.
  const denied = requireAdminToken(req);
  if (denied) return denied;

  const ticker = normalizeTicker(req.nextUrl.searchParams.get("ticker")) ?? "MMM";
  const period1 = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000);

  const [edgar, qsum, ftsq, sd, segData, edgar8K, edgar8KDebug] = await Promise.all([
    fetchEdgarQuarterlyRevenue(ticker, period1).catch((e) => ({ error: String(e) })),
    yahooFinance.quoteSummary(
      ticker,
      { modules: ["incomeStatementHistoryQuarterly"] as ("incomeStatementHistoryQuarterly")[] },
      { validateResult: false },
    ).catch((e) => ({ error: String(e) })),
    yahooFinance.fundamentalsTimeSeries(
      ticker,
      { period1, type: "quarterly", module: "all" },
      { validateResult: false },
    ).catch((e) => ({ error: String(e) })),
    fetchStockData(ticker).catch((e) => ({ error: String(e) })),
    fetchSegmentData(ticker).catch((e) => ({ error: String(e) })),
    fetchEdgar8KIncomeStatement(ticker).catch((e) => ({ error: String(e) })),
    debugEdgar8K(ticker).catch((e) => ({ error: String(e) })),
  ]);

  const edgarQuarters = Array.isArray(edgar) ? edgar.map((q) => ({ time: q.time, value: q.value })) : edgar;

  const qsumIS = (qsum as AnyRecord)?.incomeStatementHistoryQuarterly?.incomeStatementHistory ?? null;
  const num = (v: unknown): number | null => {
    if (typeof v === "number") return v;
    if (v && typeof v === "object" && "raw" in (v as object)) {
      const raw = (v as { raw?: unknown }).raw;
      return typeof raw === "number" ? raw : null;
    }
    return null;
  };
  const qsumQuarters = Array.isArray(qsumIS)
    ? qsumIS.map((q: AnyRecord) => ({
        endDate: fmtDate(q.endDate),
        totalRevenue: num(q.totalRevenue),
        costOfRevenue: num(q.costOfRevenue),
        grossProfit: num(q.grossProfit),
        operatingIncome: num(q.operatingIncome),
        netIncome: num(q.netIncome),
        totalOperatingExpenses: num(q.totalOperatingExpenses),
        incomeTaxExpense: num(q.incomeTaxExpense),
      }))
    : qsumIS;

  const ftsqQuarters = Array.isArray(ftsq)
    ? ftsq.map((r: AnyRecord) => ({
        date: fmtDate(r.date),
        totalRevenue: r.totalRevenue ?? null,
        revenue: r.revenue ?? null,
        keys: Object.keys(r).filter((k) => /revenue/i.test(k)),
      }))
    : ftsq;

  // What fetchStockData computed for latestQuarterIS (Yahoo-side fallback source)
  const latestQuarterIS = sd && typeof sd === "object" && "latestQuarterIS" in sd
    ? (sd as AnyRecord).latestQuarterIS
    : { error: "fetchStockData failed", details: sd };

  // What fetchSegmentData returns (the EDGAR-built Sankey)
  const segmentData = segData ?? null;

  return NextResponse.json({
    ticker,
    period1: period1.toISOString().split("T")[0],
    edgar: edgarQuarters,
    quoteSummary_incomeStatementHistoryQuarterly: qsumQuarters,
    fundamentalsTimeSeries_quarterly_all: ftsqQuarters,
    stockData_latestQuarterIS: latestQuarterIS,
    edgar_segmentData: segmentData,
    edgar_8K_incomeStatement: edgar8K ?? null,
    edgar_8K_debug: edgar8KDebug ?? null,
  });
}
