// Unit test de los factores de calidad (lib/qualityMetrics.ts). Formas cerradas.
//   npx tsx scripts/dev-tests/test-quality.ts

import { computeQualityMetrics, fmtQualityMetrics } from "../../lib/qualityMetrics";
import type { QualityAnnual } from "../../types/StockData";

let pass = 0, fail = 0;
const ok = (c: boolean, l: string) => { if (c) pass++; else { fail++; console.error(`  ✗ ${l}`); } };
const near = (a: number | null, b: number, l: string) => ok(a != null && Math.abs(a - b) < 1e-6, `${l} (got ${a}, want ${b})`);

const row = (o: Partial<QualityAnnual>): QualityAnnual => ({
  year: "2025", totalAssets: null, grossProfit: null, netIncome: null,
  operatingCashFlow: null, sharesOutstanding: null, ...o,
});

// ── 1. Alta calidad: los 4 factores favorables → score +4 ────────────────────
{
  const rows = [
    row({ year: "2024", totalAssets: 952, sharesOutstanding: 100 }),
    row({ year: "2025", totalAssets: 1000, grossProfit: 300, netIncome: 50, operatingCashFlow: 40, sharesOutstanding: 98 }),
  ];
  const q = computeQualityMetrics(rows, false)!;
  near(q.grossProfitability, 0.30, "GP/A = 0.30");
  near(q.accruals, 0.01, "accruals = 0.01");
  ok(Math.abs(q.assetGrowth! - 0.0504) < 0.001, "asset growth ~+5%");
  near(q.netIssuance, -0.02, "net issuance = -2% (recompra)");
  ok(q.score === 4, `score +4 (got ${q.score})`);
  ok(q.factorsAvailable === 4, "4 factores disponibles");
}

// ── 2. Trampa de valor: los 4 desfavorables → score -4 ───────────────────────
{
  const rows = [
    row({ year: "2024", totalAssets: 740, sharesOutstanding: 100 }),
    row({ year: "2025", totalAssets: 1000, grossProfit: 50, netIncome: 200, operatingCashFlow: 50, sharesOutstanding: 105 }),
  ];
  const q = computeQualityMetrics(rows, false)!;
  ok(q.score === -4, `score -4 (got ${q.score})`);
  ok(q.votes.grossProfitability === -1 && q.votes.accruals === -1 && q.votes.assetGrowth === -1 && q.votes.netIssuance === -1, "los 4 votos desfavorables");
}

// ── 3. Financiera: GP N/A (no vota), score del resto ─────────────────────────
{
  const rows = [
    row({ year: "2024", totalAssets: 952, sharesOutstanding: 100 }),
    row({ year: "2025", totalAssets: 1000, grossProfit: 300, netIncome: 50, operatingCashFlow: 40, sharesOutstanding: 98 }),
  ];
  const q = computeQualityMetrics(rows, true)!;
  ok(q.grossProfitability === null, "financiera → GP null");
  ok(q.votes.grossProfitability === 0, "financiera → GP no vota");
  ok(q.score === 3 && q.factorsAvailable === 3, "financiera score +3 (3 factores)");
}

// ── 4. Neutral → 0 votos ──────────────────────────────────────────────────────
{
  const rows = [
    row({ year: "2024", totalAssets: 1000, sharesOutstanding: 100 }),
    row({ year: "2025", totalAssets: 1150, grossProfit: 120, netIncome: 60, operatingCashFlow: 5, sharesOutstanding: 100.5 }),
  ];
  // GP/A 0.104 (entre 0.08 y 0.20 → 0), accruals 0.0478 (entre 0.03 y 0.10 → 0),
  // asset growth 0.15 (entre 0.08 y 0.25 → 0), issuance +0.5% (entre -1% y 2% → 0)
  const q = computeQualityMetrics(rows, false)!;
  ok(q.score === 0, `zona neutral → score 0 (got ${q.score})`);
}

// ── 5. Null-safety ───────────────────────────────────────────────────────────
{
  // Sólo un FY: asset growth y net issuance = null (necesitan prior).
  const one = computeQualityMetrics([row({ year: "2025", totalAssets: 1000, grossProfit: 300, netIncome: 50, operatingCashFlow: 40 })], false)!;
  ok(one.assetGrowth === null && one.netIssuance === null, "un solo FY → sin YoY");
  ok(one.factorsAvailable === 2, "un solo FY → 2 factores (GP + accruals)");
  ok(computeQualityMetrics([], false) === null, "sin filas → null");
  ok(computeQualityMetrics(null, false) === null, "null → null");
  ok(computeQualityMetrics([row({ year: "2025" })], false) === null, "fila sin datos → null");
}

// ── 6. fmt cita score + readout ──────────────────────────────────────────────
{
  const rows = [
    row({ year: "2024", totalAssets: 740, sharesOutstanding: 100 }),
    row({ year: "2025", totalAssets: 1000, grossProfit: 50, netIncome: 200, operatingCashFlow: 50, sharesOutstanding: 105 }),
  ];
  const txt = fmtQualityMetrics(computeQualityMetrics(rows, false)!);
  ok(txt.includes("CALIDAD POBRE") && txt.includes("-4"), "fmt marca trampa de valor con score -4");
}

console.log(`\nquality: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
