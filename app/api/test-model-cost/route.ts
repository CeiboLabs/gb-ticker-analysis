import { NextRequest, NextResponse } from "next/server";
import { fetchStockData } from "@/lib/fetchStockData";
import { fetchSegmentData } from "@/lib/fetchSegmentData";
import { fetchEdgarGuidance } from "@/lib/fetchEdgar8K";
import { fetchChartRange } from "@/lib/fetchChartRange";
import { computeTechnicalContext } from "@/lib/technicalContext";
import { computeScenarioRange } from "@/lib/scenarioRange";
import { computeQualityMetrics } from "@/lib/qualityMetrics";
import { buildPrompt } from "@/lib/buildPrompt";
import { computeDerivedMetrics, checkVerdictCoherence, type DerivedMetrics } from "@/lib/derivedMetrics";
import { StructuredReportSchema, coerceStringFields } from "@/lib/analysisSchemas";
import { getOpenAIClient } from "@/lib/openai";
import { requireAdminToken } from "@/lib/adminAuth";
import { normalizeTicker } from "@/lib/validators";
import type { VerdictRating } from "@/types/Report";

export const dynamic = "force-dynamic";
// Harness admin-only en el home server (sin ceiling de isolate de 60s): los
// modelos con reasoning pueden tardar 1-3 min generando el reporte completo.
export const maxDuration = 300;

// Harness de eval de modelos (P6). Además de costo/latencia, puntúa CALIDAD
// del output por modelo con el MISMO prompt que producción (derived +
// guidance + contexto técnico):
//   - schema_ok: valida contra StructuredReportSchema completo (no sólo JSON.parse)
//   - coherent: el rating no contradice el framework pre-evaluado en código
//   - cites_*: el texto cita las cifras autoritativas (PEG, FCF yield, target base)
//   - target_anchored: verdict.priceTarget dentro de ±20% del target base
// Sin retries ni clamps deliberadamente: acá se mide el comportamiento CRUDO
// de cada modelo; producción después le suma sus redes de seguridad.

// USD per 1M tokens. Reasoning tokens are billed as output.
const PRICING: Record<string, { in: number; out: number }> = {
  "gpt-4o-2024-11-20": { in: 2.5, out: 10 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-5": { in: 1.25, out: 10 },
  "gpt-5-mini": { in: 0.25, out: 2 },
  "o3": { in: 2, out: 8 },
  "o3-mini": { in: 1.1, out: 4.4 },
};

function isReasoningModel(model: string): boolean {
  return /^(o\d|gpt-5)/.test(model);
}

type Usage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  completion_tokens_details?: { reasoning_tokens?: number };
};

const STRING_FIELDS = [
  "keyDebate",
  "businessModel", "revenueStreams", "profitabilityAnalysis",
  "balanceSheetHealth", "freeCashFlow", "capitalExpenditure", "capitalAllocation",
  "competitiveAdvantages", "managementQuality", "valuationSnapshot",
  "recentEarnings", "riskFactors", "catalysts", "industryContext",
] as const;

// ¿El texto cita la cifra? Busca el número formateado como lo entrega
// fmtDerivedMetrics (mismo redondeo); match por substring — suficiente para
// distinguir "citó el valor provisto" de "recalculó otro".
function cites(text: string, formatted: string | null): boolean | null {
  if (formatted == null) return null;
  return text.includes(formatted);
}

