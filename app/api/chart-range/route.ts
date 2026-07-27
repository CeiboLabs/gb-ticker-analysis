import { NextRequest, NextResponse } from "next/server";
import { fetchChartRange, type ChartRange, type ChartRangePayload } from "@/lib/fetchChartRange";
import { normalizeTicker } from "@/lib/validators";
import { checkPublicGetLimit, trustedClientIp, PUBLIC_LIMIT_DEFAULT } from "@/lib/rateLimiter";
import { createTtlMemo } from "@/lib/memoTtl";


const VALID_RANGES: ChartRange[] = ["1D", "5D", "1M", "3M", "1Y", "3Y"];

// Per-range edge cache. Intraday updates frequently, longer ranges are stable.
const CACHE_SECONDS: Record<ChartRange, number> = {
  "1D": 60,
  "5D": 5 * 60,
  "1M": 15 * 60,
  "3M": 60 * 60,
  "1Y": 6 * 60 * 60,
  "3Y": 12 * 60 * 60,
};

// La misma política, ahora también en memoria del proceso: sin CDN adelante, el
// s-maxage de arriba no lo respetaba nadie y cada carga de la landing pedía la
// serie de nuevo a Yahoo (~1 s medido). Se cachea acá y no dentro de
// fetchChartRange a propósito: /api/analyze también la usa (serie de 1Y para el
// contexto técnico) y ese camino genera un informe pago, así que no le cambiamos
// la frescura de los datos por debajo.
const rangeMemo = createTtlMemo<ChartRangePayload>(60_000, 64);

export async function GET(req: NextRequest) {
  const gate = checkPublicGetLimit("chart-range", trustedClientIp(req), PUBLIC_LIMIT_DEFAULT);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }

  const ticker = normalizeTicker(req.nextUrl.searchParams.get("ticker"));
  const rangeParam = req.nextUrl.searchParams.get("range")?.trim().toUpperCase() as ChartRange | undefined;

  if (!ticker) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }
  if (!rangeParam || !VALID_RANGES.includes(rangeParam)) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  try {
    const ttl = CACHE_SECONDS[rangeParam];
    const payload = await rangeMemo(
      `${ticker}|${rangeParam}`,
      () => fetchChartRange(ticker, rangeParam),
      ttl * 1000,
    );
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 4}`,
      },
    });
  } catch (err) {
    // Upstream (Yahoo) errors — log server-side, never echo internals.
    console.error("[chart-range]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "chart unavailable" }, { status: 502 });
  }
}
