import { NextRequest, NextResponse } from "next/server";
import { yahooFinance } from "@/lib/fetchStockData";
import { getTrendReason } from "@/lib/trendReason";
import { getTopTickers } from "@/lib/tickerStats";
import { POPULAR_FALLBACK } from "@/lib/popularFallback";
import { normalizeTicker } from "@/lib/validators";
import { checkPublicGetLimit, trustedClientIp, PUBLIC_LIMIT_DEFAULT } from "@/lib/rateLimiter";

// El "porqué" del ticker destacado en Tendencias (/analisis). Va en su propia
// ruta y no dentro de /api/popular a propósito: la lista tiene que pintar YA
// (una sola llamada batch a Yahoo), mientras esto puede tardar lo que tarde
// prensa + modelo. La tarjeta se dibuja completa y el motivo entra después.
//
// Gasto acotado por dos vías: (1) cache diario en D1 dentro de getTrendReason,
// (2) el gate de abajo — sólo se genera para símbolos que REALMENTE están en el
// ranking o en el set curado. Sin eso, /api/trend-reason?ticker=<cualquiera>
// sería un generador de texto gratis a nuestra cuenta.

const RANKING_LOOKBACK_DAYS = 7;
const RANKING_DEPTH = 8;

export async function GET(req: NextRequest) {
  const gate = checkPublicGetLimit("trend-reason", trustedClientIp(req), PUBLIC_LIMIT_DEFAULT);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }

  const ticker = normalizeTicker(req.nextUrl.searchParams.get("ticker"));
  if (!ticker) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }

  const top = await getTopTickers(RANKING_DEPTH, RANKING_LOOKBACK_DAYS).catch(() => []);
  const allowed = new Set<string>([...top.map((t) => t.symbol), ...POPULAR_FALLBACK]);
  if (!allowed.has(ticker)) {
    // Fuera de la sección: se responde vacío, no se gasta una generación.
    return NextResponse.json(
      { reason: null },
      { headers: { "Cache-Control": "public, s-maxage=3600" } },
    );
  }

  const reason = await getTrendReason(ticker, async () => {
    const q = (await yahooFinance
      .quote(ticker, {}, { validateResult: false })
      .catch(() => null)) as { longName?: string; shortName?: string } | null;
    return q?.longName ?? q?.shortName ?? ticker;
  }).catch(() => null);

  return NextResponse.json(
    { reason },
    {
      // max-age corta el pedido en el propio navegador (una recarga o una vuelta
      // a la landing dentro de los 10' no vuelve a salir); s-maxage hace lo mismo
      // en cualquier cache compartida. Ambos por debajo del día que dura el
      // cache en D1, así el motivo puede refrescarse si cambia el líder.
      headers: {
        "Cache-Control": "public, max-age=600, s-maxage=1800, stale-while-revalidate=3600",
      },
    },
  );
}
