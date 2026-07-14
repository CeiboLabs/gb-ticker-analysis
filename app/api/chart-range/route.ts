import { NextRequest, NextResponse } from "next/server";
import { fetchChartRange, type ChartRange } from "@/lib/fetchChartRange";
import { chartCacheGet, chartCacheSet, CHART_CACHE_TTL, FROZEN_TTL_SECONDS } from "@/lib/chartCache";
import { normalizeTicker } from "@/lib/validators";
import { checkPublicGetLimit, trustedClientIp, PUBLIC_LIMIT_DEFAULT } from "@/lib/rateLimiter";

export const runtime = "edge";

const VALID_RANGES: ChartRange[] = ["1D", "5D", "1M", "3M", "1Y", "3Y"];

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

  // asOf pins the range to the analysis snapshot instant (epoch ms) so its last
  // value matches the frozen header + 3Y chart. Accept only a plausible recent
  // epoch — anything else (junk, far future) falls back to the live window so a
  // bad param can't fragment the cache or ask Yahoo for a nonsense range.
  const asOfRaw = req.nextUrl.searchParams.get("asOf");
  const asOf = (() => {
    if (asOfRaw == null || !/^\d{10,16}$/.test(asOfRaw)) return undefined;
    const n = Number(asOfRaw);
    if (n < 1_600_000_000_000 || n > Date.now() + 86_400_000) return undefined;
    return n;
  })();

  // Pinned (as-of-T) ranges are immutable → long CDN TTL; live ranges keep the
  // short per-range TTL. Mirrors the shared-cache TTL in lib/chartCache.
  const ttl = asOf != null ? FROZEN_TTL_SECONDS : CHART_CACHE_TTL[rangeParam];

  try {
    // Shared cache first: the first visitor to open this (ticker, range, asOf)
    // pays the Yahoo round-trip and stores the result; everyone after — including
    // OTHER users viewing the same cached report — is served from cache without
    // hitting Yahoo again.
    const cached = await chartCacheGet(ticker, rangeParam, asOf);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 4}`,
          "X-Cache": "HIT",
        },
      });
    }

    const payload = await fetchChartRange(ticker, rangeParam, asOf);
    // Best-effort populate; a cache write failure must not fail the response.
    await chartCacheSet(ticker, rangeParam, payload, asOf);
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 4}`,
        "X-Cache": "MISS",
      },
    });
  } catch (err) {
    // Upstream (Yahoo) errors — log server-side, never echo internals.
    console.error("[chart-range]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "chart unavailable" }, { status: 502 });
  }
}
