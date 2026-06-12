"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { FONDO } from "@/lib/fondo";

// Header del fondo: la escena-firma del cuadrado se arma GRANDE y CENTRADA en
// el header (las 9 piezas asimétricas entran por los cuatro costados; la
// central llega "de frente" con Z muy positivo). Ya armada — marco dorado y
// marca incluidos — el cuadrado se corre a su columna derecha y ese movimiento
// "destapa" el claim editorial y los CTA a la izquierda. Sin datos en el hero:
// la cotización viva (valor cuota, rendimientos, AUM) vive en la sección
// Performance (decisión del 12-jun-2026, tras descartar tarjeta y strip).
// reduce-motion ⇒ todo en su lugar, estático.

const EASE = [0.16, 1, 0.3, 1] as const;
// Vuelo de las piezas: arranque LENTO (la pieza "despega" con suavidad),
// acelera a mitad de camino y desacelera con peso al encajar. Distinto del
// EASE general, que es puro ease-out y dispara el inicio de golpe.
const EASE_VUELO = [0.6, 0.05, 0.25, 1] as const;

// ── Coreografía (s desde el mount): rótulo "FONDO DE FONDOS" 0.3→3.4, piezas
// 0.2→2.8, marco 2.5→3.6, marca 3.2→4.1 (releva al rótulo en el mismo punto).
// En SLIDE_DELAY el cuadrado ya armado se corre del centro a su columna
// (1.15s) y el claim entra apenas después, mientras se libera el lado
// izquierdo.
const FRAME_DELAY = 2.5;
const MARK_DELAY = 3.2;
const SLIDE_DELAY = 4.25;
const COPY_DELAY = SLIDE_DELAY + 0.3;

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

type Pieza = { pts: [number, number][]; centroid: [number, number]; rot: number };
const ROT = [-26, 19, -33, 22, 0, -20, 29, -17, 25];
// Pose 3D inicial por pieza (determinista, SSR-safe): inclinación y profundidad.
// Valores agresivos: las piezas llegan muy giradas y desde muy lejos en Z (la
// central, idx 4, "pasa cerca del usuario" antes de retroceder y encajar).
// ⚠️ Z positivo acotado a ≤620: el navegador rasteriza cada pieza al tamaño de
// layout y la magnifica en GPU según p/(p−z) (perspectiva 1000px) — con z=620
// son ~2.6×, todavía nítido; valores mayores (los 950 originales ⇒ 20×) se ven
// pixelados, sobre todo ahora que el despegue lento deja la pieza grande en
// pantalla un buen rato.
const ROTX = [-64, 48, -76, 52, 30, -56, 70, -40, 60];
const ROTY = [52, -68, 40, -60, 24, 64, -46, 66, -36];
const ROTZ = [-47, 34, -59, 40, 0, -36, 52, -31, 45];
const Z0 = [480, -420, 560, -360, 620, -480, 520, -400, 460];

// Punto de partida por pieza, en % del stage (~520px de ancho; el header
// completo mide ~3 stages). Cada pieza entra por un costado distinto del
// header — izquierda (sobre el titular), arriba, derecha y abajo — sin clamp
// al lienzo: el hero recorta con overflow:hidden.
const OFF: [number, number][] = [
  [-240, -50],  // sup-izq    ← desde el borde izquierdo del header
  [-20, -160],  // sup-centro ← desde arriba
  [130, -140],  // sup-der    ← desde arriba a la derecha
  [-270, 40],   // med-izq    ← cruza todo el header desde la izquierda
  [0, 10],      // centro     ← llega "de frente" (Z muy positivo)
  [190, 30],    // med-der    ← desde la derecha
  [-210, 150],  // inf-izq    ← desde abajo a la izquierda
  [30, 170],    // inf-centro ← desde abajo
  [160, 130],   // inf-der    ← desde abajo a la derecha
];

