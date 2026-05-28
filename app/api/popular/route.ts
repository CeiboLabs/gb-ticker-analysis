import { NextRequest, NextResponse } from "next/server";
import { yahooFinance } from "@/lib/fetchStockData";
import { getTopTickers } from "@/lib/tickerStats";
import { checkPublicGetLimit, clientIpFrom, PUBLIC_LIMIT_DEFAULT } from "@/lib/rateLimiter";
import { reportError } from "@/lib/errorReporter";

export const runtime = "edge";

const FALLBACK = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AMD"];
const DEFAULT_LIMIT = 8;
const LOOKBACK_DAYS = 7;

function extractDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const gate = checkPublicGetLimit("popular", clientIpFrom(req), PUBLIC_LIMIT_DEFAULT);
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

  // 3. Fetch quotes + domain for each
  const trackedCounts = new Map(top.map((t) => [t.symbol, t.count]));

  const quotes = await Promise.all(
    symbols.map(async (sym) => {
      const [quote, profile] = await Promise.all([
        yahooFinance.quote(sym, {}, { validateResult: false }).catch((err) => {
          reportError("api/popular/quote", err, { symbol: sym });
          return null;
        }),
        yahooFinance
          .quoteSummary(sym, { modules: ["assetProfile"] }, { validateResult: false })
          .catch((err) => {
            reportError("api/popular/quoteSummary", err, { symbol: sym });
            return null;
          }) as Promise<{ assetProfile?: { website?: string } } | null>,
      ]);
      if (!quote) return null;
      return {
        symbol: sym,
        name: quote.longName ?? quote.shortName ?? sym,
        price: quote.regularMarketPrice ?? null,
        changePercent: quote.regularMarketChangePercent ?? null,
        currency: quote.currency ?? null,
        domain: extractDomain(profile?.assetProfile?.website),
        viewCount: trackedCounts.get(sym) ?? null,
      };
    }),
  );

  return NextResponse.json(
    { quotes: quotes.filter((q): q is NonNullable<typeof q> => q !== null) },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
