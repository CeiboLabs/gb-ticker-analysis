import YahooFinance from "yahoo-finance2";
import { fetchEdgarQuarterlyRevenue } from "@/lib/fetchEdgarSegments";
import type {
  StockData,
  EarningsQuarter,
  ForwardEstimate,
  AnalystAction,
  InsiderTransaction,
} from "@/types/StockData";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
  logger: {
    ...console,
    // Suppress the "Unsupported runtime" warning that fires in Next.js Edge
    // runtime simulation because process.versions.node isn't polyfilled there.
    // The API works fine regardless.
    warn(...args: unknown[]) {
      if (typeof args[0] === "string" && args[0].includes("Unsupported runtime")) return;
      console.warn(...args);
    },
  },
});

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



export async function fetchStockData(ticker: string): Promise<StockData> {
  const oneYearAgo = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000);
  const today = new Date();

  const [result, historicalRaw, searchResult, edgarRevenue] = await Promise.all([
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
    yahooFinance.search(ticker, { newsCount: 7, quotesCount: 1 }).catch(() => null),
    fetchEdgarQuarterlyRevenue(ticker, oneYearAgo),
  ]);

  const revenueRaw = edgarRevenue;

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
    recentNews: (() => {
      const rawNews = (searchResult as AnyRecord | null)?.news as AnyRecord[] | undefined;
      return rawNews
        ?.slice(0, 7)
        .map((n) => ({
          title:       String(n.title ?? ""),
          publisher:   String(n.publisher ?? ""),
          link:        String(n.link ?? ""),
          publishedAt: n.providerPublishTime instanceof Date
            ? n.providerPublishTime.toISOString().split("T")[0]
            : String(n.providerPublishTime ?? ""),
        }))
        .filter((n) => n.title.length > 0) ?? undefined;
    })(),
  };
}
