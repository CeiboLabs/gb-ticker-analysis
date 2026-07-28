import { NextResponse } from "next/server";
import { getMetricsDb } from "@/lib/metrics";
import { getFundSnapshot } from "@/lib/fondo";

// Snapshot diario de BNG Selección Global (valor cuota, AUM y serie histórica).
// Sólo lectura. Mientras la tabla fund_nav esté vacía devuelve el estado
// 'pre-launch' con serie vacía — el frontend muestra "en proceso de lanzamiento".
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getFundSnapshot(getMetricsDb());
  return NextResponse.json(snapshot, {
    // Cierre diario: cacheable unos minutos en el borde (s-maxage) sin quedar
    // viejo. Pero el NAVEGADOR revalida siempre (max-age=0).
    //
    // Con max-age=300 el browser servía su copia hasta 5 minutos después de que
    // cambiaran los datos: se cargaba un valor cuota, se recargaba la página y
    // no se veía nada — indistinguible de un bug. Un cierre diario no justifica
    // que el dato tarde en aparecer; el s-maxage sigue absorbiendo la carga.
    headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" },
  });
}
