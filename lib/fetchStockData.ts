// Side-effect PRIMERO: deadline por defecto en el fetch global del isolate.
// Cubre los fetch() pelados de yahoo-finance2 (crumb/cookie dance) que NO
// pasan por throttledYahooFetch — ver comentario en lib/globalFetchDeadline.
import "@/lib/globalFetchDeadline";
import YahooFinance from "yahoo-finance2";
import { fetchEdgarQuarterlyRevenue } from "@/lib/fetchEdgarSegments";
import { fetchUsdRate } from "@/lib/fxRates";
import { resolveLogoDomain } from "@/lib/logoDomain";
import { fetchGoogleNewsWhitelist } from "@/lib/fetchGoogleNewsWhitelist";
import { reportError } from "@/lib/errorReporter";
import type {
  StockData,
  CashFlowYear,
  QualityAnnual,
  EarningsQuarter,
  ForwardEstimate,
  AnalystAction,
  InsiderTransaction,
  PeerComparison,
  PeerMultiple,
  QuarterIncomeStatement,
} from "@/types/StockData";

// Leaky-bucket gate for every outbound request to Yahoo Finance. Yahoo
// publishes no official limit; the maintainer of the `yfinance` Python
// library — the de-facto authority on Yahoo Finance reverse-engineering —
// recommends ≤ 1 req/s sustained (ranaroussi/yfinance#2125). Going faster
// triggers 429s in batches of ~100 calls and risks IP bans of minutes to
// weeks. We run on Cloudflare's pool of egress IPs, so the aggregate
// throughput across many isolates is higher, but any single worker
// holding a hot IP must stay under that ceiling.
const YAHOO_RATE_LIMIT_PER_SECOND = parseInt(process.env.YAHOO_RATE_LIMIT_PER_SECOND ?? "1", 10);
const YAHOO_MIN_INTERVAL_MS = 1000 / YAHOO_RATE_LIMIT_PER_SECOND;
let yahooLastRequestAt = 0;
let yahooQueueTail: Promise<void> = Promise.resolve();

async function acquireYahooToken(): Promise<void> {
  const job = yahooQueueTail.then(async () => {
    const now = Date.now();
    const elapsed = now - yahooLastRequestAt;
    if (elapsed < YAHOO_MIN_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, YAHOO_MIN_INTERVAL_MS - elapsed));
    }
    yahooLastRequestAt = Date.now();
  });
  yahooQueueTail = job.catch(() => {});
  return job;
}

// Timeout duro sobre TODO el tráfico Yahoo. Este wrapper es el único embudo
// (se inyecta como fetch custom de yahoo-finance2, y el crumb/screener lo
// usan directo), así que un solo signal acá cubre quoteSummary, timeseries,
// crumb dance y screener. Sin esto, una conexión tarpiteada desde el egreso
// compartido de Cloudflare colgaba el análisis para siempre (incidente
// 2026-07-06). 15s es holgado: una llamada sana tarda 1-3s.
const YAHOO_FETCH_TIMEOUT_MS = 15_000;

const throttledYahooFetch: typeof fetch = async (input, init) => {
  await acquireYahooToken();
  const timeout = AbortSignal.timeout(YAHOO_FETCH_TIMEOUT_MS);
  // Respetar un signal del caller si existiera (yahoo-finance2 hoy no pasa
  // ninguno): el primero que dispare aborta.
  const signal = init?.signal
    ? (typeof AbortSignal.any === "function" ? AbortSignal.any([init.signal, timeout]) : init.signal)
    : timeout;
  return fetch(input, { ...init, signal });
};

export const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
  fetch: throttledYahooFetch,
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



