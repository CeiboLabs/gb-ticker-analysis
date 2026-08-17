/**
 * Una etiqueta de precio POR SERIE, pegada al valor de cada línea.
 *
 * QUÉ CAMBIA. De fábrica, la mira de lightweight-charts pone UNA etiqueta en el
 * eje de precios y la pone en la Y CRUDA DEL CURSOR: dice a qué precio apunta el
 * mouse, que es un número que no está en ningún dato —moviendo el cursor en
 * vertical cambia sin que cambie nada del gráfico—. La etiqueta de FECHA, en
 * cambio, se pega al punto de la serie. Este primitive le da a la de precio el
 * mismo trato que a la de fecha: la clava en el valor de la línea, y con más de
 * una serie dibuja UNA POR CADA UNA, cada una a la altura de su propia curva
 * (pedido del cliente del fondo, 13-ago-2026: "que la etiqueta siga al line
 * chart… que aparezca la de ambos, estrategia y benchmark").
 *
 * DÓNDE DIBUJA, Y POR QUÉ AHÍ. En el lienzo de ARRIBA del eje
 * (priceAxisPaneViews con zOrder "top"). La alternativa evidente —priceAxisViews,
 * que es la API pensada para "poner una etiqueta en el eje" y que hasta trae
 * anti-solapamiento gratis— NO SIRVE para esto, y conviene dejarlo escrito para
 * no volver a intentarlo: esas etiquetas viven en el lienzo de atrás, que
 * PriceAxisWidget._paint sólo repinta cuando la invalidación es mayor que
 * `Cursor` (`if (type !== InvalidationLevel.Cursor)`). Mover la mira es
 * justamente una invalidación de nivel Cursor, así que las etiquetas se
 * quedarían clavadas donde estaban. El lienzo de arriba, en cambio, se borra y
 * se vuelve a pintar en CADA pintado, y los primitives de ese nivel se dibujan
 * después de la etiqueta nativa.
 *
 * ES EL DUEÑO DEL LIENZO: lo borra entero antes de dibujar, y eso BORRA LA
 * ETIQUETA NATIVA. Es a propósito —si no, quedarían tres chips, dos pegados a
 * las líneas y uno colgado del cursor— y es la razón por la que este primitive y
 * CrosshairPriceLabelPrimitive no pueden convivir en el mismo gráfico.
 *
 * ⚠️ LA ETIQUETA NATIVA SE DEJA PRENDIDA IGUAL (crosshair.horzLine.labelVisible
 * y .visible en true). No es olvido: `priceScaleCrosshairLabelVisible` —las dos
 * opciones en true— es lo ÚNICO que hace que el eje reserve el ancho de un
 * precio formateado. Sus marcas son enteras ("120", "140") y los chips llevan
 * decimales ("134,72"): apagándola, el eje se angosta a lo que miden las marcas
 * y los chips salen cortados de costado. Se paga dibujando encima, que es
 * gratis, y a cambio el modo de fallar sigue siendo bueno: si este primitive no
 * llega a correr, lo que queda es el chip de siempre y no un gráfico mudo.
 * Cuando la etiqueta nativa está apagada A MANO —los gráficos la apagan en
 * pantalla angosta para que el eje mida lo que miden sus marcas— este primitive
 * tampoco dibuja: lee la misma opción.
 */
import type {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  MouseEventParams,
  SeriesAttachedParameter,
  SeriesType,
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
  type GeoY,
  type LienzoDestino,
  type MedidasChip,
} from "@/components/chipEjePrecio";

/** CrosshairMode.Hidden. Va como número para no importar nada en runtime: los
 *  gráficos cargan lightweight-charts con import() dinámico y este archivo entra
 *  en el bundle inicial. */
const MIRA_OCULTA = 2;

export interface SerieEtiquetada {
  serie: ISeriesApi<SeriesType, Time>;
  /**
   * Fondo del chip. Se pasa desde afuera y NO se toma de `options().color` a
   * propósito: el chip es TEXTO de 12px y la línea es un trazo, y no tienen el
   * mismo piso de contraste. El coral aclarado de la línea del benchmark deja el
   * blanco en 3,2:1 —reprueba para texto—, así que su chip usa el coral pleno.
   * Que sean de la misma familia es lo que ata cada etiqueta a su curva.
   */
  fondo: string;
}

