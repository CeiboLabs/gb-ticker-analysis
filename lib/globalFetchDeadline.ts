// Red de seguridad a nivel isolate: NINGÚN fetch sin deadline.
//
// El incidente 2026-07-06 (análisis colgados para siempre, cero rastro en el
// monitor) tenía esta clase de raíz: upstreams que tarpitean conexiones desde
// el egreso compartido de Cloudflare + fetch sin timeout = request eterno.
// secFetch / fxRates / logos ya pasan su propio AbortSignal, pero las
// dependencias hacen fetch() pelado fuera de nuestro control — en particular
// el crumb/cookie dance de yahoo-finance2 (getCrumb.js llama al fetch GLOBAL
// directamente, ignorando el fetch inyectado por constructor), que es además
// el endpoint más hostil de Yahoo hacia IPs de datacenter.
//
// El wrapper agrega AbortSignal.timeout SOLO cuando la llamada no trae signal
// propio; quien ya maneja su cancelación (OpenAI SDK con su timeout de 55s,
// secFetch, fxRates) pasa intacto. Los inputs tipo Request se dejan como
// están: un Request siempre expone .signal y no podemos distinguir uno
// deliberado de uno por defecto sin romper semántica.
//
// Importar por side-effect ANTES de construir clientes que fetchean:
//   import "@/lib/globalFetchDeadline";

const FETCH_DEFAULT_DEADLINE_MS = 20_000;

type PatchedGlobal = typeof globalThis & { __fetchDeadlineInstalled?: boolean };
const g = globalThis as PatchedGlobal;

if (!g.__fetchDeadlineInstalled && typeof g.fetch === "function") {
  g.__fetchDeadlineInstalled = true;
  const baseFetch = g.fetch.bind(globalThis);
  const wrapped: typeof fetch = (input, init) => {
    if (init?.signal || input instanceof Request) return baseFetch(input, init);
    return baseFetch(input, { ...init, signal: AbortSignal.timeout(FETCH_DEFAULT_DEADLINE_MS) });
  };
  // Next/instrumentaciones cuelgan marcadores del objeto fetch parcheado —
  // copiarlos para que un chequeo de identidad ajeno no re-parchee a ciegas.
  Object.assign(wrapped, g.fetch);
  g.fetch = wrapped;
}

export {};
