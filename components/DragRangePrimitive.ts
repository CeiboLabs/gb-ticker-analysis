/**
 * Custom lightweight-charts v5 series primitive that paints the span measured
 * by dragging across the chart — el gesto estándar de las webs financieras
 * (apretar, arrastrar, soltar) que reemplazó al viejo "click para fijar puntos".
 *
 * Tres capas, en dos z-orders:
 *
 *   1. Banda tenue entre los dos extremos, con los hairlines verticales de cada
 *      borde (zOrder "normal").
 *   2. Puntos en la intersección con la serie (zOrder "top"), idénticos al
 *      marcador del crosshair: mismo trazado y mismas opciones de la serie, así
 *      medir un tramo y pasar el cursor por la línea dan el MISMO punto.
 *
 * ⚠️ La banda va en "normal" y NO en "bottom", que es donde estuvo hasta el
 * 16-ago-2026, porque la librería pinta la GRILLA entre medio de los dos:
 * `sourceBottomPaneViews` → `drawGrid` → `sourcePaneViews`. Con la banda abajo,
 * las líneas de la grilla no recibían el velo y quedaban en su color de siempre
 * —medido en el gráfico del fondo: fondo #F4F5FB → #E4E6EE dentro de la banda,
 * pero la grilla seguía en #E7E8F2—, o sea MÁS CLARAS que la superficie que las
 * rodeaba: se leían como si flotaran por encima de la selección. En "normal" el
 * velo cae sobre todo lo que hay debajo, que es lo que hace un velo.
 *
 * El precio de subirla es que el velo también toca las curvas. Es el 7% de un
 * navy: sobre la línea del fondo —que es ese mismo navy— no cambia nada, y sobre
 * el benchmark coral apenas la oscurece (#D2796D → #C4736B). Los puntos medidos y
 * las etiquetas siguen arriba de todo, en "top".
 *
 * El cálculo del delta NO vive acá: este primitive sólo dibuja. La lectura
 * numérica la arma el componente, que ordena los extremos cronológicamente.
 */
