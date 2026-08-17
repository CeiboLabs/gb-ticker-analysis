"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GDOTS, GMAP_W, GMAP_H } from "./worldDotsGlobal";
import { GDOTS_CC } from "./worldDotsCountries";
import { css } from "@/lib/css";
import { useFondo } from "@/lib/useFondo";
import { GEO_BASELINE, GEO_REGIONES, geoOrdenado, type GeoKey, type GeoTarget } from "@/lib/fondoGeo";

// Exposición geográfica del fondo — choropleth sobre el mapa de puntos del
// sitio: cada punto de tierra se tiñe con intensidad de navy según el peso de
// su región. Reusa GDOTS para mantener la estética del resto de la web.
//
// ── POR QUÉ CANVAS Y NO SVG ───────────────────────────────────────────────
// Hasta el 5-ago-2026 esto eran 2.554 elementos <circle> en el DOM. Medido
// (docs/rendimiento-fondo.md §3): 117 KB del HTML —el 31% del documento—, 2.554
// nodos para hidratar, y cada recálculo de estilo COMPLETO de la página pasaba
// de 9,9 ms a 31,2 ms por tenerlos ahí (3,2×). Sacarlos dio −132 ms de LCP y
// −68 ms de TBT en un teléfono a 4G.
//
// O sea: la misma conclusión a la que ya había llegado <FondoMundo />, que
// dibuja este mismo mapa de puntos en el Resumen y cuyo comentario dice
// "Canvas (no SVG) por costo de pintado". Este bloque tomaba la decisión
// contraria sobre el mismo dibujo, y a mayor escala.
//
// Lo que se pierde: con JS apagado el mapa no se dibuja. Es aceptable y ya era
// el trato de FondoMundo — el dato entero (las cinco regiones con su peso) vive
// en la leyenda <ol> de al lado, que es HTML, y en el aria-label. El mapa
// ilustra la leyenda, no al revés.
//
// Los pesos son la ASIGNACIÓN OBJETIVO de la estrategia: son los que el mandato
// busca sostener, no una foto de la cartera a una fecha. Por eso el pie no lleva
// fecha de corte y el bloque no envejece. Estuvo fuera de la página entre el
// 27-jul y el 3-ago-2026, cuando los pesos eran inventados.
//
// ── DE DÓNDE SALEN LOS PESOS (cambió el 16-ago-2026) ──────────────────────────
// Ya no son una constante de este archivo: los carga el panel de empleados
// (/admin/fondo → Geografía) y viajan en el snapshot de /api/fondo, junto a las
// tenencias. Lo que SIGUE en código es la taxonomía —qué regiones existen y qué
// país cae en cuál—, porque agregar una región exige clasificar países y eso no
// es cargar un número. El reparto exacto está en lib/fondoGeo.ts.
//
// Mientras no haya dato cargado (o si la lectura falla) se usa GEO_BASELINE, que
// es el mismo 46/24/22/5/3 que estaba acá hasta ahora. Y es además el estado
// INICIAL del render: así el caso normal —nadie cambió nada— pinta idéntico a
// como pintaba cuando esto era una constante, sin transición ni estado de carga.
//
// ⚠️ Las regiones NO son cajas de lat/lon, y por eso cada punto se clasifica por
// PAÍS (GDOTS_CC) y no por geometría: "Mercados Emergentes" y "Asia Desarrollada"
// son clasificaciones de mercado que cortan la geografía al través. México está
// en Norteamérica pero es emergente; Polonia y Grecia están en Europa pero son
// emergentes; Japón y China comparten continente y están en buckets distintos.
// Un clasificador por coordenadas pintaría el mapa desmintiendo la tabla.

