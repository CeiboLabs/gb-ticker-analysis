// In-memory token-bucket-ish counters keyed by an arbitrary string. Resets
// every WINDOW_MS. Edge runtime per-isolate state, so this is "best effort"
// across multiple Cloudflare workers — but combined with cookie + IP keys it
// still raises the bar on cheap abuse meaningfully.

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS  = 24 * 60 * 60 * 1000;

const HOURLY_MAX = parseInt(process.env.RATE_LIMIT_MAX ?? "20", 10);
const HOURLY_IP_MAX = parseInt(process.env.RATE_LIMIT_IP_MAX ?? "40", 10);
const DAILY_FRESH_MAX = parseInt(process.env.RATE_LIMIT_DAILY_FRESH_MAX ?? "30", 10);

interface Entry {
  count: number;
  windowStart: number;
}

const store = new Map<string, Entry>();

function check(key: string, max: number, windowMs: number): { allowed: boolean; retryAfter: number } {
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

// Per-session 1h window — original behaviour, kept for backward compat.
export function checkRateLimit(key: string): { allowed: boolean; retryAfter: number } {
  return check(`hr:${key}`, HOURLY_MAX, HOUR_MS);
}

// Per-IP 1h window. Higher ceiling than the session bucket so shared NATs
// (offices, mobile carriers) don't trip on legitimate use, but it still caps
// someone who keeps wiping their session cookie.
export function checkIpHourlyLimit(ip: string): { allowed: boolean; retryAfter: number } {
  return check(`hrip:${ip}`, HOURLY_IP_MAX, HOUR_MS);
}

// Daily cap on *fresh* analyses (cache misses) per key. Caches still serve
// freely; this purely caps the OpenAI/upstream-fanout cost an attacker can
// burn by rotating tickers.
export function checkDailyFreshLimit(key: string): { allowed: boolean; retryAfter: number } {
  return check(`dfresh:${key}`, DAILY_FRESH_MAX, DAY_MS);
}

// Generic per-IP, per-endpoint hourly limiter for read-only public GETs
// (chart-range, quotes, search, popular). Each endpoint gets its own bucket,
// keyed by IP, so a noisy caller on /search doesn't deny /chart-range.
export function checkPublicGetLimit(
  endpoint: string,
  ip: string | null,
  max: number,
): { allowed: boolean; retryAfter: number } {
  if (!ip) return { allowed: true, retryAfter: 0 };
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
