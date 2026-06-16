"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { FONDO } from "@/lib/fondo";

// Hero del fondo — versión FACHADA full-bleed. El header entero es un mosaico
// de paneles embutidos (tesela 6×4 con vértices interiores desplazados → 24
// cuadriláteros irregulares) graduado por valor: arriba más claro (renta
// variable, crece), abajo grave y anclado (renta fija, base). Un scrim oscurece
// la izquierda para que el claim se lea; el oro es un único HORIZONTE que cruza
// todo el ancho (el equilibrio RV/RF); y la firma BNG a la derecha, sobre el
// horizonte, como remate. SIN animación de entrada: todo renderiza en su estado
// final; sólo queda un push-out sutil al scroll (atenuado en reduce-motion).

// ── Lienzo y malla ──
const VW = 1440, VH = 780;
const NX = 6, NY = 4;
const cellW = VW / NX, cellH = VH / NY;
const HC: [number, number] = [VW / 2, VH / 2];

// Ruido determinista por HASH ENTERO (Math.imul): bit-idéntico en server (Node)
// y client (Chrome). OJO: Math.sin NO es SSR-safe — las funciones
// trascendentales son implementation-defined y difieren entre engines, lo que
// rompía la hidratación (los points de los polígonos no coincidían). 0..1.
function rand(a: number, b: number, salt: number): number {
  let h = (Math.imul(a + 1, 374761393) + Math.imul(b + 1, 668265263) + Math.imul(salt + 1, 374761397)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// Vértice (i,j): los interiores se desplazan ±0.25 de celda; el borde queda
// limpio (rectángulo exterior recto).
function lat(i: number, j: number): [number, number] {
  let x = i * cellW, y = j * cellH;
  if (i > 0 && i < NX) x += (rand(i, j, 1) - 0.5) * cellW * 0.5;
  if (j > 0 && j < NY) y += (rand(i, j, 2) - 0.5) * cellH * 0.5;
  return [x, y];
}

// Rampa tonal vertical (azules acero hechos a mano, NO los tokens índigo) +
// micro-variación por celda para que lean como "muchos fondos distintos".
const LIGHT = [64, 90, 142], DARK = [15, 25, 48];
function clamp8(v: number) { return Math.max(0, Math.min(255, Math.round(v))); }
function toHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => clamp8(v).toString(16).padStart(2, "0")).join("");
}
function tone(ci: number, cj: number): string {
  const t = cj / (NY - 1);
  const d = (rand(ci, cj, 3) - 0.5) * 13;
  return toHex(LIGHT[0] + (DARK[0] - LIGHT[0]) * t + d, LIGHT[1] + (DARK[1] - LIGHT[1]) * t + d, LIGHT[2] + (DARK[2] - LIGHT[2]) * t + d);
}

type Piece = { pts: string; cx: number; cy: number; fill: string };
const PIECES: Piece[] = [];
for (let cj = 0; cj < NY; cj++) {
  for (let ci = 0; ci < NX; ci++) {
    const p = [lat(ci, cj), lat(ci + 1, cj), lat(ci + 1, cj + 1), lat(ci, cj + 1)];
    const cx = (p[0][0] + p[1][0] + p[2][0] + p[3][0]) / 4;
    const cy = (p[0][1] + p[1][1] + p[2][1] + p[3][1]) / 4;
    PIECES.push({ pts: p.map((q) => q.join(",")).join(" "), cx, cy, fill: tone(ci, cj) });
  }
}

// Horizonte: la fila central de la malla (j = NY/2), recorrida de borde a borde.
const HJ = NY / 2;
const horizonPts = Array.from({ length: NX + 1 }, (_, i) => lat(i, HJ).join(",")).join(" ");

function Fachada() {
  return (
    <svg className="ffac-svg" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <pattern id="ffac-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(26)">
          <line x1="0" y1="0" x2="0" y2="9" stroke="rgba(255,255,255,0.045)" strokeWidth="1" />
        </pattern>
      </defs>
      {/* Teselas estáticas (sin animación de entrada). */}
      {PIECES.map((p, idx) => (
        <polygon
          key={idx}
          points={p.pts}
          fill={p.fill}
          stroke="rgba(255,255,255,0.085)"
          strokeWidth={1}
          strokeLinejoin="round"
        />
      ))}
      {/* Grabado fino sobre toda la fachada (textura material, no patrón). */}
      <rect x={0} y={0} width={VW} height={VH} fill="url(#ffac-hatch)" />
      {/* Horizonte dorado: único acento — el equilibrio RV/RF, de lado a lado. */}
      <polyline
        points={horizonPts} fill="none" stroke="var(--gold)" strokeWidth={2}
        strokeLinejoin="round" strokeLinecap="round" opacity={0.92}
      />
    </svg>
  );
}

