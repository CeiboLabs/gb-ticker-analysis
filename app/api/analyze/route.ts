import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { AnalyzeRequestSchema } from "@/lib/validators";
import { fetchStockData, fetchPeerComparison } from "@/lib/fetchStockData";
import { fetchSegmentData } from "@/lib/fetchSegmentData";
import { fetchEdgar8KIncomeStatement, type Edgar8KIncomeStatement } from "@/lib/fetchEdgar8K";
import { fetchUsdRate } from "@/lib/fxRates";
import { buildPrompt } from "@/lib/buildPrompt";
import { getOpenAIClient } from "@/lib/openai";
import { cacheGet, cacheSet, cacheClear, SHORT_TTL } from "@/lib/cache";
import { recordTickerView } from "@/lib/tickerStats";
import { checkRateLimit } from "@/lib/rateLimiter";
import {
  recordAnalyzeEvent,
  eventBaseFromRequest,
  type AnalyzeEvent,
  type SankeySource,
} from "@/lib/metrics";
import { scoreSankey, snapshotSankey } from "@/lib/sankeyQuality";

// Slim helpers for monitor snapshots — keep the JSON small but informative.
function slimEdgar8K(e: Edgar8KIncomeStatement | null) {
  if (!e) return undefined;
  return {
    cik: e.cik,
    accession: e.accession,
    sourceUrl: e.sourceUrl,
    form: e.form,
    endDate: e.endDate,
    currency: e.currency,
    isAnnual: e.isAnnual,
    isSemiAnnual: e.isSemiAnnual,
    fiscalYearEndMonth: e.fiscalYearEndMonth,
    totalRevenue: e.totalRevenue,
    costOfRevenue: e.costOfRevenue,
    grossProfit: e.grossProfit,
    researchDevelopment: e.researchDevelopment,
    sellingGeneralAdministrative: e.sellingGeneralAdministrative,
    totalOperatingExpenses: e.totalOperatingExpenses,
    operatingIncome: e.operatingIncome,
    interestExpense: e.interestExpense,
    incomeBeforeTax: e.incomeBeforeTax,
    incomeTaxExpense: e.incomeTaxExpense,
    netIncome: e.netIncome,
    aircraftFuel: e.aircraftFuel,
    salariesWages: e.salariesWages,
    aircraftMaintenance: e.aircraftMaintenance,
    aircraftRent: e.aircraftRent,
    landingFees: e.landingFees,
    depreciationAmortization: e.depreciationAmortization,
    segments: e.segments,
  };
}

function slimYahooQuarter(sd: StockData | undefined | null) {
  if (!sd?.latestQuarterIS) return undefined;
  const q = sd.latestQuarterIS;
  return {
    endDate: q.endDate,
    totalRevenue: q.totalRevenue,
    grossProfit: q.grossProfit,
    costOfRevenue: q.costOfRevenue,
    operatingIncome: q.operatingIncome,
    netIncome: q.netIncome,
    totalOperatingExpenses: q.totalOperatingExpenses,
    researchDevelopment: q.researchDevelopment,
    sellingGeneralAdministrative: q.sellingGeneralAdministrative,
  };
}
import type { StructuredReport, SegmentSankeyData } from "@/types/Report";
import type { StockData } from "@/types/StockData";

// Map a SegmentSankeyData back to the source bucket we record in the monitor.
// "segments" = original XBRL parse from fetchSegmentData, never overridden.
// "8k"/"6k"  = override from the 8-K Exhibit 99.1 parser.
// "yahoo_fallback" = built from Yahoo's latest quarterly IS when EDGAR is stale.
// "yahoo_ttm" = built from TTM margins by buildFallbackSegmentData (stub path).
function classifySankeySource(
  d: SegmentSankeyData | null | undefined,
): SankeySource {
  if (!d) return "none";
  switch (d.source) {
    case "8-K":   return "8k";
    case "6-K":   return "6k";
    case "Yahoo": return d.period === "TTM" ? "yahoo_ttm" : "yahoo_fallback";
    default:      return "segments";
  }
}

export const runtime = "edge";
export const dynamic = "force-dynamic";

// Build a minimal SegmentSankeyData from Yahoo Finance TTM margins
function buildFallbackSegmentData(sd: StockData): SegmentSankeyData | null {
  const rev = sd.totalRevenue;
  if (!rev || rev <= 0) return null;

  const gm = sd.grossMargins   ?? 0;
  const om = sd.operatingMargins ?? 0;
  const nm = sd.profitMargins  ?? 0;

  // No margin data at all — nothing meaningful to show
  if (gm <= 0 && om <= 0 && nm <= 0) return null;

  const unit    = rev >= 1e12 ? "T" : rev >= 1e9 ? "B" : "M";
  const divisor = rev >= 1e12 ? 1e12 : rev >= 1e9 ? 1e9 : 1e6;
  const sc = (v: number) => parseFloat((Math.max(0, v) / divisor).toFixed(2));

  const grossProfit      = rev * gm;
  const operatingProfit  = rev * om;   // may be negative — sc() clamps to 0
  const netProfit        = rev * nm;   // may be negative — sc() clamps to 0
  const costOfRevenue    = rev - grossProfit;
  const operatingExpenses = Math.max(0, grossProfit - Math.max(0, operatingProfit));

  return {
    currency: "USD",
    period: "TTM",
    source: "Yahoo",
    unit,
    segments: [],
    totalRevenue: sc(rev),
    grossProfit: sc(grossProfit),
    grossMarginPct: parseFloat((gm * 100).toFixed(1)),
    costOfRevenue: sc(costOfRevenue),
    operatingProfit: sc(operatingProfit),
    operatingMarginPct: parseFloat((om * 100).toFixed(1)),
    netProfit: sc(netProfit),
    netMarginPct: parseFloat((nm * 100).toFixed(1)),
    operatingExpenses: sc(operatingExpenses),
  };
}

// Yahoo updates earnings within minutes of a press release; SEC EDGAR only
// reflects the quarter once the 10-Q is filed (typically 1–3 days later).
// When Yahoo's most recent quarter end is materially newer than EDGAR's
// period end, the Sankey/income-statement panel is showing a stale quarter.
function isEdgarStale(stockData: StockData, segmentData: SegmentSankeyData | null): boolean {
  if (!segmentData?.endDate) return false;
  const yahooEnd = stockData.latestQuarterIS?.endDate;
  if (!yahooEnd) return false;
  const yahooMs = Date.parse(yahooEnd);
  const edgarMs = Date.parse(segmentData.endDate);
  if (!isFinite(yahooMs) || !isFinite(edgarMs)) return false;
  // 45 days ≈ half a quarter — comfortably past any normal filing lag, so a
  // gap this large means EDGAR is missing the most recent reported quarter.
  return (yahooMs - edgarMs) / 86_400_000 >= 45;
}

