"use client";

import { useEffect, useRef } from "react";

interface PricePoint {
  time: string;
  value: number;
}

interface Props {
  historicalPrices: PricePoint[] | null;
  ticker: string;
}

function getCurrencyLabel(ticker: string): string {
  const suffix = ticker.split(".").pop() ?? "";
  if (suffix === "BA") return "ARS";
  return "";
}

export function PriceChart({ historicalPrices, ticker }: Props) {
  const currencyLabel = getCurrencyLabel(ticker);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !historicalPrices || historicalPrices.length === 0) return;

    const values = historicalPrices.map((p) => p.value);
    const threeYearHigh = Math.max(...values);
    const threeYearLow = Math.min(...values);

    let destroyed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chartInstance: { remove: () => void } | null = null;
    let observerInstance: ResizeObserver | null = null;

    import("lightweight-charts").then(({ createChart, LineSeries }) => {
      if (destroyed || !containerRef.current) return;

      const container = containerRef.current;
      const chart = createChart(container, {
        width: container.clientWidth,
        height: 240,
        layout: {
          background: { color: "#0B1B5C" },
          textColor: "rgba(255,255,255,0.6)",
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.05)" },
          horzLines: { color: "rgba(255,255,255,0.05)" },
        },
        crosshair: {
          vertLine: { color: "rgba(255,255,255,0.25)", labelBackgroundColor: "#0B1B5C" },
          horzLine: { color: "rgba(255,255,255,0.25)", labelBackgroundColor: "#0B1B5C" },
        },
        rightPriceScale: {
          borderColor: "rgba(255,255,255,0.1)",
        },
        timeScale: {
          borderColor: "rgba(255,255,255,0.1)",
          timeVisible: false,
        },
        handleScroll: false,
        handleScale: false,
      });

      chartInstance = chart;

      const lineSeries = chart.addSeries(LineSeries, {
        color: "#ffffff",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: "#0B1B5C",
        crosshairMarkerBackgroundColor: "#ffffff",
      });

      lineSeries.setData(historicalPrices);

      lineSeries.createPriceLine({
        price: threeYearHigh,
        color: "rgba(201,168,76,0.8)",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "Máx 3a",
      });

      lineSeries.createPriceLine({
        price: threeYearLow,
        color: "rgba(239,100,100,0.8)",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "Mín 3a",
      });

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
  }, [historicalPrices]);

  if (!historicalPrices || historicalPrices.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-[#03065E]/30">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 bg-[#0B1B5C]">
        <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
          Precio{currencyLabel ? ` en ${currencyLabel}` : ""} — Últimos 3 años
        </span>
      </div>
      <div ref={containerRef} style={{ background: "#0B1B5C" }} />
    </div>
  );
}
