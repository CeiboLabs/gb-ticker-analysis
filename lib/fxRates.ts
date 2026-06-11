// Fetches a foreign-currency → USD exchange rate from Frankfurter
// (https://api.frankfurter.dev — sourced from the European Central Bank
// reference rates, no auth required, edge-runtime friendly). The 8-K parser
// returns IS values in the issuer's reporting currency; this module is
// invoked at chart build time to convert non-USD figures so the Sankey
// renders in USD like the rest of the app.
//
// Cache strategy: in-memory module-level Map with a 24h TTL. Each cold edge
// instance fetches once per currency, which is acceptable since FX rates
// move single-digit basis points intraday and our headline numbers are
// already rounded to billions / millions on the chart.

const TTL_MS = 24 * 60 * 60 * 1000;
// TTL corto para valores de fallback (estático o stale): reintenta Frankfurter
// cada hora, pero sin repetir el fetch + timeout de 5s en cada request.
const FALLBACK_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { rate: number; fetchedAt: number; ttlMs: number }>();

// Conservative static fallback rates (as of 2026-05) for currencies the
// primary Frankfurter feed doesn't list. Frankfurter is sourced from ECB
// reference rates, which omit several currencies relevant to ADRs:
//   - TWD (Taiwan New Dollar) — TSM, UMC, ASE Taiwanese ADRs
//   - RUB (Russian rouble)    — historical positions only post-sanctions
//   - VEF, ARS, NGN, EGP      — not currently relevant
// FX moves single-digit basis points intraday on any major and at most a
// few percent across a year for the listed pairs, so a static rate is
// preferable to a missing chart. Updated annually.
const STATIC_USD_RATES: Record<string, number> = {
  TWD: 0.0312,   // ≈ 32 TWD/USD
  RUB: 0.0119,   // ≈ 84 RUB/USD
};

// Fallback (rate stale o tabla estática) cacheado con TTL corto — sin esto,
// cada moneda que Frankfurter no lista (TWD siempre) repetía el fetch y
// esperaba el timeout completo en cada build de Sankey, para siempre.
function fallbackRate(code: string, staleRate: number | undefined): number | null {
  const rate = staleRate ?? STATIC_USD_RATES[code] ?? null;
  if (rate != null) cache.set(code, { rate, fetchedAt: Date.now(), ttlMs: FALLBACK_TTL_MS });
  return rate;
}

export async function fetchUsdRate(currency: string): Promise<number | null> {
  const code = currency.toUpperCase();
  if (code === "USD") return 1;
  // El código viene de datos de terceros (Yahoo financialCurrency) — solo
  // codigos ISO-4217 plausibles llegan a la URL de Frankfurter.
  if (!/^[A-Z]{3}$/.test(code)) return null;

  const cached = cache.get(code);
  if (cached && Date.now() - cached.fetchedAt < cached.ttlMs) {
    return cached.rate;
  }

  try {
    const url = `https://api.frankfurter.dev/v1/latest?base=${code}&symbols=USD`;
    const r = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!r.ok) {
      // Frankfurter returns 404 for currencies it doesn't carry (e.g. TWD).
      // Use the static fallback if we have one for this code; otherwise
      // give up and let the caller fall back to Yahoo.
      return fallbackRate(code, cached?.rate);
    }
    const data = (await r.json()) as { rates?: { USD?: number } };
    const rate = data?.rates?.USD;
    if (typeof rate !== "number" || !isFinite(rate) || rate <= 0) {
      return fallbackRate(code, cached?.rate);
    }
    cache.set(code, { rate, fetchedAt: Date.now(), ttlMs: TTL_MS });
    return rate;
  } catch {
    return fallbackRate(code, cached?.rate);
  }
}
