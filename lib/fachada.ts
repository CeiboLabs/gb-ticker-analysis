// Geometría de la FACHADA — la parte pura del mosaico de paneles del hero.
//
// POR QUÉ ESTÁ ACÁ Y NO EN components/institucional/Fachada.tsx
// Ese archivo es `"use client"`, así que desde un contexto de server sus exports
// son referencias de cliente, no valores: no se pueden leer las teselas para
// dibujar nada. La card OG del fondo
// (app/(fondo)/bng-seleccion-global/opengraph-image.tsx) corre en el build, en el
// server, y necesita EXACTAMENTE las mismas piezas que el hero — si las volviera
// a derivar por su cuenta, cualquier retoque de la fachada dejaría la tarjeta
// mostrando un edificio distinto al del sitio, y nadie se enteraría hasta ver un
// link compartido.
//
// Acá vive lo que no toca el DOM (la malla, el ruido, la rampa tonal, el
// horizonte); en `Fachada.tsx` queda el componente. Ese archivo reexporta lo
// público, así que sus consumidores no cambian.
//
// SSR-safe: el ruido es un HASH ENTERO (Math.imul), bit-idéntico en server
// (Node) y client (Chrome). Math.sin NO sirve — las trascendentales son
// implementation-defined y difieren entre engines, lo que rompía la hidratación.

// ── Lienzo y malla ──
export const VW = 1440, VH = 780;
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

export type Piece = { pts: string; ci: number; cj: number; fill: string };
export const PIECES: Piece[] = [];
for (let cj = 0; cj < NY; cj++) {
  for (let ci = 0; ci < NX; ci++) {
    const p = [lat(ci, cj), lat(ci + 1, cj), lat(ci + 1, cj + 1), lat(ci, cj + 1)];
    PIECES.push({ pts: p.map((q) => q.join(",")).join(" "), ci, cj, fill: tone(ci, cj) });
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

export const horizonPts = FACHADA_HORIZONTE.map((p) => p.join(",")).join(" ");

/**
 * Largo del horizonte en unidades del lienzo. Es la suma analítica de sus
 * segmentos —no necesita DOM—, así que el hero puede armar el `stroke-dasharray`
 * del trazado de entrada en el SERVER, sin `getTotalLength()` ni un efecto que
 * lo mida después de hidratar (que dejaría la línea entera visible un frame
 * antes de esconderse para animar).
 *
 * Va redondeado hacia ARRIBA a propósito: un dasharray apenas mayor que el
 * largo real cubre la polilínea completa; uno menor dejaría un hueco al final.
 */
export const FACHADA_HORIZONTE_LEN = Math.ceil(
  FACHADA_HORIZONTE.reduce((acc, p, i) => (
    i === 0 ? acc : acc + Math.hypot(p[0] - FACHADA_HORIZONTE[i - 1][0], p[1] - FACHADA_HORIZONTE[i - 1][1])
  ), 0),
);

/**
 * Máscara CSS con la silueta de la fachada: los 24 paneles —cada uno con su
 * propio alfa— más el horizonte. Sirve para recortar una capa de luz superpuesta
 * contra la GEOMETRÍA: la luz entra panel por panel, como en una fachada real,
 * en vez de barrer el hero como un brillo uniforme (que es lo que delata a un
 * "shine sweep" genérico).
 *
 * Los paneles de arriba reciben más luz que los de abajo — el mismo gradiente de
 * valor que ya tiene el mosaico (renta variable clara arriba, renta fija grave
 * abajo), ahora también en cómo cada panel responde a la luz.
 *
 * El horizonte entra a alfa pleno para que lo ilumine LA MISMA luz que a los
 * paneles. Es deliberado que no tenga destello propio: dos brillos con relojes
 * distintos leen como decoración, uno solo lee como un sol.
 *
 * ⚠️ `pan` tiene que ser el MISMO que se le pasa a <Fachada>, o la máscara queda
 * corrida respecto de los paneles que dice recortar.
 */
export function fachadaMascara(pan?: { x: number; y: number }): string {
  const paneles = PIECES.map((p) => {
    const alfa = (0.55 + 0.45 * rand(p.ci, p.cj, 7)) * (1 - 0.42 * (p.cj / (NY - 1)));
    return `<polygon points='${p.pts}' fill='#fff' fill-opacity='${alfa.toFixed(3)}'/>`;
  }).join("");
  const linea = `<polyline points='${horizonPts}' fill='none' stroke='#fff' stroke-width='3'`
    + ` stroke-linejoin='round' stroke-linecap='round'/>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${pan?.x ?? 0} ${pan?.y ?? 0} ${VW} ${VH}'`
    + ` preserveAspectRatio='xMidYMid slice'>${paneles}${linea}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * La fachada como SVG COMPLETO y autosuficiente, con sus dimensiones en px.
 *
 * Es la misma pintura que dibuja `<Fachada>` en el DOM, pero como cadena, para
 * quien no tiene DOM: hoy la card OG del fondo, que la mete en un `<img>` con
 * data-URI porque Satori no ejecuta CSS de recorte (`clip-path`, `mask`) y sí
 * rasteriza imágenes SVG.
 *
 * Dos diferencias con el componente, las dos obligadas por ese destino:
 *   · el `<pattern>` del grabado va con id FIJO — no hay `useId()` fuera de
 *     React, y en un SVG suelto no hay con quién chocar;
 *   · el dorado va literal (`#EBD288`) en vez de `var(--gold)`: un SVG dentro de
 *     un `<img>` es un documento aparte y no hereda las variables de la página.
 *     Es el mismo valor que declara globals.css.
 *
 * `alto` decide el RECORTE vertical: con `preserveAspectRatio="slice"` el mosaico
 * llena la caja y sobra por el eje largo, igual que en el hero.
 */
export function fachadaSvg({ ancho, alto, pan }: {
  ancho: number;
  alto: number;
  pan?: { x: number; y: number };
}): string {
  const teselas = PIECES.map((p) =>
    `<polygon points="${p.pts}" fill="${p.fill}" stroke="rgba(255,255,255,0.085)"`
    + ` stroke-width="1" stroke-linejoin="round"/>`,
  ).join("");
  const grabado =
    `<defs><pattern id="fachada-hatch" width="9" height="9" patternUnits="userSpaceOnUse"`
    + ` patternTransform="rotate(26)">`
    + `<line x1="0" y1="0" x2="0" y2="9" stroke="rgba(255,255,255,0.045)" stroke-width="1"/>`
    + `</pattern></defs>`;
  const textura = `<rect x="0" y="0" width="${VW}" height="${VH}" fill="url(#fachada-hatch)"/>`;
  const horizonte =
    `<polyline points="${horizonPts}" fill="none" stroke="#EBD288" stroke-width="2"`
    + ` stroke-linejoin="round" stroke-linecap="round" opacity="0.92"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}"`
    + ` viewBox="${pan?.x ?? 0} ${pan?.y ?? 0} ${VW} ${VH}"`
    + ` preserveAspectRatio="xMidYMid slice">`
    + `${grabado}${teselas}${textura}${horizonte}</svg>`;
}

/**
 * Y del horizonte en el tramo RECTO, en unidades del lienzo. Es dónde hay que
 * apoyar el wordmark para que la línea dorada lo cruce horizontal.
 *
 * En el hero esto se resuelve en el cliente midiendo el DOM (`calcularEncuadre`),
 * porque ahí el recorte depende del viewport. En una card de tamaño fijo no hay
 * nada que medir: el valor sale de la misma malla.
 */
export const FACHADA_HORIZONTE_Y_RECTO = lat(RECTO.ancla, HJ)[1];
