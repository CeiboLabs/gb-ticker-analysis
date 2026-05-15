import type { StockData } from "@/types/StockData";
import type { StructuredReport } from "@/types/Report";
import type { SankeyData } from "@/components/analyze/charts";

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
  price: number;
  change1d: number;       // signed absolute change in currency units
  change1dPct: number;    // signed percentage (e.g. -2.17 for -2.17%)
  changeYtdPct: number | null;
  marketCap: string;
  week52Low: number | null;
  week52High: number | null;

  // Tape extras (may be "—")
  volume: string;
  dayLow: string;
  dayHigh: string;
  avgVolume: string;

  // Verdict (only present once the report finishes streaming)
  verdict: "BUY" | "HOLD" | "AVOID" | null;
  conviction: "Alta" | "Media" | "Baja" | null;
  convictionChange: "Mantenido" | "Subido" | "Bajado";
  target: number | null;
  targetUpside: number | null;

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

  peers: Array<{ t: string; pe: string; chg: number | null }>;

  // Markdown prose blocks (from report; "" if not yet streamed)
  thesisMd: string;
  businessSummaryMd: string;
  driversMd: string;
  incomeNarrativeMd: string;
  consensusNarrativeMd: string;
  conclusionMd: string;
  risksMd: string;
  catalystsMd: string;

  // Meta
  asOf: string;
  filingRef: string;
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
  const price = stockData.currentPrice ?? 0;
  const pctRaw = stockData.priceChangePercent ?? 0; // already a decimal (e.g. 0.0124)
  const change1dPct = pctRaw * 100;
  // change USD = price - price/(1+pct)
  const denom = 1 + pctRaw;
  const change1d = denom !== 0 ? price - price / denom : 0;
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
      beat: epsRow ? (epsRow.surprisePct ?? 0) >= 0 : null,
    };
  });

  /* Sankey + segments */
  let sankey: SankeyData | null = null;
  let segments: WorkstationData["segments"] = [];

  const seg = report?.segmentData;
  if (seg && seg.totalRevenue > 0) {
    const totalB = seg.totalRevenue / Math.max(1, seg.totalRevenue) > 0 ? seg.totalRevenue : seg.totalRevenue;
    // Workstation Sankey expects all values in same unit; convert raw → billions for display
    const toB = (n: number | undefined | null) => (n ?? 0) / 1e9;
    sankey = {
      revenue: toB(seg.totalRevenue),
      costOfRevenue: toB(seg.costOfRevenue),
      grossProfit: toB(seg.grossProfit),
      opex: toB(seg.operatingExpenses),
      operatingIncome: Math.max(0, toB(seg.operatingProfit)),
      otherAndTax: Math.max(0, toB(seg.operatingProfit) - toB(seg.netProfit)),
      netIncome: Math.max(0, toB(seg.netProfit)),
    };
    void totalB;
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
    const toB = (n: number | null | undefined) => (n ?? 0) / 1e9;
    if (q.totalRevenue > 0) {
      sankey = {
        revenue: toB(q.totalRevenue),
        costOfRevenue: toB(q.costOfRevenue),
        grossProfit: toB(q.grossProfit),
        opex: toB(q.totalOperatingExpenses),
        operatingIncome: Math.max(0, toB(q.operatingIncome)),
        otherAndTax: Math.max(0, toB(q.operatingIncome) - toB(q.netIncome)),
        netIncome: Math.max(0, toB(q.netIncome)),
      };
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
    chg: null as number | null,
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

  // Target = mean target price (real data); upside = (target - price)/price
  if (stockData.targetMeanPrice != null) {
    target = stockData.targetMeanPrice;
    if (price > 0) targetUpside = ((stockData.targetMeanPrice - price) / price) * 100;
  }

  /* Markdown blocks (empty when report not yet ready) */
  const thesisMd = report?.verdict?.rationale ?? "";
  const businessSummaryMd = report?.businessModel ?? "";
  const driversMd = report?.recentEarnings ?? "";
  const incomeNarrativeMd = report?.profitabilityAnalysis ?? "";
  const consensusNarrativeMd = report?.valuationSnapshot ?? "";
  const conclusionMd =
    report ? [report.verdict?.rationale, report.valuationSnapshot].filter(Boolean).join("\n\n") : "";
  const risksMd = report?.riskFactors ?? "";
  const catalystsMd = report?.catalysts ?? "";

  /* Meta */
  const segSource = report?.segmentData;
  const asOf = segSource?.endDate ?? new Date().toISOString().slice(0, 10);
  const filingRef =
    segSource?.source && segSource?.period
      ? `${segSource.source} · ${segSource.period}`
      : segSource?.source ?? "Yahoo Finance";
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
    volume: "—",
    dayLow: "—",
    dayHigh: "—",
    avgVolume: "—",
    verdict,
    conviction,
    convictionChange: "Mantenido",
    target,
    targetUpside,
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
    driversMd,
    incomeNarrativeMd,
    consensusNarrativeMd,
    conclusionMd,
    risksMd,
    catalystsMd,
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
