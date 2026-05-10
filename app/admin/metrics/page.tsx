"use client";

import { useEffect, useState, useCallback } from "react";
import { SankeyChart } from "@/components/SankeyChart";
import type { SegmentSankeyData } from "@/types/Report";

interface StatusRow { status: string; n: number }
interface TickerRow { ticker: string; total: number; errors: number }
interface SourceRow { sankey_source: string | null; n: number }
interface StageRow  { error_stage: string | null; n: number }
interface RecentErrorRow {
  ts: number;
  ticker: string;
  status: string;
  error_stage: string | null;
  error_msg: string | null;
  sankey_source: string | null;
  duration_ms: number | null;
  country: string | null;
}
interface QualitySummary {
  n: number;
  avg_score: number | null;
  with_segments: number | null;
  with_opex_breakdown: number | null;
  avg_seg_imbalance: number | null;
  avg_opex_imbalance: number | null;
  avg_cost_imbalance: number | null;
}
interface QualityBucket { bucket: string; n: number }
interface LowQualityTicker {
  ticker: string;
  n: number;
  avg_score: number | null;
  min_score: number | null;
  avg_seg_imbalance: number | null;
  avg_opex_imbalance: number | null;
}
interface FlagRow { flag: string; n: number }

interface EventFinding {
  code: string;
  severity: "info" | "warn" | "error";
  message: string;
  values?: Record<string, number | string>;
}
interface EventSnapshotSegment { name: string; value: number }
interface SlimSankey {
  currency?: string;
  period?: string;
  endDate?: string;
  source?: string;
  unit?: string;
  totalRevenue?: number;
  grossProfit?: number;
  costOfRevenue?: number;
  operatingExpenses?: number;
  operatingProfit?: number;
  netProfit?: number;
  segments?: EventSnapshotSegment[];
  opexBreakdown?: Record<string, number | undefined>;
  tax?: number;
  nonOperatingIncome?: number;
  industryProfile?: string;
}
interface Edgar8KRaw {
  cik?: string;
  accession?: string;
  sourceUrl?: string;
  form?: string;
  endDate?: string;
  currency?: string;
  isAnnual?: boolean;
  isSemiAnnual?: boolean;
  fiscalYearEndMonth?: number;
  totalRevenue?: number;
  costOfRevenue?: number | null;
  grossProfit?: number | null;
  researchDevelopment?: number | null;
  sellingGeneralAdministrative?: number | null;
  totalOperatingExpenses?: number | null;
  operatingIncome?: number | null;
  interestExpense?: number | null;
  incomeBeforeTax?: number | null;
  incomeTaxExpense?: number | null;
  netIncome?: number;
  aircraftFuel?: number | null;
  salariesWages?: number | null;
  aircraftMaintenance?: number | null;
  aircraftRent?: number | null;
  landingFees?: number | null;
  depreciationAmortization?: number | null;
  segments?: EventSnapshotSegment[];
}
interface YahooQuarter {
  endDate?: string;
  totalRevenue?: number | null;
  grossProfit?: number | null;
  costOfRevenue?: number | null;
  operatingIncome?: number | null;
  netIncome?: number | null;
  totalOperatingExpenses?: number | null;
  researchDevelopment?: number | null;
  sellingGeneralAdministrative?: number | null;
}
interface EventSnapshot {
  finalSankey?: SlimSankey | null;
  overridePath?: string;
  edgar8kRaw?: Edgar8KRaw;
  xbrlSegmentsRaw?: SlimSankey | null;
  yahooQuarter?: YahooQuarter | null;
  yahooCurrency?: string | null;
  filingIndexUrl?: string | null;
}
interface DrillEvent {
  id: number;
  ts: number;
  ticker: string;
  status: string;
  durationMs: number | null;
  sankeySource: string | null;
  sankeyStale: boolean;
  qualityScore: number | null;
  balances: { segment: number | null; cost: number | null; opex: number | null; opChain: number | null };
  findings: EventFinding[] | null;
  snapshot: EventSnapshot | null;
  errorStage: string | null;
  errorMsg: string | null;
  verdict: { rating: string | null; conviction: string | null; rationale: string | null } | null;
  market: { companyName: string | null; currentPrice: number | null; marketCap: number | null };
  priceTargets: { bull: string | null; bear: string | null };
}
interface DrillResponse {
  ticker: string;
  count: number;
  events: DrillEvent[];
}

interface MetricsResponse {
  generatedAt: number;
  totals: {
    allTime: number;
    byStatus24h: StatusRow[];
    byStatus7d:  StatusRow[];
    byStatus30d: StatusRow[];
  };
  upstream: { edgar_ok: number | null; edgar_fail: number | null; segments_ok: number | null; segments_fail: number | null };
  failingTickers: TickerRow[];
  sourceMix: SourceRow[];
  errorsByStage: StageRow[];
  latency24h: { sampleSize: number; p50: number | null; p95: number | null; p99: number | null; max: number | null };
  recentErrors: RecentErrorRow[];
  timeseries24h: { bucketMs: number; rows: { bucketMs: number; status: string; n: number }[] };
  quality: {
    summary: QualitySummary | null;
    buckets: QualityBucket[];
    lowQualityTickers: LowQualityTicker[];
    flagBreakdown: FlagRow[];
    lowQualityEvents: LowQualityEvent[];
  };
  topTickers: {
    week: TopTickerRow[];
    allTime: TopTickerRow[];
  };
  analyses: {
    counts: AnalysisCounts;
    dailyVolume: DailyVolumeRow[];
    popular: PopularAnalysis[];
    recent: RecentAnalysis[];
  };
}

interface TopTickerRow {
  ticker: string;
  searches: number;
  uniques: number;
  last_ts: number;
  first_ts?: number;
}

interface AnalysisCounts {
  today: number;
  week: number;
  allTime: number;
  uniqueWeek: number;
  uniqueAllTime: number;
}

interface DailyVolumeRow {
  bucketMs: number;
  fresh: number;
  cached: number;
  errors: number;
}

interface PopularAnalysis {
  ticker: string;
  searches: number;
  uniques: number;
  last_ts: number;
  verdict_rating: string | null;
  verdict_conviction: string | null;
  verdict_rationale: string | null;
  company_name: string | null;
  current_price: number | null;
  market_cap: number | null;
  bull_target: string | null;
  bear_target: string | null;
  last_quality_score: number | null;
}

interface RecentAnalysis {
  ticker: string;
  ts: number;
  verdict_rating: string | null;
  verdict_conviction: string | null;
  company_name: string | null;
  current_price: number | null;
  market_cap: number | null;
  last_quality_score: number | null;
}

interface LowQualityEvent {
  id: number;
  ts: number;
  ticker: string;
  status: string;
  sankeySource: string | null;
  qualityScore: number;
  segmentBalancePct: number | null;
  opexBalancePct: number | null;
  costBalancePct: number | null;
  findings: EventFinding[] | null;
}

const FLAG_LABEL: Record<string, string> = {
  no_segments: "Sin segmentos (revenue sin breakdown)",
  few_segments: "Solo 1 segmento",
  segment_imbalance: "Segmentos no suman al revenue",
  cost_imbalance: "COGS + GP ≠ revenue",
  opex_imbalance: "Breakdown de OpEx no suma",
  op_chain_imbalance: "Op profit ≠ NI + tax + non-op",
  no_opex_breakdown: "OpEx sin desglose",
  missing_op_profit: "Sin op profit reportado",
  missing_net_profit: "Sin net profit reportado",
  no_revenue: "Sin revenue (Sankey vacío)",
  using_yahoo_fallback: "Yahoo fallback (8-K parser falló)",
  using_yahoo_ttm: "Yahoo TTM stub (sin datos reales del trimestre)",
  period_is_annual: "Período anual (no derivó Q4)",
  no_terminal_flow: "Sankey sin nodo terminal (flujos sin destino)",
  loss_not_represented: "Pérdida sin nodo Loss",
  truncated_segment_names: "Nombres de segmento se truncan",
  crowded_opex_breakdown: "OpEx con demasiados buckets (labels chocan)",
  tiny_terminal_node: "Nodo final con altura sub-píxel",
  extreme_segment_disparity: "Segmentos con escalas muy distintas",
};

