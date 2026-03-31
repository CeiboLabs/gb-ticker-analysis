/**
 * Custom lightweight-charts v5 series that renders one wide bar per quarter.
 * Each bar spans from its own x position to the next bar's x position,
 * filling the full width of the quarter regardless of how dense the
 * shared time scale is (e.g. weekly price data alongside).
 */
import type {
  CustomData,
  CustomSeriesOptions,
  CustomSeriesPricePlotValues,
  CustomSeriesWhitespaceData,
  ICustomSeriesPaneRenderer,
  ICustomSeriesPaneView,
  PaneRendererCustomData,
  PriceToCoordinateConverter,
  Time,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";

// ── Public data type ────────────────────────────────────────────────────────

export interface QuarterBarData extends CustomData {
  value: number;
}

// ── Internal bar item used by the renderer ──────────────────────────────────

interface RendererBar {
  x: number;     // media-coordinate x of the bar's left edge
  width: number; // media-coordinate width spanning to the next bar
  value: number;
}

// ── Renderer ────────────────────────────────────────────────────────────────

class QuarterBarRenderer implements ICustomSeriesPaneRenderer {
  private _bars: RendererBar[] = [];
  private _color = "rgba(99, 179, 237, 0.4)";

  setBars(bars: RendererBar[], color: string): void {
    this._bars = bars;
    this._color = color;
  }

  draw(
    target: CanvasRenderingTarget2D,
    priceConverter: PriceToCoordinateConverter,
  ): void {
    target.useBitmapCoordinateSpace(
      ({ context: ctx, horizontalPixelRatio, verticalPixelRatio, mediaSize }) => {
        ctx.save();
        ctx.fillStyle = this._color;

        const paneHeightBitmap = mediaSize.height * verticalPixelRatio;

        for (const bar of this._bars) {
          const yMedia = priceConverter(bar.value);
          if (yMedia === null) continue;

          const xBitmap   = Math.round(bar.x     * horizontalPixelRatio);
          const wBitmap   = Math.round(bar.width  * horizontalPixelRatio);
          const yBitmap   = Math.round(yMedia     * verticalPixelRatio);
          const hBitmap   = paneHeightBitmap - yBitmap;

          if (wBitmap > 0 && hBitmap > 1) {
            ctx.fillRect(xBitmap, yBitmap, wBitmap, hBitmap);
          }
        }

        ctx.restore();
      },
    );
  }
}

// ── View (the object passed to addCustomSeries) ─────────────────────────────

export class QuarterBarSeries
  implements ICustomSeriesPaneView<Time, QuarterBarData, CustomSeriesOptions>
{
  private readonly _renderer = new QuarterBarRenderer();

  renderer(): ICustomSeriesPaneRenderer {
    return this._renderer;
  }

  update(
    data: PaneRendererCustomData<Time, QuarterBarData>,
    options: CustomSeriesOptions,
  ): void {
    const { bars, visibleRange } = data;

    if (!visibleRange || bars.length === 0) {
      this._renderer.setBars([], options.color);
      return;
    }

    // Compute median gap so we can cap bars that appear double-wide due to
    // missing quarters (e.g. Q4 absent when EDGAR only has the annual 10-K context).
    const gaps: number[] = [];
    for (let i = visibleRange.from + 1; i <= visibleRange.to; i++) {
      const b = bars[i], pb = bars[i - 1];
      if (b && pb) gaps.push(b.x - pb.x);
    }
    gaps.sort((a, b) => a - b);
    const medianGap = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : data.barSpacing;
    const maxWidth  = medianGap * 1.3;

    const rendered: RendererBar[] = [];

    for (let i = visibleRange.from; i <= visibleRange.to; i++) {
      const bar     = bars[i];
      const prevBar = i > 0 ? bars[i - 1] : null;
      const nextBar = bars[i + 1];

      if (!bar) continue;

      // Each bar spans from the PREVIOUS quarter's close to THIS quarter's close,
      // so Q4 2025 (x = Dec 31) occupies the Oct–Dec space, not Jan–Mar.
      const rightEdge = bar.x;
      const rawWidth = prevBar
        ? bar.x - prevBar.x
        : nextBar
          ? nextBar.x - bar.x   // first bar: estimate from next gap
          : data.barSpacing;
      const quarterWidth = Math.min(rawWidth, maxWidth);
      const leftEdge = rightEdge - quarterWidth;

      // 80% fill, 10% gap on each side
      const barWidth = quarterWidth * 0.8;
      const barX     = leftEdge + quarterWidth * 0.1;

      rendered.push({ x: barX, width: barWidth, value: bar.originalData.value });
    }

    this._renderer.setBars(rendered, options.color);
  }

  priceValueBuilder(plotRow: QuarterBarData): CustomSeriesPricePlotValues {
    return [0, plotRow.value];
  }

  isWhitespace(
    data: QuarterBarData | CustomSeriesWhitespaceData<Time>,
  ): data is CustomSeriesWhitespaceData<Time> {
    return !("value" in data);
  }

  defaultOptions(): CustomSeriesOptions {
    return {
      color: "rgba(99, 179, 237, 0.4)",
      // SeriesOptions required fields with sensible defaults
      lastValueVisible: false,
      priceLineVisible: false,
      visible: true,
      priceScaleId: "left",
      title: "",
      priceFormat: { type: "price", precision: 0, minMove: 1 },
    } as CustomSeriesOptions;
  }
}
