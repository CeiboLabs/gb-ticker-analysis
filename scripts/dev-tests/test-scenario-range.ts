// Unit test del rango de escenarios mecánico (lib/scenarioRange.ts) + su
// integración con clampReportPriceTargets. Formas cerradas, sin red.
//   npx tsx scripts/dev-tests/test-scenario-range.ts

import {
  computeScenarioRange,
  fmtScenarioRange,
  scenarioBounds,
  SCENARIO_Z,
} from "../../lib/scenarioRange";
import { clampReportPriceTargets } from "../../lib/analysisSchemas";
import type { StructuredReport } from "../../types/Report";
import type { StockData } from "../../types/StockData";

let pass = 0;
let fail = 0;
function ok(cond: boolean, label: string) {
  if (cond) { pass++; } else { fail++; console.error(`  ✗ ${label}`); }
}
function near(a: number | null, b: number, tol: number, label: string) {
  ok(a != null && Math.abs(a - b) <= tol, `${label} (got ${a}, want ~${b})`);
}

// ── 1. Forma cerrada básica: P=100, vol=40%, z=1.5, T=1 → w=0.6 ──────────────
{
  const r = computeScenarioRange(100, 40)!;
  ok(r != null, "computa con precio+vol válidos");
  near(r.bull, 100 * Math.exp(0.6), 0.01, "bull = P·e^0.6 = 182.21");
  near(r.bear, 100 * Math.exp(-0.6), 0.01, "bear = P·e^-0.6 = 54.88");
  near(r.bullPct, (Math.exp(0.6) - 1) * 100, 0.1, "bullPct ~ +82.2%");
  near(r.bearPct, (Math.exp(-0.6) - 1) * 100, 0.1, "bearPct ~ -45.1%");
  ok(r.z === SCENARIO_Z && r.horizonYears === 1, "z y horizonte default");
  ok(!r.capped, "no capped a vol normal");
}

// ── 2. Log-simetría: bull·bear = P² (centrado en precio, drift 0) ────────────
{
  const P = 250;
  const r = computeScenarioRange(P, 33)!;
  near(r.bull * r.bear, P * P, 1, "bull·bear = P² (simétrico en log)");
  ok(r.bull > P && r.bear < P, "bull > P > bear");
}

// ── 3. Escala por horizonte: T=0.5 angosta la banda vs T=1 ───────────────────
{
  const full = computeScenarioRange(100, 40, { horizonYears: 1 })!;
  const half = computeScenarioRange(100, 40, { horizonYears: 0.5 })!;
  ok(half.bullPct < full.bullPct && half.bearPct > full.bearPct, "6m más angosto que 12m");
  near(half.bull, 100 * Math.exp(1.5 * 0.4 * Math.sqrt(0.5)), 0.01, "bull 6m = P·e^(z·σ·√0.5)");
}

// ── 4. Null-safety ───────────────────────────────────────────────────────────
{
  ok(computeScenarioRange(null, 40) === null, "sin precio → null");
  ok(computeScenarioRange(100, null) === null, "sin vol → null");
  ok(computeScenarioRange(100, 0) === null, "vol 0 → null");
  ok(computeScenarioRange(100, -5) === null, "vol negativa → null");
  ok(computeScenarioRange(0, 40) === null, "precio 0 → null");
  ok(computeScenarioRange(100, 40, { z: 0 }) === null, "z 0 → null");
}

// ── 5. Topes blandos a vol patológica (biotech >65%) ─────────────────────────
{
  const r = computeScenarioRange(100, 200)!; // w=3 → e^3≈+1908% sin tope
  ok(r.capped, "capped=true a vol extrema");
  near(r.bullPct, 250, 0.1, "bull capeado a +250%");
  near(r.bearPct, -85, 0.1, "bear capeado a -85%");
}

// ── 6. scenarioBounds → strings toFixed(2) ───────────────────────────────────
{
  const r = computeScenarioRange(100, 40)!;
  const b = scenarioBounds(r);
  ok(/^\d+\.\d{2}$/.test(b.bull) && /^\d+\.\d{2}$/.test(b.bear), "bounds son strings 2-dec");
  ok(parseFloat(b.bull) > parseFloat(b.bear), "bull > bear en strings");
}

// ── 7. fmtScenarioRange cita los niveles ─────────────────────────────────────
{
  const r = computeScenarioRange(100, 40)!;
  const txt = fmtScenarioRange(r);
  ok(txt.includes("$182.21") && txt.includes("$54.88"), "texto cita bull y bear");
  ok(txt.includes("AUTORITATIVO"), "texto marca autoritativo");
}

// ── 8. Integración con clampReportPriceTargets ───────────────────────────────
function mkReport(bull: string, bear: string, base: string, rating: "BUY" | "HOLD" | "AVOID"): StructuredReport {
  return {
    bullCase: { narrative: "x".repeat(160), priceTarget: bull, probability: "30" },
    bearCase: { narrative: "x".repeat(160), priceTarget: bear, probability: "20" },
    verdict: { rating, conviction: "MEDIUM", rationale: "x".repeat(710), priceTarget: base },
  } as unknown as StructuredReport;
}
function mkStock(price: number, low: number | null, high: number | null): StockData {
  return { currentPrice: price, targetLowPrice: low, targetHighPrice: high } as unknown as StockData;
}

{
  // Con cono: bull/bear del LLM (angostos) se reemplazan por los del cono.
  const range = computeScenarioRange(100, 40)!; // bull 182.21, bear 54.88
  const rep = mkReport("110", "95", "108", "BUY");
  const out = clampReportPriceTargets(rep, mkStock(100, 80, 130), range);
  near(parseFloat(out.bullCase.priceTarget), 182.21, 0.02, "clamp: bull → cono");
  near(parseFloat(out.bearCase.priceTarget), 54.88, 0.02, "clamp: bear → cono");
  const base = parseFloat(out.verdict.priceTarget);
  ok(base > 54.88 && base < 182.21, "clamp: base dentro del cono");
  ok(base >= 100 * 1.05, "clamp: BUY ⇒ base ≥ precio×1.05");
}

{
  // AVOID con base incoherente (arriba del precio) + cono ⇒ snap al techo -5%.
  const range = computeScenarioRange(100, 40)!;
  const rep = mkReport("110", "95", "130", "AVOID"); // base 130 > precio
  const out = clampReportPriceTargets(rep, mkStock(100, 80, 130), range);
  ok(parseFloat(out.verdict.priceTarget) <= 100 * 0.95, "clamp: AVOID ⇒ base ≤ precio×0.95");
  ok(parseFloat(out.bearCase.priceTarget) < 100, "clamp: bear del cono < precio");
}

{
  // Sin cono: comportamiento previo (recorte contra analistas ±30%) intacto.
  const rep = mkReport("500", "10", "120", "HOLD"); // bull absurdo, bear absurdo
  const out = clampReportPriceTargets(rep, mkStock(100, 80, 130), null);
  ok(parseFloat(out.bullCase.priceTarget) <= 130 * 1.3 + 0.01, "sin cono: bull recortado a analyst high×1.3");
  ok(parseFloat(out.bearCase.priceTarget) >= 80 * 0.7 - 0.01, "sin cono: bear recortado a analyst low×0.7");
}

console.log(`\nscenario-range: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
