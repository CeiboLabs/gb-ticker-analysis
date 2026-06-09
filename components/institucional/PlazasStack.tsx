"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";
import { PinnedSection, scrollWindow } from "@/components/scroll";
import { DOTS, MAP_W, MAP_H, project } from "./worldDots";

/* framer-motion no interpola custom properties → literales de globals.css */
const GOLD = "#A07C28"; /* var(--gold-deep) */
const NAVY = "#2C3194"; /* var(--navy-500) */

const MVD = project(-56.18, -34.9);

/* Mercados ILUSTRATIVOS bajo el titular "Algunos de los mercados en donde
   podemos invertir": claim de capacidad (acceso vía mercado internacional),
   no de membresía. Decisión del cliente 2026-06-07 con la evidencia de
   fuente a la vista — la web oficial solo afirma BVM; ver
   feedback_claims_verificables en memoria. */
type Plaza = {
  /** Ciudad en grande (protagonista). */
  city: string;
  /** Bolsa(s) de esa plaza, como etiqueta. */
  exch: string;
  /** Destino proyectado en el mapa. */
  to: [number, number];
  /** Dibuja arco MVD→destino. false = Montevideo: ES el hub, solo pulsa. */
  arc?: boolean;
};

const MERCADOS: Plaza[] = [
  { city: "Nueva York", exch: "NYSE · NASDAQ", to: project(-74.01, 40.71), arc: true },
  { city: "Londres", exch: "LSE", to: project(-0.13, 51.51), arc: true },
  { city: "Ámsterdam", exch: "Euronext", to: project(4.9, 52.37), arc: true },
  { city: "París", exch: "Euronext", to: project(2.35, 48.86), arc: true },
  { city: "San Pablo", exch: "B3", to: project(-46.63, -23.55), arc: true },
];

/* Reparte las plazas entre [0.12, 0.70] del progreso del pin: la última
   termina de entrar en ~0.80 y le quedan ~0.20 de pin para "respirar"
   antes de soltarse (si no, aparece justo al desclavarse y parece un bug). */
const FIRST = 0.12;
const LAST = 0.7;
const STEP = (LAST - FIRST) / Math.max(MERCADOS.length - 1, 1);

/** Ventana de scroll de cada plaza; `next` = inicio de la siguiente (decanta el foco). */
function ventana(i: number) {
  const start = FIRST + i * STEP;
  return {
    start,
    end: start + STEP * 0.7,
    next: i < MERCADOS.length - 1 ? FIRST + (i + 1) * STEP : 0.9,
  };
}

/** Cuadrática elevada MVD→destino, con la panza siempre hacia arriba. */
function arcPath([x0, y0]: [number, number], [x1, y1]: [number, number]) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const d = Math.hypot(dx, dy);
  let px = dy / d;
  let py = -dx / d;
  if (py > 0) {
    px = -px;
    py = -py;
  }
  const k = 0.22;
  return `M ${x0} ${y0} Q ${(x0 + x1) / 2 + px * d * k} ${(y0 + y1) / 2 + py * d * k} ${x1} ${y1}`;
}

/**
 * S6 — Mercados. Pinned: a la izquierda el titular ("De Montevideo a los
 * mercados del mundo" — capacidad ilustrativa, no membresía afirmada) y
 * las plazas apareciendo una a una; a la derecha un mapa
 * punteado donde cada plaza traza su arco desde Montevideo y enciende su
 * ciudad. La activa va en dorado y decanta a navy cuando el foco pasa a
 * la siguiente.
 */
export function PlazasStack() {
  return (
    <PinnedSection height={250} className="band">
      {(p) => <Inner p={p} />}
    </PinnedSection>
  );
}

function Inner({ p }: { p: MotionValue<number> }) {
  return (
    <div className="plz-stage">
      <div className="site-wrap plz-grid">
        <div className="plz-left">
          <h2 className="plz-head">De Montevideo a los mercados del mundo</h2>

          <div className="plz-list" role="list">
            {MERCADOS.map((pl, i) => (
              <Word key={pl.city} plaza={pl} p={p} {...ventana(i)} />
            ))}
          </div>

          <div className="plz-meta">
            <span>Una sola mesa · mercado local e internacional</span>
          </div>
        </div>

        <Mapa p={p} />
      </div>

      <style>{`
        .plz-stage { width: 100%; }
        .plz-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
          gap: clamp(24px, 4vw, 72px);
          align-items: center;
        }
        .plz-head {
          margin: 0;
          font-size: clamp(18px, min(1.6vw, 2.6vh), 24px);
          font-weight: 700;
          letter-spacing: 0.12em;
          line-height: 1.2;
          color: var(--site-ink-3);
          text-transform: uppercase;
        }
        .plz-list {
          margin-top: clamp(10px, 2vh, 26px);
          display: flex;
          flex-direction: column;
        }
        .plz-word {
          margin: 0;
          font-size: clamp(26px, min(3.6vw, 6.2vh), 64px);
          font-weight: 700;
          letter-spacing: -0.025em;
          line-height: 1.08;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .plz-city {
          font-size: clamp(10px, min(1vw, 1.6vh), 13px);
          font-weight: 600;
          letter-spacing: 0.14em;
          color: var(--site-ink-3);
          margin-left: clamp(10px, 1.2vw, 20px);
          vertical-align: super;
          text-transform: uppercase;
          opacity: 0.6;
          transition: opacity 260ms ease;
        }
        .plz-word:hover .plz-city { opacity: 1; }
        .plz-meta {
          margin-top: clamp(12px, 2.4vh, 28px);
          padding-top: clamp(10px, 1.6vh, 16px);
          border-top: 1px solid var(--rule);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--site-ink-3);
        }
        .plz-map {
          width: 100%;
          height: auto;
          max-height: 84vh;
          display: block;
        }
        @media (max-width: 860px) {
          .plz-grid { display: block; position: relative; }
          .plz-map {
            position: absolute;
            inset: 0;
            margin: auto;
            max-height: 100%;
            opacity: 0.3;
            z-index: 0;
            pointer-events: none;
          }
          .plz-left { position: relative; z-index: 1; text-align: center; }
          .plz-word { font-size: clamp(30px, 8.6vw, 56px); }
          .plz-city { display: none; }
        }
      `}</style>
    </div>
  );
}

