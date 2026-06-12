import type { StructuredReport } from "@/types/Report";
import type { StockData } from "@/types/StockData";

interface CacheEntry {
  report: StructuredReport;
  stockData: StockData;
  createdAt: number;
  ttlSeconds?: number;
}

const CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds
const SHORT_TTL = 60 * 60;      // 1 hour — used when EDGAR data is detected stale
const CACHE_NAME = "ticker-analysis";

// Bump when the shape of cached data changes (new fields, gap-fill logic, etc.)
// so old entries are invalidated immediately rather than waiting for the daily
// rollover. Append-only — never reuse a previous version.
const CACHE_VERSION = "v29";

export { SHORT_TTL };

function cacheKey(ticker: string): string {
  // Uruguay date (America/Montevideo, UTC-3, no DST) — cache rolls over at local midnight
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return `${ticker.toUpperCase()}-${CACHE_VERSION}-${date}`;
}

// Internal URL used as cache key for the Cache API (doesn't need to be a real URL)
function cacheUrl(key: string): string {
  return `https://ticker-cache.internal/${key}`;
}

// In-memory fallback for local dev (globalThis survives HMR reloads)
const g = globalThis as Record<string, unknown>;
if (!g.__tickerCache) g.__tickerCache = new Map<string, CacheEntry>();
const memCache = g.__tickerCache as Map<string, CacheEntry>;

// Gate for what we're willing to serve from the shared 24h cache. The earlier
// version only checked that a handful of report keys *existed* (`"x" in report`),
// which passed for entries with a null/empty verdict, missing price targets, or
// no stockData at all — any of those then gets served to every user in the
// datacenter for 24h, and a missing stockData breaks the isAnalysisStale() call
// in the analyze route. Writes only ever come from our own pipeline (not user
// input), so this is a robustness gate, not an injection defense — but a partial
// report is still a broken report. Require the fields the UI and route actually
// depend on to be present AND non-empty.
function isNonEmptyString(v: unknown): boolean {
  return typeof v === "string" && v.length > 0;
}
function isValidEntry(entry: unknown): entry is CacheEntry {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  const report = e.report as Record<string, unknown> | undefined;
  const stockData = e.stockData as Record<string, unknown> | undefined;
  if (!report || !stockData) return false;

  // Verdict must be a populated object — a null/empty verdict renders a blank
  // recommendation card.
  const verdict = report.verdict as Record<string, unknown> | undefined;
  if (!verdict || isNonEmptyString(verdict.rating) === false) return false;

  // Bull/bear cases must carry a price target — the report's headline numbers.
  const bull = report.bullCase as Record<string, unknown> | undefined;
  const bear = report.bearCase as Record<string, unknown> | undefined;
  if (!bull || !bear) return false;
  if (bull.priceTarget == null || bear.priceTarget == null) return false;

  // Narrative sections the schema guarantees — presence is enough here (they're
  // validated as strings before caching in the analyze route).
  return (
    "recentEarnings" in report &&
    "riskFactors" in report &&
    "catalysts" in report &&
    "industryContext" in report
  );
}

// Returns null when expired per the entry's own TTL (in addition to the
// per-day cacheKey rollover). Lets us cache stale-EDGAR results with a
// shorter window so the next request re-fetches once 10-Q is filed.
function isFreshEntry(entry: CacheEntry): boolean {
  const ttl = (entry.ttlSeconds ?? CACHE_TTL) * 1000;
  return Date.now() - entry.createdAt < ttl;
}

export async function cacheGet(ticker: string): Promise<CacheEntry | null> {
  const key = cacheKey(ticker);

  // Cloudflare Cache API — shared across isolates in the same datacenter
  if (typeof caches !== "undefined") {
    try {
      const store = await caches.open(CACHE_NAME);
      const res = await store.match(new Request(cacheUrl(key)));
      if (res) {
        const entry = await res.json() as unknown;
        if (isValidEntry(entry) && isFreshEntry(entry)) return entry;
      }
    } catch { /* fall through */ }
  }

  // In-memory fallback (local dev)
  const hit = memCache.get(key);
  return hit && isValidEntry(hit) && isFreshEntry(hit) ? hit : null;
}

export async function cacheSet(
  ticker: string,
  report: StructuredReport,
  stockData: StockData,
  ttlSeconds?: number,
): Promise<void> {
  const key = cacheKey(ticker);
  const effectiveTtl = ttlSeconds ?? CACHE_TTL;
  const entry: CacheEntry = { report, stockData, createdAt: Date.now(), ttlSeconds: effectiveTtl };

  // Cloudflare Cache API
  if (typeof caches !== "undefined") {
    try {
      const store = await caches.open(CACHE_NAME);
      await store.put(
        new Request(cacheUrl(key)),
        new Response(JSON.stringify(entry), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": `public, max-age=${effectiveTtl}`,
          },
        })
      );
    } catch { /* fall through */ }
  }

  // Always write to memory too (instant for local dev)
  memCache.set(key, entry);
}

export async function cacheClear(ticker: string): Promise<void> {
  const key = cacheKey(ticker);

  if (typeof caches !== "undefined") {
    try {
      const store = await caches.open(CACHE_NAME);
      await store.delete(new Request(cacheUrl(key)));
    } catch { /* ignore */ }
  }

  memCache.delete(key);
}
