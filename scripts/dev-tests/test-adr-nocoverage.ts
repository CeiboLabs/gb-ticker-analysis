// Unit test del rollup buyConfirmedNoCoverage + el nudge de coherencia que
// empuja un HOLD barato+sólido+sin-cobertura hacia BUY·MEDIUM.
//   npx tsx scripts/dev-tests/test-adr-nocoverage.ts

import { computeDerivedMetrics, checkVerdictCoherence } from "../../lib/derivedMetrics";
import type { RatingConditions } from "../../lib/derivedMetrics";
import type { StockData } from "../../types/StockData";

let pass = 0, fail = 0;
const ok = (c: boolean, l: string) => { if (c) pass++; else { fail++; console.error(`  ✗ ${l}`); } };

// ── Rollup: banco ADR barato (P/B<1) + balance exento + SIN cobertura ────────
function mkBank(overrides: Partial<StockData> = {}): StockData {
  return {
    ticker: "TESTB", industry: "Banks - Diversified", sector: "Financial Services",
    currentPrice: 30, marketCap: 5e10,
    priceToBook: 0.9, returnOnEquity: 0.11, trailingPE: 11,
    freeCashflow: -4e10, // ruido de balance — no debe importar para financieras
    forwardPE: 10, forwardEstimates: [],
    totalDebt: null, totalCash: null, ebitda: null,
    recommendationKey: null, // sin cobertura
    analystStrongBuy: 0, analystBuy: 0, analystHold: 0, analystSell: 0, analystStrongSell: 0,
    insiderTransactions: [], shortPercentOfFloat: null,
    ...overrides,
  } as unknown as StockData;
}

{
  const m = computeDerivedMetrics(mkBank());
  ok(m.conditions.buyValuation === "met", "banco P/B 0.9 → valuación met");
  ok(m.conditions.buyConsensus === "na", "sin cobertura → consenso na");
  ok(m.conditions.buyConfirmed === false, "buyConfirmed false (falta consenso)");
  ok(m.conditions.buyConfirmedNoCoverage === true, "buyConfirmedNoCoverage TRUE (barato+sólido+sin cobertura)");
}
{
  // Con cobertura buy → es buyConfirmed normal, NO no-coverage.
  const m = computeDerivedMetrics(mkBank({ recommendationKey: "buy" }));
  ok(m.conditions.buyConfirmedNoCoverage === false, "con consenso buy → no-coverage false");
  ok(m.conditions.buyConfirmed === true, "con consenso buy → buyConfirmed true");
}
{
  // Valuación NO met (P/B caro, sin ROE que lo justifique) → no-coverage false.
  const m = computeDerivedMetrics(mkBank({ priceToBook: 3.0, returnOnEquity: 0.05, trailingPE: 40 }));
  ok(m.conditions.buyValuation === "not_met", "banco P/B 3.0 caro → valuación not_met");
  ok(m.conditions.buyConfirmedNoCoverage === false, "valuación not_met → no-coverage false");
}
{
  // CRÍTICO: barato SÓLO por PEG (especulativo) + sin cobertura → NO-coverage
  // FALSE. Es el filtro que evita empujar value traps (HDB/NVO/BABA) a BUY.
  const m = computeDerivedMetrics(mkBank({
    priceToBook: 2.0, returnOnEquity: 0.09, trailingPE: 20, forwardPE: 15,
    forwardEstimates: [{ period: "+1y", epsEstimate: 3, revenueEstimate: null, growth: 0.12,
      revisionsUp30d: null, revisionsDown30d: null, epsTrend30dAgo: null, epsTrend90dAgo: null }],
  }));
  ok(m.conditions.buyValuation === "met", "banco barato-por-PEG → valuación met");
  ok(m.buyValuationSpeculative === true, "met sólo por PEG → especulativo");
  ok(m.conditions.buyConfirmedNoCoverage === false, "especulativo + sin cobertura → NO-coverage FALSE (filtra value traps)");
}

