"use client";

import { useState } from "react";
import { GDOTS, GMAP_W, GMAP_H } from "./worldDotsGlobal";

// Exposición geográfica del fondo — choropleth sobre el mapa de puntos del
// sitio: cada punto de tierra se tiñe con intensidad de navy según el peso de
// su región. Reusa GDOTS/gproject para mantener la estética del resto de la web.
//
// ⚠️ DATOS ILUSTRATIVOS — el fondo está en pre-lanzamiento; los pesos reales se
// informan en la ficha mensual. No publicar en prod (ver "Claims verificables").

type Region = { key: string; label: string; peso: number };

// Exposición por región (ilustrativa). Suma 100.
const REGIONES: Region[] = [
  { key: "NA", label: "Norteamérica",  peso: 55 },
  { key: "EU", label: "Europa",        peso: 22 },
  { key: "AP", label: "Asia / Pacífico", peso: 13 },
  { key: "LA", label: "Latinoamérica", peso: 6 },
  { key: "OT", label: "Otros",         peso: 4 },
];
const MAX_PESO = Math.max(...REGIONES.map((r) => r.peso));

// Clasifica un punto (lon/lat) en una región. Límites gruesos: alcanza para un
// choropleth ilustrativo, no es un atlas.
function regionOf(lon: number, lat: number): string {
  if (lon >= -170 && lon <= -50 && lat >= 13) return "NA";       // Norteamérica
  if (lon >= -120 && lon <= -30 && lat < 13) return "LA";        // Latinoamérica
  if (lon >= -25 && lon <= 45 && lat >= 35) return "EU";         // Europa
  if (lon >= 60 && lat >= -50) return "AP";                      // Asia / Pacífico
  return "OT";                                                   // resto
}

// Intensidad de navy por peso: más peso = más oscuro.
function regionColor(peso: number): string {
  const t = 0.22 + 0.78 * (peso / MAX_PESO); // 0.22 (tenue) → 1 (navy pleno)
  const navy = [15, 34, 73];
  const r = Math.round(navy[0] + (255 - navy[0]) * (1 - t));
  const g = Math.round(navy[1] + (255 - navy[1]) * (1 - t));
  const b = Math.round(navy[2] + (255 - navy[2]) * (1 - t));
  return `rgb(${r}, ${g}, ${b})`;
}

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
GDOTS.forEach(([x, y], i) => {
  const lon = (x / GMAP_W) * 360 - 168;
  const lat = 74 - (y / GMAP_H) * 130;
  const reg = regionOf(lon, lat);
  GROUP_CIRCLES[reg].push(makeCircle(x, y, i));
});

export function FondoGeografia() {
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div className="geo-wrap">
      <div className="geo-bar">
        <span className="geo-bar-label">Exposición geográfica</span>
        <span className="geo-bar-hint">Intensidad por peso de cada región</span>
      </div>

      <div className="geo-stage">
        <div className="geo-map">
          <svg viewBox={`0 0 ${GMAP_W} ${GMAP_H}`} className="geo-svg" role="img" aria-label="Mapa de exposición geográfica">
            {REGIONES.map((r) => (
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
              onMouseEnter={() => setHover(r.key)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="geo-leg-rank">{String(i + 1).padStart(2, "0")}</span>
              <span className="geo-leg-dot" style={{ background: COLOR_BY_REGION[r.key] }} />
              <span className="geo-leg-name">{r.label}</span>
              <span className="geo-leg-bar"><span style={{ width: `${(r.peso / MAX_PESO) * 100}%`, background: COLOR_BY_REGION[r.key] }} /></span>
              <span className="geo-leg-pct">{r.peso}%</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="geo-foot">
        Datos ilustrativos — no es la cartera real del fondo. La distribución geográfica refleja la
        exposición de los fondos subyacentes y se informa en la ficha técnica mensual.
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
        }
        .geo-leg li[data-dim="1"] { opacity: 0.4; }
        .geo-leg li[data-on="1"] { background: var(--navy-050, #ECEDF6); }
        .geo-leg-rank { grid-area: rank; font-size: 11px; font-weight: 600; color: var(--site-ink-3); font-variant-numeric: tabular-nums; }
        .geo-leg-dot { grid-area: dot; width: 12px; height: 12px; border-radius: 3px; }
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
