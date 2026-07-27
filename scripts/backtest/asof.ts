// Reconstructor point-in-time para el backtest full-LLM.
//
// Arma un StockData SINTÉTICO con lo que un inversor podía saber al CORTE:
//   - precio, rango 52w, serie técnica: velas diarias ajustadas ≤ corte
//   - balance/flujos (deuda, caja, EBITDA, FCF, EPS, revenue, shares):
//     fundamentalsTimeSeries de Yahoo, última fila ≤ corte. Yahoo sólo publica
//     ~6 trimestres de historia trimestral, así que en cortes viejos la base
//     cae a granularidad ANUAL (la última FY cerrada ≤ corte) — registrado en
//     `granularity` por honestidad. Restatements de Yahoo = leak menor asumido.
//   - CAPE: precio ≤ corte / promedio de EPS anuales ≤ corte
// Lo IRRECUPERABLE queda vacío/null y el pipeline lo trata como na por diseño:
// consenso, estimaciones forward, short interest, insiders, news, guidance,
// earnings history. computeDerivedMetrics/buildPrompt no se tocan — el mismo
// código de producción lee este snapshot.
//
// Todo Yahoo-only (cero SEC): el perfil de industria viene hardcodeado del
// golden set y sólo alimenta el hint del prompt + la exención de leverage.
//
// FX y ADRs (fix 2026-07-19, detectado por probe: MUFG P/B 0.01, HDB P/B 0.03,
// ITUB P/E 1.53 — basura): fundamentalsTimeSeries devuelve los estados en la
// MONEDA DEL EMISOR (JPY/INR/BRL/CAD/...) y en ACCIONES LOCALES, mientras la
// serie de precios es el ADR en USD (ratio ADR:local ≠ 1 en TSM/TM/BABA/PBR...).
// Solución:
//   - Toda cifra monetaria se convierte a USD con el FX del día del corte
//     (fetchUsdRate con serie histórica ECB; TWD degrada a rate estático);
//     el cash-flow anual usa el FX del cierre de CADA período.
//   - marketCap as-of = (marketCap ACTUAL de Yahoo ÷ precio crudo ACTUAL) ×
//     precio crudo al corte — "acciones ADR-equivalentes de hoy", que esquiva
//     moneda y ratio ADR a la vez. Aproximación declarada: asume float estable
//     entre corte y hoy (drift por buybacks ~2-4%/año, vs el error 30-100× que
//     corrige). Se usa el cierre CRUDO (no ajustado) para no arrastrar los
//     dividendos del medio.
//   - EPS/CAPE por acción sólo cuando acciones-ADR-equivalentes ≈ acciones
//     locales (ratio 1:1 ±15%); si no, P/E se computa agregado (mcap/NI) y
//     EPS/CAPE quedan N/D honestos (mejor que un per-share con ratio roto).
// Los ratios puros (márgenes, growth, ROE) se computan en moneda local — el FX
// se cancela y quedan exactos.

import { yahooFinance, fetchPeerComparison } from "@/lib/fetchStockData";
import { fetchUsdRate } from "@/lib/fxRates";
import { computeTechnicalContext, type TechnicalContext } from "@/lib/technicalContext";
import type { ChartPoint } from "@/lib/fetchChartRange";
import type { StockData, CashFlowYear, PeerMultiple, PeerComparison } from "@/types/StockData";
import type { SegmentSankeyData, IndustryProfile } from "@/types/Report";

type Row = Record<string, unknown> & { date?: Date | string };

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function rowDate(r: Row): string {
  const d = r.date;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d ?? "").slice(0, 10);
}

export interface TickerMeta {
  companyName: string;
  sector: string | null;
  industry: string | null;
  description: string | null;
  currency: string | null;
  // Moneda en la que el emisor reporta sus estados (Yahoo financialData) —
  // JPY para MUFG, INR para HDB, etc. Es la moneda de fundamentalsTimeSeries.
  financialCurrency: string | null;
  // Market cap ACTUAL (USD, ratio-ADR-aware, de Yahoo). Ancla del cálculo de
  // acciones ADR-equivalentes para el mcap as-of.
  marketCapToday: number | null;
}

