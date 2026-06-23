"use client";

import { useState } from "react";

// Mayores tenencias del fondo — una vista a ancho completo con un control
// deslizante para alternar entre Treemap (bloques sólidos por clase) y Pie
// (torta llena con leyenda). Barra de split por clase de activo compartida y
// hover vinculado leyenda↔gráfico.
//
// ⚠️ DATOS ILUSTRATIVOS. El fondo está en pre-lanzamiento y los pesos reales
// se informan en la ficha mensual — por "Claims verificables" estas cifras NO
// pueden publicarse en prod. Vive en la rama WIP feat/institucional; antes de
// mergear hay que cablearlo a la fuente real (seam estilo fund_nav) con estado
// vacío hasta que llegue la cartera.

type Clase = "RV" | "RF" | "Otros";
type Tenencia = { nombre: string; corto: string; clase: Clase; peso: number; color: string };

// Colores por clase de activo, sobre la paleta de marca (navy = RV, gold = RF,
// neutro = otros). Dentro de cada clase, de más oscuro (mayor peso) a más claro.
const HOLDINGS: Tenencia[] = [
  { nombre: "iShares Core S&P 500 ETF",         corto: "S&P 500",     clase: "RV",    peso: 18, color: "#0f2249" },
  { nombre: "iShares Core U.S. Aggregate Bond", corto: "US Agg Bond", clase: "RF",    peso: 15, color: "#7C5E1A" },
  { nombre: "Vanguard FTSE Developed Markets",  corto: "Desarroll.",  clase: "RV",    peso: 12, color: "#1a3163" },
  { nombre: "PIMCO Income Fund",                corto: "PIMCO Inc.",  clase: "RF",    peso: 11, color: "#9A7724" },
  { nombre: "Vanguard Total Stock Market",      corto: "US Total",    clase: "RV",    peso: 10, color: "#2C3194" },
  { nombre: "Vanguard Total Intl Bond",         corto: "Intl Bond",   clase: "RF",    peso:  9, color: "#B8923A" },
  { nombre: "iShares MSCI Emerging Markets",    corto: "Emergentes",  clase: "RV",    peso:  8, color: "#4A4FA6" },
  { nombre: "iShares Global Corp Bond",         corto: "Corp Bond",   clase: "RF",    peso:  7, color: "#D2B463" },
  { nombre: "Otros fondos · liquidez",          corto: "Otros",       clase: "Otros", peso: 10, color: "#9AA0B4" },
];

const CLASE_LABEL: Record<Clase, string> = { RV: "Renta variable", RF: "Renta fija", Otros: "Otros" };
const CLASE_COLOR: Record<Clase, string> = { RV: "#1a3163", RF: "#A07C28", Otros: "#9AA0B4" };
const CLASE_ORDER: Clase[] = ["RV", "RF", "Otros"];

const fmt = (n: number) => `${n.toFixed(0)}%`;
const byPeso = (a: Tenencia, b: Tenencia) => b.peso - a.peso;
const SORTED = [...HOLDINGS].sort(byPeso);

const claseTotals = CLASE_ORDER.map((c) => ({
  clase: c,
  peso: HOLDINGS.filter((h) => h.clase === c).reduce((a, b) => a + b.peso, 0),
})).filter((c) => c.peso > 0);

// ── Treemap squarificado ──────────────────────────────────────────────────
const TM_W = 1040;
const TM_H = 416;

type Rect = { x: number; y: number; w: number; h: number };
type Placed = Tenencia & { rect: Rect };

function squarify(items: Tenencia[], frame: Rect): Placed[] {
  const total = items.reduce((a, b) => a + b.peso, 0);
  const scale = (frame.w * frame.h) / total;
  const scaled = items.map((it) => ({ ...it, area: it.peso * scale }));
  const out: Placed[] = [];
  const rect: Rect = { ...frame };
  let row: (Tenencia & { area: number })[] = [];

  const worst = (r: typeof row, side: number) => {
    const sum = r.reduce((a, b) => a + b.area, 0);
    const max = Math.max(...r.map((x) => x.area));
    const min = Math.min(...r.map((x) => x.area));
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };

  const layout = (r: typeof row, side: number) => {
    const sum = r.reduce((a, b) => a + b.area, 0);
    const thick = sum / side;
    if (rect.w <= rect.h) {
      let ox = rect.x;
      for (const it of r) {
        const len = it.area / thick;
        out.push({ ...it, rect: { x: ox, y: rect.y, w: len, h: thick } });
        ox += len;
      }
      rect.y += thick;
      rect.h -= thick;
    } else {
      let oy = rect.y;
      for (const it of r) {
        const len = it.area / thick;
        out.push({ ...it, rect: { x: rect.x, y: oy, w: thick, h: len } });
        oy += len;
      }
      rect.x += thick;
      rect.w -= thick;
    }
  };

  const queue = [...scaled];
  while (queue.length) {
    const side = Math.min(rect.w, rect.h);
    const next = queue[0];
    if (row.length === 0 || worst(row, side) >= worst([...row, next], side)) {
      row.push(next);
      queue.shift();
    } else {
      layout(row, side);
      row = [];
    }
  }
  if (row.length) layout(row, Math.min(rect.w, rect.h));
  return out;
}

