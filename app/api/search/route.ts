import { NextRequest, NextResponse } from "next/server";
import { yahooFinance } from "@/lib/fetchStockData";
import { checkPublicGetLimit, trustedClientIp, PUBLIC_LIMIT_DEFAULT } from "@/lib/rateLimiter";
import { reportError } from "@/lib/errorReporter";


const MAX_QUERY_LEN = 64;

// Yahoo Finance exchange codes for US equity markets
const US_EXCHANGES = new Set([
  "NMS", // NASDAQ Global Select Market
  "NAS", // NASDAQ
  "NGM", // NASDAQ Global Market
  "NCM", // NASDAQ Capital Market
  "NYS", // NYSE
  "NYQ", // NYSE
  "ASE", // NYSE American (AMEX)
]);

export async function GET(req: NextRequest) {
  const gate = checkPublicGetLimit("search", trustedClientIp(req), PUBLIC_LIMIT_DEFAULT);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }

  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, MAX_QUERY_LEN);
  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  try {
    // `validateResult: false` skips runtime schema validation. Yahoo's
    // search response started returning `typeDisp: "Equity"` (capitalized)
    // where yahoo-finance2's schema expects `"equity"`, which throws and
    // empties the results. The data itself is valid; only the schema is stale.
    const data = (await yahooFinance.search(
      q,
      {
        quotesCount: 12,
        newsCount: 0,
        enableFuzzyQuery: true,
      },
      { validateResult: false },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    )) as { quotes: Array<Record<string, any>> };

    const results = (data.quotes ?? [])
      .filter(
        (item) =>
          item?.isYahooFinance === true &&
          item?.quoteType === "EQUITY" &&
          typeof item?.exchange === "string" &&
          US_EXCHANGES.has(item.exchange),
      )
      .slice(0, 6)
      .map((item) => ({
        symbol: item.symbol as string,
        name: (item.shortname ?? item.longname ?? item.symbol) as string,
        exchange: (item.exchDisp ?? item.exchange) as string,
      }));

    return NextResponse.json({ results });
  } catch (err) {
    // Yahoo's search occasionally throws (schema drift, rate limits, transient
    // 5xx). We swallowed silently before and the UI showed a misleading "no
    // results" for every query — log loud so this never goes dark again.
    reportError("api/search", err, { query: q });
    return NextResponse.json({ results: [] });
  }
}
