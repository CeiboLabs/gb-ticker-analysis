"use client";

import { useState } from "react";
import { GDOTS, GMAP_W, GMAP_H } from "./worldDotsGlobal";
import { GDOTS_CC } from "./worldDotsCountries";

// Exposición geográfica del fondo — choropleth sobre el mapa de puntos del
// sitio: cada punto de tierra se tiñe con intensidad de navy según el peso de
// su región. Reusa GDOTS para mantener la estética del resto de la web.
//
// Los pesos son la ASIGNACIÓN OBJETIVO de la estrategia (dato del equipo,
// 3-ago-2026): son los que el mandato busca sostener, no una foto de la cartera
// a una fecha. Por eso el pie no lleva fecha de corte y el bloque no envejece
// — pero si el objetivo cambia, se cambia acá. Estuvo fuera de la página entre
// el 27-jul y el 3-ago-2026, cuando los pesos de acá abajo eran inventados.
//
// ⚠️ Las regiones NO son cajas de lat/lon, y por eso cada punto se clasifica por
// PAÍS (GDOTS_CC) y no por geometría: "Mercados Emergentes" y "Asia Desarrollada"
// son clasificaciones de mercado que cortan la geografía al través. México está
// en Norteamérica pero es emergente; Polonia y Grecia están en Europa pero son
// emergentes; Japón y China comparten continente y están en buckets distintos.
// Un clasificador por coordenadas pintaría el mapa desmintiendo la tabla.

type Region = { key: string; label: string; peso: number; sinMapa?: boolean };

// Asignación objetivo por región. Suma 100.
const REGIONES: Region[] = [
  { key: "NA", label: "Norteamérica",        peso: 46 },
  { key: "EM", label: "Mercados Emergentes", peso: 24 },
  { key: "EU", label: "Europa",              peso: 22 },
  { key: "AD", label: "Asia Desarrollada",   peso: 5 },
  // El efectivo no tiene geografía: va en la lista para que la suma cierre en
  // 100, pero no se pinta. Ver `sinMapa` en la leyenda y en el pie.
  { key: "OT", label: "Otros / Efectivo",    peso: 3, sinMapa: true },
];
const MAX_PESO = Math.max(...REGIONES.map((r) => r.peso));

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
function regionColor(peso: number): string {
  return navyAt(0.22 + 0.78 * (peso / MAX_PESO)); // 0.22 (tenue) → 1 (navy pleno)
}
// La tierra sin exposición sigue siendo navy, apenas insinuada: el mundo se
// reconoce igual, pero queda por debajo del escalón más bajo de la rampa (Asia
// Desarrollada, 5% → t≈0,30) sin que se puedan confundir.
const COLOR_SIN = navyAt(0.1);

const COLOR_BY_REGION: Record<string, string> = Object.fromEntries(
  REGIONES.map((r) => [r.key, regionColor(r.peso)]),
);

// Precómputo: clasifico cada punto por región y armo los <circle> UNA sola vez,
// agrupados por región. Rendimiento: el hover anima la opacidad de 5 grupos
// (no de ~1500 círculos) y los puntos llevan pointer-events:none, así moverse
// sobre el mapa no dispara hit-testing nodo por nodo. Los elementos son
// estables entre renders → React no los reconstruye al cambiar el hover.
const GROUP_CIRCLES: Record<string, ReturnType<typeof makeCircle>[]> = {};
function makeCircle(x: number, y: number, i: number) {
  return <circle key={i} cx={x} cy={y} r={2.6} />;
}
for (const r of REGIONES) GROUP_CIRCLES[r.key] = [];
GROUP_CIRCLES[SIN_EXPOSICION] = [];
GDOTS.forEach(([x, y], i) => {
  // Si worldDotsCountries quedara desalineado con GDOTS, el punto cae en "sin
  // exposición" y se ve: degrada a un mapa incompleto, no a una página en
  // blanco. La verificación dura la hace el generador, que aborta si upstream
  // cambió (scripts/gen-dotmap-countries.mjs).
  const reg = PAIS_A_REGION[GDOTS_CC[i]] ?? SIN_EXPOSICION;
  GROUP_CIRCLES[reg].push(makeCircle(x, y, i));
});

export function FondoGeografia() {
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div className="geo-wrap">
      <div className="geo-bar">
        <span className="geo-bar-label">Exposición geográfica</span>
        <span className="geo-bar-hint">Intensidad por asignación a cada región</span>
      </div>

      <div className="geo-stage">
        <div className="geo-map">
          <svg
            viewBox={`0 0 ${GMAP_W} ${GMAP_H}`}
            className="geo-svg"
            role="img"
            aria-label={`Mapa de asignación objetivo por región: ${REGIONES.map((r) => `${r.label} ${r.peso}%`).join(", ")}.`}
          >
            {/* Los países sin exposición van primero y no se apagan del todo al
                enfocar una región: sostienen la silueta del mundo. */}
            <g className="geo-grp" fill={COLOR_SIN} style={{ opacity: hover ? 0.5 : 1 }}>
              {GROUP_CIRCLES[SIN_EXPOSICION]}
            </g>
            {REGIONES.filter((r) => !r.sinMapa).map((r) => (
              <g
                key={r.key}
                className="geo-grp"
                fill={COLOR_BY_REGION[r.key]}
                style={{ opacity: hover && hover !== r.key ? 0.16 : 1 }}
              >
                {GROUP_CIRCLES[r.key]}
              </g>
            ))}
          </svg>
        </div>

        <ol className="geo-leg">
          {REGIONES.map((r, i) => (
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
                style={r.sinMapa ? undefined : { background: COLOR_BY_REGION[r.key] }}
              />
              <span className="geo-leg-name">{r.label}</span>
              <span className="geo-leg-bar"><span style={{ width: `${(r.peso / MAX_PESO) * 100}%`, background: COLOR_BY_REGION[r.key] }} /></span>
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

      <style>{`
        .geo-wrap { margin-top: 64px; }

        .geo-bar { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .geo-bar-label { font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--site-ink-3); }
        .geo-bar-hint { font-size: 12.5px; color: var(--site-ink-3); }

        .geo-stage {
          margin-top: 22px; display: grid; grid-template-columns: 1fr 320px; gap: 44px; align-items: center;
        }
        .geo-map { min-width: 0; }
        /* Aísla el paint del mapa: el repintado de los 2.5k puntos no invalida
           el resto de la página (sin tocar el tamaño, así no hay salto de layout). */
        .geo-svg { width: 100%; height: auto; display: block; contain: layout paint; }
        .geo-svg circle { pointer-events: none; }
        .geo-grp { transition: opacity 240ms ease; }
        @media (prefers-reduced-motion: reduce) { .geo-grp { transition: none; } }

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
        .geo-leg-bar span { display: block; height: 100%; border-radius: 999px; }
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
