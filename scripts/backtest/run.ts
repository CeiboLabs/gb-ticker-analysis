// Backtest point-in-time FULL-LLM (etapa aprobada por el usuario 2026-07-19).
//
// Para cada corte × ticker del golden set:
//   snapshot as-of (asof.mts) → computeDerivedMetrics + computeTechnicalContext
//   → buildPrompt con la fecha congelada al corte (asOfDate) → gpt-4o REAL
//   → StructuredReportSchema (+1 retry con feedback, como producción)
//   → gate de coherencia (+1 retry, como producción)
//   → fila en verdict_log (source='backtest:<corte>') + fila de resultados.
// Al final: retornos totales ajustados a 6/12 meses vs SPY y scoreboard de
// cohortes (por rating, por tendencia técnica, rating×tendencia, targets).
//
// Anti-fuga (se ASSERTEA por prompt): la fecha del prompt es el corte, la
// serie técnica termina ≤ corte, y el prompt no contiene la fecha real de hoy.
// gpt-4o-2024-11-20 tiene cutoff de conocimiento ~oct-2023 → cortes 2025+.
//
// Paridad 2026-07-19: snapshot con FX por período + mcap ADR-equivalente +
// P/B/ROE/EV-EBITDA as-of (asof.ts) y guidance point-in-time desde EDGAR
// (filing date ≤ corte). Ya no es Yahoo-only: suma ~3-5 requests SEC por
// ticker×corte (SKIP_GUIDANCE=1 los apaga para DRYs rápidos).
//
// Uso:  npx tsx scripts/backtest/run.ts        (desde la raíz del repo)
// Env:  CUTOFFS=2025-01-17,2025-07-18  TICKERS=KO,JPM  SAMPLE=8
//       MODEL=gpt-4o-2024-11-20  YDELAY_MS=400  DRY=1 (sin OpenAI ni DB)
//
// Costo estimado: ~US$0.05 por ticker×corte (41×2 ≈ US$4-5).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