// Foreign issuers (NOK, ASML, ...) report in EUR/GBP/CHF; the parser tags
// the IS with its native currency. Multiply every monetary line by the
// USD/native rate so the chart always displays USD figures regardless of
// reporting currency. Returns null when FX is unavailable (network failure
// or unsupported currency) — caller should fall back to Yahoo rather than
// render wrong-currency numbers labeled as USD.
async function convertEdgar8KToUsd(s: Edgar8KIncomeStatement): Promise<Edgar8KIncomeStatement | null> {
  const code = (s.currency ?? "USD").toUpperCase();
  if (code === "USD") return s;
  const rate = await fetchUsdRate(code);
  if (!rate || rate <= 0) return null;
  const m = (v: number | null): number | null => (v === null ? null : v * rate);
  return {
    ...s,
    totalRevenue:                  s.totalRevenue * rate,
    costOfRevenue:                 m(s.costOfRevenue),
    grossProfit:                   m(s.grossProfit),
    researchDevelopment:           m(s.researchDevelopment),
    sellingGeneralAdministrative:  m(s.sellingGeneralAdministrative),
    salesMarketing:                m(s.salesMarketing),
    generalAdmin:                  m(s.generalAdmin),
    totalOperatingExpenses:        m(s.totalOperatingExpenses),
    operatingIncome:               m(s.operatingIncome),
    interestExpense:               m(s.interestExpense),
    incomeBeforeTax:               m(s.incomeBeforeTax),
    incomeTaxExpense:              m(s.incomeTaxExpense),
    netIncome:                     s.netIncome * rate,
    aircraftFuel:                  m(s.aircraftFuel),
    salariesWages:                 m(s.salariesWages),
    aircraftMaintenance:           m(s.aircraftMaintenance),
    aircraftRent:                  m(s.aircraftRent),
    landingFees:                   m(s.landingFees),
    depreciationAmortization:      m(s.depreciationAmortization),
    segments: s.segments?.map((seg) => ({ name: seg.name, value: seg.value * rate })),
    currency: "USD",
  };
}