export async function fetchMeta(ticker: string): Promise<TickerMeta> {
  const q = (await yahooFinance.quoteSummary(
    ticker,
    { modules: ["assetProfile", "price", "financialData"] },
    { validateResult: false },
  )) as Record<string, Record<string, unknown>>;
  return {
    companyName: (q.price?.longName as string) ?? (q.price?.shortName as string) ?? ticker,
    sector: (q.assetProfile?.sector as string) ?? null,
    industry: (q.assetProfile?.industry as string) ?? null,
    description: (q.assetProfile?.longBusinessSummary as string) ?? null,
    currency: (q.price?.currency as string) ?? "USD",
    financialCurrency: (q.financialData?.financialCurrency as string) ?? null,
    marketCapToday: num(q.price?.marketCap),
  };
}

// Punto diario: `value` = cierre AJUSTADO (retornos/técnica), `raw` = cierre
// crudo (escala del market cap as-of — el ajustado arrastraría los dividendos
// pagados entre el corte y hoy).
export interface AsOfPoint extends ChartPoint {
  raw?: number;
}

export interface DividendEvent {
  date: string;  // YYYY-MM-DD
  amount: number; // por acción del listing US (ADR)
}

// Velas diarias AJUSTADAS desde 2019 hasta hoy + eventos de dividendos — una
// sola llamada por ticker; los cortes se resuelven por slice local.
export async function fetchDailySeriesWithDivs(
  ticker: string,
): Promise<{ series: AsOfPoint[]; dividends: DividendEvent[] }> {
  const result = (await yahooFinance.chart(
    ticker,
    { period1: new Date("2019-01-01"), interval: "1d", return: "array", events: "div" },
    { validateResult: false },
  )) as {
    quotes?: Array<{ date: Date; close: number | null; adjclose?: number | null }>;
    events?: { dividends?: Array<{ date: Date | number; amount?: number }> };
  };
  const out: AsOfPoint[] = [];
  for (const q of result?.quotes ?? []) {
    const v = q.adjclose ?? q.close;
    if (v == null || !Number.isFinite(v) || v <= 0) continue;
    const raw = q.close != null && Number.isFinite(q.close) && q.close > 0 ? q.close : undefined;
    out.push({ time: q.date.toISOString().slice(0, 10), value: v, raw });
  }
  out.sort((a, b) => String(a.time).localeCompare(String(b.time)));

  const dividends: DividendEvent[] = [];
  for (const d of result?.events?.dividends ?? []) {
    const iso = d.date instanceof Date
      ? d.date.toISOString().slice(0, 10)
      : Number.isFinite(Number(d.date))
        ? new Date(Number(d.date) * (Number(d.date) < 1e12 ? 1000 : 1)).toISOString().slice(0, 10)
        : null;
    if (iso && typeof d.amount === "number" && Number.isFinite(d.amount) && d.amount > 0) {
      dividends.push({ date: iso, amount: d.amount });
    }
  }
  dividends.sort((a, b) => a.date.localeCompare(b.date));
  return { series: out, dividends };
}

export async function fetchDailySeries(ticker: string): Promise<AsOfPoint[]> {
  return (await fetchDailySeriesWithDivs(ticker)).series;
}

// Beta as-of: regresión de retornos diarios del último año contra SPY,
// alineada por fecha. Exacta — sale de las series que ya tenemos.
export function betaAsOf(series: AsOfPoint[], spy: AsOfPoint[], cutoff: string): number | null {
  const mapOf = (pts: AsOfPoint[]) => {
    const m = new Map<string, number>();
    for (const p of pts) if (String(p.time) <= cutoff) m.set(String(p.time), p.value);
    return m;
  };
  const a = mapOf(series);
  const b = mapOf(spy);
  const dates = [...a.keys()].filter((d) => b.has(d)).sort().slice(-253);
  if (dates.length < 120) return null;
  const ra: number[] = [], rb: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const pa = a.get(dates[i - 1])!, ca = a.get(dates[i])!;
    const pb = b.get(dates[i - 1])!, cb = b.get(dates[i])!;
    if (pa <= 0 || pb <= 0) continue;
    ra.push(ca / pa - 1);
    rb.push(cb / pb - 1);
  }
  if (ra.length < 100) return null;
  const mean = (v: number[]) => v.reduce((x, y) => x + y, 0) / v.length;
  const ma = mean(ra), mb = mean(rb);
  let cov = 0, varB = 0;
  for (let i = 0; i < ra.length; i++) {
    cov += (ra[i] - ma) * (rb[i] - mb);
    varB += (rb[i] - mb) * (rb[i] - mb);
  }
  return varB > 0 ? cov / varB : null;
}