interface Chip {
  texto: string;
  fondo: string;
  tinta: string;
  /** y del valor de la serie, en px de medios. */
  y: number;
}

interface ChipUbicado {
  chip: Chip;
  medidas: MedidasChip;
  geo: GeoY;
}

class EtiquetasRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _dueño: CrosshairSeriesLabelsPrimitive) {}

  draw(target: LienzoDestino): void {
    // ⚠️ El corte va ACÁ y no más abajo: mientras la librería esté dibujando su
    // etiqueta nativa hay que entrar igual, aunque no haya ni un chip que poner,
    // porque entrar es lo único que la borra. Cortando por "no tengo chips" se
    // la deja a la vista, y eso fue un bug real: apenas empezaba la medición
    // —donde este primitive calla a propósito— volvía a aparecer el chip pegado
    // al cursor, encima con un precio que no era ninguno de los dos extremos.
    if (!this._dueño.dueñoDelLienzo()) return;

    const chips = this._dueño.chips();
    const fuente = this._dueño.fuente();
    const alignRight = this._dueño.alignRight();
    const mecha = this._dueño.mecha();

    const ubicados = target.useBitmapCoordinateSpace(
      ({ context: ctx, bitmapSize, mediaSize, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
        // Borrar TODO: se va con esto la etiqueta nativa de la mira (ver el
        // encabezado). El lienzo no lleva nada más — la librería lo limpia
        // entero al empezar cada pintado y sólo dibuja ahí ese chip.
        ctx.clearRect(0, 0, bitmapSize.width, bitmapSize.height);
        if (mediaSize.height <= 0 || chips.length === 0) return null;

        ctx.font = fuente;
        ctx.textBaseline = "middle";

        const ubicados: ChipUbicado[] = chips.map((chip) => {
          const medidas = medirChip(ctx, this._dueño.cuerpo(), chip.texto, hpr, vpr, mediaSize.width, alignRight);
          return { chip, medidas, geo: geometríaY(chip.y, medidas, vpr) };
        });

        separar(ubicados, bitmapSize.height);

        for (const u of ubicados) {
          pintarCaja(
            ctx,
            bitmapSize.width,
            { geo: u.geo, medidas: u.medidas, alignRight, mecha, fondo: u.chip.fondo, tinta: u.chip.tinta },
            hpr,
          );
        }
        return ubicados.map((u) => ({
          texto: u.chip.texto,
          tinta: u.chip.tinta,
          x: u.medidas.xTexto,
          yCentro: (u.geo.yTop + u.geo.yBottom) / 2 / vpr,
        }));
      },
    );

    if (!ubicados) return;

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      ctx.font = fuente;
      for (const u of ubicados) pintarTexto(ctx, u.texto, u.x, u.yCentro, u.tinta, alignRight);
    });
  }
}

/**
 * Separa los chips que se pisan y mete la pila entera en el lienzo.
 *
 * Hace falta porque las dos curvas se cruzan: cuando los valores quedan a menos
 * de un chip de distancia, dibujarlos en su y exacta los superpone y no se lee
 * ninguno de los dos. La librería tiene su propio pase para esto
 * (PriceAxisWidget._fixLabelOverlap) pero corre sobre SUS etiquetas, no sobre lo
 * que dibuja un primitive.
 *
 * La pila resultante queda CENTRADA sobre los valores, no colgando del de más
 * arriba: el desplazamiento se reparte entre los chips que se pisan.
 *
 * Muta `ubicados` y lo deja ordenado de arriba hacia abajo.
 */
