"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { RevenueQuarter } from "@/types/StockData";
import type { ChartRange, ChartRangePayload } from "@/lib/fetchChartRange";
import { QuarterBarSeries } from "@/components/QuarterBarSeries";
import { DragRangePrimitive } from "@/components/DragRangePrimitive";
import { LineShadowPrimitive } from "@/components/LineShadowPrimitive";
import {
  attachDragRange,
  chronological,
  type DragRangeSelection,
} from "@/components/dragRange";
import { SessionShadingPrimitive, type SessionBounds } from "@/components/SessionShadingPrimitive";
import { PeriodSlider } from "@/components/institucional/PeriodSlider";

interface Props {
  ticker: string;
  historicalPrices: { time: string; value: number }[] | null;
  quarterlyRevenue?: RevenueQuarter[] | null;
  /** Moneda de cotización — rotula la unidad de los ejes. Viene del upstream
   *  (puede no ser USD en listados no estadounidenses), no se asume. */
  currency?: string;
  /** Último precio del informe (snapshot congelado, no un fetch vivo). */
  price?: number | null;
  /** Variación del día del snapshot — vs cierre previo, que la serie intradía
   *  no contiene: por eso en 1D no se deriva del gráfico. */
  change1dPct?: number | null;
  /** Momento al que corresponde el precio (ya formateado por el informe). */
  asOf?: string | null;
}

// Glosa del período bajo el chip: qué ventana mide el porcentaje. Sin ambigüedad
// de "en el año" (que se lee YTD) — son ventanas móviles hasta hoy.
// Cubre el tipo completo de ChartRange aunque el slider exponga sólo cuatro.
const RANGE_GLOSS: Record<ChartRange, string> = {
  "1D": "hoy",
  "5D": "últimos 5 días",
  "1M": "último mes",
  "3M": "últimos 3 meses",
  "1Y": "último año",
  "3Y": "últimos 3 años",
};

function fmtNumUY(n: number, dec = 2): string {
  const [whole, frac] = n.toFixed(dec).split(".");
  const withSep = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return frac ? `${withSep},${frac}` : withSep;
}

function fmtPctUY(n: number | null): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : "−"}${fmtNumUY(Math.abs(n))} %`;
}

// Día calendario en horario de Nueva York: la rueda es de allá, no del reloj de
// quien lee. Desde Montevideo (-03) el día coincide, pero no desde cualquier huso.
function etDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

// "viernes 24 de julio" — sin la coma que mete es-UY, para que encadene detrás
// de "Rueda del".
function fmtSessionDate(d: Date): string {
  return new Intl.DateTimeFormat("es-UY", {
    timeZone: "America/New_York",
    weekday: "long", day: "numeric", month: "long",
  })
    .format(d)
    .replace(",", "");
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
  // Revenue bars: light azure, tonal with the navy price line (same cool family)
  // but far lighter, so the line reads clearly on top and the bars recede as a
  // background data layer — never confused with the price. Also keeps the doc's
  // rule that gold is accent-only, never a large filled surface.
  revenueFill: "rgba(120, 168, 224, 0.32)",
  revenueEdge: "#5B93C9",
  pos: "#1F6B45",
  neg: "#8E2A2A",
  neu: "#5C5F7A",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LineSeriesApi = any;

// ── Color de la serie según el signo del período ────────────────────────────

/** rgba a partir del hex del sistema: el color vive UNA sola vez en PALETTE y de
 *  ahí salen las versiones con alfa, en vez de repetirlo en dos notaciones que
 *  después se desincronizan. */
function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Aclara un color mezclándolo con papel. Da el tono del tramo extendido
 *  (pre-market) a partir del color de la rueda, sin una segunda tabla de
 *  colores que mantener. */
function lighten(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  const out = (mix((n >> 16) & 255) << 16) | (mix((n >> 8) & 255) << 8) | mix(n & 255);
  return `#${out.toString(16).padStart(6, "0")}`;
}

