import { NextRequest, NextResponse } from "next/server";
import { verdictHistory } from "@/lib/verdictHistory";
import { reboteGetPublico, trustedClientIp } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

/**
 * Historia de calificaciones de una acción. Lectura pública y barata: una sola
 * consulta indexada a verdict_log, sin upstreams y sin costo.
 *
 * GET porque es idempotente y cacheable por el navegador un rato — el archivo
 * sólo cambia cuando se genera un análisis nuevo del mismo ticker, lo que como
 * mucho pasa una vez por hora (cooldown de regeneración). Cinco minutos de
 * s-maxage evitan repegarle a la base en cada navegación entre acciones.
 */
export async function GET(req: NextRequest) {
  const rebote = reboteGetPublico("verdict-history", trustedClientIp(req));
  if (rebote) return rebote;
  const raw = new URL(req.url).searchParams.get("ticker") ?? "";
  const ticker = raw.trim().toUpperCase();

  // Mismo alfabeto que AnalyzeRequestSchema. Un ticker inválido no llega a la DB.
  if (!ticker || ticker.length > 12 || !/^[A-Z0-9.\-]+$/.test(ticker)) {
    return NextResponse.json({ error: "ticker inválido" }, { status: 400 });
  }

  const history = await verdictHistory(ticker);
  // Sin base o con error de lectura devolvemos una historia vacía, no un 500: el
  // informe se dibuja igual y el bloque simplemente no aparece.
  return NextResponse.json(history ?? { runs: [], previous: null, total: 0 }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