async function callModel(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  derived: DerivedMetrics,
) {
  const reasoning = isReasoningModel(model);
  const baseParams = {
    model,
    response_format: { type: "json_object" as const },
    messages: [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userPrompt },
    ],
  };
  const params = reasoning
    ? { ...baseParams, max_completion_tokens: 12000 }
    : { ...baseParams, max_tokens: 7000, temperature: 0 };

  const t0 = Date.now();
  try {
    // El cliente compartido trae timeout 55s (calibrado para gpt-4o en el path
    // de producción); los reasoning models lo exceden generando 7-12k tokens —
    // en el smoke inicial gpt-5-mini timeouteó 2/2. Override per-request.
    const completion = await getOpenAIClient().chat.completions.create(
      params,
      reasoning ? { timeout: 240_000 } : undefined,
    );
    const dt = Date.now() - t0;

    const usage = (completion.usage ?? {}) as Usage;
    const inTok = usage.prompt_tokens ?? 0;
    const outTok = usage.completion_tokens ?? 0;
    const reasoningTok = usage.completion_tokens_details?.reasoning_tokens ?? 0;

    const price = PRICING[model] ?? { in: 0, out: 0 };
    const costUsd = (inTok * price.in + outTok * price.out) / 1_000_000;

    const text = completion.choices[0]?.message?.content ?? "";
    let parseOk = false;
    let parseErr: string | null = null;
    let schemaOk = false;
    let schemaErr: string | null = null;
    let rating: string | null = null;
    let conviction: string | null = null;
    let priceTarget: number | null = null;
    let bullTarget: string | null = null;
    let bearTarget: string | null = null;
    try {
      const raw = JSON.parse(text) as Record<string, unknown>;
      parseOk = true;
      const coerced = coerceStringFields(raw, STRING_FIELDS as unknown as (keyof typeof raw)[]);
      const parsed = StructuredReportSchema.safeParse(coerced);
      if (parsed.success) {
        schemaOk = true;
        const rep = parsed.data as {
          verdict: { rating: string; conviction: string; priceTarget: string };
          bullCase: { priceTarget: string };
          bearCase: { priceTarget: string };
        };
        rating = rep.verdict.rating;
        conviction = rep.verdict.conviction;
        const pt = parseFloat(rep.verdict.priceTarget);
        priceTarget = Number.isFinite(pt) && pt > 0 ? pt : null;
        bullTarget = rep.bullCase.priceTarget;
        bearTarget = rep.bearCase.priceTarget;
      } else {
        schemaErr = parsed.error.issues
          .slice(0, 4)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(" | ")
          .slice(0, 300);
        // Rescate para métricas de coherencia aunque el schema falle.
        const v = raw.verdict as { rating?: string } | undefined;
        rating = typeof v?.rating === "string" ? v.rating : null;
      }
    } catch (e) {
      parseErr = e instanceof Error ? e.message : String(e);
    }

    // Coherencia con el framework pre-evaluado (sólo con rating reconocible).
    let coherent: boolean | null = null;
    let coherenceCode: string | null = null;
    if (rating === "BUY" || rating === "HOLD" || rating === "AVOID") {
      const coh = checkVerdictCoherence(rating as VerdictRating, derived.conditions);
      coherent = coh.coherent;
      coherenceCode = coh.code;
    }

    // Fidelidad de citas: mismas cadenas que inyecta fmtDerivedMetrics.
    const citesPeg = cites(text, derived.peg != null ? derived.peg.toFixed(2) : null);
    const citesFcf = cites(
      text,
      derived.fcfYield != null ? (derived.fcfYield * 100).toFixed(1) : null,
    );
    const citesTarget = cites(
      text,
      derived.baseTargetForwardPE != null ? derived.baseTargetForwardPE.toFixed(2) : null,
    );
    const targetAnchored =
      priceTarget != null && derived.baseTargetForwardPE != null
        ? Math.abs(priceTarget / derived.baseTargetForwardPE - 1) <= 0.2
        : null;

    return {
      model,
      pricing: price,
      usage: {
        input_tokens: inTok,
        output_tokens: outTok,
        reasoning_tokens: reasoningTok,
        visible_output_tokens: Math.max(0, outTok - reasoningTok),
        total_tokens: usage.total_tokens ?? 0,
      },
      cost_usd: Number(costUsd.toFixed(6)),
      api_ms: dt,
      parse_ok: parseOk,
      parse_err: parseErr,
      schema_ok: schemaOk,
      schema_err: schemaErr,
      coherent,
      coherence_code: coherenceCode,
      cites_peg: citesPeg,
      cites_fcf_yield: citesFcf,
      cites_base_target: citesTarget,
      target_anchored: targetAnchored,
      verdict_rating: rating,
      verdict_conviction: conviction,
      price_target: priceTarget,
      bull_target: bullTarget,
      bear_target: bearTarget,
      output_length_chars: text.length,
      finish_reason: completion.choices[0]?.finish_reason ?? null,
    };
  } catch (e) {
    return {
      model,
      error: "openai_error",
      msg: e instanceof Error ? e.message : String(e),
      api_ms: Date.now() - t0,
    };
  }
}

export async function GET(req: NextRequest) {
  // Admin-only: this endpoint calls OpenAI directly, billing the project's API
  // key. Public access would let anyone burn arbitrary amounts of credit by
  // probing different tickers/models.
  const denied = await requireAdminToken(req);
  if (denied) return denied;

  const ticker = normalizeTicker(req.nextUrl.searchParams.get("ticker"));
  if (!ticker) return NextResponse.json({ error: "invalid ticker" }, { status: 400 });

  // Accept comma-separated list so we fetch SEC/Yahoo data ONCE and reuse it
  // across all models — avoids hammering EDGAR (10 req/s rate limit). Only
  // models in PRICING are accepted; anything else is rejected to prevent
  // someone passing arbitrary expensive models.
  const modelsParam = req.nextUrl.searchParams.get("models") ?? "gpt-5";
  const requested = modelsParam.split(",").map((s) => s.trim()).filter(Boolean);
  const models = requested.filter((m) => m in PRICING);
  if (models.length === 0) {
    return NextResponse.json(
      { error: "no recognized model", allowed: Object.keys(PRICING) },
      { status: 400 },
    );
  }

  const t0 = Date.now();
  // Mismos insumos que producción (route /api/analyze): sin guidance/técnico el
  // eval mediría un prompt que ya no existe.
  const [stockData, segmentData, guidance, technical] = await Promise.all([
    fetchStockData(ticker),
    fetchSegmentData(ticker).catch(() => null),
    fetchEdgarGuidance(ticker).then((r) => r, () => null),
    fetchChartRange(ticker, "1Y").then((r) => computeTechnicalContext(r.prices)).catch(() => null),
  ]);
  if (!stockData) {
    return NextResponse.json({ error: "stockData not found" }, { status: 404 });
  }
  const derived = computeDerivedMetrics(stockData, segmentData);
  const scenarioRange = computeScenarioRange(stockData.currentPrice, technical?.realizedVolPct);
  const quality = computeQualityMetrics(stockData.qualityAnnual, derived.isFinancial);
  const { systemPrompt, userPrompt } = buildPrompt(stockData, segmentData, derived, guidance?.text ?? null, technical, scenarioRange, quality);
  const dataFetchMs = Date.now() - t0;

  // Run model calls in parallel — they don't share state and OpenAI handles
  // concurrency fine. The slow path is now only OpenAI, not data fetch.
  const results = await Promise.all(models.map((m) => callModel(m, systemPrompt, userPrompt, derived)));

  return NextResponse.json({
    ticker,
    data_fetch_ms: dataFetchMs,
    has_segment_data: segmentData != null,
    has_guidance: guidance != null,
    has_technical: technical != null,
    base_target: derived.baseTargetForwardPE,
    base_target_method: derived.baseTargetMethod,
    buy_confirmed: derived.conditions.buyConfirmed,
    avoid_triggered: derived.conditions.avoidTriggered,
    results,
  });
}