export interface FundamentalHistory {
  annual: Row[];
  quarterly: Row[];
}

export async function fetchFundamentalHistory(ticker: string): Promise<FundamentalHistory> {
  const [annual, quarterly] = await Promise.all([
    yahooFinance
      .fundamentalsTimeSeries(
        ticker,
        { period1: new Date(Date.now() - 10 * 365 * 86400000), type: "annual", module: "all" },
        { validateResult: false },
      )
      .catch(() => []) as Promise<Row[]>,
    yahooFinance
      .fundamentalsTimeSeries(
        ticker,
        { period1: new Date(Date.now() - 3 * 365 * 86400000), type: "quarterly", module: "all" },
        { validateResult: false },
      )
      .catch(() => []) as Promise<Row[]>,
  ]);
  const sortByDate = (rows: Row[]) =>
    (rows ?? []).filter((r) => r && r.date != null).sort((a, b) => rowDate(a).localeCompare(rowDate(b)));
  return { annual: sortByDate(annual), quarterly: sortByDate(quarterly) };
}

// Último cierre ≤ fecha (la serie está ordenada asc).
export function closeOn(series: ChartPoint[], date: string): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    if (String(series[i].time) <= date) return series[i].value;
  }
  return null;
}

// Retorno total (serie ajustada) entre dos fechas calendario.
export function returnBetween(series: ChartPoint[], from: string, to: string): number | null {
  const a = closeOn(series, from);
  const b = closeOn(series, to);
  return a != null && b != null && a > 0 ? b / a - 1 : null;
}

function lastRowOn(rows: Row[], cutoff: string): Row | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rowDate(rows[i]) <= cutoff) return rows[i];
  }
  return null;
}

// Suma de los últimos 4 trimestres ≤ corte para un campo; null si no hay 4.
function ttmSum(quarterly: Row[], cutoff: string, field: string): number | null {
  const vals: number[] = [];
  for (let i = quarterly.length - 1; i >= 0 && vals.length < 4; i--) {
    if (rowDate(quarterly[i]) > cutoff) continue;
    const v = num(quarterly[i][field]);
    if (v == null) return null; // hueco en la ventana TTM → no inventar
    vals.push(v);
  }
  if (vals.length < 4) return null;
  return vals.reduce((a, b) => a + b, 0);
}

export interface AsOfSnapshot {
  stockData: StockData;
  seg: SegmentSankeyData | null;
  technical: TechnicalContext | null;
  priceAtCutoff: number;
  granularity: { flows: "ttm-quarterly" | "fy-annual" | "none"; balanceAsOf: string | null };
  skipped?: string; // razón cuando el snapshot no da para análisis
}

// Fuga de publicación (fix 2026-07-19, detectado por el diff pre-corrida):
// los rows de fundamentalsTimeSeries llevan fecha de CIERRE del período, pero
// un FY cerrado el 31-dic no es público hasta su earnings release (~3-8
// semanas después). Filtrar por cierre ≤ corte dejaba entrar estados AÚN NO
// PUBLICADOS al corte — AAL@2025-01-17 tomaba el FY2024 que la empresa recién
// reportó el 23-ene. Frontera en dos niveles:
//   1. `publishedPeriods` (fechas REALES de release desde EDGAR, cuando el
//      caller las pasa): un row entra si su período tiene un filing de
//      resultados presentado ≤ corte — JPM recupera su Q4 del 15-ene en un
//      corte del 17-ene sin dejar entrar el de AAL del 23-ene.
//   2. Fallback sin match EDGAR: cierre ≤ corte − 45 días (cota del release
//      típico) — sesgo conservador asumido, preferible a la fuga.
// Los SEGMENTOS EDGAR no necesitan nada de esto: su frontera es el filing.
const REPORTING_LAG_DAYS = 45;
// Tolerancia entre el cierre del row de Yahoo y el reportDate del filing
// (drift de semanas fiscales 52/53 y de convenciones de fecha).
const PERIOD_MATCH_TOLERANCE_DAYS = 10;

export interface PublishedPeriod {
  // "periodic": 10-Q/10-K/20-F/40-F — end = cierre del período (reportDate del
  //   filing ES el período): match exacto ±10d.
  // "release": 8-K Item 2.02 — el reportDate es la fecha del EVENTO, no el
  //   cierre; la regla es "cubre períodos cerrados hasta 75 días antes del
  //   filing" (JPM: Q4 cerrado 31-dic queda publicado por el 8-K del 15-ene).
  kind: "periodic" | "release";
  end: string | null; // cierre del período (sólo periodic)
  filed: string;      // filingDate — el día en que se volvió público
}

