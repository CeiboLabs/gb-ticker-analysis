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

// Fila del horizonte y su TRAMO RECTO: del vértice 3 al 5 comparten la y del 4
// —el tramo entre ellos es perfectamente horizontal— y las dos puntas abren su
// jitter al máximo hacia afuera, así el tramo cubre x ∈ [660, 1260] del lienzo.
// Ahí se apoya el wordmark "BNG / SELECCIÓN GLOBAL": la línea dorada tiene que
// cruzarlo RECTO, ni en diagonal ni con un quiebre en el medio.
//
// El rango no es a ojo, sale de la geometría del recorte:
//  · en pantallas anchas no hay nada que pasear (el lienzo entra justo) y el
//    centro de la marca cae SIEMPRE en x ≈ 1037 —0.72·W − W/2, dividido por la
//    escala W/1440, da constante—, con medio ancho ≤ 127 → pide [910, 1164];
//  · en tablet el hero queda bajo, el recorte deja poco margen y con lo poco
//    que se puede pasear se llega apenas a ~683 → por eso el tramo arranca en el
//    vértice 3 y no en el 4;
//  · en angostas sobra medio edificio y se llega a cualquier lado.
// El resto del horizonte conserva su quiebre de montaña.
const HJ = NY / 2, RECTO = { desde: 3, hasta: 5, ancla: 4 };

// Ruido determinista por hash entero. 0..1.
function rand(a: number, b: number, salt: number): number {
  let h = (Math.imul(a + 1, 374761393) + Math.imul(b + 1, 668265263) + Math.imul(salt + 1, 374761397)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// Vértice (i,j): los interiores se desplazan ±0.25 de celda; el borde queda
// limpio (rectángulo exterior recto). Excepción: los vértices del tramo recto
// (ver arriba), que copian la y del ancla, y sus dos puntas, que además abren
// el jitter en x hacia afuera para estirar el tramo.
function lat(i: number, j: number): [number, number] {
  const recto = j === HJ && i >= RECTO.desde && i <= RECTO.hasta;
  const punta = recto && (i === RECTO.desde ? -1 : i === RECTO.hasta ? 1 : 0);
  let x = i * cellW, y = j * cellH;
  if (i > 0 && i < NX) x += punta ? punta * cellW * 0.25 : (rand(i, j, 1) - 0.5) * cellW * 0.5;
  if (j > 0 && j < NY) y += (rand(recto ? RECTO.ancla : i, j, 2) - 0.5) * cellH * 0.5;
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

// Horizonte: la fila central de la malla (j = HJ), recorrida de borde a borde.
/**
 * Geometría PÚBLICA del horizonte (coordenadas del viewBox), para quien
 * necesite anclar algo a la línea dorada. La usa `FondoHero`: la línea es marca
 * —tiene que atravesar el wordmark "BNG / SELECCIÓN GLOBAL" siempre—, y como el
 * horizonte es quebrado, dónde cae en pantalla depende del recorte del `slice`;
 * el hero recalcula ese punto y encuadra el mosaico para hacerlo coincidir.
 */
export const FACHADA_VIEWBOX = { w: VW, h: VH };
export const FACHADA_HORIZONTE: [number, number][] =
  Array.from({ length: NX + 1 }, (_, i) => lat(i, HJ));

const horizonPts = FACHADA_HORIZONTE.map((p) => p.join(",")).join(" ");

/**
 * Mosaico estático (sin animación de entrada) posicionado en absoluto para
 * llenar su contenedor. El caller controla el marco/scrim/escala.
 *
 * `crisp` fija los trazos con vector-effect non-scaling-stroke: se mantienen a
 * 1–2px aunque el mosaico se reduzca ~4× a la miniatura del navbar, donde si no
 * los bordes de los paneles y el horizonte se volverían sub-pixel y se perderían.
 * El hero lo deja en false → los trazos escalan como siempre (apariencia intacta).
 *
 * `pan` pasea la VENTANA del viewBox por dentro del mosaico (en unidades del
 * lienzo). Con `slice` el dibujo ya sobra fuera de la ventana, así que mientras
 * el corrimiento no exceda esa sobra no destapa nada: sirve para elegir QUÉ
 * tramo del edificio —y del horizonte— queda debajo de algo. Lo usa el hero
 * para apoyar el wordmark en un tramo plano de la línea dorada.
 */
export function Fachada({ className, crisp = false, pan }: { className?: string; crisp?: boolean; pan?: { x: number; y: number } }) {
  // Cada instancia del mosaico convive con el hero en la misma página (el navbar
  // es global): un id de pattern único evita que dos <pattern id> choquen.
  const uid = useId().replace(/:/g, "");
  const hatchId = `ffac-hatch-${uid}`;
  const vfx = crisp ? "non-scaling-stroke" : undefined;
  return (
    <svg
      className={className}
      // El hero ajusta este viewBox con un script inline ANTES de hidratar (así
      // el mosaico no salta al reencuadrarse), y la diferencia con el HTML del
      // server es deliberada. Sólo tapa los atributos de este <svg>: las
      // teselas de adentro se siguen chequeando —ahí sí un desajuste sería el
      // bug de hidratación que documenta el encabezado.
      viewBox={`${pan?.x ?? 0} ${pan?.y ?? 0} ${VW} ${VH}`}
      suppressHydrationWarning
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
