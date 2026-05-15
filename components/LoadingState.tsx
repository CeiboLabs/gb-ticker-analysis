"use client";

import { ReportHeader } from "@/components/ReportHeader";
import { MetricsDashboard } from "@/components/MetricsDashboard";
import { AnalystConsensus } from "@/components/AnalystConsensus";
import { PriceChart } from "@/components/PriceChart";
import type { StockData } from "@/types/StockData";

interface Props {
  ticker: string;
  stockData?: StockData | null;
}

function Skeleton({ height, width = "100%" }: { height: number; width?: string | number }) {
  return (
    <div
      style={{
        height,
        width,
        background: "var(--navy-050)",
        animation: "shimmer 1.6s ease-in-out infinite",
      }}
    />
  );
}

const SECTION_NAMES = [
  "Modelo de Negocio",
  "Fuentes de Ingresos",
  "Análisis de Rentabilidad",
  "Valoración",
];

function ReportSkeleton() {
  return (
    <>
      {SECTION_NAMES.map((s) => (
        <div
          key={s}
          style={{
            padding: "var(--space-5) 0",
            borderTop: "1px solid var(--rule)",
            display: "grid",
            gridTemplateColumns: "200px 1fr",
            gap: "var(--space-5)",
          }}
          className="report-section-grid"
        >
          <div className="cap-gold">{s}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: "44em" }}>
            <Skeleton height={12} />
            <Skeleton height={12} />
            <Skeleton height={12} width="80%" />
          </div>
        </div>
      ))}
      <style>{`
        @keyframes shimmer { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        @media (max-width: 760px) {
          .report-section-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

export function LoadingState({ ticker, stockData }: Props) {
  if (stockData) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
          <div className="cap">Analizando · datos en streaming</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 6, height: 6, background: "var(--gold)", display: "inline-block", animation: "shimmer 1.2s ease-in-out infinite" }} />
            <span className="cap-gold">Generando análisis IA</span>
          </div>
        </div>

        <ReportHeader stockData={stockData} />
        <MetricsDashboard stockData={stockData} />
        <PriceChart
          ticker={stockData.ticker}
          historicalPrices={stockData.historicalPrices}
          quarterlyRevenue={stockData.quarterlyRevenue}
        />
        <div style={{ marginTop: "var(--space-5)" }} />
        <AnalystConsensus stockData={stockData} />

        <div style={{ borderTop: "1px solid var(--ink)", padding: "var(--space-5) 0" }}>
          <Skeleton height={80} />
        </div>

        <ReportSkeleton />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 16, alignItems: "center", paddingTop: "var(--space-4)" }}>
        <Skeleton height={56} width={56} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton height={20} width={200} />
          <Skeleton height={12} width={140} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          <Skeleton height={26} width={120} />
          <Skeleton height={12} width={70} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 6, height: 6, background: "var(--gold)", display: "inline-block", animation: "shimmer 1.2s ease-in-out infinite" }} />
        <span className="cap-gold">Analizando {ticker}…</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          borderTop: "1px solid var(--ink)",
          borderLeft: "1px solid var(--rule)",
        }}
        className="metrics-grid"
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            style={{
              padding: "var(--space-3)",
              borderRight: "1px solid var(--rule)",
              borderBottom: "1px solid var(--rule)",
              background: "var(--paper)",
            }}
          >
            <Skeleton height={10} width="60%" />
            <div style={{ height: 8 }} />
            <Skeleton height={18} />
          </div>
        ))}
      </div>

      <Skeleton height={240} />
      <Skeleton height={80} />

      <ReportSkeleton />

      <style>{`
        @keyframes shimmer { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        @media (max-width: 720px) {
          .metrics-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
