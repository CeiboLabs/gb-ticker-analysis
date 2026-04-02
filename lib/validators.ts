import { z } from "zod";

export const AnalyzeRequestSchema = z.object({
  ticker: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[A-Z0-9.\-\^]+$/i, "Invalid ticker symbol")
    .transform((v) => v.toUpperCase()),
  refresh: z.boolean().optional().default(false),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

