"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { RevenueQuarter } from "@/types/StockData";
import type { ChartRange, ChartRangePayload } from "@/lib/fetchChartRange";
import { QuarterBarSeries } from "@/components/QuarterBarSeries";
import { PinnedMarkersPrimitive } from "@/components/PinnedMarkersPrimitive";
import { SessionShadingPrimitive, type SessionBounds } from "@/components/SessionShadingPrimitive";

interface PinnedMarker {
  time: string | number;
  price: number;
}

interface Props {
  /** Required for lazy-fetching ranges other than 3Y. */
  ticker: string;
  /** 3Y weekly closes prefetched by the analyze response. Used as initial cache for the 3Y tab. */
  historicalPrices: { time: string; value: number }[] | null;
  quarterlyRevenue?: RevenueQuarter[] | null;
}

const RANGES: { id: ChartRange; label: string; header: string }[] = [
  { id: "1D", label: "1D", header: "Última sesión" },
  { id: "1M", label: "1M", header: "Último mes" },
  { id: "1Y", label: "1A", header: "Último año" },
  { id: "3Y", label: "3A", header: "Últimos 3 años" },
];

const MARKER_COLORS = ["#5EEAD4", "#FDBA74"] as const;

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
      price: p.price,
      color: MARKER_COLORS[i] ?? MARKER_COLORS[0],
    })),
  );

  return points.map((p, i) => {
    const color = MARKER_COLORS[i] ?? MARKER_COLORS[0];
    return series.createPriceLine({
      price: p.price,
      color,
      lineWidth: 1,
      lineStyle: dashedStyle,
      axisLabelVisible: true,
      axisLabelColor: color,
      axisLabelTextColor: "#0B1B5C",
      title: "",
    });
  });
}

function fmtRevenue(value: number): string {
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
  return value.toFixed(0);
}

