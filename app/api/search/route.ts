import { NextRequest, NextResponse } from "next/server";
import { yahooFinance } from "@/lib/fetchStockData";

export const runtime = "edge";

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
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const data = await yahooFinance.search(q, {
      quotesCount: 12,
      newsCount: 0,
      enableFuzzyQuery: true,
    });

    const results = data.quotes
      .filter(
        (item) =>
          "isYahooFinance" in item &&
          item.isYahooFinance &&
          "quoteType" in item &&
          item.quoteType === "EQUITY" &&
          US_EXCHANGES.has(item.exchange)
      )
      .slice(0, 6)
      .map((item) => ({
        symbol: item.symbol,
        name:
          ("shortname" in item ? item.shortname : undefined) ??
          ("longname" in item ? item.longname : undefined) ??
          item.symbol,
        exchange: ("exchDisp" in item ? item.exchDisp : undefined) ?? item.exchange,
        quoteType: "quoteType" in item ? item.quoteType : "EQUITY",
      }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
