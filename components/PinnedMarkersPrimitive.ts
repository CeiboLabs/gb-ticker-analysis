/**
 * Custom lightweight-charts v5 series primitive that renders the pinned
 * comparison points used by PriceChart. Replaces the default
 * `createSeriesMarkers` filled blobs with a more institutional look:
 *
 *  · a thin vertical dashed guideline through the pinned date
 *  · a small ring marker at the price intersection (white border + colored fill)
 *
 * This pairs with horizontal `createPriceLine` markers added separately by the
 * caller, mimicking the comparison tool found in TradingView/Bloomberg.
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

export interface PinnedMarker {
  time: Time;
  price: number;
  color: string;
}

interface ResolvedMarker {
  x: number;
  y: number;
  color: string;
}

class PinnedMarkersRenderer implements IPrimitivePaneRenderer {
  private _markers: ResolvedMarker[] = [];
  private _paneHeight = 0;

  setData(markers: ResolvedMarker[], paneHeight: number) {
    this._markers = markers;
    this._paneHeight = paneHeight;
  }

  draw(target: CanvasRenderingTarget2D): void {
    if (this._markers.length === 0) return;

    target.useBitmapCoordinateSpace(
      ({ context: ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
        ctx.save();

        for (const m of this._markers) {
          const xb = Math.round(m.x * hpr) + 0.5;
          const yb = Math.round(m.y * vpr) + 0.5;
          const topY = 0;
          const bottomY = Math.round(this._paneHeight * vpr);

          // 1) Vertical dashed guideline — subtle, doesn't dominate the chart.
          ctx.beginPath();
          ctx.setLineDash([3 * vpr, 4 * vpr]);
          ctx.lineWidth = Math.max(1, Math.floor(hpr));
          ctx.strokeStyle = withAlpha(m.color, 0.45);
          ctx.moveTo(xb, topY);
          ctx.lineTo(xb, bottomY);
          ctx.stroke();
          ctx.setLineDash([]);

          // 2) Ring marker at the intersection — small, crisp, with a dark
          // outer halo so it reads cleanly over both the line and the bars.
          const ringR = 4 * vpr;
          const dotR = 2.25 * vpr;

          // Outer halo (chart-bg color, makes the ring pop against the line)
          ctx.beginPath();
          ctx.fillStyle = "#0B1B5C";
          ctx.arc(xb, yb, ringR + 1.5 * vpr, 0, Math.PI * 2);
          ctx.fill();

          // Colored ring
          ctx.beginPath();
          ctx.lineWidth = 1.5 * vpr;
          ctx.strokeStyle = m.color;
          ctx.arc(xb, yb, ringR, 0, Math.PI * 2);
          ctx.stroke();

          // Inner colored dot
          ctx.beginPath();
          ctx.fillStyle = m.color;
          ctx.arc(xb, yb, dotR, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      },
    );
  }
}

class PinnedMarkersPaneView implements IPrimitivePaneView {
  private readonly _renderer = new PinnedMarkersRenderer();

  constructor(private readonly _source: PinnedMarkersPrimitive) {}

  zOrder() {
    return "top" as const;
  }

  update() {
    const chart = this._source.chart;
    const series = this._source.series;
    if (!chart || !series) {
      this._renderer.setData([], 0);
      return;
    }

    const timeScale = chart.timeScale();
    const resolved: ResolvedMarker[] = [];
    for (const m of this._source.markers) {
      const x = timeScale.timeToCoordinate(m.time);
      const y = series.priceToCoordinate(m.price);
      if (x === null || y === null) continue;
      resolved.push({ x, y, color: m.color });
    }

    // pane height — read from the chart options as a fallback
    const paneHeight = chart.paneSize?.().height ?? 280;
    this._renderer.setData(resolved, paneHeight);
  }

  renderer() {
    return this._renderer;
  }
}

export class PinnedMarkersPrimitive implements ISeriesPrimitive<Time> {
  private _markers: PinnedMarker[] = [];
  private _chart: IChartApiBase<Time> | null = null;
  private _series: ISeriesApi<"Line", Time> | null = null;
  private _requestUpdate: (() => void) | null = null;
  private readonly _paneView = new PinnedMarkersPaneView(this);
  private readonly _paneViews = [this._paneView];

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

  setMarkers(markers: PinnedMarker[]): void {
    this._markers = markers;
    this._requestUpdate?.();
  }

  updateAllViews(): void {
    this._paneView.update();
  }

  paneViews() {
    return this._paneViews;
  }

  get markers(): readonly PinnedMarker[] {
    return this._markers;
  }
  get chart() {
    return this._chart;
  }
  get series() {
    return this._series;
  }
}

function withAlpha(color: string, alpha: number): string {
  // Accept hex (#rgb / #rrggbb). Fall back to the original string.
  if (color.startsWith("#")) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  return color;
}
