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
  ticker: string;
  historicalPrices: { time: string; value: number }[] | null;
  quarterlyRevenue?: RevenueQuarter[] | null;
}

const RANGES: { id: ChartRange; label: string }[] = [
  { id: "1D", label: "1D" },
  { id: "1M", label: "1M" },
  { id: "1Y", label: "1A" },
  { id: "3Y", label: "3A" },
];

// Institutional palette — keep in sync with app/globals.css :root tokens.
const PALETTE = {
  paper: "#FBFBFE",
  ink: "#0E1130",
  ink2: "#3A3E5C",
  ink3: "#6E7290",
  ink4: "#9FA2C0",
  rule: "#D9DAE8",
  ruleSoft: "#ECEDF6",
  navy: "#03065E",
  navy300: "#6B70B8",
  gold: "#EBD288",
  goldSoft: "rgba(235, 210, 136, 0.35)",
  pos: "#1F6B45",
  neg: "#8E2A2A",
};

// Marker colors picked to (a) contrast against the navy price line so the
// pinned dot is visible on top of it, (b) sit clearly apart from the
// gold-soft revenue bars in 3A, and (c) carry white axis labels with
// >=4.5:1 contrast. FT-style teal + muted coral — the cool/warm accent
// pair used by FT, Bloomberg and Datawrapper for non-semantic
// comparison markers (red/green is reserved for the diff readout).
const MARKER_COLORS = ["#0D7680", "#C24A3A"] as const;

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
      axisLabelTextColor: PALETTE.paper,
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

