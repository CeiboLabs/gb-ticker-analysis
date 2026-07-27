"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useFondo, fmtFechaCorta } from "@/lib/useFondo";
import type { HoldingItem } from "@/lib/fondo";

// Mayores tenencias del fondo — una vista a ancho completo con un control
// deslizante para alternar entre Treemap (bloques sólidos por clase) y Donut
// (torta llena con leyenda). Barra de split por clase de activo compartida y
// hover vinculado leyenda↔gráfico.
//
// Los datos salen del snapshot real (/api/fondo → fund_holdings), con el rezago
// de divulgación aplicado en el serving. En pre-lanzamiento —o mientras no haya
// un snapshot lo bastante viejo para divulgar— se muestra el estado vacío
// honesto. El color NO viaja en el dato: se deriva acá por clase + rank.

type Clase = "RV" | "RF" | "Otros";
type Cell = { name: string; short: string; clase: Clase; peso: number; color: string };

const CLASE_LABEL: Record<Clase, string> = { RV: "Renta variable", RF: "Renta fija", Otros: "Otros" };
const CLASE_COLOR: Record<Clase, string> = { RV: "#1a3163", RF: "#A07C28", Otros: "#9AA0B4" };
const CLASE_ORDER: Clase[] = ["RV", "RF", "Otros"];

// Rampa de sombra por clase: oscuro (mayor peso) → claro (menor), interpolada
// por rank dentro de la clase para soportar cualquier número de tenencias.
const CLASE_RAMP: Record<Clase, [string, string]> = {
  RV: ["#0f2249", "#5E63B8"],
  RF: ["#7C5E1A", "#D9BE6E"],
  Otros: ["#7E869C", "#B4BACA"],
};

const fmt = (n: number) => `${n.toFixed(0)}%`;
const byPeso = (a: Cell, b: Cell) => b.peso - a.peso;

function lerpHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// Mapea las tenencias del snapshot a celdas con color derivado. weightBps → %.
function buildCells(items: HoldingItem[]): Cell[] {
  const out: Cell[] = [];
  for (const clase of CLASE_ORDER) {
    const group = items
      .filter((it) => it.assetClass === clase)
      .sort((a, b) => b.weightBps - a.weightBps);
    const [dark, light] = CLASE_RAMP[clase];
    group.forEach((it, i) => {
      const t = group.length > 1 ? i / (group.length - 1) : 0;
      out.push({
        name: it.name,
        short: it.short ?? it.name,
        clase,
        peso: it.weightBps / 100,
        color: lerpHex(dark, light, t),
      });
    });
  }
  return out;
}

// ── Treemap squarificado ──────────────────────────────────────────────────
// Dos formas, una por viewport: un treemap ancho a 2.5:1 (desktop) deja las
// celdas ilegibles cuando el contenedor cae a ~340px, así que mobile usa una
// variante en retrato que le da a cada celda suficiente área para el texto.
// Cada layout se squarifica para SU forma; se alternan por media query (sin JS,
// sin saltos de hidratación). La tipografía escala con el tamaño real de la
// celda (unidades de container query), así el texto siempre entra.
const TM_WIDE = { w: 1040, h: 416 };
const TM_TALL = { w: 600, h: 680 };

type Rect = { x: number; y: number; w: number; h: number };
type Placed = Cell & { rect: Rect };

