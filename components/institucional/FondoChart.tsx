"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FundNavPoint } from "@/lib/fondo";
import { fmtNav, fmtFechaCorta } from "@/lib/useFondo";
import { DragRangePrimitive } from "@/components/DragRangePrimitive";
import { LineShadowPrimitive } from "@/components/LineShadowPrimitive";
import {
  attachDragRange,
  chronological,
  type DragRangeSelection,
} from "@/components/dragRange";

// Curva de valor cuota del fondo, renderizada con el MISMO motor que el gráfico
// de los análisis de tickers (lightweight-charts v5), la misma estética
// institucional y EL MISMO gesto de medición: apretar, arrastrar y soltar marca
// un tramo y da su variación (components/dragRange). A diferencia del de tickers
// no tiene intradía ni barras de ingresos —un fondo sólo tiene cierres diarios de
// NAV—, y la serie llega ya recortada por período desde FondoPerformance (no
// fetchea).

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
  bench: "#9FA2C0",    // benchmark: línea secundaria, tono apagado (--site-ink-3/4)
  // Sombra proyectada de la curva del fondo (ver LineShadowPrimitive). Va SÓLO
  // en la serie protagonista: el benchmark es una referencia reescalada y
  // sombrearlo también pondría a las dos a pelear por el mismo primer plano.
  shadow: "rgba(15, 34, 73, 0.42)",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LineSeriesApi = any;