function separar(ubicados: ChipUbicado[], altoLienzo: number): void {
  // Ordena por la y EXACTA del valor —`chip.y`, en px de medios— y NO por
  // `geo.yMid`, que ya viene cuajada a píxeles de dispositivo. En el cruce las
  // dos curvas quedan a una fracción de píxel: el 25-feb-2026 del backtest las
  // separan 0,02 de índice, que a esa escala son 0,7 px de dispositivo, y las
  // dos y redondean al MISMO entero. Con ese empate `sort` —estable— caía en el
  // orden de entrada, que es el de las series, y el chip de la estrategia
  // (103,61) salía ARRIBA del benchmark (103,63): el número más chico dibujado
  // más alto, justo lo que este pase existe para evitar. Y no era un empate
  // invisible, porque la guía punteada redondea en px de MEDIOS: llegaba en el
  // orden bueno y dejaba a cada chip apareado con la curva del OTRO.
  //
  // Con la y sin redondear el empate queda sólo cuando los dos valores son
  // iguales de verdad —el primer punto de una ventana en base 100, donde las
  // dos series valen 100,00— y ahí da lo mismo cuál va arriba.
  ubicados.sort((a, b) => a.chip.y - b.chip.y);

  const mover = (u: ChipUbicado, dy: number) => {
    u.geo = { yMid: u.geo.yMid + dy, yTop: u.geo.yTop + dy, yBottom: u.geo.yBottom + dy };
  };

  // 1. El que pisa al de arriba baja lo justo para apoyarse en él.
  const original = ubicados.map((u) => u.geo.yMid);
  for (let i = 1; i < ubicados.length; i++) {
    const solape = ubicados[i - 1].geo.yBottom - ubicados[i].geo.yTop;
    if (solape > 0) mover(ubicados[i], solape);
  }
  // 2. Y la pila entera vuelve a centrarse sobre los valores, subiendo lo que
  //    bajó en promedio. Sin esto, apilar hacia abajo deja al primero clavado en
  //    su y exacta y al segundo un chip entero más abajo, así que en un cruce
  //    —donde las dos curvas están a un pelo— el de arriba se queda con el lugar
  //    de los dos y el de abajo aterriza sobre la guía punteada del OTRO, que es
  //    justo el apareo que este pase tiene que dejar claro. Repartido, cada uno
  //    se corre medio chip y las dos guías quedan entre medio, que es la verdad:
  //    los valores están ahí, juntos, y los chips se abrieron para poder leerse.
  //
  //    En píxeles ENTEROS de dispositivo y aplicado a todos por igual: mover la
  //    caja media unidad la dibuja entre dos píxeles y el chip pierde el filo
  //    (por lo mismo que `acotar` corre la caja ya redondeada y no el centro).
  const corrida = Math.round(
    ubicados.reduce((suma, u, i) => suma + (u.geo.yMid - original[i]), 0) / ubicados.length,
  );
  if (corrida !== 0) for (const u of ubicados) mover(u, -corrida);

  // 3. Si la pila se pasó del piso, sube entera: se conserva el orden y las
  //    distancias, que es lo que mantiene a cada chip cerca de su curva.
  const exceso = ubicados[ubicados.length - 1].geo.yBottom - altoLienzo;
  if (exceso > 0) for (const u of ubicados) mover(u, -exceso);
  // 4. Y si con eso el primero se salió por arriba, baja entera. En este orden:
  //    contra un lienzo más corto que la pila gana el techo, que es donde el
  //    recorte se nota menos.
  const falta = -ubicados[0].geo.yTop;
  if (falta > 0) for (const u of ubicados) mover(u, falta);

  // 5. Y por si acaso, cada uno acotado al lienzo (con una sola serie no pasa
  //    por los pasos 2 a 4 con nada que corregir, y este es el mismo arreglo que
  //    hacía falta para el chip nativo contra los bordes).
  for (const u of ubicados) u.geo = acotar(u.geo, altoLienzo);
}

class EtiquetasView implements IPrimitivePaneView {
  private readonly _renderer: EtiquetasRenderer;

  constructor(dueño: CrosshairSeriesLabelsPrimitive) {
    this._renderer = new EtiquetasRenderer(dueño);
  }

