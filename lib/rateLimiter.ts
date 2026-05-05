const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX ?? "20", 10);

interface Entry {
  count: number;
  windowStart: number;
}

const store = new Map<string, Entry>();

export function checkRateLimit(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count += 1;
  return { allowed: true, retryAfter: 0 };
}
