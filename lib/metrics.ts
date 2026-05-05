// Usage / failure monitor for /api/analyze.
//
// Writes one row per request to a D1 database (binding METRICS_DB) so the
// /api/admin/metrics endpoint can compute error rates, sankey-source mix,
// and per-ticker fail counts. Writes are fire-and-forget — D1 errors must
// never affect the analyze response.

// Minimal D1 surface — only the methods we use.
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  first<T = unknown>(): Promise<T | null>;
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export type SankeySource =
  | "8k"
  | "6k"
  | "segments"
  | "yahoo_fallback"
  | "yahoo_ttm"
  | "none";

export type EventStatus =
  | "ok"
  | "error"
  | "rate_limited"
  | "cache_hit"
  | "bad_request"
  | "not_found";

export type ErrorStage =
  | "edgar"
  | "yahoo"
  | "openai"
  | "fx"
  | "parse"
  | "rate_limit"
  | "unknown";

export interface AnalyzeEvent {
  ticker: string;
  status: EventStatus;
  durationMs?: number;
  sankeySource?: SankeySource | null;
  sankeyStale?: boolean | null;
  fxOk?: boolean | null;
  edgar8kOk?: boolean | null;
  segmentsOk?: boolean | null;
  errorStage?: ErrorStage | null;
  errorMsg?: string | null;
  userAgent?: string | null;
  country?: string | null;
  ipHash?: string | null;
  // Sankey quality (computed from final SegmentSankeyData on success paths).
  qualityScore?: number | null;
  hasSegments?: boolean | null;
  segmentCount?: number | null;
  hasOpexBreakdown?: boolean | null;
  segmentBalancePct?: number | null;
  costBalancePct?: number | null;
  opexBalancePct?: number | null;
  opChainBalancePct?: number | null;
  qualityFlags?: string[] | null;
  qualityFindings?: string | null;     // JSON-stringified Finding[]
  sankeySnapshot?: string | null;      // JSON-stringified slim SegmentSankeyData
  // Report-derived metadata for the analyses dashboard.
  verdictRating?: "BUY" | "HOLD" | "AVOID" | null;
  verdictConviction?: "HIGH" | "MEDIUM" | "LOW" | null;
  verdictRationale?: string | null;
  companyName?: string | null;
  currentPrice?: number | null;
  marketCap?: number | null;
  bullTarget?: string | null;
  bearTarget?: string | null;
}

export function getMetricsDb(): D1Database | null {
  const env = (process.env as unknown as Record<string, unknown>) ?? {};
  const fromEnv = env.METRICS_DB as D1Database | undefined;
  if (fromEnv && typeof fromEnv.prepare === "function") return fromEnv;
  const fromGlobal = (globalThis as unknown as Record<string, unknown>)
    .METRICS_DB as D1Database | undefined;
  if (fromGlobal && typeof fromGlobal.prepare === "function") return fromGlobal;
  return null;
}

function truncate(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function bool01(v: boolean | null | undefined): number | null {
  return v === true ? 1 : v === false ? 0 : null;
}

// FNV-1a 32-bit, 8-char hex. Just enough to count uniques without storing IPs.
function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  let h = 0x811c9dc5;
  for (let i = 0; i < ip.length; i++) {
    h ^= ip.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

const INSERT_SQL =
  "INSERT INTO analyze_events (" +
  "ts, ticker, status, duration_ms, " +
  "sankey_source, sankey_stale, fx_ok, " +
  "edgar_8k_ok, segments_ok, " +
  "error_stage, error_msg, " +
  "user_agent, country, ip_hash, " +
  "quality_score, has_segments, segment_count, has_opex_breakdown, " +
  "segment_balance_pct, cost_balance_pct, opex_balance_pct, op_chain_balance_pct, " +
  "quality_flags, quality_findings, sankey_snapshot, " +
  "verdict_rating, verdict_conviction, verdict_rationale, " +
  "company_name, current_price, market_cap, bull_target, bear_target" +
  ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

export async function writeAnalyzeEvent(
  db: D1Database,
  e: AnalyzeEvent,
): Promise<void> {
  await db
    .prepare(INSERT_SQL)
    .bind(
      Date.now(),
      e.ticker.toUpperCase(),
      e.status,
      e.durationMs ?? null,
      e.sankeySource ?? null,
      bool01(e.sankeyStale),
      bool01(e.fxOk),
      bool01(e.edgar8kOk),
      bool01(e.segmentsOk),
      e.errorStage ?? null,
      truncate(e.errorMsg, 500),
      truncate(e.userAgent, 200),
      e.country ?? null,
      e.ipHash ?? null,
      e.qualityScore ?? null,
      bool01(e.hasSegments),
      e.segmentCount ?? null,
      bool01(e.hasOpexBreakdown),
      e.segmentBalancePct ?? null,
      e.costBalancePct ?? null,
      e.opexBalancePct ?? null,
      e.opChainBalancePct ?? null,
      e.qualityFlags && e.qualityFlags.length > 0 ? e.qualityFlags.join(",") : null,
      e.qualityFindings ?? null,
      e.sankeySnapshot ?? null,
      e.verdictRating ?? null,
      e.verdictConviction ?? null,
      truncate(e.verdictRationale, 600),
      truncate(e.companyName, 200),
      e.currentPrice ?? null,
      e.marketCap ?? null,
      truncate(e.bullTarget, 80),
      truncate(e.bearTarget, 80),
    )
    .run();
}

// Fire-and-forget. Returns a Promise the caller can pass to ctx.waitUntil so
// writes survive past response close.
export function recordAnalyzeEvent(e: AnalyzeEvent): Promise<void> {
  const db = getMetricsDb();
  if (!db) return Promise.resolve();
  return writeAnalyzeEvent(db, e).catch((err) => {
    console.error("[metrics] write failed:", err);
  });
}

export function eventBaseFromRequest(req: Request): {
  userAgent: string | null;
  country: string | null;
  ipHash: string | null;
} {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const cf = (req as unknown as { cf?: { country?: string } }).cf;
  return {
    userAgent: req.headers.get("user-agent"),
    country: cf?.country ?? null,
    ipHash: hashIp(ip),
  };
}