function fmtPrice(value: number): string {
  return value.toLocaleString("es-AR", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function fmtTime(time: string | number): string {
  if (typeof time === "number") {
    const d = new Date(time * 1000);
    if (isNaN(d.getTime())) return String(time);
    const fmt = new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Montevideo",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    return `${fmt.format(d)} UY`;
  }
  const d = new Date(time);
  if (isNaN(d.getTime())) return time;
  const day = d.getDate();
  const month = d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
  const year = String(d.getFullYear()).slice(-2);
  return `${day} ${month} '${year}`;
}

export function PriceChart({ ticker, historicalPrices, quarterlyRevenue }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<ChartRange>("3Y");
  const [cache, setCache] = useState<Map<ChartRange, ChartRangePayload>>(() => new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinned, setPinned] = useState<PinnedMarker[]>([]);
  const pinnedRef = useRef<PinnedMarker[]>([]);
  pinnedRef.current = pinned;
  const primitiveRef = useRef<PinnedMarkersPrimitive | null>(null);
  const lineSeriesRef = useRef<LineSeriesApi>(null);
  const priceLinesRef = useRef<PriceLineApi[]>([]);

  // Reset cache + tab + pinned markers when the ticker changes (new analysis).
  // The freshly-arrived 3Y weekly closes seed the cache so the default tab
  // renders without a network round-trip.
  useEffect(() => {
    const initial = new Map<ChartRange, ChartRangePayload>();
    if (historicalPrices && historicalPrices.length > 0) {
      initial.set("3Y", {
        range: "3Y",
        hasPrePost: false,
        regularSession: null,
        prices: historicalPrices,
      });
    }
    setCache(initial);
    setRange("3Y");
    setPinned([]);
    setError(null);
  }, [historicalPrices, ticker]);

  // Lazy-fetch the active range when it isn't already cached.
  useEffect(() => {
    if (cache.has(range)) return;
    if (!ticker) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/chart-range?ticker=${encodeURIComponent(ticker)}&range=${range}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.error || !Array.isArray(data?.prices)) {
          setError(data?.error ?? "No se pudo cargar la cotización");
          return;
        }
        setCache((prev) => {
          const next = new Map(prev);
          next.set(range, data as ChartRangePayload);
          return next;
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error de red");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      // If the cache populates (e.g. the analyze response seeds 3Y) while
      // this fetch is still in flight, the .finally above is no-op'd by the
      // cancelled guard — without this reset, the spinner sticks on until
      // the user switches tabs.
      setLoading(false);
    };
  }, [range, ticker, cache]);

  const payload = cache.get(range) ?? null;
  const prices = payload?.prices ?? null;
  const isIntraday = range === "1D";
  // Any range whose timestamps are Unix seconds (vs. "YYYY-MM-DD" strings) —
  // i.e. uses sub-daily bars. Drives time-axis visibility + UY-localized
  // tick formatting. Currently 1D and 1M.
  const hasIntradayTimes =
    !!prices && prices.length > 0 && typeof prices[0].time === "number";

  const effectiveRevenue = useMemo(
    () => (range === "3Y" ? quarterlyRevenue ?? null : null),
    [quarterlyRevenue, range],
  );
  const showRevenue = !!effectiveRevenue && effectiveRevenue.length > 0;

  // Reset pinned markers when the displayed range changes — comparing a 3Y
  // pin against an intraday chart makes no sense, and the timestamps live in
  // different scales (string date vs Unix seconds).
  useEffect(() => {
    setPinned([]);
  }, [range]);

  useEffect(() => {
    if (!containerRef.current || !prices || prices.length === 0) return;

    let destroyed = false;
    let chartInstance: { remove: () => void } | null = null;
    let observerInstance: ResizeObserver | null = null;

    import("lightweight-charts").then(({ createChart, LineSeries, CrosshairMode, LineStyle }) => {
      if (destroyed || !containerRef.current) return;

      // Format intraday timestamps in Uruguay local time so the axis and
      // crosshair labels match the rest of the app's UY-anchored copy
      // (MarketStatus badge, etc.) regardless of the visitor's browser TZ.
      const uyHourMinute = new Intl.DateTimeFormat("es-AR", {
        timeZone: "America/Montevideo",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      });
      const uyDayMonth = new Intl.DateTimeFormat("es-AR", {
        timeZone: "America/Montevideo",
        day: "2-digit",
        month: "short",
      });
      const container = containerRef.current;
      const chart = createChart(container, {
        width: container.clientWidth,
        height: 280,
        layout: {
          background: { color: "#0B1B5C" },
          textColor: "rgba(255,255,255,0.6)",
          attributionLogo: false,
        },
        localization: {
          locale: "es-AR",
          timeFormatter: (time: import("lightweight-charts").Time) => {
            if (typeof time === "number") {
              const d = new Date(time * 1000);
              return `${uyDayMonth.format(d)} ${uyHourMinute.format(d)}`;
            }
            return typeof time === "string" ? time : String(time);
          },
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
          visible: showRevenue,
          borderColor: "rgba(255,255,255,0.1)",
          textColor: "rgba(255,255,255,0.4)",
          scaleMargins: { top: 0.1, bottom: 0.0 },
        },
        rightPriceScale: {
          borderColor: "rgba(255,255,255,0.1)",
          scaleMargins: { top: 0.1, bottom: showRevenue ? 0.35 : 0.05 },
        },
        timeScale: {
          borderColor: "rgba(255,255,255,0.1)",
          timeVisible: hasIntradayTimes,
          secondsVisible: false,
          ...(hasIntradayTimes && {
            tickMarkFormatter: (
              time: import("lightweight-charts").Time,
              tickMarkType: number,
            ) => {
              if (typeof time === "number") {
                const d = new Date(time * 1000);
                // tickMarkType 0=Year, 1=Month, 2=DayOfMonth, 3=Time, 4=TimeWithSeconds.
                // For day-level ticks (1M view zooms out across multiple days)
                // show "30 abr"; for hour-level ticks (1D zoomed in) show "14:30".
                return tickMarkType <= 2 ? uyDayMonth.format(d) : uyHourMinute.format(d);
              }
              return typeof time === "string" ? time : String(time);
            },
          }),
        },
        handleScroll: false,
        // Disable every interaction explicitly. Passing `handleScale: false`
        // alone leaves `axisDoubleClickReset` active in some builds — a
        // double-click on the right price axis (or near it) then resets the
        // scale to autoFit and, combined with our custom scaleMargins + dual
        // price scales, blanks the trace until the chart is recreated.
        handleScale: {
          mouseWheel: false,
          pinch: false,
          axisPressedMouseMove: false,
          axisDoubleClickReset: false,
        },
      });

      chartInstance = chart;

      if (showRevenue && effectiveRevenue && effectiveRevenue.length > 0) {
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
        revSeries.setData(effectiveRevenue);
      }

      // Defensive dedupe: lightweight-charts asserts strictly ascending,
      // unique times. Yahoo occasionally returns repeats around session
      // boundaries; cached payloads from older builds may also drift.
      const seen = new Set<string | number>();
      const sortedAll = [...prices]
        .sort((a, b) => {
          if (typeof a.time === "number" && typeof b.time === "number") return a.time - b.time;
          return String(a.time).localeCompare(String(b.time));
        })
        .filter((p) => {
          if (seen.has(p.time)) return false;
          seen.add(p.time);
          return true;
        });

      const reg = payload?.regularSession ?? null;
      const renderSplit = isIntraday && reg !== null;

      // Drop after-hours points entirely — only pre-market and regular session
      // are rendered.
      const sorted = renderSplit
        ? sortedAll.filter((p) => typeof p.time === "number" && p.time <= reg!.end)
        : sortedAll;

      // Split data into pre / regular when rendering the intraday tab so the
      // pre-market section can use a dashed, dimmer line. Boundary points are
      // duplicated into both sides so the dashed and solid segments visually
      // meet without a 5-minute gap.
      const preData = renderSplit
        ? sorted.filter((p) => typeof p.time === "number" && p.time <= reg!.start)
        : [];
      const regularData = renderSplit
        ? sorted.filter(
            (p) => typeof p.time === "number" && p.time >= reg!.start && p.time <= reg!.end,
          )
        : sorted;

      const toLwPoints = (arr: typeof sorted) =>
        arr.map((p) => ({
          time: p.time as unknown as import("lightweight-charts").Time,
          value: p.value,
        }));

      const regularSeries = chart.addSeries(LineSeries, {
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
      regularSeries.setData(toLwPoints(regularData));
      lineSeriesRef.current = regularSeries;

      // Pre-market series shares the right price scale but renders dashed
      // and dimmer.
      const extendedOpts = {
        color: "rgba(255,255,255,0.55)",
        lineWidth: 2 as const,
        lineStyle: LineStyle.Dashed,
        priceScaleId: "right",
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 3,
        crosshairMarkerBorderColor: "#0B1B5C",
        crosshairMarkerBackgroundColor: "rgba(255,255,255,0.7)",
      };
      const preSeries = preData.length > 0 ? chart.addSeries(LineSeries, extendedOpts) : null;
      if (preSeries) preSeries.setData(toLwPoints(preData));

      // Pre-market background shading + boundary hairlines. After-hours is
      // hidden, so cap lastTime at regularEnd to suppress the AFTER band.
      if (isIntraday && reg && sorted.length > 0) {
        const shading = new SessionShadingPrimitive();
        regularSeries.attachPrimitive(shading);
        const bounds: SessionBounds = {
          firstTime: sorted[0].time as unknown as import("lightweight-charts").Time,
          regularStart: reg.start as unknown as import("lightweight-charts").Time,
          regularEnd: reg.end as unknown as import("lightweight-charts").Time,
          lastTime: reg.end as unknown as import("lightweight-charts").Time,
        };
        shading.setBounds(bounds);
      }

      chart.timeScale().fitContent();

      const primitive = new PinnedMarkersPrimitive();
      regularSeries.attachPrimitive(primitive);
      primitiveRef.current = primitive;

      priceLinesRef.current = syncPinnedVisuals(
        pinnedRef.current,
        regularSeries,
        primitive,
        LineStyle.Dashed,
        priceLinesRef.current,
      );

      chart.subscribeClick((param) => {
        if (!param.point) return;
        const candidates = [regularSeries, preSeries].filter(Boolean) as LineSeriesApi[];
        let data: { time?: string | number; value?: number } | undefined;
        for (const s of candidates) {
          const d = param.seriesData.get(s) as
            | { time?: string | number; value?: number }
            | undefined;
          if (d && typeof d.value === "number" && d.time != null) {
            data = d;
            break;
          }
        }
        if (!data || typeof data.value !== "number" || data.time == null) return;
        const time = data.time;
        const price = data.value;

        setPinned((prev) => {
          const existingIdx = prev.findIndex((p) => p.time === time);
          if (existingIdx >= 0) {
            return prev.filter((_, i) => i !== existingIdx);
          }
          const next = [...prev, { time, price }];
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
  }, [prices, payload, showRevenue, isIntraday, hasIntradayTimes, effectiveRevenue]);

  useEffect(() => {
    const series = lineSeriesRef.current;
    const primitive = primitiveRef.current;
    if (!series || !primitive) return;

    let cancelled = false;
    import("lightweight-charts").then(({ LineStyle }) => {
      if (cancelled) return;
      priceLinesRef.current = syncPinnedVisuals(
        pinned,
        series,
        primitive,
        LineStyle.Dashed,
        priceLinesRef.current,
      );
    });

    return () => {
      cancelled = true;
    };
  }, [pinned]);

  const onSelectRange = useCallback((next: ChartRange) => {
    setRange(next);
  }, []);

  if (!historicalPrices || historicalPrices.length === 0) return null;

  const headerLabel = RANGES.find((r) => r.id === range)?.header ?? "";
  const noData = !loading && payload && payload.prices.length === 0;

  const diff =
    pinned.length === 2
      ? {
          abs: pinned[1].price - pinned[0].price,
          pct: ((pinned[1].price - pinned[0].price) / pinned[0].price) * 100,
        }
      : null;

  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-[#03065E]/30">
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 pt-3 pb-2 bg-[#0B1B5C]">
        <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-white/75">
          {headerLabel}
        </span>
        {showRevenue && (
          <span className="text-[11px] sm:text-xs text-white/75 flex items-center gap-1.5 shrink-0">
            <span className="inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm bg-[rgba(99,179,237,0.7)]" />
            Revenue trimestral
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 px-3 sm:px-4 pb-2 bg-[#0B1B5C] select-none" role="tablist" aria-label="Rango temporal">
        {RANGES.map((r) => {
          const active = r.id === range;
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelectRange(r.id)}
              className={`
                px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-widest uppercase transition-colors
                ${active
                  ? "bg-white/10 text-white"
                  : "text-white/65 hover:text-white/90 hover:bg-white/[0.04]"}
              `}
            >
              {r.label}
            </button>
          );
        })}
        {loading && (
          <span className="ml-2 text-[10px] text-white/65 tracking-widest uppercase">Cargando…</span>
        )}
      </div>

      <div className="relative" style={{ background: "#0B1B5C" }}>
        <div ref={containerRef} style={{ height: 280 }} />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[11px] text-rose-300/80 tracking-wide">{error}</span>
          </div>
        )}
        {noData && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[11px] text-white/65 tracking-wide">Sin datos para este rango.</span>
          </div>
        )}
      </div>

      <div className="px-4 py-3 bg-[#0B1B5C] border-t border-white/[0.06]">
        {pinned.length === 0 ? (
          <p className="text-[11px] text-white/35 tracking-wide">
            Tocá el gráfico para marcar y comparar hasta 2 puntos.
          </p>
        ) : (
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-x-2.5 sm:gap-x-3 gap-y-1 flex-wrap min-w-0">
              {pinned.map((p, i) => (
                <div key={`${p.time}-${i}`} className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: MARKER_COLORS[i] }}
                  />
                  <span className="text-[11px] text-white/70 tabular-nums tracking-wide">
                    {fmtTime(p.time)}
                  </span>
                  {i < pinned.length - 1 && (
                    <span className="text-white/25 text-[11px] ml-1.5">→</span>
                  )}
                </div>
              ))}
              {diff && (
                <div className="flex items-baseline gap-2 pl-2.5 sm:pl-3 sm:ml-1 border-l border-white/[0.08]">
                  <span
                    className={`text-[13px] font-semibold tabular-nums ${
                      diff.abs >= 0 ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {diff.pct >= 0 ? "+" : ""}
                    {diff.pct.toFixed(1)}%
                  </span>
                  <span
                    className={`text-[10px] tabular-nums ${
                      diff.abs >= 0 ? "text-emerald-300/50" : "text-rose-300/50"
                    }`}
                  >
                    {diff.abs >= 0 ? "+" : ""}
                    {fmtPrice(diff.abs)}
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPinned([])}
              className="text-[10px] uppercase tracking-[0.15em] text-white/60 hover:text-white/90 transition-colors shrink-0"
            >
              Limpiar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