// ── Memo cortísimo de fetchStockData, por ticker y por isolate ────────────────
// El peaje de mail de /analisis (route §2b-pre) trae la cabecera con un
// fetchStockData "teaser", y segundos después —cuando la persona deja el correo
// y vuelve con la cookie— la generación real vuelve a llamar fetchStockData: dos
// golpes idénticos a la llamada MÁS pesada de Yahoo (quoteSummary de ~12 módulos
// + 3 años de historia + fundamentals + news). Memoizamos la PROMESA en vuelo
// por ticker para colapsar ese par en un solo round-trip; de paso absorbe el
// burst de doble-click y comparte el fetch entre requests concurrentes del mismo
// ticker (el dedup de §2d del route opera a nivel del análisis completo y no
// cubre el teaser, que responde 403 antes de registrarse).
//
// TTL deliberadamente ínfimo: un análisis fresco es una "foto congelada" de 24h,
// así que un precio de un par de minutos no cambia nada, y nunca queremos que
// una cotización vieja sobreviva al momento. Un refresh explícito ("Actualizar
// análisis") está detrás de un cooldown de 1 h ≫ este TTL, así que siempre pega
// fresco. Las rejections NO se cachean: un fetch fallido tiene que poder
// reintentarse en el acto.
const FETCH_STOCK_MEMO_TTL_MS = 3 * 60 * 1000; // 3 min
const FETCH_STOCK_MEMO_MAX = 512;              // techo blando anti-leak (home server = proceso largo)
type StockMemoEntry = { at: number; promise: Promise<StockData> };
const gStock = globalThis as Record<string, unknown>;
if (!gStock.__stockDataMemo) gStock.__stockDataMemo = new Map<string, StockMemoEntry>();
const stockMemo = gStock.__stockDataMemo as Map<string, StockMemoEntry>;

// Wrapper público: sirve la promesa memoizada si sigue fresca; si no, arranca
// una nueva y la guarda. Único punto de entrada — todos los callers pasan por
// acá (la implementación real es fetchStockDataUncached).
export function fetchStockData(ticker: string): Promise<StockData> {
  const key = ticker.toUpperCase();
  const now = Date.now();

  const hit = stockMemo.get(key);
  if (hit && now - hit.at < FETCH_STOCK_MEMO_TTL_MS) return hit.promise;
  if (hit) stockMemo.delete(key); // vencida: limpieza perezosa

  // Barrido oportunista sólo cuando el mapa creció: en el proceso largo del home
  // server, tickers consultados una vez no deben quedar residentes para siempre.
  if (stockMemo.size > FETCH_STOCK_MEMO_MAX) {
    for (const [k, v] of stockMemo) {
      if (now - v.at >= FETCH_STOCK_MEMO_TTL_MS) stockMemo.delete(k);
    }
  }

  const promise = fetchStockDataUncached(ticker);
  stockMemo.set(key, { at: now, promise });
  // Nunca dejar una promesa rechazada en el memo: el próximo intento re-fetchea.
  promise.catch(() => {
    const cur = stockMemo.get(key);
    if (cur && cur.promise === promise) stockMemo.delete(key);
  });
  return promise;
}

