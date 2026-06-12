"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";
import { PinnedSection, scrollWindow } from "@/components/scroll";

/**
 * Escena-firma del fondo: "De muchos fondos, una sola cartera".
 * Pinned (patrón TrayectoriaScene). Al scrollear, varias piezas
 * de rompecabezas ASIMÉTRICAS entran dispersas y rotadas, vuelan a su lugar y
 * ENCAJAN exacto formando un cuadrado (la cartera). Un marco dorado lo enmarca
 * al cerrarse y aparece la declaración "De muchos fondos, una sola cartera."
 * Dramatiza la naturaleza fondo-de-fondos: muchas piezas distintas, un solo todo.
 * reduce-motion ⇒ PinnedSection renderiza el estado final (cuadrado armado).
 */
export function FondoComposicionScene() {
  return (
    <PinnedSection
      height={320}
      className="band-muted"
      // El navbar fijo (var(--nav-h)) tapa el tope del contenedor pinned: le
      // reservamos ese alto arriba para que la escena centre por DEBAJO del nav.
      contentStyle={{ boxSizing: "border-box", paddingTop: "var(--nav-h)" }}
    >
      {(p) => <Inner p={p} />}
    </PinnedSection>
  );
}

// Cuadrado base + grilla 3×3 con los vértices INTERIORES desplazados (jitter)
// de forma determinista: las 9 celdas quedan como cuadriláteros asimétricos que
// igual teselan exacto (los vecinos comparten los mismos vértices) y el borde
// exterior se mantiene como cuadrado perfecto.
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
const PIEZAS: Pieza[] = [];
for (let j = 0; j < 3; j++) {
  for (let i = 0; i < 3; i++) {
    const pts: [number, number][] = [lat(i, j), lat(i + 1, j), lat(i + 1, j + 1), lat(i, j + 1)];
    const cx = (pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4;
    const cy = (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4;
    PIEZAS.push({ pts, centroid: [cx, cy], rot: ROT[j * 3 + i] });
  }
}
const FILLS = ["#ffffff", "var(--navy-050)", "#fbfcff"];

// Lienzo (viewBox) + margen de seguridad.
const VB = { w: 600, h: 460, pad: 16 };

// Posición dispersa inicial: explota hacia afuera desde el centro + swirl
// tangencial, pero ACOTADA para que la pieza —YA ROTADA sobre su centroide, que
// es como se renderiza— quede entera dentro del lienzo. Se clampa contra la caja
// de los vértices rotados, no la sin rotar (esa era la falla del recorte).
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

function Pieza({ p, pieza, idx, fill }: { p: MotionValue<number>; pieza: Pieza; idx: number; fill: string }) {
  const start = 0.08 + idx * 0.034;
  const end = start + 0.32;
  const [ox, oy] = scatter(pieza);
  const xw = scrollWindow(start, end, ox, 0);
  const yw = scrollWindow(start, end, oy, 0);
  const rw = scrollWindow(start, end, pieza.rot, 0);
  const x = useTransform(p, xw.times, xw.values);
  const y = useTransform(p, yw.times, yw.values);
  const rotate = useTransform(p, rw.times, rw.values);
  // Rotación robusta entre navegadores: los puntos se definen RELATIVOS al
  // centroide y el <g> exterior lo lleva a su posición; así el rotate del
  // motion.g gira sobre el origen local (= centroide) sin depender de
  // transform-box/transform-origin (que tienen rarezas en Safari).
  const [cx, cy] = pieza.centroid;
  const ptsStr = pieza.pts.map(([px, py]) => `${px - cx},${py - cy}`).join(" ");
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <motion.g style={{ x, y, rotate }}>
        <polygon points={ptsStr} fill={fill} stroke="var(--navy-150)" strokeWidth={1} strokeLinejoin="round" />
      </motion.g>
    </g>
  );
}

function Inner({ p }: { p: MotionValue<number> }) {
  // Marco dorado exterior: se dibuja cuando el cuadrado ya está armado.
  const frameLen = useTransform(p, scrollWindow(0.6, 0.8, 0, 1).times, scrollWindow(0.6, 0.8, 0, 1).values);
  const frameOp = useTransform(p, [0, 0.56, 0.62, 1], [0, 0, 1, 1]);
  // Marca central: aparece junto con el perímetro.
  const markOp = useTransform(p, [0, 0.6, 0.74, 1], [0, 0, 1, 1]);
  const closeO = useTransform(p, scrollWindow(0.72, 0.9, 0, 1).times, scrollWindow(0.72, 0.9, 0, 1).values);
  const closeY = useTransform(p, scrollWindow(0.72, 0.9, 28, 0).times, scrollWindow(0.72, 0.9, 28, 0).values);

  const framePts = `${SQ.x0},${SQ.y0} ${SQ.x1},${SQ.y0} ${SQ.x1},${SQ.y1} ${SQ.x0},${SQ.y1} ${SQ.x0},${SQ.y0}`;

  return (
    <div className="ff-stage site-wrap">
      <div className="ff-eyebrow">Fondo de fondos</div>

      <svg className="ff-svg" viewBox="0 0 600 460" role="img" aria-label="Piezas asimétricas que encajan en un cuadrado: una sola cartera">
        {PIEZAS.map((pieza, idx) => (
          <Pieza key={idx} p={p} pieza={pieza} idx={idx} fill={FILLS[((idx % 3) + Math.floor(idx / 3)) % 3]} />
        ))}
        {/* marco dorado que cierra la cartera */}
        <motion.polyline points={framePts} fill="none" stroke="var(--gold-deep)" strokeWidth={2.5}
          strokeLinejoin="round" strokeLinecap="round" style={{ pathLength: frameLen, opacity: frameOp }} />

        {/* marca central: BNG Selección Global */}
        <motion.g style={{ opacity: markOp }}>
          <text x={SQC[0]} y={SQC[1] - 4} textAnchor="middle" fontSize={32} fontWeight={700} letterSpacing="0.01em" fill="var(--navy)">BNG</text>
          <text x={SQC[0]} y={SQC[1] + 22} textAnchor="middle" fontSize={12} fontWeight={600} letterSpacing="0.2em" fill="var(--gold-deep)">SELECCIÓN GLOBAL</text>
        </motion.g>
      </svg>

      <motion.div className="ff-close" style={{ opacity: closeO, y: closeY }}>
        <h2 className="t-serif-display ff-close-h">De muchos fondos, una sola cartera.</h2>
        <p className="ff-close-p">El fondo selecciona y combina fondos gestionados por managers especializados: piezas distintas que encajan en una única cartera diversificada y global.</p>
      </motion.div>

      <style>{`
        .ff-stage { width: 100%; display: flex; flex-direction: column; align-items: center; text-align: center; gap: clamp(4px, 1vh, 12px); }
        .ff-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gold-deep); }
        .ff-svg { width: min(560px, 90vw); height: auto; display: block; }
        /* La declaración sube para ocupar la franja vacía bajo el cuadrado
           (cuando está armado, ahí no hay piezas) — compacta el alto SIN achicar
           el cuadrado. Durante la dispersión está oculta (opacity 0), así que no
           choca con las piezas. */
        .ff-close { max-width: 34em; margin-top: clamp(-108px, -11vh, -56px); }
        .ff-close-h { font-size: clamp(24px, 3vw, 40px); line-height: 1.1; color: var(--navy); margin: 0; }
        .ff-close-p { margin: 14px 0 0; font-size: clamp(14px, 1.3vw, 17px); line-height: 1.5; color: var(--site-ink-2); }
      `}</style>
    </div>
  );
}
