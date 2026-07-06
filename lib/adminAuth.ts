import { NextRequest, NextResponse } from "next/server";
import { checkFailedAuthLimit, trustedClientIp } from "@/lib/rateLimiter";
// La comparación constant-time se movió a lib/panelCrypto.ts (núcleo puro del
// panel de empleados, sin imports de Next) para que los tests de Node y el
// generador offline de hashes la compartan. Se re-exporta para no romper el
// contrato de este módulo.
import { timingSafeEqual } from "@/lib/panelCrypto";

export { timingSafeEqual };

// Brute-force cap on FAILED auth attempts only. A valid token bypasses the
// gate entirely (a cron hitting /api/admin/retention can run indefinitely).
// 30 failed attempts/h per IP still cuts off credential-spray cold.
const ADMIN_HOURLY_MAX = 30;

// Verifies a capability token exclusively from a request HEADER. We deliberately
// do NOT accept tokens via querystring — querystrings end up in access logs,
// browser history, and Referer headers.
//
// Fail-closed: if the expected token is unset in env, every request is rejected.
// `gateKey` keys a separate durable brute-force bucket per credential, so
// spraying one token doesn't consume another's budget.
export async function requireToken(
  req: NextRequest,
  expected: string | undefined,
  opts: { headerName: string; gateKey: string; max?: number },
): Promise<NextResponse | null> {
  if (!expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const got = req.headers.get(opts.headerName) ?? "";
  if (timingSafeEqual(got, expected)) return null;

  // Failed auth — consume from the durable brute-force bucket (D1, survives
  // isolate recycling, no allowlist bypass). Once exhausted, even a request
  // with a valid token (above) still gets in; only attackers guessing tokens
  // hit this branch.
  const gate = await checkFailedAuthLimit(trustedClientIp(req), opts.max ?? ADMIN_HOURLY_MAX, opts.gateKey);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

// Token de endpoints de ops/diagnóstico: retention (cron) y los parsers de
// prueba. Header `x-admin-token`. El Monitor de métricas ya NO lo usa — vive en
// el panel de empleados y se gatea por sesión (cookie + permiso `monitor`).
export function requireAdminToken(req: NextRequest): Promise<NextResponse | null> {
  return requireToken(req, process.env.ADMIN_TOKEN, { headerName: "x-admin-token", gateKey: "adminfail" });
}