/** Toda la tinta de la serie de precio, derivada de UN color base.
 *
 *  El base es el del signo del período que se está mirando —el mismo número que
 *  muestra el chip de arriba, no otro cálculo—: verde bosque si el tramo cierra
 *  en positivo, oxblood si cierra en negativo. Sin dato todavía (cargando, o
 *  serie de un solo punto) vuelve al navy: no se pinta un signo que no se sabe.
 *
 *  La sombra va acotada a pocos píxeles bajo la curva a propósito (ver
 *  LineShadowPrimitive): un relleno hasta el eje —la otra convención de market
 *  data— le pasaría por encima a las barras de revenue y dejaría cada barra de
 *  dos tonos según la cruce o no la línea. El tramo extendido (pre-market) lleva
 *  su versión aclarada, para que la cinta no corte en seco al abrir la rueda. */
function seriesInk(dir: "up" | "down" | null) {
  const base = dir === "up" ? PALETTE.pos : dir === "down" ? PALETTE.neg : PALETTE.navy;
  // El navy tiene su propio token para el tramo extendido; los del signo se
  // derivan con la misma distancia al papel.
  const ext = dir === null ? PALETTE.navy300 : lighten(base, 0.45);
  return {
    line: base,
    ext,
    shadow: rgba(base, 0.42),
    shadowExt: rgba(ext, 0.38),
    // Banda y bordes del tramo medido: el mismo color, en wash.
    band: rgba(base, 0.07),
    edge: rgba(base, 0.32),
  };
}

/** Ancla cada trimestre de revenue al punto de precio más cercano de la serie.
 *
 *  POR QUÉ: el revenue viene estampado a cierre de trimestre (31-mar, 30-jun…) y
 *  la serie de 3A es SEMANAL, así que esas fechas casi nunca son un cierre de la
 *  serie. lightweight-charts funde los tiempos de todas las series en una sola
 *  escala de índices: cada fecha suelta de revenue creaba un índice donde la
 *  línea de precio no tiene dato, y ahí la librería esconde el marcador del
 *  crosshair. Como cada barra termina en su propia fecha, ese índice cae justo
 *  en el hueco entre dos barras — pasabas el cursor por el hueco y el punto
 *  desaparecía. Anclando, todo índice de la escala tiene precio.
 *
 *  El corrimiento es de días sobre una ventana de tres años: la barra sigue
 *  ocupando su trimestre. Si la serie no tiene fechas diarias (caso intradía,
 *  donde el revenue ni se dibuja) devuelve los trimestres tal cual. */
