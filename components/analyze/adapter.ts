import type { StockData, CashFlowYear } from "@/types/StockData";
import type { StructuredReport } from "@/types/Report";
import type { SankeyData } from "@/components/analyze/charts";
import { classifyPublisher, type PublisherTier } from "@/lib/publisherTiers";

export type Tone = "pos" | "neg" | null;

export interface WorkstationData {
  // Identity
  ticker: string;
  name: string;
  exchange: string;
  currency: string;
  sector: string;
  industry: string;

  // Price snapshot
  price: number | null;
  change1d: number | null;       // signed absolute change in currency units
  change1dPct: number | null;    // signed percentage (e.g. -2.17 for -2.17%)
  changeYtdPct: number | null;
  marketCap: string;
  week52Low: number | null;
  week52High: number | null;

  // Verdict (only present once the report finishes streaming)
  verdict: "BUY" | "HOLD" | "AVOID" | null;
  conviction: "Alta" | "Media" | "Baja" | null;
  target: number | null;
  targetUpside: number | null;
  sizing: string;

  // Scenario probabilities & derived metrics (Tier 1)
  bullProbability: number | null;     // 0-100
  baseProbability: number | null;     // 0-100, derived = 100 - bull - bear
  bearProbability: number | null;     // 0-100
  expectedValue: number | null;       // USD, weighted across scenarios
  expectedValueUpside: number | null; // % vs current price
  riskReward: string | null;          // "1.9 : 1" formatted

  // Key debate & capital allocation prose (Tier 1)
  keyDebateMd: string;
  capitalAllocationMd: string;

  // Recent news with publisher tier classification (Tier 1-4).
  // Shown in a dedicated panel and also feed the prompt with weighted instruction.
  recentNews: Array<{
    title: string;
    publisher: string;
    publishedAt: string;
    link: string;
    description?: string;
    tier: PublisherTier;
  }>;

  // KPIs · 16 tiles
  kpis: Array<[label: string, value: string, tone: Tone, info?: string]>;

  // Sparkline data (single overall, used per KPI tile and snapshot)
  spark: number[];

  // Price chart
  pricePath: Array<{ y: number; time: string }>;

  // Quarters merged from earningsHistory + quarterlyRevenue
  quarters: Array<{
    q: string;
    rev: number | null;       // billions
    eps: number | null;
    consEps: number | null;
    surprisePct: number | null;
    beat: boolean | null;
  }>;

  // Income statement
  sankey: SankeyData | null;
  segments: Array<{ name: string; share: number; color: string }>;

  // Wall Street
  consensus: {
    buy: number;
    hold: number;
    sell: number;
    targetLow: number | null;
    targetAvg: number | null;
    targetHigh: number | null;
  };
  analystActions: Array<{
    date: string;
    firm: string;
    action: string;
    fromGrade: string;
    toGrade: string;
  }>;

  peers: Array<{ t: string; pe: string }>;

  // Markdown prose blocks (from report; "" if not yet streamed)
  thesisMd: string;              // verdict.rationale
  businessSummaryMd: string;     // businessModel
  competitiveAdvantagesMd: string;
  revenueStreamsMd: string;
  driversMd: string;             // recentEarnings
  incomeNarrativeMd: string;     // profitabilityAnalysis
  balanceSheetMd: string;
  freeCashFlowMd: string;
  capitalExpenditureMd: string;
  industryContextMd: string;
  managementQualityMd: string;
  consensusNarrativeMd: string;  // valuationSnapshot
  conclusionMd: string;
  risksMd: string;
  catalystsMd: string;

  // Bull / Bear scenarios
  bullCase: { narrative: string; priceTarget: string } | null;
  bearCase: { narrative: string; priceTarget: string } | null;

  // Annual cash flow (5 fiscal years: CAPEX / OCF / FCF)
  annualCashFlow: CashFlowYear[];

  // Meta
  asOf: string | null;
  filingRef: string | null;
  lastUpdated: string;
}

const SEG_COLORS = ["#03065E", "#2C3194", "#6B70B8", "#9C7F2E", "#C9A84C", "#5C5F7A"];

/* ────────── helpers ────────── */

function fmtNum(n: number, dec = 2): string {
  const fixed = n.toFixed(dec);
  const [whole, frac] = fixed.split(".");
  const withSep = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return frac ? `${withSep},${frac}` : withSep;
}