// OPENAI_API_KEY antes del primer getOpenAIClient() (lazy): fuera de Next hay
// que cargar .env.local a mano.
for (const f of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(path.resolve(process.cwd(), f), "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch { /* siguiente */ }
}

import { registerHomeBindings } from "@/lib/homeBindings";
import { getOpenAIClient } from "@/lib/openai";
import { fetchSegmentData } from "@/lib/fetchSegmentData";
import { buildPrompt } from "@/lib/buildPrompt";
import { computeDerivedMetrics, checkVerdictCoherence, enforceConvictionDiscipline } from "@/lib/derivedMetrics";
import { computeScenarioRange, scenarioBounds } from "@/lib/scenarioRange";
import { computeQualityMetrics } from "@/lib/qualityMetrics";
import { StructuredReportSchema, coerceStringFields, formatZodErrors } from "@/lib/analysisSchemas";
import { buildVerdictLogRow, recordVerdictLog } from "@/lib/verdictLog";
import type { StructuredReport, IndustryProfile, VerdictRating } from "@/types/Report";
import {
  fetchMeta, fetchDailySeries, fetchDailySeriesWithDivs, fetchFundamentalHistory, snapshotAsOf,
  fetchPeerBundles, peersAsOf, fetchShortQtyAsOf,
  closeOn, returnBetween, type AsOfSnapshot,
} from "./asof";
import { guidanceAsOf, insidersAsOf, filingForSegmentsAsOf, publishedPeriodsAsOf } from "./asofEdgar";
import {
  fetchGradeHistory, analystActionsAsOf, syntheticConsensusAsOf,
  finnhubConsensusAsOf, finnhubEarningsAsOf,
} from "./asofAnalysts";
import { finvizAsOf } from "./asofWayback";

const CUTOFFS = (process.env.CUTOFFS ?? "2025-01-17,2025-07-18").split(",").map((s) => s.trim());
const MODEL = process.env.MODEL ?? "gpt-4o-2024-11-20";
const YDELAY = Number(process.env.YDELAY_MS ?? 400);
const DRY = process.env.DRY === "1";
// SKIP_GUIDANCE=1: DRYs rápidos sin tocar SEC (la guidance as-of agrega ~3-5
// requests EDGAR por ticker×corte; secFetch cachea y el loop ya duerme YDELAY).
const SKIP_GUIDANCE = process.env.SKIP_GUIDANCE === "1";
// SKIP_PEERS=1: sin reconstrucción de peers as-of (~15-20 requests Yahoo por
// ticker; los bundles se fetchean una vez y sirven a todos los cortes).
const SKIP_PEERS = process.env.SKIP_PEERS === "1";
// SKIP_SHORT=1: sin short interest FINRA (1 request por ticker×corte).
const SKIP_SHORT = process.env.SKIP_SHORT === "1";
// SKIP_INSIDERS=1: sin Form 4 as-of (hasta ~8 requests SEC por ticker×corte).
const SKIP_INSIDERS = process.env.SKIP_INSIDERS === "1";
// SKIP_SEGMENTS=1: sin segmentos/IS EDGAR as-of (el camino SEC más pesado:
// XBRL + labels + submissions paginado por ticker×corte).
const SKIP_SEGMENTS = process.env.SKIP_SEGMENTS === "1";
// SKIP_ANALYSTS=1: sin acciones/consenso as-of (1 request Yahoo por ticker +
// Finnhub si hay FINNHUB_API_KEY).
const SKIP_ANALYSTS = process.env.SKIP_ANALYSTS === "1";
// SKIP_WAYBACK=1: sin forward/target vía snapshots de archive.org (lento la
// primera vez, ~1-3s por ticker×corte; cachea en out/wayback-cache).
const SKIP_WAYBACK = process.env.SKIP_WAYBACK === "1";
const TODAY = new Date().toISOString().slice(0, 10);

// Golden set + perfiles — espejo de scripts/smoke-sankey.mjs (MATRIX).
const GOLDEN: Array<[string, IndustryProfile | null]> = [
  ["AAL", "airline"], ["DAL", "airline"], ["UAL", "airline"], ["LUV", "airline"],
  ["ULCC", "airline"], ["ALK", "airline"], ["LTM", null],
  ["AAPL", "standard"], ["MSFT", "standard"],
  ["JPM", "bank"], ["BAC", "bank"], ["WFC", "bank"],
  ["PGR", "insurance"], ["MET", "insurance"],
  ["AMT", "reit"], ["PLD", "reit"], ["O", "reit"],
  ["BLK", "asset-manager"], ["MRNA", "biotech"], ["CVX", "oil-gas"], ["XOM", "oil-gas"],
  ["V", "services"], ["MA", "services"],
  ["CCJ", null], ["NTR", "standard"], ["SU", "oil-gas"], ["TD", "bank"], ["RY", "bank"], ["BNS", "bank"],
  ["TM", "services"], ["MUFG", "bank"], ["SMFG", "bank"], ["HDB", "bank"], ["ITUB", "bank"], ["PBR", "standard"],
  ["ASML", "standard"], ["NOK", "standard"], ["TSM", "standard"], ["BABA", "standard"], ["NIO", "standard"], ["NVO", "standard"],
];
const wanted = process.env.TICKERS?.split(",").map((s) => s.trim());
const UNIVERSE = (wanted ? GOLDEN.filter(([t]) => wanted.includes(t)) : GOLDEN)
  .slice(0, Number(process.env.SAMPLE ?? GOLDEN.length));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const plusDays = (iso: string, d: number) => new Date(Date.parse(iso) + d * 86400000).toISOString().slice(0, 10);

function seedFor(key: string): number {
  let s = 0;
  for (let i = 0; i < key.length; i++) s = ((s << 5) - s + key.charCodeAt(i)) | 0;
  return Math.abs(s);
}

const STRING_FIELDS = [
  "keyDebate", "businessModel", "revenueStreams", "profitabilityAnalysis",
  "balanceSheetHealth", "freeCashFlow", "capitalExpenditure", "capitalAllocation",
  "competitiveAdvantages", "managementQuality", "valuationSnapshot",
  "recentEarnings", "riskFactors", "catalysts", "industryContext",
] as const;

function parseReport(text: string): { report: StructuredReport | null; err: string | null } {
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    const coerced = coerceStringFields(raw, STRING_FIELDS as unknown as (keyof typeof raw)[]);
    const parsed = StructuredReportSchema.safeParse(coerced);
    if (parsed.success) return { report: parsed.data as unknown as StructuredReport, err: null };
    return { report: null, err: formatZodErrors(parsed.error) };
  } catch (e) {
    return { report: null, err: e instanceof Error ? e.message : String(e) };
  }
}