// País → región de inversión. Clasificación estándar de mercados (MSCI):
// desarrollados vs emergentes, que es la que usa el propio mandato.
//
// Lo que queda FUERA de la tabla no se pinta: no es un olvido, es que la
// estrategia no tiene exposición ahí (Rusia, África subsahariana, Asia Central,
// Argentina) o el mercado es frontera (Islandia, Vietnam). Se dibujan igual, en
// el navy más tenue, para que el mundo siga siendo reconocible.
const PAIS_A_REGION: Record<string, string> = {};
const asignar = (region: string, paises: string[]) => {
  for (const p of paises) PAIS_A_REGION[p] = region;
};

asignar("NA", ["USA", "CAN"]);
// México NO va acá: geográficamente es Norteamérica, pero es mercado emergente.

asignar("EU", [
  // Europa desarrollada.
  "AUT", "BEL", "CHE", "DEU", "DNK", "ESP", "FIN", "FRA",
  "GBR", "IRL", "ITA", "LUX", "NLD", "NOR", "PRT", "SWE",
]);
// Israel es mercado desarrollado y MSCI lo agrupa con Europa, pero pintarlo bajo
// un rótulo que dice "Europa" en un MAPA se lee como un error. Pesa ~0,2% de un
// índice global: queda sin pintar. Groenlandia y la Guayana Francesa tampoco se
// pintan — son territorios de países desarrollados, no mercados.

asignar("AD", ["JPN", "AUS", "NZL", "SGP", "HKG"]);
// Singapur y Hong Kong no tienen ningún punto a esta resolución de grilla;
// quedan en la tabla igual, para que la clasificación esté completa.

asignar("EM", [
  // Américas.
  "BRA", "CHL", "COL", "MEX", "PER",
  // Europa emergente, Medio Oriente y África.
  "CZE", "EGY", "GRC", "HUN", "KWT", "POL", "QAT", "SAU", "TUR", "ARE", "ZAF",
  // Asia emergente. Corea del Sur es emergente para MSCI (para FTSE es
  // desarrollada): se sigue MSCI, que es el criterio del resto de la tabla.
  "CHN", "IDN", "IND", "KOR", "MYS", "PHL", "THA", "TWN",
]);

const SIN_EXPOSICION = "—";

// Intensidad de navy por peso: más peso = más oscuro. Un solo tono, sin segundo
// color — es la regla de los dot-maps del sitio (docs/lenguaje-visual.md).
const NAVY = [15, 34, 73];
function navyAt(t: number): string {
  const [r, g, b] = NAVY.map((v) => Math.round(v + (255 - v) * (1 - t)));
  return `rgb(${r}, ${g}, ${b})`;
}
// POSICIÓN en la rampa, no el color ya resuelto. Devolver el número es lo que
// permite INTERPOLAR cuando los pesos cambian: el reveal de una región que pasó
// de 5% a 20% es un tween sobre este escalar, no un salto entre dos strings rgb.
function tonoDe(peso: number, maxPeso: number): number {
  return 0.22 + 0.78 * (peso / Math.max(1, maxPeso)); // 0.22 (tenue) → 1 (navy pleno)
}
// La tierra sin exposición sigue siendo navy, apenas insinuada: el mundo se
// reconoce igual, pero queda por debajo del escalón más bajo de la rampa (Asia
// Desarrollada, 5% → t≈0,30) sin que se puedan confundir.
const TONO_SIN = 0.1;

/** Todo lo que se deriva de los pesos, calculado de una sola vez por objetivo. */
function derivar(target: GeoTarget) {
  const maxPeso = Math.max(...GEO_REGIONES.map((r) => target[r.key]));
  const colores = Object.fromEntries(
    GEO_REGIONES.map((r) => [r.key, navyAt(tonoDe(target[r.key], maxPeso))]),
  ) as Record<GeoKey, string>;
  return { maxPeso, colores, orden: geoOrdenado(target) };
}