const PIEZAS: Pieza[] = [];
for (let j = 0; j < 3; j++) {
  for (let i = 0; i < 3; i++) {
    const pts: [number, number][] = [lat(i, j), lat(i + 1, j), lat(i + 1, j + 1), lat(i, j + 1)];
    const cx = (pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4;
    const cy = (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4;
    PIEZAS.push({ pts, centroid: [cx, cy], rot: ROT[j * 3 + i] });
  }
}

const framePts = `${SQ.x0},${SQ.y0} ${SQ.x1},${SQ.y0} ${SQ.x1},${SQ.y1} ${SQ.x0},${SQ.y1} ${SQ.x0},${SQ.y0}`;
const VB = { w: 600, h: 460 };

// Brillo base por pieza (tres tintas, paneles de vidrio sobre navy).
function baseOpacity(idx: number): number {
  const k = [1.0, 0.72, 1.25][((idx % 3) + Math.floor(idx / 3)) % 3];
  return Math.round(0.13 * k * 1e3) / 1e3;
}

function Pieza3D({ pieza, idx, reduce }: { pieza: Pieza; idx: number; reduce: boolean }) {
  const [ox, oy] = OFF[idx];
  const [cx, cy] = pieza.centroid;
  const ptsStr = pieza.pts.map(([px, py]) => `${px},${py}`).join(" ");

  const delay = 0.2 + idx * 0.12;
  const seated = { x: "0%", y: "0%", z: 0, rotateX: 0, rotateY: 0, rotateZ: 0, opacity: 1 };

  return (
    <motion.div
      className="fhq-piece"
      style={{ transformOrigin: `${(cx / VB.w) * 100}% ${(cy / VB.h) * 100}%` }}
      initial={reduce ? false : {
        x: `${ox}%`, y: `${oy}%`, z: Z0[idx],
        rotateX: ROTX[idx], rotateY: ROTY[idx], rotateZ: ROTZ[idx],
        opacity: 0,
      }}
      animate={seated}
      transition={{
        duration: 1.6, ease: EASE_VUELO, delay,
        // Fade-in suave durante el despegue lento; el vuelo es el espectáculo.
        opacity: { duration: 0.55, delay },
      }}
    >
      <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="fhq-piece-svg" aria-hidden>
        <polygon
          points={ptsStr}
          fill="#dfe7ff"
          fillOpacity={baseOpacity(idx)}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={1}
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  );
}

function Cuadrado() {
  const reduce = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);

  // Pose "centro de escena": trasladamos/escalamos el stage al medio del
  // header para el armado y después lo animamos de vuelta a su lugar natural
  // en la grilla (x/y/scale → 0/0/1), así el final queda perfecto en cualquier
  // viewport sin duplicar layout.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);

  useEffect(() => {
    if (reduce) return;
    const stage = stageRef.current;
    const hero = stage?.closest<HTMLElement>(".fondo-hero");
    if (!stage || !hero) return;
    // Medimos en px reales tras el primer paint; el salto a la pose centrada
    // no se ve porque las piezas montan con opacity 0.
    const s = stage.getBoundingClientRect();
    const h = hero.getBoundingClientRect();
    x.set(h.left + h.width / 2 - (s.left + s.width / 2));
    y.set(h.top + h.height / 2 - (s.top + s.height / 2));
    // "Grande": que el cuadrado ocupe ~82% de la altura del header, acotado
    // para no degradar nitidez ni desbordar en pantallas bajas.
    scale.set(Math.min(1.5, Math.max(1.1, (h.height * 0.82) / s.height)));
    const t = { duration: 1.15, ease: EASE, delay: SLIDE_DELAY };
    const anims = [animate(x, 0, t), animate(y, 0, t), animate(scale, 1, t)];
    return () => anims.forEach((a) => a.stop());
  }, [reduce, x, y, scale]);

  return (
    <div className="fhq" role="img"
      aria-label="Piezas distintas que encajan formando un cuadrado: muchos fondos, una sola cartera">
      <motion.div ref={stageRef} className="fhq-stage3d" style={{ x, y, scale }}>
        {PIEZAS.map((pieza, idx) => (
          <Pieza3D key={idx} pieza={pieza} idx={idx} reduce={!!reduce} />
        ))}
        <svg className="fhq-overlay" viewBox={`0 0 ${VB.w} ${VB.h}`} aria-hidden>
          {/* Rótulo de armado: titular protagonista mientras vuelan las
              piezas — entra con tracking-in y se apaga cuando la marca BNG lo
              releva en el mismo punto (fade: entra 0.3→0.9s, sostiene, se
              desvanece 2.9→3.4s pisándose con la marca a los 3.2s). Con
              reduce-motion no existe (ahí el cuadrado ya nace armado). */}
          {!reduce && (
            <motion.text
              x={SQC[0]} y={SQC[1] + 13} textAnchor="middle"
              fontSize={38} fontWeight={700} fill="#fff"
              initial={{ opacity: 0, letterSpacing: "0.45em" }}
              animate={{ opacity: [0, 1, 1, 0], letterSpacing: "0.14em" }}
              transition={{
                opacity: { duration: 3.1, delay: 0.3, times: [0, 0.19, 0.84, 1], ease: "easeInOut" },
                letterSpacing: { duration: 1.6, delay: 0.3, ease: EASE },
              }}
            >
              FONDO DE FONDOS
            </motion.text>
          )}
          <motion.polyline
            points={framePts} fill="none" stroke="var(--gold-soft)" strokeWidth={2.5}
            strokeLinejoin="round" strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ pathLength: { duration: 1.1, ease: "easeInOut", delay: FRAME_DELAY }, opacity: { duration: 0.2, delay: FRAME_DELAY } }}
          />
          <motion.g
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: MARK_DELAY }}
          >
            <text x={SQC[0]} y={SQC[1] - 6} textAnchor="middle" fontSize={34} fontWeight={700} letterSpacing="0.01em" fill="#fff">BNG</text>
            <text x={SQC[0]} y={SQC[1] + 22} textAnchor="middle" fontSize={12.5} fontWeight={600} letterSpacing="0.22em" fill="var(--gold-soft)">SELECCIÓN GLOBAL</text>
          </motion.g>
        </svg>
      </motion.div>
    </div>
  );
}

