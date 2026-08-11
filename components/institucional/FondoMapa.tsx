import { GDOTS, GMAP_W, GMAP_H, gproject } from "./worldDotsGlobal";
import { css } from "@/lib/css";

// Mapa editorial ESTÁTICO de alcance global: tierra firme punteada, hub en
// Montevideo y arcos finos hacia los principales centros financieros del mundo.
// Ilustra el alcance del fondo ("selección global, desde Uruguay"). No es una
// escena pinned — la pieza interactiva de la página es la balanza.

const MVD = gproject(-56.18, -34.9);

const DESTINOS: { city: string; to: [number, number]; label?: boolean }[] = [
  { city: "Nueva York", to: gproject(-74.01, 40.71), label: true },
  { city: "San Pablo", to: gproject(-46.63, -23.55) },
  { city: "Londres", to: gproject(-0.13, 51.51), label: true },
  { city: "Fráncfort", to: gproject(8.68, 50.11) },
  { city: "Hong Kong", to: gproject(114.17, 22.32), label: true },
  { city: "Tokio", to: gproject(139.69, 35.69) },
];

function arcPath([x0, y0]: [number, number], [x1, y1]: [number, number]) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const d = Math.hypot(dx, dy);
  let px = dy / d;
  let py = -dx / d;
  if (py > 0) { px = -px; py = -py; }
  const k = 0.2;
  return `M ${x0} ${y0} Q ${(x0 + x1) / 2 + px * d * k} ${(y0 + y1) / 2 + py * d * k} ${x1} ${y1}`;
}

export function FondoMapa() {
  return (
    <svg
      className="fmapa"
      viewBox={`0 0 ${GMAP_W} ${GMAP_H}`}
      role="img"
      aria-label="Mapa del mundo con Montevideo como centro y conexiones a los principales mercados globales"
    >
      <defs>
        <linearGradient id="fm-fh" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" />
          <stop offset="0.05" stopColor="#fff" />
          <stop offset="0.95" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <linearGradient id="fm-fv" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" />
          <stop offset="0.08" stopColor="#fff" />
          <stop offset="0.92" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id="fm-fadev"><rect width={GMAP_W} height={GMAP_H} fill="url(#fm-fv)" /></mask>
        <mask id="fm-fade">
          <g mask="url(#fm-fadev)"><rect width={GMAP_W} height={GMAP_H} fill="url(#fm-fh)" /></g>
        </mask>
      </defs>

      <g mask="url(#fm-fade)" fill="var(--navy-150)">
        {GDOTS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.9} />
        ))}
      </g>

      {/* arcos Montevideo → mundo */}
      {DESTINOS.map((d) => (
        <path key={d.city} d={arcPath(MVD, d.to)} fill="none" stroke="var(--gold-deep)" strokeWidth={1.2} strokeOpacity={0.6} strokeLinecap="round" />
      ))}
      {/* destinos */}
      {DESTINOS.map((d) => (
        <circle key={d.city} cx={d.to[0]} cy={d.to[1]} r={3.4} fill="var(--gold-deep)" />
      ))}
      {DESTINOS.filter((d) => d.label).map((d) => (
        <text key={d.city} x={d.to[0]} y={d.to[1] - 10} fill="var(--site-ink-3)" fontSize={12} fontWeight={600} letterSpacing="0.08em" textAnchor="middle">
          {d.city.toUpperCase()}
        </text>
      ))}

      {/* hub Montevideo */}
      <circle cx={MVD[0]} cy={MVD[1]} r={11} fill="none" stroke="var(--navy)" strokeWidth={1.4} />
      <circle cx={MVD[0]} cy={MVD[1]} r={4.5} fill="var(--gold-deep)" />
      <text x={MVD[0]} y={MVD[1] + 26} fill="var(--navy)" fontSize={13} fontWeight={700} letterSpacing="0.14em" textAnchor="middle">
        MONTEVIDEO
      </text>

      <style>{css`
        .fmapa { width: 100%; height: auto; display: block; }
      `}</style>
    </svg>
  );
}
