import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { getMetricsDb } from "@/lib/metrics";
import { reboteGetPublico, trustedClientIp } from "@/lib/rateLimiter";

// Tarjeta Open Graph POR ACCIÓN — lo que se despliega al pegar el link de un
// informe en WhatsApp o LinkedIn.
//
// POR QUÉ IMPORTA MÁS DE LO QUE PARECE: en gestión de patrimonios la referencia
// es el canal que más convierte, lejos. Esta herramienta fabrica gratis
// documentos que dan ganas de reenviar ("mirá lo que dice de Apple"), y cada
// reenvío es una presentación tibia de la casa. Hasta ahora ese link salía pelado
// —sin acción, sin veredicto, sin marca—, y un link pelado no se comparte igual.
//
// POR QUÉ UNA RUTA Y NO app/.../opengraph-image.tsx: el informe vive en
// /analisis?ticker=X, o sea una sola ruta con query, y la convención de archivo de
// Next no recibe searchParams. Con una ruta propia la metadata puede apuntar a
// /api/og/analisis?ticker=X y cada acción tiene su tarjeta.
//
// El VEREDICTO sale de verdict_log si existe; si no, la tarjeta sale igual con la
// identidad de la acción. Nunca se inventa una calificación para llenar el hueco.

export const dynamic = "force-dynamic";

const NAVY = "#0f2249";
const GOLD = "#EBD288";
const WHITE = "#FBFBFE";
const MUTED = "rgba(255,255,255,0.60)";
const RULE = "rgba(255,255,255,0.18)";

// Colores del rating en su variante para fondo navy (las mismas que usa la
// tarjeta de los informes para los movers).
const TONO: Record<string, string> = {
  BUY: "#7BC9A0",
  HOLD: "rgba(255,255,255,0.85)",
  AVOID: "#E9999A",
};

// Los TTF se leían del disco EN CADA REQUEST. No cambian nunca en la vida del
// proceso, así que se memoizan; sólo se cachea el resultado bueno, para que un
// error de lectura no quede pegado hasta el próximo deploy.
let fuentesCache: Awaited<ReturnType<typeof leerFuentes>> | null = null;

async function leerFuentes() {
  const dir = join(process.cwd(), "assets", "fonts");
  const [sans, mono] = await Promise.all([
    readFile(join(dir, "IBMPlexSans-SemiBold.ttf")),
    readFile(join(dir, "IBMPlexMono-Medium.ttf")),
  ]);
  return [
    { name: "Plex Sans", data: sans, style: "normal" as const, weight: 600 as const },
    { name: "Plex Mono", data: mono, style: "normal" as const, weight: 500 as const },
  ];
}

async function fuentes() {
  fuentesCache ??= await leerFuentes();
  return fuentesCache;
}

// La tarjeta se re-renderiza con Satori en cada pedido, y encima lee fuentes y
// consulta D1: es el multiplicador de CPU más alto del sitio. Con la caché de
// abajo un mismo link reenviado no la vuelve a generar, y el gate es el techo
// para el que pide tickers distintos en loop. 1500/h por IP no lo roza ningún
// crawler honesto — WhatsApp, LinkedIn y Facebook piden la tarjeta una vez.
const OG_CACHE = "public, max-age=3600, s-maxage=86400";

export async function GET(req: NextRequest) {
  const rebote = reboteGetPublico("og-analisis", trustedClientIp(req));
  if (rebote) return rebote;

  const raw = new URL(req.url).searchParams.get("ticker") ?? "";
  const ticker = raw.trim().toUpperCase();
  const valido = /^[A-Z0-9.\-]{1,12}$/.test(ticker);

  let empresa: string | null = null;
  let rating: string | null = null;
  let precio: number | null = null;

  if (valido) {
    try {
      const db = getMetricsDb();
      if (db) {
        const r = await db
          .prepare(
            "SELECT company_name, rating, price_at_verdict FROM verdict_log " +
            "WHERE ticker = ? ORDER BY ts DESC LIMIT 1",
          )
          .bind(ticker)
          .first<{ company_name: string | null; rating: string; price_at_verdict: number | null }>();
        if (r) {
          empresa = r.company_name;
          rating = r.rating;
          precio = r.price_at_verdict;
        }
      }
    } catch {
      // sin veredicto la tarjeta sale con la identidad de la acción y nada más
    }
  }

  const fonts = await fuentes();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          background: NAVY, color: WHITE, padding: "64px 72px", fontFamily: "Plex Sans",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 22, letterSpacing: "0.16em", color: MUTED, fontFamily: "Plex Mono" }}>
            BENGOCHEA · RESEARCH
          </div>
          <div style={{ fontSize: 20, color: MUTED, fontFamily: "Plex Mono" }}>EQUITY RESEARCH</div>
        </div>

        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 104, lineHeight: 1, letterSpacing: "-0.02em", fontFamily: "Plex Mono" }}>
            {valido ? ticker : "ANÁLISIS"}
          </div>
          {empresa && (
            <div style={{ fontSize: 34, color: MUTED, marginTop: 18, maxWidth: 900, lineHeight: 1.2 }}>
              {empresa.length > 58 ? `${empresa.slice(0, 58)}…` : empresa}
            </div>
          )}
          {!empresa && (
            <div style={{ fontSize: 34, color: MUTED, marginTop: 18, maxWidth: 900, lineHeight: 1.25 }}>
              Veredicto, métricas, flujo de resultados, escenarios y riesgos.
            </div>
          )}
        </div>

        <div style={{ display: "flex", borderTop: `1px solid ${RULE}`, paddingTop: 26, gap: 56 }}>
          {rating && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 18, letterSpacing: "0.14em", color: MUTED, fontFamily: "Plex Mono" }}>
                VEREDICTO
              </div>
              <div style={{ fontSize: 44, marginTop: 8, fontFamily: "Plex Mono", color: TONO[rating] ?? WHITE }}>
                {rating}
              </div>
            </div>
          )}
          {precio != null && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 18, letterSpacing: "0.14em", color: MUTED, fontFamily: "Plex Mono" }}>
                PRECIO AL VEREDICTO
              </div>
              {/* Un solo nodo de texto, no "USD " + número: Satori exige
                  display:flex explícito en cualquier div con más de un hijo, y
                  dos nodos de texto ya cuentan como dos hijos. El error que tira
                  es un 500 al pipear la imagen, no un warning. */}
              <div style={{ fontSize: 44, marginTop: 8, fontFamily: "Plex Mono" }}>
                {`USD ${precio.toFixed(2)}`}
              </div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", marginLeft: "auto", alignItems: "flex-end" }}>
            <div style={{ fontSize: 18, letterSpacing: "0.14em", color: GOLD, fontFamily: "Plex Mono" }}>
              SOCIEDAD DE BOLSA
            </div>
            <div style={{ fontSize: 26, marginTop: 8, color: MUTED }}>Montevideo · desde 1967</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts, headers: { "Cache-Control": OG_CACHE } },
  );
}
