// Fetches foreign-currency → USD exchange rates from Frankfurter
// (https://api.frankfurter.dev — sourced from the European Central Bank
// reference rates, no auth required, edge-runtime friendly). The 8-K/XBRL
// parsers return IS values in the issuer's reporting currency; this module
// converts non-USD figures so charts and prompt render in USD.
//
// Per-period FX (2026-07-19): fetchUsdRate acepta una fecha opcional. Antes
// TODA cifra histórica se convertía al tipo de cambio de HOY — eso preserva
// los growth rates pero fabrica niveles "históricos en USD" que nunca
// existieron y esconde el efecto FX que un inversor en USD realmente vivió
// (EUR cayendo 10% con revenue +5% = -5% en USD as-reported). Con fecha, la
// conversión usa el día hábil ECB ≤ fecha.
//
// Estrategia de red: la serie histórica completa de una moneda se trae UNA
// vez por rango (10 años) y se cachea 24h — un solo request cubre todos los
// períodos de un parse (la alternativa, un request por fecha, multiplicaba
// llamadas por ~20-40 en series trimestrales largas). "latest" mantiene su
// cache propio de 24h.

const TTL_MS = 24 * 60 * 60 * 1000;
// TTL corto para valores de fallback (estático o stale): reintenta Frankfurter
// cada hora, pero sin repetir el fetch + timeout de 5s en cada request.
const FALLBACK_TTL_MS = 60 * 60 * 1000;
// Ventana de la serie histórica. Los charts consumen ~5 años de historia;
// 10 deja margen. Fechas anteriores a la ventana usan el primer valor
// disponible (aproximación explícita, mejor que el rate de hoy).
const HISTORY_YEARS = 10;

const latestCache = new Map<string, { rate: number; fetchedAt: number; ttlMs: number }>();
// code → serie ordenada asc por fecha. null = fetch falló (reintenta tras TTL corto).
const seriesCache = new Map<string, { series: Array<[string, number]> | null; fetchedAt: number }>();

// Conservative static fallback rates (as of 2026-05) for currencies the
// primary Frankfurter feed doesn't list. Frankfurter is sourced from ECB
// reference rates, which omit several currencies relevant to ADRs:
//   - TWD (Taiwan New Dollar) — TSM, UMC, ASE Taiwanese ADRs
//   - RUB (Russian rouble)    — historical positions only post-sanctions
//   - VEF, ARS, NGN, EGP      — not currently relevant
// FX moves single-digit basis points intraday on any major and at most a
// few percent across a year for the listed pairs, so a static rate is
// preferable to a missing chart. Updated annually. No son date-aware: para
// esas monedas la conversión histórica degrada al rate estático actual.
const STATIC_USD_RATES: Record<string, number> = {
  TWD: 0.0312,   // ≈ 32 TWD/USD
  RUB: 0.0119,   // ≈ 84 RUB/USD
};

// Fallback (rate stale o tabla estática) cacheado con TTL corto — sin esto,
// cada moneda que Frankfurter no lista (TWD siempre) repetía el fetch y
// esperaba el timeout completo en cada build de Sankey, para siempre.
function fallbackRate(code: string, staleRate: number | undefined): number | null {
  const rate = staleRate ?? STATIC_USD_RATES[code] ?? null;
  if (rate != null) latestCache.set(code, { rate, fetchedAt: Date.now(), ttlMs: FALLBACK_TTL_MS });
  return rate;
}

async function fetchLatestRate(code: string): Promise<number | null> {
  const cached = latestCache.get(code);
  if (cached && Date.now() - cached.fetchedAt < cached.ttlMs) {
    return cached.rate;
  }
  try {
    const url = `https://api.frankfurter.dev/v1/latest?base=${code}&symbols=USD`;
    const r = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!r.ok) {
      // Frankfurter returns 404 for currencies it doesn't carry (e.g. TWD).
      return fallbackRate(code, cached?.rate);
    }
    const data = (await r.json()) as { rates?: { USD?: number } };
    const rate = data?.rates?.USD;
    if (typeof rate !== "number" || !isFinite(rate) || rate <= 0) {
      return fallbackRate(code, cached?.rate);
    }
    latestCache.set(code, { rate, fetchedAt: Date.now(), ttlMs: TTL_MS });
    return rate;
  } catch {
    return fallbackRate(code, cached?.rate);
  }
}

// Serie histórica base→USD de los últimos HISTORY_YEARS, ordenada asc.
// Un solo request con el rango abierto ".." (hasta el último día publicado).
async function fetchRateSeries(code: string): Promise<Array<[string, number]> | null> {
  const cached = seriesCache.get(code);
  if (cached) {
    const ttl = cached.series ? TTL_MS : FALLBACK_TTL_MS;
    if (Date.now() - cached.fetchedAt < ttl) return cached.series;
  }
  try {
    const from = `${new Date().getUTCFullYear() - HISTORY_YEARS}-01-01`;
    const url = `https://api.frankfurter.dev/v1/${from}..?base=${code}&symbols=USD`;
    // Payload mayor que /latest (~10 años de días hábiles) — timeout más ancho.
    const r = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!r.ok) {
      seriesCache.set(code, { series: null, fetchedAt: Date.now() });
      return null;
    }
    const data = (await r.json()) as { rates?: Record<string, { USD?: number }> };
    const entries: Array<[string, number]> = Object.entries(data?.rates ?? {})
      .map(([d, v]) => [d, v?.USD] as [string, number | undefined])
      .filter((e): e is [string, number] => typeof e[1] === "number" && isFinite(e[1]) && e[1] > 0)
      .sort((a, b) => a[0].localeCompare(b[0]));
    const series = entries.length > 0 ? entries : null;
    seriesCache.set(code, { series, fetchedAt: Date.now() });
    return series;
  } catch {
    seriesCache.set(code, { series: null, fetchedAt: Date.now() });
    return null;
  }
}

// Último día hábil ≤ date (binario sobre la serie asc). date anterior a la
// ventana → primer valor; date futura/posterior al último publicado → último.
function rateOn(series: Array<[string, number]>, date: string): number {
  let lo = 0;
  let hi = series.length - 1;
  if (date <= series[0][0]) return series[0][1];
  if (date >= series[hi][0]) return series[hi][1];
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (series[mid][0] <= date) lo = mid;
    else hi = mid - 1;
  }
  return series[lo][1];
}

/**
 * Tipo de cambio code→USD. Sin `date`, el último publicado (comportamiento
 * histórico del módulo). Con `date` ("YYYY-MM-DD"), el del día hábil ECB ≤
 * date — para convertir cifras de períodos pasados al FX de SU período, no al
 * de hoy. Cadena de degradación con fecha: serie histórica → latest → estático;
 * nunca lanza.
 */
export async function fetchUsdRate(currency: string, date?: string | null): Promise<number | null> {
  const code = currency.toUpperCase();
  if (code === "USD") return 1;
  // El código viene de datos de terceros (Yahoo financialCurrency) — solo
  // codigos ISO-4217 plausibles llegan a la URL de Frankfurter.
  if (!/^[A-Z]{3}$/.test(code)) return null;

  const wantsHistorical = date != null && /^\d{4}-\d{2}-\d{2}$/.test(date);
  if (wantsHistorical) {
    const series = await fetchRateSeries(code);
    if (series) return rateOn(series, date);
    // Serie no disponible (moneda fuera de ECB, red caída): degradar al rate
    // actual es la aproximación previa a este cambio — explícita y acotada.
  }
  return fetchLatestRate(code);
}
