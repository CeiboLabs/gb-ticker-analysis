import fs from "fs";
import path from "path";
import type { StructuredReport } from "@/types/Report";
import type { StockData } from "@/types/StockData";

interface CacheEntry {
  report: StructuredReport;
  stockData: StockData;
  createdAt: number;
}

// Layer 1: In-memory (per process)
const memCache = new Map<string, CacheEntry>();

// Layer 2: Filesystem
const CACHE_DIR = path.join(process.cwd(), ".cache");

function cacheKey(ticker: string): string {
  const date = new Date().toISOString().split("T")[0];
  return `${ticker.toUpperCase()}-${date}`;
}

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function cacheFilePath(key: string): string {
  return path.join(CACHE_DIR, `${key}.json`);
}

function isValidEntry(entry: unknown): entry is CacheEntry {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  const report = e.report as Record<string, unknown> | undefined;
  // Reject entries that don't match the current report schema
  return (
    !!report &&
    typeof report.bullCase === "object" && report.bullCase !== null &&
    "recentEarnings" in report &&
    "riskFactors" in report
  );
}

export function cacheGet(ticker: string): CacheEntry | null {
  const key = cacheKey(ticker);

  // Layer 1: memory
  const memHit = memCache.get(key);
  if (memHit) return isValidEntry(memHit) ? memHit : null;

  // Layer 2: filesystem
  try {
    const filePath = cacheFilePath(key);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const entry: unknown = JSON.parse(raw);
      if (!isValidEntry(entry)) return null; // stale format — treat as miss
      memCache.set(key, entry);
      return entry;
    }
  } catch {
    // corrupted cache file — treat as miss
  }

  return null;
}

export function cacheSet(ticker: string, report: StructuredReport, stockData: StockData): void {
  const key = cacheKey(ticker);
  const entry: CacheEntry = { report, stockData, createdAt: Date.now() };

  // Layer 1: memory
  memCache.set(key, entry);

  // Layer 2: filesystem (best-effort — will be a no-op on ephemeral serverless)
  try {
    ensureCacheDir();
    fs.writeFileSync(cacheFilePath(key), JSON.stringify(entry), "utf-8");
  } catch {
    // Ignore filesystem errors (e.g. read-only on serverless)
  }
}

export function cacheClear(ticker: string): void {
  const key = cacheKey(ticker);
  memCache.delete(key);
  try {
    const filePath = cacheFilePath(key);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // Ignore
  }
}