// Build a Sankey from a parsed 8-K Exhibit 99.1 income statement. These are
// the actual numbers from the press release table, days before the 10-Q's
// XBRL lands. No segment breakdowns (the table is the consolidated IS), but
// every line item is real data — no TTM-margin estimates.
function buildSankeyFrom8K(
  s: Edgar8KIncomeStatement,
  currency: string,
  industryProfile?: SegmentSankeyData["industryProfile"],
): SegmentSankeyData | null {
  const rev = s.totalRevenue;
  if (rev <= 0) return null;

  const ni    = s.netIncome;
  const ibt   = s.incomeBeforeTax ?? Math.max(0, ni + (s.incomeTaxExpense ?? 0));
  // Oil/integrated issuers (XOM) and some service companies report a single
  // "Total costs and other deductions" line — no Gross Profit, no Cost of
  // Revenue. Without that we'd fake gp = rev − 0 = rev (100 % margin) and
  // the chart would render a meaningless flow. Detect "no COGS structure"
  // and fall through to an op-income-only Sankey driven by IBT.
  const hasCogsStructure = s.grossProfit !== null || s.costOfRevenue !== null;
  const gp    = hasCogsStructure
                  ? (s.grossProfit ?? Math.max(0, rev - (s.costOfRevenue ?? 0)))
                  : 0;
  // When op income isn't tagged but the issuer has no COGS layer, IBT is the
  // closest proxy (off only by interest expense in most cases) — gives the
  // chart a meaningful Op Income → NI + Tax flow instead of a dead end.
  const opInc = s.operatingIncome ?? (hasCogsStructure ? 0 : ibt);
  // Always derive opex from gp − op. Some issuers (e.g. ABBV) report
  // "Total operating costs and expenses" that includes COGS, which would
  // double-count if we used it directly for the GP→OpEx Sankey edge.
  const opex  = Math.max(0, gp - Math.max(0, opInc));
  // The op→ni gap is taxes + interest + other non-operating items. Charge
  // it all to the "tax" bucket so the Sankey balances; the label "Taxes"
  // is imperfect when interest/non-op dominate (e.g. ABBV) but the alternative
  // is a dangling op-side height with no outflow.
  const tax   = opInc > 0 && opInc > ni ? Math.max(0, opInc - Math.max(0, ni)) : (s.incomeTaxExpense ?? 0);

  const unit    = rev >= 1e12 ? "T" : rev >= 1e9 ? "B" : "M";
  const divisor = rev >= 1e12 ? 1e12 : rev >= 1e9 ? 1e9 : 1e6;
  const sc = (v: number) => parseFloat((Math.max(0, v) / divisor).toFixed(2));
  const pct = (n: number) => parseFloat(((n / rev) * 100).toFixed(1));

  // Translate calendar endDate → issuer's fiscal-year period label. Default
  // to December (FYE=12) when the submissions JSON didn't expose a fiscal
  // year end — calendar-year reporters are the dominant case and produce the
  // correct "Q3 FY2025" label without the override.
  //
  // For non-December fiscals (SKBL FYE=3, AAPL FYE=9), the calendar quarter
  // is wrong: SKBL's six months ended Sep 30 2025 is H1 of FY2026 (April
  // 2025 — March 2026), not Q3 of FY2025. We compute:
  //   • fyEndYear  — calendar year in which the issuer's fiscal year ends
  //   • monthsIn   — how many months into the fiscal year endDate falls (1–12)
  //   • period     — H1/H2 for semiannual interim, Q1–Q4 otherwise
  const period = (() => {
    const d = new Date(s.endDate);
    const m = d.getUTCMonth() + 1;          // 1–12
    const y = d.getUTCFullYear();
    const fye = (s.fiscalYearEndMonth && s.fiscalYearEndMonth >= 1 && s.fiscalYearEndMonth <= 12)
      ? s.fiscalYearEndMonth
      : 12;
    const fyStart = (fye % 12) + 1;          // 1 for Dec FYE, 4 for March FYE
    let monthsIn = m - fyStart + 1;
    if (monthsIn <= 0) monthsIn += 12;
    // Fiscal-year label: the calendar year in which the fiscal year ends.
    // SKBL endDate Sep 30 2025 with FYE=March → fiscal year ends March 2026 → FY2026.
    // AAPL endDate Dec 27 2025 with FYE=Sep   → fiscal year ends Sep 2026   → FY2026.
    // Calendar filer (FYE=12): m never exceeds fye, so fy = y as expected.
    const fy = m > fye ? y + 1 : y;
    if (s.isAnnual) return `FY${fy}`;
    if (s.isSemiAnnual) return `${monthsIn <= 6 ? "H1" : "H2"} FY${fy}`;
    const q = Math.min(4, Math.max(1, Math.ceil(monthsIn / 3)));
    return `Q${q} FY${fy}`;
  })();

  const rd  = s.researchDevelopment ?? 0;
  const sga = s.sellingGeneralAdministrative ?? 0;
  // Issuers that split S&M and G&A into separate IS lines (BABA, NIO, JD,
  // PDD, BIDU, …) populate `salesMarketing` and `generalAdmin` directly.
  // When both are present we render them as two distinct opex buckets;
  // otherwise we fall back to the combined SG&A line as a single bucket.
  const smRaw = s.salesMarketing ?? 0;
  const gaRaw = s.generalAdmin ?? 0;
  const splitSga = smRaw > 0 && gaRaw > 0;
  const sm = splitSga ? smRaw : sga;
  const ga = splitSga ? gaRaw : 0;
  // Airline detection: US carriers (AAL/DAL/UAL/LUV...) report fuel + labor
  // as top-level IS lines (no GP/COGS layer). IFRS-by-function carriers
  // (LATAM/LTM) report a single Cost-of-Sales line and break it down by
  // nature in a footnote — same buckets emerge after the by-nature scan.
  // Two acceptance paths:
  //   (a) Standard: fuel ≥ 5% of rev + ≥1 other airline signal
  //       (maintenance / aircraft rent / landing fees). Catches mainline
  //       carriers that pay their own fuel.
  //   (b) Regional: fuel < 5% (capacity-purchase carriers like SKYW reimburse
  //       fuel through Flying-Agreement revenue, so the IS fuel line is tiny)
  //       BUT aircraft maintenance is present AND the airline-bucket sum
  //       (fuel + labor + maint + D&A) is ≥40% of revenue. The bucket sum
  //       gate keeps non-airlines (logistics companies with stray "Aircraft
  //       fuel" lines) out, since their non-airline cost base swamps the
  //       airline buckets.
  const airlineSignalCount8K =
    ((s.aircraftMaintenance ?? 0) > 0 ? 1 : 0) +
    ((s.aircraftRent ?? 0) > 0 ? 1 : 0) +
    ((s.landingFees ?? 0) > 0 ? 1 : 0);
  const fuelRaw   = s.aircraftFuel ?? 0;
  const laborRaw  = s.salariesWages ?? 0;
  const maintRaw  = s.aircraftMaintenance ?? 0;
  const depRaw    = s.depreciationAmortization ?? 0;
  const bucketSum = fuelRaw + laborRaw + maintRaw + depRaw;
  const baseAirline = fuelRaw > 0 && laborRaw > 0 && rev > 0;
  const mainlinePath  = baseAirline && fuelRaw / rev >= 0.05 && airlineSignalCount8K >= 1;
  const regionalPath  = baseAirline && maintRaw > 0 && bucketSum / rev >= 0.4;
  const isAirline = mainlinePath || regionalPath;
  // Buckets are populated by the airline-aware scan; for IFRS issuers the
  // values cover items already inside COGS, so they sum to (COGS + opex)
  // rather than just opex.
  const fuel        = isAirline ? (s.aircraftFuel ?? 0) : 0;
  const labor       = isAirline ? (s.salariesWages ?? 0) : 0;
  const maint       = isAirline ? (s.aircraftMaintenance ?? 0) : 0;
  const rentLanding = isAirline ? ((s.aircraftRent ?? 0) + (s.landingFees ?? 0)) : 0;
  const depAmort    = isAirline ? (s.depreciationAmortization ?? 0) : 0;
  // Airline opex denominator: when in airline mode, treat ALL costs below
  // revenue as operating costs (rev − opInc), since the airline buckets
  // include what would otherwise be COGS for IFRS-by-function issuers.
  // Falls back to totalOperatingExpenses for US carriers when reported.
  const airlineOpex = isAirline
    ? Math.max(0, rev - Math.max(0, opInc))
    : opex;

  const knownOpex = (rd > 0 ? rd : 0) + (sm > 0 ? sm : 0) + (ga > 0 ? ga : 0)
    + fuel + labor + maint + rentLanding + depAmort;
  const otherOpex = knownOpex > 0 ? Math.max(0, airlineOpex - knownOpex) : 0;
  // Single-step IS issuers (e.g. ADP) include R&D inside Cost of Revenue, not
  // in OpEx — so attributing R&D to the OpEx node would overflow the flow.
  // Only emit the breakdown when the components reconcile to ≤105 % of opex.
  // Airline mode always emits a breakdown (the airline buckets ARE the opex
  // structure — without them the chart falls back to a useless single bucket).
  const hasBreakdown = isAirline ||
    ((rd > 0 || sm > 0 || ga > 0) && knownOpex <= opex * 1.05);

  const segments = (s.segments ?? [])
    .map((seg) => ({ name: seg.name, value: sc(seg.value) }))
    .filter((seg) => seg.value > 0);

  return {
    currency,
    period,
    endDate: s.endDate,
    source: s.form === "6-K" ? "6-K" : "8-K",
    unit,
    industryProfile,
    segments,
    totalRevenue:        sc(rev),
    // Airlines don't have a meaningful Gross-Profit / Cost-of-Revenue layer
    // for our purposes — the airline buckets (fuel, labor, maintenance, ...)
    // span what would otherwise be COGS + OpEx combined. Zeroing both gp and
    // cogs forces SankeyChart into the no-GP "Op. Costs" layout (same as
    // profitable US carriers UAL/LUV) and prevents double counting when the
    // issuer (e.g. LATAM IFRS-by-function) reports a single Cost-of-Sales
    // line on its main IS.
    grossProfit:         sc(isAirline ? 0 : gp),
    grossMarginPct:      !isAirline && gp > 0 ? pct(gp) : undefined,
    costOfRevenue:       sc(isAirline ? 0 : Math.max(0, rev - gp)),
    operatingProfit:     sc(Math.max(0, opInc)),
    operatingMarginPct:  opInc > 0 ? pct(opInc) : undefined,
    netProfit:           sc(Math.max(0, ni)),
    netMarginPct:        ni > 0 ? pct(ni) : undefined,
    netLoss:             ni < 0 ? sc(-ni) : undefined,
    operatingExpenses:   sc(isAirline ? airlineOpex : opex),
    opexBreakdown: hasBreakdown ? {
      rd:             rd > 0  ? sc(rd) : undefined,
      salesMarketing: sm > 0  ? sc(sm) : undefined,
      generalAdmin:   ga > 0  ? sc(ga) : undefined,
      other:          otherOpex > 0 ? sc(otherOpex) : undefined,
      fuel:           fuel > 0 ? sc(fuel) : undefined,
      salariesWages:  labor > 0 ? sc(labor) : undefined,
      maintenance:    maint > 0 ? sc(maint) : undefined,
      rentAndLanding: rentLanding > 0 ? sc(rentLanding) : undefined,
      depreciation:   depAmort > 0 ? sc(depAmort) : undefined,
    } : undefined,
    tax: sc(Math.max(0, tax)),
    nonOperatingIncome: (() => {
      const nonOp = ibt - Math.max(0, opInc);
      return nonOp > Math.max(0, opInc) * 0.01 ? sc(nonOp) : undefined;
    })(),
  };
}

