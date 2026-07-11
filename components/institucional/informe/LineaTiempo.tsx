import type { LineaSerie } from "@/lib/informeContenido/tipos";
import { fmtNum } from "./formato";

// Gráfico de línea / serie temporal, recreado on-brand como SVG server-side
// PURO — sin lightweight-charts ni JS de cliente (a diferencia del FondoChart
// interactivo). "Los datos aparecen en estado final" (lenguaje-visual §4):
// hairlines, ejes en mono tabular, línea primaria navy y secundaria en navy-300.
// Recrea los dos gráficos de la página 1 del semanal (evolución del dólar; UI vs
// USD base=100). Las etiquetas de eje van en HTML (no en <text>) para no encoger
// con el escalado del SVG. Estilos .inf-serie centralizados en ArticuloInforme.

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];

// Sistema de coordenadas interno; el SVG se estira al ancho del contenedor.
const W = 640;
const H = 300;
const PAD = { t: 14, r: 14, b: 30, l: 46 };

const ts = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime();

function fmtMes(t: number): string {
  const d = new Date(t);
  return `${MESES[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`;
}

/** Ticks "lindos" de valor: pasos 1/2/2.5/5 · 10^k, ~5 divisiones. Devuelve el
 *  dominio redondeado [lo..hi] para que la grilla cierre contra los bordes. */
function ticksValor(min: number, max: number, aprox = 5): number[] {
  const span = max - min || Math.abs(max) || 1;
  const crudo = span / aprox;
  const mag = Math.pow(10, Math.floor(Math.log10(crudo)));
  const norm = crudo / mag;
  const paso = (norm >= 5 ? 5 : norm >= 2.5 ? 2.5 : norm >= 2 ? 2 : 1) * mag;
  const lo = Math.floor(min / paso) * paso;
  const hi = Math.ceil(max / paso) * paso;
  const out: number[] = [];
  for (let v = lo; v <= hi + paso / 2; v += paso) out.push(Number(v.toFixed(6)));
  return out;
}

/** Ticks de mes (primero de cada k meses) para el eje temporal, ~7 marcas. */
function ticksMes(tMin: number, tMax: number, aprox = 7): number[] {
  const a = new Date(tMin);
  const b = new Date(tMax);
  const meses = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  const paso = Math.max(1, Math.ceil(meses / aprox));
  let y = a.getUTCFullYear();
  let m = a.getUTCMonth();
  if (a.getUTCDate() > 1) {
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }
  const out: number[] = [];
  for (;;) {
    const t = Date.UTC(y, m, 1);
    if (t > tMax) break;
    if (t >= tMin) out.push(t);
    m += paso;
    while (m > 11) { m -= 12; y += 1; }
  }
  return out;
}

export function LineaTiempo({
  titulo,
  subtitulo,
  lineas,
  nota,
}: {
  titulo?: string;
  subtitulo?: string;
  lineas: LineaSerie[];
  nota?: string;
}) {
  const series = lineas
    .map((l) => ({
      nombre: l.nombre,
      kind: l.enfasis === "secundaria" ? "sec" : "prim",
      pts: [...l.puntos].filter((p) => Number.isFinite(p.v)).sort((a, b) => ts(a.t) - ts(b.t)),
    }))
    .filter((l) => l.pts.length > 0);
  if (series.length === 0) return null;

  const allT = series.flatMap((s) => s.pts.map((p) => ts(p.t)));
  const allV = series.flatMap((s) => s.pts.map((p) => p.v));
  const tMin = Math.min(...allT);
  const tMax = Math.max(...allT);
  const vTicks = ticksValor(Math.min(...allV), Math.max(...allV));
  const vLo = vTicks[0];
  const vHi = vTicks[vTicks.length - 1];
  const paso = vTicks.length > 1 ? vTicks[1] - vTicks[0] : 1;
  const dec = Number.isInteger(paso) ? 0 : paso >= 1 ? 1 : 2;

  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const px = (t: number) => PAD.l + (tMax === tMin ? 0 : (t - tMin) / (tMax - tMin)) * plotW;
  const py = (v: number) => PAD.t + (vHi === vLo ? 0.5 : 1 - (v - vLo) / (vHi - vLo)) * plotH;
  const fx = (t: number) => (px(t) / W) * 100;
  const fy = (v: number) => (py(v) / H) * 100;

  const xTicks = ticksMes(tMin, tMax);
  // Dibujar las secundarias primero (quedan debajo); la primaria encima.
  const dibujo = [...series].sort((a, b) => (a.kind === "sec" ? 0 : 1) - (b.kind === "sec" ? 0 : 1));

  return (
    <figure className="inf-serie inf-data">
      {titulo && <figcaption className="inf-datacap">{titulo}</figcaption>}
      {subtitulo && <div className="inf-serie-sub">{subtitulo}</div>}
      {series.length > 1 && (
        <div className="inf-serie-legend">
          {series.map((s) => (
            <span className="inf-serie-leg" key={s.nombre}>
              <span className="inf-serie-leg-line" data-kind={s.kind} />
              {s.nombre}
            </span>
          ))}
        </div>
      )}
      <div className="inf-serie-plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="inf-serie-svg" aria-hidden="true">
          {vTicks.map((v) => (
            <line key={v} x1={PAD.l} x2={W - PAD.r} y1={py(v)} y2={py(v)} className="inf-serie-grid" />
          ))}
          {dibujo.map((s) => (
            <path
              key={s.nombre}
              className="inf-serie-line"
              data-kind={s.kind}
              d={s.pts
                .map((p, i) => `${i === 0 ? "M" : "L"}${px(ts(p.t)).toFixed(1)} ${py(p.v).toFixed(1)}`)
                .join(" ")}
            />
          ))}
        </svg>
        {vTicks.map((v) => (
          <span key={v} className="inf-serie-ylab" style={{ top: `${fy(v)}%` }}>
            {fmtNum(v, dec)}
          </span>
        ))}
        {xTicks.map((t) => (
          <span key={t} className="inf-serie-xlab" style={{ left: `${fx(t)}%` }}>
            {fmtMes(t)}
          </span>
        ))}
      </div>
      {nota && <p className="inf-datanota">{nota}</p>}
    </figure>
  );
}
