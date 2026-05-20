import { z } from "zod";
import type { StockData } from "@/types/StockData";
import type { StructuredReport } from "@/types/Report";

/* ──────────────────────────────────────────────────────────────────────────
   Zod schemas for each pipeline call. Strict validation guards against:
   - Empty / placeholder strings (min character thresholds)
   - Model returning object where markdown string expected
   - Verdict ratings outside the allowed set
   - Price targets in wrong format
   ────────────────────────────────────────────────────────────────────────── */

// Minimum character counts are tuned to current section depth. If GPT-4o
// returns "N/A — no data available", that's ~25 chars; reject. If it returns
// a full paragraph, that's 400+. Threshold of 200 lets short-but-substantive
// sections through (when data really is sparse) while catching empty filler.
const MIN_SUBSTANCE = 200;
const MIN_LIST = 120;

export const BusinessSchema = z.object({
  businessModel: z.string().min(MIN_SUBSTANCE),
  revenueStreams: z.string().min(MIN_SUBSTANCE),
  competitiveAdvantages: z.string().min(MIN_LIST), // markdown list
  industryContext: z.string().min(MIN_SUBSTANCE),
});

export const FinancialsSchema = z.object({
  profitabilityAnalysis: z.string().min(MIN_SUBSTANCE),
  balanceSheetHealth: z.string().min(MIN_LIST),
  freeCashFlow: z.string().min(MIN_LIST),
  capitalExpenditure: z.string().min(MIN_SUBSTANCE),
});

export const MarketSchema = z.object({
  valuationSnapshot: z.string().min(MIN_SUBSTANCE),
  recentEarnings: z.string().min(MIN_SUBSTANCE),
  managementQuality: z.string().min(MIN_SUBSTANCE),
});

export const ForwardSchema = z.object({
  riskFactors: z.string().min(MIN_LIST),
  catalysts: z.string().min(MIN_LIST),
});

const PriceTargetSchema = z.string().regex(/^\d+(\.\d{1,2})?$/, {
  message: "priceTarget must be a number like '215' or '215.50' — no currency symbol",
});

export const SynthesisSchema = z.object({
  scratchpad: z.object({
    fcfYield: z.string().min(20),
    peg: z.string().min(20),
    consensus: z.string().min(20),
    balance: z.string().min(20),
    insiders: z.string().min(15),
    verdictReasoning: z.string().min(60),
  }),
  verdict: z.object({
    rating: z.enum(["BUY", "HOLD", "AVOID"]),
    conviction: z.enum(["HIGH", "MEDIUM", "LOW"]),
    rationale: z.string().min(180),
  }),
  bullCase: z.object({
    narrative: z.string().min(MIN_SUBSTANCE),
    priceTarget: PriceTargetSchema,
  }),
  bearCase: z.object({
    narrative: z.string().min(MIN_SUBSTANCE),
    priceTarget: PriceTargetSchema,
  }),
});

export type BusinessOutput = z.infer<typeof BusinessSchema>;
export type FinancialsOutput = z.infer<typeof FinancialsSchema>;
export type MarketOutput = z.infer<typeof MarketSchema>;
export type ForwardOutput = z.infer<typeof ForwardSchema>;
export type SynthesisOutput = z.infer<typeof SynthesisSchema>;

/* ──────────────────────────────────────────────────────────────────────────
   Helper to format Zod errors back to the model so it can self-correct on retry.
   ────────────────────────────────────────────────────────────────────────── */

export function formatZodErrors(err: z.ZodError): string {
  return err.issues
    .map((issue) => {
      const path = issue.path.join(".") || "(root)";
      return `- ${path}: ${issue.message}`;
    })
    .join("\n");
}

/* ──────────────────────────────────────────────────────────────────────────
   Coerce object-returned-as-string-expected fields. GPT-4o sometimes emits
   `{"score": 8, "reason": "..."}` where we asked for markdown. Flatten to
   readable string before validating.
   ────────────────────────────────────────────────────────────────────────── */