async function fetchStockDataUncached(ticker: string): Promise<StockData> {
  const oneYearAgo = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000);
  const today = new Date();
  const tenYearsAgo = new Date(Date.now() - 11 * 365 * 24 * 60 * 60 * 1000);

  const [result, historicalRaw, searchResult, edgarRevenue, fundamentalsRaw, fundamentalsQuarterlyRaw] = await Promise.all([
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
      .historical(
        ticker,
        { period1: oneYearAgo, period2: today, interval: "1wk" },
        { validateResult: false },
      )
      .catch((err) => {
        reportError("fetchStockData/historical", err, { ticker });
        return null;
      }),
    yahooFinance
      .search(ticker, { newsCount: 7, quotesCount: 1 }, { validateResult: false })
      .catch((err) => {
        reportError("fetchStockData/search", err, { ticker });
        return null;
      }),
    // Best-effort: si SEC está caído (timeout/circuit breaker) el gráfico de
    // revenue se arma solo con el stream quarterly de Yahoo (el merge de
    // abajo ya tolera edgarRevenue null). Antes esta rejection tumbaba TODO
    // fetchStockData — y con él el análisis completo — aunque Yahoo estuviera
    // perfectamente sano.
    fetchEdgarQuarterlyRevenue(ticker, oneYearAgo).catch((err) => {
      reportError("fetchStockData/edgarQuarterlyRevenue", err, { ticker });
      return null;
    }),
    yahooFinance
      .fundamentalsTimeSeries(
        ticker,
        { period1: tenYearsAgo, type: "annual", module: "all" },
        { validateResult: false },
      )
      .catch((err) => {
        reportError("fetchStockData/fundamentalsAnnual", err, { ticker });
        return null;
      }) as Promise<AnyRecord[] | null>,
    yahooFinance
      .fundamentalsTimeSeries(
        ticker,
        { period1: oneYearAgo, type: "quarterly", module: "all" },
        { validateResult: false },
      )
      .catch((err) => {
        reportError("fetchStockData/fundamentalsQuarterly", err, { ticker });
        return null;
      }) as Promise<AnyRecord[] | null>,
  ]);

  // ── Quarterly revenue: EDGAR + Yahoo gap-fill ──────────────────────────────
  // EDGAR is authoritative but its `companyconcept` API occasionally misses
  // a quarter (most often Q4, when neither a standalone Q4 quarterly fact
  // nor the annual − YTD derivation succeeds, leaving a visible hole in
  // the chart). Yahoo's `fundamentalsTimeSeries` quarterly stream covers
  // the gaps with ~5 years of history (US filers only — sparse/null for
  // ADRs of foreign companies). The legacy `incomeStatementHistoryQuarterly`
  // submodule is no longer used: Yahoo's quoteSummary financial-statement
  // submodules have been returning empty since Nov 2024.
  // Paid alternatives (FMP/AV) were tried previously but get rate-limited
  // from Cloudflare IPs — see commit b7322a1.
  // Find the most-recent quarterly IS for use as Sankey fallback when EDGAR
  // is behind. Field names follow fundamentalsTimeSeries (e.g.
  // researchAndDevelopment vs the legacy researchDevelopment).
  const yahooQuarterlyRev = new Map<string, number>();
  const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
  let latestQuarterIS: QuarterIncomeStatement | null = null;
  if (Array.isArray(fundamentalsQuarterlyRaw)) {
    for (const row of fundamentalsQuarterlyRaw) {
      const dateVal: unknown = row.date;
      const end = dateVal instanceof Date
        ? fmtDate(dateVal)
        : typeof dateVal === "string"
          ? dateVal.slice(0, 10)
          : null;
      const rev = (row.totalRevenue ?? row.revenue) as number | undefined;
      if (!end || !rev || rev <= 0) continue;
      if (!yahooQuarterlyRev.has(end)) yahooQuarterlyRev.set(end, rev);
      if (!latestQuarterIS || end > latestQuarterIS.endDate) {
        latestQuarterIS = {
          endDate: end,
          totalRevenue: rev,
          costOfRevenue: num(row.costOfRevenue),
          grossProfit: num(row.grossProfit),
          researchDevelopment: num(row.researchAndDevelopment),
          sellingGeneralAdministrative: num(row.sellingGeneralAndAdministration),
          totalOperatingExpenses: num(row.operatingExpense),
          operatingIncome: num(row.operatingIncome),
          incomeBeforeTax: num(row.pretaxIncome),
          incomeTaxExpense: num(row.taxProvision),
          netIncome: num(row.netIncome),
        };
      }
    }
  }

  let revenueRaw = edgarRevenue;
  if (yahooQuarterlyRev.size > 0) {
    const merged = [...(revenueRaw ?? [])];
    const existingMs = merged.map((q) => Date.parse(q.time));
    // 7-day tolerance: yahoo-finance2 may return quarter ends shifted by
    // timezone (e.g. 2023-12-31 vs 2024-01-01) or at slightly different
    // dates than EDGAR for the same logical quarter.
    const SAME_QUARTER_MS = 7 * 86_400_000;
    for (const [time, value] of yahooQuarterlyRev) {
      const yMs = Date.parse(time);
      if (!isFinite(yMs)) continue;
      const isDuplicate = existingMs.some((ms) => Math.abs(ms - yMs) <= SAME_QUARTER_MS);
      if (!isDuplicate) {
        merged.push({ time, value });
        existingMs.push(yMs);
      }
    }
    revenueRaw = merged.sort((a, b) => a.time.localeCompare(b.time));
  }

  const price   = result.price        as AnyRecord | undefined;
  const detail  = result.summaryDetail as AnyRecord | undefined;
  const stats   = result.defaultKeyStatistics as AnyRecord | undefined;
  const fin     = result.financialData as AnyRecord | undefined;
  const profile = result.assetProfile  as AnyRecord | undefined;
  const cal     = result.calendarEvents as AnyRecord | undefined;
  const trend   = result.recommendationTrend as AnyRecord | undefined;
  const holders = result.majorHoldersBreakdown as AnyRecord | undefined;

  // Issuer's reporting currency (CNY for BABA, EUR for ASML/NOK, JPY for TM,
  // GBP for HSBC, …). All Yahoo financial-statement and time-series figures
  // come back in this currency — without conversion the revenue chart, KPI
  // cards and Sankey-Yahoo-fallback for foreign issuers would render in the
  // native currency. We render USD across the entire app, so resolve the FX
  // rate once and apply it to every Yahoo-sourced monetary field below.
  // ADR price/marketCap stay in trading currency (already USD on US exchanges
  // — the US-exchange gate above ensures this).
  const financialCurrency = (fin?.financialCurrency as string | undefined)?.toUpperCase() ?? "USD";
  const fxToUsd = financialCurrency !== "USD" ? await fetchUsdRate(financialCurrency) : 1;
  const fx = (fxToUsd && fxToUsd > 0) ? fxToUsd : 1;
  const fxConvert = (v: number | null | undefined): number | null =>
    v == null ? null : v * fx;

  // Convert Yahoo-sourced quarterly revenue values to USD. EDGAR-sourced
  // values are already USD-filtered at the XBRL `units.USD` boundary, so
  // for US issuers (financialCurrency === "USD") fx=1 and this is a no-op.
  // For foreign issuers (BABA et al.) edgarRevenue is empty because their
  // XBRL is in native currency, so revenueRaw is 100 % Yahoo and 100 %
  // financialCurrency — uniform conversion is safe.
  if (fx !== 1 && revenueRaw) {
    revenueRaw = revenueRaw.map((q) => ({ time: q.time, value: q.value * fx }));
  }
  if (fx !== 1 && latestQuarterIS) {
    latestQuarterIS = {
      endDate:                       latestQuarterIS.endDate,
      totalRevenue:                  latestQuarterIS.totalRevenue * fx,
      costOfRevenue:                 fxConvert(latestQuarterIS.costOfRevenue),
      grossProfit:                   fxConvert(latestQuarterIS.grossProfit),
      researchDevelopment:           fxConvert(latestQuarterIS.researchDevelopment),
      sellingGeneralAdministrative:  fxConvert(latestQuarterIS.sellingGeneralAdministrative),
      totalOperatingExpenses:        fxConvert(latestQuarterIS.totalOperatingExpenses),
      operatingIncome:               fxConvert(latestQuarterIS.operatingIncome),
      incomeBeforeTax:               fxConvert(latestQuarterIS.incomeBeforeTax),
      incomeTaxExpense:              fxConvert(latestQuarterIS.incomeTaxExpense),
      netIncome:                     fxConvert(latestQuarterIS.netIncome) ?? 0,
    };
  }

  // Verify US exchange — uses data already fetched, no extra API call
  const US_EXCHANGES = new Set(["NMS", "NAS", "NGM", "NCM", "NYS", "NYQ", "ASE"]);
  const exchange = price?.exchange as string | undefined;
  if (!exchange || !US_EXCHANGES.has(exchange)) {
    throw new Error(`"${ticker}" no está listado en una bolsa de EE.UU.`);
  }

  const domain = resolveLogoDomain(ticker, extractDomain(profile?.website ?? null));

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
  // Yahoo's revenue estimate comes back in the issuer's reporting currency;
  // EPS stays in trading currency (per-ADR), so only revenueEstimate flips.
  const rawTrend = ((result.earningsTrend as AnyRecord)?.trend ?? []) as AnyRecord[];
  const forwardEstimates: ForwardEstimate[] = rawTrend
    .filter((t) => ["0q", "+1q", "0y", "+1y"].includes(t.period))
    .map((t) => ({
      period: t.period,
      epsEstimate: t.earningsEstimate?.avg ?? null,
      revenueEstimate: fxConvert(t.revenueEstimate?.avg ?? null),
      growth: t.growth ?? null,
      revisionsUp30d: t.epsRevisions?.upLast30days ?? null,
      revisionsDown30d: t.epsRevisions?.downLast30days ?? null,
      epsTrend30dAgo: t.epsTrend?.["30daysAgo"] ?? null,
      epsTrend90dAgo: t.epsTrend?.["90daysAgo"] ?? null,
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

  // ── Annual cash flow history (CAPEX trend) ─────────────────────────────────
  // ── Annual cash flow history (CAPEX trend) — from combined fundamentals ────
  let annualCashFlow: CashFlowYear[] | null = fundamentalsRaw
    ? (fundamentalsRaw as AnyRecord[])
        .filter((r) => r.capitalExpenditure != null || r.operatingCashFlow != null)
        .map((r) => ({
          year: r.date instanceof Date ? r.date.getFullYear().toString() : String(r.date).slice(0, 4),
          capitalExpenditure: fxConvert(r.capitalExpenditure ?? null),
          operatingCashFlow: fxConvert(r.operatingCashFlow ?? null),
          freeCashFlow: fxConvert(r.freeCashFlow ?? null),
          repurchases: fxConvert((r.repurchaseOfCapitalStock ?? r.commonStockPayments ?? null) as number | null),
          dividendsPaid: fxConvert((r.commonStockDividendPaid ?? r.cashDividendsPaid ?? null) as number | null),
          stockBasedComp: fxConvert((r.stockBasedCompensation ?? null) as number | null),
        }))
        .sort((a, b) => a.year.localeCompare(b.year))
        .slice(-5)
    : null;

  // Fallback: build a single-year entry from financialData when fundamentalsTimeSeries fails
  if ((!annualCashFlow || annualCashFlow.length === 0) && (fin?.operatingCashflow != null || fin?.freeCashflow != null)) {
    const ocf = fxConvert((fin?.operatingCashflow as number | null) ?? null);
    const fcf = fxConvert((fin?.freeCashflow as number | null) ?? null);
    const capex = ocf != null && fcf != null ? fcf - ocf : null;
    annualCashFlow = [{
      year: "TTM",
      capitalExpenditure: capex,
      operatingCashFlow: ocf,
      freeCashFlow: fcf,
      repurchases: null,
      dividendsPaid: null,
      stockBasedComp: null,
    }];
  }

  // ── Quality factor inputs (last 2 FYs) — Novy-Marx GP/A, Sloan accruals,
  // asset growth, net share issuance. Raw local-currency figures (ratios son
  // FX-invariantes ⇒ sin fxConvert). ────────────────────────────────────────
  const qualityAnnual: QualityAnnual[] | null = fundamentalsRaw
    ? (fundamentalsRaw as AnyRecord[])
        .filter((r) => r.totalAssets != null || r.grossProfit != null)
        .map((r) => ({
          year: r.date instanceof Date ? r.date.getFullYear().toString() : String(r.date).slice(0, 4),
          totalAssets: (r.totalAssets ?? null) as number | null,
          grossProfit: (r.grossProfit ?? null) as number | null,
          netIncome: (r.netIncome ?? r.netIncomeCommonStockholders ?? null) as number | null,
          operatingCashFlow: (r.operatingCashFlow ?? null) as number | null,
          sharesOutstanding: (r.shareIssued ?? r.ordinarySharesNumber ?? r.basicAverageShares ?? null) as number | null,
        }))
        .sort((a, b) => a.year.localeCompare(b.year))
        .slice(-2)
    : null;

  // ── Beta (can live in stats or detail) ─────────────────────────────────────
  const betaVal = stats?.beta ?? detail?.beta ?? null;

  // ── CAPE ratio (Shiller P/E) — price / 10-year avg diluted EPS ────────────
  let capeRatio: number | null = null;
  let capeYears: number | null = null;
  const currentPriceVal = (price?.regularMarketPrice as number | undefined) ?? null;
  if (fundamentalsRaw && currentPriceVal != null) {
    const epsValues = (fundamentalsRaw as AnyRecord[])
      .map((r) => (r.dilutedEPS as number | undefined) ?? (r.basicEPS as number | undefined) ?? null)
      .filter((v): v is number => v != null);
    const recent = epsValues.slice(-10);
    if (recent.length >= 3) {
      const avgEps = recent.reduce((a, b) => a + b, 0) / recent.length;
      if (avgEps > 0) {
        capeRatio = currentPriceVal / avgEps;
        capeYears = recent.length;
      }
    }
  }

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
    capeRatio,
    capeYears,

    totalRevenue: fxConvert(fin?.totalRevenue ?? null),
    revenueGrowth: fin?.revenueGrowth ?? null,
    grossMargins: fin?.grossMargins ?? null,
    operatingMargins: fin?.operatingMargins ?? null,
    profitMargins: fin?.profitMargins ?? null,
    ebitdaMargins: fin?.ebitdaMargins ?? null,
    ebitda: fxConvert(fin?.ebitda ?? null),
    returnOnEquity: fin?.returnOnEquity ?? null,
    returnOnAssets: fin?.returnOnAssets ?? null,
    totalDebt: fxConvert(fin?.totalDebt ?? null),
    totalCash: fxConvert(fin?.totalCash ?? null),
    debtToEquity: fin?.debtToEquity ?? null,
    currentRatio: fin?.currentRatio ?? null,
    quickRatio: fin?.quickRatio ?? null,
    freeCashflow: fxConvert(fin?.freeCashflow ?? null),
    operatingCashflow: fxConvert(fin?.operatingCashflow ?? null),
    earningsGrowth: fin?.earningsGrowth ?? null,
    shortPercentOfFloat: stats?.shortPercentOfFloat ?? null,
    sharesOutstanding: stats?.sharesOutstanding ?? null,

    heldPercentInsiders: stats?.heldPercentInsiders ?? null,
    institutionalOwnership: holders?.institutionsPercentHeld ?? null,

    dividendYield: detail?.dividendYield ?? null,
    payoutRatio: detail?.payoutRatio ?? null,
    exDividendDate: fmtDate(detail?.exDividendDate) ?? null,

    earningsHistory,
    latestQuarterIS,
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
      ? (historicalRaw as Array<{ date: Date; adjClose?: number | null }>)
          .filter((d) => d.adjClose != null)
          .map((d) => ({
            time: d.date.toISOString().split("T")[0],
            value: d.adjClose as number,
          }))
      : null,

    annualCashFlow,
    qualityAnnual,
    quarterlyRevenue: revenueRaw ?? null,
    recentNews: await (async () => {
      // PRIMARY: Google News RSS filtered to a Tier 1/2 publisher whitelist.
      // For mid/small caps where Yahoo serves mostly retail blog spam, this
      // surfaces actual wire coverage (Reuters, Bloomberg, WSJ) that Yahoo's
      // engagement-weighted feed buries.
      const companyName = String(price?.longName ?? price?.shortName ?? ticker);
      const gnews = await fetchGoogleNewsWhitelist(ticker, companyName, 7);
      if (gnews.length >= 2) {
        return gnews.map((n) => ({
          title: n.title,
          publisher: n.publisher,
          link: n.link,
          publishedAt: n.publishedAt,
          description: n.description,
        }));
      }

      // FALLBACK: Yahoo Finance search news. Used only when Google News
      // returns too few items (typical for very small caps without wire
      // coverage, or transient RSS failures).
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

// ── Peer P/E comparison (industry screener) ──────────────────────────────────

let cachedAuth: { crumb: string; cookie: string; expiresAt: number } | null = null;

async function fetchYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  try {
    const initRes = await throttledYahooFetch("https://fc.yahoo.com", { redirect: "manual" });
    const setCookies = initRes.headers.getSetCookie?.() ?? [];
    const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
    const crumbRes = await throttledYahooFetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { Cookie: cookie, "User-Agent": "Mozilla/5.0" },
    });
    const crumb = await crumbRes.text();
    if (!crumb || crumb.includes("<")) return null;
    return { crumb, cookie };
  } catch {
    return null;
  }
}

async function getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (cachedAuth && Date.now() < cachedAuth.expiresAt) {
    return { crumb: cachedAuth.crumb, cookie: cachedAuth.cookie };
  }
  const auth = await fetchYahooCrumb();
  if (auth) {
    cachedAuth = { ...auth, expiresAt: Date.now() + 5 * 60 * 1000 }; // 5 min TTL
  }
  return auth;
}

function invalidateCrumb() {
  cachedAuth = null;
}

async function screenByIndustry(
  industry: string,
  auth: { crumb: string; cookie: string },
): Promise<AnyRecord[]> {
  const body = {
    offset: 0,
    size: 15,
    sortField: "intradaymarketcap",
    sortType: "DESC",
    quoteType: "EQUITY",
    query: {
      operator: "AND",
      operands: [
        { operator: "eq", operands: ["region", "us"] },
        { operator: "eq", operands: ["industry", industry] },
      ],
    },
    userId: "",
    userIdType: "guid",
  };

  const url = `https://query2.finance.yahoo.com/v1/finance/screener?crumb=${encodeURIComponent(auth.crumb)}&formatted=false&lang=en-US&region=US`;
  const res = await throttledYahooFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: auth.cookie,
      "User-Agent": "Mozilla/5.0",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    invalidateCrumb();
    return [];
  }

  const data = (await res.json()) as AnyRecord;
  return (data.finance?.result?.[0]?.quotes as AnyRecord[]) ?? [];
}

