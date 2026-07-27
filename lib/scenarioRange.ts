/* ──────────────────────────────────────────────────────────────────────────
   Rango de escenarios bull–bear, calculado en código desde la volatilidad
   realizada (cono de volatilidad), NO estimado por el LLM.

   WHY: el LLM emitía sus propios precios bull/bear y el código sólo los
   recortaba contra el rango de analistas (clampReportPriceTargets), que ya es
   angosto. Resultado MEDIDO en el backtest point-in-time (122 veredictos): el
   rango bull–bear contuvo el retorno realizado sólo 43% (6m) / 36% (12m) de las
   veces — un intervalo que se lee como "escenarios plausibles" pero excluye 6
   de cada 10 desenlaces reales.

   FIX (respaldo empírico + académico): la anchura de un intervalo de retorno se
   fija mecánicamente desde la volatilidad (los retornos estandarizados por vol
   realizada son ~gaussianos — Andersen-Bollerslev-Diebold-Ebens 2001), mientras
   que la DIRECCIÓN (barely forecasteable a 6-12m) la aporta el rating vía el
   target casa, que queda DENTRO del cono. Sobre las mismas 122 filas del
   backtest, el cono log centrado en precio con z=1.5 contiene el realizado 81%
   de las veces a 12m (vs 36% del rango del LLM) y 89% a 6m.

   El cono es SIMÉTRICO en log alrededor del precio actual (drift 0): a 6-12m el
   drift esperado es chico frente a la vol, y en la medición el drift-0 fue el
   mejor calibrado. La asimetría de la tesis (¿más upside o más downside?) NO se
   expresa estrechando el rango sino en las PROBABILIDADES bull/bear que sí
   estima el LLM.

   Todo null-safe: sin precio o sin vol (serie corta / IPO) devuelve null y el
   pipeline cae al comportamiento previo (rango del LLM recortado a analistas).
   ────────────────────────────────────────────────────────────────────────── */

// Múltiplo de sigma. z=1.5 → ~80% de cobertura empírica del rango a 12 meses
// (calibrado sobre las 122 filas del backtest 2026-07-19; el z teórico de 80%
// es 1.28, pero a 12m las colas gordas de la vol —clustering— exigen 1.5 real).
export const SCENARIO_Z = 1.5;
// El reporte es una vista a 12 meses; el rango del hero es a ese horizonte.
export const SCENARIO_HORIZON_YEARS = 1;

// Topes blandos: una acción de vol patológica (biotech >65%) no debe renderizar
// una banda absurda ("+286%"). Sólo muerden fuera del rango típico de large
// caps; el golden set (vol máx ~50%) nunca los toca.
const MAX_BULL_PCT = 250;
const MIN_BEAR_PCT = -85;

export interface ScenarioRange {
  bear: number;         // piso del cono (nivel de precio)
  bull: number;         // techo del cono (nivel de precio)
  z: number;            // múltiplo de sigma usado
  horizonYears: number;
  volPct: number;       // vol realizada anualizada usada (%)
  bearPct: number;      // (bear/precio − 1)·100
  bullPct: number;      // (bull/precio − 1)·100
  capped: boolean;      // true si algún extremo tocó el tope blando
}

export function computeScenarioRange(
  currentPrice: number | null | undefined,
  realizedVolPct: number | null | undefined,
  opts?: { horizonYears?: number; z?: number },
): ScenarioRange | null {
  if (currentPrice == null || !Number.isFinite(currentPrice) || currentPrice <= 0) return null;
  if (realizedVolPct == null || !Number.isFinite(realizedVolPct) || realizedVolPct <= 0) return null;

  const horizonYears = opts?.horizonYears ?? SCENARIO_HORIZON_YEARS;
  const z = opts?.z ?? SCENARIO_Z;
  if (!(horizonYears > 0) || !(z > 0)) return null;

  const sigma = realizedVolPct / 100;
  const w = z * sigma * Math.sqrt(horizonYears);

  let bull = currentPrice * Math.exp(w);
  let bear = currentPrice * Math.exp(-w);

  const maxBull = currentPrice * (1 + MAX_BULL_PCT / 100);
  const minBear = currentPrice * (1 + MIN_BEAR_PCT / 100);
  let capped = false;
  if (bull > maxBull) { bull = maxBull; capped = true; }
  if (bear < minBear) { bear = minBear; capped = true; }

  return {
    bear,
    bull,
    z,
    horizonYears,
    volPct: realizedVolPct,
    bearPct: (bear / currentPrice - 1) * 100,
    bullPct: (bull / currentPrice - 1) * 100,
    capped,
  };
}

/* ── Formato para el prompt (bloque autoritativo) ──────────────────────────── */

function money(v: number): string {
  return `$${v.toFixed(2)}`;
}

function signedPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export function fmtScenarioRange(r: ScenarioRange): string {
  const months = Math.round(r.horizonYears * 12);
  const L: string[] = [];
  L.push(
    `Calculado en código desde la volatilidad realizada — AUTORITATIVO: usá estos límites tal cual, no los estreches.`,
  );
  L.push(
    `Vol realizada anualizada ${r.volPct.toFixed(1)}% → banda a ${months} meses = precio × e^(±z·σ·√T) con z=${r.z} (~80% de cobertura histórica del rango).`,
  );
  L.push(`  Escenario BAJISTA (piso del rango): ${money(r.bear)} (${signedPct(r.bearPct)})`);
  L.push(`  Escenario ALCISTA (techo del rango): ${money(r.bull)} (${signedPct(r.bullPct)})`);
  L.push("Reglas:");
  L.push(`  - bearCase.priceTarget DEBE ser el piso (${money(r.bear)}) y bullCase.priceTarget el techo (${money(r.bull)}). Copiá esos números.`);
  L.push(`  - Tu verdict.priceTarget (target casa) va DENTRO de esta banda y expresa tu dirección (el rating).`);
  L.push(
    `  - La asimetría de tu tesis (más upside vs más downside) se expresa en las PROBABILIDADES bull/bear, NO estrechando el rango: ` +
      `un rango angosto sub-representa la incertidumbre real (medido: los rangos angostos sólo contuvieron el resultado 36-43% de las veces).`,
  );
  return L.join("\n");
}

/* ── Enforce post-respuesta ────────────────────────────────────────────────── */

// Sobrescribe los precios bull/bear del reporte con los límites del cono. Se
// llama desde clampReportPriceTargets cuando hay rango disponible; devuelve
// strings toFixed(2) listos para el schema. La coherencia base∈[bear,bull] y
// rating↔target la sigue aplicando el clamp.
export function scenarioBounds(r: ScenarioRange): { bull: string; bear: string } {
  return { bull: r.bull.toFixed(2), bear: r.bear.toFixed(2) };
}
