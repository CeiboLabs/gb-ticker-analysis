// Rate-limit counters. Two tiers:
//
// 1. DURABLE (D1, table `rate_limits`) — the gates that guard real money or
//    auth: analyze IP/daily-fresh and failed admin logins. Counters are
//    fixed windows incremented with an atomic UPSERT, so they survive
//    isolate recycling: an F5 that lands on a fresh Cloudflare isolate sees
//    the same count as the request that tripped the 429.
//
// 2. IN-MEMORY (per-isolate Map) — high-volume public GETs (search type-ahead,
//    quote polling, logos). A D1 write per keystroke would cost more than the
//    abuse it prevents; the Yahoo outbound throttle is the real guard there.
//    Also the fallback when the METRICS_DB binding is missing (local dev).

import { getMetricsDb } from "@/lib/metrics";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS  = 24 * 60 * 60 * 1000;

// "Mañana" para el cap diario significa medianoche Uruguay (UTC-3, sin DST),
// no medianoche UTC — mismo criterio que usa el dashboard de métricas.
const UY_OFFSET_MS = 3 * 60 * 60 * 1000;

// All analyze gates are keyed by IP — never by anything the client can mint
// itself (cookies, headers, body). A cookie-keyed bucket is a bucket the
// attacker rotates for free; the IP is the only request attribute the client
// can't cheaply choose. Shared NATs get headroom via the allowlist
// multiplier, not by trusting client state.
//
// Defaults are derived, not guessed. System ceiling at OpenAI Tier 2
// (450k TPM / 12k tokens per analysis ≈ 2,250/h) is bound by Yahoo: at
// 1 req/s sustained (yfinance maintainer's recommendation) and ~7 Yahoo
// calls per analysis, the worker can sustain ~510 analyses/h. 100/h per IP
// stays far above any honest single user without letting one address
// monopolize the worker.
const HOURLY_IP_MAX = parseInt(process.env.RATE_LIMIT_IP_MAX ?? "100", 10);
const DAILY_FRESH_MAX = parseInt(process.env.RATE_LIMIT_DAILY_FRESH_MAX ?? "150", 10);

// Allowlisted IPs (corporate NATs) get N× the analyze caps instead of a full
// bypass — a single abusive browser inside a "trusted" office still hits a
// ceiling.
const ALLOWLIST_MULTIPLIER = parseInt(process.env.RATE_LIMIT_ALLOWLIST_MULTIPLIER ?? "10", 10);

// Per-IP, per-endpoint hourly cap for public GETs. Type-ahead search and
// quote polling fan out quickly: a 10-user office easily generates >1k
// calls/h on a single endpoint. The Yahoo outbound throttle (1 req/s ≈
// 3,600 calls/h per worker) is the real cost guard upstream — these
// per-IP caps just prevent cookie-less abuse without punishing NATs.
export const PUBLIC_LIMIT_DEFAULT = parseInt(process.env.PUBLIC_LIMIT_DEFAULT ?? "1500", 10);
// Logo endpoint fans out per-ticker on list views and is heavily cached
// downstream; allow ~2x the default to accommodate a popular-tickers grid.
export const PUBLIC_LIMIT_LOGO = parseInt(process.env.PUBLIC_LIMIT_LOGO ?? "3000", 10);

