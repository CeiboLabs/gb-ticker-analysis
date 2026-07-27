import type { ChartPoint } from "@/lib/fetchChartRange";

/* ──────────────────────────────────────────────────────────────────────────
   Contexto técnico determinístico, computado en código sobre la serie diaria
   AJUSTADA de 1 año (fetchChartRange "1Y": adjclose — dividendos y splits no
   inventan retornos).

   WHY: el prompt ya pedía leer "momentum" del rango 52 semanas crudo — dos
   números de Yahoo que el modelo interpretaba solo. Esto entrega la lectura
   masticada y verificable: posición en el rango, precio vs medias de 50/200
   ruedas, retornos 1M-12M, drawdown máximo y volatilidad realizada. Familia
   factor/momentum (con respaldo empírico), NO chartismo: acá no hay RSI, ni
   soportes, ni patrones, a propósito — y el bloque es CONTEXTO NARRATIVO,
   jamás una condición del framework de rating (eso queda para cuando el
   verdict_log/backtest demuestre que la señal paga).

   Todo null-safe: serie corta (IPO reciente) ⇒ los campos que no alcanzan
   quedan null y el formatter los omite honestamente; menos de MIN_SESSIONS
   puntos ⇒ no hay bloque (mejor nada que un número sin sustento).
   ────────────────────────────────────────────────────────────────────────── */

const SESSIONS_1M = 21;
const SESSIONS_3M = 63;
const SESSIONS_6M = 126;
const SESSIONS_12M = 252;
// Debajo de esto la serie no da para ninguna lectura seria (ni SMA50 ni 3M).
const MIN_SESSIONS = 60;
// Una serie con ≥240 ruedas cubre ~52 semanas reales; menos = etiquetar honesto.
const FULL_YEAR_SESSIONS = 240;

