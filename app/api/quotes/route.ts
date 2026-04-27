import { NextRequest, NextResponse } from "next/server";
import { yahooFinance } from "@/lib/fetchStockData";

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
  const raw = req.nextUrl.searchParams.get("symbols")?.trim();
  if (!raw) return NextResponse.json({ quotes: [] });

  const symbols = [...new Set(
    raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
  )].slice(0, MAX_SYMBOLS);

  if (symbols.length === 0) return NextResponse.json({ quotes: [] });

  try {
    const results = await Promise.all(
      symbols.map(async (sym) => {
        const [quote, profile] = await Promise.all([
          yahooFinance.quote(sym).catch(() => null),
          yahooFinance
            .quoteSummary(sym, { modules: ["assetProfile"] }, { validateResult: false })
            .catch(() => null) as Promise<{ assetProfile?: { website?: string } } | null>,
        ]);
        if (!quote) return null;
        return {
          symbol: sym,
          name: quote.longName ?? quote.shortName ?? sym,
          price: quote.regularMarketPrice ?? null,
          changePercent: quote.regularMarketChangePercent ?? null,
          currency: quote.currency ?? null,
          domain: extractDomain(profile?.assetProfile?.website),
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
