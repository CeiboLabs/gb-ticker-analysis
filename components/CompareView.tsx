"use client";

import { currencyPrefix } from "@/lib/currencyPrefix";
import type { StockData } from "@/types/StockData";
import type { VerdictRating, VerdictConviction } from "@/types/Report";

export interface CompareTickerResult {
  ticker: string;
  stockData: StockData;
  verdict: { rating: VerdictRating; conviction: VerdictConviction } | null;
}

interface Props {
  results: CompareTickerResult[];
}

interface MetricRow {
  label: string;
  getValue: (d: StockData) => number | null;
  format: (n: number | null, d: StockData) => string;
  highlight: "high" | "low" | "none";
}

function fmtLarge(n: number | null, pfx: string): string {
  if (n == null) return "—";
  if (n >= 1e12) return `${pfx}${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${pfx}${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${pfx}${(n / 1e6).toFixed(2)}M`;
  return `${pfx}${n.toLocaleString("en-US")}`;
}

function fmtPct(n: number | null): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

const METRICS: MetricRow[] = [
  {
    label: "Precio",
    getValue: (d) => d.currentPrice,
    format: (n, d) => n != null ? `${currencyPrefix(d.currency)}${n.toFixed(2)}` : "—",
    highlight: "none",
  },
  {
    label: "Cap. Bursátil",
    getValue: (d) => d.marketCap,
    format: (n, d) => fmtLarge(n, currencyPrefix(d.currency)),
    highlight: "none",
  },
  {
    label: "P/E Trailing",
    getValue: (d) => d.trailingPE,
    format: (n) => n != null ? `${n.toFixed(1)}x` : "—",
    highlight: "low",
  },
  {
    label: "P/E Forward",
    getValue: (d) => d.forwardPE,
    format: (n) => n != null ? `${n.toFixed(1)}x` : "—",
    highlight: "low",
  },
  {
    label: "EV/EBITDA",
    getValue: (d) => d.enterpriseToEbitda,
    format: (n) => n != null ? `${n.toFixed(1)}x` : "—",
    highlight: "low",
  },
  {
    label: "Margen Bruto",
    getValue: (d) => d.grossMargins,
    format: (n) => fmtPct(n),
    highlight: "high",
  },
  {
    label: "Margen Neto",
    getValue: (d) => d.profitMargins,
    format: (n) => fmtPct(n),
    highlight: "high",
  },
  {
    label: "Crec. Ingresos",
    getValue: (d) => d.revenueGrowth,
    format: (n) => fmtPct(n),
    highlight: "high",
  },
  {
    label: "ROE",
    getValue: (d) => d.returnOnEquity,
    format: (n) => fmtPct(n),
    highlight: "high",
  },
  {
    label: "FCF",
    getValue: (d) => d.freeCashflow,
    format: (n, d) => fmtLarge(n, currencyPrefix(d.currency)),
    highlight: "high",
  },
  {
    label: "Máx. 52 sem.",
    getValue: (d) => d.fiftyTwoWeekHigh,
    format: (n, d) => n != null ? `${currencyPrefix(d.currency)}${n.toFixed(2)}` : "—",
    highlight: "none",
  },
  {
    label: "Mín. 52 sem.",
    getValue: (d) => d.fiftyTwoWeekLow,
    format: (n, d) => n != null ? `${currencyPrefix(d.currency)}${n.toFixed(2)}` : "—",
    highlight: "none",
  },
  {
    label: "Obj. Analistas",
    getValue: (d) => d.targetMeanPrice,
    format: (n, d) => n != null ? `${currencyPrefix(d.currency)}${n.toFixed(2)}` : "—",
    highlight: "high",
  },
];

const ratingConfig = {
  BUY:   { badge: "bg-emerald-600 text-white" },
  HOLD:  { badge: "bg-amber-500 text-white" },
  AVOID: { badge: "bg-red-600 text-white" },
} as const;

const ratingLabel: Record<VerdictRating, string> = {
  BUY: "COMPRAR",
  HOLD: "MANTENER",
  AVOID: "EVITAR",
};

function getBestIndex(values: (number | null)[], direction: "high" | "low"): number | null {
  const nonNull = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v !== null);
  if (nonNull.length < 2) return null;
  nonNull.sort((a, b) => direction === "high" ? b.v - a.v : a.v - b.v);
  return nonNull[0].i;
}

export function CompareView({ results }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-36 py-3 pr-4 text-left" />
            {results.map((r) => (
              <th key={r.ticker} className="py-3 px-3 text-left align-top">
                <div className="space-y-1">
                  <div className="font-mono font-bold text-[#03065E] text-base">{r.ticker}</div>
                  <div className="text-xs text-[#707070] font-normal leading-snug line-clamp-2">
                    {r.stockData.companyName}
                  </div>
                  {r.verdict && (
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold tracking-wide ${
                        ratingConfig[r.verdict.rating as keyof typeof ratingConfig]?.badge ?? "bg-gray-400 text-white"
                      }`}
                    >
                      {ratingLabel[r.verdict.rating] ?? r.verdict.rating}
                    </span>
                  )}
                  <div>
                    <a
                      href={`/?ticker=${r.ticker}`}
                      className="text-xs text-[#03065E]/50 hover:text-[#03065E] transition-colors"
                    >
                      Ver reporte →
                    </a>
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* % change row — special rendering */}
          <tr className="bg-[#F8F9FF]">
            <td className="py-2.5 pr-4 text-xs uppercase tracking-widest text-[#707070] font-medium">
              Var. Hoy
            </td>
            {results.map((r) => {
              const pct = r.stockData.priceChangePercent;
              const color =
                pct == null ? "text-[#03065E]" : pct > 0 ? "text-emerald-600" : pct < 0 ? "text-red-600" : "text-[#03065E]";
              return (
                <td key={r.ticker} className={`py-2.5 px-3 font-mono font-semibold ${color}`}>
                  {pct != null ? `${pct > 0 ? "+" : ""}${(pct * 100).toFixed(2)}%` : "—"}
                </td>
              );
            })}
          </tr>

          {METRICS.map((metric, rowIdx) => {
            const values = results.map((r) => metric.getValue(r.stockData));
            const bestIdx = metric.highlight !== "none" ? getBestIndex(values, metric.highlight) : null;
            const isEven = (rowIdx + 1) % 2 === 0;

            return (
              <tr key={metric.label} className={isEven ? "bg-[#F8F9FF]" : "bg-white"}>
                <td className="py-2.5 pr-4 text-xs uppercase tracking-widest text-[#707070] font-medium whitespace-nowrap">
                  {metric.label}
                </td>
                {results.map((r, colIdx) => {
                  const isWinner = bestIdx === colIdx;
                  return (
                    <td
                      key={r.ticker}
                      className={`py-2.5 px-3 font-mono text-sm ${
                        isWinner
                          ? "text-emerald-800 font-semibold"
                          : "text-[#03065E]"
                      }`}
                    >
                      {isWinner ? (
                        <span className="bg-emerald-50 rounded px-1">
                          {metric.format(values[colIdx], r.stockData)}
                        </span>
                      ) : (
                        metric.format(values[colIdx], r.stockData)
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
