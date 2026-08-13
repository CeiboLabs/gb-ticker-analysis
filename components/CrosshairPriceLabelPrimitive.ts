/**
 * Etiqueta de PRECIO de la mira que no se corta contra el borde del gráfico.
 *
 * EL BUG ES DE LA LIBRERÍA, Y ES UNA ASIMETRÍA. lightweight-charts acota la
 * etiqueta de FECHA dentro del eje de tiempo —TimeAxisViewRenderer corrige la x
 * cuando el chip se sale por cualquiera de los dos lados— y también acota las
 * etiquetas del eje de precios que aportan las series: PriceAxisWidget lleva un
 * pase (_fixLabelOverlap) que a la etiqueta que pisa el borde le fija la
 * coordenada a media altura del chip. La de la MIRA no pasa por ninguno de los
 * dos: se dibuja aparte, en _drawCrosshairLabel, sobre el lienzo de ARRIBA del
 * eje y en la y cruda del cursor, sin recorte. Por eso, al llevar el cursor al
 * borde superior o inferior del gráfico, el chip del precio se dibuja mitad
 * afuera del lienzo y sale cortado, mientras que el de fecha nunca lo hace.
 *
 * EL ARREGLO. Un primitive que dibuja en ESE MISMO lienzo —priceAxisPaneViews
 * con zOrder "top", que la librería pinta justo después de la etiqueta nativa—,
 * borra el chip nativo y lo vuelve a dibujar con la y acotada al lienzo.
 *
 * La etiqueta nativa se deja PRENDIDA a propósito, por dos motivos:
 *
 *   · es la que hace que la escala reserve el ancho del chip —_optimalWidth
 *     mide el precio más ancho del rango visible SÓLO si crosshair.horzLine
 *     .labelVisible—, así que apagarla achica el eje y entonces el chip sale
 *     cortado de costado, que es peor que el corte de arriba;
 *   · deja el mejor modo de fallar: si este primitive no llega a correr, lo que
 *     queda es el chip de siempre, no un gráfico sin lectura de precio.
 *
 * Y cuando la etiqueta nativa está apagada a mano —en pantalla angosta los dos
 * gráficos la apagan para que el eje mida lo que miden sus marcas— este
 * primitive tampoco dibuja: lee la misma opción del gráfico.
 *
 * Repintado: no pide ninguno. El lienzo de arriba del eje se borra y se vuelve a
 * pintar en CADA pintado, incluidos los de nivel cursor —que son los que dispara
 * mover la mira—, y el renderer lee la posición viva en el momento de dibujar.
 * Así el chip va clavado a la mira, sin el frame de atraso ni el repintado
 * completo que costaría pasar por priceAxisViews (que van en el lienzo de atrás
 * y sólo se redibujan con una invalidación mayor).
 */