export function FondoChart({
  series,
  benchmark = [],
  formatValue = fmtNav,
  unitLabel,
  seriesLabel = "Fondo",
  benchLabel = "Benchmark",
}: {
  series: FundNavPoint[];
  /** Serie del benchmark, alineada por fecha. Vacía ⇒ sólo se dibuja el fondo. */
  benchmark?: FundNavPoint[];
  /** Formato de los valores en eje, crosshair y puntos fijados (default: valor cuota). */
  formatValue?: (n: number) => string;
  /** Unidad del eje (p. ej. "USD" o "Índice · base 100"). Se rotula una vez arriba
   *  del gráfico, no en cada marca del eje. */
  unitLabel?: string;
  seriesLabel?: string;
  benchLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Tramo medido con el gesto de arrastre. El ref lo escribe el propio gesto; el
  // estado sólo alimenta la lectura numérica de abajo.
  const [selection, setSelection] = useState<DragRangeSelection | null>(null);
  const selectionRef = useRef<DragRangeSelection | null>(null);
  const [dragging, setDragging] = useState(false);
  const primitiveRef = useRef<DragRangePrimitive | null>(null);
  const lineSeriesRef = useRef<LineSeriesApi>(null);

  const resetSelection = useCallback(() => {
    selectionRef.current = null;
    setSelection(null);
  }, []);

  // Al cambiar la ventana (cambio de período en FondoPerformance) se borra el
  // tramo: la serie es otra y la medición ya no corresponde. Ese cambio además
  // recrea el gráfico, así que hay que limpiar el ref o el nuevo lo repondría.
  const sig = series.length > 0 ? `${series[0].dia}|${series[series.length - 1].dia}|${series.length}` : "";
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intencional al cambiar de rango
    resetSelection();
  }, [sig, resetSelection]);

  useEffect(() => {
    if (!containerRef.current || series.length === 0) return;

    let destroyed = false;
    let chartInstance: { remove: () => void } | null = null;
    let observerInstance: ResizeObserver | null = null;
    let detachPointer: (() => void) | null = null;

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
          // Sólo horizontales, igual que en el informe de equity: son las que
          // ayudan a leer un valor contra el eje. Las verticales no aportan —la
          // fecha se lee abajo— y encajonan el gráfico en una cuadrícula.
          vertLines: { visible: false },
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
      // Se guarda fuera del if: el gesto necesita apagarle el punto mientras
      // haya tramo, igual que a la del fondo.
      let benchSeries: LineSeriesApi = null;
      if (benchPoints.length > 0) {
        benchSeries = chart.addSeries(LineSeries, {
          color: PALETTE.bench,
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          priceScaleId: "right",
          priceLineVisible: false,
          // Sin etiqueta de último valor: si la del fondo no va (vive arriba, en
          // la tira), la del benchmark sola quedaría flotando sin par.
          lastValueVisible: false,
          priceFormat: { type: "custom", formatter: (p: number) => formatValue(p), minMove: 0.01 },
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 3,
          crosshairMarkerBorderWidth: 0,
          crosshairMarkerBackgroundColor: PALETTE.bench,
        });
        benchSeries.setData(benchPoints);
      }

      const lineSeries = chart.addSeries(LineSeries, {
        color: PALETTE.navy,
        lineWidth: 2,
        priceScaleId: "right",
        priceLineVisible: false,
        // El valor cuota ya está en la tira de arriba — no se repite en el eje.
        lastValueVisible: false,
        priceFormat: { type: "custom", formatter: (p: number) => formatValue(p), minMove: 0.01 },
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        // Punto pleno, sin aro. El primitive del tramo lee ESTAS opciones, así
        // que el punto del hover y el del extremo medido cambian juntos.
        crosshairMarkerBorderWidth: 0,
        crosshairMarkerBackgroundColor: PALETTE.navy,
      });
      lineSeries.setData(points);
      lineSeriesRef.current = lineSeries;

      // La curva deja caer su sombra (zOrder bottom: la línea sigue nítida y el
      // benchmark, que se dibuja aparte, conserva su tono).
      const shadow = new LineShadowPrimitive({ color: PALETTE.shadow });
      lineSeries.attachPrimitive(shadow);
      shadow.setPoints(points.map((p) => ({ time: p.time as unknown as string, value: p.value })));

      chart.timeScale().fitContent();

      const primitive = new DragRangePrimitive({
        band: "rgba(15, 34, 73, 0.07)",
        edge: "rgba(15, 34, 73, 0.32)",
        marker: PALETTE.navy,
        markerHalo: PALETTE.bg,
      });
      lineSeries.attachPrimitive(primitive);
      primitiveRef.current = primitive;

      // La medición corre sobre la serie del FONDO: el benchmark es una
      // referencia reescalada, no el dato que se mide.
      detachPointer = attachDragRange({
        chart,
        container,
        points: fundRows.map((p) => ({ time: p.dia, value: p.nav })),
        primitive,
        markerSeries: [lineSeries, benchSeries],
        initial: selectionRef.current,
        onSelection: (sel) => {
          selectionRef.current = sel;
          setSelection(sel);
        },
        onDragging: setDragging,
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
      detachPointer?.();
      observerInstance?.disconnect();
      chartInstance?.remove();
      primitiveRef.current = null;
      lineSeriesRef.current = null;
    };
  }, [series, benchmark, formatValue]);

  if (series.length === 0) return null;

  // Lectura del tramo, siempre del extremo más viejo al más nuevo.
  const measure = (() => {
    if (!selection) return null;
    const [a, b] = chronological(selection.from, selection.to);
    if (!a.price) return null;
    return { a, b, abs: b.price - a.price, pct: ((b.price - a.price) / a.price) * 100 };
  })();

  return (
    <div className="fondo-chart">
      {(benchmark.length > 0 || unitLabel) && (
        <div className="fondo-chart-legend">
          {benchmark.length > 0 && (
            <>
              <span className="fondo-chart-leg">
                <span className="fondo-chart-leg-line" data-kind="fund" />
                {seriesLabel}
              </span>
              <span className="fondo-chart-leg">
                <span className="fondo-chart-leg-line" data-kind="bench" />
                {benchLabel}
              </span>
            </>
          )}
          {/* Unidad del eje, alineada a la derecha —donde vive la escala—. */}
          {unitLabel && <span className="fondo-chart-unit">{unitLabel}</span>}
        </div>
      )}

      {/* Cursor de mira y sin selección de texto: el arrastre es un gesto de
          medición, no una selección del documento. */}
      <div
        ref={containerRef}
        style={{
          height: 300,
          cursor: "crosshair",
          userSelect: dragging ? "none" : undefined,
          WebkitUserSelect: dragging ? "none" : undefined,
        }}
      />

      {/* La medición sólo existe mientras se arrastra; la altura queda fija para
          que la tira no salte al aparecer y desaparecer. */}
      <div className="fondo-chart-read">
        {!measure ? (
          <p className="fondo-chart-hint">Arrastrá sobre el gráfico para medir un tramo.</p>
        ) : (
          <div className="fondo-chart-pins-list">
            <span className="fondo-chart-pin">
              <span className="fondo-chart-pin-date">{fmtFechaCorta(String(measure.a.time))}</span>
              <span className="fondo-chart-pin-nav">{formatValue(measure.a.price)}</span>
            </span>
            <span className="fondo-chart-pin-arrow">→</span>
            <span className="fondo-chart-pin">
              <span className="fondo-chart-pin-date">{fmtFechaCorta(String(measure.b.time))}</span>
              <span className="fondo-chart-pin-nav">{formatValue(measure.b.price)}</span>
            </span>
            <span className="fondo-chart-diff" data-dir={measure.abs >= 0 ? "up" : "down"}>
              {/* Coma decimal, como el resto de los números de la página. */}
              <strong>{measure.pct >= 0 ? "+" : ""}{measure.pct.toFixed(2).replace(".", ",")}%</strong>
              <em>{measure.abs >= 0 ? "+" : ""}{formatValue(measure.abs)}</em>
            </span>
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
        .fondo-chart-unit {
          margin-left: auto; font-family: var(--font-mono), monospace; font-size: 11px;
          letter-spacing: 0.08em; color: var(--site-ink-3);
        }
        .fondo-chart-read {
          margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--site-border);
          min-height: 26px; display: flex; align-items: center;
        }
        .fondo-chart-hint {
          margin: 0; font-family: var(--font-mono), monospace; font-size: 11px;
          letter-spacing: 0.04em; color: var(--site-ink-3);
        }
        .fondo-chart-pins-list { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .fondo-chart-pin {
          display: inline-flex; align-items: center; gap: 7px;
          font-family: var(--font-mono), monospace; font-size: 11px;
          color: var(--site-ink-2); font-variant-numeric: tabular-nums;
        }
        .fondo-chart-pin-nav { color: var(--site-ink); font-weight: 500; }
        .fondo-chart-pin-arrow { color: var(--site-ink-3); font-size: 11px; }
        .fondo-chart-diff {
          display: inline-flex; align-items: baseline; gap: 8px;
          padding-left: 14px; border-left: 1px solid var(--site-border);
          font-family: var(--font-mono), monospace; font-variant-numeric: tabular-nums;
        }
        .fondo-chart-diff strong { font-size: 13px; }
        .fondo-chart-diff em { font-size: 10px; font-style: normal; opacity: 0.75; }
        .fondo-chart-diff[data-dir="up"] strong, .fondo-chart-diff[data-dir="up"] em { color: var(--pos); }
        .fondo-chart-diff[data-dir="down"] strong, .fondo-chart-diff[data-dir="down"] em { color: var(--neg); }
      `}</style>
    </div>
  );
}