async function generateVerdict(args: {
  systemPrompt: string; userPrompt: string; seed: number;
}): Promise<{ report: StructuredReport; coherenceFlags: string[] } | { error: string }> {
  const client = getOpenAIClient();
  const base = {
    model: MODEL,
    response_format: { type: "json_object" as const },
    temperature: 0,
    seed: args.seed,
    max_tokens: 7000,
  };
  const messages = [
    { role: "system" as const, content: args.systemPrompt },
    { role: "user" as const, content: args.userPrompt },
  ];
  let text = "";
  try {
    const c = await client.chat.completions.create({ ...base, messages });
    text = c.choices[0]?.message?.content ?? "";
  } catch (e) {
    return { error: `openai: ${e instanceof Error ? e.message : e}` };
  }
  let { report, err } = parseReport(text);
  if (!report) {
    // Un retry con feedback, como producción.
    try {
      const c = await client.chat.completions.create({
        ...base,
        messages: [...messages,
          { role: "assistant" as const, content: text || "{}" },
          { role: "user" as const, content: `El output anterior falló validación:\n\n${err}\n\nRegenerá el JSON corrigiendo SÓLO los campos con error. Mismo esquema, JSON puro.` },
        ],
      });
      ({ report, err } = parseReport(c.choices[0]?.message?.content ?? ""));
    } catch { /* cae al error de abajo */ }
  }
  if (!report) return { error: `schema: ${err}` };
  return { report, coherenceFlags: [] };
}