export async function snapshotAsOf(args: {
  ticker: string;
  cutoff: string; // "YYYY-MM-DD"
  meta: TickerMeta;
  series: AsOfPoint[];
  fundamentals: FundamentalHistory;
  profile: IndustryProfile | null;
  // Fechas reales de publicación (EDGAR) — opcional; sin ellas rige el lag 45d.
  publishedPeriods?: PublishedPeriod[];
  // Dividendos del listing US (chart events) — opcional; habilita yield/payout.
  dividends?: DividendEvent[];
  // Serie de SPY — opcional; habilita beta as-of.
  spySeries?: AsOfPoint[];
}): Promise<AsOfSnapshot | { skipped: string }> {
  const { ticker, cutoff, meta, series, fundamentals, profile, publishedPeriods, dividends, spySeries } = args;

  const sliced = series.filter((p) => String(p.time) <= cutoff);
  if (sliced.length < 120) return { skipped: `serie de precios insuficiente al corte (${sliced.length} ruedas)` };
  const price = sliced[sliced.length - 1].value;

  const yearWindow = sliced.slice(-260);
  const w52High = Math.max(...yearWindow.map((p) => p.value));
  const w52Low = Math.min(...yearWindow.map((p) => p.value));
  const technical = computeTechnicalContext(yearWindow);

  // Frontera de PUBLICACIÓN para todo lo contable (ver arriba). El precio y la
  // técnica usan el corte real: los precios son públicos al instante.
  const fallbackCutoff = new Date(Date.parse(cutoff) - REPORTING_LAG_DAYS * 86400000)
    .toISOString().slice(0, 10);
  const isPublished = (end: string): boolean => {
    if (end <= fallbackCutoff) return true;
    if (end > cutoff) return false;
    const endMs = Date.parse(end);
    const tol = PERIOD_MATCH_TOLERANCE_DAYS * 86400000;
    const releaseWindow = 75 * 86400000; // un release cubre períodos cerrados ≤75d antes
    return (publishedPeriods ?? []).some((p) => {
      if (p.filed > cutoff) return false;
      if (p.kind === "periodic") {
        return p.end != null && Math.abs(Date.parse(p.end) - endMs) <= tol;
      }
      const filedMs = Date.parse(p.filed);
      return endMs <= filedMs && filedMs - endMs <= releaseWindow;
    });
  };

  const annual = fundamentals.annual.filter((r) => isPublished(rowDate(r)));
  const quarterly = fundamentals.quarterly.filter((r) => isPublished(rowDate(r)));
  const qLast = lastRowOn(quarterly, cutoff);
  const aLast = lastRowOn(annual, cutoff);
  const balanceRow = qLast ?? aLast;
  if (!balanceRow) return { skipped: "sin fundamentals publicados ≤ corte (annual ni quarterly)" };

  // Flujos TTM: trimestral cuando la ventana llega, si no la última FY anual.
  const fcfTtm = ttmSum(quarterly, cutoff, "freeCashFlow");
  const ebitdaTtm = ttmSum(quarterly, cutoff, "EBITDA");
  const epsTtm = ttmSum(quarterly, cutoff, "dilutedEPS") ?? ttmSum(quarterly, cutoff, "basicEPS");
  const revTtm = ttmSum(quarterly, cutoff, "totalRevenue");
  const grossTtm = ttmSum(quarterly, cutoff, "grossProfit");
  const opIncTtm = ttmSum(quarterly, cutoff, "operatingIncome");
  const niTtm = ttmSum(quarterly, cutoff, "netIncome");

  const fcf = fcfTtm ?? num(aLast?.freeCashFlow);
  const ebitda = ebitdaTtm ?? num(aLast?.EBITDA) ?? num(aLast?.normalizedEBITDA);
  const eps = epsTtm ?? num(aLast?.dilutedEPS) ?? num(aLast?.basicEPS);
  const revenue = revTtm ?? num(aLast?.totalRevenue);
  const grossProfit = grossTtm ?? num(aLast?.grossProfit);
  const opInc = opIncTtm ?? num(aLast?.operatingIncome);
  const netIncome = niTtm ?? num(aLast?.netIncome);
  const flowsGranularity: AsOfSnapshot["granularity"]["flows"] =
    fcfTtm != null || ebitdaTtm != null ? "ttm-quarterly" : aLast ? "fy-annual" : "none";

  // Revenue growth YoY con la granularidad disponible.
  let revenueGrowth: number | null = null;
  if (revTtm != null) {
    const prev = (() => {
      const vals: number[] = [];
      let seen = 0;
      for (let i = quarterly.length - 1; i >= 0; i--) {
        if (rowDate(quarterly[i]) > cutoff) continue;
        seen++;
        if (seen >= 5 && seen <= 8) {
          const v = num(quarterly[i].totalRevenue);
          if (v == null) return null;
          vals.push(v);
        }
      }
      return vals.length === 4 ? vals.reduce((a, b) => a + b, 0) : null;
    })();
    if (prev != null && prev > 0) revenueGrowth = revTtm / prev - 1;
  } else if (aLast) {
    const idx = annual.indexOf(aLast);
    const prevA = idx > 0 ? num(annual[idx - 1].totalRevenue) : null;
    const curA = num(aLast.totalRevenue);
    if (prevA != null && prevA > 0 && curA != null) revenueGrowth = curA / prevA - 1;
  }

  // Valores de balance en MONEDA LOCAL del emisor (fundamentalsTimeSeries).
  const sharesLocal = num(balanceRow.basicAverageShares) ?? num(balanceRow.dilutedAverageShares) ?? num(balanceRow.shareIssued);
  const totalDebtL = num(balanceRow.totalDebt) ?? num(aLast?.totalDebt);
  const totalCashL =
    num(balanceRow.cashCashEquivalentsAndShortTermInvestments) ??
    num(balanceRow.cashAndCashEquivalents) ??
    num(aLast?.cashCashEquivalentsAndShortTermInvestments) ??
    num(aLast?.cashAndCashEquivalents);
  // Equity ≤ 0 (AAL) ⇒ P/B y ROE null — book negativo no es métrica de valuación.
  const equityL =
    num(balanceRow.stockholdersEquity) ??
    num(balanceRow.commonStockEquity) ??
    num(balanceRow.totalEquityGrossMinorityInterest) ??
    num(aLast?.stockholdersEquity) ??
    num(aLast?.commonStockEquity) ??
    num(aLast?.totalEquityGrossMinorityInterest);

  // ── FX del corte + market cap ADR-equivalente (ver header) ────────────────
  const fxCode = (meta.financialCurrency ?? meta.currency ?? "USD").toUpperCase();
  const fxAt = (date: string): Promise<number | null> =>
    fxCode === "USD" ? Promise.resolve(1) : fetchUsdRate(fxCode, date);
  const fx = await fxAt(cutoff);
  const toUsd = (v: number | null): number | null => (v == null || fx == null ? null : v * fx);

  const rawLastOf = (pts: AsOfPoint[]): number | null => {
    for (let i = pts.length - 1; i >= 0; i--) {
      const r = pts[i].raw ?? pts[i].value;
      if (r > 0) return r;
    }
    return null;
  };
  const rawToday = rawLastOf(series);
  const rawAtCutoff = rawLastOf(sliced);
  // Acciones ADR-equivalentes HOY (mcap actual USD ÷ precio crudo actual):
  // absorbe moneda y ratio ADR:local. Drift asumido: buybacks entre corte y
  // hoy (~2-4%/año). Fallback (sin mcap actual): sólo emisores USD, ADR 1:1.
  const sharesAdrEquiv =
    meta.marketCapToday != null && rawToday != null && rawToday > 0
      ? meta.marketCapToday / rawToday
      : null;
  const marketCap =
    sharesAdrEquiv != null && rawAtCutoff != null
      ? sharesAdrEquiv * rawAtCutoff
      : fxCode === "USD" && sharesLocal != null
        ? price * sharesLocal
        : null;

  // Monetarios en USD al FX del corte.
  const revenueUsd = toUsd(revenue);
  const ebitdaUsd = toUsd(ebitda);
  const fcfUsd = toUsd(fcf);
  const niUsd = toUsd(netIncome);
  const totalDebtUsd = toUsd(totalDebtL);
  const totalCashUsd = toUsd(totalCashL);
  const equityUsd = toUsd(equityL);

  const priceToBook = marketCap != null && equityUsd != null && equityUsd > 0 ? marketCap / equityUsd : null;
  // ROE en moneda local: el FX se cancela — exacto, sin aproximaciones.
  const returnOnEquity = netIncome != null && equityL != null && equityL > 0 ? netIncome / equityL : null;
  const enterpriseToEbitda =
    marketCap != null && totalDebtUsd != null && totalCashUsd != null && ebitdaUsd != null && ebitdaUsd > 0
      ? (marketCap + totalDebtUsd - totalCashUsd) / ebitdaUsd
      : null;

  // ¿Vale la semántica por-acción (precio ADR ≈ 1 acción local)? Si el ratio
  // ADR:local se aleja de 1 (TSM 5:1, TM 10:1, BABA 8:1, PBR 2:1), EPS y CAPE
  // por acción son basura ⇒ N/D honesto y P/E agregado (mcap / NI).
  const perShareOk =
    sharesAdrEquiv != null && sharesLocal != null && sharesLocal > 0
      ? Math.abs(sharesAdrEquiv / sharesLocal - 1) <= 0.15
      : fxCode === "USD";
  const epsUsd = eps != null && fx != null ? eps * fx : null;
  const trailingPE =
    perShareOk && epsUsd != null && epsUsd > 0
      ? price / epsUsd
      : marketCap != null && niUsd != null && niUsd > 0
        ? marketCap / niUsd
        : null;

  // CAPE: precio / promedio de EPS anuales (≤10) cerrados antes del corte,
  // cada año convertido al FX del cierre de SU ejercicio. Sólo con semántica
  // por-acción válida.
  let capeRatio: number | null = null;
  let capeYears: number | null = null;
  if (perShareOk) {
    const annualEpsRows = annual
      .filter((r) => rowDate(r) <= cutoff)
      .map((r) => ({ date: rowDate(r), eps: num(r.dilutedEPS) ?? num(r.basicEPS) }))
      .filter((x): x is { date: string; eps: number } => x.eps != null)
      .slice(-10);
    const usdEps: number[] = [];
    for (const row of annualEpsRows) {
      const f = await fxAt(row.date);
      if (f != null) usdEps.push(row.eps * f);
    }
    if (usdEps.length >= 3) {
      const avg = usdEps.reduce((a, b) => a + b, 0) / usdEps.length;
      if (avg > 0) {
        capeRatio = price / avg;
        capeYears = usdEps.length;
      }
    }
  }

  // Beta y dividendos as-of — de las series propias, sin fuentes nuevas.
  const beta = spySeries ? betaAsOf(series, spySeries, cutoff) : null;
  const divFrom = new Date(Date.parse(cutoff) - 365 * 86400000).toISOString().slice(0, 10);
  const divTtm = (dividends ?? [])
    .filter((d) => d.date > divFrom && d.date <= cutoff)
    .reduce((a, d) => a + d.amount, 0);
  const dividendYield = dividends && divTtm > 0 && price > 0 ? divTtm / price : null;
  // Payout = dividendo por acción / EPS — sólo con semántica por-acción válida
  // (el dividendo del chart es por ADR; el EPS convertido es por acción local).
  const payoutRatio =
    dividendYield != null && perShareOk && epsUsd != null && epsUsd > 0 ? divTtm / epsUsd : null;

  // Cash flow anual: cada ejercicio al FX del cierre de SU período (misma
  // regla que producción — preserva niveles USD as-reported, no fabricados).
  const cashFlowRows = annual
    .filter((r) => rowDate(r) <= cutoff && (r.capitalExpenditure != null || r.operatingCashFlow != null))
    .slice(-5);
  const annualCashFlow: CashFlowYear[] = [];
  for (const r of cashFlowRows) {
    const f = await fxAt(rowDate(r));
    const c = (v: number | null): number | null => (v == null || f == null ? null : v * f);
    annualCashFlow.push({
      year: rowDate(r).slice(0, 4),
      capitalExpenditure: c(num(r.capitalExpenditure)),
      operatingCashFlow: c(num(r.operatingCashFlow)),
      freeCashFlow: c(num(r.freeCashFlow)),
      repurchases: c(num(r.repurchaseOfCapitalStock) ?? num(r.commonStockPayments)),
      dividendsPaid: c(num(r.commonStockDividendPaid) ?? num(r.cashDividendsPaid)),
      stockBasedComp: c(num(r.stockBasedCompensation)),
    });
  }

  // Quality factor inputs (últimos 2 FY publicados ≤ corte). Ratios
  // FX-invariantes ⇒ sin conversión.
  const qualityAnnual = annual
    .filter((r) => rowDate(r) <= cutoff && (num(r.totalAssets) != null || num(r.grossProfit) != null))
    .slice(-2)
    .map((r) => ({
      year: rowDate(r).slice(0, 4),
      totalAssets: num(r.totalAssets),
      grossProfit: num(r.grossProfit),
      netIncome: num(r.netIncome) ?? num(r.netIncomeCommonStockholders),
      operatingCashFlow: num(r.operatingCashFlow),
      sharesOutstanding: num(r.shareIssued) ?? num(r.ordinarySharesNumber) ?? num(r.basicAverageShares),
    }));

  const margins = {
    gross: grossProfit != null && revenue != null && revenue > 0 ? grossProfit / revenue : null,
    op: opInc != null && revenue != null && revenue > 0 ? opInc / revenue : null,
    net: netIncome != null && revenue != null && revenue > 0 ? netIncome / revenue : null,
    ebitda: ebitda != null && revenue != null && revenue > 0 ? ebitda / revenue : null,
  };

  // StockData sintético: los campos irrecuperables van null/vacíos y el
  // pipeline los degrada a na/N-A por diseño (misma semántica que un ticker
  // real con datos escasos).
  const stockData = {
    ticker,
    companyName: meta.companyName,
    sector: meta.sector,
    industry: meta.industry,
    description: meta.description,
    currency: meta.currency ?? "USD",
    currentPrice: price,
    priceChangePct: null,
    marketCap,
    fiftyTwoWeekLow: w52Low,
    fiftyTwoWeekHigh: w52High,
    beta,
    sharesOutstanding: sharesAdrEquiv ?? sharesLocal,
    shortPercentOfFloat: null,
    trailingPE,
    forwardPE: null,
    capeRatio,
    capeYears,
    priceToSales: marketCap != null && revenueUsd != null && revenueUsd > 0 ? marketCap / revenueUsd : null,
    priceToBook,
    enterpriseToEbitda,
    trailingEps: perShareOk ? epsUsd : null,
    targetMeanPrice: null,
    targetLowPrice: null,
    targetHighPrice: null,
    recommendationKey: null,
    analystStrongBuy: 0,
    analystBuy: 0,
    analystHold: 0,
    analystSell: 0,
    analystStrongSell: 0,
    totalRevenue: revenueUsd,
    revenueGrowth,
    earningsGrowth: null,
    grossMargins: margins.gross,
    operatingMargins: margins.op,
    profitMargins: margins.net,
    ebitdaMargins: margins.ebitda,
    ebitda: ebitdaUsd,
    freeCashflow: fcfUsd,
    operatingCashflow: null,
    returnOnEquity,
    returnOnAssets: null,
    totalDebt: totalDebtUsd,
    totalCash: totalCashUsd,
    debtToEquity: null,
    currentRatio: null,
    quickRatio: null,
    dividendYield,
    payoutRatio,
    exDividendDate: null,
    heldPercentInsiders: null,
    heldPercentInstitutions: null,
    quarterlyRevenue: [],
    earningsHistory: [],
    forwardEstimates: [],
    nextEarningsDate: null,
    analystActions: [],
    insiderTransactions: [],
    recentNews: [],
    annualCashFlow,
    qualityAnnual,
    latestQuarterIS: null,
    peerComparison: null,
  } as unknown as StockData;

  const seg = profile ? ({ industryProfile: profile } as SegmentSankeyData) : null;

  return {
    stockData,
    seg,
    technical,
    priceAtCutoff: price,
    granularity: { flows: flowsGranularity, balanceAsOf: balanceRow ? rowDate(balanceRow) : null },
  };
}

