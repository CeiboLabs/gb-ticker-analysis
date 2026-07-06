import { NextRequest, NextResponse } from "next/server";
import { yahooFinance } from "@/lib/fetchStockData";
import { getTopTickers } from "@/lib/tickerStats";
import { checkPublicGetLimit, trustedClientIp, PUBLIC_LIMIT_DEFAULT } from "@/lib/rateLimiter";
import { reportError } from "@/lib/errorReporter";


const FALLBACK = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AMD"];
const DEFAULT_LIMIT = 8;
const LOOKBACK_DAYS = 7;

export async function GET(req: NextRequest) {
  const gate = checkPublicGetLimit("popular", trustedClientIp(req), PUBLIC_LIMIT_DEFAULT);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }

  const limitParam = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 20
    ? Math.floor(limitParam)
    : DEFAULT_LIMIT;

  // 1. Get top tracked tickers (may be empty on a fresh datacenter)
  const top = await getTopTickers(limit, LOOKBACK_DAYS).catch(() => []);
  const tracked = top.map((t) => t.symbol);

  // 2. Fill remaining slots with curated fallback (preserving order, no dupes)
  const seen = new Set(tracked);
  const symbols = [...tracked];
  for (const sym of FALLBACK) {
    if (symbols.length >= limit) break;
    if (!seen.has(sym)) {
      symbols.push(sym);
      seen.add(sym);
    }
  }

  // 3. Single batched Yahoo call for all symbols. The previous implementation
  // issued 8 quote() + 8 quoteSummary() requests serialized by the 1 req/s
  // Yahoo throttle (~16s total) which timed out on Cloudflare edge. The
  // logo endpoint resolves brand marks from the ticker alone, so we no
  // longer need quoteSummary just to get the website domain here.
  type BatchQuote = {
    symbol: string;
    longName?: string;
    shortName?: string;
    regularMarketPrice?: number;
    regularMarketChangePercent?: number;
    currency?: string;
  };

  const batch = (await yahooFinance
    .quote(symbols, {}, { validateResult: false })
    .catch((err) => {
      reportError("api/popular/quote-batch", err, { symbols: symbols.join(",") });
      return [] as BatchQuote[];
    })) as BatchQuote[];

  const bySymbol = new Map(batch.map((q) => [q.symbol, q]));

  const quotes = symbols
    .map((sym) => {
      const q = bySymbol.get(sym);
      if (!q) return null;
      return {
        symbol: sym,
        name: q.longName ?? q.shortName ?? sym,
        price: q.regularMarketPrice ?? null,
        changePercent: q.regularMarketChangePercent ?? null,
        currency: q.currency ?? null,
      };
    })
    .filter((q): q is NonNullable<typeof q> => q !== null);

  return NextResponse.json(
    { quotes },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
