import fs from "fs";
import path from "path";
import type { RevenueQuarter } from "@/types/StockData";

const TRACKER_PATH  = path.join(process.cwd(), ".cache", "av-usage.json");
const REVENUE_DIR   = path.join(process.cwd(), ".cache", "av-revenue");
const DAILY_LIMIT   = 25;
// Days after quarter-end before a company typically publishes its report.
// 90d = next quarter ends, +45d = conservative publication window.
const DAYS_AFTER_QUARTER_END = 90 + 45;
// Even after the threshold, wait at least this long between retries so we
// don't burn requests if the company hasn't published yet.
const MIN_REFETCH_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CallEntry {
  ticker: string;
  ts: number; // unix ms
}

interface TrackerFile {
  calls: CallEntry[];
}

function read(): TrackerFile {
  try {
    return JSON.parse(fs.readFileSync(TRACKER_PATH, "utf-8")) as TrackerFile;
  } catch {
    return { calls: [] };
  }
}

function write(data: TrackerFile): void {
  try {
    const dir = path.dirname(TRACKER_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TRACKER_PATH, JSON.stringify(data), "utf-8");
  } catch { /* ignore write errors */ }
}

function todayPrefix(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function isSameDay(ts: number): boolean {
  return new Date(ts).toISOString().slice(0, 10) === todayPrefix();
}

// ── Revenue cache (per ticker, 7-day TTL) ────────────────────────────────────

interface RevenueCacheEntry {
  data: RevenueQuarter[];
  savedAt: number;
}

function revenuePath(ticker: string): string {
  return path.join(REVENUE_DIR, `${ticker.toUpperCase()}.json`);
}

export function getRevenueCache(ticker: string): RevenueQuarter[] | null {
  try {
    const raw   = fs.readFileSync(revenuePath(ticker), "utf-8");
    const entry = JSON.parse(raw) as RevenueCacheEntry;
    if (entry.data.length === 0) return null;

    // Find the most recent quarter end date in the cached data
    const lastQuarterEnd = entry.data
      .map(q => new Date(q.time).getTime())
      .reduce((a, b) => Math.max(a, b));

    // Earliest date a new report could realistically be published:
    // next quarter ends in 90 days, company reports ~45 days after that
    const nextPossibleReport = lastQuarterEnd + DAYS_AFTER_QUARTER_END * 24 * 60 * 60 * 1000;

    const now = Date.now();
    // Still before the expected report window — definitely no new data
    if (now < nextPossibleReport) return entry.data;
    // Past the threshold but fetched recently — avoid burning requests if
    // the company hasn't published yet
    if (now - entry.savedAt < MIN_REFETCH_MS) return entry.data;
    // Past threshold AND enough time since last fetch — try AV for new data
    return null;
  } catch {
    return null;
  }
}

export function setRevenueCache(ticker: string, data: RevenueQuarter[]): void {
  try {
    if (!fs.existsSync(REVENUE_DIR)) fs.mkdirSync(REVENUE_DIR, { recursive: true });
    const entry: RevenueCacheEntry = { data, savedAt: Date.now() };
    fs.writeFileSync(revenuePath(ticker), JSON.stringify(entry), "utf-8");
  } catch { /* ignore */ }
}

// ── Call tracker ─────────────────────────────────────────────────────────────

export function trackAvCall(ticker: string): void {
  const data = read();
  data.calls.push({ ticker: ticker.toUpperCase(), ts: Date.now() });
  // Keep only last 90 days to avoid unbounded growth
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  data.calls = data.calls.filter(c => c.ts >= cutoff);
  write(data);
}

export interface AvUsageSummary {
  date: string;
  used: number;
  remaining: number;
  limit: number;
  tickers: string[]; // unique tickers called today
}

export function getAvUsage(): AvUsageSummary {
  const data  = read();
  const today = data.calls.filter(c => isSameDay(c.ts));
  const tickers = [...new Set(today.map(c => c.ticker))];
  return {
    date:      todayPrefix(),
    used:      today.length,
    remaining: Math.max(0, DAILY_LIMIT - today.length),
    limit:     DAILY_LIMIT,
    tickers,
  };
}
