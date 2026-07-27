import type { QualityAnnual } from "@/types/StockData";

/* ──────────────────────────────────────────────────────────────────────────
   Factores de CALIDAD, computados en código desde los fundamentals anuales.

   WHY: el bucket HOLD es el 74% de los veredictos y su gran problema es
   distinguir "barato y bueno" de "barato y trampa". La valuación sola no lo
   hace (el contrafactual del backtest: HDB/NVO/BABA cumplían valuación y se
   derritieron). La familia de factores de CALIDAD es la que mejor separa ambos
   y tiene evidencia empírica de primer nivel (replicación 90-100% en el estudio
   global de 153 factores; asset growth y net issuance con t>4):

     - Gross profitability (Novy-Marx): utilidad bruta / activos totales. Alta =
       negocio productivo. El complemento del value: barato + GP alto ≠ barato +
       GP bajo (value trap). N/A para financieras (sin COGS/GP significativo).
     - Accruals (Sloan): (utilidad neta − flujo operativo) / activos. Alto =
       ganancias NO respaldadas por caja = calidad de earnings pobre → suele
       preceder decepciones.
     - Asset growth (Cooper-Gulen-Schill): crecimiento YoY de activos. Alto =
       sobre-inversión → suele preceder bajo retorno.
     - Net share issuance: cambio YoY de acciones. Emisión (dilución) = malo;
       recompra neta = bueno (net payout).

   Es CONTEXTO DESCRIPTIVO + insumo de calibración (se loguea en verdict_log),
   NO todavía una condición del framework de rating: como el contexto técnico,
   primero se valida contra retornos reales antes de dejarlo gatear el veredicto.

   Todo null-safe: sin los 2 FY necesarios (empresa joven, dato faltante) el
   factor que no alcanza queda null y no vota; si ninguno se puede computar,
   computeQualityMetrics devuelve null y el prompt lo declara honestamente.
   ────────────────────────────────────────────────────────────────────────── */

// Umbrales direccionales (literatura, no fiteados a nuestro backtest — se
// calibran cuando verdict_log acumule). Cada factor vota +1 favorable /
// −1 desfavorable / 0 neutral.
const GP_GOOD = 0.20;   // GP/activos alto
const GP_BAD = 0.08;
const ACCRUALS_GOOD = 0.03;  // accruals bajos = earnings limpios
const ACCRUALS_BAD = 0.10;
const ASSETGROWTH_GOOD = 0.08;
const ASSETGROWTH_BAD = 0.25;
const ISSUANCE_GOOD = -0.01; // recompra neta
const ISSUANCE_BAD = 0.02;   // dilución >2%