export function anchorQuartersToPriceTimes(
  quarters: RevenueQuarter[],
  prices: { time: string | number }[],
): RevenueQuarter[] {
  const points = prices
    .filter((p): p is { time: string } => typeof p.time === "string")
    .map((p) => ({ time: p.time, ms: Date.parse(p.time) }))
    .filter((p) => Number.isFinite(p.ms))
    .sort((a, b) => a.ms - b.ms);
  if (points.length === 0) return quarters;

  const taken = new Set<string>();
  const anchored: RevenueQuarter[] = [];
  for (const q of quarters) {
    const target = Date.parse(q.time);
    if (!Number.isFinite(target)) continue;

    let best = points[0];
    for (const p of points) {
      if (Math.abs(p.ms - target) < Math.abs(best.ms - target)) best = p;
    }
    // Dos trimestres cayendo en el mismo cierre exigiría un hueco de meses en la
    // serie; si pasara, gana el primero: tiempos repetidos hacen que
    // lightweight-charts tire al hacer setData.
    if (taken.has(best.time)) continue;
    taken.add(best.time);
    anchored.push({ ...q, time: best.time });
  }
  return anchored;
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

export function PriceChartInstitucional({
  ticker,
  historicalPrices,
  quarterlyRevenue,
  currency = "USD",
  price = null,
  change1dPct = null,
  asOf = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<ChartRange>("3Y");
  const [cache, setCache] = useState<Map<ChartRange, ChartRangePayload>>(() => new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tramo medido con el gesto de arrastre. `null` = nada seleccionado. El ref lo
  // escribe el propio gesto (ver `onSelection`): el estado sólo alimenta la
  // lectura numérica, y el ref repone el tramo si hay que recrear el gráfico.
  const [selection, setSelection] = useState<DragRangeSelection | null>(null);
  const selectionRef = useRef<DragRangeSelection | null>(null);
  const [dragging, setDragging] = useState(false);
  const primitiveRef = useRef<DragRangePrimitive | null>(null);
  const lineSeriesRef = useRef<LineSeriesApi>(null);

  // Reset del tramo: limpia ref y estado a la vez. Se usa cuando cambia la serie
  // por afuera del gesto —otro rango, otro ticker—, casos que además recrean el
  // gráfico: si el ref quedara con el tramo viejo, el nuevo lo repondría.
  const resetSelection = useCallback(() => {
    selectionRef.current = null;
    setSelection(null);
  }, []);

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
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    resetSelection();
  }, [historicalPrices, ticker, resetSelection]);

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

  // Qué rueda se está graficando en 1D. La serie se ancla en el último día CON
  // barras, así que de noche y los fines de semana muestra la anterior: sin
  // rótulo, un eje que va de 05:00 a 21:00 se lee como si fuera de hoy. Cuando
  // sí es hoy no se dice nada — es el caso obvio y no merece ruido.
  const sessionNote = useMemo(() => {
    if (range !== "1D" || !payload || payload.prices.length === 0) return null;
    const anchor = payload.regularSession?.start ?? payload.prices[0].time;
    if (typeof anchor !== "number") return null;
    const day = new Date(anchor * 1000);
    if (etDayKey(day) === etDayKey(new Date())) return null;
    return `Rueda del ${fmtSessionDate(day)}`;
  }, [range, payload]);

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

    const ordered = [...inRange].sort((a, b) => a.time.localeCompare(b.time));
    const anchored = anchorQuartersToPriceTimes(ordered, prices ?? []);
    return anchored.length > 0 ? anchored : null;
  }, [quarterlyRevenue, range, prices]);
  const showRevenue = !!effectiveRevenue && effectiveRevenue.length > 0;

  // Variación del período que se está mirando: sigue al slider, no al día.
  // Se deriva de la MISMA serie que dibuja el gráfico (primer punto → último),
  // así el chip nunca contradice a la curva —aunque el rango venga de un fetch
  // posterior al snapshot—. La excepción es 1D: el cambio del día se mide contra
  // el cierre previo, que la serie intradía no incluye, así que ahí manda el dato
  // del informe.
  //
  // Vive acá arriba porque además de rotular el chip TIÑE la serie: el color de
  // la curva y el número que la explica salen del mismo cálculo, y así no pueden
  // contradecirse (curva verde con chip rojo).
  const rangePct = useMemo(() => {
    if (range === "1D") return change1dPct;
    if (!prices || prices.length < 2) return null;
    const first = prices[0].value;
    const last = prices[prices.length - 1].value;
    if (!first) return null;
    return ((last - first) / first) * 100;
  }, [range, prices, change1dPct]);

  const ink = useMemo(
    () => seriesInk(rangePct == null ? null : rangePct >= 0 ? "up" : "down"),
    [rangePct],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intencional al cambiar de rango
    resetSelection();
  }, [range, resetSelection]);

  useEffect(() => {
    if (!containerRef.current || !prices || prices.length === 0) return;

    let destroyed = false;
    let chartInstance: { remove: () => void } | null = null;
    let observerInstance: ResizeObserver | null = null;
    let detachPointer: (() => void) | null = null;

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
          // Sólo horizontales: son las que ayudan a leer un valor contra el eje.
          // Las verticales no aportan —la fecha se lee abajo— y encajonan el
          // gráfico en una cuadrícula, justo lo contrario a los datos sobre
          // hairlines del lenguaje visual.
          vertLines: { visible: false },
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
          color: PALETTE.revenueFill,
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
        color: ink.line,
        lineWidth: 2,
        priceScaleId: "right",
        priceLineVisible: false,
        // El último precio ya está en la tira de arriba: repetirlo pegado al eje
        // duplica el dato y le come lugar a las etiquetas de los puntos fijados.
        lastValueVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        // Punto pleno, sin el aro de papel alrededor. El primitive del tramo lee
        // ESTAS mismas opciones, así que el punto del hover y el del extremo
        // medido cambian juntos y no pueden separarse.
        crosshairMarkerBorderWidth: 0,
        crosshairMarkerBackgroundColor: ink.line,
      });
      regularSeries.setData(toLwPoints(regularData));
      lineSeriesRef.current = regularSeries;

      const extendedOpts = {
        color: ink.ext,
        lineWidth: 2 as const,
        lineStyle: LineStyle.Dashed,
        priceScaleId: "right",
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 3,
        crosshairMarkerBorderWidth: 0,
        crosshairMarkerBackgroundColor: ink.ext,
      };
      const preSeries = preData.length > 0 ? chart.addSeries(LineSeries, extendedOpts) : null;
      if (preSeries) preSeries.setData(toLwPoints(preData));

      // La línea deja caer su sombra. Cada tramo proyecta la suya —la del
      // pre-market en su propio tono— para que la cinta se lea continua.
      const shadow = new LineShadowPrimitive({ color: ink.shadow });
      regularSeries.attachPrimitive(shadow);
      shadow.setPoints(regularData);
      if (preSeries) {
        const preShadow = new LineShadowPrimitive({ color: ink.shadowExt });
        preSeries.attachPrimitive(preShadow);
        preShadow.setPoints(preData);
      }

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

      // La banda del tramo acompaña el color de la serie. El chip de la lectura
      // NO: ese sigue al signo del tramo medido, que puede ir al revés que el
      // período —un tramo en baja adentro de un año en alza— y ahí el color
      // discrepante es justamente el dato.
      const primitive = new DragRangePrimitive({
        band: ink.band,
        edge: ink.edge,
        marker: ink.line,
        markerHalo: PALETTE.paper,
      });
      regularSeries.attachPrimitive(primitive);
      primitiveRef.current = primitive;

      detachPointer = attachDragRange({
        chart,
        container,
        points: sorted,
        primitive,
        // También la de pre-market: en 1D pinta su propio punto sobre el mismo
        // extremo, con su color y su radio.
        markerSeries: [regularSeries, preSeries],
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
  }, [prices, payload, showRevenue, isIntraday, hasIntradayTimes, effectiveRevenue, range, ink]);

  const onSelectRange = useCallback((next: ChartRange) => {
    setRange(next);
  }, []);

  if (!historicalPrices || historicalPrices.length === 0) return null;

  const noData = !loading && payload && payload.prices.length === 0;

  // Lectura del tramo medido, siempre del extremo más viejo al más nuevo.
  const measure = (() => {
    if (!selection) return null;
    const [a, b] = chronological(selection.from, selection.to);
    if (!a.price) return null;
    return {
      a,
      b,
      abs: b.price - a.price,
      pct: ((b.price - a.price) / a.price) * 100,
    };
  })();

  return (
    <>
      {/* Cotización encima del gráfico —misma tira que el valor cuota en
          /bng-seleccion-global—. El precio es el del informe (foto congelada);
          el chip mide el período elegido en el slider. */}
      {price != null && (
        <div
          style={{
            display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap",
            paddingBottom: 14, marginBottom: 16, borderBottom: `1px solid ${PALETTE.ruleSoft}`,
          }}
        >
          {/* Precio y la fecha a la que corresponde, en columna: la fecha es del
              precio, no de la tira entera. */}
          <span style={{ display: "inline-flex", flexDirection: "column", gap: 7 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 500, lineHeight: 1, letterSpacing: "-0.01em", color: PALETTE.ink, fontVariantNumeric: "tabular-nums" }}>
              {fmtNumUY(price)}
              <span style={{ fontSize: 12, letterSpacing: "0.08em", color: PALETTE.ink3, marginLeft: "0.34em" }}>{currency}</span>
            </span>
            {asOf && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: PALETTE.ink3, fontVariantNumeric: "tabular-nums" }}>
                {asOf}
              </span>
            )}
          </span>
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
            {/* Sin dato para el rango (cargando o serie corta) el chip va en
                pizarra: no se inventa un signo que todavía no se sabe. */}
            <span
              style={{
                fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, lineHeight: 1,
                fontVariantNumeric: "tabular-nums", color: PALETTE.paper,
                background: rangePct == null ? PALETTE.neu : rangePct >= 0 ? PALETTE.pos : PALETTE.neg,
                padding: "5px 8px", borderRadius: 4,
                transition: "background 200ms ease",
              }}
            >
              {fmtPctUY(rangePct)}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: PALETTE.ink3 }}>
              {RANGE_GLOSS[range]}
            </span>
          </span>
        </div>
      )}

      {/* Barra de controles FUERA del bloque del gráfico — mismo patrón que el
          valor cuota en /bng-seleccion-global: los controles viven arriba y el
          marco con hairline contiene únicamente el gráfico. */}
      <div className="az-figure-bar">
        <span className="lbl">
          <strong>{ticker}</strong> · Precio histórico
          {sessionNote && <span style={{ color: PALETTE.ink3 }}> · {sessionNote}</span>}
        </span>
        <PeriodSlider
          periods={RANGES}
          value={range}
          onChange={onSelectRange}
          ariaLabel="Período del gráfico"
        />
      </div>

      <div className="az-figure">
        <div className="az-figure-hd">
          <span
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
                    background: PALETTE.revenueFill,
                    display: "inline-block",
                    border: `1px solid ${PALETTE.revenueEdge}`,
                  }}
                />
                Revenue trimestral
              </span>
            )}
            {loading && <span>Cargando…</span>}
          </span>
          {/* Sólo el crédito de la fuente. La moneda ya va junto al precio en la
              tira de arriba, y el informe es una foto congelada: rotularlo
              "Live" contradecía el snapshot. */}
          <span className="src">Yahoo Finance</span>
        </div>

        <div style={{ position: "relative" }}>
          {/* cursor de mira + sin selección de texto: el arrastre es un gesto de
              medición, no una selección del documento. */}
          <div
            ref={containerRef}
            style={{
              height: 280,
              cursor: "crosshair",
              userSelect: dragging ? "none" : undefined,
              WebkitUserSelect: dragging ? "none" : undefined,
            }}
          />
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

        {/* Lectura del tramo: sólo existe mientras se arrastra. minHeight fija la
            altura para que la tira no salte al aparecer/desaparecer la medición. */}
        <div
          style={{
            marginTop: 10,
            borderTop: `1px solid ${PALETTE.ruleSoft}`,
            paddingTop: 10,
            minHeight: 34,
            display: "flex",
            alignItems: "center",
          }}
        >
          {!measure ? (
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: PALETTE.ink4,
                letterSpacing: "0.04em",
              }}
            >
              Arrastrá sobre el gráfico para medir un tramo.
            </p>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {/* Extremos del tramo: fecha y precio de cada punto real. */}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: PALETTE.ink2,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtTime(measure.a.time)} · {fmtPrice(measure.a.price)}
              </span>
              <span style={{ color: PALETTE.ink4, fontSize: 11 }}>→</span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: PALETTE.ink2,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtTime(measure.b.time)} · {fmtPrice(measure.b.price)}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 8,
                  paddingLeft: 12,
                  borderLeft: `1px solid ${PALETTE.ruleSoft}`,
                }}
              >
                {/* La variación va en chip de fondo pleno (verde bosque /
                    oxblood del sistema) — misma señal que el valor cuota de
                    /bng-seleccion-global. El absoluto queda al lado en tinta
                    neutra: el color ya lo carga el chip, duplicarlo satura. */}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    fontWeight: 600,
                    lineHeight: 1,
                    fontVariantNumeric: "tabular-nums",
                    color: PALETTE.paper,
                    background: measure.abs >= 0 ? PALETTE.pos : PALETTE.neg,
                    padding: "5px 8px",
                    borderRadius: 4,
                  }}
                >
                  {measure.pct >= 0 ? "+" : ""}
                  {measure.pct.toFixed(1).replace(".", ",")}%
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    fontVariantNumeric: "tabular-nums",
                    color: PALETTE.ink3,
                  }}
                >
                  {measure.abs >= 0 ? "+" : ""}
                  {fmtPrice(measure.abs)}
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