function fmtLarge(n: number | null | undefined): string {
  if (n == null) return "—";
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${sign}${fmtNum(abs / 1e12, 2)} T`;
  if (abs >= 1e9) return `${sign}${fmtNum(abs / 1e9, 1)} B`;
  if (abs >= 1e6) return `${sign}${fmtNum(abs / 1e6, 0)} M`;
  return sign + fmtNum(abs, 0);
}

function fmtPct(n: number | null | undefined, dec = 1): string {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "−";
  return `${sign}${fmtNum(Math.abs(n) * 100, dec)} %`;
}

function fmtRatio(n: number | null | undefined, dec = 2): string {
  if (n == null) return "—";
  return `${fmtNum(n, dec)} ×`;
}

function fmtMoney(n: number | null | undefined, prefix = "USD ", dec = 2): string {
  if (n == null) return "—";
  return `${prefix}${fmtNum(n, dec)}`;
}

function deriveYtdPct(prices: { time: string; value: number }[] | null, currentPrice: number | null): number | null {
  if (!prices || prices.length === 0 || currentPrice == null) return null;
  const yearStart = new Date().getUTCFullYear();
  // Find first price in the current year. historicalPrices is sorted ascending.
  const firstOfYear = prices.find((p) => new Date(p.time).getUTCFullYear() === yearStart);
  // Fall back to the earliest price if we don't have year-start data.
  const reference = firstOfYear ?? prices[0];
  if (reference.value === 0) return null;
  return (currentPrice - reference.value) / reference.value;
}

/* ────────── adapt ────────── */

export function buildWorkstation(
  stockData: StockData,
  report: StructuredReport | null,
): WorkstationData {
  const pfx = stockData.currency === "USD" ? "USD " : (stockData.currency ?? "") + " ";
  const price = stockData.currentPrice ?? null;
  const pctRaw = stockData.priceChangePercent ?? null; // already a decimal (e.g. 0.0124)
  const change1dPct = pctRaw != null ? pctRaw * 100 : null;
  // change USD = price - price/(1+pct)
  let change1d: number | null = null;
  if (price != null && pctRaw != null) {
    const denom = 1 + pctRaw;
    change1d = denom !== 0 ? price - price / denom : 0;
  }
  const ytd = deriveYtdPct(stockData.historicalPrices ?? null, price);
  const changeYtdPct = ytd != null ? ytd * 100 : null;

  /* KPIs */
  const pc = stockData.peerComparison;
  const kpis: Array<[string, string, Tone, string?]> = [
    ["Cap. bursátil", fmtLarge(stockData.marketCap), null,
      "Valor total de la empresa en el mercado: precio por acción × acciones en circulación."],
    ["P/E TTM", fmtRatio(stockData.trailingPE), null,
      "Price-to-Earnings sobre ganancias de los últimos 12 meses (trailing). Menor suele indicar más barato relativo al mercado."],
    ["P/E Fwd", fmtRatio(stockData.forwardPE), null,
      "Precio sobre ganancias proyectadas a 12 meses según consenso de analistas. Útil para anticipar el múltiplo si las estimaciones se cumplen."],
    ["EV/EBITDA", fmtRatio(stockData.enterpriseToEbitda), null,
      "Enterprise Value sobre EBITDA. Múltiplo de valuación que neutraliza la estructura de capital y la base impositiva."],
    ["Revenue TTM", stockData.totalRevenue == null ? "—" : `${pfx}${fmtLarge(stockData.totalRevenue)}`, null,
      "Ingresos totales de los últimos 12 meses, neto de devoluciones y descuentos."],
    ["Rev. growth", fmtPct(stockData.revenueGrowth), tone(stockData.revenueGrowth),
      "Crecimiento de ingresos del último trimestre vs. el mismo trimestre del año anterior (YoY)."],
    ["Margen bruto", fmtPct(stockData.grossMargins), tone(stockData.grossMargins, 0),
      "Gross margin: (Revenue − Cost of Revenue) / Revenue. Indica cuánto queda después del costo directo del producto/servicio."],
    ["Margen op.", fmtPct(stockData.operatingMargins), tone(stockData.operatingMargins, 0),
      "Margen operativo: utilidad de operaciones sobre revenue. Refleja la eficiencia del core business antes de impuestos e intereses."],
    ["Margen neto", fmtPct(stockData.profitMargins), tone(stockData.profitMargins, 0),
      "Profit margin: net income sobre revenue. Lo que efectivamente queda para el accionista después de todo."],
    ["ROE", fmtPct(stockData.returnOnEquity), tone(stockData.returnOnEquity, 0),
      "Return on Equity: net income / shareholders equity. Cuánto rinde el capital aportado por los accionistas."],
    ["ROA", fmtPct(stockData.returnOnAssets), tone(stockData.returnOnAssets, 0),
      "Return on Assets: net income / total assets. Cuánto rinde cada dólar de activo en el balance."],
    ["FCF TTM", stockData.freeCashflow == null ? "—" : `${pfx}${fmtLarge(stockData.freeCashflow)}`, tone(stockData.freeCashflow, 0),
      "Free Cash Flow: efectivo generado por operaciones menos inversiones de capital (TTM). Mide la caja realmente disponible."],
    ["Div. yield", fmtPct(stockData.dividendYield), null,
      "Dividend yield: dividendo anual por acción / precio actual. Retorno por dividendo si el precio se mantiene."],
    ["Debt / Eq.", fmtRatio(stockData.debtToEquity), null,
      "Debt-to-Equity: deuda total sobre patrimonio neto. Apalancamiento de la estructura de capital."],
    ["Beta 5y", stockData.beta != null ? fmtNum(stockData.beta, 2) : "—", null,
      "Volatilidad relativa al mercado en 5 años. Beta > 1 implica mayor volatilidad que el mercado; < 1, menor."],
    ["EPS TTM", stockData.trailingEps != null ? `${pfx}${fmtNum(stockData.trailingEps, 2)}` : "—", null,
      "Earnings Per Share (TTM): ganancia neta por acción de los últimos 12 meses, base diluida cuando aplica."],
  ];

  /* Spark: 32-point downsample from the last year of weekly closes */
  const hp = stockData.historicalPrices ?? [];
  const sparkSlice = hp.slice(Math.max(0, hp.length - 52));
  const sparkStep = Math.max(1, Math.ceil(sparkSlice.length / 32));
  const spark = sparkSlice.filter((_, i) => i % sparkStep === 0).map((p) => p.value);
  if (spark.length > 0 && sparkSlice.length > 0 && spark[spark.length - 1] !== sparkSlice[sparkSlice.length - 1].value) {
    spark.push(sparkSlice[sparkSlice.length - 1].value);
  }

  /* Price path */
  const pricePath = hp.map((p) => ({ y: p.value, time: p.time }));

  /* Quarters: merge revenue + EPS by matching quarter end */
  const qRev = stockData.quarterlyRevenue ?? [];
  const eh = stockData.earningsHistory ?? [];
  // Map of "quarter label" → eps row. earningsHistory.quarter is typically "Q1 2025" or similar.
  const epsByLabel = new Map<string, (typeof eh)[number]>();
  for (const e of eh) epsByLabel.set(e.quarter, e);

  // Use last 8 revenue quarters
  const recentRev = qRev.slice(-8);
  const quarters = recentRev.map((q) => {
    const d = new Date(q.time);
    const month = d.getUTCMonth() + 1;
    const fq = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4;
    const label = `Q${fq} ${String(d.getUTCFullYear()).slice(-2)}`;
    // Try matching earnings history. Yahoo's `quarter` strings vary; we try a few formats.
    const matchers = [
      `${fq}Q${d.getUTCFullYear()}`,
      `Q${fq} ${d.getUTCFullYear()}`,
      `Q${fq}'${String(d.getUTCFullYear()).slice(-2)}`,
    ];
    const epsRow = matchers.map((m) => epsByLabel.get(m)).find((x) => x);
    return {
      q: label,
      rev: q.value > 0 ? q.value / 1e9 : null,
      eps: epsRow?.epsActual ?? null,
      consEps: epsRow?.epsEstimate ?? null,
      surprisePct: epsRow?.surprisePct ?? null,
      beat: epsRow && epsRow.surprisePct != null ? epsRow.surprisePct >= 0 : null,
    };
  });

  /* Sankey + segments */
  let sankey: SankeyData | null = null;
  let segments: WorkstationData["segments"] = [];

  const seg = report?.segmentData;
  const toB = (n: number | null | undefined) => (n ?? 0) / 1e9;
  // The Sankey chart visualizes a flow and only renders correctly when every leg is non-negative.
  // For a loss-making period any leg can flip negative; we then refuse to render rather than clamp.
  const buildSankey = (raw: SankeyData): SankeyData | null => {
    const legs = [raw.revenue, raw.costOfRevenue, raw.grossProfit, raw.opex, raw.operatingIncome, raw.otherAndTax, raw.netIncome];
    if (raw.revenue <= 0) return null;
    if (legs.some((v) => v < 0)) return null;
    return raw;
  };

  if (seg && seg.totalRevenue > 0) {
    // segmentData numbers are pre-scaled by seg.unit (autoScale in fetchSegmentData.ts):
    // a "M"-unit issuer has totalRevenue stored as raw_$/1e6. Undo that scale first
    // so the cascade table and downstream consumers see the same magnitude no matter
    // the issuer size.
    const segMul =
      seg.unit === "T" ? 1e12 :
      seg.unit === "B" ? 1e9 :
      seg.unit === "M" ? 1e6 :
      seg.unit === "K" ? 1e3 : 1;
    const segB = (n: number | null | undefined) => ((n ?? 0) * segMul) / 1e9;
    const revenue = segB(seg.totalRevenue);
    const opex = segB(seg.operatingExpenses);
    const operatingIncome = segB(seg.operatingProfit);
    const netIncome = segB(seg.netProfit);
    // EDGAR sometimes lacks an explicit GrossProfit / CostOfRevenue tag
    // (issuers like AAPL whose CoR is filed as CostOfGoodsAndServicesSold get
    // zeroed when `gpInconsistent` triggers; oil-gas single-step issuers leave
    // both at 0 by design). Fall back to the cascade identity so the table
    // stays consistent with the Sankey's "Total Costs" branch.
    let grossProfit = segB(seg.grossProfit);
    let costOfRevenue = segB(seg.costOfRevenue);
    if (grossProfit <= 0 && costOfRevenue <= 0 && opex > 0 && operatingIncome > 0) {
      grossProfit = opex + operatingIncome;
      costOfRevenue = Math.max(0, revenue - grossProfit);
    } else if (grossProfit <= 0 && costOfRevenue > 0) {
      grossProfit = Math.max(0, revenue - costOfRevenue);
    } else if (costOfRevenue <= 0 && grossProfit > 0) {
      costOfRevenue = Math.max(0, revenue - grossProfit);
    }
    sankey = buildSankey({
      revenue,
      costOfRevenue,
      grossProfit,
      opex,
      operatingIncome,
      otherAndTax: operatingIncome - netIncome,
      netIncome,
    });
    const segSum = seg.segments.reduce((s, x) => s + x.value, 0);
    segments = seg.segments
      .slice(0, 6)
      .map((s, i) => ({
        name: s.name,
        share: segSum > 0 ? Math.round((s.value / segSum) * 100) : 0,
        color: SEG_COLORS[i % SEG_COLORS.length],
      }))
      .filter((s) => s.share > 0);
  } else if (stockData.latestQuarterIS) {
    const q = stockData.latestQuarterIS;
    if (q.totalRevenue > 0) {
      sankey = buildSankey({
        revenue: toB(q.totalRevenue),
        costOfRevenue: toB(q.costOfRevenue),
        grossProfit: toB(q.grossProfit),
        opex: toB(q.totalOperatingExpenses),
        operatingIncome: toB(q.operatingIncome),
        otherAndTax: toB(q.operatingIncome) - toB(q.netIncome),
        netIncome: toB(q.netIncome),
      });
    }
  }

  /* Consensus */
  const totalAnalysts =
    stockData.analystStrongBuy + stockData.analystBuy + stockData.analystHold + stockData.analystSell + stockData.analystStrongSell;
  const buy = stockData.analystStrongBuy + stockData.analystBuy;
  const sell = stockData.analystSell + stockData.analystStrongSell;
  const consensus = {
    buy,
    hold: stockData.analystHold,
    sell,
    targetLow: stockData.targetLowPrice,
    targetAvg: stockData.targetMeanPrice,
    targetHigh: stockData.targetHighPrice,
  };
  void totalAnalysts;

  /* Analyst actions */
  const analystActions = (stockData.analystActions ?? []).slice(0, 8).map((a) => ({
    date: a.date,
    firm: a.firm,
    action: a.action,
    fromGrade: a.fromGrade,
    toGrade: a.toGrade,
  }));

  /* Peers */
  const peers = (pc?.peers ?? []).slice(0, 4).map((p) => ({
    t: p.symbol,
    pe: fmtRatio(p.trailingPE),
  }));

  /* Verdict */
  let verdict: WorkstationData["verdict"] = null;
  let conviction: WorkstationData["conviction"] = null;
  let target: number | null = null;
  let targetUpside: number | null = null;

  if (report?.verdict) {
    verdict = report.verdict.rating;
    conviction =
      report.verdict.conviction === "HIGH" ? "Alta" :
      report.verdict.conviction === "LOW" ? "Baja" : "Media";
  }

  // PRIMARY target: the model's own 12-month price target (the casa's research
  // view), derived from financials + multiples + forward estimates. Falls back
  // to analyst consensus mean only if the model didn't emit one (e.g. while the
  // report is still streaming). The hero displays this as "Target Bengochea".
  // Yahoo's analyst consensus stays available via stockData.targetMeanPrice
  // for the Wall Street panel.
  const modelTargetStr = report?.verdict?.priceTarget;
  const modelTarget = modelTargetStr != null ? parseFloat(modelTargetStr) : NaN;
  if (isFinite(modelTarget) && modelTarget > 0) {
    target = modelTarget;
  } else if (stockData.targetMeanPrice != null) {
    target = stockData.targetMeanPrice;
  }
  if (target != null && price != null && price > 0) {
    targetUpside = ((target - price) / price) * 100;
  }

  /* Scenario probabilities & expected value (Tier 1) */
  let bullProb: number | null = null;
  let bearProb: number | null = null;
  let baseProb: number | null = null;
  let expectedValue: number | null = null;
  let expectedValueUpside: number | null = null;
  let riskReward: string | null = null;

  const bullCase = report?.bullCase;
  const bearCase = report?.bearCase;

  if (bullCase && bearCase) {
    const bp = parseInt(bullCase.probability ?? "", 10);
    const xp = parseInt(bearCase.probability ?? "", 10);
    const bullTgt = parseFloat(bullCase.priceTarget ?? "");
    const bearTgt = parseFloat(bearCase.priceTarget ?? "");

    if (Number.isFinite(bp) && Number.isFinite(xp) && bp + xp <= 100) {
      bullProb = bp;
      bearProb = xp;
      baseProb = Math.max(0, 100 - bp - xp);
    }

    // Risk/reward: ratio (bull − price) : (price − bear). Asymmetry sense.
    if (Number.isFinite(bullTgt) && Number.isFinite(bearTgt) && price != null && price > 0) {
      const upside = bullTgt - price;
      const downside = price - bearTgt;
      if (upside > 0 && downside > 0) {
        const ratio = upside / downside;
        riskReward = `${ratio.toFixed(1)} : 1`;
      } else if (upside > 0 && downside <= 0) {
        riskReward = "asimétrico a favor (bear ≥ precio)";
      } else if (upside <= 0 && downside > 0) {
        riskReward = "asimétrico en contra (bull ≤ precio)";
      }
    }

    // Expected value: probability-weighted average of bull, base, bear.
    if (
      bullProb != null && bearProb != null && baseProb != null &&
      Number.isFinite(bullTgt) && Number.isFinite(bearTgt) && target != null
    ) {
      const ev = (bullTgt * bullProb + target * baseProb + bearTgt * bearProb) / 100;
      expectedValue = ev;
      if (price != null && price > 0) expectedValueUpside = ((ev - price) / price) * 100;
    }
  }

  const sizing = report?.verdict?.sizing ?? "";

  /* Markdown blocks (empty when report not yet ready) */
  const thesisMd = report?.verdict?.rationale ?? "";
  const businessSummaryMd = report?.businessModel ?? "";
  const competitiveAdvantagesMd = report?.competitiveAdvantages ?? "";
  const revenueStreamsMd = report?.revenueStreams ?? "";
  const driversMd = report?.recentEarnings ?? "";
  const incomeNarrativeMd = report?.profitabilityAnalysis ?? "";
  const balanceSheetMd = report?.balanceSheetHealth ?? "";
  const freeCashFlowMd = report?.freeCashFlow ?? "";
  const capitalExpenditureMd = report?.capitalExpenditure ?? "";
  const capitalAllocationMd = report?.capitalAllocation ?? "";
  const industryContextMd = report?.industryContext ?? "";
  const keyDebateMd = report?.keyDebate ?? "";

  /* Recent news with tier classification */
  const recentNews = (stockData.recentNews ?? []).slice(0, 7).map((n) => ({
    title: n.title,
    publisher: n.publisher,
    publishedAt: n.publishedAt,
    link: n.link,
    description: n.description,
    tier: classifyPublisher(n.publisher),
  }));
  const managementQualityMd = report?.managementQuality ?? "";
  const consensusNarrativeMd = report?.valuationSnapshot ?? "";
  const conclusionMd =
    report ? [report.verdict?.rationale, report.valuationSnapshot].filter(Boolean).join("\n\n") : "";
  const risksMd = report?.riskFactors ?? "";
  const catalystsMd = report?.catalysts ?? "";
  const bullCaseObj = report?.bullCase ?? null;
  const bearCaseObj = report?.bearCase ?? null;
  const annualCashFlow = stockData.annualCashFlow ?? [];

  /* Meta */
  const segSource = report?.segmentData;
  const asOf: string | null = segSource?.endDate ?? null;
  const filingRef: string | null =
    segSource?.source && segSource?.period
      ? `${segSource.source} · ${segSource.period}`
      : segSource?.source ?? null;
  const now = new Date();
  const lastUpdated = `${now.toLocaleDateString("es-UY", { day: "2-digit", month: "short" })} ${now.getFullYear()} · ${now.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", hour12: false })} UY`;

  return {
    ticker: stockData.ticker,
    name: stockData.companyName,
    exchange: inferExchange(stockData),
    currency: stockData.currency ?? "USD",
    sector: stockData.sector ?? "—",
    industry: stockData.industry ?? "—",
    price,
    change1d,
    change1dPct,
    changeYtdPct,
    marketCap: stockData.marketCap != null ? `${pfx}${fmtLarge(stockData.marketCap)}` : "—",
    week52Low: stockData.fiftyTwoWeekLow,
    week52High: stockData.fiftyTwoWeekHigh,
    verdict,
    conviction,
    target,
    targetUpside,
    sizing,
    bullProbability: bullProb,
    baseProbability: baseProb,
    bearProbability: bearProb,
    expectedValue,
    expectedValueUpside,
    riskReward,
    kpis,
    spark,
    pricePath,
    quarters,
    sankey,
    segments,
    consensus,
    analystActions,
    peers,
    thesisMd,
    businessSummaryMd,
    competitiveAdvantagesMd,
    revenueStreamsMd,
    driversMd,
    incomeNarrativeMd,
    balanceSheetMd,
    freeCashFlowMd,
    capitalExpenditureMd,
    capitalAllocationMd,
    keyDebateMd,
    recentNews,
    industryContextMd,
    managementQualityMd,
    consensusNarrativeMd,
    conclusionMd,
    risksMd,
    catalystsMd,
    bullCase: bullCaseObj,
    bearCase: bearCaseObj,
    annualCashFlow,
    asOf,
    filingRef,
    lastUpdated,
  };
}

function tone(v: number | null | undefined, threshold = 0): Tone {
  if (v == null) return null;
  if (v > threshold) return "pos";
  if (v < threshold) return "neg";
  return null;
}

function inferExchange(s: StockData): string {
  // Yahoo's ticker conventions: ".BA" = BYMA, ".SA" = B3, ".MX" = BMV.
  // For US tickers we don't have the exchange explicitly. Default to "US".
  const t = s.ticker;
  if (t.endsWith(".BA")) return "BYMA";
  if (t.endsWith(".SA")) return "B3";
  if (t.endsWith(".MX")) return "BMV";
  if (t.endsWith(".MC")) return "BME";
  if (t.endsWith(".L")) return "LSE";
  if (t.endsWith(".PA")) return "EPA";
  if (t.endsWith(".DE")) return "XETRA";
  return "US";
}
