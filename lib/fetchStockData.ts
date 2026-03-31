import YahooFinance from "yahoo-finance2";
import { trackAvCall, getRevenueCache, setRevenueCache } from "@/lib/avTracker";
import type {
  StockData,
  EarningsQuarter,
  ForwardEstimate,
  AnalystAction,
  InsiderTransaction,
  RevenueQuarter,
} from "@/types/StockData";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

function extractDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function fmtDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().split("T")[0];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;


async function fetchQuarterlyRevenue(ticker: string, period1: Date): Promise<RevenueQuarter[] | null> {
  const avKey  = process.env.ALPHA_VANTAGE_API_KEY;
  const fmpKey = process.env.FMP_API_KEY;

  // ── Revenue cache (7-day TTL — quarterly data rarely changes) ─────────────
  const cached = getRevenueCache(ticker);
  if (cached) {
    const filtered = cached.filter(q => new Date(q.time) >= period1);
    if (filtered.length > 0) return filtered;
  }

  // ── Alpha Vantage (preferred — returns 20+ quarters) ──────────────────────
  if (avKey) {
    try {
      // Alpha Vantage uses plain tickers; strip exchange suffixes (e.g. ".BA")
      const avTicker = ticker.split(".")[0];
      const url = `https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol=${encodeURIComponent(avTicker)}&apikey=${avKey}`;
      const res  = await fetch(url);
      if (res.ok) {
        const json = (await res.json()) as {
          quarterlyReports?: Array<{ fiscalDateEnding: string; totalRevenue: string }>;
        };
        const reports = json.quarterlyReports ?? [];
        const result = reports
          .filter((q) => q.fiscalDateEnding && q.totalRevenue !== "None" && new Date(q.fiscalDateEnding) >= period1)
          .map((q) => ({ time: q.fiscalDateEnding, value: Number(q.totalRevenue) }))
          .sort((a, b) => a.time.localeCompare(b.time));
        if (result.length > 0) {
          trackAvCall(ticker);
          setRevenueCache(ticker, result);
          return result;
        }
      }
    } catch { /* fall through */ }
  }

  // ── FMP fallback (free tier: max 5 quarters) ───────────────────────────────
  if (fmpKey) {
    for (const limit of [12, 5]) {
      try {
        const url = `https://financialmodelingprep.com/stable/income-statement?symbol=${encodeURIComponent(ticker)}&period=quarter&limit=${limit}&apikey=${fmpKey}`;
        const res  = await fetch(url);
        if (!res.ok) continue;
        const text = await res.text();
        let data: unknown;
        try { data = JSON.parse(text); } catch { continue; }
        if (!Array.isArray(data) || data.length === 0) continue;
        const rows = data as Array<{ date: string; revenue: number }>;
        const result = rows
          .filter((q) => q.date && q.revenue != null && new Date(q.date) >= period1)
          .map((q) => ({ time: q.date, value: q.revenue }))
          .sort((a, b) => a.time.localeCompare(b.time));
        if (result.length > 0) return result;
      } catch { continue; }
    }
  }

  return null;
}

