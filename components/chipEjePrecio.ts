/**
 * La RECETA DE PÍXELES del chip del eje de precios, compartida por los dos
 * primitives que dibujan etiquetas ahí adentro:
 *
 *   · CrosshairPriceLabelPrimitive — repone la etiqueta de la mira acotada al
 *     lienzo (el gráfico de /analisis y cualquiera que quiera el chip nativo
 *     sin el corte contra el borde);
 *   · CrosshairSeriesLabelsPrimitive — una etiqueta POR SERIE, pegada al valor
 *     de cada línea (el gráfico del fondo).
 *
 * Acá vive sólo lo que los dos hacen IGUAL: medir el chip, ubicarlo en píxeles
 * de dispositivo y pintarlo. Lo que cada uno decide —cuántos chips, en qué y, y
 * qué se borra antes— se queda en su archivo, porque es justamente donde
 * difieren.
 *
 * Todas las medidas están calcadas de la librería (RendererConstants y
 * PriceAxisRendererOptionsProvider). Los paddings son proporciones del cuerpo de
 * la fuente —a 12px dan los 2,5 y 5 px que documenta su código—, así que el chip
 * acompaña a `layout.fontSize` igual que el nativo y no hay ningún número mágico
 * que se desincronice.
 */
import type { CanvasRenderingTarget2D } from "fancy-canvas";

export const BORDE = 1; // borderSize
export const MECHA = 5; // tickLength — la mechita que apunta al eje
export const RADIO = 2; // esquinas, del lado de afuera del gráfico
const PAD_V = 2.5 / 12; // paddingTop / paddingBottom
const PAD_MIRA = 2 / 12; // el extra que agrega la vista de la mira, arriba y abajo
const PAD_H = 5 / 12; // paddingInner / paddingOuter (= fontSize/12 · tickLength)
/** Alto del chip en múltiplos del cuerpo: cuerpo + los cuatro paddings = 1,75. */
export const ALTO = 1 + 2 * PAD_V + 2 * PAD_MIRA;

/**
 * La librería no mide el texto tal cual: le cambia los dígitos 2-9 por 0 y
 * cachea el ancho por esa forma normalizada, dando por sentado que los dígitos
 * miden todos lo mismo. En una tipografía proporcional NO es cierto —el 1 es más
 * angosto—, así que medir el texto real da un chip hasta 1px distinto del que
 * dibuja ella. Se normaliza igual: el chip tiene que quedar del mismo ancho
 * cuando la mira NO está contra el borde, o se notaría un salto al entrar y
 * salir de la franja. (Medido: sin esto, 55px contra 54px en «175,24».)
 */
export const normalizar = (texto: string) => texto.replace(/[2-9]/g, "0");

/** Medidas del chip, ya en píxeles de dispositivo. */
export interface MedidasChip {
  anchoBitmap: number;
  altoBitmap: number;
  altoMecha: number;
  mechaBitmap: number;
  /** Arranque del texto, en px de MEDIOS (el texto se pinta en ese espacio). */
  xTexto: number;
}

/** Caja vertical del chip en píxeles de dispositivo. */
export interface GeoY {
  yMid: number;
  yTop: number;
  yBottom: number;
}

/**
 * Mide un chip para un texto dado. `ctx` tiene que venir con la fuente ya
 * puesta y en el espacio de bitmap (transform identidad), igual que la librería:
 * con la fuente declarada en px, el ancho que devuelve measureText queda en las
 * mismas unidades que el cuerpo, que es lo que después se multiplica por la
 * densidad.
 */
export function medirChip(
  ctx: CanvasRenderingContext2D,
  cuerpo: number,
  texto: string,
  hpr: number,
  vpr: number,
  mediaWidth: number,
  alignRight: boolean,
): MedidasChip {
  const anchoTexto = Math.ceil(ctx.measureText(normalizar(texto)).width);
  const padH = cuerpo * PAD_H;
  const anchoTotal = BORDE + 2 * padH + anchoTexto + MECHA;
  const altoTotal = cuerpo * ALTO;

  const altoMecha = Math.max(1, Math.floor(vpr));
  let altoBitmap = Math.round(altoTotal * vpr);
  // Mismo ajuste de paridad que la librería: el chip y la mechita tienen que
  // compartir paridad para que la mechita caiga centrada y nítida.
  if (altoBitmap % 2 !== altoMecha % 2) altoBitmap += 1;

  return {
    anchoBitmap: Math.round(anchoTotal * hpr),
    altoBitmap,
    altoMecha,
    mechaBitmap: Math.round(MECHA * hpr),
    xTexto: alignRight ? mediaWidth - MECHA - padH : MECHA + padH,
  };
}

/** Dónde cae la caja del chip para un centro dado en px de medios. */
export function geometríaY(yMedia: number, medidas: MedidasChip, vpr: number): GeoY {
  const yMid = Math.round(yMedia * vpr) - Math.floor(vpr * 0.5);
  const yTop = Math.floor(yMid + medidas.altoMecha / 2 - medidas.altoBitmap / 2);
  return { yMid, yTop, yBottom: yTop + medidas.altoBitmap };
}

/** Corre la caja entera —no el centro— hasta que entre en el lienzo.
 *
 *  Va sobre la caja YA redondeada a píxeles de dispositivo: acotar el centro en
 *  px de medios deja el chip medio píxel afuera cuando el redondeo cae para el
 *  lado equivocado (medido: contra el borde de abajo entraban 20 de las 21
 *  filas). Es exactamente lo que hace la librería con la etiqueta de FECHA
 *  contra los costados. */