const TOKEN_KEY = "ticker:admin-token";
const DAY_MS = 24 * 60 * 60 * 1000;

function fmtTs(ts: number): string {
  return new Date(ts).toLocaleString("es-UY", { timeZone: "America/Montevideo" });
}

function statusCount(rows: StatusRow[], status: string): number {
  return rows.find((r) => r.status === status)?.n ?? 0;
}

function totalCount(rows: StatusRow[]): number {
  return rows.reduce((s, r) => s + r.n, 0);
}

function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function fmtMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const SOURCE_LABEL: Record<string, string> = {
  "8k": "8-K (press release)",
  "6k": "6-K (foreign issuer)",
  "segments": "XBRL segments",
  "yahoo_fallback": "Yahoo (fallback)",
  "yahoo_ttm": "Yahoo (TTM stub)",
  "none": "Sin Sankey",
};

const STATUS_LABEL: Record<string, string> = {
  ok: "OK",
  cache_hit: "Cache hit",
  error: "Error",
  rate_limited: "Rate limited",
  bad_request: "Bad request",
  not_found: "Not found",
};

export default function MetricsDashboard() {
  const [token, setToken] = useState<string>("");
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<{ ticker: string; data: DrillResponse | null; loading: boolean; error: string | null } | null>(null);
  const [feedScope, setFeedScope] = useState<"issues" | "all">("issues");

  const openDrill = useCallback(async (ticker: string) => {
    setDrill({ ticker, data: null, loading: true, error: null });
    try {
      const res = await fetch(`/api/admin/events?ticker=${encodeURIComponent(ticker)}&limit=25`, {
        headers: { "x-admin-token": token },
        cache: "no-store",
      });
      if (!res.ok) {
        setDrill({ ticker, data: null, loading: false, error: `Error ${res.status}` });
        return;
      }
      const json = (await res.json()) as DrillResponse;
      setDrill({ ticker, data: json, loading: false, error: null });
    } catch (e) {
      setDrill({ ticker, data: null, loading: false, error: e instanceof Error ? e.message : "network error" });
    }
  }, [token]);

  const closeDrill = useCallback(() => setDrill(null), []);

  // Re-hydrate token from sessionStorage on mount. sessionStorage isn't an
  // observable store and we can't init useState lazily without a hydration
  // mismatch (server render has no access to it), so a one-shot effect is the
  // right fit despite the lint rule's preference for derived state.
  useEffect(() => {
    const saved = typeof window !== "undefined" ? sessionStorage.getItem(TOKEN_KEY) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setToken(saved);
  }, []);

  const load = useCallback(async (t: string, scope: "issues" | "all" = "issues") => {
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/metrics?scope=${scope}`, {
        headers: { "x-admin-token": t },
        cache: "no-store",
      });
      if (res.status === 401) {
        setError("Token inválido");
        setData(null);
        return;
      }
      if (!res.ok) {
        setError(`Error ${res.status}`);
        setData(null);
        return;
      }
      const json = (await res.json()) as MetricsResponse;
      setData(json);
      sessionStorage.setItem(TOKEN_KEY, t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 60s once authenticated, preserving current scope
  useEffect(() => {
    if (!data || !token) return;
    const id = setInterval(() => load(token, feedScope), 60_000);
    return () => clearInterval(id);
  }, [data, token, load, feedScope]);

  // Re-fetch when user toggles scope. `load` flips `loading` synchronously,
  // which the new lint rule flags — but the alternative (driving the fetch
  // via a derived state machine) is more code for the same effect. `load` is
  // stable via useCallback; including it would loop.
  /* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!data || !token) return;
    load(token, feedScope);
  }, [feedScope]);
  /* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

  if (!data) {
    return (
      <main className="min-h-screen bg-[#F8F9FF] flex items-center justify-center px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(token);
          }}
          className="w-full max-w-sm bg-white border border-[#03065E]/10 rounded-lg p-8 shadow-sm"
        >
          <h1 className="text-xl font-semibold text-[#03065E] mb-2">Monitor</h1>
          <p className="text-sm text-[#03065E]/70 mb-6">Ingresá el token de admin para acceder.</p>
          <input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full px-3 py-2 border border-[#03065E]/20 rounded text-[#03065E] focus:outline-none focus:border-[#03065E]"
            placeholder="x-admin-token"
          />
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          <button
            type="submit"
            disabled={loading || !token}
            className="mt-6 w-full bg-[#03065E] text-white py-2 rounded font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Cargando…" : "Entrar"}
          </button>
        </form>
      </main>
    );
  }

  const total24h = totalCount(data.totals.byStatus24h);
  const ok24h = statusCount(data.totals.byStatus24h, "ok") + statusCount(data.totals.byStatus24h, "cache_hit");
  const err24h = statusCount(data.totals.byStatus24h, "error");
  const total7d = totalCount(data.totals.byStatus7d);
  const err7d = statusCount(data.totals.byStatus7d, "error");
  const sourceTotal = data.sourceMix.reduce((s, r) => s + r.n, 0);

  return (
    <main className="min-h-screen bg-[#F8F9FF] text-[#03065E]">
      <header className="border-b border-[#03065E]/10 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Monitor</h1>
            <p className="text-xs text-[#03065E]/60 mt-0.5">
              Generado {fmtTs(data.generatedAt)} · auto-refresh 60s
            </p>
          </div>
          <div className="flex items-center gap-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const t = (f.get("t") as string)?.trim().toUpperCase();
                if (t) openDrill(t);
              }}
            >
              <input
                name="t"
                placeholder="Inspeccionar ticker…"
                className="px-3 py-1.5 text-sm border border-[#03065E]/20 rounded w-48 focus:outline-none focus:border-[#03065E]"
              />
            </form>
            <button
              onClick={() => load(token, feedScope)}
              disabled={loading}
              className="text-sm px-3 py-1.5 border border-[#03065E]/20 rounded hover:bg-[#03065E]/5 disabled:opacity-50"
            >
              {loading ? "…" : "Refrescar"}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* KPIs principales — análisis hechos */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi
            label="Análisis hoy"
            value={(data.analyses.counts.today ?? 0).toLocaleString()}
            sub="día calendario (UY)"
          />
          <Kpi
            label="Análisis esta semana"
            value={(data.analyses.counts.week ?? 0).toLocaleString()}
            sub={`${(data.analyses.counts.uniqueWeek ?? 0).toLocaleString()} tickers únicos`}
          />
          <Kpi
            label="Total histórico"
            value={(data.analyses.counts.allTime ?? 0).toLocaleString()}
            sub={`${(data.analyses.counts.uniqueAllTime ?? 0).toLocaleString()} tickers únicos`}
          />
          <Kpi
            label="Tasa de éxito 24h"
            value={pct(ok24h, total24h)}
            sub={`${err24h} errores`}
            accent={total24h && ok24h / total24h < 0.95 ? "warn" : "ok"}
          />
        </section>

        {/* Volume chart: last 30 days */}
        <Card title="Análisis por día (30 días)" sub="Verde = fresh · Azul = cache hit · Rojo = errores">
          <VolumeChart data={data.analyses.dailyVolume} />
        </Card>

        {/* Análisis recientes — feed cronológico con verdict */}
        <Card
          title="Análisis recientes"
          sub={data.analyses.recent.length > 0 ? `Últimos ${data.analyses.recent.length} tickers únicos analizados · click para ver chart, Sankey y detalle` : "Aún no hay análisis."}
        >
          <RecentAnalysesGrid rows={data.analyses.recent} onClick={openDrill} />
        </Card>

        {/* Análisis más populares — table con click-through */}
        <Card
          title="Análisis más populares (histórico)"
          sub={`${data.analyses.popular.length} tickers · click en cualquier fila para ver el análisis completo`}
        >
          <PopularAnalysesTable rows={data.analyses.popular} onClick={openDrill} />
        </Card>

        {/* Detalles técnicos — colapsable, info para debugging */}
        <details className="group">
          <summary className="cursor-pointer list-none flex items-center justify-between bg-white border border-[#03065E]/10 rounded-lg px-5 py-3 hover:bg-[#03065E]/[0.02]">
            <span className="font-semibold text-[#03065E]">Detalles técnicos</span>
            <span className="text-xs text-[#03065E]/60">
              Volumen, latencia, errores, calidad de Sankey, upstreams · click para expandir
            </span>
          </summary>
          <div className="space-y-6 mt-4">

        {/* Top tickers histórico (table classic) */}
        <section className="grid md:grid-cols-2 gap-3">
          <TopTickersCard
            title="Top tickers (7 días)"
            sub={`${data.topTickers.week.length} únicos · click para inspeccionar`}
            rows={data.topTickers.week}
            onClick={openDrill}
          />
          <TopTickersCard
            title="Top tickers (histórico)"
            sub="Hasta 90 días atrás"
            rows={data.topTickers.allTime}
            onClick={openDrill}
            showFirstSeen
          />
        </section>

        {/* Latency + raw status counts */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Requests 24h" value={total24h.toLocaleString()} />
          <Kpi label="Tasa de éxito 24h" value={pct(ok24h, total24h)} accent={total24h && ok24h / total24h < 0.95 ? "warn" : "ok"} />
          <Kpi label="Errores 24h" value={String(err24h)} accent={err24h > 0 ? "warn" : "ok"} />
          <Kpi label="p95 latencia 24h" value={fmtMs(data.latency24h.p95)} sub={`p50 ${fmtMs(data.latency24h.p50)}`} />
        </section>

        {/* Volume by status, 24h / 7d / 30d */}
        <section className="grid md:grid-cols-3 gap-3">
          <StatusCard title="Últimas 24h" rows={data.totals.byStatus24h} total={total24h} />
          <StatusCard title="Últimos 7 días" rows={data.totals.byStatus7d} total={total7d} />
          <StatusCard title="Últimos 30 días" rows={data.totals.byStatus30d} total={totalCount(data.totals.byStatus30d)} />
        </section>

        {/* Sankey source mix + errors by stage */}
        <section className="grid md:grid-cols-2 gap-3">
          <Card title="Sankey — fuente (7d)" sub={`${sourceTotal.toLocaleString()} requests con chart`}>
            <table className="w-full text-sm">
              <tbody>
                {data.sourceMix.map((r) => {
                  const key = r.sankey_source ?? "none";
                  const w = sourceTotal ? (r.n / sourceTotal) * 100 : 0;
                  return (
                    <tr key={key} className="border-b border-[#03065E]/5 last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap">{SOURCE_LABEL[key] ?? key}</td>
                      <td className="py-2 pr-3 w-full">
                        <div className="h-2 rounded-full bg-[#03065E]/5 overflow-hidden">
                          <div className="h-full bg-[#03065E]" style={{ width: `${w}%` }} />
                        </div>
                      </td>
                      <td className="py-2 text-right tabular-nums w-20">{r.n} · {w.toFixed(1)}%</td>
                    </tr>
                  );
                })}
                {sourceTotal === 0 && <tr><td className="py-3 text-[#03065E]/50 text-sm">Sin datos en este rango.</td></tr>}
              </tbody>
            </table>
          </Card>

          <Card title="Errores por etapa (7d)" sub={`${err7d} errores totales`}>
            <table className="w-full text-sm">
              <tbody>
                {data.errorsByStage.map((r) => {
                  const key = r.error_stage ?? "(null)";
                  const w = err7d ? (r.n / err7d) * 100 : 0;
                  return (
                    <tr key={key} className="border-b border-[#03065E]/5 last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap font-mono text-xs">{key}</td>
                      <td className="py-2 pr-3 w-full">
                        <div className="h-2 rounded-full bg-[#03065E]/5 overflow-hidden">
                          <div className="h-full bg-red-500" style={{ width: `${w}%` }} />
                        </div>
                      </td>
                      <td className="py-2 text-right tabular-nums w-20">{r.n} · {w.toFixed(1)}%</td>
                    </tr>
                  );
                })}
                {data.errorsByStage.length === 0 && <tr><td className="py-3 text-[#03065E]/50 text-sm">Sin errores en 7 días. </td></tr>}
              </tbody>
            </table>
          </Card>
        </section>

        {/* Upstream availability */}
        <Card title="Upstreams (24h)" sub="Tasa de éxito en cada fuente externa">
          <div className="grid grid-cols-2 gap-4">
            <UpstreamRow
              label="EDGAR 8-K parser"
              ok={data.upstream.edgar_ok ?? 0}
              fail={data.upstream.edgar_fail ?? 0}
            />
            <UpstreamRow
              label="EDGAR segments (XBRL)"
              ok={data.upstream.segments_ok ?? 0}
              fail={data.upstream.segments_fail ?? 0}
            />
          </div>
        </Card>

        {/* Calidad del Sankey */}
        <Card title="Calidad del Sankey (7d)" sub={qualitySub(data.quality.summary)}>
          {data.quality.summary && data.quality.summary.n > 0 ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi
                  label="Score promedio"
                  value={data.quality.summary.avg_score !== null ? data.quality.summary.avg_score.toFixed(0) : "—"}
                  accent={(data.quality.summary.avg_score ?? 100) < 75 ? "warn" : "ok"}
                />
                <Kpi
                  label="Con segmentos"
                  value={pct(data.quality.summary.with_segments ?? 0, data.quality.summary.n)}
                />
                <Kpi
                  label="Con desglose OpEx"
                  value={pct(data.quality.summary.with_opex_breakdown ?? 0, data.quality.summary.n)}
                />
                <Kpi
                  label="Imbalance segmentos"
                  value={data.quality.summary.avg_seg_imbalance !== null ? `${data.quality.summary.avg_seg_imbalance.toFixed(1)}%` : "—"}
                  sub="promedio |Σsegmentos − rev|"
                />
              </div>

              {/* Score distribution buckets */}
              <div>
                <p className="text-xs uppercase tracking-wide text-[#03065E]/60 mb-2">Distribución de score</p>
                <table className="w-full text-sm">
                  <tbody>
                    {["90-100", "70-89", "50-69", "30-49", "0-29"].map((b) => {
                      const row = data.quality.buckets.find((x) => x.bucket === b);
                      const n = row?.n ?? 0;
                      const total = data.quality.summary?.n ?? 0;
                      const w = total ? (n / total) * 100 : 0;
                      const color =
                        b === "90-100" ? "bg-emerald-600"
                        : b === "70-89" ? "bg-emerald-500/70"
                        : b === "50-69" ? "bg-amber-500"
                        : b === "30-49" ? "bg-orange-500"
                        : "bg-red-500";
                      return (
                        <tr key={b} className="border-b border-[#03065E]/5 last:border-0">
                          <td className="py-2 pr-3 w-20 font-mono">{b}</td>
                          <td className="py-2 pr-3 w-full">
                            <div className="h-2 rounded-full bg-[#03065E]/5 overflow-hidden">
                              <div className={`h-full ${color}`} style={{ width: `${w}%` }} />
                            </div>
                          </td>
                          <td className="py-2 text-right tabular-nums w-24">{n} · {w.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Flags / problemas detectados */}
              {data.quality.flagBreakdown.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#03065E]/60 mb-2">Problemas detectados</p>
                  <table className="w-full text-sm">
                    <tbody>
                      {data.quality.flagBreakdown.map((r) => {
                        const total = data.quality.summary?.n ?? 0;
                        const w = total ? (r.n / total) * 100 : 0;
                        return (
                          <tr key={r.flag} className="border-b border-[#03065E]/5 last:border-0">
                            <td className="py-2 pr-3 whitespace-nowrap">{FLAG_LABEL[r.flag] ?? r.flag}</td>
                            <td className="py-2 pr-3 w-full">
                              <div className="h-2 rounded-full bg-[#03065E]/5 overflow-hidden">
                                <div className="h-full bg-amber-500" style={{ width: `${w}%` }} />
                              </div>
                            </td>
                            <td className="py-2 text-right tabular-nums w-24">{r.n} · {w.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#03065E]/50 py-3">Sin datos de calidad todavía. Hacé alguna búsqueda para empezar a poblar.</p>
          )}
        </Card>

        {/* Feed de Sankeys recientes — toggleable entre solo problemas y todos */}
        <Card
          title={feedScope === "all" ? "Sankeys recientes (7d)" : "Sankeys con baja calidad (7d)"}
          sub={
            data.quality.lowQualityEvents.length === 0
              ? feedScope === "all"
                ? "Sin eventos en este rango."
                : "Sin Sankeys con score < 80 — todo bien."
              : feedScope === "all"
                ? `${data.quality.lowQualityEvents.length} eventos, más recientes primero · click en el ticker para ver el snapshot completo`
                : `${data.quality.lowQualityEvents.length} eventos con score < 80 · click para inspeccionar`
          }
        >
          <div className="mb-3 flex gap-1 text-xs">
            <button
              onClick={() => setFeedScope("issues")}
              className={`px-2.5 py-1 rounded ${feedScope === "issues" ? "bg-[#03065E] text-white" : "bg-[#03065E]/5 text-[#03065E]/70 hover:bg-[#03065E]/10"}`}
            >
              Solo problemas (&lt; 80)
            </button>
            <button
              onClick={() => setFeedScope("all")}
              className={`px-2.5 py-1 rounded ${feedScope === "all" ? "bg-[#03065E] text-white" : "bg-[#03065E]/5 text-[#03065E]/70 hover:bg-[#03065E]/10"}`}
            >
              Todos los Sankeys
            </button>
          </div>
          <div className="space-y-3">
            {data.quality.lowQualityEvents.map((ev) => (
              <LowQualityEventCard key={ev.id} ev={ev} onInspect={() => openDrill(ev.ticker)} />
            ))}
            {data.quality.lowQualityEvents.length === 0 && (
              <p className="text-sm text-[#03065E]/50 py-3">
                {feedScope === "all" ? "Sin eventos." : "Sin Sankeys con problemas. "}
              </p>
            )}
          </div>
        </Card>

        {/* Tickers con peor calidad */}
        {data.quality.lowQualityTickers.length > 0 && (
          <Card title="Tickers con menor calidad de Sankey (7d)" sub="Score promedio < 80, peores primero">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-[#03065E]/60 border-b border-[#03065E]/10">
                    <th className="text-left py-2">Ticker</th>
                    <th className="text-right py-2">Requests</th>
                    <th className="text-right py-2">Score promedio</th>
                    <th className="text-right py-2">Score min</th>
                    <th className="text-right py-2">Imbalance segmentos</th>
                    <th className="text-right py-2">Imbalance OpEx</th>
                  </tr>
                </thead>
                <tbody>
                  {data.quality.lowQualityTickers.map((r) => (
                    <tr
                      key={r.ticker}
                      onClick={() => openDrill(r.ticker)}
                      className="border-b border-[#03065E]/5 last:border-0 cursor-pointer hover:bg-[#03065E]/5"
                    >
                      <td className="py-2 font-mono">{r.ticker}</td>
                      <td className="py-2 text-right tabular-nums">{r.n}</td>
                      <td className="py-2 text-right tabular-nums text-amber-600">{r.avg_score !== null ? r.avg_score.toFixed(0) : "—"}</td>
                      <td className="py-2 text-right tabular-nums">{r.min_score !== null ? r.min_score.toFixed(0) : "—"}</td>
                      <td className="py-2 text-right tabular-nums">{r.avg_seg_imbalance !== null ? `${r.avg_seg_imbalance.toFixed(1)}%` : "—"}</td>
                      <td className="py-2 text-right tabular-nums">{r.avg_opex_imbalance !== null ? `${r.avg_opex_imbalance.toFixed(1)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Top failing tickers */}
        <Card title="Top tickers con errores (7d)" sub="Mayor cantidad de fallos primero">
          {data.failingTickers.length === 0 ? (
            <p className="text-sm text-[#03065E]/50 py-3">Sin tickers con errores. </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-[#03065E]/60 border-b border-[#03065E]/10">
                  <th className="text-left py-2">Ticker</th>
                  <th className="text-right py-2">Total</th>
                  <th className="text-right py-2">Errores</th>
                  <th className="text-right py-2">Tasa</th>
                </tr>
              </thead>
              <tbody>
                {data.failingTickers.map((r) => (
                  <tr
                    key={r.ticker}
                    onClick={() => openDrill(r.ticker)}
                    className="border-b border-[#03065E]/5 last:border-0 cursor-pointer hover:bg-[#03065E]/5"
                  >
                    <td className="py-2 font-mono">{r.ticker}</td>
                    <td className="py-2 text-right tabular-nums">{r.total}</td>
                    <td className="py-2 text-right tabular-nums text-red-600">{r.errors}</td>
                    <td className="py-2 text-right tabular-nums">{pct(r.errors, r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Recent errors tail */}
        <Card title="Errores recientes" sub="Últimos 50, más nuevos primero">
          {data.recentErrors.length === 0 ? (
            <p className="text-sm text-[#03065E]/50 py-3">Sin errores recientes. </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#03065E]/60 border-b border-[#03065E]/10">
                    <th className="text-left py-2 pr-3">Hora</th>
                    <th className="text-left py-2 pr-3">Ticker</th>
                    <th className="text-left py-2 pr-3">Etapa</th>
                    <th className="text-left py-2 pr-3">Fuente</th>
                    <th className="text-left py-2 pr-3">País</th>
                    <th className="text-left py-2 pr-3">ms</th>
                    <th className="text-left py-2">Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentErrors.map((r, i) => (
                    <tr key={i} className="border-b border-[#03065E]/5 last:border-0 align-top">
                      <td className="py-2 pr-3 whitespace-nowrap font-mono">{fmtTs(r.ts)}</td>
                      <td className="py-2 pr-3 font-mono">{r.ticker}</td>
                      <td className="py-2 pr-3 font-mono">{r.error_stage ?? "—"}</td>
                      <td className="py-2 pr-3 font-mono">{r.sankey_source ?? "—"}</td>
                      <td className="py-2 pr-3 font-mono">{r.country ?? "—"}</td>
                      <td className="py-2 pr-3 tabular-nums">{r.duration_ms ?? "—"}</td>
                      <td className="py-2 text-[#03065E]/80 break-words">{r.error_msg ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

          </div>
        </details>

        <p className="text-xs text-[#03065E]/50 pt-2">
          Total histórico almacenado: {data.totals.allTime.toLocaleString()} eventos.
        </p>
      </div>

      {drill && (
        <DrillDrawer
          state={drill}
          onClose={closeDrill}
        />
      )}
    </main>
  );
}

function DrillDrawer({
  state,
  onClose,
}: {
  state: { ticker: string; data: DrillResponse | null; loading: boolean; error: string | null };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/30" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl bg-white shadow-xl overflow-y-auto border-l border-[#03065E]/10"
      >
        <div className="sticky top-0 bg-white border-b border-[#03065E]/10 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg text-[#03065E]">
              <span className="font-mono">{state.ticker}</span>
              {state.data?.events[0]?.market?.companyName && (
                <span className="ml-2 text-base text-[#03065E]/70 font-normal">
                  {state.data.events[0].market.companyName}
                </span>
              )}
            </h2>
            <p className="text-xs text-[#03065E]/60 mt-0.5">
              {state.data?.count ?? 0} análisis registrado(s) · cliqueá un evento para ver chart, Sankey y findings
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/?ticker=${encodeURIComponent(state.ticker)}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm px-3 py-1.5 bg-[#03065E] text-white rounded hover:opacity-90"
            >
              Abrir análisis
            </a>
            <button
              onClick={onClose}
              className="text-sm px-3 py-1.5 border border-[#03065E]/20 rounded hover:bg-[#03065E]/5"
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* Header card: latest verdict + market snapshot */}
        {state.data?.events[0] && <LatestVerdictHeader ev={state.data.events[0]} />}

        <div className="p-6 space-y-4">
          {state.loading && <p className="text-sm text-[#03065E]/60">Cargando…</p>}
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          {state.data && state.data.events.length === 0 && (
            <p className="text-sm text-[#03065E]/60">Sin eventos para este ticker.</p>
          )}
          {state.data?.events.map((ev) => (
            <EventCard key={ev.id} ev={ev} />
          ))}
        </div>
      </aside>
    </div>
  );
}

function LatestVerdictHeader({ ev }: { ev: DrillEvent }) {
  const v = ev.verdict;
  const m = ev.market;
  const pt = ev.priceTargets;
  if (!v && !m.currentPrice && !pt.bull && !pt.bear) return null;
  return (
    <div className="px-6 py-4 bg-[#F8F9FF] border-b border-[#03065E]/10 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
      <div>
        <p className="text-xs uppercase tracking-wide text-[#03065E]/60 mb-1">Última recomendación</p>
        {v?.rating ? (
          <VerdictPill rating={v.rating} conviction={v.conviction} />
        ) : (
          <p className="text-[#03065E]/40">—</p>
        )}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-[#03065E]/60 mb-1">Precio</p>
        <p className="font-medium tabular-nums text-[#03065E]">{fmtMoney(m.currentPrice)}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-[#03065E]/60 mb-1">Market cap</p>
        <p className="font-medium tabular-nums text-[#03065E]">{fmtMoney(m.marketCap)}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-[#03065E]/60 mb-1">Targets bear / bull</p>
        <p className="text-[#03065E] text-xs tabular-nums">
          {pt.bear ?? "—"} <span className="text-[#03065E]/30">·</span> {pt.bull ?? "—"}
        </p>
      </div>
      {v?.rationale && (
        <div className="col-span-2 md:col-span-4 pt-2 border-t border-[#03065E]/10">
          <p className="text-xs uppercase tracking-wide text-[#03065E]/60 mb-1">Rationale</p>
          <p className="text-sm text-[#03065E]/90 leading-snug">{v.rationale}</p>
        </div>
      )}
    </div>
  );
}

function EventCard({ ev }: { ev: DrillEvent }) {
  const [open, setOpen] = useState(false);
  const scoreColor =
    ev.qualityScore === null ? "text-[#03065E]/40" :
    ev.qualityScore >= 90 ? "text-emerald-600" :
    ev.qualityScore >= 70 ? "text-emerald-500" :
    ev.qualityScore >= 50 ? "text-amber-600" :
    "text-red-600";

  return (
    <div className="border border-[#03065E]/10 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#03065E]/5 text-left"
      >
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-[#03065E]/70">{fmtTs(ev.ts)}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-[#03065E]/10 font-mono">{ev.status}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-[#03065E]/5 font-mono">{ev.sankeySource ?? "—"}</span>
          {ev.errorStage && <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-700 font-mono">{ev.errorStage}</span>}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className={`tabular-nums font-semibold ${scoreColor}`}>
            {ev.qualityScore !== null ? `score ${ev.qualityScore}` : "—"}
          </span>
          <span className="text-[#03065E]/40">{open ? "▾" : "▸"}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 py-3 border-t border-[#03065E]/10 space-y-3 bg-[#F8F9FF]/50">
          {/* Findings — cada uno es un prompt copiable para Claude Code */}
          {ev.findings && ev.findings.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-[#03065E]/60">Hallazgos (prompts copiables)</p>
              {ev.findings.map((f, i) => (
                <FindingPrompt key={i} f={f} variant="card" />
              ))}
            </div>
          )}
          {ev.errorMsg && (
            <div className="border border-red-200 bg-red-50 text-red-700 rounded p-3">
              <p className="text-xs font-mono uppercase mb-1">Error</p>
              <p className="text-sm break-words">{ev.errorMsg}</p>
            </div>
          )}
          {(!ev.findings || ev.findings.length === 0) && !ev.errorMsg && (
            <p className="text-sm text-emerald-700">Sin hallazgos — Sankey reconcilia perfecto.</p>
          )}

          {/* Snapshot */}
          {ev.snapshot && <SnapshotView snap={ev.snapshot} />}
        </div>
      )}
    </div>
  );
}

function SnapshotView({ snap }: { snap: EventSnapshot }) {
  const final = snap.finalSankey ?? null;
  const u = final?.unit ?? "";
  const yq = snap.yahooQuarter;
  const e8 = snap.edgar8kRaw;
  const xbrl = snap.xbrlSegmentsRaw;

  return (
    <div className="space-y-4">
      {/* Provenance — what to fetch + which path the code took */}
      <div className="border border-[#03065E]/10 rounded p-3 bg-white space-y-1.5 text-sm">
        <p className="text-xs uppercase tracking-wide text-[#03065E]/60">Provenance</p>
        {snap.overridePath && (
          <p>
            <span className="text-xs text-[#03065E]/60">Code path:</span>{" "}
            <span className="font-mono text-[#03065E]">{snap.overridePath}</span>
          </p>
        )}
        {(e8?.cik || e8?.accession) && (
          <p>
            <span className="text-xs text-[#03065E]/60">CIK / accession:</span>{" "}
            <span className="font-mono">{e8.cik ?? "—"}</span>
            {" / "}
            <span className="font-mono">{e8.accession ?? "—"}</span>
          </p>
        )}
        {snap.filingIndexUrl && (
          <p>
            <span className="text-xs text-[#03065E]/60">Source URL:</span>{" "}
            <a
              href={snap.filingIndexUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[#03065E] underline break-all"
            >
              {snap.filingIndexUrl}
            </a>
          </p>
        )}
      </div>

      {/* Final Sankey — render the actual chart so we see what the user saw */}
      {final && <SankeyPreview data={final} />}

      {/* Raw 8-K parser output — what the parser captured field-by-field */}
      {e8 && (
        <Edgar8KRawView e8={e8} u={u} />
      )}

      {/* XBRL segments output (when 8-K overrode it). Helps identify whether
          the issue is in the 8-K parser or in the XBRL segment extractor. */}
      {xbrl && snap.overridePath === "8k_override" && (
        <SankeyTable title="XBRL segments (descartado por override 8-K)" data={xbrl} />
      )}

      {/* Yahoo cross-check */}
      {yq && Object.values(yq).some((v) => v !== null && v !== undefined) && (
        <YahooQuarterView yq={yq} currency={snap.yahooCurrency} unit={u} />
      )}
    </div>
  );
}

function SankeyPreview({ data }: { data: SlimSankey }) {
  const [showRaw, setShowRaw] = useState(false);
  // Cast the slim snapshot to SegmentSankeyData — fields we don't store
  // (industry-specific blocks, etc.) just come back undefined which the
  // chart already handles. This is the same data the user actually saw.
  const chartData = data as unknown as SegmentSankeyData;
  return (
    <div className="border border-[#03065E]/10 rounded p-3 bg-white space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-[#03065E]/60">
          Sankey final — lo que se renderizó al usuario
        </p>
        <button
          onClick={() => setShowRaw((v) => !v)}
          className="text-xs px-2 py-0.5 border border-[#03065E]/20 rounded hover:bg-[#03065E]/5"
        >
          {showRaw ? "Ver chart" : "Ver tabla"}
        </button>
      </div>
      <p className="text-xs text-[#03065E]/60 font-mono">
        {data.period ?? "—"} · {data.source ?? "—"} · {data.currency ?? "—"} · unit {data.unit || "—"}
        {data.industryProfile ? ` · ${data.industryProfile}` : ""}
      </p>
      {showRaw ? (
        <SankeyTable title="" data={data} />
      ) : (
        // SankeyChart usa viewBox + className="w-full" así que escala al ancho
        // del contenedor — sin scroll horizontal. Si el drawer es angosto los
        // labels quedan más chicos pero el chart sigue siendo legible.
        <div className="bg-[#F8F9FF] rounded">
          <SankeyChart data={chartData} />
        </div>
      )}
    </div>
  );
}

function SankeyTable({ title, data }: { title: string; data: SlimSankey }) {
  const u = data.unit ?? "";
  const f = (v: number | undefined | null) => v === undefined || v === null ? "—" : `${v.toFixed(2)}${u}`;
  const segs = data.segments ?? [];
  const segSum = segs.reduce((s, x) => s + (x.value > 0 ? x.value : 0), 0);
  const opex = data.opexBreakdown ?? {};
  const opexEntries = Object.entries(opex).filter(([, v]) => typeof v === "number" && v && v > 0) as [string, number][];
  const opexSum = opexEntries.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="border border-[#03065E]/10 rounded p-3 bg-white space-y-2">
      {title && <p className="text-xs uppercase tracking-wide text-[#03065E]/60">{title}</p>}
      <p className="text-xs text-[#03065E]/60 font-mono">
        {data.period ?? "—"} · {data.source ?? "—"} · {data.currency ?? "—"} · unit {u || "—"}
        {data.industryProfile ? ` · ${data.industryProfile}` : ""}
      </p>
      <table className="w-full text-sm">
        <tbody>
          <Row label="Revenue total" value={f(data.totalRevenue)} bold />
          <Row label="Cost of Revenue" value={f(data.costOfRevenue)} />
          <Row label="Gross Profit" value={f(data.grossProfit)} sub={
            data.totalRevenue && data.costOfRevenue !== undefined && data.grossProfit !== undefined
              ? `cogs+gp = ${((data.costOfRevenue ?? 0) + (data.grossProfit ?? 0)).toFixed(2)}${u}` : undefined
          } />
          <Row label="Operating Expenses" value={f(data.operatingExpenses)} />
          <Row label="Operating Profit" value={f(data.operatingProfit)} />
          <Row label="Tax" value={f(data.tax)} />
          <Row label="Non-Operating Income" value={f(data.nonOperatingIncome)} />
          <Row label="Net Profit" value={f(data.netProfit)} bold />
        </tbody>
      </table>
      {segs.length > 0 && (
        <div>
          <p className="text-xs text-[#03065E]/60 mb-1">
            Segmentos ({segs.length}) — suman {segSum.toFixed(2)}{u}
            {data.totalRevenue ? ` · ${((segSum / data.totalRevenue) * 100).toFixed(1)}% del revenue` : ""}
          </p>
          <table className="w-full text-sm">
            <tbody>
              {segs.map((s, i) => (
                <tr key={i} className="border-b border-[#03065E]/5 last:border-0">
                  <td className="py-1 pr-2">{s.name}</td>
                  <td className="py-1 text-right tabular-nums">{s.value.toFixed(2)}{u}</td>
                  <td className="py-1 text-right tabular-nums text-[#03065E]/60 w-16">
                    {data.totalRevenue ? `${((s.value / data.totalRevenue) * 100).toFixed(1)}%` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {opexEntries.length > 0 && (
        <div>
          <p className="text-xs text-[#03065E]/60 mb-1">
            OpEx breakdown — suman {opexSum.toFixed(2)}{u}
            {data.operatingExpenses ? ` · ${((opexSum / data.operatingExpenses) * 100).toFixed(1)}% del total` : ""}
          </p>
          <table className="w-full text-sm">
            <tbody>
              {opexEntries.map(([k, v]) => (
                <tr key={k} className="border-b border-[#03065E]/5 last:border-0">
                  <td className="py-1 font-mono">{k}</td>
                  <td className="py-1 text-right tabular-nums">{v.toFixed(2)}{u}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Edgar8KRawView({ e8, u }: { e8: Edgar8KRaw; u: string }) {
  const f = (v: number | null | undefined) => v === undefined || v === null ? "—" : (v / (u === "T" ? 1e12 : u === "B" ? 1e9 : u === "M" ? 1e6 : 1)).toFixed(2) + (u || "");
  // Order roughly matches the IS waterfall so it reads top-to-bottom.
  const lines: { k: keyof Edgar8KRaw; label: string }[] = [
    { k: "totalRevenue", label: "totalRevenue" },
    { k: "costOfRevenue", label: "costOfRevenue" },
    { k: "grossProfit", label: "grossProfit" },
    { k: "researchDevelopment", label: "researchDevelopment" },
    { k: "sellingGeneralAdministrative", label: "sellingGeneralAdministrative" },
    { k: "totalOperatingExpenses", label: "totalOperatingExpenses" },
    { k: "operatingIncome", label: "operatingIncome" },
    { k: "interestExpense", label: "interestExpense" },
    { k: "incomeBeforeTax", label: "incomeBeforeTax" },
    { k: "incomeTaxExpense", label: "incomeTaxExpense" },
    { k: "netIncome", label: "netIncome" },
    { k: "aircraftFuel", label: "aircraftFuel" },
    { k: "salariesWages", label: "salariesWages" },
    { k: "aircraftMaintenance", label: "aircraftMaintenance" },
    { k: "aircraftRent", label: "aircraftRent" },
    { k: "landingFees", label: "landingFees" },
    { k: "depreciationAmortization", label: "depreciationAmortization" },
  ];
  return (
    <div className="border border-[#03065E]/10 rounded p-3 bg-white space-y-2">
      <p className="text-xs uppercase tracking-wide text-[#03065E]/60">Edgar 8-K — output crudo del parser</p>
      <p className="text-xs text-[#03065E]/60 font-mono">
        form {e8.form ?? "—"} · endDate {e8.endDate ?? "—"} · currency {e8.currency ?? "—"}
        {e8.isAnnual ? " · annual" : ""}{e8.isSemiAnnual ? " · semiannual" : ""}
        {e8.fiscalYearEndMonth ? ` · FYE month ${e8.fiscalYearEndMonth}` : ""}
      </p>
      <table className="w-full text-xs">
        <tbody>
          {lines.map(({ k, label }) => {
            const v = e8[k] as number | null | undefined;
            const isNull = v === null;
            const isMissing = v === undefined;
            return (
              <tr key={k} className="border-b border-[#03065E]/5 last:border-0">
                <td className={`py-1 font-mono ${isNull ? "text-amber-600" : isMissing ? "text-[#03065E]/30" : ""}`}>{label}</td>
                <td className={`py-1 text-right tabular-nums ${isNull ? "text-amber-600" : ""}`}>
                  {isNull ? "null (parser left blank)" : isMissing ? "" : f(v)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function YahooQuarterView({ yq, currency, unit }: { yq: YahooQuarter; currency: string | null | undefined; unit: string }) {
  const f = (v: number | null | undefined) => v === null || v === undefined ? "—" : (v / (unit === "T" ? 1e12 : unit === "B" ? 1e9 : unit === "M" ? 1e6 : 1)).toFixed(2) + (unit || "");
  const lines: { k: keyof YahooQuarter; label: string }[] = [
    { k: "totalRevenue", label: "totalRevenue" },
    { k: "costOfRevenue", label: "costOfRevenue" },
    { k: "grossProfit", label: "grossProfit" },
    { k: "totalOperatingExpenses", label: "totalOperatingExpenses" },
    { k: "researchDevelopment", label: "researchDevelopment" },
    { k: "sellingGeneralAdministrative", label: "sellingGeneralAdministrative" },
    { k: "operatingIncome", label: "operatingIncome" },
    { k: "netIncome", label: "netIncome" },
  ];
  return (
    <div className="border border-[#03065E]/10 rounded p-3 bg-white space-y-2">
      <p className="text-xs uppercase tracking-wide text-[#03065E]/60">Yahoo último trimestre — para cross-check</p>
      <p className="text-xs text-[#03065E]/60 font-mono">
        endDate {yq.endDate ?? "—"} · currency {currency ?? "—"}
      </p>
      <table className="w-full text-xs">
        <tbody>
          {lines.map(({ k, label }) => {
            const v = yq[k] as number | null | undefined;
            return (
              <tr key={k} className="border-b border-[#03065E]/5 last:border-0">
                <td className="py-1 font-mono">{label}</td>
                <td className="py-1 text-right tabular-nums">{f(v)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Row({ label, value, sub, bold }: { label: string; value: string; sub?: string; bold?: boolean }) {
  return (
    <tr className="border-b border-[#03065E]/5 last:border-0">
      <td className={`py-1.5 ${bold ? "font-semibold" : ""}`}>{label}</td>
      <td className={`py-1.5 text-right tabular-nums ${bold ? "font-semibold" : ""}`}>{value}</td>
      <td className="py-1.5 text-right tabular-nums text-[#03065E]/50 text-xs w-40">{sub ?? ""}</td>
    </tr>
  );
}

// Stacked bar chart of analyses-per-day for the last 30 days. Pure SVG so
// it stays in the same single-file dashboard with no extra deps.
function VolumeChart({ data }: { data: DailyVolumeRow[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-[#03065E]/50 py-3">Aún no hay datos.</p>;
  }
  const maxDay = Math.max(...data.map((d) => d.fresh + d.cached + d.errors), 1);
  const totalFresh  = data.reduce((s, d) => s + d.fresh, 0);
  const totalCached = data.reduce((s, d) => s + d.cached, 0);
  const totalErrors = data.reduce((s, d) => s + d.errors, 0);

  const W = 1000;
  const H = 200;
  const pad = { l: 30, r: 8, t: 8, b: 22 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const barW = innerW / Math.max(30, data.length);
  // Days might not be contiguous — pad to 30 for stable spacing.
  // Use the latest bucket as "today" so the render is deterministic (no Date.now).
  const latestBucket = Math.max(...data.map((d) => Math.floor(d.bucketMs / DAY_MS)));
  const barAt = (bucketMs: number) => {
    const dayIdx = Math.floor(bucketMs / DAY_MS);
    return pad.l + (29 - (latestBucket - dayIdx)) * barW;
  };
  const yScale = (v: number) => (v / maxDay) * innerH;
  const bottom = pad.t + innerH;

  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-xs">
        <span><span className="inline-block w-2.5 h-2.5 bg-emerald-600 rounded-sm mr-1.5" />Fresh: {totalFresh}</span>
        <span><span className="inline-block w-2.5 h-2.5 bg-[#03065E] rounded-sm mr-1.5" />Cache: {totalCached}</span>
        <span><span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-sm mr-1.5" />Errores: {totalErrors}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Y-axis hint */}
        <text x={pad.l - 6} y={pad.t + 4} fontSize="9" textAnchor="end" fill="#03065E60">{maxDay}</text>
        <text x={pad.l - 6} y={bottom} fontSize="9" textAnchor="end" fill="#03065E60">0</text>
        <line x1={pad.l} y1={bottom} x2={W - pad.r} y2={bottom} stroke="#03065E20" />
        {data.map((d, i) => {
          const x = barAt(d.bucketMs);
          if (x < pad.l - 1 || x > W - pad.r) return null;
          const fH = yScale(d.fresh);
          const cH = yScale(d.cached);
          const eH = yScale(d.errors);
          const w = Math.max(1, barW - 2);
          let y = bottom;
          return (
            <g key={i}>
              {d.fresh > 0  && (() => { y -= fH; return <rect x={x} y={y} width={w} height={fH} fill="#059669" />; })()}
              {d.cached > 0 && (() => { y -= cH; return <rect x={x} y={y} width={w} height={cH} fill="#03065E" />; })()}
              {d.errors > 0 && (() => { y -= eH; return <rect x={x} y={y} width={w} height={eH} fill="#ef4444" />; })()}
            </g>
          );
        })}
        {/* X-axis: every ~5 days a date tick */}
        {Array.from({ length: 6 }, (_, i) => {
          const dayIdx = latestBucket - 29 + i * 6;
          if (dayIdx > latestBucket) return null;
          const x = pad.l + i * 6 * barW + barW / 2;
          const date = new Date(dayIdx * DAY_MS);
          const label = `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
          return (
            <text key={i} x={x} y={H - 6} fontSize="9" textAnchor="middle" fill="#03065E80" fontFamily="monospace">{label}</text>
          );
        })}
      </svg>
    </div>
  );
}

const VERDICT_STYLE: Record<string, string> = {
  BUY:   "bg-emerald-100 text-emerald-800 border-emerald-300",
  HOLD:  "bg-amber-100 text-amber-800 border-amber-300",
  AVOID: "bg-red-100 text-red-800 border-red-300",
};

function VerdictPill({ rating, conviction, size = "md" }: { rating: string | null; conviction: string | null; size?: "sm" | "md" }) {
  if (!rating) {
    return <span className={`text-xs text-[#03065E]/40 ${size === "sm" ? "" : "px-2 py-0.5"}`}>—</span>;
  }
  const cls = VERDICT_STYLE[rating] ?? "bg-[#03065E]/5 text-[#03065E] border-[#03065E]/20";
  const sizeCls = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center gap-1 border rounded font-mono font-semibold ${sizeCls} ${cls}`}>
      <span>{rating}</span>
      {conviction && <span className="opacity-70 font-normal">{conviction}</span>}
    </span>
  );
}

function fmtMoney(v: number | null | undefined, currency = "$"): string {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  if (v >= 1e12) return `${currency}${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `${currency}${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6)  return `${currency}${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3)  return `${currency}${(v / 1e3).toFixed(2)}K`;
  return `${currency}${v.toFixed(2)}`;
}

function RecentAnalysesGrid({ rows, onClick }: { rows: RecentAnalysis[]; onClick: (ticker: string) => void }) {
  if (rows.length === 0) return <p className="text-sm text-[#03065E]/50 py-3">Aún no hay análisis recientes.</p>;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
      {rows.map((r) => (
        <button
          key={r.ticker}
          onClick={() => onClick(r.ticker)}
          className="text-left p-3 border border-[#03065E]/10 rounded-lg hover:border-[#03065E]/30 hover:bg-[#03065E]/[0.02] transition"
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-mono font-semibold text-[#03065E]">{r.ticker}</span>
            <VerdictPill rating={r.verdict_rating} conviction={r.verdict_conviction} size="sm" />
          </div>
          <p className="text-xs text-[#03065E]/70 truncate" title={r.company_name ?? r.ticker}>
            {r.company_name ?? r.ticker}
          </p>
          <div className="flex items-baseline justify-between mt-1.5 text-xs">
            <span className="tabular-nums font-medium text-[#03065E]">{fmtMoney(r.current_price)}</span>
            <span className="text-[#03065E]/50">{relativeTime(r.ts)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function PopularAnalysesTable({ rows, onClick }: { rows: PopularAnalysis[]; onClick: (ticker: string) => void }) {
  if (rows.length === 0) return <p className="text-sm text-[#03065E]/50 py-3">Aún no hay análisis.</p>;
  const maxSearches = Math.max(...rows.map((r) => r.searches), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-[#03065E]/60 border-b border-[#03065E]/10">
            <th className="text-left py-2 w-8">#</th>
            <th className="text-left py-2">Ticker / Empresa</th>
            <th className="text-left py-2">Verdict</th>
            <th className="text-right py-2">Precio</th>
            <th className="text-right py-2">Market cap</th>
            <th className="text-right py-2">Targets (bear / bull)</th>
            <th className="text-right py-2">Búsquedas</th>
            <th className="text-right py-2">Última</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const w = (r.searches / maxSearches) * 100;
            return (
              <tr
                key={r.ticker}
                onClick={() => onClick(r.ticker)}
                className="border-b border-[#03065E]/5 last:border-0 cursor-pointer hover:bg-[#03065E]/5"
              >
                <td className="py-2 text-[#03065E]/50 tabular-nums">{i + 1}</td>
                <td className="py-2">
                  <div className="font-mono font-semibold text-[#03065E]">{r.ticker}</div>
                  {r.company_name && <div className="text-xs text-[#03065E]/60 truncate max-w-[18rem]" title={r.company_name}>{r.company_name}</div>}
                </td>
                <td className="py-2"><VerdictPill rating={r.verdict_rating} conviction={r.verdict_conviction} /></td>
                <td className="py-2 text-right tabular-nums">{fmtMoney(r.current_price)}</td>
                <td className="py-2 text-right tabular-nums text-[#03065E]/70">{fmtMoney(r.market_cap)}</td>
                <td className="py-2 text-right text-xs text-[#03065E]/70 whitespace-nowrap">
                  {r.bear_target ?? "—"} <span className="text-[#03065E]/30">/</span> {r.bull_target ?? "—"}
                </td>
                <td className="py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="hidden md:block w-20 h-1 rounded-full bg-[#03065E]/5 overflow-hidden">
                      <span className="block h-full bg-[#03065E]/40" style={{ width: `${w}%` }} />
                    </span>
                    <span className="tabular-nums font-medium">{r.searches.toLocaleString()}</span>
                  </div>
                </td>
                <td className="py-2 text-right text-xs text-[#03065E]/60 whitespace-nowrap">{relativeTime(r.last_ts)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TopTickersCard({
  title,
  sub,
  rows,
  onClick,
  showFirstSeen,
}: {
  title: string;
  sub: string;
  rows: TopTickerRow[];
  onClick: (ticker: string) => void;
  showFirstSeen?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <Card title={title} sub={sub}>
        <p className="text-sm text-[#03065E]/50 py-3">Sin búsquedas en este rango.</p>
      </Card>
    );
  }
  const max = Math.max(...rows.map((r) => r.searches));
  return (
    <Card title={title} sub={sub}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-[#03065E]/60 border-b border-[#03065E]/10">
            <th className="text-left py-2 w-8">#</th>
            <th className="text-left py-2">Ticker</th>
            <th className="text-right py-2">Búsquedas</th>
            <th className="text-right py-2">Únicos</th>
            <th className="text-right py-2">Última</th>
            {showFirstSeen && <th className="text-right py-2">Primera</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const w = max > 0 ? (r.searches / max) * 100 : 0;
            return (
              <tr
                key={r.ticker}
                onClick={() => onClick(r.ticker)}
                className="border-b border-[#03065E]/5 last:border-0 cursor-pointer hover:bg-[#03065E]/5"
              >
                <td className="py-2 text-[#03065E]/50 tabular-nums">{i + 1}</td>
                <td className="py-2 font-mono">
                  <div className="flex items-center gap-2">
                    <span>{r.ticker}</span>
                    <span className="hidden md:block flex-1 h-1 rounded-full bg-[#03065E]/5 overflow-hidden">
                      <span className="block h-full bg-[#03065E]/40" style={{ width: `${w}%` }} />
                    </span>
                  </div>
                </td>
                <td className="py-2 text-right tabular-nums font-medium">{r.searches.toLocaleString()}</td>
                <td className="py-2 text-right tabular-nums text-[#03065E]/70">{r.uniques.toLocaleString()}</td>
                <td className="py-2 text-right text-xs text-[#03065E]/60 whitespace-nowrap">{relativeTime(r.last_ts)}</td>
                {showFirstSeen && r.first_ts !== undefined && (
                  <td className="py-2 text-right text-xs text-[#03065E]/60 whitespace-nowrap">{relativeTime(r.first_ts)}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  return `${mo}mo`;
}

function FindingPrompt({ f, variant = "list" }: { f: EventFinding; variant?: "list" | "card" }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(f.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };
  const sevColor =
    f.severity === "error" ? "border-red-200 bg-red-50 text-red-900" :
    f.severity === "warn"  ? "border-amber-200 bg-amber-50 text-amber-900" :
    "border-[#03065E]/15 bg-[#03065E]/5 text-[#03065E]";

  if (variant === "card") {
    return (
      <div className={`border rounded p-3 ${sevColor}`}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <span className="text-xs font-mono uppercase">{f.code}</span>
          <button
            onClick={onCopy}
            className="text-xs px-2 py-0.5 border border-current/30 rounded hover:bg-white/40 shrink-0"
            title="Copiar prompt al clipboard"
          >
            {copied ? "✓ copiado" : "copiar prompt"}
          </button>
        </div>
        <p className="text-sm leading-snug whitespace-pre-wrap">{f.message}</p>
      </div>
    );
  }

  // Inline list variant — used by LowQualityEventCard. More compact.
  const dot =
    f.severity === "error" ? "bg-red-500" :
    f.severity === "warn"  ? "bg-amber-500" :
    "bg-[#03065E]/30";
  return (
    <li className={`group border rounded p-2.5 leading-snug ${sevColor}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-2.5 flex-1 min-w-0">
          <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${dot}`} />
          <div className="min-w-0">
            <span className="text-xs font-mono uppercase mr-2 opacity-70">{f.code}</span>
            <span className="text-sm">{f.message}</span>
          </div>
        </div>
        <button
          onClick={onCopy}
          className="text-xs px-2 py-0.5 border border-current/30 rounded hover:bg-white/40 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="Copiar prompt al clipboard"
        >
          {copied ? "✓" : "copiar"}
        </button>
      </div>
    </li>
  );
}

function LowQualityEventCard({ ev, onInspect }: { ev: LowQualityEvent; onInspect: () => void }) {
  const findings = ev.findings ?? [];
  const scoreColor =
    ev.qualityScore >= 70 ? "text-emerald-600 bg-emerald-50" :
    ev.qualityScore >= 50 ? "text-amber-700 bg-amber-50" :
    ev.qualityScore >= 30 ? "text-orange-700 bg-orange-50" :
    "text-red-700 bg-red-50";
  return (
    <div className="border border-[#03065E]/10 rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={onInspect}
            className="font-mono text-base text-[#03065E] hover:underline"
            title="Ver historial y snapshot completo"
          >
            {ev.ticker}
          </button>
          <span className={`text-xs font-mono px-2 py-0.5 rounded tabular-nums font-semibold ${scoreColor}`}>
            score {ev.qualityScore}
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#03065E]/5 text-[#03065E]/80">
            {ev.sankeySource ?? "—"}
          </span>
          <span className="text-xs text-[#03065E]/60">{fmtTs(ev.ts)}</span>
        </div>
      </div>

      {findings.length === 0 ? (
        <p className="text-xs text-[#03065E]/60 italic">Sin findings registrados (datos pre-migración).</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {findings.map((f, i) => (
            <FindingPrompt key={i} f={f} />
          ))}
        </ul>
      )}
    </div>
  );
}

function qualitySub(s: QualitySummary | null): string {
  if (!s || s.n === 0) return "Sin datos";
  return `${s.n.toLocaleString()} requests evaluadas`;
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "ok" | "warn" }) {
  const accentClass = accent === "warn" ? "text-red-600" : "text-[#03065E]";
  return (
    <div className="bg-white border border-[#03065E]/10 rounded-lg px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-[#03065E]/60">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${accentClass}`}>{value}</p>
      {sub && <p className="text-xs text-[#03065E]/50 mt-0.5">{sub}</p>}
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#03065E]/10 rounded-lg p-5">
      <div className="mb-3">
        <h2 className="font-semibold">{title}</h2>
        {sub && <p className="text-xs text-[#03065E]/60 mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function StatusCard({ title, rows, total }: { title: string; rows: StatusRow[]; total: number }) {
  return (
    <Card title={title} sub={`${total.toLocaleString()} requests`}>
      <table className="w-full text-sm">
        <tbody>
          {["ok", "cache_hit", "error", "rate_limited", "bad_request", "not_found"].map((s) => {
            const n = statusCount(rows, s);
            return (
              <tr key={s} className="border-b border-[#03065E]/5 last:border-0">
                <td className="py-1.5">{STATUS_LABEL[s] ?? s}</td>
                <td className="py-1.5 text-right tabular-nums">{n.toLocaleString()}</td>
                <td className="py-1.5 text-right tabular-nums text-[#03065E]/60 w-14">{pct(n, total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function UpstreamRow({ label, ok, fail }: { label: string; ok: number; fail: number }) {
  const total = ok + fail;
  const successRate = total ? (ok / total) * 100 : 0;
  const warn = total > 0 && successRate < 95;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <p className="text-sm">{label}</p>
        <p className={`text-sm tabular-nums font-medium ${warn ? "text-red-600" : ""}`}>
          {total ? `${successRate.toFixed(1)}%` : "—"}
        </p>
      </div>
      <p className="text-xs text-[#03065E]/60 tabular-nums">{ok.toLocaleString()} ok · {fail.toLocaleString()} fail</p>
      <div className="h-1.5 mt-1.5 rounded-full bg-[#03065E]/5 overflow-hidden">
        <div
          className={warn ? "h-full bg-red-500" : "h-full bg-emerald-600"}
          style={{ width: `${successRate}%` }}
        />
      </div>
    </div>
  );
}