/* ── Lista ─────────────────────────────────────────────────── */

function Word({
  plaza,
  p,
  start,
  end,
  next,
}: {
  plaza: Plaza;
  p: MotionValue<number>;
  start: number;
  end: number;
  next: number;
}) {
  const ow = scrollWindow(start, end, 0, 1);
  const yw = scrollWindow(start, end, 26, 0);
  const opacity = useTransform(p, ow.times, ow.values);
  const y = useTransform(p, yw.times, yw.values);
  /* Activa en dorado; decanta a navy cuando el foco pasa a la siguiente. */
  const cw = scrollWindow(next, Math.min(next + 0.06, 1), GOLD, NAVY);
  const color = useTransform(p, cw.times, cw.values);

  return (
    <motion.div className="plz-word" role="listitem" style={{ opacity, y, color }}>
      {plaza.city}
      <span className="plz-city">{plaza.exch}</span>
    </motion.div>
  );
}

/* ── Mapa ──────────────────────────────────────────────────── */

function Mapa({ p }: { p: MotionValue<number> }) {
  return (
    <svg
      className="plz-map"
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      aria-hidden
      focusable="false"
    >
      <defs>
        {/* Los continentes se cortan en seco en el recorte del viewBox
            (Sahara, Escandinavia): fade en los cuatro bordes, solo para los
            puntos. Dos masks anidados = producto de ambos gradientes. */}
        <linearGradient id="plz-fh" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" />
          <stop offset="0.07" stopColor="#fff" />
          <stop offset="0.93" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <linearGradient id="plz-fv" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" />
          <stop offset="0.07" stopColor="#fff" />
          <stop offset="0.93" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id="plz-fadev">
          <rect width={MAP_W} height={MAP_H} fill="url(#plz-fv)" />
        </mask>
        <mask id="plz-fade">
          <g mask="url(#plz-fadev)">
            <rect width={MAP_W} height={MAP_H} fill="url(#plz-fh)" />
          </g>
        </mask>
      </defs>

      <g mask="url(#plz-fade)" fill="var(--navy-150)">
        {DOTS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.1} />
        ))}
      </g>

      <Hub />

      {MERCADOS.map((pl, i) => {
        const v = ventana(i);
        return pl.arc ? (
          <Arco key={pl.city} to={pl.to} p={p} start={v.start} end={v.end} next={v.next} />
        ) : null;
      })}
      {MERCADOS.map((pl, i) => {
        const v = ventana(i);
        return <Destino key={pl.city} plaza={pl} p={p} start={v.start} end={v.end} />;
      })}
    </svg>
  );
}

function Hub() {
  return (
    <g>
      <circle cx={MVD[0]} cy={MVD[1]} r={13} fill="none" stroke="var(--navy)" strokeWidth={1.4} />
      <circle cx={MVD[0]} cy={MVD[1]} r={5} fill={GOLD} />
      <text
        x={MVD[0] + 24}
        y={MVD[1] + 6}
        fill="var(--site-ink-3)"
        fontSize={17}
        fontWeight={600}
        letterSpacing="0.14em"
      >
        MONTEVIDEO
      </text>
    </g>
  );
}

function Arco({
  to,
  p,
  start,
  end,
  next,
}: {
  to: [number, number];
  p: MotionValue<number>;
  start: number;
  end: number;
  next: number;
}) {
  const lw = scrollWindow(start, end, 0, 1);
  const pathLength = useTransform(p, lw.times, lw.values);
  /* Trazado pleno mientras está activa; decanta a constelación tenue. */
  const ow = scrollWindow(next, Math.min(next + 0.06, 1), 1, 0.4);
  const opacity = useTransform(p, ow.times, ow.values);
  return (
    <motion.path
      d={arcPath(MVD, to)}
      fill="none"
      stroke={GOLD}
      strokeWidth={1.6}
      strokeLinecap="round"
      style={{ pathLength, opacity }}
    />
  );
}

function Destino({
  plaza,
  p,
  start,
  end,
}: {
  plaza: Plaza;
  p: MotionValue<number>;
  start: number;
  end: number;
}) {
  /* Punto fijo solo para ciudades con arco (Montevideo es el hub).
     El pulso sonar corre para todas en su ventana. */
  const dw = scrollWindow(start + 0.02, end, 0, 1);
  const dotOpacity = useTransform(p, dw.times, dw.values);
  const haloR = useTransform(p, [0, start, end + 0.06, 1], [5, 5, 26, 26]);
  const haloOpacity = useTransform(
    p,
    [0, start, start + 0.03, end + 0.06, 1],
    [0, 0, 0.55, 0, 0],
  );
  return (
    <g>
      {plaza.arc && (
        <motion.circle cx={plaza.to[0]} cy={plaza.to[1]} r={5} fill={GOLD} style={{ opacity: dotOpacity }} />
      )}
      <motion.circle
        cx={plaza.to[0]}
        cy={plaza.to[1]}
        fill="none"
        stroke={GOLD}
        strokeWidth={1.3}
        style={{ r: haloR, opacity: haloOpacity }}
      />
    </g>
  );
}
