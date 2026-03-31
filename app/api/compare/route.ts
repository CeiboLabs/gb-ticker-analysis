import { NextRequest, NextResponse } from "next/server";
import { CompareRequestSchema } from "@/lib/validators";
import { fetchStockData } from "@/lib/fetchStockData";
import { cacheGet } from "@/lib/cache";
import { checkRateLimit } from "@/lib/rateLimiter";
import type { StockData } from "@/types/StockData";
import type { VerdictRating, VerdictConviction } from "@/types/Report";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface CompareTickerResult {
  ticker: string;
  stockData: StockData;
  verdict: { rating: VerdictRating; conviction: VerdictConviction } | null;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: `Límite de solicitudes alcanzado. Reintentá en ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  const parsed = CompareRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues;
    const msg = issues[0]?.message ?? "Solicitud inválida.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { tickers } = parsed.data;

  let stockDataResults: StockData[];
  try {
    stockDataResults = await Promise.all(tickers.map(fetchStockData));
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : "";
    if (message.includes("not found") || message.includes("no fundamentals") || message.includes("no data")) {
      return NextResponse.json({ error: "Uno o más tickers no encontrados." }, { status: 404 });
    }
    return NextResponse.json({ error: "Error al obtener datos de mercado." }, { status: 502 });
  }

  const results: CompareTickerResult[] = tickers.map((ticker, i) => {
    const entry = cacheGet(ticker);
    const verdict = entry
      ? { rating: entry.report.verdict.rating, conviction: entry.report.verdict.conviction }
      : null;
    return { ticker, stockData: stockDataResults[i], verdict };
  });

  return NextResponse.json({ results });
}
