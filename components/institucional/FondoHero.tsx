"use client";

import Link from "next/link";
import { motion, useTransform, cubicBezier, type MotionValue } from "framer-motion";
import { PinnedSection, scrollWindow } from "@/components/scroll";

// Header propio del fondo — NO usa el `hero-split` genérico del resto del sitio.
// Concepto "el cuadrado gigante con scroll", ahora en 3D: es una sección PINNED
// navy donde un cuadrado ENORME se ensambla a medida que scrolleás. Las 9 piezas
// asimétricas no se mueven sólo en 2D: vuelan en el espacio (rotateX/rotateY +
// translateZ con perspectiva). Algunas arrancan con Z muy positivo, así que
// "pasan cerca del usuario" (se agrandan por la perspectiva) y luego retroceden
// y encajan formando la cartera; el marco dorado se traza y aparece la marca BNG.
//
// El 3D se hace con CSS transforms (no SVG, que no soporta perspectiva): cada
// pieza es un <div> con perspectiva en el contenedor; adentro lleva un <svg> con
// su polígono para conservar el trazo fino. reduce-motion ⇒ estado final.

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
// Pose 3D inicial por pieza (determinista, SSR-safe — sin Math.random):
//   ROTX/ROTY = inclinación en el espacio · Z0 = profundidad en px (perspectiva).
//   Z0 positivo y grande ⇒ la pieza "viene hacia el usuario" (se agranda).
const ROTX = [-52, 40, -64, 46, 24, -42, 58, -32, 50];
const ROTY = [44, -56, 32, -48, 20, 52, -38, 54, -30];
const Z0 = [560, -360, 740, -300, 260, -440, 680, -320, 500];

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

// Fracción del recorrido (pathLength 0→1: top·derecha·abajo·izquierda) en la que
// la línea TOCA por primera vez al bloque inf-der (idx 8). Su vértice superior
// es lat(3,2) = (x1, y0+200); la línea baja por el lado derecho de y0 a y1, así
// que lo alcanza a (200/300) de ese lado ⇒ 0.25 + 0.667·0.25 ≈ 0.417.
const HIT_BR = 0.25 + ((SQ.y0 + 200 - SQ.y0) / (SQ.y1 - SQ.y0)) * 0.25;
// Sobre el hero NAVY las piezas son paneles de vidrio blanco translúcido con
// trazo claro fino. El brillo NO es plano: se calcula por orientación (ver
// sombreado en Pieza3D), así cada panel capta/pierde luz al girar.

const VB = { w: 600, h: 460, pad: 16 };

// ── Iluminación para el sombreado por orientación ──────────────────────────
const DEG = Math.PI / 180;
// Luz direccional (arriba-izquierda, de frente) y half-vector (luz+vista) para
// el glint especular. Vectores ~normalizados.
const LIGHT: [number, number, number] = [-0.39, -0.49, 0.78];
const HALF: [number, number, number] = [-0.21, -0.26, 0.94];
// Normal del panel (plano XY, normal +Z) tras rotateX(a)·rotateY(b), en grados.
function panelNormal(rxDeg: number, ryDeg: number): [number, number, number] {
  const a = rxDeg * DEG, b = ryDeg * DEG;
  return [Math.sin(b) * Math.cos(a), -Math.sin(a), Math.cos(b) * Math.cos(a)];
}

// ── Inercia al aterrizar ────────────────────────────────────────────────────
// Ease-out con peso (mismo bezier que el resto del sitio), BAKEADO en keyframes
// de rango completo 0→1. No usamos la opción `ease` de useTransform para no
// romper la aceleración WAAPI del scroll, que exige inputRange con primer offset
// 0 y último 1 (misma razón que scrollWindow).
const EASE_OUT = cubicBezier(0.16, 1, 0.3, 1);
function lerpVal(from: number | string, to: number | string, e: number): number | string {
  if (typeof from === "number" && typeof to === "number") return from + (to - from) * e;
  const f = parseFloat(from as string), t = parseFloat(to as string);
  const unit = String(from).replace(/[-0-9.]/g, "");
  return `${f + (t - f) * e}${unit}`;
}
function easeWindow<T extends number | string>(
  start: number, end: number, from: T, to: T,
): { times: number[]; values: T[] } {
  const N = 6;
  const times: number[] = [];
  const values: (number | string)[] = [];
  if (start > 0) { times.push(0); values.push(from); }
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    times.push(start + t * (end - start));
    values.push(lerpVal(from, to, EASE_OUT(t)));
  }
  if (end < 1) { times.push(1); values.push(to); }
  return { times, values: values as T[] };
}

