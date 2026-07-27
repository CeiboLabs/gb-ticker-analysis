// Historial de veredictos (tabla verdict_log) — el insumo del backtest de
// calidad de la recomendación.
//
// WHY: responder "cuando el sistema dice BUY, ¿cuántas veces acierta?" exige
// comparar cada veredicto contra el retorno 6-12 meses después. Hoy no se
// puede: el cache de análisis es efímero (Cache API / memoria, se pisa por
// ticker) y analyze_events —que sí guarda el rating— se purga a los
// RETENTION_DAYS (90). verdict_log es append-only, EXENTA de purgeExpiredRows,
// y guarda una fila por generación FRESCA (nunca cache_hit, nunca mock) con el
// snapshot mínimo para backtesting: rating + targets + precio al momento + las
// condiciones del framework ya evaluadas en código. Guardar las condiciones
// habilita calibración por condición y permite evaluar señales nuevas (p.ej.
// contexto técnico) contra resultados reales antes de dejarlas opinar en el
// veredicto.
//
// Escritura best-effort, calcada de recordAnalyzeEvent (lib/metrics.ts): un
// fallo de D1 jamás afecta la respuesta del análisis.

import { getMetricsDb } from "@/lib/metrics";
import { CACHE_VERSION } from "@/lib/cache";
import type { StructuredReport } from "@/types/Report";
import type { StockData } from "@/types/StockData";
import type { DerivedMetrics } from "@/lib/derivedMetrics";
import type { TechnicalContext } from "@/lib/technicalContext";
import type { ScenarioRange } from "@/lib/scenarioRange";
import type { QualityMetrics } from "@/lib/qualityMetrics";

export interface VerdictLogRow {
  ts: number;
  ticker: string;
  companyName: string | null;
  rating: string;
  conviction: string | null;
  priceAtVerdict: number | null;
  currency: string | null;
  priceTarget: number | null;
  bullTarget: number | null;
  bearTarget: number | null;
  bullProbability: number | null;
  bearProbability: number | null;
  marketCap: number | null;
  consensus: string | null;
  metricsJson: string;
  coherenceFlags: string | null;
  model: string;
  reportVersion: string;
  // 'live' (default) para generaciones de /api/analyze; 'backtest:<corte>' para
  // filas del backtest point-in-time. Los consumidores del historial vivo deben
  // filtrar source='live'.
  source: string;
}