// Enrich peers with growth / operating margin / EV-EBITDA via per-symbol
// quoteSummary. Best-effort and time-boxed: each peer that resolves before the
// deadline is enriched in place; the rest stay P/E-only. Never throws, never
// hangs the analysis (Yahoo fetches are already throttled ~1 req/s and 15s-
// capped upstream; this deadline is the outer guard for the whole batch).
async function enrichPeers(peers: PeerMultiple[]): Promise<PeerMultiple[]> {
  const DEADLINE_MS = 6000;
  const results = [...peers];
  const enrichOne = async (i: number): Promise<void> => {
    try {
      const qs = (await yahooFinance.quoteSummary(
        peers[i].symbol,
        { modules: ["financialData", "defaultKeyStatistics"] },
        { validateResult: false },
      )) as AnyRecord;
      const fin = qs.financialData as AnyRecord | undefined;
      const stats = qs.defaultKeyStatistics as AnyRecord | undefined;
      results[i] = {
        ...peers[i],
        revenueGrowth: (fin?.revenueGrowth as number | undefined) ?? null,
        operatingMargin: (fin?.operatingMargins as number | undefined) ?? null,
        evToEbitda: (stats?.enterpriseToEbitda as number | undefined) ?? null,
      };
    } catch {
      /* keep the base P/E-only peer */
    }
  };
  const deadline = new Promise<void>((r) => setTimeout(r, DEADLINE_MS));
  await Promise.race([Promise.allSettled(peers.map((_, i) => enrichOne(i))), deadline]);
  return results;
}

