/**
 * Custom lightweight-charts v5 series primitive that paints subtle visual
 * cues for extended-hours sessions (pre-market and after-hours) on intraday
 * charts. Three layers, drawn at the bottom z-order so the price line stays
 * visible on top:
 *
 *   1. Low-opacity background bands (~10 % black) over pre/post regions —
 *      the eye registers the boundary without the band reading as "missing
 *      data". Industry norm (TradingView ships at ~8 %).
 *   2. 1 px white hairlines at 9:30 ET and 16:00 ET — Bloomberg-style
 *      session-boundary ticks. Helps non-US audiences who don't know NYSE
 *      hours by heart.
 *   3. Small "PRE / REGULAR / AFTER" labels at the top of each band, in the
 *      same low-contrast white as other chart chrome.
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

export interface SessionBounds {
  /** First timestamp present in the series (Unix seconds for intraday). */
  firstTime: Time | null;
  /** Regular trading session start (Unix seconds). */
  regularStart: Time | null;
  /** Regular trading session end (Unix seconds). */
  regularEnd: Time | null;
  /** Last timestamp present in the series. */
  lastTime: Time | null;
}

interface ResolvedBand {
  x0: number;
  x1: number;
}

interface ResolvedLabel {
  cx: number;
  text: string;
}

class SessionShadingRenderer implements IPrimitivePaneRenderer {
  private _bands: ResolvedBand[] = [];
  private _hairlines: number[] = [];
  private _labels: ResolvedLabel[] = [];
  private _paneHeight = 0;

  setData(
    bands: ResolvedBand[],
    hairlines: number[],
    labels: ResolvedLabel[],
    paneHeight: number,
  ) {
    this._bands = bands;
    this._hairlines = hairlines;
    this._labels = labels;
    this._paneHeight = paneHeight;
  }

  draw(target: CanvasRenderingTarget2D): void {
    if (this._bands.length === 0 && this._hairlines.length === 0 && this._labels.length === 0) {
      return;
    }

    target.useBitmapCoordinateSpace(
      ({ context: ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
        ctx.save();
        const h = Math.round(this._paneHeight * vpr);

        // 1. Background tint over extended-hours bands.
        if (this._bands.length > 0) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.10)";
          for (const b of this._bands) {
            const x0 = Math.round(b.x0 * hpr);
            const x1 = Math.round(b.x1 * hpr);
            if (x1 <= x0) continue;
            ctx.fillRect(x0, 0, x1 - x0, h);
          }
        }

        // 2. Vertical hairlines at session boundaries.
        if (this._hairlines.length > 0) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
          ctx.lineWidth = Math.max(1, Math.floor(hpr));
          for (const x of this._hairlines) {
            const px = Math.round(x * hpr) + 0.5;
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, h);
            ctx.stroke();
          }
        }

        // 3. Session labels at top of pane.
        if (this._labels.length > 0) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
          ctx.font = `600 ${9 * vpr}px Helvetica, Arial, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          const labelY = 6 * vpr;
          for (const lbl of this._labels) {
            ctx.fillText(lbl.text, Math.round(lbl.cx * hpr), labelY);
          }
        }

        ctx.restore();
      },
    );
  }
}

class SessionShadingPaneView implements IPrimitivePaneView {
  private readonly _renderer = new SessionShadingRenderer();

  constructor(private readonly _source: SessionShadingPrimitive) {}

  zOrder() {
    return "bottom" as const;
  }

  update() {
    const chart = this._source.chart;
    const series = this._source.series;
    const bounds = this._source.bounds;
    if (!chart || !series || !bounds) {
      this._renderer.setData([], [], [], 0);
      return;
    }

    const ts = chart.timeScale();
    const xFirst = bounds.firstTime != null ? ts.timeToCoordinate(bounds.firstTime) : null;
    const xLast = bounds.lastTime != null ? ts.timeToCoordinate(bounds.lastTime) : null;
    const xRegStart = bounds.regularStart != null ? ts.timeToCoordinate(bounds.regularStart) : null;
    const xRegEnd = bounds.regularEnd != null ? ts.timeToCoordinate(bounds.regularEnd) : null;

    const bands: ResolvedBand[] = [];
    const hairlines: number[] = [];
    const labels: ResolvedLabel[] = [];

    // Minimum band width (media px) before a label fits without crowding.
    const MIN_LABEL_WIDTH = 38;

    // Pre-market band
    if (xFirst != null && xRegStart != null && xRegStart > xFirst) {
      bands.push({ x0: xFirst, x1: xRegStart });
      hairlines.push(xRegStart);
      if (xRegStart - xFirst >= MIN_LABEL_WIDTH) {
        labels.push({ cx: (xFirst + xRegStart) / 2, text: "PRE" });
      }
    }

    // After-hours band
    if (xLast != null && xRegEnd != null && xLast > xRegEnd) {
      bands.push({ x0: xRegEnd, x1: xLast });
      hairlines.push(xRegEnd);
      if (xLast - xRegEnd >= MIN_LABEL_WIDTH) {
        labels.push({ cx: (xRegEnd + xLast) / 2, text: "AFTER" });
      }
    }

    // Regular session label (no shading — that's the default chart background).
    if (xFirst != null && xLast != null && xRegStart != null && xRegEnd != null) {
      const regLeft = Math.max(xRegStart, xFirst);
      const regRight = Math.min(xRegEnd, xLast);
      if (regRight - regLeft >= MIN_LABEL_WIDTH + 20) {
        labels.push({ cx: (regLeft + regRight) / 2, text: "REGULAR" });
      }
    }

    const paneHeight = chart.paneSize?.().height ?? 280;
    this._renderer.setData(bands, hairlines, labels, paneHeight);
  }

  renderer() {
    return this._renderer;
  }
}

export class SessionShadingPrimitive implements ISeriesPrimitive<Time> {
  private _bounds: SessionBounds | null = null;
  private _chart: IChartApiBase<Time> | null = null;
  private _series: ISeriesApi<"Line", Time> | null = null;
  private _requestUpdate: (() => void) | null = null;
  private readonly _paneView = new SessionShadingPaneView(this);
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

  setBounds(bounds: SessionBounds | null): void {
    this._bounds = bounds;
    this._requestUpdate?.();
  }

  updateAllViews(): void {
    this._paneView.update();
  }

  paneViews() {
    return this._paneViews;
  }

  get bounds(): SessionBounds | null {
    return this._bounds;
  }
  get chart() {
    return this._chart;
  }
  get series() {
    return this._series;
  }
}
