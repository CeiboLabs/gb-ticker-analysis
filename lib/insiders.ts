import type { InsiderTransaction } from "@/types/StockData";

/* ──────────────────────────────────────────────────────────────────────────
   Insider classification. Yahoo's transactionText is ambiguous — the same word
   "Sale" can mean a discretionary open-market sell OR a programmatic
   exercise+sell under a 10b5-1 plan. We classify locally so downstream
   consumers (the prompt builder AND the derived-metrics framework) see
   structured signal, not noise.

   Extracted from buildPrompt.ts so lib/derivedMetrics.ts can reuse it without
   creating an import cycle (buildPrompt imports derivedMetrics).
   ────────────────────────────────────────────────────────────────────────── */

export type InsiderClass = "discretionary_buy" | "discretionary_sell" | "mechanical" | "grant" | "other";

export function classifyInsiderTransaction(t: InsiderTransaction): InsiderClass {
  const txt = (t.transactionText ?? "").toLowerCase();
  if (/purchase|acquisition.*open|acquired in the open|acquisition at price/.test(txt)) {
    return "discretionary_buy";
  }
  if (/award|grant|stock award|deferred|inheritance|gift/.test(txt)) {
    return "grant";
  }
  // Programmatic / non-open-market: option exercises, vesting, 10b5-1 sales
  if (/non[- ]open[- ]market|10b5-1|vesting|exercise|conversion|exempt|stock option/.test(txt)) {
    return "mechanical";
  }
  if (/sale|disposed|disposition/.test(txt)) {
    return "discretionary_sell";
  }
  return "other";
}

export function summarizeInsiderPattern(txs: InsiderTransaction[]): {
  pattern: string;
  buyValue: number;
  sellValue: number;
  mechanicalValue: number;
} {
  let buyValue = 0;
  let sellValue = 0;
  let mechanicalValue = 0;
  for (const t of txs) {
    const v = Math.abs(t.value ?? 0);
    const c = classifyInsiderTransaction(t);
    if (c === "discretionary_buy") buyValue += v;
    else if (c === "discretionary_sell") sellValue += v;
    else if (c === "mechanical") mechanicalValue += v;
  }
  let pattern: string;
  if (buyValue > 0 && buyValue > sellValue * 2) pattern = "comprador neto discrecional";
  else if (sellValue > 0 && sellValue > buyValue * 3 && sellValue > mechanicalValue) pattern = "vendedor neto discrecional";
  else if (mechanicalValue > 0 && mechanicalValue > buyValue && mechanicalValue > sellValue) pattern = "predominantemente mecánico (RSU/opciones), no señal";
  else pattern = "mixto / neutral";
  return { pattern, buyValue, sellValue, mechanicalValue };
}
