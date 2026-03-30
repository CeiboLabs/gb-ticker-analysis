import type { SegmentSankeyData } from "@/types/Report";
import { fetchEdgarAll } from "@/lib/fetchEdgarSegments";

function autoScale(values: number[]): { unit: string; divisor: number } {
  const positive = values.filter((v) => isFinite(v) && v > 0);
  if (positive.length === 0) return { unit: "B", divisor: 1e9 };
  const max = Math.max(...positive);
  if (max >= 1e12) return { unit: "T", divisor: 1e12 };
  if (max >= 1e9)  return { unit: "B", divisor: 1e9 };
  if (max >= 1e6)  return { unit: "M", divisor: 1e6 };
  return { unit: "K", divisor: 1e3 };
}

export async function fetchSegmentData(
  ticker: string
): Promise<SegmentSankeyData | null> {
  // SEC EDGAR only covers US-listed companies — skip for non-US market tickers
  // (e.g., GGAL.BA, YPF.BA for BYMA; BRK.A/.B are single-letter and still attempted)
  const suffix = ticker.split(".").pop() ?? "";
  if (ticker.includes(".") && suffix.length >= 2) return null;

  try {
    const data = await fetchEdgarAll(ticker);
    if (!data) return null;

    const { incomeStatement: is, segmentResult } = data;

    const { unit, divisor } = autoScale([
      is.revenue, is.grossProfit, is.costOfRevenue,
      is.operatingIncome, is.netIncome,
    ]);

    const sc = (v: number) =>
      parseFloat((Math.max(0, v) / divisor).toFixed(2));

    const gp        = is.grossProfit || Math.max(0, is.revenue - is.costOfRevenue);
    const op        = is.operatingIncome;
    const totalOpex = Math.max(0, gp - op);

    const pct = (n: number) =>
      is.revenue ? parseFloat(((n / is.revenue) * 100).toFixed(1)) : undefined;

    // Prefer separate SM + G&A; fall back to combined SGA mapped to salesMarketing
    const smVal = is.salesMarketing > 0 ? is.salesMarketing
                : (is.sga > 0 && is.generalAdmin <= 0 ? is.sga : 0);
    const gaVal = is.generalAdmin > 0 ? is.generalAdmin : 0;
    const rdVal = is.rd > 0 ? is.rd : 0;

    // Any remaining opex not explained by known line items
    const knownOpex  = rdVal + smVal + gaVal;
    const otherOpex  = knownOpex > 0 ? Math.max(0, totalOpex - knownOpex) : 0;

    const hasBreakdown = rdVal > 0 || smVal > 0 || gaVal > 0;

    return {
      currency:     is.currency,
      period:       is.period,
      segmentPeriod: segmentResult?.segmentPeriod,
      unit,
      segments: segmentResult?.segments.map((s) => ({
        name:  s.name,
        value: sc(s.valueUSD),
        yoy:   s.yoy,
      })) ?? [],
      totalRevenue:        sc(is.revenue),
      totalRevenueYoy:     is.revenueYoy,
      grossProfit:         sc(gp),
      grossMarginPct:      pct(gp),
      costOfRevenue:       sc(is.costOfRevenue),
      operatingProfit:     sc(Math.max(0, op)),
      operatingMarginPct:  pct(Math.max(0, op)),
      netProfit:           sc(Math.max(0, is.netIncome)),
      netMarginPct:        pct(Math.max(0, is.netIncome)),
      operatingExpenses:   sc(totalOpex),
      opexBreakdown: hasBreakdown ? {
        rd:             rdVal > 0 ? sc(rdVal) : undefined,
        salesMarketing: smVal > 0 ? sc(smVal) : undefined,
        generalAdmin:   gaVal > 0 ? sc(gaVal) : undefined,
        other:          otherOpex > 0 ? sc(otherOpex) : undefined,
      } : undefined,
      tax: sc(Math.max(0, is.tax)),
      // Non-operating income = pre-tax income − operating income.
      // Positive when interest/other income makes net income approach operating income.
      nonOperatingIncome: (() => {
        const nonOp = is.incomeBeforeTax - Math.max(0, op);
        return nonOp > Math.max(0, op) * 0.01 ? sc(nonOp) : undefined;
      })(),
    };
  } catch {
    return null;
  }
}
