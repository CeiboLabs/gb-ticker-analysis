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
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

// Minimal R2 surface — sólo lo que usa el feed de Instagram (el worker escribe
// stills, la ruta /api/instagram/media/[id] los sirve same-origin). Hand-rolled
// como la interfaz D1 de arriba: no dependemos de @cloudflare/workers-types.
export interface R2HTTPMetadata {
  contentType?: string;
  cacheControl?: string;
}
export interface R2Object {
  key: string;
  size: number;
  httpEtag: string;
  httpMetadata?: R2HTTPMetadata;
  writeHttpMetadata(headers: Headers): void;
}
export interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
}
export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | string | null,
    options?: { httpMetadata?: R2HTTPMetadata },
  ): Promise<R2Object | null>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    objects: R2Object[];
    truncated: boolean;
    cursor?: string;
  }>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// Validado: un env mal seteado ("90d", vacío) daría NaN, que llegaría al
// bind() del DELETE y la purga fallaría silenciosamente.
const RETENTION_DAYS = (() => {
  const n = parseInt(process.env.RETENTION_DAYS ?? "90", 10);
  return Number.isFinite(n) && n > 0 ? n : 90;
})();

// Drop analyze_events past retention and rate-limit windows that ended more
// than 2 days ago (the longest window is the daily fresh cap). Idempotent and
// cheap — both deletes hit indexed columns. Called opportunistically from the
// rate limiter on the first fresh-analysis of each IP's day (so it runs a
// handful of times daily with zero cron infra), and manually via
// /api/admin/retention.
export async function purgeExpiredRows(db: D1Database, retentionDays = RETENTION_DAYS): Promise<{ events: number | null; rateLimits: number | null }> {
  const now = Date.now();
  const [ev, rl] = (await db.batch([
    db.prepare("DELETE FROM analyze_events WHERE ts < ?").bind(now - retentionDays * DAY_MS),
    db.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(now - 2 * DAY_MS),
  ])) as Array<{ meta?: { changes?: number } }>;
  return { events: ev?.meta?.changes ?? null, rateLimits: rl?.meta?.changes ?? null };
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
  // Upstream (SEC/Yahoo) no respondió dentro del timeout. Antes este modo de
  // fallo era invisible: el fetch sin timeout colgaba el request para siempre
  // y moría sin pasar por ningún fireEvent (cero rastro en el monitor).
  | "upstream_timeout"
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
  // Multi-step pipeline telemetry (Sprint 1).
  pipelineHadDegradation?: boolean | null;
  pipelineErrors?: string | null;       // JSON-stringified [{stage, error}]
  scratchpad?: string | null;           // JSON-stringified synthesis CoT scratchpad
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

// Bucket R2 con los stills de Instagram (binding INSTAGRAM_MEDIA). next-on-pages
// inyecta los bindings en process.env / globalThis igual que la D1. La lee la
// ruta /api/instagram/media/[id]; el worker usa su propio env.INSTAGRAM_MEDIA.
export function getInstagramMediaBucket(): R2Bucket | null {
  const env = (process.env as unknown as Record<string, unknown>) ?? {};
  const fromEnv = env.INSTAGRAM_MEDIA as R2Bucket | undefined;
  if (fromEnv && typeof fromEnv.get === "function") return fromEnv;
  const fromGlobal = (globalThis as unknown as Record<string, unknown>)
    .INSTAGRAM_MEDIA as R2Bucket | undefined;
  if (fromGlobal && typeof fromGlobal.get === "function") return fromGlobal;
  return null;
}

// Bucket R2 con los PDFs que administra el panel de empleados (informes y
// documentos del fondo; binding DOCS, bucket bengochea-docs). Separado de
// INSTAGRAM_MEDIA a propósito: aquel lo escribe un worker standalone con otro
// ciclo de vida y semántica de cache — acá sólo escriben las rutas
// /api/admin/panel/* y leen los proxies same-origin de PDFs.
export function getDocsBucket(): R2Bucket | null {
  const env = (process.env as unknown as Record<string, unknown>) ?? {};
  const fromEnv = env.DOCS as R2Bucket | undefined;
  if (fromEnv && typeof fromEnv.get === "function") return fromEnv;
  const fromGlobal = (globalThis as unknown as Record<string, unknown>)
    .DOCS as R2Bucket | undefined;
  if (fromGlobal && typeof fromGlobal.get === "function") return fromGlobal;
  return null;
}

function truncate(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

// Strip filesystem paths, URL credentials, and stack-frame noise from error
// strings before they hit the metrics DB. Keeps just enough signal to debug
// without leaking server layout, secrets baked into URLs, or PII passed
// through upstream errors.
function sanitizeErrorMsg(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  let out = s
    // Drop "at fn (path:line:col)" stack frames entirely.
    .replace(/\s+at\s+[^\n]*?(?:\([^)]*\))?(?=\n|$)/g, "")
    // POSIX absolute paths with at least 2 segments → [path].
    .replace(/(?:\/[A-Za-z0-9._-]+){2,}/g, "[path]")
    // Windows absolute paths.
    .replace(/[A-Za-z]:\\(?:[^\s\\]+\\?){2,}/g, "[path]")
    // user:pass@ in URLs.
    .replace(/\/\/[^/\s:@]+:[^/\s@]+@/g, "//[redacted]@")
    // Bearer / token query params.
    .replace(/([?&](?:token|api[_-]?key|key|secret|password)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (out.length > max) out = out.slice(0, max);
  return out || null;
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
      sanitizeErrorMsg(e.errorMsg, 500),
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
  // cf-connecting-ip primero (Cloudflare lo reescribe, el cliente no puede
  // falsificarlo) — igual que clientIpFrom en el rate limiter. Con
  // x-forwarded-for primero, el COUNT(DISTINCT ip_hash) de "usuarios únicos"
  // del dashboard era inflable a voluntad.
  const ip =
    req.headers.get("cf-connecting-ip") ??
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
