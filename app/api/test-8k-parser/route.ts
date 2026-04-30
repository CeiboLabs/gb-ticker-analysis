import { NextRequest, NextResponse } from "next/server";
import { fetchEdgar8KIncomeStatement, debugEdgar8K } from "@/lib/fetchEdgar8K";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// Lightweight endpoint used by scripts/analyze-sp500.ts to bulk-test the
// 8-K parser without pulling all the StockData / SegmentData / Yahoo work.
export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase() ?? "";
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const [parsed, debug] = await Promise.all([
    fetchEdgar8KIncomeStatement(ticker).catch((e) => ({ error: String(e) })),
    debugEdgar8K(ticker).catch((e) => ({ error: String(e) })),
  ]);

  return NextResponse.json({ ticker, parsed, debug });
}
