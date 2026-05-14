import { z } from "zod";

const TICKER_RE = /^[A-Z0-9.\-]+$/;
const TICKER_MAX = 10;

// Single source of truth for ticker validation. Use this from any route or
// helper that takes a user-supplied symbol — keeps the allowed alphabet from
// drifting between endpoints.
export function isValidTicker(s: unknown): s is string {
  return typeof s === "string" && s.length >= 1 && s.length <= TICKER_MAX && TICKER_RE.test(s.toUpperCase());
}

// Returns the normalized (uppercased) ticker, or null if it doesn't validate.
export function normalizeTicker(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim().toUpperCase();
  return t.length >= 1 && t.length <= TICKER_MAX && TICKER_RE.test(t) ? t : null;
}

export const AnalyzeRequestSchema = z.object({
  ticker: z
    .string()
    .min(1)
    .max(TICKER_MAX)
    .regex(/^[A-Z0-9.\-]+$/i, "Invalid ticker symbol")
    .transform((v) => v.toUpperCase()),
  refresh: z.boolean().optional().default(false),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