export function coerceStringFields<T extends Record<string, unknown>>(
  raw: T,
  stringKeys: (keyof T)[],
): T {
  const out = { ...raw };
  for (const k of stringKeys) {
    if (typeof out[k] !== "string") {
      out[k] = serializeToMarkdown(out[k]) as T[typeof k];
    }
  }
  return out;
}

function serializeToMarkdown(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    return v.map((item) => `- ${serializeInline(item)}`).join("\n");
  }
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `- **${humanize(k)}:** ${serializeInline(val)}`)
      .join("\n");
  }
  return String(v);
}

function serializeInline(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(serializeInline).join(", ");
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${humanize(k)}: ${serializeInline(val)}`)
      .join(" · ");
  }
  return String(v);
}

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/* ──────────────────────────────────────────────────────────────────────────
   Full-report schema for the single-call architecture. Thresholds are
   slightly relaxed vs the per-call specialists because the single-call
   pipeline allocates ~290 tokens/section vs ~900 in multi-step.
   ────────────────────────────────────────────────────────────────────────── */

const NARRATIVE_MIN = 150;     // 1 substantive paragraph
const LIST_MIN = 100;          // markdown list with 3+ items

const PROBABILITY_REGEX = /^([0-9]|[1-9][0-9]|100)$/;

export const StructuredReportSchema = z.object({
  keyDebate: z.string().min(NARRATIVE_MIN),
  businessModel: z.string().min(NARRATIVE_MIN),
  revenueStreams: z.string().min(NARRATIVE_MIN),
  profitabilityAnalysis: z.string().min(NARRATIVE_MIN),
  balanceSheetHealth: z.string().min(LIST_MIN),
  freeCashFlow: z.string().min(LIST_MIN),
  capitalExpenditure: z.string().min(NARRATIVE_MIN),
  capitalAllocation: z.string().min(NARRATIVE_MIN),
  competitiveAdvantages: z.string().min(LIST_MIN),
  managementQuality: z.string().min(NARRATIVE_MIN),
  valuationSnapshot: z.string().min(NARRATIVE_MIN),
  recentEarnings: z.string().min(NARRATIVE_MIN),
  riskFactors: z.string().min(LIST_MIN),
  catalysts: z.string().min(LIST_MIN),
  industryContext: z.string().min(NARRATIVE_MIN),
  bullCase: z.object({
    narrative: z.string().min(NARRATIVE_MIN),
    priceTarget: z.string().regex(/^\d+(\.\d{1,2})?$/, {
      message: "priceTarget must be a number like '215' or '215.50'",
    }),
    probability: z.string().regex(PROBABILITY_REGEX, {
      message: "probability must be an integer 0-100 as string, e.g. '30'",
    }),
  }),
  bearCase: z.object({
    narrative: z.string().min(NARRATIVE_MIN),
    priceTarget: z.string().regex(/^\d+(\.\d{1,2})?$/, {
      message: "priceTarget must be a number like '215' or '215.50'",
    }),
    probability: z.string().regex(PROBABILITY_REGEX, {
      message: "probability must be an integer 0-100 as string, e.g. '20'",
    }),
  }),
  verdict: z.object({
    rating: z.enum(["BUY", "HOLD", "AVOID"]),
    conviction: z.enum(["HIGH", "MEDIUM", "LOW"]),
    rationale: z.string().min(700),
    priceTarget: z.string().regex(/^\d+(\.\d{1,2})?$/, {
      message: "verdict.priceTarget must be a number like '215' or '215.50'",
    }),
    sizing: z.string().min(60),
  }),
}).refine((r) => {
  const b = parseInt(r.bullCase.probability, 10);
  const x = parseInt(r.bearCase.probability, 10);
  return Number.isFinite(b) && Number.isFinite(x) && (b + x) <= 95 && (b + x) >= 5;
}, {
  message: "bullCase.probability + bearCase.probability must be between 5 and 95 (leaving room for the base case)",
  path: ["bullCase", "probability"],
});

/* ──────────────────────────────────────────────────────────────────────────
   Price target clamp: prevents the model from emitting bull/bear targets
   wildly out of line with analyst coverage. Allow up to 30% beyond analyst
   high/low; beyond that, snap to bounds.
   ────────────────────────────────────────────────────────────────────────── */

export function clampReportPriceTargets(report: StructuredReport, d: StockData): StructuredReport {
  const low = d.targetLowPrice;
  const high = d.targetHighPrice;
  const price = d.currentPrice ?? null;

  const bull = report.bullCase;
  const bear = report.bearCase;
  const verdict = report.verdict;
  if (!bull || !bear || !verdict) return report;

  const bullNum = parseFloat(bull.priceTarget);
  const bearNum = parseFloat(bear.priceTarget);
  const baseNum = parseFloat(verdict.priceTarget ?? "");

  if (!isFinite(bullNum) || !isFinite(bearNum)) return report;

  let bullClamped = bullNum;
  let bearClamped = bearNum;
  let baseClamped = baseNum;

  // Clamp against analyst range when available (±30%).
  if (low != null && high != null) {
    const bullMax = high * 1.3;
    const bearMin = low * 0.7;
    if (bullNum > bullMax) bullClamped = bullMax;
    if (bullNum < bearMin) bullClamped = high; // bull below bear floor → snap to analyst high
    if (bearNum < bearMin) bearClamped = bearMin;
    if (bearNum > bullMax) bearClamped = low;  // bear above bull ceiling → snap to analyst low
    if (isFinite(baseNum)) {
      if (baseNum > bullMax) baseClamped = bullMax;
      if (baseNum < bearMin) baseClamped = bearMin;
    }
  }

  // Enforce bear < base < bull. If the model emitted base outside its own
  // bull/bear range, snap to the midpoint so the hero stays internally
  // consistent with the scenarios it just wrote.
  if (isFinite(baseClamped)) {
    if (baseClamped >= bullClamped) baseClamped = (bullClamped + bearClamped) / 2;
    if (baseClamped <= bearClamped) baseClamped = (bullClamped + bearClamped) / 2;
  } else if (isFinite(bullClamped) && isFinite(bearClamped)) {
    // No model target at all — fall back to midpoint between bull/bear so the
    // hero has something to display.
    baseClamped = (bullClamped + bearClamped) / 2;
  }

  // Coherencia veredicto ↔ target casa. El veredicto se decide por framework
  // cuantitativo (FCF yield, balance, short interest...) y los escenarios
  // bull/bear se construyen alrededor del consenso de analistas — los dos
  // tracks pueden divergir y producir un AVOID con target muy por encima del
  // precio (o un BUY con target debajo). En el hero leemos "AVOID · upside
  // +297%", incoherente. Snap del verdict.priceTarget al lado correcto del
  // precio actual para que la dirección del target case con el rating.
  if (price != null && price > 0 && isFinite(baseClamped)) {
    const rating = verdict.rating;
    const upCeiling = price * 0.95;   // techo para AVOID
    const downFloor = price * 1.05;   // piso para BUY
    const holdLow = price * 0.90;
    const holdHigh = price * 1.10;

    if (rating === "AVOID" && baseClamped > upCeiling) {
      // Preferí el bear target si ya está debajo del techo; si no, snap al 95% del precio.
      baseClamped = isFinite(bearClamped) && bearClamped < upCeiling ? bearClamped : upCeiling;
    } else if (rating === "BUY" && baseClamped < downFloor) {
      // Preferí el bull target si ya supera el piso; si no, snap al 105% del precio.
      baseClamped = isFinite(bullClamped) && bullClamped > downFloor ? bullClamped : downFloor;
    } else if (rating === "HOLD") {
      if (baseClamped > holdHigh) baseClamped = holdHigh;
      else if (baseClamped < holdLow) baseClamped = holdLow;
    }
  }

  const changed =
    bullClamped !== bullNum ||
    bearClamped !== bearNum ||
    (isFinite(baseClamped) && baseClamped !== baseNum);

  if (!changed) return report;

  return {
    ...report,
    bullCase: { ...bull, priceTarget: bullClamped.toFixed(2) },
    bearCase: { ...bear, priceTarget: bearClamped.toFixed(2) },
    verdict: {
      ...verdict,
      priceTarget: isFinite(baseClamped) ? baseClamped.toFixed(2) : verdict.priceTarget,
    },
  };
}