/* ── Short interest as-of (FINRA) ──────────────────────────────────────────
   FINRA publica el consolidated short interest BI-MENSUAL y su Query API
   responde sin autenticación (probado 2026-07-19). Anti-fuga: el dato se
   PUBLICA ~9-10 días hábiles después del settlement ⇒ sólo se aceptan
   settlements ≤ corte − 12 días calendario (lo que un inversor tenía
   publicado ese día). El % se aproxima contra las acciones ADR-equivalentes
   (el float real es < outstanding ⇒ leve subestimación, declarada; FINRA
   reporta el short de la línea US, mismas unidades que el ADR-equiv).
   ────────────────────────────────────────────────────────────────────────── */

const SHORT_PUBLICATION_LAG_DAYS = 12;

export async function fetchShortQtyAsOf(symbol: string, cutoff: string): Promise<number | null> {
  try {
    const end = new Date(Date.parse(cutoff) - SHORT_PUBLICATION_LAG_DAYS * 86400000)
      .toISOString().slice(0, 10);
    const start = new Date(Date.parse(end) - 75 * 86400000).toISOString().slice(0, 10);
    const r = await fetch("https://api.finra.org/data/group/otcMarket/name/consolidatedShortInterest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        limit: 10,
        compareFilters: [{ compareType: "EQUAL", fieldName: "symbolCode", fieldValue: symbol }],
        // La API no permite sort sin fijar la partition key (settlementDate):
        // se pide la ventana y se elige el último settlement del lado cliente.
        dateRangeFilters: [{ fieldName: "settlementDate", startDate: start, endDate: end }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return null;
    const rows = (await r.json()) as Array<{
      settlementDate?: string;
      currentShortPositionQuantity?: number;
    }>;
    if (!Array.isArray(rows)) return null;
    let best: { d: string; q: number } | null = null;
    for (const row of rows) {
      const d = row.settlementDate;
      const q = row.currentShortPositionQuantity;
      if (typeof d !== "string" || typeof q !== "number" || !Number.isFinite(q) || q < 0) continue;
      if (!best || d > best.d) best = { d, q };
    }
    return best?.q ?? null;
  } catch {
    return null;
  }
}

/* ── Peers as-of ───────────────────────────────────────────────────────────
   La LISTA de comparables es la de HOY (screener por industria de producción
   — asunción declarada: la cohorte es estable a horizonte 18 meses; un peer
   que salió a bolsa después del corte se cae solo porque su snapshot skipea
   por serie corta). Las MÉTRICAS de cada peer se reconstruyen AL CORTE con la
   misma maquinaria as-of del ticker principal (P/E trailing, growth, margen
   operativo, EV/EBITDA; forward P/E no existe as-of y queda null). Los
   bundles se fetchean UNA vez por ticker y sirven para todos los cortes.
   ────────────────────────────────────────────────────────────────────────── */

const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PeerBundle {
  symbol: string;
  name: string;
  meta: TickerMeta;
  series: AsOfPoint[];
  fundamentals: FundamentalHistory;
}

export async function fetchPeerBundles(
  ticker: string,
  industry: string | null,
  delayMs = 300,
): Promise<PeerBundle[]> {
  const pc = await fetchPeerComparison(ticker, industry).catch(() => null);
  const wanted = (pc?.peers ?? []).slice(0, 5);
  const out: PeerBundle[] = [];
  for (const p of wanted) {
    try {
      const [meta, series, fundamentals] = await Promise.all([
        fetchMeta(p.symbol), fetchDailySeries(p.symbol), fetchFundamentalHistory(p.symbol),
      ]);
      out.push({ symbol: p.symbol, name: p.name, meta, series, fundamentals });
    } catch { /* peer que no fetchea queda afuera — degradación parcial */ }
    await sleepMs(delayMs);
  }
  return out;
}

export async function peersAsOf(bundles: PeerBundle[], cutoff: string): Promise<PeerComparison | null> {
  const peers: PeerMultiple[] = [];
  for (const b of bundles) {
    const snap = await snapshotAsOf({
      ticker: b.symbol, cutoff, meta: b.meta, series: b.series, fundamentals: b.fundamentals, profile: null,
    });
    if ("skipped" in snap && snap.skipped) continue;
    const d = (snap as AsOfSnapshot).stockData;
    peers.push({
      symbol: b.symbol,
      name: b.name,
      trailingPE: d.trailingPE,
      forwardPE: null,
      revenueGrowth: d.revenueGrowth,
      operatingMargin: d.operatingMargins,
      evToEbitda: d.enterpriseToEbitda,
    });
  }
  if (peers.length === 0) return null;
  const tp = peers.map((p) => p.trailingPE).filter((v): v is number => v != null);
  return {
    peers,
    avgTrailingPE: tp.length > 0 ? tp.reduce((a, b) => a + b, 0) / tp.length : null,
    avgForwardPE: null,
  };
}
