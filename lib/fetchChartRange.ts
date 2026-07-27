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
): Promise<ChartRangePayload> {
  const cfg = RANGE_CONFIG[range];
  const period1 = new Date(Date.now() - cfg.days * 86_400_000);

  const result = (await yahooFinance.chart(
    ticker,
    {
      period1,
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
  const withClose = quotes.filter((q) => q.close != null);

  // Anclar en el último día que TIENE barras, no en el que Yahoo llama
  // "actual". meta.currentTradingPeriod es la rueda vigente por reloj de pared:
  // apenas cierra el after-hours (20:00 ET) ya apunta a la sesión siguiente, y
  // todo el fin de semana apunta al lunes. Anclar ahí filtraba contra un día sin
  // una sola barra y el rango 1D salía vacío ("Sin datos para este rango")
  // todas las noches y sábados/domingos, aunque Yahoo mandara la rueda anterior
  // completa.
  const last = withClose[withClose.length - 1];
  const sessionDateKey = last ? etDateKey(last.date) : etDateKey(new Date());

  const sessionQuotes = withClose.filter((q) => etDateKey(q.date) === sessionDateKey);

  const prices: ChartPoint[] = dedupeAndSort(
    sessionQuotes.map((q) => ({
      time: Math.floor(q.date.getTime() / 1000),
      value: q.close as number,
    })),
  );

  return {
    range: "1D",
    hasPrePost: true,
    regularSession: findRegularSession(result, sessionDateKey),
    prices,
  };
}

// Límites de la rueda regular del día que efectivamente se grafica; el chart
// los usa para partir la línea en pre / regular / after. Cuando el día anclado
// no es el de currentTradingPeriod (noche, fin de semana, feriado) hay que
// sacarlos de meta.tradingPeriods, que trae una fila por día del rango — así el
// sombreado sigue siendo correcto en medias ruedas, que no cierran a las 16:00.
function findRegularSession(
  result: ChartResult,
  sessionDateKey: string,
): { start: number; end: number } | null {
  const meta = result?.meta ?? {};
  const candidates: Array<{ start: unknown; end: unknown }> = [];

  if (meta.currentTradingPeriod?.regular) candidates.push(meta.currentTradingPeriod.regular);
  // tradingPeriods.regular llega como array de arrays (una fila por jornada).
  for (const row of (meta.tradingPeriods?.regular ?? []) as unknown[]) {
    for (const period of Array.isArray(row) ? row : [row]) {
      if (period) candidates.push(period as { start: unknown; end: unknown });
    }
  }

  for (const period of candidates) {
    const start = toDate(period.start);
    const end = toDate(period.end);
    if (!start || !end || etDateKey(start) !== sessionDateKey) continue;
    return { start: Math.floor(start.getTime() / 1000), end: Math.floor(end.getTime() / 1000) };
  }
  return null;
}

// yahoo-finance2 hidrata estos campos a Date, pero con validateResult:false un
// cambio de forma upstream puede dejar el epoch crudo. Aceptar ambos.
function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") return new Date(value * 1000);
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
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