// Dispersión 2D inicial acotada al lienzo (se compone con la profundidad 3D).
function scatter(pieza: Pieza): [number, number] {
  const [cx, cy] = pieza.centroid;
  const dx = cx - SQC[0], dy = cy - SQC[1];
  const len = Math.hypot(dx, dy) || 1;
  const tx = -dy / len, ty = dx / len;
  const sw = 46;
  let ox = dx * 1.1 + tx * sw;
  let oy = dy * 1.1 + ty * sw;
  const a = (pieza.rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [px, py] of pieza.pts) {
    const rx = cx + (px - cx) * c - (py - cy) * s;
    const ry = cy + (px - cx) * s + (py - cy) * c;
    if (rx < minX) minX = rx;
    if (rx > maxX) maxX = rx;
    if (ry < minY) minY = ry;
    if (ry > maxY) maxY = ry;
  }
  ox = Math.max(VB.pad - minX, Math.min(ox, VB.w - VB.pad - maxX));
  oy = Math.max(VB.pad - minY, Math.min(oy, VB.h - VB.pad - maxY));
  return [ox, oy];
}

function Pieza3D({ p, pieza, idx }: { p: MotionValue<number>; pieza: Pieza; idx: number }) {
  const start = 0.05 + idx * 0.045;
  const end = start + 0.4;
  const [ox, oy] = scatter(pieza);
  // x/y en % del lienzo (el div ocupa todo el stage, que mapea 600×460).
  // Redondeados a 2 decimales: el valor inicial se renderiza en SSR y un drift
  // de float (último ULP) entre server y cliente dispara mismatch de hidratación.
  const oxPct = Math.round((ox / VB.w) * 10000) / 100;
  const oyPct = Math.round((oy / VB.h) * 10000) / 100;
  // easeWindow ⇒ las piezas desaceleran con peso al encajar (no scrub lineal).
  const xw = easeWindow(start, end, `${oxPct}%`, "0%");
  const yw = easeWindow(start, end, `${oyPct}%`, "0%");
  const zw = easeWindow(start, end, Z0[idx], 0);
  const rxw = easeWindow(start, end, ROTX[idx], 0);
  const ryw = easeWindow(start, end, ROTY[idx], 0);
  const rzw = easeWindow(start, end, pieza.rot, 0);
  const x = useTransform(p, xw.times, xw.values);
  const y = useTransform(p, yw.times, yw.values);
  const z = useTransform(p, zw.times, zw.values);
  const rotateX = useTransform(p, rxw.times, rxw.values);
  const rotateY = useTransform(p, ryw.times, ryw.values);
  const rotateZ = useTransform(p, rzw.times, rzw.values);

  // Sombreado por orientación: difusa (lit) según la luz, más un glint especular
  // (spec) que barre cuando el panel pasa por el ángulo de reflexión. El brillo
  // del panel cambia a medida que gira ⇒ lectura 3D real, no relleno plano.
  const lit = useTransform([rotateX, rotateY], (latest: number[]) => {
    const [nx, ny, nz] = panelNormal(latest[0], latest[1]);
    return Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
  });
  const spec = useTransform([rotateX, rotateY], (latest: number[]) => {
    const [nx, ny, nz] = panelNormal(latest[0], latest[1]);
    return Math.pow(Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]), 26);
  });
  // Pequeña variación de brillo base entre piezas (como las 3 tintas previas).
  const fillIdx = ((idx % 3) + Math.floor(idx / 3)) % 3;
  const baseK = [1.0, 0.72, 1.25][fillIdx];
  // Salidas redondeadas (4 dec): evita el mismatch de hidratación por precisión
  // de float del valor inicial renderizado en SSR vs cliente.
  const bodyOp = useTransform(lit, (v) => {
    const c = v < 0 ? 0 : v > 1 ? 1 : v;
    return Math.round((0.05 + c * 0.15) * baseK * 1e4) / 1e4;
  });
  const specOp = useTransform(spec, (v) => {
    const c = v < 0 ? 0 : v > 1 ? 1 : v;
    return Math.round(c * 0.45 * 1e4) / 1e4;
  });

  const [cx, cy] = pieza.centroid;
  const ptsStr = pieza.pts.map(([px, py]) => `${px},${py}`).join(" ");
  return (
    <motion.div
      className="piece3d"
      style={{
        x, y, z, rotateX, rotateY, rotateZ,
        transformOrigin: `${(cx / VB.w) * 100}% ${(cy / VB.h) * 100}%`,
      }}
    >
      <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="piece3d-svg" aria-hidden>
        {/* cuerpo: opacidad del relleno modulada por la difusa */}
        <motion.polygon points={ptsStr} fill="#dfe7ff" stroke="rgba(255,255,255,0.5)" strokeWidth={1} strokeLinejoin="round" style={{ fillOpacity: bodyOp }} />
        {/* glint especular: barre al girar el panel */}
        <motion.polygon points={ptsStr} fill="#ffffff" style={{ fillOpacity: specOp }} />
      </svg>
    </motion.div>
  );
}