  zOrder(): "top" {
    return "top";
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

/**
 * La guía punteada que va del punto sobre la curva hasta su etiqueta.
 *
 * Es lo que cierra la lectura: sin ella, el chip del eje y el punto de la curva
 * son dos cosas sueltas a la misma altura y con dos series hay que confiar en el
 * color para aparearlos. El punteado la deja como lo que es —una ayuda de
 * lectura, no un dato del gráfico—, que es la misma razón por la que la línea de
 * la serie NO va punteada.
 *
 * ES LA MISMA LÍNEA QUE LA VERTICAL DE LA MIRA, cambiándole sólo el color (el
 * de la etiqueta a la que va). Grosor y patrón NO se eligen acá: salen de
 * `crosshair.vertLine` del propio gráfico y se traducen a dasharray con la misma
 * tabla de la librería (getDashPattern). Es lo que hace que las dos lean como un
 * solo instrumento, y que sigan igualadas si algún día se le cambia el estilo a
 * la vertical: no hay un segundo número que actualizar.
 *
 * Va en el lienzo del panel (paneViews) y no en el del eje: cruza la zona de la
 * serie. zOrder "top" para que pase por encima de las dos curvas.
 */
class GuíasRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _dueño: CrosshairSeriesLabelsPrimitive) {}

  draw(target: LienzoDestino): void {
    const guías = this._dueño.guías();
    if (guías.length === 0) return;
    const trazo = this._dueño.trazoDeLaMira();

    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      ctx.save();
      ctx.lineWidth = trazo.grosor;
      ctx.setLineDash(trazo.guiones);
      for (const g of guías) {
        ctx.strokeStyle = g.color;
        ctx.beginPath();
        // La media corrección de la librería para que un trazo de grosor impar
        // caiga sobre el píxel y no entre dos (drawHorizontalLine).
        const corrección = trazo.grosor % 2 ? 0.5 : 0;
        // Arranca pasado el punto —si no, el punteado le muerde el borde— y
        // termina en el filo del panel, que es donde empieza el eje: el chip
        // cuelga justo de ahí, así que la guía y su etiqueta se tocan.
        ctx.moveTo(Math.round(g.x) + 7 + corrección, Math.round(g.y) + corrección);
        ctx.lineTo(mediaSize.width, Math.round(g.y) + corrección);
        ctx.stroke();
      }
      ctx.restore();
    });
  }
}

class GuíasView implements IPrimitivePaneView {
  private readonly _renderer: GuíasRenderer;

  constructor(dueño: CrosshairSeriesLabelsPrimitive) {
    this._renderer = new GuíasRenderer(dueño);
  }

  zOrder(): "top" {
    return "top";
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

export class CrosshairSeriesLabelsPrimitive implements ISeriesPrimitive<Time> {
  private _chart: IChartApiBase<Time> | null = null;
  private _valores: { objetivo: SerieEtiquetada; valor: number }[] = [];
  /** Índice lógico bajo la mira: de acá sale la x del punto, YA imantada al dato
   *  (la del cursor no lo está y la guía saldría corrida del punto). */
  private _logical: number | null = null;
  private readonly _views: IPrimitivePaneView[] = [new EtiquetasView(this)];
  private readonly _paneViews: IPrimitivePaneView[] = [new GuíasView(this)];

  /** @param _objetivos series a etiquetar, en el orden en que se dibujan. */
  constructor(private readonly _objetivos: readonly SerieEtiquetada[]) {}

  private readonly _onMira = (param: MouseEventParams<Time>): void => {
    // Se guarda el VALOR de cada serie bajo la mira; la coordenada y el formato
    // se resuelven al dibujar, así el chip no puede quedar contando una escala
    // vieja. `seriesData` ya trae el punto de cada serie en la fecha de la mira
    // —es la misma fuente que alimenta a la etiqueta de fecha—, así que no hay
    // que buscar nada a mano ni asumir que las series comparten fechas.
    const salida: { objetivo: SerieEtiquetada; valor: number }[] = [];
    for (const objetivo of this._objetivos) {
      const dato = param.seriesData.get(objetivo.serie);
      if (dato && "value" in dato && typeof dato.value === "number") {
        salida.push({ objetivo, valor: dato.value });
      }
    }
    this._valores = salida;
    this._logical = param.logical ?? null;
  };

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    param.chart.subscribeCrosshairMove(this._onMira);
  }

  detached(): void {
    this._chart?.unsubscribeCrosshairMove(this._onMira);
    this._chart = null;
    this._valores = [];
    this._logical = null;
  }

  priceAxisPaneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this._paneViews;
  }

