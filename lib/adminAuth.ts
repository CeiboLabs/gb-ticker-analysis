import { NextRequest, NextResponse } from "next/server";
import { checkAdminFailedAuthLimit, trustedClientIp } from "@/lib/rateLimiter";

// Constant-time string compare that works in the edge runtime (no node:crypto).
// Returns false on any length mismatch but still iterates over `a` so the wall
// time depends on the length of the value the server holds (the env token),
// not on how close the attacker's guess is.
function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0);
  }
  return diff === 0;
}

// Brute-force cap on FAILED auth attempts only. A valid token bypasses the
// gate entirely so the dashboard's 60s auto-refresh can run indefinitely.
// 30 failed attempts/h per IP still cuts off credential-spray cold.
const ADMIN_HOURLY_MAX = 30;

// Verifies the admin token exclusively from the `x-admin-token` header. We
// deliberately do NOT accept the token via querystring — querystrings end up in
// access logs, browser history, and Referer headers.
//
// Fail-closed: if ADMIN_TOKEN is unset in env, every request is rejected.
export async function requireAdminToken(req: NextRequest): Promise<NextResponse | null> {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const got = req.headers.get("x-admin-token") ?? "";
  if (timingSafeEqual(got, expected)) return null;

  // Failed auth — consume from the durable brute-force bucket (D1, survives
  // isolate recycling, no allowlist bypass). Once exhausted, even a request
  // with a valid token (above) still gets in; only attackers guessing tokens
  // hit this branch.
  const gate = await checkAdminFailedAuthLimit(trustedClientIp(req), ADMIN_HOURLY_MAX);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
