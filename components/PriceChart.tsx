"use client";

import { useEffect, useRef } from "react";
import type { RevenueQuarter } from "@/types/StockData";
import { QuarterBarSeries } from "@/components/QuarterBarSeries";

interface PricePoint {
  time: string;
  value: number;
}

interface Props {
  historicalPrices: PricePoint[] | null;
  ticker: string;
  quarterlyRevenue?: RevenueQuarter[] | null;
}

function getCurrencyLabel(ticker: string): string {
  const suffix = ticker.split(".").pop() ?? "";
  if (suffix === "BA") return "ARS";
  return "";
}

function fmtRevenue(value: number): string {
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
  return value.toFixed(0);
}


export function PriceChart({ historicalPrices, ticker, quarterlyRevenue }: Props) {
  const currencyLabel = getCurrencyLabel(ticker);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !historicalPrices || historicalPrices.length === 0) return;

    let destroyed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chartInstance: { remove: () => void } | null = null;
    let observerInstance: ResizeObserver | null = null;

    import("lightweight-charts").then(({ createChart, LineSeries, CrosshairMode }) => {
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
    };
  }, [historicalPrices, quarterlyRevenue]);

  if (!historicalPrices || historicalPrices.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-[#03065E]/30">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 bg-[#0B1B5C]">
        <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
          Precio{currencyLabel ? ` en ${currencyLabel}` : ""} — Últimos 3 años
        </span>
        {quarterlyRevenue && quarterlyRevenue.length > 0 && (
          <span className="text-xs text-white/30 flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-[rgba(99,179,237,0.5)]" />
            Revenue trimestral
          </span>
        )}
      </div>
      <div ref={containerRef} style={{ background: "#0B1B5C" }} />
    </div>
  );
}