  /**
   * Grosor y patrón de la línea VERTICAL de la mira, para que la guía sea la
   * misma línea. La tabla es la de la librería (getDashPattern), calcada acá
   * porque no la exporta:
   *   Solid [] · Dotted [w,w] · Dashed [2w,2w] · LargeDashed [6w,6w] ·
   *   SparseDotted [w,4w]
   */
  trazoDeLaMira(): { grosor: number; guiones: number[] } {
    const vert = this._chart?.options().crosshair.vertLine;
    const grosor = vert?.width ?? 1;
    const patrones: Record<number, number[]> = {
      0: [],
      1: [grosor, grosor],
      2: [2 * grosor, 2 * grosor],
      3: [6 * grosor, 6 * grosor],
      4: [grosor, 4 * grosor],
    };
    return { grosor, guiones: patrones[vert?.style ?? 0] ?? [] };
  }

  /** De dónde a dónde va cada guía punteada. Salen de los MISMOS chips, así que
   *  no pueden desfasarse: si no hay etiqueta, no hay guía. */
  guías(): { x: number; y: number; color: string }[] {
    const x = this._logical === null
      ? null
      : this._chart?.timeScale().logicalToCoordinate(this._logical as never) ?? null;
    if (x === null || x === undefined) return [];
    return this.chips().map((c) => ({ x, y: c.y, color: c.fondo }));
  }

  /** Cuerpo de la fuente del eje, que es de donde salen todas las medidas. */
  cuerpo(): number {
    return this._chart?.options().layout.fontSize ?? 12;
  }

  fuente(): string {
    const layout = this._chart?.options().layout;
    return `${layout?.fontSize ?? 12}px ${layout?.fontFamily ?? "sans-serif"}`;
  }

  /** El chip cuelga del borde del eje que da al gráfico: en la escala derecha
   *  crece hacia afuera (izquierda→derecha) y en la izquierda al revés. */
  alignRight(): boolean {
    return this._objetivos[0]?.serie.options().priceScaleId === "left";
  }

  /** La mechita se PINTA sólo si la escala tiene ticksVisible —apagado de
   *  fábrica—, pero su largo se reserva siempre. */
  mecha(): boolean {
    return this._objetivos[0]?.serie.priceScale().options().ticksVisible ?? false;
  }

  /**
   * ¿Este primitive tiene que hacerse cargo del lienzo en este pintado?
   *
   * Espejo exacto de las condiciones con las que la librería dibuja el chip
   * nativo: si ella no dibuja, acá no hay nada que tapar. Y si dibuja, entramos
   * SIEMPRE —haya chips o no—, porque borrarlo es parte del trabajo.
   */
  dueñoDelLienzo(): boolean {
    const opciones = this._chart?.options();
    if (!opciones) return false;
    const { crosshair } = opciones;
    return crosshair.mode !== MIRA_OCULTA && crosshair.horzLine.labelVisible;
  }

  /**
   * Qué chips van en este pintado.
   *
   * Ninguno mientras dure el gesto de medición: `attachDragRange` apaga ahí la
   * línea vertical de la mira —la banda del tramo la reemplaza— y le saca el
   * punto a las series. Las etiquetas se van con ellos, porque los dos extremos
   * medidos ya se leen en la caja del tramo y un chip pegado a una curva sin
   * punto queda señalando la nada. Se lee de la opción del gráfico y no de una
   * bandera propia: así hay una sola fuente de verdad sobre si la mira está
   * leyendo o midiendo.
   */
  chips(): Chip[] {
    if (this._chart?.options().crosshair.vertLine.visible !== true) return [];
    const salida: Chip[] = [];
    for (const { objetivo, valor } of this._valores) {
      const y = objetivo.serie.priceToCoordinate(valor);
      if (y === null) continue;
      const fondo = aRGB(objetivo.fondo);
      salida.push({
        // El formateador de la SERIE, que es el mismo que usaba el chip nativo:
        // el texto lleva los decimales que las marcas del eje no muestran.
        texto: objetivo.serie.priceFormatter().format(valor),
        fondo: fondo.css,
        tinta: contraste(fondo.rgb),
        y,
      });
    }
    return salida;
  }
}
