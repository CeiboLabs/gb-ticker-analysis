import { NextRequest, NextResponse } from "next/server";
import { fetchStockData } from "@/lib/fetchStockData";
import { fetchSegmentData } from "@/lib/fetchSegmentData";
import { buildPrompt } from "@/lib/buildPrompt";
import { getOpenAIClient } from "@/lib/openai";
import { requireAdminToken } from "@/lib/adminAuth";
import { normalizeTicker } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

async function callModel(model: string, systemPrompt: string, userPrompt: string) {
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
    : { ...baseParams, max_tokens: 4500, temperature: 0 };

  const t0 = Date.now();
  try {
    const completion = await getOpenAIClient().chat.completions.create(params);
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
    let verdict: { rating?: string; conviction?: string; rationale?: string } | null = null;
    let bullTarget: number | null = null;
    let bearTarget: number | null = null;
    try {
      const parsed = JSON.parse(text) as {
        verdict?: { rating?: string; conviction?: string; rationale?: string };
        bullCase?: { priceTarget?: number };
        bearCase?: { priceTarget?: number };
      };
      parseOk = true;
      verdict = parsed.verdict ?? null;
      bullTarget = parsed.bullCase?.priceTarget ?? null;
      bearTarget = parsed.bearCase?.priceTarget ?? null;
    } catch (e) {
      parseErr = e instanceof Error ? e.message : String(e);
    }

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
      verdict_rating: verdict?.rating ?? null,
      verdict_conviction: verdict?.conviction ?? null,
      verdict_rationale: verdict?.rationale ?? null,
      bull_target: bullTarget,
      bear_target: bearTarget,
      output_preview: text.slice(0, 400),
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
  const [stockData, segmentData] = await Promise.all([
    fetchStockData(ticker),
    fetchSegmentData(ticker).catch(() => null),
  ]);
  if (!stockData) {
    return NextResponse.json({ error: "stockData not found" }, { status: 404 });
  }
  const { systemPrompt, userPrompt } = buildPrompt(stockData, segmentData);
  const dataFetchMs = Date.now() - t0;

  // Run model calls in parallel — they don't share state and OpenAI handles
  // concurrency fine. The slow path is now only OpenAI, not data fetch.
  const results = await Promise.all(models.map((m) => callModel(m, systemPrompt, userPrompt)));

  return NextResponse.json({
    ticker,
    data_fetch_ms: dataFetchMs,
    has_segment_data: segmentData != null,
    results,
  });
}