export async function fetchPeerComparison(
  ticker: string,
  knownIndustry?: string | null,
): Promise<PeerComparison | null> {
  try {
    // Industry is also returned by quoteSummary.assetProfile (already fetched
    // by fetchStockData). The caller passes it in to avoid a duplicate Yahoo
    // call; we only fall back to yahooFinance.quote when the caller doesn't
    // have it (e.g. stand-alone use or stockData.industry came back null).
    let industry = knownIndustry ?? null;
    if (!industry) {
      const quote = await yahooFinance.quote(ticker, {}, { validateResult: false }) as AnyRecord;
      industry = (quote.industry as string | undefined) ?? null;
    }
    if (!industry) return null;

    const auth = await getYahooCrumb();
    if (!auth) return null;

    // assetProfile.industry usa " - " ("Banks - Diversified") pero el enum del
    // screener usa EM-DASH ("Banks—Diversified") — con el string crudo el
    // screener devolvía 0 peers para TODOS los bancos/aseguradoras/REITs/
    // software-infra (descubierto por el backtest de paridad 2026-07-19:
    // producción nunca tuvo peers en esos sectores). Normalizamos y, por si
    // alguna industria sí usa el formato crudo, reintentamos con el original.
    const screenerIndustry = industry.replace(/ - /g, "—");
    let quotes = await screenByIndustry(screenerIndustry, auth);
    if (quotes.length === 0 && screenerIndustry !== industry) {
      quotes = await screenByIndustry(industry, auth);
    }

    // Deduplicate by company name (e.g. SONY/SNEJF) — keep the one with more data
    const seen = new Map<string, AnyRecord>();
    for (const q of quotes) {
      const name = ((q.longName ?? q.shortName ?? "") as string).replace(/,?\s*(Inc\.?|Corp\.?|Ltd\.?|Co\.?|plc|SA|AG|NV|SE)$/i, "").trim();
      const sym = q.symbol as string;
      if (sym.toUpperCase() === ticker.toUpperCase()) continue;
      const existing = seen.get(name);
      if (!existing || (q.forwardPE != null && existing.forwardPE == null)) {
        seen.set(name, q);
      }
    }

    const peers: PeerMultiple[] = [...seen.values()].slice(0, 5).map((q) => ({
      symbol: q.symbol as string,
      name: (q.longName ?? q.shortName ?? q.symbol) as string,
      trailingPE: (q.trailingPE as number | undefined) ?? null,
      forwardPE: (q.forwardPE as number | undefined) ?? null,
      revenueGrowth: null,
      operatingMargin: null,
      evToEbitda: null,
    }));

    if (peers.length === 0) return null;

    // Best-effort enrichment (growth / margin / EV-EBITDA). Bounded so it can
    // never hang the analysis: peers that don't enrich in time stay P/E-only.
    const enriched = await enrichPeers(peers);

    const trailingPEs = enriched.map((p) => p.trailingPE).filter((v): v is number => v != null);
    const forwardPEs = enriched.map((p) => p.forwardPE).filter((v): v is number => v != null);

    return {
      peers: enriched,
      avgTrailingPE: trailingPEs.length > 0 ? trailingPEs.reduce((a, b) => a + b, 0) / trailingPEs.length : null,
      avgForwardPE: forwardPEs.length > 0 ? forwardPEs.reduce((a, b) => a + b, 0) / forwardPEs.length : null,
    };
  } catch {
    return null;
  }
}