export interface QualityMetrics {
  grossProfitability: number | null; // fracción
  accruals: number | null;           // fracción (alto = malo)
  assetGrowth: number | null;        // fracción YoY (alto = malo)
  netIssuance: number | null;        // fracción YoY (positivo = dilución = malo)
  votes: { grossProfitability: number; accruals: number; assetGrowth: number; netIssuance: number };
  score: number;                     // suma de votos (favorables − desfavorables)
  factorsAvailable: number;          // cuántos factores se pudieron computar
  fiscalYear: string | null;
  isFinancial: boolean;
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function computeQualityMetrics(
  rows: QualityAnnual[] | null | undefined,
  isFinancial: boolean,
): QualityMetrics | null {
  if (!rows || rows.length === 0) return null;
  // rows viene ascendente (últimos 2 FY). latest = el más nuevo.
  const latest = rows[rows.length - 1];
  const prior = rows.length >= 2 ? rows[rows.length - 2] : null;
  if (!latest) return null;

  const ta = isNum(latest.totalAssets) && latest.totalAssets > 0 ? latest.totalAssets : null;

  const grossProfitability =
    !isFinancial && isNum(latest.grossProfit) && ta != null ? latest.grossProfit / ta : null;

  const accruals =
    isNum(latest.netIncome) && isNum(latest.operatingCashFlow) && ta != null
      ? (latest.netIncome - latest.operatingCashFlow) / ta
      : null;

  const assetGrowth =
    ta != null && prior != null && isNum(prior.totalAssets) && prior.totalAssets > 0
      ? ta / prior.totalAssets - 1
      : null;

  const netIssuance =
    prior != null &&
    isNum(latest.sharesOutstanding) &&
    isNum(prior.sharesOutstanding) &&
    prior.sharesOutstanding > 0
      ? latest.sharesOutstanding / prior.sharesOutstanding - 1
      : null;

  const voteGoodHigh = (v: number | null, good: number, bad: number): number =>
    v == null ? 0 : v > good ? 1 : v < bad ? -1 : 0;
  const voteGoodLow = (v: number | null, good: number, bad: number): number =>
    v == null ? 0 : v < good ? 1 : v > bad ? -1 : 0;

  const votes = {
    grossProfitability: voteGoodHigh(grossProfitability, GP_GOOD, GP_BAD),
    accruals: voteGoodLow(accruals, ACCRUALS_GOOD, ACCRUALS_BAD),
    assetGrowth: voteGoodLow(assetGrowth, ASSETGROWTH_GOOD, ASSETGROWTH_BAD),
    netIssuance: voteGoodLow(netIssuance, ISSUANCE_GOOD, ISSUANCE_BAD),
  };
  const score = votes.grossProfitability + votes.accruals + votes.assetGrowth + votes.netIssuance;
  const factorsAvailable =
    [grossProfitability, accruals, assetGrowth, netIssuance].filter((v) => v != null).length;

  if (factorsAvailable === 0) return null;

  return {
    grossProfitability,
    accruals,
    assetGrowth,
    netIssuance,
    votes,
    score,
    factorsAvailable,
    fiscalYear: latest.year ?? null,
    isFinancial,
  };
}

/* ── Formato para el prompt ─────────────────────────────────────────────────── */

function pct(v: number | null): string {
  return v == null ? "N/D" : `${(v * 100).toFixed(1)}%`;
}
function tag(vote: number): string {
  return vote > 0 ? "favorable" : vote < 0 ? "desfavorable" : "neutral";
}

export function fmtQualityMetrics(q: QualityMetrics): string {
  const L: string[] = [];
  L.push("Factores de calidad calculados en código (fundamentals anuales). CONTEXTO DESCRIPTIVO — integralo en tu lectura de trampa de valor y en la conviction, NO es una condición del framework de rating.");
  if (q.fiscalYear) L.push(`  Año fiscal base: FY${q.fiscalYear}`);
  if (q.isFinancial) {
    L.push("  Gross profitability: N/A (perfil financiero — sin utilidad bruta significativa)");
  } else {
    L.push(`  Gross profitability (GP/activos, Novy-Marx): ${pct(q.grossProfitability)} [${tag(q.votes.grossProfitability)}] — alta = negocio productivo (el antídoto del value trap)`);
  }
  L.push(`  Accruals ((utilidad neta − flujo operativo)/activos, Sloan): ${pct(q.accruals)} [${tag(q.votes.accruals)}] — alto = ganancias no respaldadas por caja`);
  L.push(`  Asset growth (activos YoY, Cooper-Gulen-Schill): ${pct(q.assetGrowth)} [${tag(q.votes.assetGrowth)}] — alto = sobre-inversión`);
  L.push(`  Net issuance (acciones YoY): ${pct(q.netIssuance)} [${tag(q.votes.netIssuance)}] — positivo = dilución, negativo = recompra neta`);
  const readout =
    q.score >= 2 ? "CALIDAD ALTA — refuerza una tesis alcista y reduce el riesgo de trampa de valor" :
    q.score <= -2 ? "CALIDAD POBRE — bandera de trampa de valor: si el nombre está barato, la baratura puede estar justificada; sé más exigente antes de un BUY y bajá conviction" :
    "CALIDAD MIXTA/NEUTRAL — sin señal de calidad clara en ninguna dirección";
  L.push(`  → Puntuación compuesta de calidad: ${q.score >= 0 ? "+" : ""}${q.score} (de ${q.factorsAvailable} factores disponibles) — ${readout}`);
  return L.join("\n");
}
