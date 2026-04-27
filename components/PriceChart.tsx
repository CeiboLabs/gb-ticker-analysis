"use client";

import { useEffect, useRef, useState } from "react";
import type { RevenueQuarter } from "@/types/StockData";
import { QuarterBarSeries } from "@/components/QuarterBarSeries";

interface PricePoint {
  time: string;
  value: number;
}

interface PinnedMarker {
  time: string;
  price: number;
}

interface Props {
  historicalPrices: PricePoint[] | null;
  quarterlyRevenue?: RevenueQuarter[] | null;
}

const MARKER_COLORS = ["#FACC15", "#F87171"] as const;

function fmtRevenue(value: number): string {
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
  return value.toFixed(0);
}

function fmtPrice(value: number): string {
  return value.toLocaleString("es-AR", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function fmtDate(time: string): string {
  const d = new Date(time);
  if (isNaN(d.getTime())) return time;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}


export function PriceChart({ historicalPrices, quarterlyRevenue }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState<PinnedMarker[]>([]);
  const pinnedRef = useRef<PinnedMarker[]>([]);
  pinnedRef.current = pinned;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersApiRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !historicalPrices || historicalPrices.length === 0) return;

    let destroyed = false;
    let chartInstance: { remove: () => void } | null = null;
    let observerInstance: ResizeObserver | null = null;

    import("lightweight-charts").then(({ createChart, LineSeries, CrosshairMode, createSeriesMarkers }) => {
      if (destroyed || !containerRef.current) return;

      const container = containerRef.current;
      const chart = createChart(container, {
        width: container.clientWidth,
        height: 280,
        layout: {
          background: { color: "#0B1B5C" },
          textColor: "rgba(255,255,255,0.6)",
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.05)" },
          horzLines: { color: "rgba(255,255,255,0.05)" },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "rgba(255,255,255,0.25)", labelBackgroundColor: "#0B1B5C" },
          horzLine: { color: "rgba(255,255,255,0.25)", labelBackgroundColor: "#0B1B5C" },
        },
        leftPriceScale: {
          visible: !!(quarterlyRevenue && quarterlyRevenue.length > 0),
          borderColor: "rgba(255,255,255,0.1)",
          textColor: "rgba(255,255,255,0.4)",
          scaleMargins: { top: 0.1, bottom: 0.0 },
        },
        rightPriceScale: {
          borderColor: "rgba(255,255,255,0.1)",
          scaleMargins: { top: 0.1, bottom: 0.35 },
        },
        timeScale: {
          borderColor: "rgba(255,255,255,0.1)",
          timeVisible: false,
        },
        handleScroll: false,
        handleScale: false,
      });

      chartInstance = chart;

      // Revenue bars — custom series so each bar spans the full quarter width
      if (quarterlyRevenue && quarterlyRevenue.length > 0) {
        const revSeries = chart.addCustomSeries(new QuarterBarSeries(), {
          color: "rgba(99, 179, 237, 0.4)",
          priceScaleId: "left",
          priceLineVisible: false,
          lastValueVisible: false,
          priceFormat: {
            type: "custom",
            formatter: fmtRevenue,
          },
        });
        revSeries.setData(quarterlyRevenue);
      }

      const lineSeries = chart.addSeries(LineSeries, {
        color: "#ffffff",
        lineWidth: 2,
        priceScaleId: "right",
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: "#0B1B5C",
        crosshairMarkerBackgroundColor: "#ffffff",
      });

      lineSeries.setData(historicalPrices);

      chart.timeScale().fitContent();

      const markersApi = createSeriesMarkers(lineSeries, []);
      markersApiRef.current = markersApi;
      // Apply any markers that were pinned before the chart finished loading
      if (pinnedRef.current.length > 0) {
        markersApi.setMarkers(
          pinnedRef.current.map((m, i) => ({
            time: m.time,
            position: "inBar" as const,
            shape: "circle" as const,
            color: MARKER_COLORS[i] ?? MARKER_COLORS[0],
            size: 2,
          })),
        );
      }

      chart.subscribeClick((param) => {
        if (!param.point) return;
        const data = param.seriesData.get(lineSeries) as
          | { time?: string; value?: number }
          | undefined;
        if (!data || typeof data.value !== "number" || !data.time) return;
        const time = data.time;
        const price = data.value;

        setPinned((prev) => {
          const existingIdx = prev.findIndex((p) => p.time === time);
          if (existingIdx >= 0) {
            // Toggle off when tapping the same point again
            return prev.filter((_, i) => i !== existingIdx);
          }
          const next = [...prev, { time, price }];
          // Keep at most the last 2 markers
          return next.length > 2 ? next.slice(next.length - 2) : next;
        });
      });

      observerInstance = new ResizeObserver(() => {
        if (containerRef.current) {
          chart.applyOptions({ width: containerRef.current.clientWidth });
        }
      });
      observerInstance.observe(container);
    });

    return () => {
      destroyed = true;
      observerInstance?.disconnect();
      chartInstance?.remove();
      markersApiRef.current = null;
    };
  }, [historicalPrices, quarterlyRevenue]);

  useEffect(() => {
    const api = markersApiRef.current;
    if (!api) return;
    api.setMarkers(
      pinned.map((m, i) => ({
        time: m.time,
        position: "inBar" as const,
        shape: "circle" as const,
        color: MARKER_COLORS[i] ?? MARKER_COLORS[0],
        size: 2,
      })),
    );
  }, [pinned]);

  // Reset pinned markers when the dataset changes (e.g., switching tickers)
  useEffect(() => {
    setPinned([]);
  }, [historicalPrices]);

  if (!historicalPrices || historicalPrices.length === 0) return null;

  const diff =
    pinned.length === 2
      ? {
          abs: pinned[1].price - pinned[0].price,
          pct: ((pinned[1].price - pinned[0].price) / pinned[0].price) * 100,
        }
      : null;

  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-[#03065E]/30">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 bg-[#0B1B5C]">
        <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
          Últimos 3 años
        </span>
        {quarterlyRevenue && quarterlyRevenue.length > 0 && (
          <span className="text-xs text-white/30 flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-[rgba(99,179,237,0.5)]" />
            Revenue trimestral
          </span>
        )}
      </div>
      <div ref={containerRef} style={{ background: "#0B1B5C" }} />
      <div className="flex items-center justify-between gap-2 px-4 py-2 bg-[#0B1B5C] border-t border-white/5">
        {pinned.length === 0 ? (
          <span className="text-[11px] text-white/40">
            Tocá el gráfico para marcar hasta 2 puntos
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/70">
            {pinned.map((p, i) => (
              <span key={`${p.time}-${i}`} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: MARKER_COLORS[i] }}
                />
                <span className="text-white/50">{fmtDate(p.time)}</span>
                <span className="font-semibold text-white/90">{fmtPrice(p.price)}</span>
              </span>
            ))}
            {diff && (
              <span
                className={`font-semibold ${diff.abs >= 0 ? "text-emerald-400" : "text-red-400"}`}
              >
                {diff.abs >= 0 ? "+" : ""}
                {fmtPrice(diff.abs)} ({diff.pct >= 0 ? "+" : ""}
                {diff.pct.toFixed(1)}%)
              </span>
            )}
          </div>
        )}
        {pinned.length > 0 && (
          <button
            type="button"
            onClick={() => setPinned([])}
            className="text-[11px] text-white/40 hover:text-white/80 underline underline-offset-2 shrink-0"
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
