"use client";

import { useEffect, useRef, useState } from "react";
import type { FundNavPoint } from "@/lib/fondo";
import { fmtNav, fmtFechaCorta } from "@/lib/useFondo";
import { PinnedMarkersPrimitive } from "@/components/PinnedMarkersPrimitive";

// Curva de valor cuota del fondo, renderizada con el MISMO motor que el gráfico
// de los análisis de tickers (lightweight-charts v5) y la misma estética
// institucional: línea navy, crosshair con etiquetas UY, último valor en el eje
// y comparación de hasta 2 puntos al tocar. A diferencia del de tickers no tiene
// intradía ni barras de ingresos —un fondo sólo tiene cierres diarios de NAV—,
// y la serie llega ya recortada por período desde FondoPerformance (no fetchea).

// Paleta institucional — espejo de los tokens de app/globals.css :root.
const PALETTE = {
  // El frame que envuelve el gráfico (.perf-chart-frame) es blanco puro;
  // pintamos el canvas en #fff para que no se note la costura.
  bg: "#ffffff",
  ink3: "#797D99",     // --site-ink-3
  ink4: "#9FA2C0",
  rule: "#E7E8F2",     // --site-border
  ruleSoft: "#ECEDF6", // --navy-050
  navy: "#0f2249",     // --navy
  ink2: "#4A4E6B",     // --site-ink-2
  paper: "#FBFBFE",    // --paper (texto de etiquetas sobre navy)
  pos: "#15803d",
  neg: "#b91c1c",
  bench: "#9FA2C0",    // benchmark: línea secundaria, tono apagado (--site-ink-3/4)
};

// Mismos acentos teal/coral que el gráfico de tickers para los puntos fijados:
// contrastan con la línea navy y no se confunden con el verde/rojo del diff.
const MARKER_COLORS = ["#0D7680", "#C24A3A"] as const;

interface PinnedMarker {
  time: string;
  nav: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LineSeriesApi = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PriceLineApi = any;

function syncPinnedVisuals(
  points: PinnedMarker[],
  series: LineSeriesApi,
  primitive: PinnedMarkersPrimitive,
  dashedStyle: number,
  existingPriceLines: PriceLineApi[],
): PriceLineApi[] {
  for (const pl of existingPriceLines) series.removePriceLine(pl);

  primitive.setMarkers(
    points.map((p, i) => ({
      time: p.time as unknown as import("lightweight-charts").Time,
      price: p.nav,
      color: MARKER_COLORS[i] ?? MARKER_COLORS[0],
    })),
  );

  return points.map((p, i) => {
    const color = MARKER_COLORS[i] ?? MARKER_COLORS[0];
    return series.createPriceLine({
      price: p.nav,
      color,
      lineWidth: 1,
      lineStyle: dashedStyle,
      axisLabelVisible: true,
      axisLabelColor: color,
      axisLabelTextColor: PALETTE.paper,
      title: "",
    });
  });
}

export function FondoChart({
  series,
  benchmark = [],
  formatValue = fmtNav,
  seriesLabel = "Fondo",
  benchLabel = "Benchmark",
}: {
  series: FundNavPoint[];
  /** Serie del benchmark, alineada por fecha. Vacía ⇒ sólo se dibuja el fondo. */
  benchmark?: FundNavPoint[];
  /** Formato de los valores en eje, crosshair y puntos fijados (default: valor cuota). */
  formatValue?: (n: number) => string;
  seriesLabel?: string;
  benchLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState<PinnedMarker[]>([]);
  const pinnedRef = useRef<PinnedMarker[]>([]);
  useEffect(() => {
    pinnedRef.current = pinned;
  }, [pinned]);
  const primitiveRef = useRef<PinnedMarkersPrimitive | null>(null);
  const lineSeriesRef = useRef<LineSeriesApi>(null);
  const priceLinesRef = useRef<PriceLineApi[]>([]);

  // Al cambiar la ventana (cambio de período en FondoPerformance) reseteamos los
  // puntos fijados: la serie es otra y los marcadores ya no tienen sentido.
  const sig = series.length > 0 ? `${series[0].dia}|${series[series.length - 1].dia}|${series.length}` : "";
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intencional al cambiar de rango
    setPinned([]);
  }, [sig]);

