import { NextResponse } from "next/server";
import { getMetricsDb } from "@/lib/metrics";
import { getUltimoInforme, type UltimoInforme } from "@/lib/ultimoInforme";
import { reboteGetPublico, trustedClientIp } from "@/lib/rateLimiter";

// Último informe publicado, para el destacado de "Research" del navbar. Sólo
// lectura y sin nada que no sea ya público: es la fila que encabeza /informes.
//
// Va por API —y no como prop desde el layout— por dos razones: el Navbar vive en
// el layout compartido de (institucional), así que un `await` ahí volvería
// dinámicas TODAS las páginas del grupo; y en `next build` no hay bindings, con
// lo cual un render estático hornearía el seed y el destacado nunca se
// actualizaría al publicar desde el panel.
export const dynamic = "force-dynamic";

export type UltimoInformePayload = { informe: UltimoInforme | null };

export async function GET(req: Request) {
  const rebote = reboteGetPublico("informe-ultimo", trustedClientIp(req));
  if (rebote) return rebote;
  const informe = await getUltimoInforme(getMetricsDb());
  return NextResponse.json({ informe } satisfies UltimoInformePayload, {
    // Publicar desde el panel se ve en el navbar dentro del minuto; mientras
    // tanto no hay una request por navegación.
    headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
  });
}
