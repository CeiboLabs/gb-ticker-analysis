/**
 * Sombra proyectada de una serie de línea (lightweight-charts v5).
 *
 * QUÉ ES: la línea deja caer una sombra que sigue su contorno y se apaga unos
 * píxeles más abajo. NO es el área rellena hasta el piso del panel que usan
 * Google Finance o Bloomberg: acá los dos gráficos de la casa llevan una segunda
 * capa en el mismo panel —las barras de revenue en el informe de equity, la
 * línea del benchmark en el fondo— y un relleno hasta el eje se las tiñe. Una
 * barra de revenue mitad celeste y mitad navy, según la cruce o no la línea de
 * precio, lee como un error de dibujo. La sombra acotada le da peso a la serie
 * protagonista sin tocar lo que hay abajo.
 *
 * CÓMO: se recorta el lienzo a la zona DEBAJO de la curva y se dibuja el trazo
 * que proyecta la sombra LEVANTADO fuera de ese recorte, compensando con
 * `shadowOffsetY`. Así entra únicamente la sombra: el trazo fuente nunca se
 * pinta. Sin ese levante, la mitad inferior del trazo cae adentro del recorte y
 * —en la serie punteada del pre-market— rellena los huecos del punteado hasta
 * dejarlo casi sólido.
 *
 * Va en zOrder "bottom": debajo de la propia línea, que se mantiene nítida, y
 * debajo de las otras series del panel, que conservan su tono.
 */
import type {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";

export interface LineShadowPoint {
  /** Fecha "YYYY-MM-DD" (serie diaria) o Unix segundos (intradía). */
  time: string | number;
  value: number;
}

export interface LineShadowTheme {
  /** Color de la sombra, con su alfa. */
  color: string;
  /** Radio de desenfoque, en px de medios. */
  blur: number;
  /** Caída de la sombra respecto de la línea, en px de medios. */
  offset: number;
  /** Ancho del trazo que la proyecta — el mismo de la serie. */
  width: number;
}

const DEFAULT_THEME: LineShadowTheme = {
  color: "rgba(0, 0, 0, 0.35)",
  blur: 8,
  offset: 5,
  width: 2,
};

// Cuánto se levanta el trazo fuente por encima de la curva para que quede fuera
// del recorte. Alcanza con superar el medio ancho del trazo (más el redondeo de
// las uniones); se deja holgura sin irse lejos del lienzo, porque una fuente
// muy afuera es terreno de bugs de motor.
const SOURCE_LIFT = 10;

interface Pt {
  x: number;
  y: number;
}

class LineShadowRenderer implements IPrimitivePaneRenderer {
  private _segments: Pt[][] = [];
  private _paneHeight = 0;
  private _theme: LineShadowTheme = DEFAULT_THEME;

  setData(segments: Pt[][], paneHeight: number, theme: LineShadowTheme): void {
    this._segments = segments;
    this._paneHeight = paneHeight;
    this._theme = theme;
  }

  draw(target: CanvasRenderingTarget2D): void {
    if (this._segments.length === 0 || this._paneHeight <= 0) return;

    target.useBitmapCoordinateSpace(
      ({ context: ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
        const floor = Math.round(this._paneHeight * vpr);
        const lift = SOURCE_LIFT * vpr;

        for (const seg of this._segments) {
          if (seg.length < 2) continue;

          ctx.save();

          // Recorte: el polígono que va de la curva al piso del panel.
          ctx.beginPath();
          ctx.moveTo(seg[0].x * hpr, seg[0].y * vpr);
          for (let i = 1; i < seg.length; i++) {
            ctx.lineTo(seg[i].x * hpr, seg[i].y * vpr);
          }
          ctx.lineTo(seg[seg.length - 1].x * hpr, floor);
          ctx.lineTo(seg[0].x * hpr, floor);
          ctx.closePath();
          ctx.clip();

          // El trazo fuente va levantado —fuera del recorte— y la sombra baja
          // ese mismo levante más la caída buscada: sólo la sombra queda a la
          // vista. Su color es irrelevante; lo único que importa es su alfa,
          // que es lo que la sombra copia.
          ctx.shadowColor = this._theme.color;
          ctx.shadowBlur = this._theme.blur * vpr;
          ctx.shadowOffsetY = lift + this._theme.offset * vpr;
          ctx.strokeStyle = "#000";
          ctx.lineWidth = this._theme.width * hpr;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";

          ctx.beginPath();
          ctx.moveTo(seg[0].x * hpr, seg[0].y * vpr - lift);
          for (let i = 1; i < seg.length; i++) {
            ctx.lineTo(seg[i].x * hpr, seg[i].y * vpr - lift);
          }
          ctx.stroke();

          ctx.restore();
        }
      },
    );
  }
}

class LineShadowPaneView implements IPrimitivePaneView {
  private readonly _renderer = new LineShadowRenderer();

  constructor(private readonly _source: LineShadowPrimitive) {}

  zOrder() {
    return "bottom" as const;
  }

  update() {
    const chart = this._source.chart;
    const series = this._source.series;
    const points = this._source.points;
    const theme = this._source.theme;

    if (!chart || !series || points.length < 2) {
      this._renderer.setData([], 0, theme);
      return;
    }

    const ts = chart.timeScale();
    // Un punto sin coordenada (fuera de la escala) corta el tramo en vez de
    // unirlo con el siguiente: así la sombra nunca inventa un puente donde la
    // línea no lo dibuja.
    const segments: Pt[][] = [];
    let current: Pt[] = [];
    for (const p of points) {
      const x = ts.timeToCoordinate(p.time as unknown as Time);
      const y = series.priceToCoordinate(p.value);
      if (x == null || y == null) {
        if (current.length > 1) segments.push(current);
        current = [];
        continue;
      }
      current.push({ x, y });
    }
    if (current.length > 1) segments.push(current);

    this._renderer.setData(segments, chart.paneSize?.().height ?? 0, theme);
  }

  renderer() {
    return this._renderer;
  }
}

export class LineShadowPrimitive implements ISeriesPrimitive<Time> {
  private _points: LineShadowPoint[] = [];
  private _chart: IChartApiBase<Time> | null = null;
  private _series: ISeriesApi<"Line", Time> | null = null;
  private _requestUpdate: (() => void) | null = null;
  private readonly _theme: LineShadowTheme;
  private readonly _paneView = new LineShadowPaneView(this);
  private readonly _paneViews = [this._paneView];

  constructor(theme?: Partial<LineShadowTheme>) {
    this._theme = { ...DEFAULT_THEME, ...(theme ?? {}) };
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

  /** Los mismos puntos que dibuja la serie, en orden cronológico. */
  setPoints(points: LineShadowPoint[]): void {
    this._points = points;
    this._requestUpdate?.();
  }

  updateAllViews(): void {
    this._paneView.update();
  }

  paneViews() {
    return this._paneViews;
  }

  get points(): LineShadowPoint[] {
    return this._points;
  }
  get chart() {
    return this._chart;
  }
  get series() {
    return this._series;
  }
  get theme(): LineShadowTheme {
    return this._theme;
  }
}