function Inner({ p }: { p: MotionValue<number> }) {
  // Marco: una sola línea continua desde la esquina sup-izq (recorrido original).
  // El bloque inf-der (idx 8) es el último en selar: termina su vuelo en
  // SEAT_BR = 0.05 + 8·0.045 + 0.4 = 0.81. Elegimos FRAME_START tal que la línea
  // llegue a la intersección con ese bloque (HIT_BR) justo cuando ya está en su
  // lugar (SEAT_BR + ε). Como reach(f) = a + f·(b−a), despejamos a para
  // reach(HIT_BR) = T:  a = (T − HIT_BR·b) / (1 − HIT_BR).
  const SEAT_BR = 0.05 + 8 * 0.045 + 0.4; // = 0.81: la última pieza (idx 8) selada
  const FRAME_END = 0.97;
  const T = SEAT_BR + 0.01; // ε para que la pieza ya esté firme al tocarla
  const FRAME_START = (T - HIT_BR * FRAME_END) / (1 - HIT_BR);
  const fw = scrollWindow(FRAME_START, FRAME_END, 0, 1);
  const frameLen = useTransform(p, fw.times, fw.values);
  const frameOp = useTransform(p, [0, FRAME_START - 0.02, FRAME_START + 0.02, 1], [0, 0, 1, 1]);
  // BNG empieza a aparecer cuando las PIEZAS terminan de formar el cuadrado
  // (idx 8, la última, sela en SEAT_BR) — no cuando cierra el marco dorado.
  const markOp = useTransform(p, [0, SEAT_BR, Math.min(SEAT_BR + 0.1, 1), 1], [0, 0, 1, 1]);
  const cw = scrollWindow(0.86, 0.98, 0, 1);
  const closeO = useTransform(p, cw.times, cw.values);
  const cyw = scrollWindow(0.86, 0.98, 26, 0);
  const closeY = useTransform(p, cyw.times, cyw.values);
  const iw = scrollWindow(0, 0.14, 1, 0);
  const introOp = useTransform(p, iw.times, iw.values);
  // "Gastón Bengochea presenta": vive desde el inicio y hace crossfade con la
  // marca BNG del centro justo cuando ésta aparece (markOp arranca en 0.74).
  const pw = scrollWindow(0.6, 0.74, 1, 0);
  const presentaOp = useTransform(p, pw.times, pw.values);

  return (
    <div className="fondo-hero-stage">
      <div className="fondo-hero-figure3d" role="img"
        aria-label="Piezas que vuelan en el espacio y encajan formando un cuadrado: una sola cartera">
        <motion.div className="fondo-hero-presenta" style={{ opacity: presentaOp }} aria-hidden>
          Bengochea <em>presenta</em>
        </motion.div>
        <div className="stage3d">
          {PIEZAS.map((pieza, idx) => (
            <Pieza3D key={idx} p={p} pieza={pieza} idx={idx} />
          ))}
          <svg className="stage3d-overlay" viewBox={`0 0 ${VB.w} ${VB.h}`} aria-hidden>
            <motion.polyline points={framePts} fill="none" stroke="var(--gold-soft)" strokeWidth={2.5}
              strokeLinejoin="round" strokeLinecap="round" style={{ pathLength: frameLen, opacity: frameOp }} />
            <motion.g style={{ opacity: markOp }}>
              <text x={SQC[0]} y={SQC[1] - 6} textAnchor="middle" fontSize={34} fontWeight={700} letterSpacing="0.01em" fill="#fff">BNG</text>
              <text x={SQC[0]} y={SQC[1] + 22} textAnchor="middle" fontSize={12.5} fontWeight={600} letterSpacing="0.22em" fill="var(--gold-soft)">SELECCIÓN GLOBAL</text>
            </motion.g>
          </svg>
        </div>
      </div>

      <motion.div className="fondo-hero-reveal" style={{ opacity: closeO, y: closeY }}>
        <h1 className="t-display fondo-hero-h1">Una cartera global y balanceada.</h1>
        <div className="fondo-hero-actions">
          <Link href="/contacto" className="ui-btn ui-btn-on-navy">Hablar con un asesor</Link>
          <a href="#ficha-tecnica" className="fondo-hero-link">Ver la ficha técnica →</a>
        </div>
      </motion.div>

      <motion.div className="fondo-hero-cue" style={{ opacity: introOp }} aria-hidden>
        <span>Scrolleá para armar la cartera</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      </motion.div>

      <style>{`
        .fondo-hero { background: var(--navy); color: #fff; }
        .fondo-hero-stage {
          position: relative; width: 100%;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center;
        }
        /* Title-card "Bengochea presenta": al CENTRO del stage (donde luego
           aparece la marca BNG), por encima de las piezas que vuelan. */
        .fondo-hero-presenta {
          position: absolute; top: 46%; left: 50%; transform: translate(-50%, -50%);
          z-index: 3; white-space: nowrap; pointer-events: none;
          font-size: clamp(15px, 1.7vw, 21px); font-weight: 600; letter-spacing: 0.24em;
          text-transform: uppercase; color: var(--gold-soft);
        }
        .fondo-hero-presenta em { font-style: normal; color: rgba(255,255,255,0.62); }

        /* El cuadrado GIGANTE en 3D: el contenedor da la perspectiva. */
        .fondo-hero-figure3d {
          position: relative;
          perspective: 1100px;
          perspective-origin: 50% 44%;
          margin-top: clamp(4px, 1.4vh, 16px);
          width: min(96vw, 860px);
          display: flex; align-items: center; justify-content: center;
        }
        .stage3d {
          position: relative;
          height: min(58vh, 560px);
          aspect-ratio: ${VB.w} / ${VB.h};
          transform-style: preserve-3d;
        }
        .piece3d {
          position: absolute; inset: 0;
          will-change: transform;
          backface-visibility: hidden;
          filter: drop-shadow(0 18px 30px rgba(0,0,0,0.28));
        }
        .piece3d-svg, .stage3d-overlay {
          position: absolute; inset: 0; width: 100%; height: 100%; display: block; overflow: visible;
        }
        .stage3d-overlay { pointer-events: none; }

        /* Titular + CTA: ocupan la franja inferior del cuadrado armado. */
        .fondo-hero-reveal { margin-top: clamp(-32px, -3.5vh, -16px); max-width: 36rem; }
        .fondo-hero .fondo-hero-h1 {
          color: #fff; font-size: clamp(26px, 3.4vw, 44px); line-height: 1.08;
        }
        .fondo-hero-actions {
          margin-top: 24px; display: flex; align-items: center; justify-content: center;
          gap: 22px; flex-wrap: wrap;
        }
        .fondo-hero-link {
          font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.9);
          text-decoration: none; transition: color 180ms ease;
        }
        .fondo-hero-link:hover { color: var(--gold-soft); }

        .fondo-hero-cue {
          position: absolute; left: 50%; bottom: clamp(6px, 1.6vh, 18px); transform: translateX(-50%);
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;
          color: rgba(255,255,255,0.5); white-space: nowrap;
        }
        .fondo-hero-cue svg { animation: heroCue 1.8s ease-in-out infinite; }
        @keyframes heroCue { 0%,100% { transform: translateY(0); } 50% { transform: translateY(4px); } }
        @media (prefers-reduced-motion: reduce) { .fondo-hero-cue { display: none; } }

        @media (max-width: 700px) {
          .fondo-hero-figure3d { width: 94vw; }
          .stage3d { height: auto; width: 94vw; }
          .fondo-hero-reveal { margin-top: clamp(-20px, -3vh, -10px); }
        }
      `}</style>
    </div>
  );
}

export function FondoHero() {
  return (
    <PinnedSection
      height={280}
      className="fondo-hero"
      // El navbar fijo tapa el tope del contenedor pinned: reservamos su alto.
      contentStyle={{ boxSizing: "border-box", paddingTop: "var(--nav-h)" }}
    >
      {(p) => <Inner p={p} />}
    </PinnedSection>
  );
}
