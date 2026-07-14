import { yahooFinance } from "@/lib/fetchStockData";

// All ranges supported by the chart timeframe selector. "3Y" is also served
// here so the lazy-fetched view can refresh with the same shape, even though
// the initial analyze response already ships 3Y weekly closes.
export type ChartRange = "1D" | "5D" | "1M" | "3M" | "1Y" | "3Y";

export interface ChartPoint {
  /** Unix seconds for intraday; "YYYY-MM-DD" for daily/weekly. */
  time: number | string;
  value: number;
}

export interface ChartRangePayload {
  range: ChartRange;
  /** True only for "1D": payload includes pre-market and after-hours quotes. */
  hasPrePost: boolean;
  /** Regular session boundaries (Unix seconds), used to split the line into pre/regular/post. */
  regularSession: { start: number; end: number } | null;
  prices: ChartPoint[];
}

interface RangeConfig {
  interval: "5m" | "15m" | "30m" | "1h" | "1d" | "1wk";
  /** Days of history to request from Yahoo. */
  days: number;
  includePrePost: boolean;
}

const RANGE_CONFIG: Record<ChartRange, RangeConfig> = {
  // 1D: ~5 calendar days back so the most recent session is fully covered
  // even when today is a weekend/holiday and we have to fall back further.
  "1D": { interval: "5m", days: 5, includePrePost: true },
  // 5D: 30-minute bars across the most recent 5 trading days. Intraday
  // resolution keeps the line shape readable instead of just 5 dots.
  "5D": { interval: "30m", days: 9, includePrePost: false },
  "1M": { interval: "1h", days: 35, includePrePost: false },
  "3M": { interval: "1d", days: 95, includePrePost: false },
  "1Y": { interval: "1d", days: 370, includePrePost: false },
  "3Y": { interval: "1wk", days: 3 * 365 + 7, includePrePost: false },
};

const INTRADAY_INTERVALS = new Set(["5m", "15m", "30m", "1h"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChartResult = any;

export async function fetchChartRange(
  ticker: string,
  range: ChartRange,
  asOf?: number,
): Promise<ChartRangePayload> {
  const cfg = RANGE_CONFIG[range];
  // Anchor the window's END to the analysis snapshot time when provided, so
  // every range ends at the SAME instant as the header price and the seeded 3Y
  // chart — the whole report is a coherent as-of-T snapshot. Without this, a
  // range the user opens later pulls live data past T; after a big intraday
  // move its last point would show a price the frozen header never shows.
  // Absent asOf → end = now (live behaviour, e.g. a fresh analysis where T≈now).
  const end = asOf != null && Number.isFinite(asOf) ? new Date(asOf) : new Date();
  const period1 = new Date(end.getTime() - cfg.days * 86_400_000);

  const result = (await yahooFinance.chart(
    ticker,
    {
      period1,
      period2: end,
      interval: cfg.interval,
      includePrePost: cfg.includePrePost,
      return: "array",
    },
    { validateResult: false },
  )) as ChartResult;

  const quotes = (result?.quotes ?? []) as Array<{
    date: Date;
    close: number | null;
    adjclose?: number | null;
  }>;

  if (range === "1D") {
    return buildSingleSessionPayload(quotes, result);
  }

  // Intraday non-1D (5D): keep Unix-second timestamps so multiple bars on
  // the same calendar date don't collide on the chart's time scale.
  if (INTRADAY_INTERVALS.has(cfg.interval)) {
    const raw: ChartPoint[] = quotes
      .filter((q) => q.close != null)
      .map((q) => ({
        time: Math.floor(q.date.getTime() / 1000),
        value: q.close as number,
      }));
    return { range, hasPrePost: false, regularSession: null, prices: dedupeAndSort(raw) };
  }

  // Daily/weekly: one point per session day. Use adjclose when available so
  // dividends/splits don't introduce artificial discontinuities.
  const raw: ChartPoint[] = quotes
    .filter((q) => (q.adjclose ?? q.close) != null)
    .map((q) => ({
      time: q.date.toISOString().split("T")[0],
      value: (q.adjclose ?? q.close) as number,
    }));

  return { range, hasPrePost: false, regularSession: null, prices: dedupeAndSort(raw) };
}

// Yahoo occasionally returns duplicate timestamps (especially around session
// transitions or when adjclose/close pairs end up at the same epoch second).
// lightweight-charts asserts strictly ascending time; collapse duplicates by
// keeping the latest bar for a given timestamp and re-sorting defensively.
function dedupeAndSort(points: ChartPoint[]): ChartPoint[] {
  const byTime = new Map<string | number, ChartPoint>();
  for (const p of points) byTime.set(p.time, p);
  return [...byTime.values()].sort((a, b) => {
    if (typeof a.time === "number" && typeof b.time === "number") return a.time - b.time;
    return String(a.time).localeCompare(String(b.time));
  });
}

// Intraday: keep only the most recent session day so the chart focuses on
// "today" rather than a multi-day strip with overnight gaps. Pre-market and
// after-hours bars share the same calendar day as the regular session, so
// we anchor on the day with the latest regular-session bar.
function buildSingleSessionPayload(
  quotes: Array<{ date: Date; close: number | null }>,
  result: ChartResult,
): ChartRangePayload {
  const meta = result?.meta ?? {};
  const tradingPeriod = meta.currentTradingPeriod ?? null;
  const regular = tradingPeriod?.regular as { start: Date; end: Date } | undefined;

  const sessionDateKey = regular
    ? etDateKey(regular.start)
    : (() => {
        const last = [...quotes].reverse().find((q) => q.close != null);
        return last ? etDateKey(last.date) : etDateKey(new Date());
      })();

  const sessionQuotes = quotes.filter(
    (q) => q.close != null && etDateKey(q.date) === sessionDateKey,
  );

  const prices: ChartPoint[] = dedupeAndSort(
    sessionQuotes.map((q) => ({
      time: Math.floor(q.date.getTime() / 1000),
      value: q.close as number,
    })),
  );

  const regularSession =
    regular && etDateKey(regular.start) === sessionDateKey
      ? {
          start: Math.floor(regular.start.getTime() / 1000),
          end: Math.floor(regular.end.getTime() / 1000),
        }
      : null;

  return {
    range: "1D",
    hasPrePost: true,
    regularSession,
    prices,
  };
}

function etDateKey(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}
