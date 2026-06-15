"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { FONDO } from "@/lib/fondo";

// Header del fondo: la escena-firma se arma EN SU COLUMNA. Las 9 piezas
// asimétricas asientan con un desplazamiento breve hacia adentro y una leve
// inclinación 3D — un gesto sobrio. Pero NO son vidrios decorativos: forman un
// MOSAICO tonal que se lee como una cartera balanceada — las piezas de arriba
// más claras (renta variable, crecimiento), las de abajo más graves y ancladas
// (renta fija, base). Al cerrarse: marco contenedor (hairline) → firma BNG
// centrada (remate: esa cartera ES el fondo) → una única línea dorada sobre una
// costura real (el equilibrio RV/RF). Sin glow, sin glass: tinta plana +
// grabado fino, lenguaje de título de bolsa.
// Sin datos en el hero (la cotización viva vive en Performance).
// reduce-motion ⇒ todo en su lugar, estático.

const EASE = [0.16, 1, 0.3, 1] as const;

// ── Coreografía (s desde el mount): piezas 0.15→~1.3, marco contenedor 1.15,
// firma BNG 1.7, línea de equilibrio 2.2 (cierra por debajo de la firma). El
// claim entra casi de entrada.
const FRAME_DELAY = 1.15;
const MARK_DELAY = 1.7;
const EQUI_DELAY = 2.2;

// ── Geometría: tesela 3×3 con vértices interiores desplazados — 9 cuadriláteros
// asimétricos que encajan exacto dejando un borde exterior cuadrado.
const SQ = { x0: 150, y0: 60, x1: 450, y1: 360 };
const SQC: [number, number] = [300, 210];
const JIT: Record<string, [number, number]> = {
  "1,1": [22, -18], "2,1": [-16, 24], "1,2": [-20, -14], "2,2": [18, 16],
};
function lat(i: number, j: number): [number, number] {
  let x = SQ.x0 + i * 100;
  let y = SQ.y0 + j * 100;
  const d = JIT[`${i},${j}`];
  if (d) { x += d[0]; y += d[1]; }
  return [x, y];
}

type Pieza = { pts: [number, number][]; centroid: [number, number] };

