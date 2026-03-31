import fs from "fs";
import path from "path";
import type { StockData } from "@/types/StockData";

function getTemplate(): string {
  const templatePath = path.join(process.cwd(), "prompts", "analysis.txt");
  return fs.readFileSync(templatePath, "utf-8");
}

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

// ── Placeholder map ──────────────────────────────────────────────────────────

type Formatter = (d: StockData) => string;

const PLACEHOLDER_MAP: Record<string, Formatter> = {
  TICKER:        (d) => d.ticker,
  COMPANY_NAME:  (d) => d.companyName,
  SECTOR:        (d) => d.sector ?? "N/A",
  INDUSTRY:      (d) => d.industry ?? "N/A",
  DESCRIPTION:   (d) => d.description ?? "No description available.",
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
};

// ── Public API ───────────────────────────────────────────────────────────────

export interface PromptPayload {
  systemPrompt: string;
  userPrompt: string;
}

export function buildPrompt(data: StockData): PromptPayload {
  const template = getTemplate();

  const systemPrompt = template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const fn = PLACEHOLDER_MAP[key];
    return fn ? fn(data) : match;
  });

  return {
    systemPrompt,
    userPrompt: "Genera el reporte institucional completo ahora.",
  };
}