export function FondoHero() {
  const reduce = useReducedMotion();

  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.65, 1], [1, 1, 0.4]);
  const stageScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  const signOpacity = useTransform(scrollYProgress, [0, 0.45], [1, 0]);

  return (
    <header className="ffac-hero" ref={heroRef}>
      {/* ── Fachada (mosaico + horizonte) ── */}
      <motion.div className="ffac-stage" style={reduce ? undefined : { scale: stageScale }}>
        <Fachada />
      </motion.div>

      {/* ── Scrim: legibilidad del claim a la izquierda + profundidad ── */}
      <div className="ffac-scrim" aria-hidden />

      {/* ── Firma BNG (remate, a la derecha sobre el horizonte) ── */}
      <motion.div
        className="ffac-sign" aria-hidden
        style={reduce ? undefined : { opacity: signOpacity }}
      >
        <span className="ffac-sign-bng">BNG</span>
        <span className="ffac-sign-sub">SELECCIÓN GLOBAL</span>
      </motion.div>

      {/* ── Claim editorial ── */}
      <motion.div className="site-wrap ffac-content" style={reduce ? undefined : { y: contentY, opacity: contentOpacity }}>
        <div className="ffac-copy">
          <h1 className="fh-h1 t-serif-display">
            Una estrategia global y diversificada, en un solo vehículo.
          </h1>
          <p className="fh-lead">{FONDO.tagline}</p>
          <ul className="fh-ledger">
            <li>Renta variable + renta fija</li>
            <li>Exposición global</li>
            <li>Domiciliado en Uruguay</li>
          </ul>
          <div className="fh-actions">
            <Link href="/contacto" className="ui-btn ui-btn-on-navy">Hablar con un asesor</Link>
            <a href="#performance" className="fh-link">Ver performance →</a>
          </div>
        </div>
      </motion.div>

      <style>{`
        .ffac-hero {
          position: relative; isolation: isolate; overflow: hidden;
          color: #fff; background: var(--navy);
          min-height: min(90vh, 860px);
          display: flex; align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        /* will-change promueve el stage a su propia capa GPU: el scale del
           parallax escala una textura cacheada en vez de rerasterizar el SVG de
           24 polígonos por frame (eso fundía la máquina al final del hero). */
        .ffac-stage { position: absolute; inset: 0; z-index: 0; will-change: transform; }
        .ffac-svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }

        /* Scrim: izquierda muy oscura (claim) → derecha despejada (fachada y
           firma). Más un velo arriba (navbar) y abajo (CTAs). */
        .ffac-scrim {
          position: absolute; inset: 0; z-index: 1; pointer-events: none;
          background:
            linear-gradient(90deg, rgba(7,14,34,0.95) 0%, rgba(7,14,34,0.66) 32%, rgba(7,14,34,0.08) 60%, transparent 78%),
            linear-gradient(180deg, rgba(7,14,34,0.45) 0%, transparent 26%, transparent 64%, rgba(7,14,34,0.40) 100%);
        }

        /* Firma — sobre el horizonte, en el cuadrante derecho. */
        .ffac-sign {
          position: absolute; z-index: 2; top: 50%; left: 72%;
          transform: translate(-50%, -50%); text-align: center; pointer-events: none;
          text-shadow: 0 2px 22px rgba(0,0,0,0.55);
        }
        .ffac-sign-bng {
          display: block; font-size: clamp(40px, 5.2vw, 76px); font-weight: 700;
          line-height: 1; letter-spacing: 0.01em; color: #fff;
        }
        .ffac-sign-sub {
          display: block; margin-top: 12px; font-size: clamp(12px, 1.05vw, 17px);
          font-weight: 600; letter-spacing: 0.26em; color: var(--gold-soft);
        }

        .ffac-content { position: relative; z-index: 3; width: 100%; }
        .ffac-copy { max-width: 31em; }

        .ffac-hero .fh-h1 {
          margin: 0; color: #fff;
          font-size: clamp(34px, 4.6vw, 60px); line-height: 1.04;
        }
        .fh-lead {
          margin: 20px 0 0; max-width: 28em;
          font-size: clamp(15px, 1.4vw, 18px); line-height: 1.55; color: rgba(255,255,255,0.82);
        }
        .fh-ledger {
          list-style: none; margin: 26px 0 0; padding: 18px 0 0;
          border-top: 1px solid rgba(255,255,255,0.16);
          display: flex; flex-wrap: wrap; gap: 10px 30px;
          font-size: 12.5px; letter-spacing: 0.04em; color: rgba(255,255,255,0.7);
        }
        .fh-ledger li { position: relative; }
        .fh-ledger li + li::before {
          content: "·"; position: absolute; left: -16px; color: var(--gold-soft);
        }
        .fh-actions { margin-top: 28px; display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
        .fh-link {
          font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.9);
          text-decoration: none; transition: color 180ms ease;
        }
        .fh-link:hover { color: var(--gold-soft); }

        @media (max-width: 920px) {
          .ffac-hero {
            min-height: auto; align-items: flex-end;
            padding: calc(var(--nav-h) + clamp(120px, 30vh, 240px)) 0 clamp(36px, 7vh, 64px);
          }
          /* La firma sube al cuadrante superior y hace de marca. */
          .ffac-sign { top: clamp(150px, 26vh, 240px); left: 50%; }
          .ffac-scrim {
            background: linear-gradient(180deg, rgba(7,14,34,0.50) 0%, rgba(7,14,34,0.18) 36%, rgba(7,14,34,0.86) 78%);
          }
          .ffac-copy { max-width: none; }
        }
        @media (max-width: 640px) {
          .fh-ledger { flex-direction: column; gap: 9px; padding-top: 16px; }
          .fh-ledger li + li::before { content: none; }
        }
      `}</style>
    </header>
  );
}