// Precómputo: clasifico cada punto por región UNA sola vez y guardo las
// coordenadas planas (x0,y0,x1,y1,…) por grupo. Float32Array porque es lo que se
// recorre en cada redibujado y no cambia nunca.
//
// El orden de los grupos ES el orden de dibujado: "sin exposición" primero
// (queda abajo y sostiene la silueta del mundo), después las regiones.
// El grupo YA NO LLEVA SU COLOR. La geometría (qué puntos son de qué región) es
// taxonomía y no cambia nunca — se precomputa una vez y se queda; el color sale
// de los pesos, que ahora son dato y se mueven. Separarlos es lo que permite
// tener este precómputo caro a nivel de módulo y aun así repintar con pesos
// nuevos sin rehacerlo.
type Grupo = { key: string; pts: Float32Array };

const GRUPOS: Grupo[] = (() => {
  const acc: Record<string, number[]> = { [SIN_EXPOSICION]: [] };
  for (const r of GEO_REGIONES) acc[r.key] = [];
  GDOTS.forEach(([x, y], i) => {
    // Si worldDotsCountries quedara desalineado con GDOTS, el punto cae en "sin
    // exposición" y se ve: degrada a un mapa incompleto, no a una página en
    // blanco. La verificación dura la hace el generador, que aborta si upstream
    // cambió (scripts/gen-dotmap-countries.mjs).
    const reg = PAIS_A_REGION[GDOTS_CC[i]] ?? SIN_EXPOSICION;
    acc[reg].push(x, y);
  });
  return [
    { key: SIN_EXPOSICION, pts: new Float32Array(acc[SIN_EXPOSICION]) },
    ...GEO_REGIONES.filter((r) => !r.sinMapa).map((r) => ({
      key: r.key as string,
      pts: new Float32Array(acc[r.key]),
    })),
  ];
})();

/** Posición en la rampa de cada grupo, EN EL ORDEN DE GRUPOS (lo que anima el rAF). */
function tonosDe(target: GeoTarget): number[] {
  const maxPeso = Math.max(...GEO_REGIONES.map((r) => target[r.key]));
  return GRUPOS.map((g) =>
    g.key === SIN_EXPOSICION ? TONO_SIN : tonoDe(target[g.key as GeoKey], maxPeso),
  );
}

const RADIO = 2.6;          // en unidades del mapa (el r de los <circle> de antes)
const DUR = 240;            // ms — el mismo que tenía la transition del CSS
const ease = (t: number) => 1 - (1 - t) * (1 - t);

/** Opacidad de cada grupo según qué región está enfocada. Espeja exactamente lo
 *  que hacían los `style={{ opacity }}` de los <g>. */
function alfaDe(g: Grupo, hover: string | null): number {
  if (g.key === SIN_EXPOSICION) return hover ? 0.5 : 1;
  return hover && hover !== g.key ? 0.16 : 1;
}