export function PriceChartInstitucional({ ticker, historicalPrices, quarterlyRevenue }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<ChartRange>("3Y");
  const [cache, setCache] = useState<Map<ChartRange, ChartRangePayload>>(() => new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinned, setPinned] = useState<PinnedMarker[]>([]);
  const pinnedRef = useRef<PinnedMarker[]>([]);
  useEffect(() => {
    pinnedRef.current = pinned;
  }, [pinned]);
  const primitiveRef = useRef<PinnedMarkersPrimitive | null>(null);
  const lineSeriesRef = useRef<LineSeriesApi>(null);
  const priceLinesRef = useRef<PriceLineApi[]>([]);

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
    /* eslint-disable react-hooks/set-state-in-effect */
    setCache(initial);
    setRange("3Y");
    setPinned([]);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [historicalPrices, ticker]);

  useEffect(() => {
    if (cache.has(range)) return;
    if (!ticker) return;
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
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
      setLoading(false);
    };
  }, [range, ticker, cache]);

  const payload = cache.get(range) ?? null;
  const prices = payload?.prices ?? null;
  const isIntraday = range === "1D";
  const hasIntradayTimes =
    !!prices && prices.length > 0 && typeof prices[0].time === "number";

  const effectiveRevenue = useMemo(() => {
    if (range !== "3Y" || !quarterlyRevenue || quarterlyRevenue.length === 0) {
      return null;
    }
    const earliestPrice = prices && prices.length > 0 ? prices[0].time : null;
    const earliestPriceMs = (() => {
      if (earliestPrice == null) return null;
      if (typeof earliestPrice === "string") return Date.parse(earliestPrice);
      return Number(earliestPrice) * 1000;
    })();

    const inRange = earliestPriceMs != null
      ? quarterlyRevenue.filter((q) => Date.parse(q.time) >= earliestPriceMs)
      : quarterlyRevenue;
    if (inRange.length === 0) return null;

    return [...inRange].sort((a, b) => a.time.localeCompare(b.time));
  }, [quarterlyRevenue, range, prices]);
  const showRevenue = !!effectiveRevenue && effectiveRevenue.length > 0;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on range change
    setPinned([]);
  }, [range]);

  useEffect(() => {
    if (!containerRef.current || !prices || prices.length === 0) return;

    let destroyed = false;
    let chartInstance: { remove: () => void } | null = null;
    let observerInstance: ResizeObserver | null = null;

    import("lightweight-charts").then(({ createChart, LineSeries, CrosshairMode, LineStyle }) => {
      if (destroyed || !containerRef.current) return;

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
          background: { color: PALETTE.paper },
          textColor: PALETTE.ink3,
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
          vertLines: { color: PALETTE.ruleSoft },
          horzLines: { color: PALETTE.ruleSoft },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: PALETTE.ink4, labelBackgroundColor: PALETTE.navy },
          horzLine: { color: PALETTE.ink4, labelBackgroundColor: PALETTE.navy },
        },
        leftPriceScale: {
          visible: showRevenue,
          borderColor: PALETTE.rule,
          textColor: PALETTE.ink3,
          scaleMargins: { top: 0.1, bottom: 0.0 },
        },
        rightPriceScale: {
          borderColor: PALETTE.rule,
          scaleMargins: { top: 0.1, bottom: showRevenue ? 0.35 : 0.05 },
        },
        timeScale: {
          borderColor: PALETTE.rule,
          timeVisible: hasIntradayTimes,
          secondsVisible: false,
          ...(hasIntradayTimes && {
            tickMarkFormatter: (
              time: import("lightweight-charts").Time,
              tickMarkType: number,
            ) => {
              if (typeof time === "number") {
                const d = new Date(time * 1000);
                return tickMarkType <= 2 ? uyDayMonth.format(d) : uyHourMinute.format(d);
              }
              return typeof time === "string" ? time : String(time);
            },
          }),
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

      if (showRevenue && effectiveRevenue && effectiveRevenue.length > 0) {
        const revSeries = chart.addCustomSeries(new QuarterBarSeries(), {
          color: PALETTE.goldSoft,
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

      const sorted = renderSplit
        ? sortedAll.filter((p) => typeof p.time === "number" && p.time <= reg!.end)
        : sortedAll;

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
        color: PALETTE.navy,
        lineWidth: 2,
        priceScaleId: "right",
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: PALETTE.paper,
        crosshairMarkerBackgroundColor: PALETTE.navy,
      });
      regularSeries.setData(toLwPoints(regularData));
      lineSeriesRef.current = regularSeries;

      const extendedOpts = {
        color: PALETTE.navy300,
        lineWidth: 2 as const,
        lineStyle: LineStyle.Dashed,
        priceScaleId: "right",
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 3,
        crosshairMarkerBorderColor: PALETTE.paper,
        crosshairMarkerBackgroundColor: PALETTE.navy300,
      };
      const preSeries = preData.length > 0 ? chart.addSeries(LineSeries, extendedOpts) : null;
      if (preSeries) preSeries.setData(toLwPoints(preData));

      if (isIntraday && reg && sorted.length > 0) {
        const shading = new SessionShadingPrimitive({
          bandFill: "rgba(14, 17, 48, 0.05)",
          hairline: "rgba(14, 17, 48, 0.18)",
          labelText: "rgba(14, 17, 48, 0.55)",
        });
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

      // Force 3Y range button to actually show 3 years of horizontal span,
      // even when the issuer's price history is shorter (recent IPOs).
      if (range === "3Y" && sorted.length > 0) {
        const latestT = sorted[sorted.length - 1].time;
        if (typeof latestT === "string") {
          const latestMs = Date.parse(latestT);
          if (Number.isFinite(latestMs)) {
            const fromStr = new Date(latestMs - 3 * 365 * 86_400_000)
              .toISOString()
              .slice(0, 10);
            try {
              chart.timeScale().setVisibleRange({
                from: fromStr as unknown as import("lightweight-charts").Time,
                to: latestT as unknown as import("lightweight-charts").Time,
              });
            } catch { /* lightweight-charts throws if range invalid — keep fitContent fallback */ }
          }
        }
      }

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
  }, [prices, payload, showRevenue, isIntraday, hasIntradayTimes, effectiveRevenue, range]);

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

  const noData = !loading && payload && payload.prices.length === 0;

  const diff =
    pinned.length === 2
      ? {
          abs: pinned[1].price - pinned[0].price,
          pct: ((pinned[1].price - pinned[0].price) / pinned[0].price) * 100,
        }
      : null;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", border: `1px solid ${PALETTE.rule}` }}>
          {RANGES.map((r) => {
            const active = r.id === range;
            return (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectRange(r.id)}
                style={{
                  background: active ? PALETTE.navy : "transparent",
                  color: active ? PALETTE.paper : PALETTE.ink2,
                  border: 0,
                  padding: "6px 12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  cursor: "pointer",
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: PALETTE.ink3,
            letterSpacing: "0.04em",
          }}
        >
          {showRevenue && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  background: PALETTE.goldSoft,
                  display: "inline-block",
                  border: `1px solid ${PALETTE.gold}`,
                }}
              />
              Revenue trimestral
            </span>
          )}
          {loading && <span>Cargando…</span>}
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <div ref={containerRef} style={{ height: 280 }} />
        {error && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: PALETTE.neg,
              letterSpacing: "0.04em",
            }}
          >
            {error}
          </div>
        )}
        {noData && !error && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: PALETTE.ink3,
              letterSpacing: "0.04em",
            }}
          >
            Sin datos para este rango.
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, borderTop: `1px solid ${PALETTE.ruleSoft}`, paddingTop: 10 }}>
        {pinned.length === 0 ? (
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: PALETTE.ink4,
              letterSpacing: "0.04em",
            }}
          >
            Tocá el gráfico para marcar y comparar hasta 2 puntos.
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {pinned.map((p, i) => (
                <div
                  key={`${p.time}-${i}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: MARKER_COLORS[i],
                      display: "inline-block",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: PALETTE.ink2,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {fmtTime(p.time)}
                  </span>
                  {i < pinned.length - 1 && (
                    <span style={{ color: PALETTE.ink4, fontSize: 11, marginLeft: 4 }}>→</span>
                  )}
                </div>
              ))}
              {diff && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: 8,
                    paddingLeft: 12,
                    borderLeft: `1px solid ${PALETTE.ruleSoft}`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                      color: diff.abs >= 0 ? PALETTE.pos : PALETTE.neg,
                    }}
                  >
                    {diff.pct >= 0 ? "+" : ""}
                    {diff.pct.toFixed(1)}%
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      fontVariantNumeric: "tabular-nums",
                      color: diff.abs >= 0 ? PALETTE.pos : PALETTE.neg,
                      opacity: 0.7,
                    }}
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
              style={{
                background: "transparent",
                border: 0,
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: PALETTE.ink3,
              }}
            >
              Limpiar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
