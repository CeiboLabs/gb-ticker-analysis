"use client";

import { useEffect, useRef, useState } from "react";
import type { StockData } from "@/types/StockData";
import { currencyPrefix } from "@/lib/currencyPrefix";

interface Props {
  stockData: StockData;
}

function fmt(n: number | null | undefined, decimals = 2): string {
  return n != null ? n.toFixed(decimals).replace(".", ",") : "—";
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1).replace(".", ",")} %`;
}

function fmtLarge(n: number | null | undefined, pfx: string): string {
  if (n == null) return "—";
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${sign}${pfx}${(abs / 1e12).toFixed(2).replace(".", ",")} T`;
  if (abs >= 1e9) return `${sign}${pfx}${(abs / 1e9).toFixed(2).replace(".", ",")} B`;
  if (abs >= 1e6) return `${sign}${pfx}${(abs / 1e6).toFixed(2).replace(".", ",")} M`;
  return `${sign}${pfx}${abs.toLocaleString("de-DE")}`;
}

function fmtPrice(n: number | null | undefined, pfx: string): string {
  if (n == null) return "—";
  return `${pfx}${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      style={{
        position: "relative",
        padding: "var(--space-3) var(--space-3) var(--space-4)",
        background: "var(--paper)",
        borderRight: "1px solid var(--rule)",
        borderBottom: "1px solid var(--rule)",
        minWidth: 0,
      }}
      className="metric-cell"
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
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 16,
            height: 16,
            border: "1px solid var(--rule-strong)",
            background: "transparent",
            color: "var(--ink-3)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 500,
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          i
        </button>
      )}
      <div className="cap" style={{ marginBottom: 6, paddingRight: info ? 22 : 0 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 18, color: "var(--ink)", fontWeight: 500, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </div>
      {sub && (
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {sub}
        </div>
      )}
      {isOpen && info && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            top: 30,
            left: 8,
            right: 8,
            zIndex: 30,
            background: "var(--navy)",
            color: "var(--ivory)",
            fontSize: 11,
            lineHeight: 1.5,
            padding: "10px 12px",
            border: "1px solid var(--navy-700)",
          }}
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
    { label: "Cap. Bursátil", value: fmtLarge(d.marketCap, pfx) },
    {
      label: "P/E Forward",
      value: d.forwardPE != null ? `${fmt(d.forwardPE)} ×` : "—",
      sub: pc?.avgForwardPE != null ? `Peers · ${fmt(pc.avgForwardPE)} ×` : undefined,
      info: "Precio sobre ganancias proyectadas a 12 meses. Indica cuántos años de ganancias futuras estimadas se pagan por una acción.",
    },
    {
      label: "CAPE (Shiller)",
      value: d.capeRatio != null ? `${fmt(d.capeRatio)} ×` : "—",
      sub: d.capeYears != null ? `Prom. ${d.capeYears} años` : undefined,
      info: "Cyclically Adjusted P/E: precio dividido por la ganancia promedio de 10 años ajustada por inflación.",
    },
    {
      label: "EPS (TTM)",
      value: d.trailingEps != null ? `${pfx}${fmt(d.trailingEps)}` : "—",
      info: "Earnings Per Share (Trailing Twelve Months): ganancia neta por acción de los últimos 12 meses.",
    },
    { label: "Ingresos (TTM)", value: fmtLarge(d.totalRevenue, pfx) },
    { label: "Crec. Ingresos", value: fmtPct(d.revenueGrowth) },
    { label: "Margen Bruto", value: fmtPct(d.grossMargins) },
    { label: "Margen Neto", value: fmtPct(d.profitMargins) },
    {
      label: "FCF (TTM)",
      value: fmtLarge(d.freeCashflow, pfx),
      info: "Free Cash Flow: efectivo generado por las operaciones menos inversiones de capital en los últimos 12 meses.",
    },
    { label: "Máx. 52 sem.", value: fmtPrice(d.fiftyTwoWeekHigh, pfx) },
    { label: "Mín. 52 sem.", value: fmtPrice(d.fiftyTwoWeekLow, pfx) },
    {
      label: "Beta",
      value: d.beta != null ? fmt(d.beta) : "—",
      info: "Volatilidad de la acción frente al mercado. Beta > 1 implica mayor volatilidad que el mercado; < 1, menor.",
    },
  ];

  return (
    <div style={{ marginBottom: "var(--space-5)" }}>
      <div className="cap-gold" style={{ marginBottom: "var(--space-3)" }}>Métricas clave</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          borderTop: "1px solid var(--ink)",
          borderLeft: "1px solid var(--rule)",
        }}
        className="metrics-grid"
      >
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

      <style>{`
        @media (max-width: 720px) {
          .metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
      `}</style>
    </div>
  );
}