// ── revisionsNetDown (FY0+FY1, 30d) ──────────────────────────────────────────
const rev = (up0: number, down0: number, up1: number, down1: number) => [
  { period: "0y", epsEstimate: 4, revenueEstimate: null, growth: null, revisionsUp30d: up0, revisionsDown30d: down0, epsTrend30dAgo: null, epsTrend90dAgo: null },
  { period: "+1y", epsEstimate: 4.5, revenueEstimate: null, growth: 0.1, revisionsUp30d: up1, revisionsDown30d: down1, epsTrend30dAgo: null, epsTrend90dAgo: null },
];
{
  const m = computeDerivedMetrics(mkBank({ forwardEstimates: rev(0, 3, 0, 2) }));
  ok(m.revisionsNetDown === true, "revisiones 5↓/0↑ → netDown true");
}
{
  const m = computeDerivedMetrics(mkBank({ forwardEstimates: rev(4, 1, 3, 1) }));
  ok(m.revisionsNetDown === false, "revisiones 2↓/7↑ → netDown false");
}
{
  const m = computeDerivedMetrics(mkBank({ forwardEstimates: [] }));
  ok(m.revisionsNetDown === false, "sin revisiones → netDown false (no castiga dato faltante)");
}

// ── Nudge de coherencia ──────────────────────────────────────────────────────
const base: RatingConditions = {
  buyValuation: "met", buyConsensus: "na", buyBalance: "na",
  avoidValuation: "not_met", avoidBalance: "not_met", avoidInsiderShort: "not_met",
  buyConfirmed: false, avoidTriggered: false, buyConfirmedNoCoverage: true,
};
{
  const coh = checkVerdictCoherence("HOLD", base);
  ok(!coh.coherent && coh.code === "verdict_hold_vs_nocoverage_buy", "HOLD + no-coverage → nudge a BUY");
  ok((coh.reason ?? "").includes("BUY"), "el motivo pide BUY·MEDIUM");
}
{
  const coh = checkVerdictCoherence("BUY", base);
  ok(coh.coherent, "BUY + no-coverage → coherente (es el rating buscado)");
}
{
  // Si además hay un AVOID disparado, no-coverage no aplica y el nudge no corre.
  const coh = checkVerdictCoherence("HOLD", { ...base, buyConfirmedNoCoverage: false, avoidTriggered: true, avoidBalance: "met" });
  ok(coh.coherent, "HOLD sin no-coverage → sin nudge");
}
{
  // Regresión: las contradicciones duras siguen ganando.
  const coh = checkVerdictCoherence("BUY", { ...base, avoidTriggered: true });
  ok(!coh.coherent && coh.code === "verdict_buy_vs_avoid", "BUY + avoid disparado sigue flaggeando");
}

// ── Abstención: AVOID discrecional → nudge a HOLD ─────────────────────────────
const noBacking: RatingConditions = {
  buyValuation: "na", buyConsensus: "na", buyBalance: "na",
  avoidValuation: "not_met", avoidBalance: "not_met", avoidInsiderShort: "not_met",
  buyConfirmed: false, avoidTriggered: false, buyConfirmedNoCoverage: false,
};
{
  const coh = checkVerdictCoherence("AVOID", noBacking);
  ok(!coh.coherent && coh.code === "verdict_avoid_discretionary_weak", "AVOID discrecional → nudge a HOLD");
  ok((coh.reason ?? "").includes("HOLD"), "el motivo pide HOLD por default");
}
{
  // AVOID MECÁNICO (gate disparado) → NO se toca (es la señal de 75%).
  const coh = checkVerdictCoherence("AVOID", { ...noBacking, avoidTriggered: true, avoidBalance: "met" });
  ok(coh.coherent, "AVOID mecánico → coherente (sin nudge)");
}
{
  // AVOID con buyConfirmed → gana la contradicción dura (avoid_vs_buy), no el nudge débil.
  const coh = checkVerdictCoherence("AVOID", { ...noBacking, buyConfirmed: true });
  ok(coh.code === "verdict_avoid_vs_buy", "AVOID + buyConfirmed → contradicción dura, no nudge débil");
}
{
  // HOLD/BUY discrecionales no gatillan el nudge de AVOID.
  ok(checkVerdictCoherence("HOLD", noBacking).coherent, "HOLD sin backing → coherente");
  ok(checkVerdictCoherence("BUY", noBacking).coherent, "BUY sin backing → coherente (no lo toca este nudge)");
}

console.log(`\nadr-nocoverage: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