import type {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  MouseEventParams,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";

// Medidas del chip, calcadas de la librería (RendererConstants y
// PriceAxisRendererOptionsProvider). Los paddings son proporciones del cuerpo de
// la fuente —a 12px dan los 2,5 y 5 px que documenta el código de la librería—,
// así que el chip que se dibuja acá acompaña a layout.fontSize igual que el
// nativo y no hay ningún número mágico que se desincronice.
const BORDE = 1; // borderSize
const MECHA = 5; // tickLength — la mechita que apunta al eje
const RADIO = 2; // esquinas, del lado de afuera del gráfico
const PAD_V = 2.5 / 12; // paddingTop / paddingBottom
const PAD_MIRA = 2 / 12; // el extra que agrega la vista de la mira, arriba y abajo
const PAD_H = 5 / 12; // paddingInner / paddingOuter (= fontSize/12 · tickLength)
/** Alto del chip en múltiplos del cuerpo: cuerpo + los cuatro paddings = 1,75. */
const ALTO = 1 + 2 * PAD_V + 2 * PAD_MIRA;

/** CrosshairMode.Hidden. Va como número para no importar nada en runtime: los
 *  gráficos cargan lightweight-charts con import() dinámico y este archivo
 *  entra en el bundle inicial. */
const MIRA_OCULTA = 2;

/**
 * La librería no mide el texto tal cual: le cambia los dígitos 2-9 por 0 y
 * cachea el ancho por esa forma normalizada, dando por sentado que los dígitos
 * miden todos lo mismo. En una tipografía proporcional NO es cierto —el 1 es más
 * angosto—, así que medir el texto real da un chip hasta 1px distinto del que
 * dibuja ella. Se normaliza igual: el chip tiene que quedar del mismo ancho
 * cuando la mira NO está contra el borde, o se notaría un salto al entrar y
 * salir de la franja. (Medido: sin esto, 55px contra 54px en «175,24».)
 */
const normalizar = (texto: string) => texto.replace(/[2-9]/g, "0");

interface Lectura {
  /** y de la mira en px de medios, cruda: es la que hay que acotar. */
  y: number;
  /** Texto ya formateado por el MISMO formateador que usa el eje. */
  texto: string;
  /** El chip cuelga del borde del eje que da al gráfico: en la escala derecha
   *  crece hacia afuera (izquierda→derecha) y en la izquierda al revés. */
  alignRight: boolean;
  /** La mechita se PINTA sólo si la escala tiene ticksVisible —que viene
   *  apagado de fábrica—, pero su largo se reserva siempre: la librería lo suma
   *  al ancho del chip y al arranque del texto aunque no la dibuje. */
  mecha: boolean;
  fuente: string;
  fondo: string;
  tinta: string;
}

interface GeoY {
  yMid: number;
  yTop: number;
  yBottom: number;
}

class EtiquetaMiraRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _dueño: CrosshairPriceLabelPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    const l = this._dueño.lectura();
    if (l === null) return;

    // Geometría: copia de PriceAxisViewRenderer._calculateGeometry con la y
    // acotada. El texto se mide en el espacio de bitmap —transform identidad—
    // igual que la librería: con la fuente declarada en px, el ancho que
    // devuelve measureText queda en las mismas unidades que el cuerpo, que es
    // lo que después se multiplica por la densidad.
    const geo = target.useBitmapCoordinateSpace(
      ({ context: ctx, bitmapSize, mediaSize, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
        if (mediaSize.height <= 0) return null;

        ctx.font = l.fuente;
        ctx.textBaseline = "middle";
        const cuerpo = this._dueño.cuerpo();
        const anchoTexto = Math.ceil(ctx.measureText(normalizar(l.texto)).width);
        const padH = cuerpo * PAD_H;
        const anchoTotal = BORDE + 2 * padH + anchoTexto + MECHA;
        const altoTotal = cuerpo * ALTO;

        const altoMecha = Math.max(1, Math.floor(vpr));
        let altoBitmap = Math.round(altoTotal * vpr);
        // Mismo ajuste de paridad que la librería: el chip y la mechita tienen
        // que compartir paridad para que la mechita caiga centrada y nítida.
        if (altoBitmap % 2 !== altoMecha % 2) altoBitmap += 1;
        const anchoBitmap = Math.round(anchoTotal * hpr);
        const mechaBitmap = Math.round(MECHA * hpr);

        const geoY = (yMedia: number): GeoY => {
          const yMid = Math.round(yMedia * vpr) - Math.floor(vpr * 0.5);
          const yTop = Math.floor(yMid + altoMecha / 2 - altoBitmap / 2);
          return { yMid, yTop, yBottom: yTop + altoBitmap };
        };

        // ACÁ ESTÁ EL ARREGLO, y va sobre la caja YA redondeada a píxeles de
        // dispositivo, no sobre el centro en px de medios: acotar el centro deja
        // el chip medio píxel afuera cuando el redondeo cae para el lado
        // equivocado (medido: contra el borde de abajo entraban 20 de las 21
        // filas). Se corre la caja entera hasta que entre, que es exactamente lo
        // que hace la librería con la etiqueta de FECHA contra los costados.
        const crudo = geoY(l.y); // dónde dibujó la librería
        let corrimiento = 0;
        if (crudo.yTop < 0) corrimiento = -crudo.yTop;
        else if (crudo.yBottom > bitmapSize.height) corrimiento = bitmapSize.height - crudo.yBottom;
        const nuestro: GeoY = {
          yMid: crudo.yMid + corrimiento,
          yTop: crudo.yTop + corrimiento,
          yBottom: crudo.yBottom + corrimiento,
        };

        // Borrar el chip nativo. Este lienzo es el de arriba del eje y no lleva
        // nada más —la librería lo borra entero al empezar cada pintado y sólo
        // dibuja ahí la etiqueta de la mira—, así que limpiar su franja deja a
        // la vista el lienzo de atrás: las marcas del eje, intactas.
        ctx.clearRect(0, crudo.yTop - 1, bitmapSize.width, altoBitmap + 2);

        const xInside = l.alignRight ? bitmapSize.width : 0;
        const xOutside = l.alignRight ? xInside - anchoBitmap : xInside + anchoBitmap;
        const xMecha = l.alignRight ? xInside - mechaBitmap : xInside + mechaBitmap;

        const radio = RADIO * hpr;
        const radios: [number, number, number, number] = l.alignRight
          ? [radio, 0, 0, radio]
          : [0, radio, radio, 0];

        rectánguloRedondeado(
          ctx,
          Math.min(xInside, xOutside),
          nuestro.yTop,
          anchoBitmap,
          altoBitmap,
          radios,
        );
        ctx.fillStyle = l.fondo;
        ctx.fill();

        if (l.mecha) {
          // Acompaña al chip, no a la mira: si el chip se corrió para no
          // salirse, una mechita clavada en la y cruda quedaría suelta afuera.
          ctx.fillStyle = l.tinta;
          ctx.fillRect(xInside, nuestro.yMid, xMecha - xInside, altoMecha);
        }

        return {
          yTop: nuestro.yTop / vpr,
          yBottom: nuestro.yBottom / vpr,
          xText: l.alignRight ? mediaSize.width - MECHA - padH : MECHA + padH,
        };
      },
    );

    if (!geo) return;

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      ctx.font = l.fuente;
      ctx.textAlign = l.alignRight ? "right" : "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = l.tinta;
      // Corrección óptica de la librería: centrar por la caja real de los
      // glifos y no por la métrica de la fuente, que en los números deja el
      // texto un pelo alto. Sobre el texto normalizado, como ella.
      const m = ctx.measureText(normalizar(l.texto));
      const corrección = ((m.actualBoundingBoxAscent || 0) - (m.actualBoundingBoxDescent || 0)) / 2;
      ctx.fillText(l.texto, geo.xText, (geo.yTop + geo.yBottom) / 2 + corrección);
    });
  }
}

