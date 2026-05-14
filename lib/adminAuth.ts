import { NextRequest, NextResponse } from "next/server";
import { checkPublicGetLimit, clientIpFrom } from "@/lib/rateLimiter";

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

// Brute-force cap: even with a strong, timing-safe-checked token, every IP
// that touches /api/admin/* gets one shared bucket. 30/h is way over what the
// dashboard does in normal use, but cuts off any kind of credential-spray.
const ADMIN_HOURLY_MAX = 30;

// Verifies the admin token exclusively from the `x-admin-token` header. We
// deliberately do NOT accept the token via querystring — querystrings end up in
// access logs, browser history, and Referer headers. Also enforces a per-IP
// hourly cap so unauthenticated callers can't hammer the endpoint.
//
// Fail-closed: if ADMIN_TOKEN is unset in env, every request is rejected.
export function requireAdminToken(req: NextRequest): NextResponse | null {
  const gate = checkPublicGetLimit("admin", clientIpFrom(req), ADMIN_HOURLY_MAX);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const got = req.headers.get("x-admin-token") ?? "";
  if (!timingSafeEqual(got, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
