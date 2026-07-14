import type { ChartRange, ChartRangePayload } from "@/lib/fetchChartRange";

// Shared server-side cache for price-chart ranges (1D/5D/1M/3M/1Y/3Y). The first
// visitor who opens a range pays the Yahoo round-trip; the payload is then stored
// in the Cloudflare Cache API (shared across isolates in a datacenter) so the next
// visitor of the SAME (ticker, range) is served from cache instead of hitting
// Yahoo again. Mirrors lib/cache.ts (the analysis cache): Cache API on the edge,
// an in-memory Map fallback for local dev, and manual createdAt+TTL freshness
// (we don't rely on the Cache API's own max-age eviction).
//
// This is orthogonal to the analysis snapshot: the report (header, 3Y default,
// metrics) stays frozen per the daily analysis cache, while these live ranges get
// their own short, per-range TTL so intraday data doesn't go stale for everyone.

interface ChartCacheEntry {
  payload: ChartRangePayload;
  createdAt: number;
  ttlSeconds: number;
}

const CACHE_NAME = "ticker-chart-range";
// Bump when ChartRangePayload's shape changes so old entries invalidate at once.
const CACHE_VERSION = "v1";

// How long a fetched range stays shared before the next request re-fetches.
// Intraday is volatile (short TTL); long ranges barely move (long TTL). Same
// values the response's HTTP s-maxage uses, so CDN and Cache API agree.
export const CHART_CACHE_TTL: Record<ChartRange, number> = {
  "1D": 60,
  "5D": 5 * 60,
  "1M": 15 * 60,
  "3M": 60 * 60,
  "1Y": 6 * 60 * 60,
  "3Y": 12 * 60 * 60,
};

// When a range is pinned to a snapshot time (asOf), its data is historical up to
// a fixed instant — it never changes. Cache it for a day (matches the analysis
// cache) so the whole cohort of viewers of one cached report reuses a single
// fetch, instead of re-pulling immutable data every per-range TTL.
export const FROZEN_TTL_SECONDS = 24 * 60 * 60;

// asOf pins the entry to one analysis snapshot: every viewer of the same cached
// report passes the same asOf → one shared entry; a re-analysis (new asOf) gets
// fresh entries and the old ones expire. "live" keeps the un-pinned path
// separate so it never serves frozen data or vice-versa.
function cacheKey(ticker: string, range: ChartRange, asOf?: number): string {
  return `${ticker.toUpperCase()}-${range}-${asOf ?? "live"}-${CACHE_VERSION}`;
}

// Internal URL used as the Cache API key (doesn't need to resolve).
function cacheUrl(key: string): string {
  return `https://ticker-chart-cache.internal/${key}`;
}

// In-memory fallback for local dev (globalThis survives HMR reloads).
const g = globalThis as Record<string, unknown>;
if (!g.__tickerChartCache) g.__tickerChartCache = new Map<string, ChartCacheEntry>();
const memCache = g.__tickerChartCache as Map<string, ChartCacheEntry>;

function isFresh(entry: ChartCacheEntry): boolean {
  return Date.now() - entry.createdAt < entry.ttlSeconds * 1000;
}

function isValidEntry(entry: unknown): entry is ChartCacheEntry {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  if (typeof e.createdAt !== "number" || typeof e.ttlSeconds !== "number") return false;
  const p = e.payload as Record<string, unknown> | undefined;
  return !!p && Array.isArray(p.prices);
}

export async function chartCacheGet(
  ticker: string,
  range: ChartRange,
  asOf?: number,
): Promise<ChartRangePayload | null> {
  const key = cacheKey(ticker, range, asOf);

  // Cloudflare Cache API — shared across isolates in the same datacenter.
  if (typeof caches !== "undefined") {
    try {
      const store = await caches.open(CACHE_NAME);
      const res = await store.match(new Request(cacheUrl(key)));
      if (res) {
        const entry = (await res.json()) as unknown;
        if (isValidEntry(entry) && isFresh(entry)) return entry.payload;
      }
    } catch {
      /* fall through to memory */
    }
  }

  const hit = memCache.get(key);
  return hit && isValidEntry(hit) && isFresh(hit) ? hit.payload : null;
}

export async function chartCacheSet(
  ticker: string,
  range: ChartRange,
  payload: ChartRangePayload,
  asOf?: number,
): Promise<void> {
  const key = cacheKey(ticker, range, asOf);
  // Pinned ranges are immutable → cache for a day; live ranges keep their short
  // per-range TTL so intraday data stays reasonably current for everyone.
  const ttlSeconds = asOf != null ? FROZEN_TTL_SECONDS : CHART_CACHE_TTL[range];
  const entry: ChartCacheEntry = { payload, createdAt: Date.now(), ttlSeconds };

  if (typeof caches !== "undefined") {
    try {
      const store = await caches.open(CACHE_NAME);
      await store.put(
        new Request(cacheUrl(key)),
        new Response(JSON.stringify(entry), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": `public, max-age=${ttlSeconds}`,
          },
        }),
      );
    } catch {
      /* fall through to memory */
    }
  }

  // Always write memory too (instant for local dev / same-isolate reuse).
  memCache.set(key, entry);
}