export function FondoHero() {
  const reduce = useReducedMotion();

  // Mientras el cuadrado se arma en el centro, el claim no existe para el
  // usuario: visibility (además del opacity de framer) saca los CTA invisibles
  // del tab-order y de los clicks hasta que el cuadrado empieza a correrse.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (reduce) { setRevealed(true); return; }
    const t = setTimeout(() => setRevealed(true), SLIDE_DELAY * 1000);
    return () => clearTimeout(t);
  }, [reduce]);

  // Entra desde la izquierda: el corrimiento del cuadrado "destapa" el claim.
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, x: -28 },
          animate: { opacity: 1, x: 0 },
          transition: { duration: 0.85, ease: EASE, delay },
        };

  return (
    <header className="fondo-hero">
      <div className="site-wrap fh-grid">
        {/* ── Claim editorial ── */}
        <div className="fh-copy" style={revealed ? undefined : { visibility: "hidden" }}>
          <motion.p className="fh-eyebrow" {...rise(COPY_DELAY)}>BNG Selección Global</motion.p>
          <motion.h1 className="fh-h1" {...rise(COPY_DELAY + 0.08)}>
            Una cartera global y balanceada, en un solo vehículo.
          </motion.h1>
          <motion.p className="fh-lead" {...rise(COPY_DELAY + 0.16)}>{FONDO.tagline}</motion.p>
          <motion.div className="fh-actions" {...rise(COPY_DELAY + 0.24)}>
            <Link href="/contacto" className="ui-btn ui-btn-on-navy">Hablar con un asesor</Link>
            <a href="#performance" className="fh-link">Ver performance →</a>
          </motion.div>
        </div>

        {/* ── Escena-firma: el cuadrado que se ensambla ── */}
        <Cuadrado />
      </div>

      <style>{`
        .fondo-hero {
          background: linear-gradient(180deg, var(--navy) 0%, #0c1c3d 100%);
          color: #fff;
          padding-top: calc(var(--nav-h) + clamp(28px, 5vh, 64px));
          /* Las piezas arrancan fuera del viewport (entran por los cuatro
             costados del header): recortamos para no generar scroll lateral. */
          overflow: hidden;
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
        /* .site h1 pinta tinta oscura; sobre navy necesitamos blanco (por eso
           el selector compuesto: gana en especificidad). */
        .fondo-hero .fh-h1 {
          margin: 18px 0 0; color: #fff;
          font-size: clamp(30px, 4vw, 52px); line-height: 1.06; letter-spacing: -0.015em;
        }
        .fh-lead {
          margin: 20px 0 0; max-width: 30em;
          font-size: clamp(15px, 1.4vw, 18px); line-height: 1.55; color: rgba(255,255,255,0.78);
        }
        .fh-actions { margin-top: 30px; display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
        .fh-link {
          font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.88);
          text-decoration: none; transition: color 180ms ease;
        }
        .fh-link:hover { color: var(--gold-soft); }

        /* ── Cuadrado 3D ── */
        .fhq {
          perspective: 1000px; perspective-origin: 50% 44%;
          display: flex; justify-content: center;
          /* Escena decorativa: en pleno vuelo las piezas cruzan sobre el
             titular y los CTA — que no bloqueen clicks. */
          pointer-events: none;
        }
        .fhq-stage3d {
          position: relative; width: 100%; max-width: 520px;
          aspect-ratio: ${VB.w} / ${VB.h};
          transform-style: preserve-3d;
        }
        .fhq-piece {
          position: absolute; inset: 0;
          will-change: transform;
          backface-visibility: hidden;
          filter: drop-shadow(0 14px 24px rgba(0,0,0,0.26));
        }
        .fhq-piece-svg, .fhq-overlay {
          position: absolute; inset: 0; width: 100%; height: 100%; display: block; overflow: visible;
        }
        .fhq-overlay { pointer-events: none; }

        @media (max-width: 920px) {
          .fh-grid { grid-template-columns: 1fr; gap: 28px; }
          .fhq-stage3d { max-width: 440px; }
        }
      `}</style>
    </header>
  );
}