// Build a Sankey from Yahoo's latest quarterly income statement. Used when
// EDGAR's most recent 10-Q lags behind a reported quarter — segments are
// empty (Yahoo doesn't break revenue down by business line) but headline
// totals match what the chart's bars are showing.
function buildSankeyFromYahooQuarter(sd: StockData): SegmentSankeyData | null {
  const q = sd.latestQuarterIS;
  if (!q || q.totalRevenue <= 0) return null;

  // Need at least one of GP/OpInc/NetInc to render a meaningful Sankey
  // beyond a single revenue node — without that, the chart component drops
  // it for having too few nodes/links and the user sees nothing.
  const hasMeaningfulData =
    (q.grossProfit ?? 0) > 0 ||
    (q.operatingIncome ?? 0) > 0 ||
    (q.netIncome ?? 0) > 0 ||
    (q.costOfRevenue ?? 0) > 0;
  if (!hasMeaningfulData) return null;

  const rev = q.totalRevenue;
  const ni  = q.netIncome ?? 0;

  // Yahoo zeroes out (not nullifies) IS items it doesn't have for a given
  // ticker — e.g. ABBV's Q1 2026 only has rev + ni populated, gp/op/cogs/opex
  // all return 0. Treat 0 as "missing" so we can fall back to TTM-margin
  // estimates applied to the actual quarter revenue. Net income is taken
  // as-is since it's the most consequential headline number.
  const yahooField = (v: number | null | undefined): number | null =>
    typeof v === "number" && v > 0 ? v : null;

  const yahooGp   = yahooField(q.grossProfit);
  const yahooCogs = yahooField(q.costOfRevenue);
  const yahooOp   = yahooField(q.operatingIncome);
  const yahooOpex = yahooField(q.totalOperatingExpenses);
  const yahooTax  = yahooField(q.incomeTaxExpense);

  const tmGm = sd.grossMargins ?? 0;
  const tmOm = sd.operatingMargins ?? 0;

  // Hybrid: actual where Yahoo has it, TTM-margin estimate where Yahoo zeroes
  const gp    = yahooGp ?? (tmGm > 0 ? rev * tmGm : Math.max(0, rev - (yahooCogs ?? 0)));
  const opInc = yahooOp ?? (tmOm > 0 ? rev * tmOm : 0);
  const opex  = yahooOpex ?? Math.max(0, gp - Math.max(0, opInc));

  // The gap between op and ni is taxes + interest + other below-the-line.
  // If Yahoo gave us tax explicitly, use it. Otherwise charge the entire
  // gap to a "Tax & Other" bucket so the Sankey balances visually instead
  // of leaving a dangling op-side height with no outflow.
  const opNiGap = Math.max(0, Math.max(0, opInc) - Math.max(0, ni));
  const tax     = yahooTax ?? opNiGap;
  const ibt     = q.incomeBeforeTax ?? Math.max(0, ni + tax);

  const unit    = rev >= 1e12 ? "T" : rev >= 1e9 ? "B" : "M";
  const divisor = rev >= 1e12 ? 1e12 : rev >= 1e9 ? 1e9 : 1e6;
  const sc = (v: number) => parseFloat((Math.max(0, v) / divisor).toFixed(2));
  const pct = (n: number) => parseFloat(((n / rev) * 100).toFixed(1));

  // Period label — assumes calendar quarter end (Mar/Jun/Sep/Dec). Fiscal-year
  // tagging here may not match the company's fiscal calendar but at least the
  // numbers are correct and the endDate matches the chart's latest bar.
  const d  = new Date(q.endDate);
  const qN = Math.floor(d.getUTCMonth() / 3) + 1;
  const yr = d.getUTCFullYear();
  // Annotate when any of the breakdown items came from TTM-margin estimates
  // rather than direct Yahoo fields, so the label reflects the data quality.
  const usedEstimates = !yahooGp || !yahooOp || !yahooTax;
  const period = `Q${qN} FY${yr}${usedEstimates ? " · pendiente 10-Q" : ""}`;

  const rd = q.researchDevelopment ?? 0;
  const sga = q.sellingGeneralAdministrative ?? 0;
  const knownOpex = (rd > 0 ? rd : 0) + (sga > 0 ? sga : 0);
  const otherOpex = knownOpex > 0 ? Math.max(0, opex - knownOpex) : 0;
  const hasBreakdown = rd > 0 || sga > 0;

  return {
    currency: sd.currency ?? "USD",
    period,
    endDate: q.endDate,
    source: "Yahoo",
    unit,
    segments: [],
    totalRevenue: sc(rev),
    grossProfit: sc(gp),
    grossMarginPct: gp > 0 ? pct(gp) : undefined,
    costOfRevenue: sc(Math.max(0, rev - gp)),
    operatingProfit: sc(Math.max(0, opInc)),
    operatingMarginPct: opInc > 0 ? pct(opInc) : undefined,
    netProfit: sc(Math.max(0, ni)),
    netMarginPct: ni > 0 ? pct(ni) : undefined,
    operatingExpenses: sc(opex),
    opexBreakdown: hasBreakdown ? {
      rd:             rd > 0  ? sc(rd) : undefined,
      salesMarketing: sga > 0 ? sc(sga) : undefined,
      other:          otherOpex > 0 ? sc(otherOpex) : undefined,
    } : undefined,
    tax: sc(Math.max(0, tax)),
    nonOperatingIncome: (() => {
      const nonOp = ibt - Math.max(0, opInc);
      return nonOp > Math.max(0, opInc) * 0.01 ? sc(nonOp) : undefined;
    })(),
  };
}

