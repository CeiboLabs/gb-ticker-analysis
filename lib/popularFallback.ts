// Set curado al que cae "Las más analizadas" cuando todavía no hay tráfico
// trackeado (datacenter fresco, deploy nuevo, base sin filas en la ventana).
//
// Vive en su propio módulo —sin imports— a propósito: lo consumen tanto rutas de
// servidor (/api/popular, /api/trend-reason) como el componente cliente de la
// landing. Importarlo desde lib/tickerStats.ts arrastraría el binding de SQLite
// al bundle del browser.
//
// Además de ser relleno visual, acota el gasto: /api/trend-reason sólo genera el
// "porqué" para símbolos de esta lista o del ranking real, nunca para un ticker
// arbitrario que llegue por query string.
export const POPULAR_FALLBACK = [
  "AAPL",
  "MSFT",
  "NVDA",
  "GOOGL",
  "AMZN",
  "META",
  "TSLA",
  "AMD",
] as const;