export interface TechnicalContext {
  asOf: string;                 // fecha del último cierre de la serie (YYYY-MM-DD)
  lastClose: number;            // cierre ajustado más reciente
  sessions: number;             // ruedas disponibles en la serie
  coversFullYear: boolean;      // false ⇒ el rango NO es de 52 semanas (IPO/serie corta)
  rangeHigh: number;
  rangeLow: number;
  rangePositionPct: number | null;  // 0 = en el mínimo, 100 = en el máximo
  pctFromHigh: number | null;       // ≤ 0 (distancia al máximo del rango)
  pctFromLow: number | null;        // ≥ 0
  sma50: number | null;
  sma200: number | null;
  pctVsSma50: number | null;
  pctVsSma200: number | null;
  // Estructura de tendencia (sólo cuando existen ambas medias):
  // 'alcista' = precio > MM50 > MM200 · 'bajista' = precio < MM50 < MM200 · resto 'mixta'
  trend: "alcista" | "bajista" | "mixta" | null;
  ret1M: number | null;         // fracciones (0.042 = +4.2%)
  ret3M: number | null;
  ret6M: number | null;
  ret12M: number | null;
  // Momentum 12-1: retorno de 12 meses EXCLUYENDO el último (Jegadeesh-Titman
  // 1993 — el factor momentum con respaldo académico; el mes final se excluye
  // por la reversión de corto plazo). Contexto + campo de calibración en
  // verdict_log; JAMÁS condición del framework.
  ret12_1: number | null;
  maxDrawdownPct: number | null;    // ≤ 0, peor caída pico-a-valle de la serie
  realizedVolPct: number | null;    // desvío de retornos log diarios, anualizado √252, en %
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

// Nunca lanza: entrada rara (serie vacía, valores no finitos, desorden) ⇒ null.
export function computeTechnicalContext(prices: ChartPoint[] | null | undefined): TechnicalContext | null {
  if (!prices || prices.length < MIN_SESSIONS) return null;
  // Sólo la serie diaria (time = "YYYY-MM-DD"); valores no finitos o ≤0 fuera.
  const closes: number[] = [];
  let asOf = "";
  for (const p of prices) {
    if (typeof p.time !== "string" || !isFiniteNum(p.value) || p.value <= 0) continue;
    closes.push(p.value);
    asOf = p.time;
  }
  if (closes.length < MIN_SESSIONS || !asOf) return null;

  const n = closes.length;
  const last = closes[n - 1];

  const sma = (win: number): number | null => {
    if (n < win) return null;
    let s = 0;
    for (let i = n - win; i < n; i++) s += closes[i];
    return s / win;
  };
  const retAt = (sessions: number): number | null => {
    if (n <= sessions) return null;
    const past = closes[n - 1 - sessions];
    return past > 0 ? last / past - 1 : null;
  };

  const rangeHigh = Math.max(...closes);
  const rangeLow = Math.min(...closes);
  const rangePositionPct =
    rangeHigh > rangeLow ? ((last - rangeLow) / (rangeHigh - rangeLow)) * 100 : null;
  const pctFromHigh = rangeHigh > 0 ? (last / rangeHigh - 1) * 100 : null;
  const pctFromLow = rangeLow > 0 ? (last / rangeLow - 1) * 100 : null;

  const sma50 = sma(50);
  const sma200 = sma(200);
  const pctVsSma50 = sma50 != null && sma50 > 0 ? (last / sma50 - 1) * 100 : null;
  const pctVsSma200 = sma200 != null && sma200 > 0 ? (last / sma200 - 1) * 100 : null;

  let trend: TechnicalContext["trend"] = null;
  if (sma50 != null && sma200 != null) {
    if (last > sma50 && sma50 > sma200) trend = "alcista";
    else if (last < sma50 && sma50 < sma200) trend = "bajista";
    else trend = "mixta";
  }

  // 12M: estricto a 252 ruedas; si la serie quedó apenas corta por feriados
  // (240-252) usamos el primer punto — sigue siendo ~un año calendario.
  const ret12M = retAt(SESSIONS_12M) ?? (n >= FULL_YEAR_SESSIONS ? retAt(n - 1) : null);
  const ret1M = retAt(SESSIONS_1M);
  const ret12_1 =
    ret12M != null && ret1M != null && 1 + ret1M !== 0 ? (1 + ret12M) / (1 + ret1M) - 1 : null;

  // Máximo drawdown pico-a-valle sobre toda la serie.
  let peak = closes[0];
  let maxDd = 0;
  for (const c of closes) {
    if (c > peak) peak = c;
    const dd = c / peak - 1;
    if (dd < maxDd) maxDd = dd;
  }

  // Volatilidad realizada anualizada sobre las últimas ≤252 ruedas.
  const volWin = Math.min(n - 1, SESSIONS_12M);
  let realizedVolPct: number | null = null;
  if (volWin >= 20) {
    const rets: number[] = [];
    for (let i = n - volWin; i < n; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const varSum = rets.reduce((a, b) => a + (b - mean) * (b - mean), 0);
    const sd = Math.sqrt(varSum / (rets.length - 1));
    realizedVolPct = sd * Math.sqrt(252) * 100;
  }

  return {
    asOf,
    lastClose: last,
    sessions: n,
    coversFullYear: n >= FULL_YEAR_SESSIONS,
    rangeHigh,
    rangeLow,
    rangePositionPct,
    pctFromHigh,
    pctFromLow,
    sma50,
    sma200,
    pctVsSma50,
    pctVsSma200,
    trend,
    ret1M,
    ret3M: retAt(SESSIONS_3M),
    ret6M: retAt(SESSIONS_6M),
    ret12M,
    ret12_1,
    maxDrawdownPct: maxDd * 100,
    realizedVolPct,
  };
}

/* ── Formato para el prompt ────────────────────────────────────────────────── */

function signedPct(v: number | null, digits = 1): string {
  if (v == null) return "N/D";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

function money(v: number | null): string {
  return v == null ? "N/D" : `$${v.toFixed(2)}`;
}

export function fmtTechnicalContext(t: TechnicalContext): string {
  const L: string[] = [];
  L.push("Serie diaria AJUSTADA por dividendos/splits, calculada en código — cifras AUTORITATIVAS: citalas tal cual, no las recalcules.");
  L.push("Es CONTEXTO DESCRIPTIVO de precio/momentum, NO una condición del framework de rating.");
  L.push("");
  L.push(`  Cierre al ${t.asOf}: ${money(t.lastClose)} (${t.sessions} ruedas de historia)`);
  const rangeLabel = t.coversFullYear ? "Rango 52 semanas" : `Rango de la serie disponible (${t.sessions} ruedas — MENOS de un año, empresa de listado reciente)`;
  const pos = t.rangePositionPct != null ? ` | posición en el rango: ${t.rangePositionPct.toFixed(0)}%` : "";
  L.push(`  ${rangeLabel}: ${money(t.rangeLow)} – ${money(t.rangeHigh)}${pos} (${signedPct(t.pctFromHigh)} desde el máximo, ${signedPct(t.pctFromLow)} desde el mínimo)`);
  if (t.sma50 != null || t.sma200 != null) {
    const parts: string[] = [];
    if (t.sma50 != null) parts.push(`MM50: ${money(t.sma50)} (precio ${signedPct(t.pctVsSma50)})`);
    if (t.sma200 != null) parts.push(`MM200: ${money(t.sma200)} (precio ${signedPct(t.pctVsSma200)})`);
    L.push(`  Medias móviles: ${parts.join(" | ")}`);
  }
  if (t.trend != null) {
    const detail =
      t.trend === "alcista" ? "precio > MM50 > MM200" :
      t.trend === "bajista" ? "precio < MM50 < MM200" :
      "señales cruzadas entre precio, MM50 y MM200";
    L.push(`  Estructura de tendencia: ${t.trend} (${detail})`);
  }
  const rets: string[] = [];
  if (t.ret1M != null) rets.push(`1M ${signedPct(t.ret1M * 100)}`);
  if (t.ret3M != null) rets.push(`3M ${signedPct(t.ret3M * 100)}`);
  if (t.ret6M != null) rets.push(`6M ${signedPct(t.ret6M * 100)}`);
  if (t.ret12M != null) rets.push(`12M ${signedPct(t.ret12M * 100)}`);
  if (t.ret12_1 != null) rets.push(`momentum 12-1 (excl. último mes) ${signedPct(t.ret12_1 * 100)}`);
  if (rets.length) L.push(`  Retornos (ajustados): ${rets.join(" | ")}`);
  const tail: string[] = [];
  if (t.maxDrawdownPct != null) tail.push(`Máx. drawdown de la serie: ${t.maxDrawdownPct.toFixed(1)}%`);
  if (t.realizedVolPct != null) tail.push(`Volatilidad realizada anualizada: ${t.realizedVolPct.toFixed(1)}%`);
  if (tail.length) L.push(`  ${tail.join(" | ")}`);
  return L.join("\n");
}