// Allowlist of trusted egress IPs (typically corporate NATs where many real
// users share a single outbound address). For analyze gates they get the
// multiplier above; for cheap public GETs they bypass the in-memory cap
// entirely. Comma-separated, no spaces required (we trim).
const IP_ALLOWLIST = new Set(
  (process.env.RATE_LIMIT_IP_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

export function isIpAllowlisted(ip: string | null): boolean {
  return !!ip && IP_ALLOWLIST.has(ip);
}

interface Gate {
  allowed: boolean;
  retryAfter: number;
}

interface Entry {
  count: number;
  windowStart: number;
}

const store = new Map<string, Entry>();

function check(key: string, max: number, windowMs: number): Gate {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= max) {
    const retryAfter = Math.ceil((windowMs - (now - entry.windowStart)) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count += 1;
  return { allowed: true, retryAfter: 0 };
}

// Durable fixed-window counter in D1. One atomic UPSERT per call: insert the
// window row or bump its count, read the result back in the same statement.
// Concurrent requests on different isolates serialize in D1, so the count is
// authoritative — no per-isolate drift, no reset on F5.
//
// windowOffsetMs shifts the window boundary (e.g. UY midnight for the daily
// cap). Falls back to the in-memory check when the binding is missing (local
// dev) or D1 errors — the limiter must never take the endpoint down with it.
async function checkDurable(
  key: string,
  max: number,
  windowMs: number,
  windowOffsetMs = 0,
): Promise<Gate> {
  const db = getMetricsDb();
  if (!db) return check(key, max, windowMs);

  const now = Date.now();
  const windowStart = Math.floor((now - windowOffsetMs) / windowMs) * windowMs + windowOffsetMs;
  try {
    const row = await db
      .prepare(
        "INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) " +
        "ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1 " +
        "RETURNING count"
      )
      .bind(key, windowStart)
      .first<{ count: number }>();
    const count = row?.count ?? 1;
    if (count > max) {
      return { allowed: false, retryAfter: Math.ceil((windowStart + windowMs - now) / 1000) };
    }
    return { allowed: true, retryAfter: 0 };
  } catch {
    return check(key, max, windowMs);
  }
}

// Effective cap for an IP: allowlisted NATs get the multiplier, everyone
// else the base. Never a bypass — every IP has *some* ceiling.
function effectiveMax(ip: string, base: number): number {
  return isIpAllowlisted(ip) ? base * ALLOWLIST_MULTIPLIER : base;
}

// Per-IP 1h window over ALL analyze requests (fresh + would-be-fresh).
// Requests with no resolvable IP (never happens behind Cloudflare) share a
// single conservative bucket instead of skipping the gate.
export function checkIpHourlyLimit(ip: string | null): Promise<Gate> {
  if (!ip) return checkDurable("hrip:noip", HOURLY_IP_MAX, HOUR_MS);
  return checkDurable(`hrip:${ip}`, effectiveMax(ip, HOURLY_IP_MAX), HOUR_MS);
}

// Daily cap on *fresh* analyses (cache misses) per IP. Caches still serve
// freely; this purely caps the OpenAI/upstream-fanout cost an attacker can
// burn by rotating tickers. Window resets at midnight Uruguay.
export function checkDailyFreshLimit(ip: string | null): Promise<Gate> {
  if (!ip) return checkDurable("dfresh:noip", DAILY_FRESH_MAX, DAY_MS, UY_OFFSET_MS);
  return checkDurable(`dfresh:${ip}`, effectiveMax(ip, DAILY_FRESH_MAX), DAY_MS, UY_OFFSET_MS);
}

// Brute-force cap on FAILED admin auth attempts, per IP. Durable on purpose:
// an in-memory bucket let an attacker reset their budget by rotating isolates
// (or just waiting for a redeploy). No allowlist bypass here — auth guessing
// from a "trusted" NAT is still auth guessing.
export function checkAdminFailedAuthLimit(ip: string | null, max: number): Promise<Gate> {
  if (!ip) return Promise.resolve({ allowed: true, retryAfter: 0 });
  return checkDurable(`adminfail:${ip}`, max, HOUR_MS);
}

// Generic per-IP, per-endpoint hourly limiter for read-only public GETs
// (chart-range, quotes, search, popular). Each endpoint gets its own bucket,
// keyed by IP, so a noisy caller on /search doesn't deny /chart-range.
// Allowlisted IPs (corporate NATs) bypass the cap. Deliberately in-memory:
// these endpoints are cheap and high-volume — see header comment.
export function checkPublicGetLimit(
  endpoint: string,
  ip: string | null,
  max: number,
): Gate {
  if (!ip) return { allowed: true, retryAfter: 0 };
  if (isIpAllowlisted(ip)) return { allowed: true, retryAfter: 0 };
  return check(`pub:${endpoint}:${ip}`, max, HOUR_MS);
}

// Convenience: pull the client IP off a Request the way the analyze route
// does. Returns null if no header is present (local dev, direct internal call).
export function clientIpFrom(req: { headers: { get(name: string): string | null } }): string | null {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}
