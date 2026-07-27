import { NextRequest, NextResponse } from "next/server";
import { yahooFinance } from "@/lib/fetchStockData";
import { getTopTickers } from "@/lib/tickerStats";
import { POPULAR_FALLBACK as FALLBACK } from "@/lib/popularFallback";
import { checkPublicGetLimit, trustedClientIp, PUBLIC_LIMIT_DEFAULT } from "@/lib/rateLimiter";
import { reportError } from "@/lib/errorReporter";
import { createTtlMemo } from "@/lib/memoTtl";

const DEFAULT_LIMIT = 8;
const LOOKBACK_DAYS = 7;

type PopularQuote = {
  symbol: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  currency: string | null;
  views: number | null;
};

// La landing se carga antes de casi cada análisis (para llegar a ?ticker= se
// pasa por acá), así que esta ruta corre muchas más veces de las que parece y
// cada corrida es una llamada a Yahoo. 60 s en memoria del proceso — la misma
// frescura que ya declaraba el s-maxage, ahora efectiva también sin CDN adelante.
// Contrapartida asumida: un análisis nuevo tarda hasta un minuto en mover el
// ranking, que es exactamente lo que el header venía prometiendo.
const POPULAR_TTL_MS = 60_000;
const popularMemo = createTtlMemo<PopularQuote[]>(POPULAR_TTL_MS, 8);

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

  const quotes = await popularMemo(String(limit), async () => {
    // 1. Get top tracked tickers (may be empty on a fresh datacenter). Guardamos
    // el conteo de consultas por símbolo — es la razón real de por qué lidera el
    // ranking (lo muestra la tarjeta destacada), no una causa inferida del precio.
    const top = await getTopTickers(limit, LOOKBACK_DAYS).catch(() => []);
    const tracked = top.map((t) => t.symbol);
    const viewsBySymbol = new Map(top.map((t) => [t.symbol, t.count]));

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

    return symbols
      .map((sym) => {
        const q = bySymbol.get(sym);
        if (!q) return null;
        return {
          symbol: sym,
          name: q.longName ?? q.shortName ?? sym,
          price: q.regularMarketPrice ?? null,
          changePercent: q.regularMarketChangePercent ?? null,
          currency: q.currency ?? null,
          // consultas en la ventana (null = no trackeado, es relleno curado): la
          // tarjeta sólo afirma demanda cuando este número es real.
          views: viewsBySymbol.get(sym) ?? null,
        };
      })
      .filter((q): q is PopularQuote => q !== null);
  });

  return NextResponse.json(
    { quotes },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