  useEffect(() => {
    if (!containerRef.current || series.length === 0) return;

    let destroyed = false;
    let chartInstance: { remove: () => void } | null = null;
    let observerInstance: ResizeObserver | null = null;

    import("lightweight-charts").then(({ createChart, LineSeries, CrosshairMode, LineStyle }) => {
      if (destroyed || !containerRef.current) return;

      const container = containerRef.current;
      const chart = createChart(container, {
        width: container.clientWidth,
        height: 300,
        layout: {
          background: { color: PALETTE.bg },
          textColor: PALETTE.ink3,
          attributionLogo: false,
        },
        localization: {
          locale: "es-UY",
          priceFormatter: (p: number) => formatValue(p),
          timeFormatter: (time: import("lightweight-charts").Time) =>
            typeof time === "string" ? fmtFechaCorta(time) : String(time),
        },
        grid: {
          vertLines: { color: PALETTE.ruleSoft },
          horzLines: { color: PALETTE.ruleSoft },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: PALETTE.ink4, labelBackgroundColor: PALETTE.navy },
          horzLine: { color: PALETTE.ink4, labelBackgroundColor: PALETTE.navy },
        },
        rightPriceScale: {
          borderColor: PALETTE.rule,
          textColor: PALETTE.ink3,
          scaleMargins: { top: 0.12, bottom: 0.08 },
        },
        timeScale: {
          borderColor: PALETTE.rule,
          timeVisible: false,
          secondsVisible: false,
        },
        handleScroll: false,
        handleScale: {
          mouseWheel: false,
          pinch: false,
          axisPressedMouseMove: false,
          axisDoubleClickReset: false,
        },
      });

      chartInstance = chart;

      // Dedup + orden ascendente por fecha.
      const clean = (arr: FundNavPoint[]) => {
        const seen = new Set<string>();
        return [...arr]
          .sort((a, b) => a.dia.localeCompare(b.dia))
          .filter((p) => {
            if (seen.has(p.dia)) return false;
            seen.add(p.dia);
            return true;
          });
      };
      const toPoints = (rows: FundNavPoint[], scale = 1) =>
        rows.map((p) => ({
          time: p.dia as unknown as import("lightweight-charts").Time,
          value: p.nav * scale,
        }));

      // El fondo se grafica en su valor cuota real. El benchmark es un índice de
      // escala arbitraria: lo reescalamos para que arranque en el mismo valor
      // cuota inicial del fondo, así ambas líneas comparten origen y el eje lee
      // en valor cuota —no en base 100—.
      const fundRows = clean(series);
      const points = toPoints(fundRows);
      const fundAnchor = fundRows.length > 0 ? fundRows[0].nav : null;

      const benchRows = benchmark.length > 0 ? clean(benchmark) : [];
      const benchScale =
        fundAnchor != null && benchRows.length > 0 && benchRows[0].nav !== 0
          ? fundAnchor / benchRows[0].nav
          : 1;
      const benchPoints = toPoints(benchRows, benchScale);

      // Benchmark primero (queda por debajo); la línea del fondo se dibuja encima.
      if (benchPoints.length > 0) {
        const benchSeries = chart.addSeries(LineSeries, {
          color: PALETTE.bench,
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          priceScaleId: "right",
          priceLineVisible: false,
          lastValueVisible: true,
          priceFormat: { type: "custom", formatter: (p: number) => formatValue(p), minMove: 0.01 },
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 3,
          crosshairMarkerBorderColor: PALETTE.paper,
          crosshairMarkerBackgroundColor: PALETTE.bench,
        });
        benchSeries.setData(benchPoints);
      }

      const lineSeries = chart.addSeries(LineSeries, {
        color: PALETTE.navy,
        lineWidth: 2,
        priceScaleId: "right",
        priceLineVisible: false,
        lastValueVisible: true,
        priceFormat: { type: "custom", formatter: (p: number) => formatValue(p), minMove: 0.01 },
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: PALETTE.paper,
        crosshairMarkerBackgroundColor: PALETTE.navy,
      });
      lineSeries.setData(points);
      lineSeriesRef.current = lineSeries;

      chart.timeScale().fitContent();

      const primitive = new PinnedMarkersPrimitive();
      lineSeries.attachPrimitive(primitive);
      primitiveRef.current = primitive;

      priceLinesRef.current = syncPinnedVisuals(
        pinnedRef.current,
        lineSeries,
        primitive,
        LineStyle.Dashed,
        priceLinesRef.current,
      );

      chart.subscribeClick((param) => {
        if (!param.point) return;
        const d = param.seriesData.get(lineSeries) as
          | { time?: string | number; value?: number }
          | undefined;
        if (!d || typeof d.value !== "number" || d.time == null) return;
        const time = String(d.time);
        const nav = d.value;

        setPinned((prev) => {
          const existingIdx = prev.findIndex((p) => p.time === time);
          if (existingIdx >= 0) return prev.filter((_, i) => i !== existingIdx);
          const next = [...prev, { time, nav }];
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
      primitiveRef.current = null;
      lineSeriesRef.current = null;
      priceLinesRef.current = [];
    };
  }, [series, benchmark, formatValue]);

  // Repintar los marcadores fijados sin recrear el gráfico.
  useEffect(() => {
    const s = lineSeriesRef.current;
    const primitive = primitiveRef.current;
    if (!s || !primitive) return;

    let cancelled = false;
    import("lightweight-charts").then(({ LineStyle }) => {
      if (cancelled) return;
      priceLinesRef.current = syncPinnedVisuals(pinned, s, primitive, LineStyle.Dashed, priceLinesRef.current);
    });
    return () => { cancelled = true; };
  }, [pinned]);

  if (series.length === 0) return null;

  const diff =
    pinned.length === 2
      ? { abs: pinned[1].nav - pinned[0].nav, pct: ((pinned[1].nav - pinned[0].nav) / pinned[0].nav) * 100 }
      : null;

  return (
    <div className="fondo-chart">
      {benchmark.length > 0 && (
        <div className="fondo-chart-legend">
          <span className="fondo-chart-leg">
            <span className="fondo-chart-leg-line" data-kind="fund" />
            {seriesLabel}
          </span>
          <span className="fondo-chart-leg">
            <span className="fondo-chart-leg-line" data-kind="bench" />
            {benchLabel}
          </span>
        </div>
      )}

      <div ref={containerRef} style={{ height: 300 }} />

      <div className="fondo-chart-read">
        {pinned.length === 0 ? (
          <p className="fondo-chart-hint">Tocá el gráfico para marcar y comparar hasta 2 puntos.</p>
        ) : (
          <div className="fondo-chart-pins">
            <div className="fondo-chart-pins-list">
              {pinned.map((p, i) => (
                <span key={`${p.time}-${i}`} className="fondo-chart-pin">
                  <span className="fondo-chart-pin-dot" style={{ background: MARKER_COLORS[i] }} />
                  <span className="fondo-chart-pin-date">{fmtFechaCorta(p.time)}</span>
                  <span className="fondo-chart-pin-nav">{formatValue(p.nav)}</span>
                  {i < pinned.length - 1 && <span className="fondo-chart-pin-arrow">→</span>}
                </span>
              ))}
              {diff && (
                <span className="fondo-chart-diff" data-dir={diff.abs >= 0 ? "up" : "down"}>
                  <strong>{diff.pct >= 0 ? "+" : ""}{diff.pct.toFixed(2)}%</strong>
                  <em>{diff.abs >= 0 ? "+" : ""}{formatValue(diff.abs)}</em>
                </span>
              )}
            </div>
            <button type="button" className="fondo-chart-clear" onClick={() => setPinned([])}>
              Limpiar
            </button>
          </div>
        )}
      </div>

      <style>{`
        .fondo-chart-legend {
          display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
          margin-bottom: 10px;
        }
        .fondo-chart-leg {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 12.5px; font-weight: 500; color: var(--site-ink-2);
        }
        .fondo-chart-leg-line { width: 18px; height: 0; display: inline-block; }
        .fondo-chart-leg-line[data-kind="fund"] {
          border-top: 2px solid var(--navy);
        }
        .fondo-chart-leg-line[data-kind="bench"] {
          border-top: 2px dashed #9FA2C0;
        }
        .fondo-chart-read {
          margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--site-border);
          min-height: 20px;
        }
        .fondo-chart-hint {
          margin: 0; font-family: var(--font-mono), monospace; font-size: 11px;
          letter-spacing: 0.04em; color: var(--site-ink-3);
        }
        .fondo-chart-pins {
          display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
        }
        .fondo-chart-pins-list { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .fondo-chart-pin {
          display: inline-flex; align-items: center; gap: 7px;
          font-family: var(--font-mono), monospace; font-size: 11px;
          color: var(--site-ink-2); font-variant-numeric: tabular-nums;
        }
        .fondo-chart-pin-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
        .fondo-chart-pin-nav { color: var(--site-ink); font-weight: 500; }
        .fondo-chart-pin-arrow { color: var(--site-ink-3); margin-left: 2px; }
        .fondo-chart-diff {
          display: inline-flex; align-items: baseline; gap: 8px;
          padding-left: 14px; border-left: 1px solid var(--site-border);
          font-family: var(--font-mono), monospace; font-variant-numeric: tabular-nums;
        }
        .fondo-chart-diff strong { font-size: 13px; }
        .fondo-chart-diff em { font-size: 10px; font-style: normal; opacity: 0.75; }
        .fondo-chart-diff[data-dir="up"] strong, .fondo-chart-diff[data-dir="up"] em { color: #15803d; }
        .fondo-chart-diff[data-dir="down"] strong, .fondo-chart-diff[data-dir="down"] em { color: #b91c1c; }
        .fondo-chart-clear {
          background: none; border: 0; cursor: pointer;
          font-family: var(--font-mono), monospace; font-size: 10px;
          letter-spacing: 0.15em; text-transform: uppercase; color: var(--site-ink-3);
        }
        .fondo-chart-clear:hover { color: var(--navy); }
      `}</style>
    </div>
  );
}