const PIEZAS: Pieza[] = [];
for (let j = 0; j < 3; j++) {
  for (let i = 0; i < 3; i++) {
    const pts: [number, number][] = [lat(i, j), lat(i + 1, j), lat(i + 1, j + 1), lat(i, j + 1)];
    const cx = (pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4;
    const cy = (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4;
    PIEZAS.push({ pts, centroid: [cx, cy] });
  }
}

const framePts = `${SQ.x0},${SQ.y0} ${SQ.x1},${SQ.y0} ${SQ.x1},${SQ.y1} ${SQ.x0},${SQ.y1} ${SQ.x0},${SQ.y0}`;
// Costura real de la tesela entre la banda media y la inferior (lattice j=2):
// la línea dorada de equilibrio la recorre — un borde existente, no un overlay
// arbitrario. lat(0,2)→lat(1,2)→lat(2,2)→lat(3,2) con su jitter.
const equiPts = "150,260 230,246 368,276 450,260";
const VB = { w: 600, h: 460 };

// Mosaico tonal (rampa de azules acero hecha a mano, NO los tokens navy-500/300
// que tiran a índigo/violeta = look-IA). Graduado por fila: arriba más claro
// (RV, crece), abajo más grave y cercano al fondo (RF, ancla). Variación intra-
// fila para que lean como "muchos fondos distintos".
const PIECE_FILL = [
  "#324c78", "#2d4672", "#36507c", // fila 0 — RV (más claro)
  "#243a63", "#294067", "#213760", // fila 1 — mezcla
  "#1b2d50", "#1e3055", "#182a4d", // fila 2 — RF (grave, anclado)
];

// Pose inicial derivada del centroide: cada pieza arranca empujada un poco hacia
// AFUERA de su lugar (sin cruzar el header) y apenas inclinada, y asienta hacia
// adentro. Determinista y SSR-safe; magnitudes contenidas para que lea sobrio.
function poseInicial(cx: number, cy: number) {
  const dx = (cx - SQC[0]) / 150; // ≈ −1..1
  const dy = (cy - SQC[1]) / 150;
  const central = Math.hypot(dx, dy) < 0.15;
  return {
    x: `${dx * 9}%`,
    y: `${dy * 9}%`,
    z: central ? 60 : 36, // la central "pasa" un poco más cerca, sin exagerar
    rotateY: dx * 12,
    rotateX: -dy * 12,
    opacity: 0,
  };
}

function Pieza3D({ pieza, idx, reduce }: { pieza: Pieza; idx: number; reduce: boolean }) {
  const [cx, cy] = pieza.centroid;
  const ptsStr = pieza.pts.map(([px, py]) => `${px},${py}`).join(" ");

  const delay = 0.15 + idx * 0.07;
  const seated = { x: "0%", y: "0%", z: 0, rotateX: 0, rotateY: 0, opacity: 1 };

  return (
    <motion.div
      className="fhq-piece"
      style={{ transformOrigin: `${(cx / VB.w) * 100}% ${(cy / VB.h) * 100}%` }}
      initial={reduce ? false : poseInicial(cx, cy)}
      animate={seated}
      transition={{
        duration: 0.9, ease: EASE, delay,
        opacity: { duration: 0.5, delay },
      }}
    >
      <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="fhq-piece-svg" aria-hidden>
        <defs>
          {/* Grabado fino diagonal: textura material (estilo grabado de título),
              casi imperceptible — lo que mata el look "render plano". */}
          <pattern id={`fhq-hatch-${idx}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
            <line x1="0" y1="0" x2="0" y2="7" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          </pattern>
        </defs>
        {/* Plano sólido + costura hairline (marquetería, no vidrio). */}
        <polygon points={ptsStr} fill={PIECE_FILL[idx]} stroke="rgba(255,255,255,0.14)" strokeWidth={1} strokeLinejoin="round" />
        <polygon points={ptsStr} fill={`url(#fhq-hatch-${idx})`} stroke="none" />
      </svg>
    </motion.div>
  );
}

function Cuadrado() {
  const reduce = useReducedMotion();

  return (
    <div className="fhq" role="img"
      aria-label="Muchas piezas distintas que encajan en un solo cuadrado balanceado: renta variable arriba, renta fija como base — muchos fondos, una sola cartera">
      <div className="fhq-stage3d">
        {PIEZAS.map((pieza, idx) => (
          <Pieza3D key={idx} pieza={pieza} idx={idx} reduce={!!reduce} />
        ))}
        <svg className="fhq-overlay" viewBox={`0 0 ${VB.w} ${VB.h}`} aria-hidden>
          {/* Marco contenedor: hairline blanco — define la cartera como un
              objeto único. Se dibuja primero, al cerrar el armado. */}
          <motion.polyline
            points={framePts} fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth={1.25}
            strokeLinejoin="round" strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ pathLength: { duration: 1.0, ease: "easeInOut", delay: FRAME_DELAY }, opacity: { duration: 0.2, delay: FRAME_DELAY } }}
          />
          {/* Firma BNG: el remate del armado — esa cartera ensamblada ES el
              fondo. Centrada en el campo, justo encima de la línea de
              equilibrio. */}
          <motion.g
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: MARK_DELAY }}
          >
            <text x={SQC[0]} y={SQC[1] - 6} textAnchor="middle" fontSize={34} fontWeight={700} letterSpacing="0.01em" fill="#fff">BNG</text>
            <text x={SQC[0]} y={SQC[1] + 22} textAnchor="middle" fontSize={12.5} fontWeight={600} letterSpacing="0.22em" fill="var(--gold-soft)">SELECCIÓN GLOBAL</text>
          </motion.g>
          {/* Línea de equilibrio RV / RF: ÚNICO acento dorado, sobre una costura
              real de la tesela. Cierra por debajo de la firma. */}
          <motion.polyline
            points={equiPts} fill="none" stroke="var(--gold)" strokeWidth={2}
            strokeLinejoin="round" strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ pathLength: { duration: 0.8, ease: EASE, delay: EQUI_DELAY }, opacity: { duration: 0.2, delay: EQUI_DELAY } }}
          />
        </svg>
      </div>
    </div>
  );
}