// Derive the second-half (H2) period for foreign issuers that file 20-F annual
// + a single H1 6-K (no quarterly statements). Mirrors the Q4 = 10-K − Q3 10-Q
// pattern already wired up for US issuers (lib/fetchEdgarSegments.ts:1295), but
// the H1 source is an HTML 6-K (no XBRL), so the subtraction has to happen on
// the consumer side after both pipelines have landed.
//
// Triggers when:
//   • annual is a 20-F (foreign-private-issuer annual)
//   • h1 is a 6-K with isSemiAnnual=true
//   • h1's endDate is ~6 months before annual's endDate (same fiscal year)
//
// Falls back to null (caller keeps the annual) when:
//   • H2 revenue ≤ 0 (subtraction would produce a meaningless chart)
//   • Currency conversion fails for non-USD H1 values
async function deriveH2FromAnnualAnd6K(
  annual: SegmentSankeyData,
  h1: Edgar8KIncomeStatement,
): Promise<SegmentSankeyData | null> {
  if (annual.source !== "20-F" || !annual.endDate) return null;
  if (!h1.isSemiAnnual || !h1.endDate) return null;

  const annualMs = Date.parse(annual.endDate);
  const h1Ms     = Date.parse(h1.endDate);
  if (!isFinite(annualMs) || !isFinite(h1Ms)) return null;
  // H1 should end ~6 months before annual end, ±30 days for fiscal calendar drift
  const gapDays = (annualMs - h1Ms) / 86_400_000;
  if (gapDays < 150 || gapDays > 210) return null;

  const h1Usd = (h1.currency ?? "USD").toUpperCase() === "USD"
    ? h1
    : await convertEdgar8KToUsd(h1);
  if (!h1Usd) return null;

  const divisor = annual.unit === "T" ? 1e12
                : annual.unit === "B" ? 1e9
                : annual.unit === "M" ? 1e6
                : 1e3;
  const sc = (raw: number | null | undefined) => raw == null ? 0 : raw / divisor;
  const sub = (a: number | undefined, raw: number | null | undefined) =>
    Math.max(0, (a ?? 0) - sc(raw));
  const round2 = (n: number) => parseFloat(n.toFixed(2));

  const h2Rev = round2((annual.totalRevenue ?? 0) - sc(h1Usd.totalRevenue));
  if (h2Rev <= 0) return null;

  // Signed op/NI: SegmentSankeyData clamps operatingProfit/netProfit to ≥0 and
  // exposes the loss magnitude separately. Recover the signed value so we can
  // compute H2's operating result correctly when one half is profitable and
  // the other is a loss (RYOJ FY2025: H1 +$0.65M op, H2 −$1.4M op, full year
  // −$0.76M op). Without this the unsigned subtraction returns 0 and H2 looks
  // break-even instead of loss-making.
  const annualSignedOp = (annual.operatingProfit ?? 0) - (annual.operatingLoss ?? 0);
  const annualSignedNi = (annual.netProfit       ?? 0) - (annual.netLoss       ?? 0);
  const h2SignedOp = annualSignedOp - sc(h1Usd.operatingIncome);
  const h2SignedNi = annualSignedNi - sc(h1Usd.netIncome);

  const h2Gp   = round2(sub(annual.grossProfit,   h1Usd.grossProfit));
  const h2Cogs = round2(sub(annual.costOfRevenue, h1Usd.costOfRevenue));
  // OpEx via signed math: gp − signedOp = OpEx including the loss gap. Falls
  // back to the tagged-OpEx subtraction when both halves are profitable so
  // small rounding noise doesn't flip OpEx vs the issuer's reported total.
  const h2OpexSigned = round2(Math.max(0, h2Gp - h2SignedOp));
  const h2OpexTagged = round2(sub(annual.operatingExpenses, h1Usd.totalOperatingExpenses));
  const h2Opex = h2SignedOp < 0 ? h2OpexSigned : h2OpexTagged;
  const h2OpProfit = round2(Math.max(0, h2SignedOp));
  const h2OpLoss   = h2SignedOp < 0 ? round2(-h2SignedOp) : undefined;
  const h2NetProf  = round2(Math.max(0, h2SignedNi));
  const h2NetLoss  = h2SignedNi < 0 ? round2(-h2SignedNi) : undefined;
  const pct = (n: number) => h2Rev > 0 ? parseFloat(((n / h2Rev) * 100).toFixed(1)) : undefined;

  // OpEx breakdown: only subtract buckets the 6-K parser CAN extract from the
  // interim IS (rd / sm / ga / SGA / airline buckets / D&A). Buckets that the
  // XBRL annual tagged but the 6-K HTML doesn't break out (payroll, rent,
  // advertising, stock comp, impairment, restructuring) cannot be subtracted
  // — keeping the annual values unchanged would overshoot the H2 OpEx total
  // (RYOJ H2: G&A $1.5M + Payroll $0.9M would sum to $2.4M against an OpEx
  // parent of $2.0M). Drop those buckets and let `other` absorb the residual
  // so the breakdown reconciles to the H2 parent.
  const ob = annual.opexBreakdown;
  const h2Breakdown = ob ? {
    rd:             ob.rd             != null ? round2(sub(ob.rd,             h1Usd.researchDevelopment))      : undefined,
    salesMarketing: ob.salesMarketing != null ? round2(sub(ob.salesMarketing,
                      h1Usd.salesMarketing ?? h1Usd.sellingGeneralAdministrative)) : undefined,
    generalAdmin:   ob.generalAdmin   != null ? round2(sub(ob.generalAdmin,   h1Usd.generalAdmin))             : undefined,
    other:          undefined as number | undefined,  // recomputed as residual below
    fuel:           ob.fuel           != null ? round2(sub(ob.fuel,           h1Usd.aircraftFuel))             : undefined,
    salariesWages:  ob.salariesWages  != null ? round2(sub(ob.salariesWages,  h1Usd.salariesWages))            : undefined,
    maintenance:    ob.maintenance    != null ? round2(sub(ob.maintenance,    h1Usd.aircraftMaintenance))      : undefined,
    rentAndLanding: ob.rentAndLanding != null ? round2(sub(ob.rentAndLanding,
                      (h1Usd.aircraftRent ?? 0) + (h1Usd.landingFees ?? 0)))                                    : undefined,
    depreciation:   ob.depreciation   != null ? round2(sub(ob.depreciation,   h1Usd.depreciationAmortization)) : undefined,
  } as NonNullable<SegmentSankeyData["opexBreakdown"]> : undefined;
  // Compute "other" as residual = H2 OpEx − sum of admitted sub-buckets. Picks
  // up the dropped buckets (payroll, rent, ...) plus any other untagged opex.
  if (h2Breakdown && h2Opex > 0) {
    const known = (h2Breakdown.rd ?? 0) + (h2Breakdown.salesMarketing ?? 0)
                + (h2Breakdown.generalAdmin ?? 0)
                + (h2Breakdown.fuel ?? 0) + (h2Breakdown.salariesWages ?? 0)
                + (h2Breakdown.maintenance ?? 0) + (h2Breakdown.rentAndLanding ?? 0)
                + (h2Breakdown.depreciation ?? 0);
    const residual = Math.max(0, h2Opex - known);
    h2Breakdown.other = residual > 0.005 ? round2(residual) : undefined;
  }

  // Period label: H2 of the fiscal year that ends at annual.endDate.
  // Default to calendar-year FY when fiscalYearEnd info isn't available.
  const annualYr = new Date(annual.endDate).getUTCFullYear();
  const period = `H2 FY${annualYr}`;

  // Segments: the 6-K's HTML usually doesn't break revenue down by segment, so
  // re-use annual's segments scaled to H2's revenue share. YoY drops because
  // the prior-period H2 isn't comparable.
  const annualRev = annual.totalRevenue ?? 0;
  const scale = annualRev > 0 ? h2Rev / annualRev : 0;
  const h2Segments = scale > 0
    ? annual.segments.map((seg) => ({
        name:  seg.name,
        value: round2(seg.value * scale),
        yoy:   undefined,
      }))
    : [];

  return {
    ...annual,
    period,
    segmentPeriod: annual.period,  // signals "segments come from FY annual"
    source: "6-K",
    segments: h2Segments,
    totalRevenue: h2Rev,
    totalRevenueYoy: undefined,
    grossProfit: h2Gp,
    grossMarginPct: h2Gp > 0 ? pct(h2Gp) : undefined,
    grossMarginYoy: undefined,
    costOfRevenue: h2Cogs,
    operatingProfit: h2OpProfit,
    operatingMarginPct: h2OpProfit > 0 ? pct(h2OpProfit) : undefined,
    operatingLoss: h2OpLoss,
    netProfit: h2NetProf,
    netMarginPct: h2NetProf > 0 ? pct(h2NetProf) : undefined,
    netLoss: h2NetLoss,
    operatingExpenses: h2Opex,
    opexBreakdown: h2Breakdown,
  };
}

