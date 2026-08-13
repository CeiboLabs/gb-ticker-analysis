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
 *
 * ⚠️ Este primitive sigue la Y DEL CURSOR. Si lo que se busca es una etiqueta
 * por serie pegada al valor de cada línea —lo que hace el gráfico del fondo—, el
 * que corresponde es CrosshairSeriesLabelsPrimitive, y los dos NO conviven: los
 * dos dibujan en el mismo lienzo y el segundo lo borra entero.
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
import {
  acotar,
  aRGB,
  contraste,
  geometríaY,
  medirChip,
  pintarCaja,
  pintarTexto,
  type LienzoDestino,
} from "@/components/chipEjePrecio";

/** CrosshairMode.Hidden. Va como número para no importar nada en runtime: los
 *  gráficos cargan lightweight-charts con import() dinámico y este archivo
 *  entra en el bundle inicial. */
const MIRA_OCULTA = 2;

interface Lectura {
  /** y de la mira en px de medios, cruda: es la que hay que acotar. */
  y: number;
  /** Texto ya formateado por el MISMO formateador que usa el eje. */
  texto: string;
  alignRight: boolean;
  mecha: boolean;
  fuente: string;
  fondo: string;
  tinta: string;
}

class EtiquetaMiraRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _dueño: CrosshairPriceLabelPrimitive) {}

  draw(target: LienzoDestino): void {
    const l = this._dueño.lectura();
    if (l === null) return;

    const geo = target.useBitmapCoordinateSpace(
      ({ context: ctx, bitmapSize, mediaSize, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
        if (mediaSize.height <= 0) return null;

        ctx.font = l.fuente;
        ctx.textBaseline = "middle";
        const medidas = medirChip(ctx, this._dueño.cuerpo(), l.texto, hpr, vpr, mediaSize.width, l.alignRight);

        const crudo = geometríaY(l.y, medidas, vpr); // dónde dibujó la librería
        const nuestro = acotar(crudo, bitmapSize.height);

        // Borrar el chip nativo. Este lienzo es el de arriba del eje y no lleva
        // nada más —la librería lo borra entero al empezar cada pintado y sólo
        // dibuja ahí la etiqueta de la mira—, así que limpiar su franja deja a
        // la vista el lienzo de atrás: las marcas del eje, intactas.
        ctx.clearRect(0, crudo.yTop - 1, bitmapSize.width, medidas.altoBitmap + 2);

        pintarCaja(
          ctx,
          bitmapSize.width,
          { geo: nuestro, medidas, alignRight: l.alignRight, mecha: l.mecha, fondo: l.fondo, tinta: l.tinta },
          hpr,
        );

        return { yTop: nuestro.yTop / vpr, yBottom: nuestro.yBottom / vpr, xText: medidas.xTexto };
      },
    );

    if (!geo) return;

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      ctx.font = l.fuente;
      pintarTexto(ctx, l.texto, geo.xText, (geo.yTop + geo.yBottom) / 2, l.tinta, l.alignRight);
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