function squarify(items: Cell[], frame: Rect): Placed[] {
  const total = items.reduce((a, b) => a + b.peso, 0);
  if (total <= 0) return [];
  const scale = (frame.w * frame.h) / total;
  const scaled = items.map((it) => ({ ...it, area: it.peso * scale }));
  const out: Placed[] = [];
  const rect: Rect = { ...frame };
  let row: (Cell & { area: number })[] = [];

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

// Una rejilla de treemap. `scale` ≈ (ancho renderizado / ancho virtual) para
// estimar el tamaño físico de cada celda y decidir qué etiquetas mostrar; el
// tamaño de fuente exacto lo resuelve el navegador con cqw/cqh sobre el tamaño
// real, así que esto solo es el umbral de "cabe / no cabe".
function TreemapGrid({ placed, frame, variant, scale }: {
  placed: Placed[]; frame: { w: number; h: number }; variant: "wide" | "tall"; scale: number;
}) {
  return (
    <div className={`ten-tm ten-tm--${variant}`} style={{ aspectRatio: `${frame.w} / ${frame.h}` }}>
      {placed.map((p, i) => {
        const rw = p.rect.w * scale;
        const rh = p.rect.h * scale;
        const show = rw > 64 && rh > 40;
        const big = rw > 140 && rh > 88;
        // Fuente ligada al lado menor renderizado de la celda (en px, vía cqw/cqh),
        // con piso legible y techo editorial. Padding y gap derivan de ella.
        const fs = `clamp(9px, calc(min(${((p.rect.w / frame.w) * 100).toFixed(2)}cqw, ${((p.rect.h / frame.h) * 100).toFixed(2)}cqh) * 0.15), 17px)`;
        return (
          <div
            key={p.name}
            className="ten-tm-cell"
            style={{
              left: `${(p.rect.x / frame.w) * 100}%`,
              top: `${(p.rect.y / frame.h) * 100}%`,
              width: `${(p.rect.w / frame.w) * 100}%`,
              height: `${(p.rect.h / frame.h) * 100}%`,
              background: p.color,
              animationDelay: `${i * 38}ms`,
            }}
          >
            {show && (
              <div className="ten-tm-label" style={{ ["--fs"]: fs } as CSSProperties}>
                <span className="ten-tm-eyebrow">{big ? CLASE_LABEL[p.clase] : p.clase}</span>
                <span className="ten-tm-name">{p.short}</span>
                <span className="ten-tm-pct">{fmt(p.peso)}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Treemap({ placedWide, placedTall }: { placedWide: Placed[]; placedTall: Placed[] }) {
  return (
    <>
      <TreemapGrid placed={placedWide} frame={TM_WIDE} variant="wide" scale={1} />
      <TreemapGrid placed={placedTall} frame={TM_TALL} variant="tall" scale={0.58} />
    </>
  );
}

// ── Donut (torta llena) ───────────────────────────────────────────────────
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

function Pie({ sorted, total, hover, setHover }: {
  sorted: Cell[]; total: number; hover: string | null; setHover: (n: string | null) => void;
}) {
  const cx = 150, cy = 150, rO = 142, rI = 84;
  const GAP = 1.2;
  // Offset angular de cada wedge = suma de los spans anteriores. Se calcula de
  // forma funcional (sin mutar una variable durante el render, que prohíbe
  // react-hooks/immutability) para que el donut sea determinista entre renders.
  const spans = sorted.map((d) => (d.peso / total) * 360);
  const offsets = spans.map((_, i) => spans.slice(0, i).reduce((a, b) => a + b, 0));
  const wedges = sorted.map((d, i) => ({
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
                key={s.name}
                d={s.path}
                fill={s.color}
                data-on={hover === s.name ? "1" : "0"}
                onMouseEnter={() => setHover(s.name)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </g>
        </svg>
      </div>

      <ol className="ten-leg">
        {sorted.map((d, i) => (
          <li
            key={d.name}
            data-on={hover === d.name ? "1" : "0"}
            data-dim={hover && hover !== d.name ? "1" : "0"}
            onMouseEnter={() => setHover(d.name)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="ten-leg-rank">{String(i + 1).padStart(2, "0")}</span>
            <span className="ten-leg-dot" style={{ background: d.color }} />
            <span className="ten-leg-name">{d.name}</span>
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
  const state = useFondo();
  const holdings = state.kind === "ready" ? state.data.holdings : null;
  const [vista, setVista] = useState<Vista>("treemap");
  const [hover, setHover] = useState<string | null>(null);

  const cells = useMemo(() => (holdings ? buildCells(holdings.items) : []), [holdings]);
  const sorted = useMemo(() => [...cells].sort(byPeso), [cells]);
  const total = useMemo(() => sorted.reduce((a, b) => a + b.peso, 0), [sorted]);
  const claseTotals = useMemo(
    () =>
      CLASE_ORDER.map((c) => ({
        clase: c,
        peso: cells.filter((h) => h.clase === c).reduce((a, b) => a + b.peso, 0),
      })).filter((c) => c.peso > 0),
    [cells],
  );
  const placedWide = useMemo(() => squarify(sorted, { x: 0, y: 0, ...TM_WIDE }), [sorted]);
  const placedTall = useMemo(() => squarify(sorted, { x: 0, y: 0, ...TM_TALL }), [sorted]);

  const hasData = !!holdings && cells.length > 0 && total > 0;

  return (
    <div className="ten-wrap">
      <div className="ten-bar">
        <span className="ten-bar-label">Mayores tenencias</span>
        {hasData && (
          <div className="ten-toggle" data-active={vista} role="tablist" aria-label="Tipo de gráfico">
            <span className="ten-toggle-thumb" aria-hidden />
            <button role="tab" aria-selected={vista === "treemap"} className="ten-toggle-btn" onClick={() => setVista("treemap")}>Treemap</button>
            <button role="tab" aria-selected={vista === "pie"} className="ten-toggle-btn" onClick={() => setVista("pie")}>Donut</button>
          </div>
        )}
      </div>

      {hasData ? (
        <>
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
            {vista === "treemap" ? <Treemap placedWide={placedWide} placedTall={placedTall} /> : <Pie sorted={sorted} total={total} hover={hover} setHover={setHover} />}
          </div>

          <p className="ten-foot">
            Composición al {fmtFechaCorta(holdings!.asOf)}. Los pesos vigentes se informan en la ficha técnica
            mensual y pueden haber variado desde esa fecha.
          </p>
        </>
      ) : (
        <div className="ten-empty">
          <p className="ten-empty-title">
            {state.kind === "loading" ? "Cargando la composición de la cartera…" : "La composición de la cartera se publica próximamente."}
          </p>
          <p className="ten-empty-sub">
            Las tenencias se informan en la ficha técnica mensual y a través de un asesor nuestro.
          </p>
        </div>
      )}

      <style>{`
        .ten-wrap { margin-top: 60px; }

        /* ── Barra: título + toggle ── */
        .ten-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; min-height: 38px; }
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

        /* ── Estado vacío (pre-lanzamiento / sin snapshot divulgable) ── */
        .ten-empty {
          margin-top: 28px; border: 1px dashed var(--site-border); border-radius: 14px;
          padding: 48px 24px; text-align: center; background: var(--surface-muted, #f8f9fc);
        }
        .ten-empty-title { margin: 0; font-size: 17px; color: var(--site-ink-2); }
        .ten-empty-sub { margin: 8px 0 0; font-size: 13px; color: var(--site-ink-3); }

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
          container-type: size;
          position: relative; width: 100%;
          border-radius: 14px; overflow: hidden; background: var(--navy);
          box-shadow: 0 18px 50px -34px rgba(3,6,94,0.55);
        }
        .ten-tm--tall { display: none; }   /* mobile la enciende abajo */
        .ten-tm-cell {
          position: absolute; box-sizing: border-box;
          border: 1.5px solid rgba(255,255,255,0.10);
          display: flex; align-items: flex-start; overflow: hidden;
          transition: filter 160ms ease;
          animation: ten-pop 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes ten-pop { from { opacity: 0; transform: scale(0.965); } to { opacity: 1; transform: none; } }
        .ten-tm-cell:hover { filter: brightness(1.12); }
        .ten-tm-label {
          padding: calc(var(--fs) * 0.66) calc(var(--fs) * 0.62); color: #fff; line-height: 1.16;
          display: flex; flex-direction: column; gap: calc(var(--fs) * 0.18);
          max-width: 100%; box-sizing: border-box; min-width: 0;
        }
        .ten-tm-eyebrow {
          font-size: calc(var(--fs) * 0.6); font-weight: 700; letter-spacing: 0.13em; text-transform: uppercase;
          color: rgba(255,255,255,0.55); margin-bottom: 1px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
        }
        .ten-tm-name {
          font-size: var(--fs); font-weight: 600; letter-spacing: -0.01em;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
        }
        .ten-tm-pct { font-size: calc(var(--fs) * 0.82); font-variant-numeric: tabular-nums; opacity: 0.82; }

        /* ── Donut ── */
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
        /* En pantallas angostas el treemap ancho deja celdas ilegibles: cambiamos
           a la variante en retrato, squarificada para esa forma. */
        @media (max-width: 600px) {
          .ten-tm--wide { display: none; }
          .ten-tm--tall { display: block; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ten-stage, .ten-tm-cell, .ten-pie-svg path { animation: none; }
        }
      `}</style>
    </div>
  );
}