// Convert a field value to a readable string if GPT-4o returns an object instead of prose
function serializeField(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);

  // Format known moat object shape: { poderDeFijacionDePrecios, fuerzaDeMarca, costosDeCambio, efectosDeRed, conclusion }
  const obj = value as Record<string, unknown>;
  const labelMap: Record<string, string> = {
    poderDeFijacionDePrecios: "Poder de fijación de precios",
    fuerzaDeMarca: "Fuerza de marca",
    costosDeCambio: "Costos de cambio",
    efectosDeRed: "Efectos de red",
    pricingPower: "Poder de fijación de precios",
    brandStrength: "Fuerza de marca",
    switchingCosts: "Costos de cambio",
    networkEffects: "Efectos de red",
  };

  const parts: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key === "conclusion" || key === "overall" || key === "compositeScore") continue;
    const label = labelMap[key] ?? key;
    parts.push(`${label}: ${val}/10`);
  }

  const conclusion = obj.conclusion ?? obj.overall ?? obj.compositeScore;
  if (conclusion) parts.push(String(conclusion));

  return parts.join(". ") || JSON.stringify(obj);
}

export async function POST(req: NextRequest) {
  // Monitor: capture request-level metadata once. Each exit path fills in the
  // outcome and fires recordAnalyzeEvent — D1 write is best-effort.
  const startedAt = Date.now();
  const eventBase = eventBaseFromRequest(req);
  const fireEvent = (e: Omit<AnalyzeEvent, keyof typeof eventBase> & { ticker: string }) => {
    void recordAnalyzeEvent({
      ...eventBase,
      durationMs: Date.now() - startedAt,
      ...e,
    });
  };

  // 0. Rate limiting — keyed by a per-browser session cookie rather than IP, so
  // multiple users behind the same office NAT each get their own bucket.
  // Cookie is httpOnly and lives for a year; missing/cleared cookie just mints
  // a fresh session (acceptable trade-off vs locking out shared-IP offices).
  const SESSION_COOKIE = "ticker_session";
  const existingSession = req.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = existingSession ?? crypto.randomUUID();
  const setCookieHeader = existingSession
    ? null
    : `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`;
  const withSession = <T extends Response>(res: T): T => {
    if (setCookieHeader) res.headers.append("Set-Cookie", setCookieHeader);
    return res;
  };

  const { allowed, retryAfter } = checkRateLimit(sessionId);
  if (!allowed) {
    fireEvent({ ticker: "-", status: "rate_limited", errorStage: "rate_limit" });
    return withSession(NextResponse.json(
      {
        error: "Análisis no disponible por el momento. Intente en unos minutos.",
        code: "analysis_unavailable",
      },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    ));
  }

  // 1. Parse + validate
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    fireEvent({ ticker: "-", status: "bad_request", errorStage: "parse", errorMsg: "invalid JSON body" });
    return withSession(NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }));
  }

  const parsed = AnalyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid request";
    fireEvent({ ticker: "-", status: "bad_request", errorStage: "parse", errorMsg: msg });
    return withSession(NextResponse.json({ error: msg }, { status: 400 }));
  }

  const { ticker, refresh } = parsed.data;

  // 2. Cache check
  if (!refresh) {
    const cached = await cacheGet(ticker);
    if (cached) {
      // If EDGAR data was already stale relative to Yahoo when this was
      // cached, treat as a miss so we re-fetch — the 10-Q may now be filed.
      if (isEdgarStale(cached.stockData, cached.report.segmentData ?? null)) {
        await cacheClear(ticker);
      } else {
        void recordTickerView(ticker).catch(() => {});
        const qCached = scoreSankey(cached.report.segmentData ?? null, ticker);
        fireEvent({
          ticker,
          status: "cache_hit",
          sankeySource: classifySankeySource(cached.report.segmentData ?? null),
          sankeyStale: false,
          qualityScore: qCached.score,
          hasSegments: qCached.hasSegments,
          segmentCount: qCached.segmentCount,
          hasOpexBreakdown: qCached.hasOpexBreakdown,
          segmentBalancePct: qCached.segmentBalancePct,
          costBalancePct: qCached.costBalancePct,
          opexBalancePct: qCached.opexBalancePct,
          opChainBalancePct: qCached.opChainBalancePct,
          qualityFlags: qCached.findings.map((f) => f.code),
          qualityFindings: qCached.findings.length > 0 ? JSON.stringify(qCached.findings) : null,
          sankeySnapshot: snapshotSankey({
            finalSankey: cached.report.segmentData ?? null,
            overridePath: "cache",
            yahooQuarter: slimYahooQuarter(cached.stockData),
            yahooCurrency: cached.stockData?.currency ?? null,
          }),
          verdictRating: cached.report.verdict?.rating ?? null,
          verdictConviction: cached.report.verdict?.conviction ?? null,
          verdictRationale: cached.report.verdict?.rationale ?? null,
          companyName: cached.stockData?.companyName ?? null,
          currentPrice: cached.stockData?.currentPrice ?? null,
          marketCap: cached.stockData?.marketCap ?? null,
          bullTarget: cached.report.bullCase?.priceTarget ?? null,
          bearTarget: cached.report.bearCase?.priceTarget ?? null,
        });
        return withSession(NextResponse.json({ report: cached.report, stockData: cached.stockData, cached: true }));
      }
    }
  } else {
    await cacheClear(ticker);
  }

  // 3. Fetch financial data
  let stockData;
  let segmentData;
  // Monitor: track which secondary sources came back so we can spot regressions
  // (e.g. EDGAR 8-K fetch starts failing across the board). Hoisted out of
  // the try block so we can include them in the snapshot at the success exit.
  let edgar8kOk: boolean | null = null;
  let segmentsOk: boolean | null = null;
  let edgar8K: Edgar8KIncomeStatement | null = null;
  let xbrlSegmentsRaw: SegmentSankeyData | null = null;
  let overridePath: "8k_override" | "yahoo_fallback" | "yahoo_ttm" | "segments_kept" | "stub" | "cache" = "segments_kept";
  try {
    let peerComparison;
    [stockData, segmentData, peerComparison, edgar8K] = await Promise.all([
      fetchStockData(ticker),
      fetchSegmentData(ticker).then(
        (r) => { segmentsOk = r != null; return r; },
        (e) => { segmentsOk = false; throw e; },
      ),
      fetchPeerComparison(ticker),
      fetchEdgar8KIncomeStatement(ticker).then(
        (r) => { edgar8kOk = r != null; return r; },
        (e) => { edgar8kOk = false; throw e; },
      ),
    ]);
    stockData.peerComparison = peerComparison;
    xbrlSegmentsRaw = segmentData;

    // Override the Sankey when EDGAR's 10-Q/10-K either (a) lags behind the
    // press-released quarter or (b) failed to parse entirely — without this,
    // a missing 10-Q drops the user to the Yahoo-TTM fallback even when the
    // 8-K with this quarter's actuals is sitting right there. Source priority:
    //   1. 8-K Exhibit 99.1 parse — actual press-release numbers, no estimates
    //   2. Yahoo + TTM-margin estimates — partial actuals + interpolation
    //   3. Leave EDGAR Sankey as-is — older period but real and complete
    // Foreign private issuers (SKBL, BABA, ASML, ...) often have sparse Yahoo
    // quarterly data, so isEdgarStale's Yahoo-vs-EDGAR comparison returns
    // false and the override never fires — even when the 8-K/6-K reports a
    // strictly more recent period than the XBRL annual we just pulled. Add a
    // direct endDate comparison so an 8-K that ships a newer fiscal period
    // wins regardless of whether Yahoo also confirmed it.
    const eightKMoreRecent = !!(
      edgar8K?.endDate && segmentData?.endDate && edgar8K.endDate > segmentData.endDate
    );
    // Foreign private issuers (NIO, BABA, ...) file a 20-F annual and a Q4
    // earnings 6-K with the SAME fiscal-year-end date. The 6-K press release
    // exposes a "Three Months Ended" quarterly column alongside the annual,
    // and our 6-K parser picks the quarterly. Without this branch the strict
    // `>` comparison above keeps the FY annual 20-F and the user never sees
    // the Q4 slice they actually want. Only swap when the 6-K is genuinely
    // quarterly — IFRS annual-only 6-Ks (LATAM/LTM) set isAnnual=true and
    // would just be a lateral move.
    const segIsAnnual = segmentData?.source === "20-F" || segmentData?.source === "10-K";
    const eightKQuarterlyForAnnualClose = !!(
      edgar8K?.endDate &&
      segmentData?.endDate &&
      edgar8K.endDate === segmentData.endDate &&
      segIsAnnual &&
      edgar8K.isAnnual !== true
    );
    const needsOverride = !segmentData || isEdgarStale(stockData, segmentData)
      || eightKMoreRecent || eightKQuarterlyForAnnualClose;
    if (needsOverride) {
      let override: SegmentSankeyData | null = null;
      let pickedFrom: "8k_override" | "yahoo_fallback" | null = null;
      if (edgar8K) {
        const segEnd = segmentData?.endDate ?? "";
        if (!segEnd || edgar8K.endDate > segEnd || eightKQuarterlyForAnnualClose) {
          // All Sankey/chart values rendered in USD regardless of reporting
          // currency, so a CNY/EUR/JPY-denominated 8-K/6-K becomes directly
          // comparable to USD-reporting peers in the same dashboard. FX rate
          // pulled from the ECB-sourced Frankfurter feed (24h cache). When
          // FX is unavailable we leave `override` null so the next branch
          // falls back to Yahoo (which is already USD) rather than render
          // foreign-currency numbers labeled as USD.
          const native = (edgar8K.currency ?? "USD").toUpperCase();
          const edgar8KUsd = native === "USD"
            ? edgar8K
            : await convertEdgar8KToUsd(edgar8K);
          if (edgar8KUsd) {
            override = buildSankeyFrom8K(edgar8KUsd, "USD", segmentData?.industryProfile);
          }
          if (override) pickedFrom = "8k_override";
          // Preserve XBRL segments when the 8-K parser can't extract them.
          // Press releases for oil/gas (CVX, XOM) and many bank/insurance
          // issuers don't put segment breakdowns in the consolidated IS table
          // — the data lives in narrative footnotes our parser doesn't read.
          // The XBRL segments are slightly older but accurate; rather than
          // showing an empty sources column, scale them proportionally to
          // the 8-K's headline revenue so the Sankey balances visually.
          if (override
              && (!override.segments || override.segments.length === 0)
              && segmentData?.segments && segmentData.segments.length > 0
              && segmentData.totalRevenue > 0) {
            const scale = override.totalRevenue / segmentData.totalRevenue;
            override.segments = segmentData.segments.map((s) => ({
              name:  s.name,
              value: parseFloat((s.value * scale).toFixed(2)),
              yoy:   undefined, // YoY no longer accurate after scaling — drop it
            }));
            // Mark the period mismatch so the chart header shows that segments
            // come from an older filing than the headline numbers.
            override.segmentPeriod = segmentData.segmentPeriod ?? segmentData.period;
          }
        }
      }
      if (!override) {
        override = buildSankeyFromYahooQuarter(stockData);
        if (override) pickedFrom = "yahoo_fallback";
      }
      if (override) {
        segmentData = override;
        if (pickedFrom) overridePath = pickedFrom;
      }
    }

    // H2 derivation for FPI semi-annual filers (RYOJ, SKBL, ASML-style):
    // when the chart is sitting on a 20-F annual but a 6-K exposed H1 of the
    // SAME fiscal year, H2 = annual − H1 gives a granular six-month period
    // matching what `Q4 = 10-K − 9M 10-Q` does for US issuers. Fired AFTER
    // the override branch so that if 8-K override already produced a quarterly
    // (e.g. NIO Q4 6-K), we don't undo it.
    if (segmentData?.source === "20-F" && edgar8K?.isSemiAnnual) {
      const h2 = await deriveH2FromAnnualAnd6K(segmentData, edgar8K);
      if (h2) segmentData = h2;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("no está listado")) {
      fireEvent({ ticker, status: "bad_request", errorStage: "yahoo", errorMsg: message, edgar8kOk, segmentsOk });
      return withSession(NextResponse.json({ error: message }, { status: 400 }));
    }
    if (message.toLowerCase().includes("not found") || message.toLowerCase().includes("no data")) {
      fireEvent({ ticker, status: "not_found", errorStage: "yahoo", errorMsg: message, edgar8kOk, segmentsOk });
      return withSession(NextResponse.json({ error: `Ticker "${ticker}" not found.` }, { status: 404 }));
    }
    // Either fetchStockData or one of the EDGAR fetches threw — pick the
    // most likely stage from the rejection origin recorded above.
    const stage = segmentsOk === false || edgar8kOk === false ? "edgar" : "yahoo";
    fireEvent({ ticker, status: "error", errorStage: stage, errorMsg: message, edgar8kOk, segmentsOk });
    return withSession(NextResponse.json(
      {
        error: "Análisis no disponible por el momento. Intente en unos minutos.",
        code: "analysis_unavailable",
      },
      { status: 502 }
    ));
  }

  // 4. Mock mode — skip OpenAI, return stub report with real segment data
  if (process.env.MOCK_REPORT === "true") {
    const stub: StructuredReport = {
      businessModel: "Mock mode activo — análisis de OpenAI deshabilitado.",
      revenueStreams: "", profitabilityAnalysis: "", balanceSheetHealth: "",
      freeCashFlow: "", capitalExpenditure: "", competitiveAdvantages: "", managementQuality: "",
      valuationSnapshot: "", recentEarnings: "", riskFactors: "",
      catalysts: "", industryContext: "",
      verdict: { rating: "HOLD", conviction: "LOW", rationale: "Mock mode — sin análisis real." },
      bullCase: { narrative: "", priceTarget: "—" },
      bearCase: { narrative: "", priceTarget: "—" },
      segmentData: segmentData ?? buildFallbackSegmentData(stockData),
    };
    const stubStale = isEdgarStale(stockData, stub.segmentData ?? null);
    const stubTtl = stubStale ? SHORT_TTL : undefined;
    cacheSet(ticker, stub, stockData, stubTtl);
    void recordTickerView(ticker).catch(() => {});
    const qStub = scoreSankey(stub.segmentData ?? null, ticker);
    fireEvent({
      ticker,
      status: "ok",
      sankeySource: classifySankeySource(stub.segmentData),
      sankeyStale: stubStale,
      edgar8kOk,
      segmentsOk,
      qualityScore: qStub.score,
      hasSegments: qStub.hasSegments,
      segmentCount: qStub.segmentCount,
      hasOpexBreakdown: qStub.hasOpexBreakdown,
      segmentBalancePct: qStub.segmentBalancePct,
      costBalancePct: qStub.costBalancePct,
      opexBalancePct: qStub.opexBalancePct,
      opChainBalancePct: qStub.opChainBalancePct,
      qualityFlags: qStub.findings.map((f) => f.code),
      qualityFindings: qStub.findings.length > 0 ? JSON.stringify(qStub.findings) : null,
      sankeySnapshot: snapshotSankey({
        finalSankey: stub.segmentData ?? null,
        overridePath: "stub",
        edgar8kRaw: slimEdgar8K(edgar8K),
        xbrlSegmentsRaw,
        yahooQuarter: slimYahooQuarter(stockData),
        yahooCurrency: stockData?.currency ?? null,
        filingIndexUrl: edgar8K?.sourceUrl ?? null,
      }),
    });
    return withSession(NextResponse.json({ report: stub, stockData, cached: false }));
  }

  // 5. Build prompt
  const { systemPrompt, userPrompt } = buildPrompt(stockData, segmentData);

  // 5. Call GPT-4o with streaming
  let fullText = "";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send stock data immediately — lets the UI render the header and metrics
        // while GPT-4o is still generating the analysis narrative.
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ stockData })}\n\n`)
        );

        const completion = await getOpenAIClient().chat.completions.create({
          model: "gpt-4o-2024-11-20",
          response_format: { type: "json_object" },
          stream: true,
          temperature: 0,
          max_tokens: 4500,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            fullText += delta;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
          }
        }

        // 6. Parse + sanitize + cache after stream ends
        let report: StructuredReport;
        try {
          const raw = JSON.parse(fullText) as Record<string, unknown>;
          // Ensure all narrative fields are strings — GPT-4o occasionally returns nested objects
          const stringFields: (keyof StructuredReport)[] = [
            "businessModel", "revenueStreams", "profitabilityAnalysis",
            "balanceSheetHealth", "freeCashFlow", "capitalExpenditure",
            "competitiveAdvantages", "managementQuality", "valuationSnapshot",
            "recentEarnings", "riskFactors", "catalysts", "industryContext",
          ];
          // segmentData is a structured object — leave it as-is
          for (const field of stringFields) {
            if (typeof raw[field] !== "string") {
              raw[field] = serializeField(raw[field]);
            }
          }
          report = raw as unknown as StructuredReport;
          // Use EDGAR segment data; fall back to Yahoo Finance TTM margins
          report.segmentData = segmentData ?? buildFallbackSegmentData(stockData);
        } catch (parseErr) {
          fireEvent({
            ticker,
            status: "error",
            errorStage: "parse",
            errorMsg: parseErr instanceof Error ? parseErr.message : "OpenAI JSON parse failed",
            sankeySource: classifySankeySource(segmentData ?? null),
            edgar8kOk,
            segmentsOk,
          });
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: "Análisis no disponible por el momento. Intente en unos minutos.",
                code: "analysis_unavailable",
              })}\n\n`
            )
          );
          controller.close();
          return;
        }

        const stale = isEdgarStale(stockData, report.segmentData ?? null);
        const ttl = stale ? SHORT_TTL : undefined;
        await cacheSet(ticker, report, stockData, ttl);
        void recordTickerView(ticker).catch(() => {});
        const q = scoreSankey(report.segmentData ?? null, ticker);
        fireEvent({
          ticker,
          status: "ok",
          sankeySource: classifySankeySource(report.segmentData ?? null),
          sankeyStale: stale,
          edgar8kOk,
          segmentsOk,
          qualityScore: q.score,
          hasSegments: q.hasSegments,
          segmentCount: q.segmentCount,
          hasOpexBreakdown: q.hasOpexBreakdown,
          segmentBalancePct: q.segmentBalancePct,
          costBalancePct: q.costBalancePct,
          opexBalancePct: q.opexBalancePct,
          opChainBalancePct: q.opChainBalancePct,
          qualityFlags: q.findings.map((f) => f.code),
          qualityFindings: q.findings.length > 0 ? JSON.stringify(q.findings) : null,
          sankeySnapshot: snapshotSankey({
            finalSankey: report.segmentData ?? null,
            overridePath,
            edgar8kRaw: slimEdgar8K(edgar8K),
            xbrlSegmentsRaw,
            yahooQuarter: slimYahooQuarter(stockData),
            yahooCurrency: stockData?.currency ?? null,
            filingIndexUrl: edgar8K?.sourceUrl ?? null,
          }),
          verdictRating: report.verdict?.rating ?? null,
          verdictConviction: report.verdict?.conviction ?? null,
          verdictRationale: report.verdict?.rationale ?? null,
          companyName: stockData.companyName ?? null,
          currentPrice: stockData.currentPrice ?? null,
          marketCap: stockData.marketCap ?? null,
          bullTarget: report.bullCase?.priceTarget ?? null,
          bearTarget: report.bearCase?.priceTarget ?? null,
        });

        // Send final payload: full structured report + stockData for UI components
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, report, stockData })}\n\n`
          )
        );
        controller.close();
      } catch (err) {
        // OpenAI outages (rate limit, 5xx, connection/timeout) bubble up as
        // OpenAI.APIError subclasses. Surface a friendly Spanish message + a
        // code so the UI can render a soft "service unavailable" notice
        // instead of a hard error trace.
        const isOpenAIError =
          err instanceof OpenAI.APIError ||
          err instanceof OpenAI.APIConnectionError ||
          err instanceof OpenAI.APIConnectionTimeoutError;
        const rawMsg = err instanceof Error ? err.message : "Unknown error";
        const message = isOpenAIError
          ? "Análisis no disponible por el momento. Intente en unos minutos."
          : rawMsg;
        const payload = isOpenAIError
          ? { error: message, code: "analysis_unavailable" }
          : { error: message };
        fireEvent({
          ticker,
          status: "error",
          errorStage: isOpenAIError ? "openai" : "unknown",
          errorMsg: rawMsg,
          sankeySource: classifySankeySource(segmentData ?? null),
          edgar8kOk,
          segmentsOk,
        });
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
        );
        controller.close();
      }
    },
  });

  return withSession(new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  }));
}
