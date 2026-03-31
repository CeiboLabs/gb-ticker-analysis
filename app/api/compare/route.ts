import { NextRequest, NextResponse } from "next/server";
import { CompareRequestSchema } from "@/lib/validators";
import { fetchStockData } from "@/lib/fetchStockData";
import { cacheGet } from "@/lib/cache";
import { checkRateLimit } from "@/lib/rateLimiter";
import type { StockData } from "@/types/StockData";
import type { VerdictRating, VerdictConviction } from "@/types/Report";

export const runtime = "edge";
export const dynamic = "force-dynamic";

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

  const settled = await Promise.allSettled(tickers.map(fetchStockData));

  const successes: Array<{ ticker: string; stockData: StockData }> = [];
  const failures: string[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      successes.push({ ticker: tickers[i], stockData: result.value });
    } else {
      failures.push(tickers[i]);
    }
  });

  if (successes.length < 2) {
    const failedList = failures.length > 0 ? ` Tickers no encontrados: ${failures.join(", ")}.` : "";
    return NextResponse.json(
      { error: `Se necesitan al menos 2 tickers válidos.${failedList}` },
      { status: 404 }
    );
  }

  const results: CompareTickerResult[] = await Promise.all(
    successes.map(async ({ ticker, stockData }) => {
      const entry = await cacheGet(ticker);
      const verdict = entry
        ? { rating: entry.report.verdict.rating, conviction: entry.report.verdict.conviction }
        : null;
      return { ticker, stockData, verdict };
    })
  );

  return NextResponse.json({ results });
}
