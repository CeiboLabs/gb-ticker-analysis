import type { RevenueQuarter } from "@/types/StockData";

// All state is in-memory — Cloudflare Workers have no filesystem.
// State persists across requests within the same isolate instance.

const DAILY_LIMIT = 25;
const DAYS_AFTER_QUARTER_END = 90 + 45;
const MIN_REFETCH_MS = 7 * 24 * 60 * 60 * 1000;

interface CallEntry {
  ticker: string;
  ts: number;
}

const callLog: CallEntry[] = [];
const revenueCache = new Map<string, { data: RevenueQuarter[]; savedAt: number }>();

function todayPrefix(): string {
  return new Date().toISOString().slice(0, 10);
}

function isSameDay(ts: number): boolean {
  return new Date(ts).toISOString().slice(0, 10) === todayPrefix();
}

// ── Revenue cache ─────────────────────────────────────────────────────────────

export function getRevenueCache(ticker: string): RevenueQuarter[] | null {
  const entry = revenueCache.get(ticker.toUpperCase());
  if (!entry || entry.data.length === 0) return null;

  const lastQuarterEnd = entry.data
    .map(q => new Date(q.time).getTime())
    .reduce((a, b) => Math.max(a, b));

  const nextPossibleReport = lastQuarterEnd + DAYS_AFTER_QUARTER_END * 24 * 60 * 60 * 1000;
  const now = Date.now();

  if (now < nextPossibleReport) return entry.data;
  if (now - entry.savedAt < MIN_REFETCH_MS) return entry.data;
  return null;
}

export function setRevenueCache(ticker: string, data: RevenueQuarter[]): void {
  revenueCache.set(ticker.toUpperCase(), { data, savedAt: Date.now() });
}

// ── Call tracker ──────────────────────────────────────────────────────────────

export function trackAvCall(ticker: string): void {
  callLog.push({ ticker: ticker.toUpperCase(), ts: Date.now() });
  // Prune entries older than 90 days
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  let i = 0;
  while (i < callLog.length && callLog[i].ts < cutoff) i++;
  if (i > 0) callLog.splice(0, i);
}

export interface AvUsageSummary {
  date: string;
  used: number;
  remaining: number;
  limit: number;
  tickers: string[];
}

export function getAvUsage(): AvUsageSummary {
  const today = callLog.filter(c => isSameDay(c.ts));
  const tickers = [...new Set(today.map(c => c.ticker))];
  return {
    date: todayPrefix(),
    used: today.length,
    remaining: Math.max(0, DAILY_LIMIT - today.length),
    limit: DAILY_LIMIT,
    tickers,
  };
}