class EtiquetaMiraView implements IPrimitivePaneView {
  private readonly _renderer: EtiquetaMiraRenderer;

  constructor(dueño: CrosshairPriceLabelPrimitive) {
    this._renderer = new EtiquetaMiraRenderer(dueño);
  }

  // "top" es el lienzo donde la librería dibuja la etiqueta nativa, y los
  // primitives de ese nivel se pintan DESPUÉS que ella: es lo que permite
  // taparla.
  zOrder(): "top" {
    return "top";
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

export class CrosshairPriceLabelPrimitive implements ISeriesPrimitive<Time> {
  private _chart: IChartApiBase<Time> | null = null;
  private _series: SeriesAttachedParameter<Time>["series"] | null = null;
  private _y: number | null = null;
  private readonly _views: IPrimitivePaneView[] = [new EtiquetaMiraView(this)];

  private readonly _onMira = (param: MouseEventParams<Time>): void => {
    // Se guarda la y y nada más: el precio y su formato se resuelven al
    // dibujar, así el chip no puede quedar contando una escala vieja.
    this._y = param.point?.y ?? null;
  };

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._series = param.series;
    param.chart.subscribeCrosshairMove(this._onMira);
  }

  detached(): void {
    this._chart?.unsubscribeCrosshairMove(this._onMira);
    this._chart = null;
    this._series = null;
    this._y = null;
  }

  priceAxisPaneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }

  /** Cuerpo de la fuente del eje, que es de donde salen todas las medidas. */
  cuerpo(): number {
    return this._chart?.options().layout.fontSize ?? 12;
  }

  /** Qué hay que dibujar en este pintado, o null si no va nada. */
  lectura(): Lectura | null {
    const chart = this._chart;
    const series = this._series;
    if (chart === null || series === null || this._y === null) return null;

    const { crosshair, layout } = chart.options();
    // Espejo exacto de las condiciones con las que la librería dibuja el chip
    // nativo: si ella no lo dibuja, acá tampoco hay nada que tapar ni reponer.
    if (crosshair.mode === MIRA_OCULTA || !crosshair.horzLine.labelVisible) return null;

    const precio = series.coordinateToPrice(this._y);
    if (precio === null) return null;

    const fondo = aRGB(crosshair.horzLine.labelBackgroundColor);
    return {
      y: this._y,
      // El formateador de la serie es el mismo que usa la escala para el chip
      // nativo, así que el texto es idéntico —incluidos los decimales que el
      // eje no muestra en sus marcas—.
      texto: series.priceFormatter().format(precio),
      alignRight: series.options().priceScaleId === "left",
      mecha: series.priceScale().options().ticksVisible,
      fuente: `${layout.fontSize}px ${layout.fontFamily}`,
      fondo: fondo.css,
      tinta: contraste(fondo.rgb),
    };
  }
}

/** Rectángulo redondeado con radios por esquina, con la reserva de la librería
 *  para los motores sin roundRect (Safari anterior al 16.4). */
function rectánguloRedondeado(
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
function aRGB(color: string): { css: string; rgb: [number, number, number] } {
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
function contraste([r, g, b]: [number, number, number]): string {
  return 0.199 * r + 0.687 * g + 0.114 * b > 160 ? "black" : "white";
}