const PLACED = squarify(SORTED, { x: 0, y: 0, w: TM_W, h: TM_H });

function Treemap() {
  return (
    <div className="ten-tm">
      {PLACED.map((p, i) => {
        const big = p.rect.w > 150 && p.rect.h > 92;
        const show = p.rect.w > 84 && p.rect.h > 50;
        return (
          <div
            key={p.nombre}
            className="ten-tm-cell"
            style={{
              left: `${(p.rect.x / TM_W) * 100}%`,
              top: `${(p.rect.y / TM_H) * 100}%`,
              width: `${(p.rect.w / TM_W) * 100}%`,
              height: `${(p.rect.h / TM_H) * 100}%`,
              background: p.color,
              animationDelay: `${i * 38}ms`,
            }}
          >
            {show && (
              <div className="ten-tm-label" data-size={big ? "big" : "mid"}>
                {big && <span className="ten-tm-eyebrow">{CLASE_LABEL[p.clase]}</span>}
                <span className="ten-tm-name">{p.corto}</span>
                <span className="ten-tm-pct">{fmt(p.peso)}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Pie (torta llena) ─────────────────────────────────────────────────────
// Math.cos/sin no están obligados por la spec de ECMAScript a dar el mismo bit
// en todas las implementaciones: Node (SSR) y el navegador pueden diferir en los
// últimos decimales y romper la hidratación. Cuantizamos a 3 decimales para que
// ambos lados serialicen el mismo string `d` (sub-píxel, visualmente idéntico).
const q = (n: number) => Math.round(n * 1000) / 1000;
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [q(cx + r * Math.cos(a)), q(cy + r * Math.sin(a))] as const;
};
function arcPath(cx: number, cy: number, rO: number, rI: number, start: number, end: number) {
  const [sx, sy] = polar(cx, cy, rO, start);
  const [ex, ey] = polar(cx, cy, rO, end);
  const [ix, iy] = polar(cx, cy, rI, end);
  const [jx, jy] = polar(cx, cy, rI, start);
  const large = end - start > 180 ? 1 : 0;
  return `M${sx} ${sy} A${rO} ${rO} 0 ${large} 1 ${ex} ${ey} L${ix} ${iy} A${rI} ${rI} 0 ${large} 0 ${jx} ${jy} Z`;
}

function Pie({ hover, setHover }: { hover: string | null; setHover: (n: string | null) => void }) {
  const total = SORTED.reduce((a, b) => a + b.peso, 0);
  const cx = 150, cy = 150, rO = 142, rI = 84;
  const GAP = 1.2;
  // Offset angular de cada wedge = suma de los spans anteriores. Se calcula de
  // forma funcional (sin mutar una variable durante el render, que prohíbe
  // react-hooks/immutability) para que el donut sea determinista entre renders.
  const spans = SORTED.map((d) => (d.peso / total) * 360);
  const offsets = spans.map((_, i) => spans.slice(0, i).reduce((a, b) => a + b, 0));
  const wedges = SORTED.map((d, i) => ({
    ...d,
    path: arcPath(cx, cy, rO, rI, offsets[i] + GAP / 2, offsets[i] + spans[i] - GAP / 2),
  }));

  return (
    <div className="ten-pie">
      <div className="ten-pie-chart">
        <svg viewBox="0 0 300 300" className="ten-pie-svg" role="img" aria-label="Composición de la cartera">
          <g data-dim={hover ? "1" : "0"}>
            {wedges.map((s) => (
              <path
                key={s.nombre}
                d={s.path}
                fill={s.color}
                data-on={hover === s.nombre ? "1" : "0"}
                onMouseEnter={() => setHover(s.nombre)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </g>
        </svg>
      </div>

      <ol className="ten-leg">
        {SORTED.map((d, i) => (
          <li
            key={d.nombre}
            data-on={hover === d.nombre ? "1" : "0"}
            data-dim={hover && hover !== d.nombre ? "1" : "0"}
            onMouseEnter={() => setHover(d.nombre)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="ten-leg-rank">{String(i + 1).padStart(2, "0")}</span>
            <span className="ten-leg-dot" style={{ background: d.color }} />
            <span className="ten-leg-name">{d.nombre}</span>
            <span className="ten-leg-class" data-c={d.clase}>{d.clase}</span>
            <span className="ten-leg-pct">{fmt(d.peso)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

type Vista = "treemap" | "pie";

export function FondoTenencias() {
  const [vista, setVista] = useState<Vista>("treemap");
  const [hover, setHover] = useState<string | null>(null);
  const total = HOLDINGS.reduce((a, b) => a + b.peso, 0);

  return (
    <div className="ten-wrap">
      <div className="ten-bar">
        <span className="ten-bar-label">Mayores tenencias</span>
        <div className="ten-toggle" data-active={vista} role="tablist" aria-label="Tipo de gráfico">
          <span className="ten-toggle-thumb" aria-hidden />
          <button role="tab" aria-selected={vista === "treemap"} className="ten-toggle-btn" onClick={() => setVista("treemap")}>Treemap</button>
          <button role="tab" aria-selected={vista === "pie"} className="ten-toggle-btn" onClick={() => setVista("pie")}>Donut</button>
        </div>
      </div>

      {/* Split por clase de activo — el dato que define a un balanceado. */}
      <div className="ten-split">
        <div className="ten-split-track">
          {claseTotals.map((c) => (
            <span
              key={c.clase}
              className="ten-split-seg"
              style={{ width: `${(c.peso / total) * 100}%`, background: CLASE_COLOR[c.clase] }}
            />
          ))}
        </div>
        <div className="ten-split-keys">
          {claseTotals.map((c) => (
            <span key={c.clase} className="ten-split-key">
              <span className="ten-split-dot" style={{ background: CLASE_COLOR[c.clase] }} />
              {CLASE_LABEL[c.clase]}
              <b>{fmt(c.peso)}</b>
            </span>
          ))}
        </div>
      </div>

      <div className="ten-stage" key={vista}>
        {vista === "treemap" ? <Treemap /> : <Pie hover={hover} setHover={setHover} />}
      </div>

      <p className="ten-foot">
        Datos ilustrativos — no es la cartera real del fondo. La composición vigente se informa en la
        ficha técnica mensual y a través de un asesor de la casa.
      </p>

      <style>{`
        .ten-wrap { margin-top: 60px; }

        /* ── Barra: título + toggle ── */
        .ten-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .ten-bar-label {
          font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--site-ink-3);
        }
        .ten-toggle {
          position: relative; display: inline-flex; padding: 3px;
          background: var(--surface-muted, #f3f4f8); border: 1px solid var(--site-border); border-radius: 999px;
        }
        .ten-toggle-thumb {
          position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc(50% - 3px);
          background: var(--navy); border-radius: 999px;
          box-shadow: 0 6px 16px -6px rgba(15,34,73,0.6);
          transition: transform 260ms cubic-bezier(0.34, 1.2, 0.4, 1);
        }
        .ten-toggle[data-active="pie"] .ten-toggle-thumb { transform: translateX(100%); }
        .ten-toggle-btn {
          position: relative; z-index: 1; border: 0; background: none; cursor: pointer;
          font-size: 13px; font-weight: 600; color: var(--site-ink-3);
          padding: 7px 24px; border-radius: 999px; transition: color 220ms ease; min-width: 100px;
        }
        .ten-toggle-btn[aria-selected="true"] { color: #fff; }
        .ten-toggle-btn:not([aria-selected="true"]):hover { color: var(--navy); }

        /* ── Split por clase de activo ── */
        .ten-split { margin-top: 26px; }
        .ten-split-track { display: flex; gap: 3px; height: 8px; border-radius: 999px; overflow: hidden; }
        .ten-split-seg { display: block; height: 100%; border-radius: 2px; }
        .ten-split-seg:first-child { border-radius: 999px 2px 2px 999px; }
        .ten-split-seg:last-child { border-radius: 2px 999px 999px 2px; }
        .ten-split-keys { display: flex; flex-wrap: wrap; gap: 22px; margin-top: 12px; }
        .ten-split-key { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--site-ink-2); }
        .ten-split-key b { color: var(--site-ink); font-weight: 600; font-variant-numeric: tabular-nums; }
        .ten-split-dot { width: 9px; height: 9px; border-radius: 999px; }

        /* ── Stage (flush, sin tarjeta) ── */
        .ten-stage { margin-top: 28px; animation: ten-fade 420ms ease both; }
        @keyframes ten-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

        /* ── Treemap ── */
        .ten-tm {
          position: relative; width: 100%; aspect-ratio: ${TM_W} / ${TM_H};
          border-radius: 14px; overflow: hidden; background: var(--navy);
          box-shadow: 0 18px 50px -34px rgba(3,6,94,0.55);
        }
        .ten-tm-cell {
          position: absolute; box-sizing: border-box;
          border: 1.5px solid rgba(255,255,255,0.10);
          display: flex; align-items: flex-start; overflow: hidden;
          transition: filter 160ms ease;
          animation: ten-pop 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes ten-pop { from { opacity: 0; transform: scale(0.965); } to { opacity: 1; transform: none; } }
        .ten-tm-cell:hover { filter: brightness(1.12); }
        .ten-tm-label { padding: 12px 14px; color: #fff; line-height: 1.16; display: flex; flex-direction: column; gap: 3px; }
        .ten-tm-eyebrow {
          font-size: 10px; font-weight: 700; letter-spacing: 0.13em; text-transform: uppercase;
          color: rgba(255,255,255,0.55); margin-bottom: 1px;
        }
        .ten-tm-name { font-weight: 600; letter-spacing: -0.01em; }
        .ten-tm-pct { font-variant-numeric: tabular-nums; opacity: 0.82; }
        .ten-tm-label[data-size="big"] .ten-tm-name { font-size: 18px; }
        .ten-tm-label[data-size="big"] .ten-tm-pct { font-size: 15px; }
        .ten-tm-label[data-size="mid"] .ten-tm-name { font-size: 13px; }
        .ten-tm-label[data-size="mid"] .ten-tm-pct { font-size: 12px; }

        /* ── Pie ── */
        .ten-pie { display: grid; grid-template-columns: auto 1fr; gap: 52px; align-items: center; padding: 6px; }
        .ten-pie-chart { display: flex; justify-content: center; }
        .ten-pie-svg { width: 300px; height: 300px; flex: none; }
        .ten-pie-svg path {
          stroke: #f6f7fb; stroke-width: 1.5; stroke-linejoin: round;
          transform-origin: 150px 150px; cursor: default;
          transition: opacity 220ms ease, transform 220ms ease;
          animation: ten-arc 480ms ease both;
        }
        @keyframes ten-arc { from { opacity: 0; } to { opacity: 1; } }
        .ten-pie-svg g[data-dim="1"] path { opacity: 0.3; }
        .ten-pie-svg g[data-dim="1"] path[data-on="1"] { opacity: 1; transform: scale(1.035); }

        /* ── Leyenda (compartida) ── */
        .ten-leg { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 0 34px; }
        .ten-leg li {
          display: grid; grid-template-columns: auto auto 1fr auto auto; align-items: center; gap: 11px;
          padding: 9px 8px; margin: 0 -8px; border-bottom: 1px solid var(--site-border); border-radius: 8px;
          font-size: 13px; color: var(--site-ink); transition: background 200ms ease, opacity 200ms ease;
          min-height: 42px;
        }
        .ten-leg li[data-dim="1"] { opacity: 0.4; }
        .ten-leg li[data-on="1"] { background: var(--navy-050, #ECEDF6); }
        .ten-leg-rank { font-size: 11px; font-weight: 600; color: var(--site-ink-3); font-variant-numeric: tabular-nums; letter-spacing: 0.04em; min-width: 16px; }
        .ten-leg-dot { width: 11px; height: 11px; border-radius: 3px; }
        .ten-leg-name { color: var(--site-ink-2); line-height: 1.3; }
        .ten-leg-class { font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 7px; border-radius: 5px; line-height: 1; }
        .ten-leg-class[data-c="RV"] { color: #1a3163; background: rgba(26,49,99,0.10); }
        .ten-leg-class[data-c="RF"] { color: #8A6A1E; background: rgba(160,124,40,0.12); }
        .ten-leg-class[data-c="Otros"] { color: #5b6172; background: rgba(154,160,180,0.18); }
        .ten-leg-pct { font-variant-numeric: tabular-nums; font-weight: 600; min-width: 34px; text-align: right; }

        .ten-foot { margin: 24px 0 0; font-size: 12.5px; line-height: 1.6; color: var(--site-ink-3); max-width: 60em; }

        @media (max-width: 920px) {
          .ten-pie { grid-template-columns: 1fr; gap: 30px; justify-items: center; }
          .ten-leg { width: 100%; grid-template-columns: 1fr; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ten-stage, .ten-tm-cell, .ten-pie-svg path { animation: none; }
        }
      `}</style>
    </div>
  );
}
