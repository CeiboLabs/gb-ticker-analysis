import type { StructuredReport } from "@/types/Report";
import type { StockData } from "@/types/StockData";

interface CacheEntry {
  report: StructuredReport;
  stockData: StockData;
  createdAt: number;
}

const CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds
const CACHE_NAME = "ticker-analysis";

function cacheKey(ticker: string): string {
  const date = new Date().toISOString().split("T")[0];
  return `${ticker.toUpperCase()}-${date}`;
}

// Internal URL used as cache key for the Cache API (doesn't need to be a real URL)
function cacheUrl(key: string): string {
  return `https://ticker-cache.internal/${key}`;
}

// In-memory fallback for local dev (globalThis survives HMR reloads)
const g = globalThis as Record<string, unknown>;
if (!g.__tickerCache) g.__tickerCache = new Map<string, CacheEntry>();
const memCache = g.__tickerCache as Map<string, CacheEntry>;

function isValidEntry(entry: unknown): entry is CacheEntry {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  const report = e.report as Record<string, unknown> | undefined;
  return (
    !!report &&
    typeof report.bullCase === "object" && report.bullCase !== null &&
    "recentEarnings" in report &&
    "riskFactors" in report &&
    "catalysts" in report &&
    "industryContext" in report
  );
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
        if (isValidEntry(entry)) return entry;
      }
    } catch { /* fall through */ }
  }

  // In-memory fallback (local dev)
  const hit = memCache.get(key);
  return hit && isValidEntry(hit) ? hit : null;
}

export async function cacheSet(ticker: string, report: StructuredReport, stockData: StockData): Promise<void> {
  const key = cacheKey(ticker);
  const entry: CacheEntry = { report, stockData, createdAt: Date.now() };

  // Cloudflare Cache API
  if (typeof caches !== "undefined") {
    try {
      const store = await caches.open(CACHE_NAME);
      await store.put(
        new Request(cacheUrl(key)),
        new Response(JSON.stringify(entry), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": `public, max-age=${CACHE_TTL}`,
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
