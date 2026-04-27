// Per-datacenter ticker popularity tracking using the Cloudflare Cache API.
// Same pattern as lib/cache.ts: Cache API in prod, in-memory fallback in dev.
// Race conditions on concurrent writes will lose a small fraction of counts —
// acceptable for a "most popular" ranking.

interface StatsBlob {
  // key format: "TICKER:YYYY-MM-DD", value: view count for that day
  counts: Record<string, number>;
  updatedAt: number;
}

const CACHE_NAME = "ticker-stats";
const STATS_URL = "https://ticker-stats.internal/popular-counters";
const RETENTION_DAYS = 30;

const g = globalThis as Record<string, unknown>;
if (!g.__tickerStats) g.__tickerStats = { counts: {}, updatedAt: 0 } as StatsBlob;
const memStats = g.__tickerStats as StatsBlob;

function todayUtc(): string {
  return new Date().toISOString().split("T")[0];
}

function dateNDaysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}

function pruneOldEntries(blob: StatsBlob): void {
  const cutoff = dateNDaysAgo(RETENTION_DAYS);
  for (const key of Object.keys(blob.counts)) {
    const date = key.split(":")[1];
    if (!date || date < cutoff) delete blob.counts[key];
  }
}

async function readBlob(): Promise<StatsBlob> {
  if (typeof caches !== "undefined") {
    try {
      const store = await caches.open(CACHE_NAME);
      const res = await store.match(new Request(STATS_URL));
      if (res) {
        const data = (await res.json()) as StatsBlob;
        if (data && typeof data === "object" && data.counts) return data;
      }
    } catch { /* fall through */ }
  }
  return { counts: { ...memStats.counts }, updatedAt: memStats.updatedAt };
}

async function writeBlob(blob: StatsBlob): Promise<void> {
  if (typeof caches !== "undefined") {
    try {
      const store = await caches.open(CACHE_NAME);
      await store.put(
        new Request(STATS_URL),
        new Response(JSON.stringify(blob), {
          headers: {
            "Content-Type": "application/json",
            // Long max-age — we treat this entry as "permanent" storage
            "Cache-Control": "public, max-age=31536000",
          },
        }),
      );
    } catch { /* fall through */ }
  }
  memStats.counts = blob.counts;
  memStats.updatedAt = blob.updatedAt;
}

export async function recordTickerView(ticker: string): Promise<void> {
  const sym = ticker.toUpperCase();
  const key = `${sym}:${todayUtc()}`;
  const blob = await readBlob();
  blob.counts[key] = (blob.counts[key] ?? 0) + 1;
  blob.updatedAt = Date.now();
  pruneOldEntries(blob);
  await writeBlob(blob);
}

export async function getTopTickers(
  limit: number,
  lookbackDays = 7,
): Promise<{ symbol: string; count: number }[]> {
  const blob = await readBlob();
  const cutoff = dateNDaysAgo(lookbackDays);
  const aggregated: Record<string, number> = {};
  for (const [key, count] of Object.entries(blob.counts)) {
    const [sym, date] = key.split(":");
    if (!sym || !date || date < cutoff) continue;
    aggregated[sym] = (aggregated[sym] ?? 0) + count;
  }
  return Object.entries(aggregated)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([symbol, count]) => ({ symbol, count }));
}