export async function fetchStockData(ticker: string): Promise<StockData> {
  const oneYearAgo = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000);
  const today = new Date();

  const [result, historicalRaw, searchResult, revenueRaw] = await Promise.all([
    yahooFinance.quoteSummary(
    ticker,
    {
      modules: [
        "price",
        "summaryDetail",
        "defaultKeyStatistics",
        "financialData",
        "assetProfile",
        "earningsHistory",
        "earningsTrend",
        "calendarEvents",
        "recommendationTrend",
        "upgradeDowngradeHistory",
        "insiderTransactions",
        "majorHoldersBreakdown",
      ],
    },
    { validateResult: false },
  ) as AnyRecord,
    yahooFinance
      .historical(ticker, { period1: oneYearAgo, period2: today, interval: "1wk" })
      .catch(() => null),
    yahooFinance.search(ticker).catch(() => null),
    fetchQuarterlyRevenue(ticker, oneYearAgo),
  ]);

  const price   = result.price        as AnyRecord | undefined;
  const detail  = result.summaryDetail as AnyRecord | undefined;
  const stats   = result.defaultKeyStatistics as AnyRecord | undefined;
  const fin     = result.financialData as AnyRecord | undefined;
  const profile = result.assetProfile  as AnyRecord | undefined;
  const cal     = result.calendarEvents as AnyRecord | undefined;
  const trend   = result.recommendationTrend as AnyRecord | undefined;
  const holders = result.majorHoldersBreakdown as AnyRecord | undefined;

  const domain = extractDomain(profile?.website ?? null);

  // ── Analyst consensus breakdown ─────────────────────────────────────────────
  const recTrend = trend?.trend?.[0] as AnyRecord | undefined;

  // ── Earnings history (last 4 quarters) ─────────────────────────────────────
  const rawEarnings = ((result.earningsHistory as AnyRecord)?.history ?? []) as AnyRecord[];
  const earningsHistory: EarningsQuarter[] = rawEarnings.slice(-4).map((e) => ({
    quarter: fmtDate(e.quarter ?? e.endDate) ?? "—",
    epsActual: e.epsActual ?? null,
    epsEstimate: e.epsEstimate ?? null,
    surprisePct: e.surprisePercent ?? null,
  }));

  // ── Forward estimates ───────────────────────────────────────────────────────
  const rawTrend = ((result.earningsTrend as AnyRecord)?.trend ?? []) as AnyRecord[];
  const forwardEstimates: ForwardEstimate[] = rawTrend
    .filter((t) => ["0q", "+1q", "0y", "+1y"].includes(t.period))
    .map((t) => ({
      period: t.period,
      epsEstimate: t.earningsEstimate?.avg ?? null,
      revenueEstimate: t.revenueEstimate?.avg ?? null,
      growth: t.growth ?? null,
    }));

  // ── Next earnings date ──────────────────────────────────────────────────────
  const earningsDates = cal?.earnings?.earningsDate as Date[] | undefined;
  const nextEarningsDate = earningsDates?.[0] ? fmtDate(earningsDates[0]) : null;

  // ── Recent analyst actions (last 5) ────────────────────────────────────────
  const rawActions = ((result.upgradeDowngradeHistory as AnyRecord)?.history ?? []) as AnyRecord[];
  const analystActions: AnalystAction[] = rawActions.slice(0, 5).map((a) => ({
    date: fmtDate(a.epochGradeDate) ?? "—",
    firm: a.firm ?? "—",
    action: a.action ?? "—",
    fromGrade: a.fromGrade ?? "—",
    toGrade: a.toGrade ?? "—",
  }));

  // ── Insider transactions (last 5) ──────────────────────────────────────────
  const rawInsider = ((result.insiderTransactions as AnyRecord)?.transactions ?? []) as AnyRecord[];
  const insiderTransactions: InsiderTransaction[] = rawInsider.slice(0, 5).map((t) => ({
    date: fmtDate(t.startDate) ?? "—",
    name: t.filerName ?? "—",
    relation: t.filerRelation ?? "—",
    transactionText: t.transactionText ?? "—",
    value: t.value ?? null,
  }));

  // ── Beta (can live in stats or detail) ─────────────────────────────────────
  const betaVal = stats?.beta ?? detail?.beta ?? null;

  return {
    ticker: ticker.toUpperCase(),
    companyName: price?.longName ?? price?.shortName ?? ticker.toUpperCase(),
    currency: (price?.currency as string | undefined) ?? null,
    domain,
    sector: profile?.sector ?? null,
    industry: profile?.industry ?? null,
    description: profile?.longBusinessSummary ?? null,

    currentPrice: price?.regularMarketPrice ?? null,
    priceChangePercent: price?.regularMarketChangePercent ?? null,
    fiftyTwoWeekHigh: detail?.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: detail?.fiftyTwoWeekLow ?? null,

    marketCap: price?.marketCap ?? null,
    trailingPE: detail?.trailingPE ?? null,
    forwardPE: detail?.forwardPE ?? null,
    trailingEps: stats?.trailingEps ?? null,
    priceToBook: stats?.priceToBook ?? null,
    priceToSales: stats?.priceToSalesTrailing12Months ?? null,
    enterpriseToEbitda: stats?.enterpriseToEbitda ?? null,
    beta: betaVal,

    totalRevenue: fin?.totalRevenue ?? null,
    revenueGrowth: fin?.revenueGrowth ?? null,
    grossMargins: fin?.grossMargins ?? null,
    operatingMargins: fin?.operatingMargins ?? null,
    profitMargins: fin?.profitMargins ?? null,
    ebitdaMargins: fin?.ebitdaMargins ?? null,
    ebitda: fin?.ebitda ?? null,
    returnOnEquity: fin?.returnOnEquity ?? null,
    returnOnAssets: fin?.returnOnAssets ?? null,
    totalDebt: fin?.totalDebt ?? null,
    totalCash: fin?.totalCash ?? null,
    debtToEquity: fin?.debtToEquity ?? null,
    currentRatio: fin?.currentRatio ?? null,
    quickRatio: fin?.quickRatio ?? null,
    freeCashflow: fin?.freeCashflow ?? null,
    operatingCashflow: fin?.operatingCashflow ?? null,
    earningsGrowth: fin?.earningsGrowth ?? null,
    shortPercentOfFloat: stats?.shortPercentOfFloat ?? null,
    sharesOutstanding: stats?.sharesOutstanding ?? null,

    heldPercentInsiders: stats?.heldPercentInsiders ?? null,
    institutionalOwnership: holders?.institutionsPercentHeld ?? null,

    dividendYield: detail?.dividendYield ?? null,
    payoutRatio: detail?.payoutRatio ?? null,
    exDividendDate: fmtDate(detail?.exDividendDate) ?? null,

    earningsHistory,
    forwardEstimates,
    nextEarningsDate,

    recommendationKey: fin?.recommendationKey ?? null,
    targetMeanPrice: fin?.targetMeanPrice ?? null,
    targetHighPrice: fin?.targetHighPrice ?? null,
    targetLowPrice: fin?.targetLowPrice ?? null,
    analystStrongBuy: recTrend?.strongBuy ?? 0,
    analystBuy: recTrend?.buy ?? 0,
    analystHold: recTrend?.hold ?? 0,
    analystSell: recTrend?.sell ?? 0,
    analystStrongSell: recTrend?.strongSell ?? 0,

    analystActions,
    insiderTransactions,

    historicalPrices: historicalRaw
      ? historicalRaw
          .filter((d) => d.adjClose != null)
          .map((d) => ({
            time: d.date.toISOString().split("T")[0],
            value: d.adjClose as number,
          }))
      : null,

    quarterlyRevenue: revenueRaw ?? null,
  };
}
