import { NextRequest, NextResponse } from "next/server";
import { yahooFinance } from "@/lib/fetchStockData";
import { resolveLogoDomain } from "@/lib/logoDomain";
import { normalizeTicker } from "@/lib/validators";
import { checkPublicGetLimit, clientIpFrom, PUBLIC_LIMIT_DEFAULT } from "@/lib/rateLimiter";
import { reportError } from "@/lib/errorReporter";

export const runtime = "edge";

const MAX_SYMBOLS = 12;

function extractDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const gate = checkPublicGetLimit("quotes", clientIpFrom(req), PUBLIC_LIMIT_DEFAULT);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }

  const raw = req.nextUrl.searchParams.get("symbols")?.trim();
  if (!raw) return NextResponse.json({ quotes: [] });

  // Validate every symbol; drop anything that doesn't pass so we never pass
  // unsanitized strings to the upstream Yahoo client. Cap fan-out at MAX_SYMBOLS.
  const symbols = [...new Set(
    raw.split(",").map((s) => normalizeTicker(s)).filter((s): s is string => s != null),
  )].slice(0, MAX_SYMBOLS);

  if (symbols.length === 0) return NextResponse.json({ quotes: [] });

  try {
    const results = await Promise.all(
      symbols.map(async (sym) => {
        const [quote, profile] = await Promise.all([
          yahooFinance.quote(sym, {}, { validateResult: false }).catch((err) => {
            reportError("api/quotes/quote", err, { symbol: sym });
            return null;
          }),
          yahooFinance
            .quoteSummary(sym, { modules: ["assetProfile"] }, { validateResult: false })
            .catch((err) => {
              reportError("api/quotes/quoteSummary", err, { symbol: sym });
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
          domain: resolveLogoDomain(sym, extractDomain(profile?.assetProfile?.website)),
        };
      }),
    );

    const quotes = results.filter((q): q is NonNullable<typeof q> => q !== null);

    return NextResponse.json(
      { quotes },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch {
    return NextResponse.json({ quotes: [] });
  }
}
