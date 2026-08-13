import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getMetricsDb } from "@/lib/metrics";
import { readInformeRow, readInformeContenido } from "@/lib/informesStore";
import { getInforme } from "@/lib/informes";
import { getContenido } from "@/lib/informeContenido";
import { fmtPct } from "@/components/institucional/informe/formato";
import type { ContenidoInforme } from "@/lib/informeContenido/tipos";
import { reboteGetPublico } from "@/lib/rateLimiter";

// Tarjeta Open Graph de cada informe — lo que se despliega al compartir el link
// en WhatsApp/LinkedIn/X. Es la pieza que hace que "compartir la web" funcione:
// una tarjeta de marca (navy de la casa, titular en serif, movers en mono) en
// lugar de un link pelado. Se genera con next/og (Satori) leyendo el contenido
// de D1; force-dynamic porque depende del binding (en build no está). El PDF ya
// no es lo que circula: circula esta URL. Ver [[project_informes_pipeline]].

export const dynamic = "force-dynamic";
export const alt = "Informe de Bengochea & Cía. — research de mercado";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#0f2249";
const GOLD = "#EBD288";
const WHITE = "#FBFBFE";
const POS = "#7BC9A0"; // verde brillante (variante navy de colorDelta)
const NEG = "#E9999A"; // oxblood brillante
const MUTED = "rgba(255,255,255,0.60)";
const RULE = "rgba(255,255,255,0.18)";

// Los tres TTF se leían del disco EN CADA REQUEST. No cambian en la vida del
// proceso ⇒ se memoizan, cacheando sólo el resultado bueno para que un error de
// lectura no quede pegado hasta el próximo deploy.
let fuentesCache: Awaited<ReturnType<typeof leerFuentes>> | null = null;

async function leerFuentes() {
  const dir = join(process.cwd(), "assets", "fonts");
  const [serif, sans, mono] = await Promise.all([
    readFile(join(dir, "Newsreader-Medium.ttf")),
    readFile(join(dir, "IBMPlexSans-SemiBold.ttf")),
    readFile(join(dir, "IBMPlexMono-Medium.ttf")),
  ]);
  return [
    { name: "Newsreader", data: serif, style: "normal" as const, weight: 500 as const },
    { name: "Plex Sans", data: sans, style: "normal" as const, weight: 600 as const },
    { name: "Plex Mono", data: mono, style: "normal" as const, weight: 500 as const },
  ];
}

async function fuentes() {
  fuentesCache ??= await leerFuentes();
  return fuentesCache;
}

// Cada pedido re-renderiza con Satori y consulta D1. Con esta caché un mismo
// link reenviado no vuelve a generar la tarjeta, que es de lejos lo que más
// rinde acá: el reenvío es el caso normal de una tarjeta OG.
const OG_CACHE = "public, max-age=3600, s-maxage=86400";

async function cargar(slug: string) {
  let contenido: ContenidoInforme | null | undefined;
  let fechaTexto = "";
  try {
    const db = getMetricsDb();
    if (db) {
      const row = await readInformeRow(db, slug);
      if (row) {
        fechaTexto = row.fecha_texto;
        contenido = (await readInformeContenido(db, slug)) ?? getContenido(slug);
      }
    }
  } catch {
    /* sin binding o error de lectura: cae al seed de código */
  }
  if (!contenido) {
    contenido = getContenido(slug);
    fechaTexto = fechaTexto || getInforme(slug)?.fechaTexto || "";
  }
  const volanta = contenido?.volanta || "Research";
  return {
    titular: contenido?.titular || "Nuestra lectura de mercado.",
    kicker: [volanta, fechaTexto].filter(Boolean).join(" · ").toUpperCase(),
    movers: (contenido?.graficoSemana?.datos ?? []).slice(0, 4),
  };
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  // Techo GLOBAL, sin reparto por visitante, y no por elección: las rutas de
  // convención de archivo reciben `{ params }` y nunca el Request, así que acá
  // no hay headers de donde sacar la IP. Pasar `null` a propósito manda el
  // pedido al balde compartido del endpoint — el único límite posible en esta
  // ruta, y aun así mejor que el nada de antes. El reparto fino lo hace la
  // caché de arriba, que es lo que evita el 99% de las regeneraciones.
  const rebote = reboteGetPublico("og-informe", null);
  if (rebote) return rebote;

  const { slug } = await params;
  const [{ titular, kicker, movers }, fonts] = await Promise.all([cargar(slug), fuentes()]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: NAVY,
          padding: "68px 72px",
          fontFamily: "Plex Sans",
        }}
      >
        {/* Cabecera — wordmark + sello Research */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{ color: WHITE, fontSize: 30, fontWeight: 600, letterSpacing: 4 }}>BENGOCHEA</span>
            <span style={{ color: GOLD, fontSize: 30, fontWeight: 600, marginLeft: 12 }}>Inversiones</span>
          </div>
          <div style={{ display: "flex", color: GOLD, fontFamily: "Plex Mono", fontSize: 16, letterSpacing: 3 }}>RESEARCH</div>
        </div>

        {/* Cuerpo — kicker dorado + titular en serif */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", color: GOLD, fontFamily: "Plex Mono", fontSize: 20, letterSpacing: 3, marginBottom: 26 }}>{kicker}</div>
          <div style={{ display: "flex", color: WHITE, fontFamily: "Newsreader", fontSize: 68, lineHeight: 1.06, letterSpacing: -1, maxWidth: 1010 }}>{titular}</div>
        </div>

        {/* Pie — movers de la semana + dominio */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", height: 1, background: RULE, marginBottom: 22 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", fontFamily: "Plex Mono", fontSize: 20, minWidth: 0, overflow: "hidden" }}>
              {movers.map((m, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", marginRight: 26, flexShrink: 0 }}>
                  <span style={{ color: MUTED, marginRight: 8 }}>{m.etiqueta}</span>
                  <span style={{ color: m.valor >= 0 ? POS : NEG }}>{fmtPct(m.valor)}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", color: MUTED, fontFamily: "Plex Mono", fontSize: 18, letterSpacing: 1, flexShrink: 0, marginLeft: 24, whiteSpace: "nowrap" }}>gbengochea.com.uy</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts, headers: { "Cache-Control": OG_CACHE } },
  );
}
