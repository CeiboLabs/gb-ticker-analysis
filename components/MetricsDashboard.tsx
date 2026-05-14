"use client";

import { useEffect, useRef, useState } from "react";
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
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${sign}${pfx}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${pfx}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${pfx}${(abs / 1e6).toFixed(2)}M`;
  return `${sign}${pfx}${abs.toLocaleString("en-US")}`;
}

function fmtPrice(n: number | null | undefined, pfx: string): string {
  if (n == null) return "—";
  return `${pfx}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface MetricItem {
  label: string;
  value: string;
  info?: string;
  sub?: string;
}

function Metric({
  label,
  value,
  sub,
  info,
  isOpen,
  onToggle,
}: MetricItem & { isOpen: boolean; onToggle: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !info) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle();
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onToggle();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onToggle]);

  return (
    <div
      ref={ref}
      className="relative bg-white border border-[#03065E]/10 rounded-xl p-3 min-w-0 shadow-sm"
    >
      {info && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-label={`Información sobre ${label}`}
          aria-expanded={isOpen}
          className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full border border-[#03065E]/25 text-[#03065E]/55 hover:text-[#03065E] hover:border-[#03065E]/60 hover:bg-[#03065E]/5 flex items-center justify-center text-[10px] font-mono font-bold leading-none transition-colors"
        >
          i
        </button>
      )}
      <div className={`text-xs text-[#707070] mb-1 uppercase tracking-wide ${info ? "pr-5" : ""}`}>
        {label}
      </div>
      <div className="font-mono font-semibold text-[#03065E] text-sm truncate">
        {value}
      </div>
      {sub && <div className="text-[10px] text-[#707070] mt-0.5 truncate">{sub}</div>}
      {isOpen && info && (
        <div
          role="tooltip"
          className="absolute top-7 right-1.5 left-1.5 sm:left-auto sm:w-56 z-20 bg-[#03065E] text-white text-[11px] leading-snug rounded-xl shadow-lg p-3 normal-case tracking-normal font-normal"
        >
          {info}
        </div>
      )}
    </div>
  );
}

export function MetricsDashboard({ stockData: d }: Props) {
  const pfx = currencyPrefix(d.currency);
  const pc = d.peerComparison;
  const [openLabel, setOpenLabel] = useState<string | null>(null);

  const metrics: MetricItem[] = [
    {
      label: "Cap. Bursátil",
      value: fmtLarge(d.marketCap, pfx),
    },
    {
      label: "P/E Forward",
      value: d.forwardPE != null ? `${fmt(d.forwardPE)}x` : "—",
      sub: pc?.avgForwardPE != null ? `Peers: ${fmt(pc.avgForwardPE)}x` : undefined,
      info: "Precio sobre ganancias proyectadas a 12 meses. Indica cuántos años de ganancias futuras estimadas se pagan por una acción. Menor suele ser más barato.",
    },
    {
      label: "CAPE (Shiller P/E)",
      value: d.capeRatio != null ? `${fmt(d.capeRatio)}x` : "—",
      sub: d.capeYears != null ? `Prom. ${d.capeYears} años` : undefined,
      info: "Cyclically Adjusted P/E de Shiller: precio dividido por la ganancia promedio de los últimos 10 años ajustada por inflación. Suaviza los ciclos económicos.",
    },
    {
      label: "EPS (TTM)",
      value: d.trailingEps != null ? `${pfx}${fmt(d.trailingEps)}` : "—",
      info: "Earnings Per Share (Trailing Twelve Months): ganancia neta por acción de los últimos 12 meses.",
    },
    {
      label: "Ingresos (TTM)",
      value: fmtLarge(d.totalRevenue, pfx),
    },
    {
      label: "Crec. Ingresos",
      value: fmtPct(d.revenueGrowth),
    },
    {
      label: "Margen Bruto",
      value: fmtPct(d.grossMargins),
    },
    {
      label: "Margen Neto",
      value: fmtPct(d.profitMargins),
    },
    {
      label: "FCF (TTM)",
      value: fmtLarge(d.freeCashflow, pfx),
      info: "Free Cash Flow: efectivo generado por las operaciones menos inversiones de capital, en los últimos 12 meses. Mide el dinero realmente disponible.",
    },
    {
      label: "Máx. 52 sem.",
      value: fmtPrice(d.fiftyTwoWeekHigh, pfx),
    },
    {
      label: "Mín. 52 sem.",
      value: fmtPrice(d.fiftyTwoWeekLow, pfx),
    },
    {
      label: "Beta",
      value: d.beta != null ? fmt(d.beta) : "—",
      info: "Mide la volatilidad de la acción frente al mercado. Beta > 1 implica mayor volatilidad que el mercado; < 1, menor.",
    },
  ];

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[#03065E]/50 mb-3">
        Métricas Clave
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {metrics.map((m) => (
          <Metric
            key={m.label}
            label={m.label}
            value={m.value}
            sub={m.sub}
            info={m.info}
            isOpen={openLabel === m.label}
            onToggle={() => setOpenLabel(openLabel === m.label ? null : m.label)}
          />
        ))}
      </div>
    </div>
  );
}
