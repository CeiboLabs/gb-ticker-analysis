import type { StructuredReport } from "@/types/Report";
import type { StockData } from "@/types/StockData";

interface CacheEntry {
  report: StructuredReport;
  stockData: StockData;
  createdAt: number;
}

// In-memory cache (per Worker isolate). Persists across requests within the same
// isolate instance. On Cloudflare Workers this is the only viable layer without KV.
const memCache = new Map<string, CacheEntry>();

function cacheKey(ticker: string): string {
  const date = new Date().toISOString().split("T")[0];
  return `${ticker.toUpperCase()}-${date}`;
}

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

export function cacheGet(ticker: string): CacheEntry | null {
  const key = cacheKey(ticker);
  const hit = memCache.get(key);
  if (hit) return isValidEntry(hit) ? hit : null;
  return null;
}

export function cacheSet(ticker: string, report: StructuredReport, stockData: StockData): void {
  const key = cacheKey(ticker);
  memCache.set(key, { report, stockData, createdAt: Date.now() });
}

export function cacheClear(ticker: string): void {
  memCache.delete(cacheKey(ticker));
}