export function acotar(geo: GeoY, altoLienzo: number): GeoY {
  let corrimiento = 0;
  if (geo.yTop < 0) corrimiento = -geo.yTop;
  else if (geo.yBottom > altoLienzo) corrimiento = altoLienzo - geo.yBottom;
  if (corrimiento === 0) return geo;
  return {
    yMid: geo.yMid + corrimiento,
    yTop: geo.yTop + corrimiento,
    yBottom: geo.yBottom + corrimiento,
  };
}

export interface PinturaChip {
  geo: GeoY;
  medidas: MedidasChip;
  /** El chip cuelga del borde del eje que da al gráfico: en la escala derecha
   *  crece hacia afuera (izquierda→derecha) y en la izquierda al revés. */
  alignRight: boolean;
  /** La mechita se PINTA sólo si la escala tiene ticksVisible —que viene apagado
   *  de fábrica—, pero su largo se reserva siempre: la librería lo suma al ancho
   *  del chip y al arranque del texto aunque no la dibuje. */
  mecha: boolean;
  fondo: string;
  tinta: string;
}

/** Pinta la caja del chip (y su mechita) en el espacio de BITMAP. El texto va
 *  aparte, en el espacio de medios — ver `pintarTexto`. */
export function pintarCaja(
  ctx: CanvasRenderingContext2D,
  anchoLienzo: number,
  { geo, medidas, alignRight, mecha, fondo, tinta }: PinturaChip,
  hpr: number,
): void {
  const xInside = alignRight ? anchoLienzo : 0;
  const xOutside = alignRight ? xInside - medidas.anchoBitmap : xInside + medidas.anchoBitmap;
  const xMecha = alignRight ? xInside - medidas.mechaBitmap : xInside + medidas.mechaBitmap;

  const radio = RADIO * hpr;
  const radios: [number, number, number, number] = alignRight
    ? [radio, 0, 0, radio]
    : [0, radio, radio, 0];

  rectánguloRedondeado(
    ctx,
    Math.min(xInside, xOutside),
    geo.yTop,
    medidas.anchoBitmap,
    medidas.altoBitmap,
    radios,
  );
  ctx.fillStyle = fondo;
  ctx.fill();

  if (mecha) {
    // Acompaña al CHIP, no a la mira: si el chip se corrió para no salirse, una
    // mechita clavada en la y cruda quedaría suelta afuera.
    ctx.fillStyle = tinta;
    ctx.fillRect(xInside, geo.yMid, xMecha - xInside, medidas.altoMecha);
  }
}

/** Escribe el texto centrado en la caja, en el espacio de MEDIOS. */
export function pintarTexto(
  ctx: CanvasRenderingContext2D,
  texto: string,
  x: number,
  yCentro: number,
  tinta: string,
  alignRight: boolean,
): void {
  ctx.textAlign = alignRight ? "right" : "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = tinta;
  // Corrección óptica de la librería: centrar por la caja real de los glifos y
  // no por la métrica de la fuente, que en los números deja el texto un pelo
  // alto. Sobre el texto normalizado, como ella.
  const m = ctx.measureText(normalizar(texto));
  const corrección = ((m.actualBoundingBoxAscent || 0) - (m.actualBoundingBoxDescent || 0)) / 2;
  ctx.fillText(texto, x, yCentro + corrección);
}

/** Rectángulo redondeado con radios por esquina, con la reserva de la librería
 *  para los motores sin roundRect (Safari anterior al 16.4). */
export function rectánguloRedondeado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radios: [number, number, number, number],
): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, radios);
    return;
  }
  const [ai, ad, bd, bi] = radios;
  ctx.moveTo(x + ai, y);
  ctx.lineTo(x + w - ad, y);
  if (ad !== 0) ctx.arcTo(x + w, y, x + w, y + ad, ad);
  ctx.lineTo(x + w, y + h - bd);
  if (bd !== 0) ctx.arcTo(x + w, y + h, x + w - bd, y + h, bd);
  ctx.lineTo(x + bi, y + h);
  if (bi !== 0) ctx.arcTo(x, y + h, x, y + h - bi, bi);
  ctx.lineTo(x, y + ai);
  if (ai !== 0) ctx.arcTo(x, y, x + ai, y, ai);
  ctx.closePath();
}

/** Color del chip sin alfa, como lo deja generateContrastColors. */
export function aRGB(color: string): { css: string; rgb: [number, number, number] } {
  const rgb = parseColor(color);
  return { css: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`, rgb };
}

function parseColor(color: string): [number, number, number] {
  if (color.startsWith("#")) {
    let hex = color.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .slice(0, 3)
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (hex.length >= 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
  }
  const nums = color.match(/[\d.]+/g);
  if (nums && nums.length >= 3) {
    return [Number(nums[0]), Number(nums[1]), Number(nums[2])];
  }
  return [0, 0, 0];
}

/** Misma fórmula NTSC que la librería para elegir tinta sobre el fondo del chip. */
export function contraste([r, g, b]: [number, number, number]): string {
  return 0.199 * r + 0.687 * g + 0.114 * b > 160 ? "black" : "white";
}

/** Tipo del `target` que la librería le pasa al renderer, re-exportado para que
 *  los primitives no tengan que importar fancy-canvas por su cuenta. */
export type LienzoDestino = CanvasRenderingTarget2D;