async function main() {
  registerHomeBindings(); // verdict_log en la DB real (data/bengochea.sqlite3)
  const outDir = path.resolve(process.cwd(), "scripts/backtest/out");
  mkdirSync(outDir, { recursive: true });

  console.log(`Backtest full-LLM · ${UNIVERSE.length} tickers × ${CUTOFFS.length} cortes · modelo ${MODEL}${DRY ? " · DRY RUN" : ""}`);
  const spySeries = await fetchDailySeries("SPY");

  type Row = {
    ticker: string; cutoff: string; rating: VerdictRating; conviction: string;
    priceTarget: number | null; priceAt: number; impliedUpside: number | null;
    // Rango de escenarios del modelo — la calibración que importa tras el
    // hallazgo de que el target puntual pierde contra el baseline trivial.
    bullTarget: number | null; bearTarget: number | null;
    trend: string | null; buyConfirmed: boolean; avoidTriggered: boolean;
    fcfYieldMet: string; balanceMet: string; valuationBasis: string | null;
    granularity: string; coherenceFlags: string[];
    ret6: number | null; ret12: number | null; ex6: number | null; ex12: number | null;
  };
  const rows: Row[] = [];
  const skips: Array<{ ticker: string; cutoff: string; reason: string }> = [];
  let spent = 0;
  // DRY: condiciones del framework + disponibilidad de datos por fila, para el
  // diff pre-corrida contra el baseline (radio de explosión sin pagar OpenAI).
  const dryRows: Array<Record<string, unknown>> = [];

  for (const [ticker, profile] of UNIVERSE) {
    let meta, seriesWithDivs, fundamentals;
    try {
      [meta, seriesWithDivs, fundamentals] = await Promise.all([
        fetchMeta(ticker), fetchDailySeriesWithDivs(ticker), fetchFundamentalHistory(ticker),
      ]);
    } catch (e) {
      for (const c of CUTOFFS) skips.push({ ticker, cutoff: c, reason: `fetch: ${e instanceof Error ? e.message : e}` });
      await sleep(YDELAY);
      continue;
    }
    const { series, dividends } = seriesWithDivs;

    // Bundles de peers: una vez por ticker, sirven a todos los cortes.
    const peerBundles = SKIP_PEERS ? [] : await fetchPeerBundles(ticker, meta.industry, 300).catch(() => []);
    // Historial de upgrades/downgrades (hasta ~2012) — una vez por ticker.
    const gradeHistory = SKIP_ANALYSTS ? [] : await fetchGradeHistory(ticker);

    for (const cutoff of CUTOFFS) {
      // Fechas reales de publicación de resultados (EDGAR) — frontera de
      // frescura de los fundamentals de Yahoo. Sin EDGAR (skips) rige el
      // fallback conservador de 45 días dentro del snapshot.
      const pubPeriods =
        SKIP_SEGMENTS && SKIP_INSIDERS && SKIP_GUIDANCE
          ? undefined
          : await publishedPeriodsAsOf(ticker, cutoff);
      const snap = await snapshotAsOf({
        ticker, cutoff, meta, series, fundamentals, profile,
        publishedPeriods: pubPeriods, dividends, spySeries,
      });
      if ("skipped" in snap && snap.skipped) {
        skips.push({ ticker, cutoff, reason: snap.skipped });
        continue;
      }
      const s = snap as AsOfSnapshot;
      // Acciones de analistas + consenso as-of. El consenso oficial (Finnhub,
      // si hay key) pisa al sintético (último grade por firma, ventana 18m).
      // Con consenso, la condición (b) del framework y buyConfirmed dejan de
      // ser estructuralmente imposibles en backtest.
      if (!SKIP_ANALYSTS) {
        s.stockData.analystActions = analystActionsAsOf(gradeHistory, cutoff);
        const cons = (await finnhubConsensusAsOf(ticker, cutoff)) ?? syntheticConsensusAsOf(gradeHistory, cutoff);
        if (cons) {
          s.stockData.analystStrongBuy = cons.analystStrongBuy;
          s.stockData.analystBuy = cons.analystBuy;
          s.stockData.analystHold = cons.analystHold;
          s.stockData.analystSell = cons.analystSell;
          s.stockData.analystStrongSell = cons.analystStrongSell;
        }
        const eh = await finnhubEarningsAsOf(ticker, cutoff);
        if (eh.length > 0) s.stockData.earningsHistory = eh;
      }
      // Forward EPS / fwd P/E / target medio / ownership desde el snapshot de
      // finviz ≤ corte (Wayback). Staleness declarada; revive PEG, target base
      // y la condición de valuación excesiva.
      let finvizStaleness: number | null = null;
      if (!SKIP_WAYBACK) {
        // Cap de antigüedad: un snapshot de >120 días es peor que nada — el
        // forward P/E de SMFG@ene-2026 tenía 297 días y describía otro precio.
        const fvRaw = await finvizAsOf(ticker, cutoff);
        const fv = fvRaw && fvRaw.stalenessDays <= 120 ? fvRaw : null;
        if (fvRaw && !fv) {
          console.log(`  · ${ticker}@${cutoff}: snapshot finviz descartado por antigüedad (${fvRaw.stalenessDays}d > 120d)`);
        }
        if (fv) {
          finvizStaleness = fv.stalenessDays;
          if (fv.forwardPE != null) s.stockData.forwardPE = fv.forwardPE;
          if (fv.targetPrice != null) s.stockData.targetMeanPrice = fv.targetPrice;
          if (fv.insiderOwnPct != null) s.stockData.heldPercentInsiders = fv.insiderOwnPct / 100;
          if (fv.instOwnPct != null) s.stockData.institutionalOwnership = fv.instOwnPct / 100;
          if (fv.epsNextY != null || fv.epsNextYGrowthPct != null) {
            s.stockData.forwardEstimates = [{
              period: "+1y",
              epsEstimate: fv.epsNextY,
              revenueEstimate: null,
              growth: fv.epsNextYGrowthPct != null ? fv.epsNextYGrowthPct / 100 : null,
              revisionsUp30d: null,
              revisionsDown30d: null,
              epsTrend30dAgo: null,
              epsTrend90dAgo: null,
            }];
          }
        }
      }
      // Peers reconstruidos al corte (lista de hoy, métricas as-of).
      if (peerBundles.length > 0) {
        s.stockData.peerComparison = await peersAsOf(peerBundles, cutoff);
      }
      // Short interest FINRA publicado al corte (% vs acciones ADR-equiv).
      // Alimenta la condición (c) de AVOID junto con insiders, y el prompt.
      if (!SKIP_SHORT && s.stockData.sharesOutstanding) {
        const shortQty = await fetchShortQtyAsOf(ticker, cutoff);
        if (shortQty != null) {
          s.stockData.shortPercentOfFloat = shortQty / s.stockData.sharesOutstanding;
        }
      }
      // Insiders Form 4 con filing ≤ corte (EDGAR). Completa la condición (c)
      // de AVOID (vendedor neto discrecional + short alto) y managementQuality.
      if (!SKIP_INSIDERS) {
        s.stockData.insiderTransactions = await insidersAsOf(ticker, cutoff);
      }
      // Segmentos + IS reales vía EDGAR as-of: el último 10-Q/10-K/20-F/40-F
      // con filing date ≤ corte, parseado por el MISMO pipeline XBRL de
      // producción (filingOverride). Trae Sankey, desglose de segmentos e
      // industryProfile detectado del filing — cierra el gap de paridad más
      // grande del baseline. Si falla, cae al stub sintético del golden set
      // (sólo perfil, nunca al prompt).
      const segReal = SKIP_SEGMENTS
        ? null
        : await (async () => {
            const filing = await filingForSegmentsAsOf(ticker, cutoff);
            return filing ? await fetchSegmentData(ticker, filing) : null;
          })().catch(() => null);
      if (segReal?.endDate && segReal.endDate > cutoff) {
        throw new Error(`${ticker}@${cutoff}: segmento EDGAR con período posterior al corte (${segReal.endDate})`);
      }
      const derived = computeDerivedMetrics(s.stockData, segReal ?? s.seg, {
        seasonedListing: s.technical ? s.technical.coversFullYear : true,
      });
      // Guidance point-in-time: el Ex-99.1 del último comunicado de resultados
      // con FILING DATE ≤ corte (EDGAR es archivo histórico — cero fuga).
      // Producción la trata como evidencia forward primaria; sin esto el lado
      // BUY corría doblemente subalimentado (sin consenso NI guidance).
      const guidance = SKIP_GUIDANCE ? null : await guidanceAsOf(ticker, cutoff);
      // Rango de escenarios mecánico (cono de vol) — mismo insumo que producción
      // para que el prompt sea idéntico y el scoreboard mida el rango real.
      const scenarioRange = computeScenarioRange(s.stockData.currentPrice, s.technical?.realizedVolPct);
      const quality = computeQualityMetrics(s.stockData.qualityAnnual, derived.isFinancial);
      const { systemPrompt, userPrompt } = buildPrompt(s.stockData, segReal, derived, guidance?.text ?? null, s.technical, scenarioRange, quality, cutoff);

      // ── Asserts anti-fuga ──────────────────────────────────────────────────
      if (!userPrompt.includes(`Fecha: ${cutoff}`)) throw new Error(`${ticker}@${cutoff}: el prompt no lleva la fecha del corte`);
      if (userPrompt.includes(TODAY)) throw new Error(`${ticker}@${cutoff}: el prompt contiene la fecha real de hoy`);
      if (s.technical && s.technical.asOf > cutoff) throw new Error(`${ticker}@${cutoff}: serie técnica posterior al corte`);

      if (DRY) {
        const firms =
          s.stockData.analystStrongBuy + s.stockData.analystBuy + s.stockData.analystHold +
          s.stockData.analystSell + s.stockData.analystStrongSell;
        dryRows.push({
          ticker, cutoff,
          conditions: derived.conditions,
          valuationBasis: derived.buyValuationBasis,
          profile: derived.industryProfile,
          priceToBook: s.stockData.priceToBook,
          returnOnEquity: s.stockData.returnOnEquity,
          trailingPE: s.stockData.trailingPE,
          forwardPE: s.stockData.forwardPE,
          hasForwardEps: s.stockData.forwardEstimates.length > 0,
          finvizStaleness,
          consensus: derived.consensus,
          consensusFirms: firms,
          actions: s.stockData.analystActions.length,
          earningsQuarters: s.stockData.earningsHistory.length,
          beta: s.stockData.beta,
          dividendYield: s.stockData.dividendYield,
          shortPct: s.stockData.shortPercentOfFloat,
          insiderTxs: s.stockData.insiderTransactions.length,
          peers: s.stockData.peerComparison?.peers.length ?? 0,
          hasSegments: !!segReal,
          segPeriod: segReal?.period ?? null,
          hasGuidance: !!guidance,
          balanceAsOf: s.granularity.balanceAsOf,
          pctFromHigh: s.technical?.pctFromHigh ?? null,
          granularity: s.granularity.flows,
        });
        console.log(
          `· DRY ${cutoff} ${ticker}: precio ${s.priceAtCutoff.toFixed(2)}, flujos ${s.granularity.flows} (bal ${s.granularity.balanceAsOf ?? "—"})` +
          ` | val ${derived.conditions.buyValuation} | consenso ${derived.consensus ?? "—"} (${firms}) | fwd ${s.stockData.forwardPE != null ? "sí" : "—"}${finvizStaleness != null ? ` (${finvizStaleness}d)` : ""}` +
          ` | buyOK ${derived.conditions.buyConfirmed ? "SÍ" : "no"} | seg ${segReal ? "sí" : "no"} | guía ${guidance ? "sí" : "no"} | short ${s.stockData.shortPercentOfFloat != null ? (s.stockData.shortPercentOfFloat * 100).toFixed(1) + "%" : "—"} | ins ${s.stockData.insiderTransactions.length} | peers ${s.stockData.peerComparison?.peers.length ?? 0}`,
        );
        if (process.env.DUMP_PROMPT) {
          writeFileSync(path.join(outDir, `prompt-${ticker}-${cutoff}.txt`), userPrompt);
        }
        continue;
      }

      const gen = await generateVerdict({ systemPrompt, userPrompt, seed: seedFor(`${ticker}|${cutoff}`) });
      if ("error" in gen) {
        skips.push({ ticker, cutoff, reason: gen.error });
        continue;
      }
      let { report } = gen;
      const coherenceFlags: string[] = [];
      const coh = checkVerdictCoherence(report.verdict.rating, derived.conditions);
      if (!coh.coherent) {
        coherenceFlags.push(coh.code!);
        const fix = await generateVerdict({
          systemPrompt,
          userPrompt: `${userPrompt}\n\n[CORRECCIÓN] ${coh.reason}`,
          seed: seedFor(`${ticker}|${cutoff}|fix`),
        });
        if (!("error" in fix)) {
          const coh2 = checkVerdictCoherence(fix.report.verdict.rating, derived.conditions);
          report = fix.report;
          coherenceFlags.push(coh2.coherent ? "verdict_repaired" : "verdict_incoherent_final");
        } else {
          coherenceFlags.push("verdict_incoherent_final");
        }
      }
      spent += 0.055 * (coherenceFlags.length > 0 ? 2 : 1); // estimación para el log

      // Disciplina de conviction — mismo cap determinístico que producción.
      const disc = enforceConvictionDiscipline(
        report.verdict.rating, report.verdict.conviction, derived.conditions, s.technical,
        derived.buyValuationSpeculative, derived.shortPct, derived.revisionsNetDown,
      );
      if (disc.flags.length > 0) {
        report.verdict.conviction = disc.conviction;
        coherenceFlags.push(...disc.flags);
      }

      // Rango de escenarios mecánico: sobrescribí bull/bear con el cono para que
      // el scoreboard de cobertura mida el rango real (producción lo hace vía
      // clampReportPriceTargets; acá basta con los límites, el target base ya
      // cae dentro del cono ancho).
      if (scenarioRange) {
        const b = scenarioBounds(scenarioRange);
        if (report.bullCase) report.bullCase.priceTarget = b.bull;
        if (report.bearCase) report.bearCase.priceTarget = b.bear;
      }

      // verdict_log: fila discriminada por source (nunca contamina el live).
      const vRow = buildVerdictLogRow({
        ticker, report, stockData: s.stockData, derived, technical: s.technical,
        scenarioRange, quality, coherenceFlags, model: MODEL, source: `backtest:${cutoff}`,
      });
      vRow.ts = Date.parse(cutoff); // el "momento del veredicto" es el corte
      await recordVerdictLog(vRow);

      const parsePt = (v: string | null | undefined): number | null => {
        const n = parseFloat(v ?? "");
        return Number.isFinite(n) && n > 0 ? n : null;
      };
      const priceTarget = parsePt(report.verdict.priceTarget);
      const bullTarget = parsePt(report.bullCase?.priceTarget);
      const bearTarget = parsePt(report.bearCase?.priceTarget);
      const h6 = plusDays(cutoff, 182);
      const h12 = plusDays(cutoff, 365);
      const ret6 = h6 <= TODAY ? returnBetween(series, cutoff, h6) : null;
      const ret12 = h12 <= TODAY ? returnBetween(series, cutoff, h12) : null;
      const spy6 = h6 <= TODAY ? returnBetween(spySeries, cutoff, h6) : null;
      const spy12 = h12 <= TODAY ? returnBetween(spySeries, cutoff, h12) : null;

      const row: Row = {
        ticker, cutoff,
        rating: report.verdict.rating, conviction: report.verdict.conviction,
        priceTarget, priceAt: s.priceAtCutoff,
        impliedUpside: priceTarget != null ? priceTarget / s.priceAtCutoff - 1 : null,
        bullTarget, bearTarget,
        trend: s.technical?.trend ?? null,
        buyConfirmed: derived.conditions.buyConfirmed,
        avoidTriggered: derived.conditions.avoidTriggered,
        fcfYieldMet: derived.conditions.buyValuation,
        balanceMet: derived.conditions.buyBalance,
        valuationBasis: derived.buyValuationBasis,
        granularity: s.granularity.flows,
        coherenceFlags,
        ret6, ret12,
        ex6: ret6 != null && spy6 != null ? ret6 - spy6 : null,
        ex12: ret12 != null && spy12 != null ? ret12 - spy12 : null,
      };
      rows.push(row);
      const fmt = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
      console.log(`✓ ${cutoff} ${ticker}: ${row.rating}/${row.conviction} impl ${fmt(row.impliedUpside)} | 12m ${fmt(ret12)} (exceso ${fmt(row.ex12)}) | trend ${row.trend ?? "—"}${coherenceFlags.length ? ` [${coherenceFlags.join(",")}]` : ""}`);
    }
    await sleep(YDELAY);
  }

  if (DRY) {
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
    const dryPath = path.join(outDir, `dry-conditions-${stamp}.json`);
    writeFileSync(dryPath, JSON.stringify({ cutoffs: CUTOFFS, rows: dryRows, skips }, null, 2));
    console.log(`\nDRY RUN ok. Condiciones → ${dryPath}`);
    return;
  }

  // ── Scoreboard ──────────────────────────────────────────────────────────────
  const median = (v: number[]) => {
    if (!v.length) return null;
    const s = [...v].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
  const pctf = (v: number | null) => (v == null ? "   —  " : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`.padStart(6));

  const L: string[] = [];
  const say = (s: string) => { L.push(s); console.log(s); };
  const cohort = (label: string, rs: Row[]) => {
    const e6 = rs.map((r) => r.ex6).filter((v): v is number => v != null);
    const e12 = rs.map((r) => r.ex12).filter((v): v is number => v != null);
    say(`  ${label.padEnd(22)} n=${String(rs.length).padStart(3)} | exceso 6m med ${pctf(median(e6))} avg ${pctf(mean(e6))} | 12m med ${pctf(median(e12))} avg ${pctf(mean(e12))}`);
  };

  say(`\n═══ Backtest full-LLM · ${MODEL} · cortes ${CUTOFFS.join(", ")} · ${rows.length} veredictos (${skips.length} skips) ═══`);
  say(`Exceso = retorno total ajustado del ticker − SPY, mismo período.`);
  say(`HORIZONTE PRIMARIO: 6 meses (la ventaja del veredicto se concentra ahí; 12m secundario).\n`);
  say(`── Por rating (la pregunta central: ¿BUY > HOLD > AVOID?) ──`);
  for (const r of ["BUY", "HOLD", "AVOID"] as const) cohort(r, rows.filter((x) => x.rating === r));
  say(`\n── Por conviction dentro de BUY ──`);
  for (const c of ["HIGH", "MEDIUM", "LOW"]) cohort(`BUY·${c}`, rows.filter((x) => x.rating === "BUY" && x.conviction === c));
  say(`\n── Por tendencia técnica al corte ──`);
  for (const t of ["alcista", "mixta", "bajista"]) cohort(t, rows.filter((x) => x.trend === t));
  say(`\n── Interacción rating × tendencia ──`);
  for (const r of ["BUY", "AVOID"] as const) {
    for (const t of ["alcista", "bajista"]) cohort(`${r} + ${t}`, rows.filter((x) => x.rating === r && x.trend === t));
  }
  say(`\n── Condiciones del framework (determinables as-of) ──`);
  cohort("valuación CUMPLE", rows.filter((x) => x.fcfYieldMet === "met"));
  cohort("valuación NO CUMPLE", rows.filter((x) => x.fcfYieldMet === "not_met"));
  cohort("AVOID disparado", rows.filter((x) => x.avoidTriggered));

  // Targets — el puntual se reporta con su baseline trivial al lado (en 2025
  // "siempre sube" le ganaba: 79% vs 65%), y la métrica que importa es la
  // CALIBRACIÓN DEL RANGO bull–bear: ¿el retorno realizado cayó adentro?
  for (const [label, key] of [["6m", "ret6"], ["12m", "ret12"]] as const) {
    const tgt = rows.filter((r) => r.impliedUpside != null && r[key] != null);
    if (!tgt.length) continue;
    const mae = mean(tgt.map((r) => Math.abs((r.impliedUpside as number) - (r[key] as number))));
    const dirOk = tgt.filter((r) => Math.sign(r.impliedUpside as number) === Math.sign(r[key] as number)).length;
    const upBase = tgt.filter((r) => (r[key] as number) > 0).length;
    say(`\n── Target puntual ${label} (n=${tgt.length}) ── MAE ${pctf(mae)} | dirección ${((dirOk / tgt.length) * 100).toFixed(0)}% (baseline "siempre sube": ${((upBase / tgt.length) * 100).toFixed(0)}%)`);
    const rng = rows.filter((r) => r.bullTarget != null && r.bearTarget != null && r[key] != null && r.priceAt > 0);
    if (rng.length) {
      const inside = rng.filter((r) => {
        const ret = r[key] as number;
        const lo = (r.bearTarget as number) / r.priceAt - 1;
        const hi = (r.bullTarget as number) / r.priceAt - 1;
        return ret >= lo && ret <= hi;
      }).length;
      say(`   Rango bull–bear ${label} (n=${rng.length}): realizado DENTRO del rango ${((inside / rng.length) * 100).toFixed(0)}%`);
    }
  }

  const capped = rows.filter((r) => r.coherenceFlags.some((f) => f.startsWith("conviction_capped")));
  if (capped.length) {
    say(`\n── Disciplina de conviction ── caps aplicados en ${capped.length} veredictos: ${capped.map((r) => `${r.ticker}@${r.cutoff.slice(5)}`).join(", ")}`);
  }
  if (skips.length) {
    say(`\n── Skips ──`);
    for (const s of skips) say(`  ${s.cutoff} ${s.ticker}: ${s.reason}`);
  }
  say(`\nGasto OpenAI estimado de la corrida: ~US$${spent.toFixed(2)}`);

  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  const jsonPath = path.join(outDir, `backtest-${stamp}.json`);
  writeFileSync(jsonPath, JSON.stringify({ model: MODEL, cutoffs: CUTOFFS, rows, skips }, null, 2));
  writeFileSync(path.join(outDir, `backtest-${stamp}.md`), L.join("\n"));
  console.log(`\nResultados → ${jsonPath}`);
}

void main();
