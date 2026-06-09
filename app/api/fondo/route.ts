import { NextResponse } from "next/server";
import { getMetricsDb } from "@/lib/metrics";
import { getFundSnapshot } from "@/lib/fondo";

// Snapshot diario de BNG Selección Global (valor cuota, AUM y serie histórica).
// Sólo lectura. Mientras la tabla fund_nav esté vacía devuelve el estado
// 'pre-launch' con serie vacía — el frontend muestra "en proceso de lanzamiento".
export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getFundSnapshot(getMetricsDb());
  return NextResponse.json(snapshot, {
    // Cierre diario: cacheable unos minutos en el borde sin quedar viejo.
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}
