"use client";

import { useId } from "react";

// Fachada — mosaico de paneles embutidos que hace de "cara" del fondo BNG
// Selección Global. Tesela 6×4 con los vértices interiores desplazados → 24
// cuadriláteros irregulares, graduados por valor: arriba más claro (renta
// variable, crece), abajo grave y anclado (renta fija, base). Un único
// HORIZONTE dorado cruza el centro de lado a lado (el equilibrio RV/RF).
//
// Extraído del hero (FondoHero) para reusarlo como miniatura en el destacado
// "Invertir" del navbar: el tile del dropdown es un recorte del MISMO edificio
// (misma semilla → mismas piezas), un preview espacial del destino.
//
// SSR-safe: el ruido es un HASH ENTERO (Math.imul), bit-idéntico en server
// (Node) y client (Chrome). Math.sin NO sirve — las trascendentales son
// implementation-defined y difieren entre engines, lo que rompía la hidratación.

// ── Lienzo y malla ──
const VW = 1440, VH = 780;
const NX = 6, NY = 4;
const cellW = VW / NX, cellH = VH / NY;

// Ruido determinista por hash entero. 0..1.
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

/**
 * Mosaico estático (sin animación de entrada) posicionado en absoluto para
 * llenar su contenedor. El caller controla el marco/scrim/escala.
 *
 * `crisp` fija los trazos con vector-effect non-scaling-stroke: se mantienen a
 * 1–2px aunque el mosaico se reduzca ~4× a la miniatura del navbar, donde si no
 * los bordes de los paneles y el horizonte se volverían sub-pixel y se perderían.
 * El hero lo deja en false → los trazos escalan como siempre (apariencia intacta).
 */
export function Fachada({ className, crisp = false }: { className?: string; crisp?: boolean }) {
  // Cada instancia del mosaico convive con el hero en la misma página (el navbar
  // es global): un id de pattern único evita que dos <pattern id> choquen.
  const uid = useId().replace(/:/g, "");
  const hatchId = `ffac-hatch-${uid}`;
  const vfx = crisp ? "non-scaling-stroke" : undefined;
  return (
    <svg
      className={className}
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
    >
      <defs>
        <pattern id={hatchId} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(26)">
          <line x1="0" y1="0" x2="0" y2="9" stroke="rgba(255,255,255,0.045)" strokeWidth="1" />
        </pattern>
      </defs>
      {/* Teselas estáticas. */}
      {PIECES.map((p, idx) => (
        <polygon
          key={idx}
          points={p.pts}
          fill={p.fill}
          stroke="rgba(255,255,255,0.085)"
          strokeWidth={1}
          strokeLinejoin="round"
          vectorEffect={vfx}
        />
      ))}
      {/* Grabado fino sobre toda la fachada (textura material, no patrón). */}
      <rect x={0} y={0} width={VW} height={VH} fill={`url(#${hatchId})`} />
      {/* Horizonte dorado: único acento — el equilibrio RV/RF, de lado a lado. */}
      <polyline
        points={horizonPts} fill="none" stroke="var(--gold)" strokeWidth={2}
        strokeLinejoin="round" strokeLinecap="round" opacity={0.92}
        vectorEffect={vfx}
      />
    </svg>
  );
}