export function FondoHero() {
  const reduce = useReducedMotion();

  // Push-out al salir: el contenido del hero deriva un poco hacia arriba y se
  // atenúa mientras se scrollea — misma gramática que el hero del home
  // (titleY / videoScale), no un gesto nuevo.
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 70]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6, 1], [1, 1, 0.45]);

  // El claim es visible desde el arranque; entra con un fade discreto a la par
  // del armado, sin gating ni corrimientos.
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, ease: EASE, delay },
        };

  return (
    <header className="fondo-hero" ref={heroRef}>
      <motion.div className="site-wrap fh-grid" style={reduce ? undefined : { y: contentY, opacity: contentOpacity }}>
        {/* ── Claim editorial ── */}
        <div className="fh-copy">
          <motion.p className="fh-eyebrow" {...rise(0.1)}>BNG Selección Global</motion.p>
          <motion.h1 className="fh-h1 t-serif-display" {...rise(0.18)}>
            Una cartera global y balanceada, en un solo vehículo.
          </motion.h1>
          <motion.p className="fh-lead" {...rise(0.26)}>{FONDO.tagline}</motion.p>
          <motion.ul className="fh-ledger" {...rise(0.32)}>
            <li>Renta variable + renta fija</li>
            <li>Exposición global</li>
            <li>Domiciliado en Uruguay</li>
          </motion.ul>
          <motion.div className="fh-actions" {...rise(0.4)}>
            <Link href="/contacto" className="ui-btn ui-btn-on-navy">Hablar con un asesor</Link>
            <a href="#performance" className="fh-link">Ver performance →</a>
          </motion.div>
        </div>

        {/* ── Escena-firma: el mosaico que se ensambla ── */}
        <Cuadrado />
      </motion.div>

      <style>{`
        .fondo-hero {
          position: relative; isolation: isolate;
          color: #fff;
          padding-top: calc(var(--nav-h) + clamp(28px, 5vh, 64px));
          border-bottom: 1px solid rgba(255,255,255,0.08);
          /* Profundidad por LUZ FRÍA + base oscura, sin halo dorado (el glow es
             lo más "IA"). Una leve subida de luz acero detrás del mosaico; los
             bordes/base se oscurecen para enfocar. */
          background:
            radial-gradient(120% 100% at 72% 22%, rgba(54,74,116,0.30), transparent 52%),
            linear-gradient(180deg, #0d1c3d 0%, #0f2249 45%, #0a1630 100%);
          overflow: hidden;
        }
        /* Grabado fino en diagonal sobre todo el header (textura, no patrón). */
        .fondo-hero::before {
          content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none;
          background-image: repeating-linear-gradient(135deg, rgba(255,255,255,0.022) 0 2px, transparent 2px 22px);
        }
        .fh-grid {
          display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
          gap: clamp(32px, 5vw, 72px); align-items: center;
          padding-bottom: clamp(28px, 5vh, 56px);
        }

        .fh-eyebrow {
          margin: 0; font-size: 12.5px; font-weight: 700; letter-spacing: 0.22em;
          text-transform: uppercase; color: var(--gold-soft);
        }
        /* Titular en serif display (Newsreader 300, la voz de display del sitio):
           le da peso editorial y mata el Arial genérico. .site .t-serif-display
           aporta la familia; acá fijamos tamaño/color (gana al reset Arial). */
        .fondo-hero .fh-h1 {
          margin: 20px 0 0; color: #fff;
          font-size: clamp(34px, 4.6vw, 60px); line-height: 1.04;
        }
        .fh-lead {
          margin: 20px 0 0; max-width: 30em;
          font-size: clamp(15px, 1.4vw, 18px); line-height: 1.55; color: rgba(255,255,255,0.78);
        }
        /* Ledger cualitativo: hechos del fondo, sin cifras inventadas. */
        .fh-ledger {
          list-style: none; margin: 26px 0 0; padding: 18px 0 0;
          border-top: 1px solid rgba(255,255,255,0.14);
          display: flex; flex-wrap: wrap; gap: 10px 30px;
          font-size: 12.5px; letter-spacing: 0.04em; color: rgba(255,255,255,0.64);
        }
        .fh-ledger li { position: relative; }
        .fh-ledger li + li::before {
          content: "·"; position: absolute; left: -16px; color: var(--gold-soft);
        }
        .fh-actions { margin-top: 28px; display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
        .fh-link {
          font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.88);
          text-decoration: none; transition: color 180ms ease;
        }
        .fh-link:hover { color: var(--gold-soft); }

        /* ── Mosaico 3D ── */
        .fhq {
          perspective: 1200px; perspective-origin: 50% 46%;
          display: flex; justify-content: center;
          /* Escena decorativa: que no bloquee clicks. */
          pointer-events: none;
        }
        .fhq-stage3d {
          position: relative; width: 100%; max-width: 540px;
          aspect-ratio: ${VB.w} / ${VB.h};
          transform-style: preserve-3d;
        }
        .fhq-piece {
          position: absolute; inset: 0;
          will-change: transform;
          backface-visibility: hidden;
          /* Sombra real: las piezas son planos sólidos con peso, no vidrios. */
          filter: drop-shadow(0 12px 26px rgba(0,0,0,0.34));
        }
        .fhq-piece-svg, .fhq-overlay {
          position: absolute; inset: 0; width: 100%; height: 100%; display: block; overflow: visible;
        }
        .fhq-overlay { pointer-events: none; }

        @media (max-width: 920px) {
          .fh-grid { grid-template-columns: 1fr; gap: 28px; }
          .fhq-stage3d { max-width: 460px; }
        }
        /* En pantallas chicas el ledger se parte en varias líneas y el middot
           ::before (absoluto) queda colgando: lo apilamos en vertical, limpio. */
        @media (max-width: 640px) {
          .fh-ledger { flex-direction: column; gap: 9px; padding-top: 16px; }
          .fh-ledger li + li::before { content: none; }
        }
      `}</style>
    </header>
  );
}