import type {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  LineStyleOptions,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";

export interface RangePoint {
  time: Time;
  price: number;
}

export interface RangeSelection {
  from: RangePoint;
  to: RangePoint;
}

export interface DragRangeTheme {
  /** Relleno de la banda que cubre el tramo medido. */
  band: string;
  /** Hairline vertical en cada extremo. */
  edge: string;
  /** Relleno del punto — sólo se usa si la serie no define
   *  `crosshairMarkerBackgroundColor`; con ella manda la serie. */
  marker: string;
  /** Borde del punto — mismo criterio: cede ante
   *  `crosshairMarkerBorderColor` de la serie. */
  markerHalo: string;
}

/** Trazado del punto, tal como lo resuelve la serie para su crosshair. */
interface MarkerStyle {
  radius: number;
  borderWidth: number;
  fill: string;
  border: string;
}

// Defaults de lightweight-charts para series de línea (`crosshairMarkerRadius` /
// `crosshairMarkerBorderWidth`): sólo aplican si la serie todavía no respondió.
const DEFAULT_MARKER_RADIUS = 4;
const DEFAULT_MARKER_BORDER_WIDTH = 2;

const DEFAULT_THEME: DragRangeTheme = {
  band: "rgba(3, 6, 94, 0.07)",
  edge: "rgba(3, 6, 94, 0.32)",
  marker: "#03065E",
  markerHalo: "#FBFBFE",
};

interface Resolved {
  x0: number;
  x1: number;
  y0: number | null;
  y1: number | null;
}

/** Capa de fondo: banda + hairlines de los bordes. */
class BandRenderer implements IPrimitivePaneRenderer {
  private _r: Resolved | null = null;
  private _paneHeight = 0;
  private _theme: DragRangeTheme = DEFAULT_THEME;

  setData(r: Resolved | null, paneHeight: number, theme: DragRangeTheme) {
    this._r = r;
    this._paneHeight = paneHeight;
    this._theme = theme;
  }

  draw(target: CanvasRenderingTarget2D): void {
    const r = this._r;
    if (!r) return;

    target.useBitmapCoordinateSpace(
      ({ context: ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
        ctx.save();
        const h = Math.round(this._paneHeight * vpr);
        const xa = Math.round(Math.min(r.x0, r.x1) * hpr);
        const xb = Math.round(Math.max(r.x0, r.x1) * hpr);

        if (xb > xa) {
          ctx.fillStyle = this._theme.band;
          ctx.fillRect(xa, 0, xb - xa, h);
        }

        ctx.strokeStyle = this._theme.edge;
        ctx.lineWidth = Math.max(1, Math.floor(hpr));
        for (const x of [r.x0, r.x1]) {
          const px = Math.round(x * hpr) + 0.5;
          ctx.beginPath();
          ctx.moveTo(px, 0);
          ctx.lineTo(px, h);
          ctx.stroke();
        }

        ctx.restore();
      },
    );
  }
}

/** Capa superior: los puntos en la intersección con la serie.
 *
 *  Réplica exacta de `PaneRendererMarks` (el marcador que la librería pinta bajo
 *  el cursor): dos discos LLENOS —primero el del borde, encima el del relleno—,
 *  con la x redondeada más la corrección de medio pixel y el radio escalado por
 *  el ratio vertical. Copiar el trazado, y no aproximarlo con un anillo, es lo
 *  que hace que el extremo medido y el punto del hover sean indistinguibles. */
class MarkersRenderer implements IPrimitivePaneRenderer {
  private _r: Resolved | null = null;
  private _style: MarkerStyle | null = null;

  setData(r: Resolved | null, style: MarkerStyle) {
    this._r = r;
    this._style = style;
  }

  draw(target: CanvasRenderingTarget2D): void {
    const r = this._r;
    const style = this._style;
    if (!r || !style) return;

    target.useBitmapCoordinateSpace(
      ({ context: ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
        ctx.save();
        const pts: [number, number | null][] = [
          [r.x0, r.y0],
          [r.x1, r.y1],
        ];
        const tickWidth = Math.max(1, Math.floor(hpr));
        const correction = (tickWidth % 2) / 2;

        const disc = (radiusMedia: number, color: string) => {
          ctx.beginPath();
          ctx.fillStyle = color;
          for (const [x, y] of pts) {
            if (y == null) continue;
            const cx = Math.round(x * hpr) + correction;
            const cy = y * vpr;
            // moveTo antes de cada arco: sin él los dos extremos quedan unidos
            // por una recta al rellenar el path.
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radiusMedia * vpr + correction, 0, Math.PI * 2);
          }
          ctx.fill();
        };

        if (style.borderWidth > 0) disc(style.radius + style.borderWidth, style.border);
        disc(style.radius, style.fill);

        ctx.restore();
      },
    );
  }
}

function resolve(source: DragRangePrimitive): Resolved | null {
  const chart = source.chart;
  const series = source.series;
  const sel = source.selection;
  if (!chart || !series || !sel) return null;

  const ts = chart.timeScale();
  const x0 = ts.timeToCoordinate(sel.from.time);
  const x1 = ts.timeToCoordinate(sel.to.time);
  if (x0 === null || x1 === null) return null;

  return {
    x0,
    x1,
    y0: series.priceToCoordinate(sel.from.price),
    y1: series.priceToCoordinate(sel.to.price),
  };
}

class BandPaneView implements IPrimitivePaneView {
  private readonly _renderer = new BandRenderer();
  constructor(private readonly _source: DragRangePrimitive) {}
  zOrder() {
    // "normal" y no "bottom": la grilla se pinta entre los dos (ver el
    // comentario del encabezado). Abajo, el velo no la alcanzaba.
    return "normal" as const;
  }
  update() {
    const paneHeight = this._source.chart?.paneSize?.().height ?? 280;
    this._renderer.setData(resolve(this._source), paneHeight, this._source.theme);
  }
  renderer() {
    return this._renderer;
  }
}

class MarkersPaneView implements IPrimitivePaneView {
  private readonly _renderer = new MarkersRenderer();
  constructor(private readonly _source: DragRangePrimitive) {}
  zOrder() {
    return "top" as const;
  }
  update() {
    this._renderer.setData(resolve(this._source), this._source.markerStyle);
  }
  renderer() {
    return this._renderer;
  }
}

export class DragRangePrimitive implements ISeriesPrimitive<Time> {
  private _selection: RangeSelection | null = null;
  private _chart: IChartApiBase<Time> | null = null;
  private _series: ISeriesApi<"Line", Time> | null = null;
  private _requestUpdate: (() => void) | null = null;
  private readonly _theme: DragRangeTheme;
  private readonly _bandView = new BandPaneView(this);
  private readonly _markersView = new MarkersPaneView(this);
  private readonly _paneViews: IPrimitivePaneView[];

  constructor(theme?: Partial<DragRangeTheme>) {
    this._theme = { ...DEFAULT_THEME, ...(theme ?? {}) };
    this._paneViews = [this._bandView, this._markersView];
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._series = param.series as ISeriesApi<"Line", Time>;
    this._requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }

  setSelection(selection: RangeSelection | null): void {
    this._selection = selection;
    this._requestUpdate?.();
  }

  updateAllViews(): void {
    this._bandView.update();
    this._markersView.update();
  }

  paneViews() {
    return this._paneViews;
  }

  get selection(): RangeSelection | null {
    return this._selection;
  }
  get chart() {
    return this._chart;
  }
  get series() {
    return this._series;
  }
  get theme(): DragRangeTheme {
    return this._theme;
  }

  /** El punto del tramo sale de las MISMAS opciones con las que la serie pinta
   *  su marcador de crosshair: una sola fuente de verdad, así cambiar el estilo
   *  del hover arrastra al de la medición sin tocar este archivo. Los colores
   *  del tema quedan de reserva porque la librería admite el string vacío como
   *  "usá el color de la barra". */
  get markerStyle(): MarkerStyle {
    const opts = this._series?.options() as Partial<LineStyleOptions> | undefined;
    return {
      radius: opts?.crosshairMarkerRadius ?? DEFAULT_MARKER_RADIUS,
      borderWidth: opts?.crosshairMarkerBorderWidth ?? DEFAULT_MARKER_BORDER_WIDTH,
      fill: opts?.crosshairMarkerBackgroundColor || this._theme.marker,
      border: opts?.crosshairMarkerBorderColor || this._theme.markerHalo,
    };
  }
}
