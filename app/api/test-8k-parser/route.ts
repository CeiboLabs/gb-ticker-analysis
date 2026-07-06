import { NextRequest, NextResponse } from "next/server";
import { fetchEdgar8KIncomeStatement, debugEdgar8K } from "@/lib/fetchEdgar8K";
import { requireAdminToken } from "@/lib/adminAuth";
import { normalizeTicker } from "@/lib/validators";

export const dynamic = "force-dynamic";

// Lightweight endpoint used by scripts/analyze-sp500.ts to bulk-test the
// 8-K parser without pulling all the StockData / SegmentData / Yahoo work.
// Admin-only: one call fans out to ~30 SEC EDGAR requests and unauthenticated
// abuse would torch the public 10 req/s ceiling.
export async function GET(req: NextRequest) {
  const denied = await requireAdminToken(req);
  if (denied) return denied;

  const ticker = normalizeTicker(req.nextUrl.searchParams.get("ticker"));
  if (!ticker) return NextResponse.json({ error: "invalid ticker" }, { status: 400 });

  const [parsed, debug] = await Promise.all([
    fetchEdgar8KIncomeStatement(ticker).catch((e) => ({ error: String(e) })),
    debugEdgar8K(ticker).catch((e) => ({ error: String(e) })),
  ]);

  return NextResponse.json({ ticker, parsed, debug });
}
