"use client";

import type { StockData } from "@/types/StockData";
import { currencyPrefix } from "@/lib/currencyPrefix";

interface Props {
  stockData: StockData;
}

function fmt(n: number | null | undefined, decimals = 2): string {
  return n != null ? n.toFixed(decimals) : "—";
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function fmtLarge(n: number | null | undefined, pfx: string): string {
  if (n == null) return "—";
  if (n >= 1e12) return `${pfx}${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${pfx}${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${pfx}${(n / 1e6).toFixed(2)}M`;
  return `${pfx}${n.toLocaleString("en-US")}`;
}

function fmtPrice(n: number | null | undefined, pfx: string): string {
  if (n == null) return "—";
  return `${pfx}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface MetricItem {
  label: string;
  value: string;
}

function Metric({ label, value }: MetricItem) {
  return (
    <div className="bg-white border border-[#03065E]/10 rounded-xl p-3 min-w-0 shadow-sm">
      <div className="text-xs text-[#707070] mb-1 uppercase tracking-wide">{label}</div>
      <div className="font-mono font-semibold text-[#03065E] text-sm truncate">{value}</div>
    </div>
  );
}

export function MetricsDashboard({ stockData: d }: Props) {
  const pfx = currencyPrefix(d.currency);
  const metrics: MetricItem[] = [
    { label: "Cap. Bursátil", value: fmtLarge(d.marketCap, pfx) },
    { label: "P/E Trailing", value: d.trailingPE != null ? `${fmt(d.trailingPE)}x` : "—" },
    { label: "P/E Forward", value: d.forwardPE != null ? `${fmt(d.forwardPE)}x` : "—" },
    { label: "EPS (TTM)", value: d.trailingEps != null ? `${pfx}${fmt(d.trailingEps)}` : "—" },
    { label: "Ingresos (TTM)", value: fmtLarge(d.totalRevenue, pfx) },
    { label: "Crec. Ingresos", value: fmtPct(d.revenueGrowth) },
    { label: "Margen Bruto", value: fmtPct(d.grossMargins) },
    { label: "Margen Neto", value: fmtPct(d.profitMargins) },
    { label: "Flujo Caja Libre", value: fmtLarge(d.freeCashflow, pfx) },
    { label: "ROE", value: fmtPct(d.returnOnEquity) },
    { label: "Máx. 52 sem.", value: fmtPrice(d.fiftyTwoWeekHigh, pfx) },
    { label: "Mín. 52 sem.", value: fmtPrice(d.fiftyTwoWeekLow, pfx) },
  ];

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[#03065E]/50 mb-3">
        Métricas Clave
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {metrics.map((m) => (
          <Metric key={m.label} label={m.label} value={m.value} />
        ))}
      </div>
    </div>
  );
}
