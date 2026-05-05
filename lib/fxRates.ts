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
const cache = new Map<string, { rate: number; fetchedAt: number }>();

export async function fetchUsdRate(currency: string): Promise<number | null> {
  const code = currency.toUpperCase();
  if (code === "USD") return 1;

  const cached = cache.get(code);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached.rate;
  }

  try {
    const url = `https://api.frankfurter.dev/v1/latest?base=${code}&symbols=USD`;
    const r = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!r.ok) return cached?.rate ?? null;
    const data = (await r.json()) as { rates?: { USD?: number } };
    const rate = data?.rates?.USD;
    if (typeof rate !== "number" || !isFinite(rate) || rate <= 0) {
      return cached?.rate ?? null;
    }
    cache.set(code, { rate, fetchedAt: Date.now() });
    return rate;
  } catch {
    return cached?.rate ?? null;
  }
}