// Los targets post-clamp son strings numéricos puros ("215.50" — regex del
// schema Zod + toFixed(2) del clamp). Null ante cualquier otro formato: un
// string inesperado no debe convertirse en un 0 falso dentro de la serie.
function parseTarget(s: string | null | undefined): number | null {
  if (!s || !/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseProbability(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

// Completitud del snapshot que alimentó el veredicto. Backtest 2026-07-19: la
// tasa de BUY colapsó de 11 a 1 entre cortes por pura disponibilidad del dato
// de valuación, y los HOLD·LOW de nombres con datos flacos (MUFG, SMFG) fueron
// las mayores oportunidades perdidas (+30-50% vs SPY). Registrar QUÉ estaba
// disponible permite separar "HOLD por tesis" de "HOLD por falta de datos" al
// calibrar el hit-rate contra retornos realizados.
function dataCompleteness(d: StockData, technical: TechnicalContext | null) {
  const checks = {
    fcf: d.freeCashflow != null,
    forwardEps: d.forwardEstimates.some((e) => e.period === "+1y" && e.epsEstimate != null),
    consensus:
      d.recommendationKey != null ||
      d.analystStrongBuy + d.analystBuy + d.analystHold + d.analystSell + d.analystStrongSell > 0,
    shortInterest: d.shortPercentOfFloat != null,
    insiders: d.insiderTransactions.length > 0,
    news: (d.recentNews?.length ?? 0) > 0,
    peers: (d.peerComparison?.peers.length ?? 0) > 0,
    priceToBook: d.priceToBook != null,
    technical: technical != null,
  };
  const vals = Object.values(checks);
  return { ...checks, score: Math.round((vals.filter(Boolean).length / vals.length) * 100) / 100 };
}

// Subset de DerivedMetrics relevante para eval — números y condiciones, sin
// los campos de formato/procedencia textual — más el contexto técnico al
// momento del veredicto (la señal candidata a validar: ¿un BUY con tendencia a
// favor rinde mejor?) y la completitud del snapshot. JSON chico a propósito:
// la tabla no tiene retención y tiene que seguir liviana a años vista.
function slimMetrics(
  m: DerivedMetrics,
  technical: TechnicalContext | null,
  d: StockData,
  scenarioRange: ScenarioRange | null,
  quality: QualityMetrics | null,
): string {
  return JSON.stringify({
    fcfYield: m.fcfYield,
    buyValuationBasis: m.buyValuationBasis,
    buyValuationSpeculative: m.buyValuationSpeculative,
    peg: m.peg,
    pegGrowthPct: m.pegGrowthPct,
    growthIsForward: m.growthIsForward,
    forwardPE: m.forwardPE,
    fwdEpsGrowthPct: m.fwdEpsGrowthPct,
    netDebtToEbitda: m.netDebtToEbitda,
    baseTargetForwardPE: m.baseTargetForwardPE,
    baseTargetMethod: m.baseTargetMethod,
    baseTargetUpsidePct: m.baseTargetUpsidePct,
    shortPct: m.shortPct,
    insiderNetSeller: m.insiderNetSeller,
    revisionsNetDown: m.revisionsNetDown,
    industryProfile: m.industryProfile,
    conditions: m.conditions,
    technical,
    // Rango de escenarios mecánico usado (cono de vol) — para calibrar cobertura
    // del rango contra retornos realizados sin re-derivarlo.
    scenarioRange,
    // Factores de calidad (observador) — para calibrar si el score predice
    // retornos antes de dejarlo gatear el veredicto.
    quality,
    completeness: dataCompleteness(d, technical),
  });
}

// Payload eager (mismo patrón que fireEvent en la ruta): se construye con las
// referencias vivas del request y se escribe diferido vía after().
export function buildVerdictLogRow(args: {
  ticker: string;
  report: StructuredReport;
  stockData: StockData;
  derived: DerivedMetrics;
  technical?: TechnicalContext | null;
  scenarioRange?: ScenarioRange | null;
  quality?: QualityMetrics | null;
  coherenceFlags: string[];
  model: string;
  source?: string;
}): VerdictLogRow {
  const { report, stockData, derived } = args;
  return {
    ts: Date.now(),
    ticker: args.ticker.toUpperCase(),
    companyName: stockData.companyName ?? null,
    rating: report.verdict.rating,
    conviction: report.verdict.conviction ?? null,
    priceAtVerdict: stockData.currentPrice ?? null,
    currency: stockData.currency ?? null,
    priceTarget: parseTarget(report.verdict.priceTarget),
    bullTarget: parseTarget(report.bullCase?.priceTarget),
    bearTarget: parseTarget(report.bearCase?.priceTarget),
    bullProbability: parseProbability(report.bullCase?.probability),
    bearProbability: parseProbability(report.bearCase?.probability),
    marketCap: stockData.marketCap ?? null,
    consensus: derived.consensus,
    metricsJson: slimMetrics(derived, args.technical ?? null, stockData, args.scenarioRange ?? null, args.quality ?? null),
    coherenceFlags: args.coherenceFlags.length > 0 ? args.coherenceFlags.join(",") : null,
    model: args.model,
    reportVersion: CACHE_VERSION,
    source: args.source ?? "live",
  };
}

const INSERT_SQL =
  "INSERT INTO verdict_log (" +
  "ts, ticker, company_name, rating, conviction, " +
  "price_at_verdict, currency, price_target, bull_target, bear_target, " +
  "bull_probability, bear_probability, market_cap, consensus, " +
  "metrics_json, coherence_flags, model, report_version, source" +
  ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

// async + try/catch (patrón readFlag): esta función corre dentro de after() y
// su contrato es NO lanzar jamás — ni siquiera si un binding rompe el contrato
// D1 lanzando sincrónicamente; el async lo convierte en rejection capturada.
export async function recordVerdictLog(row: VerdictLogRow): Promise<void> {
  const db = getMetricsDb();
  if (!db) return;
  try {
    await db
      .prepare(INSERT_SQL)
      .bind(
        row.ts,
        row.ticker,
        row.companyName,
        row.rating,
        row.conviction,
        row.priceAtVerdict,
        row.currency,
        row.priceTarget,
        row.bullTarget,
        row.bearTarget,
        row.bullProbability,
        row.bearProbability,
        row.marketCap,
        row.consensus,
        row.metricsJson,
        row.coherenceFlags,
        row.model,
        row.reportVersion,
        row.source,
      )
      .run();
  } catch (err) {
    console.error("[verdict-log] write failed:", err);
  }
}