export function FondoGeografia() {
  const [hover, setHover] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Los pesos publicados. Mientras el fetch no resuelva —y si nunca se cargó
  // nada, o si la lectura falló— vale la línea de base del deploy, que es
  // exactamente lo que este bloque mostraba cuando los pesos eran una constante.
  // O sea: sin estado de carga y sin agujero; a lo sumo una transición si el
  // dato publicado difiere de la base.
  //
  // No agrega un pedido de red: useFondo cachea la promesa a nivel de módulo y
  // la página ya la pide para la ficha, el gráfico y las tenencias.
  const fondo = useFondo();
  const target: GeoTarget = fondo.kind === "ready" && fondo.data.geo ? fondo.data.geo : GEO_BASELINE;

  const { colores, orden, maxPeso } = useMemo(() => derivar(target), [target]);
  const tonoObjetivo = useMemo(() => tonosDe(target), [target]);

  // Opacidad VIGENTE de cada grupo. Vive en un ref y no en estado: la anima un
  // rAF a 60 fps y pasarla por React sería un render por frame.
  const alfas = useRef<number[]>(GRUPOS.map((g) => alfaDe(g, null)));
  // Ídem para la posición en la rampa de color. Arranca en la línea de base por
  // la misma razón que `target`: que el primer frame sea el de siempre.
  const tonos = useRef<number[]>(tonosDe(GEO_BASELINE));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;

    const pintar = () => {
      // Resolución del respaldo = tamaño en pantalla × DPR (topeado en 2, como
      // FondoMundo). El ALTO sale de la proporción del mapa, no de una medida
      // del DOM: así el canvas no puede quedar de otra forma que 1100×397 y no
      // hay salto de layout posible.
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const ancho = Math.max(1, Math.round(canvas.clientWidth));
      const w = Math.round(ancho * dpr);
      const h = Math.round((w * GMAP_H) / GMAP_W);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const s = w / GMAP_W;                    // px de respaldo por unidad de mapa
      const r = Math.max(0.5, RADIO * s);
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < GRUPOS.length; i++) {
        const g = GRUPOS[i];
        const a = alfas.current[i];
        if (a <= 0.001) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = navyAt(tonos.current[i]);
        // UN solo path por grupo y un solo fill: 2.554 arcos en ~1 ms. Dibujar
        // cada punto con su propio beginPath/fill cuesta un orden más.
        ctx.beginPath();
        const p = g.pts;
        for (let k = 0; k < p.length; k += 2) {
          const x = p[k] * s, y = p[k + 1] * s;
          ctx.moveTo(x + r, y);               // sin esto los arcos se encadenan
          ctx.arc(x, y, r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    // Dos transiciones sobre el MISMO rAF, porque duran lo mismo y se pintan en
    // el mismo frame: la opacidad al enfocar una región (reemplaza a la
    // `transition: opacity 240ms` que tenían los <g>) y el color cuando llegan
    // pesos distintos a los que se está mostrando.
    //
    // La segunda no es un adorno: la línea de base viaja en el deploy y queda
    // vieja apenas se publica otra asignación, así que hasta el próximo build
    // ESE cambio ocurre en cada carga de la página. Sin tween sería un salto de
    // color en un frame, todas las veces.
    //
    // Con reduce-motion las dos saltan al estado final, igual que hacía el media
    // query.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const desdeA = alfas.current.slice();
    const desdeT = tonos.current.slice();
    const hastaA = GRUPOS.map((g) => alfaDe(g, hover));
    const hastaT = tonoObjetivo;
    const quieto =
      desdeA.every((v, i) => Math.abs(v - hastaA[i]) < 0.001) &&
      desdeT.every((v, i) => Math.abs(v - hastaT[i]) < 0.001);
    if (reduce || quieto) {
      alfas.current = hastaA;
      tonos.current = hastaT;
      pintar();
    } else {
      const t0 = performance.now();
      const paso = (t: number) => {
        const k = Math.min(1, (t - t0) / DUR);
        const e = ease(k);
        alfas.current = desdeA.map((v, i) => v + (hastaA[i] - v) * e);
        tonos.current = desdeT.map((v, i) => v + (hastaT[i] - v) * e);
        pintar();
        raf = k < 1 ? requestAnimationFrame(paso) : 0;
      };
      raf = requestAnimationFrame(paso);
    }

    // Redibujar al cambiar de ancho (o de pantalla, que cambia el DPR).
    const ro = new ResizeObserver(() => pintar());
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [hover, tonoObjetivo]);

  return (
    <div className="geo-wrap">
      <div className="geo-bar">
        <span className="geo-bar-label">Exposición geográfica</span>
        <span className="geo-bar-hint">Intensidad por asignación a cada región</span>
      </div>

      <div className="geo-stage">
        <div className="geo-map">
          {/* width/height son la PROPORCIÓN del mapa y ya vienen en el HTML del
              server: con `height: auto` el navegador reserva la caja exacta
              antes de que corra un solo byte de JS. El efecto los reescribe a
              la resolución del dispositivo, que es la misma proporción — así el
              canvas no puede provocar un salto de layout. */}
          <canvas
            ref={canvasRef}
            width={GMAP_W}
            height={GMAP_H}
            className="geo-canvas"
            role="img"
            aria-label={`Mapa de asignación objetivo por región: ${orden.map((r) => `${r.label} ${r.peso}%`).join(", ")}.`}
          />
        </div>

        {/* Ordenada por peso (con Otros / Efectivo siempre al final): el rank
            01..05 que numera las filas se leería como un error si no siguiera a
            los números. Lo resuelve geoOrdenado, en lib/fondoGeo.ts. */}
        <ol className="geo-leg">
          {orden.map((r, i) => (
            <li
              key={r.key}
              data-on={hover === r.key ? "1" : "0"}
              data-dim={hover && hover !== r.key ? "1" : "0"}
              // Mouse y touch se atienden por separado a propósito. Al tocar,
              // Chrome emula un mouseenter ANTES del click: con un solo handler
              // el enter prendía la región y el click —viéndola prendida— la
              // apagaba en el mismo toque, así que el primer tap no hacía nada.
              // Filtrando por pointerType cada gesto tiene su camino.
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse") setHover(r.sinMapa ? null : r.key);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === "mouse") setHover(null);
              }}
              // En mobile no hay hover, y sin él Mercados Emergentes (24%) y
              // Europa (22%) son el MISMO tono: aislar por toque es la única
              // manera de ver dónde termina uno y empieza el otro.
              onPointerUp={(e) => {
                if (e.pointerType === "mouse") return;
                setHover((h) => (r.sinMapa ? null : h === r.key ? null : r.key));
              }}
            >
              <span className="geo-leg-rank">{String(i + 1).padStart(2, "0")}</span>
              {/* El cuadrito es la CLAVE DEL MAPA y la barra es la magnitud: por
                  eso Otros / Efectivo lleva el cuadrito hueco (no está en el
                  mapa) pero la barra llena (el peso sí es real). */}
              <span
                className="geo-leg-dot"
                data-nomap={r.sinMapa ? "1" : "0"}
                style={r.sinMapa ? undefined : { background: colores[r.key] }}
              />
              <span className="geo-leg-name">{r.label}</span>
              <span className="geo-leg-bar"><span style={{ width: `${(r.peso / maxPeso) * 100}%`, background: colores[r.key] }} /></span>
              <span className="geo-leg-pct">{r.peso}%</span>
            </li>
          ))}
        </ol>
      </div>

      {/* ⚠️ NO PROMETER "ficha técnica mensual" acá. Esa cadencia se sacó a
          propósito de la nota de <FondoTenencias />: el Reglamento no la obliga
          —el literal (t) manda estado de cuenta SEMESTRAL (junio y diciembre)
          más información permanente en las oficinas de la Administradora—, así
          que comprometerla en una nota al pie es asumir por escrito una
          obligación que el contrato no tiene. Este pie decía justamente eso y se
          corrigió en la revisión legal del 3-ago-2026. */}
      {/* ⚠️ ABRE CON EL ALCANCE DEL DATO (pedido del usuario, 3-ago-2026), y acá
          hace más trabajo que en Tenencias: lo que se dibuja es la asignación
          OBJETIVO —lo que el mandato busca sostener—, no la cartera a una fecha,
          y el mapa además pinta PAÍSES enteros con el color de su región, que es
          una aproximación por partida doble. Decirlo primero evita que alguien
          lea "Norteamérica 46%" como una tenencia medida.

          "A título ilustrativo" NO quiere decir inventado: los pesos son dato
          del equipo (3-ago-2026). Cuando eran inventados el bloque estuvo FUERA
          de la página (27-jul → 3-ago), que es lo que corresponde: una nota al
          pie no habilita a publicar números que no existen. */}
      <p className="geo-foot">
        Datos aproximados, a título ilustrativo. Asignación objetivo de la estrategia — la
        exposición efectiva varía con el mercado, y la vigente te la informa un asesor. La
        intensidad corresponde al peso de la región y no al de cada país; el tono más tenue
        marca los países sin exposición directa, y Otros / Efectivo no se representa en el mapa.
      </p>

      <style>{css`
        .geo-wrap { margin-top: 64px; }

        .geo-bar { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .geo-bar-label { font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--site-ink-3); }
        .geo-bar-hint { font-size: 12.5px; color: var(--site-ink-3); }

        .geo-stage {
          margin-top: 22px; display: grid; grid-template-columns: 1fr 320px; gap: 44px; align-items: center;
        }
        .geo-map { min-width: 0; }
        /* height:auto sobre los atributos width/height del canvas: la caja
           sale de la proporción del mapa y queda reservada desde el HTML.
           (Sin acentos graves en estos comentarios: cierran el template literal
           de estilos y dejan la página en 500. Ver page.tsx.)
           El redibujado no puede invalidar nada de afuera (contain: paint), y no
           se toca el tamaño, así que no hay salto de layout.
           La opacidad por región ya no es una transition de CSS: la anima el
           propio redibujado (ver alfaDe/DUR arriba), que es lo que permite tener
           un solo nodo en vez de 2.554. */
        .geo-canvas { width: 100%; height: auto; display: block; contain: paint; pointer-events: none; }

        .geo-leg { list-style: none; margin: 0; padding: 0; }
        .geo-leg li {
          display: grid; grid-template-columns: auto auto 1fr auto;
          grid-template-areas: "rank dot name pct" "rank dot bar pct";
          column-gap: 12px; row-gap: 7px;
          align-items: center; padding: 13px 10px; margin: 0 -10px;
          border-bottom: 1px solid var(--site-border); border-radius: 10px;
          transition: background 200ms ease, opacity 200ms ease; cursor: default;
          -webkit-tap-highlight-color: transparent;
        }
        /* Las filas que están en el mapa se pueden tocar para aislarlas. */
        .geo-leg li:has(.geo-leg-dot[data-nomap="0"]) { cursor: pointer; }
        .geo-leg li[data-dim="1"] { opacity: 0.4; }
        .geo-leg li[data-on="1"] { background: var(--navy-050, #ECEDF6); }
        .geo-leg-rank { grid-area: rank; font-size: 11px; font-weight: 600; color: var(--site-ink-3); font-variant-numeric: tabular-nums; }
        .geo-leg-dot { grid-area: dot; width: 12px; height: 12px; border-radius: 3px; }
        /* Hueco = no está en el mapa. Contorno, no un segundo tono. */
        .geo-leg-dot[data-nomap="1"] { background: transparent; box-shadow: inset 0 0 0 1px var(--site-ink-3); }
        .geo-leg-name { grid-area: name; font-size: 14px; color: var(--site-ink); font-weight: 500; }
        .geo-leg-bar { grid-area: bar; align-self: center; height: 6px; border-radius: 999px; background: var(--site-border); overflow: hidden; }
        /* Los pesos son dato y pueden cambiar bajo los pies del render (llegan
           con /api/fondo, despues de la linea de base del deploy). La barra
           acompana al tween del mapa en vez de saltar; 240ms es el mismo DUR. */
        .geo-leg-bar span { display: block; height: 100%; border-radius: 999px; transition: width 240ms ease, background-color 240ms ease; }
        @media (prefers-reduced-motion: reduce) {
          .geo-leg-bar span { transition: none; }
        }
        .geo-leg-pct {
          grid-area: pct; justify-self: end; padding-left: 14px;
          font-size: 16px; font-weight: 600; color: var(--site-ink); font-variant-numeric: tabular-nums;
        }

        .geo-foot { margin: 24px 0 0; font-size: 12.5px; line-height: 1.6; color: var(--site-ink-3); max-width: 60em; }

        @media (max-width: 920px) {
          .geo-stage { grid-template-columns: 1fr; gap: 28px; }
        }
      `}</style>
    </div>
  );
}
