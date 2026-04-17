import { ANALYSIS_SYSTEM_PROMPT, ANALYSIS_DATA_TEMPLATE } from "@/prompts/analysis";
import type { StockData } from "@/types/StockData";
import type { SegmentSankeyData } from "@/types/Report";

// ── Scalar formatters ────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  return n != null ? n.toFixed(2) : "N/A";
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "N/A";
  return `${(n * 100).toFixed(1)}%`;
}

function fmtPctRaw(n: number | null | undefined): string {
  if (n == null) return "N/A";
  return `${n.toFixed(1)}%`;
}

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return "N/A";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtLargeNum(n: number | null | undefined): string {
  if (n == null) return "N/A";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString("en-US")}`;
}

// ── Block formatters ─────────────────────────────────────────────────────────

function fmtEarningsHistory(d: StockData): string {
  if (!d.earningsHistory.length) return "N/A";
  const rows = d.earningsHistory.map((e) => {
    const surprise = e.surprisePct != null ? `${e.surprisePct > 0 ? "+" : ""}${e.surprisePct.toFixed(1)}%` : "N/A";
    return `  ${e.quarter} | EPS Real: ${fmt(e.epsActual)} | EPS Est: ${fmt(e.epsEstimate)} | Sorpresa: ${surprise}`;
  });
  return rows.join("\n");
}

function fmtForwardEstimates(d: StockData): string {
  if (!d.forwardEstimates.length) return "N/A";
  const periodLabel: Record<string, string> = {
    "0q": "Trimestre actual",
    "+1q": "Próximo trimestre",
    "0y": "Año fiscal actual",
    "+1y": "Próximo año fiscal",
  };
  const rows = d.forwardEstimates.map((e) => {
    const label = periodLabel[e.period] ?? e.period;
    const growth = e.growth != null ? `(crec. ${(e.growth * 100).toFixed(1)}%)` : "";
    return `  ${label}: EPS Est. ${fmt(e.epsEstimate)} | Rev. Est. ${fmtLargeNum(e.revenueEstimate)} ${growth}`;
  });
  return rows.join("\n");
}

function fmtAnalystActions(d: StockData): string {
  if (!d.analystActions.length) return "N/A";
  return d.analystActions.map((a) => {
    const actionLabel = { up: "Upgrade", down: "Downgrade", init: "Inicio cobertura", main: "Mantiene", reit: "Reitera" }[a.action] ?? a.action;
    const change = a.fromGrade && a.fromGrade !== "—" ? `${a.fromGrade} → ${a.toGrade}` : a.toGrade;
    return `  ${a.date} | ${a.firm} | ${actionLabel}: ${change}`;
  }).join("\n");
}

function fmtInsiderTransactions(d: StockData): string {
  if (!d.insiderTransactions.length) return "N/A";
  return d.insiderTransactions.map((t) => {
    const val = t.value != null ? ` | Valor: ${fmtLargeNum(t.value)}` : "";
    return `  ${t.date} | ${t.name} (${t.relation}) | ${t.transactionText}${val}`;
  }).join("\n");
}

function fmtQuarterlyRevenueTrend(d: StockData): string {
  const data = d.quarterlyRevenue;
  if (!data || data.length === 0) return "N/A";
  const sorted = [...data].sort((a, b) => a.time.localeCompare(b.time));
  const recent = sorted.slice(-10);
  return recent.map((q, i) => {
    const prev = recent[i - 4];
    const yoy = prev && prev.value > 0
      ? `${(((q.value - prev.value) / prev.value) * 100).toFixed(1)}%`
      : "N/A";
    const dt = new Date(q.time);
    const qNum = Math.ceil((dt.getMonth() + 1) / 3);
    return `  Q${qNum} ${dt.getFullYear()}: ${fmtLargeNum(q.value)} (YoY: ${yoy})`;
  }).join("\n");
}

function fmtPeerComparison(d: StockData): string {
  const pc = d.peerComparison;
  if (!pc || pc.peers.length === 0) return "N/A — datos de peers no disponibles.";

  const lines: string[] = [];
  for (const p of pc.peers) {
    const tpe = p.trailingPE != null ? `${p.trailingPE.toFixed(2)}x` : "N/A";
    const fpe = p.forwardPE != null ? `${p.forwardPE.toFixed(2)}x` : "N/A";
    lines.push(`  ${p.symbol} (${p.name}): P/E Trailing ${tpe} | P/E Forward ${fpe}`);
  }
  const avgT = pc.avgTrailingPE != null ? `${pc.avgTrailingPE.toFixed(2)}x` : "N/A";
  const avgF = pc.avgForwardPE != null ? `${pc.avgForwardPE.toFixed(2)}x` : "N/A";
  lines.push(`  --- Promedio peers: P/E Trailing ${avgT} | P/E Forward ${avgF}`);
  return lines.join("\n");
}

function fmtRecentNews(d: StockData): string {
  const news = d.recentNews;
  if (!news || news.length === 0) return "N/A — no hay noticias recientes disponibles.";
  return news.slice(0, 7).map((n) =>
    `  [${n.publishedAt}] ${n.title} (${n.publisher})`
  ).join("\n");
}

function fmtAnnualCashFlow(d: StockData): string {
  const cf = d.annualCashFlow;
  if (!cf || cf.length === 0) return "N/A — historial de cash flow no disponible.";
  return cf.map((y) => {
    const capex = y.capitalExpenditure != null ? fmtLargeNum(Math.abs(y.capitalExpenditure)) : "N/A";
    const capexPctRev = y.capitalExpenditure != null && d.totalRevenue
      ? `${((Math.abs(y.capitalExpenditure) / d.totalRevenue) * 100).toFixed(1)}%`
      : null;
    const capexLabel = capexPctRev ? `${capex} (${capexPctRev} de rev.)` : capex;
    return `  FY${y.year}: CAPEX ${capexLabel} | OCF ${fmtLargeNum(y.operatingCashFlow)} | FCF ${fmtLargeNum(y.freeCashFlow)}`;
  }).join("\n");
}

function fmtSegmentData(sd: SegmentSankeyData | null | undefined): string {
  if (!sd) return "N/A — datos de segmentos SEC no disponibles para este ticker.";

  const u = sd.unit;
  const cur = sd.currency ?? "USD";
  const v = (n: number | undefined) => n != null ? `${n}${u} ${cur}` : "N/A";
  const pct = (n: number | undefined) => n != null ? ` (margen: ${n}%)` : "";

  const lines: string[] = [];
  const period = sd.segmentPeriod && sd.segmentPeriod !== sd.period
    ? `${sd.period} (segmentos: ${sd.segmentPeriod})`
    : sd.period;
  lines.push(`Período: ${period}`);

  if (sd.segments.length > 0) {
    lines.push("");
    lines.push("Segmentos de ingresos:");
    for (const s of sd.segments) {
      const yoy = s.yoy ? ` (YoY: ${s.yoy})` : "";
      lines.push(`  ${s.name}: ${v(s.value)}${yoy}`);
    }
  }

  lines.push("");
  lines.push("Estado de resultados (SEC EDGAR):");
  const revYoy = sd.totalRevenueYoy ? ` (YoY: ${sd.totalRevenueYoy})` : "";
  lines.push(`  Ingresos totales:     ${v(sd.totalRevenue)}${revYoy}`);
  lines.push(`  Costo de ingresos:    ${v(sd.costOfRevenue)}`);
  lines.push(`  Utilidad bruta:       ${v(sd.grossProfit)}${pct(sd.grossMarginPct)}`);
  lines.push(`  Gastos operativos:    ${v(sd.operatingExpenses)}`);

  if (sd.opexBreakdown) {
    const ob = sd.opexBreakdown;
    if (ob.rd != null)             lines.push(`    I+D:                ${v(ob.rd)}`);
    if (ob.salesMarketing != null) lines.push(`    Ventas y marketing: ${v(ob.salesMarketing)}`);
    if (ob.generalAdmin != null)   lines.push(`    G&A:                ${v(ob.generalAdmin)}`);
    if (ob.other != null)          lines.push(`    Otros:              ${v(ob.other)}`);
  }

  lines.push(`  Utilidad operativa:   ${v(sd.operatingProfit)}${pct(sd.operatingMarginPct)}`);
  if (sd.nonOperatingIncome != null) {
    lines.push(`  Ingreso no operativo: ${v(sd.nonOperatingIncome)}`);
  }
  if (sd.tax != null) lines.push(`  Impuestos:            ${v(sd.tax)}`);
  lines.push(`  Utilidad neta:        ${v(sd.netProfit)}${pct(sd.netMarginPct)}`);

  return lines.join("\n");
}

// ── Placeholder map ──────────────────────────────────────────────────────────

type Formatter = (d: StockData) => string;

const PLACEHOLDER_MAP: Record<string, Formatter> = {
  TICKER:        (d) => d.ticker,
  COMPANY_NAME:  (d) => d.companyName,
  SECTOR:        (d) => d.sector ?? "N/A",
  INDUSTRY:      (d) => d.industry ?? "N/A",
  DESCRIPTION:   (d) => {
    const desc = d.description ?? "No description available.";
    return desc.length > 600 ? desc.slice(0, 597) + "..." : desc;
  },
  TODAY_DATE:    () => new Date().toISOString().split("T")[0],

  // Price
  CURRENT_PRICE:    (d) => fmtCurrency(d.currentPrice),
  PRICE_CHANGE_PCT: (d) => fmtPct(d.priceChangePercent),
  WEEK52_HIGH:      (d) => fmtCurrency(d.fiftyTwoWeekHigh),
  WEEK52_LOW:       (d) => fmtCurrency(d.fiftyTwoWeekLow),

  // Valuation
  MARKET_CAP:       (d) => fmtLargeNum(d.marketCap),
  TRAILING_PE:      (d) => fmt(d.trailingPE),
  FORWARD_PE:       (d) => fmt(d.forwardPE),
  TRAILING_EPS:     (d) => fmt(d.trailingEps),
  PRICE_TO_BOOK:    (d) => fmt(d.priceToBook),
  PRICE_TO_SALES:   (d) => fmt(d.priceToSales),
  EV_TO_EBITDA:     (d) => fmt(d.enterpriseToEbitda),
  BETA:             (d) => fmt(d.beta),
  CAPE_RATIO:       (d) => d.capeRatio != null ? `${d.capeRatio.toFixed(1)}x (${d.capeYears ?? "?"}yr avg EPS)` : "N/A",

  // Financials
  TOTAL_REVENUE:       (d) => fmtLargeNum(d.totalRevenue),
  REVENUE_GROWTH:      (d) => fmtPct(d.revenueGrowth),
  EARNINGS_GROWTH:     (d) => fmtPct(d.earningsGrowth),
  GROSS_MARGIN:        (d) => fmtPct(d.grossMargins),
  OPERATING_MARGIN:    (d) => fmtPct(d.operatingMargins),
  NET_MARGIN:          (d) => fmtPct(d.profitMargins),
  EBITDA_MARGIN:       (d) => fmtPct(d.ebitdaMargins),
  EBITDA:              (d) => fmtLargeNum(d.ebitda),
  ROE:                 (d) => fmtPct(d.returnOnEquity),
  ROA:                 (d) => fmtPct(d.returnOnAssets),
  TOTAL_DEBT:          (d) => fmtLargeNum(d.totalDebt),
  TOTAL_CASH:          (d) => fmtLargeNum(d.totalCash),
  DEBT_TO_EQUITY:      (d) => fmt(d.debtToEquity),
  CURRENT_RATIO:       (d) => fmt(d.currentRatio),
  QUICK_RATIO:         (d) => fmt(d.quickRatio),
  FREE_CASHFLOW:       (d) => fmtLargeNum(d.freeCashflow),
  OPERATING_CASHFLOW:  (d) => fmtLargeNum(d.operatingCashflow),
  SHORT_PERCENT_FLOAT: (d) => fmtPct(d.shortPercentOfFloat),
  SHARES_OUTSTANDING:  (d) => fmtLargeNum(d.sharesOutstanding),
  ANNUAL_CASHFLOW_HISTORY: fmtAnnualCashFlow,

  // Ownership
  INSIDER_OWNERSHIP:       (d) => fmtPct(d.heldPercentInsiders),
  INSTITUTIONAL_OWNERSHIP: (d) => fmtPct(d.institutionalOwnership),

  // Dividend
  DIVIDEND_YIELD:   (d) => fmtPct(d.dividendYield),
  PAYOUT_RATIO:     (d) => fmtPct(d.payoutRatio),
  EX_DIVIDEND_DATE: (d) => d.exDividendDate ?? "N/A",

  // Last quarter (legacy — kept for compatibility)
  LAST_EPS_ACTUAL:   (d) => fmt(d.earningsHistory.at(-1)?.epsActual),
  LAST_EPS_ESTIMATE: (d) => fmt(d.earningsHistory.at(-1)?.epsEstimate),
  EPS_SURPRISE_PCT:  (d) => fmtPctRaw(d.earningsHistory.at(-1)?.surprisePct),

  // Block placeholders
  QUARTERLY_REVENUE_TREND: fmtQuarterlyRevenueTrend,
  RECENT_NEWS:             fmtRecentNews,
  EARNINGS_HISTORY:      fmtEarningsHistory,
  FORWARD_ESTIMATES:     fmtForwardEstimates,
  NEXT_EARNINGS_DATE:    (d) => d.nextEarningsDate ?? "N/A",
  ANALYST_ACTIONS:       fmtAnalystActions,
  INSIDER_TRANSACTIONS:  fmtInsiderTransactions,

  // Analyst consensus
  RECOMMENDATION:      (d) => d.recommendationKey?.toUpperCase() ?? "N/A",
  TARGET_PRICE_MEAN:   (d) => fmtCurrency(d.targetMeanPrice),
  TARGET_PRICE_HIGH:   (d) => fmtCurrency(d.targetHighPrice),
  TARGET_PRICE_LOW:    (d) => fmtCurrency(d.targetLowPrice),
  ANALYST_COUNT:       (d) => {
    const total = d.analystStrongBuy + d.analystBuy + d.analystHold + d.analystSell + d.analystStrongSell;
    return total > 0 ? total.toString() : "N/A";
  },
  ANALYST_STRONG_BUY:  (d) => d.analystStrongBuy.toString(),
  ANALYST_BUY:         (d) => d.analystBuy.toString(),
  ANALYST_HOLD:        (d) => d.analystHold.toString(),
  ANALYST_SELL:        (d) => d.analystSell.toString(),
  ANALYST_STRONG_SELL: (d) => d.analystStrongSell.toString(),

  // Peer comparison
  PEER_PE_COMPARISON:    fmtPeerComparison,
  PEER_AVG_TRAILING_PE:  (d) => fmt(d.peerComparison?.avgTrailingPE),
  PEER_AVG_FORWARD_PE:   (d) => fmt(d.peerComparison?.avgForwardPE),
};

// ── Public API ───────────────────────────────────────────────────────────────

export interface PromptPayload {
  systemPrompt: string;
  userPrompt: string;
}

export function buildPrompt(data: StockData, segmentData?: SegmentSankeyData | null): PromptPayload {
  // Only the data template gets interpolated. The system prompt is a fixed string,
  // which lets OpenAI cache it across requests (~50% off on cached input tokens).
  const userPrompt = ANALYSIS_DATA_TEMPLATE
    .replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      const fn = PLACEHOLDER_MAP[key];
      return fn ? fn(data) : match;
    })
    .replace("{{SEGMENT_DATA}}", fmtSegmentData(segmentData));

  return {
    systemPrompt: ANALYSIS_SYSTEM_PROMPT,
    userPrompt,
  };
}
