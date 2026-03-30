"use client";

import { useRef, useEffect, useState } from "react";
import { ReportHeader } from "@/components/ReportHeader";
import { MetricsDashboard } from "@/components/MetricsDashboard";
import { AnalystConsensus } from "@/components/AnalystConsensus";
import { InvestmentVerdict } from "@/components/InvestmentVerdict";
import { ReportSection } from "@/components/ReportSection";
import { SankeyChart } from "@/components/SankeyChart";
import { PriceChart } from "@/components/PriceChart";
import { PdfExportButton } from "@/components/PdfExportButton";
import { currencyPrefix } from "@/lib/currencyPrefix";
import type { StructuredReport } from "@/types/Report";
import type { StockData } from "@/types/StockData";

interface Props {
  report: StructuredReport;
  stockData: StockData;
  cached?: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const SECTIONS: { key: keyof Omit<StructuredReport, "verdict" | "bullCase" | "bearCase">; title: string }[] = [
  { key: "businessModel", title: "Modelo de Negocio" },
  { key: "revenueStreams", title: "Fuentes de Ingresos" },
  { key: "profitabilityAnalysis", title: "Análisis de Rentabilidad" },
  { key: "balanceSheetHealth", title: "Salud del Balance" },
  { key: "freeCashFlow", title: "Flujo de Caja Libre" },
  { key: "competitiveAdvantages", title: "Ventajas Competitivas" },
  { key: "managementQuality", title: "Calidad de la Gestión" },
  { key: "valuationSnapshot", title: "Valoración" },
  { key: "recentEarnings", title: "Resultados Recientes y Estimaciones" },
  { key: "riskFactors", title: "Factores de Riesgo" },
];

export function ReportView({ report, stockData, cached, onRefresh, isRefreshing }: Props) {
  const pfx = currencyPrefix(stockData.currency);
  const svgRef = useRef<SVGSVGElement>(null);
  const [sankeyImageUrl, setSankeyImageUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!report.segmentData) { setSankeyImageUrl(undefined); return; }
    const id = setTimeout(() => {
      const el = svgRef.current;
      if (!el) return;
      const vb = el.viewBox.baseVal;
      const W = vb.width || 1800;
      const H = vb.height || 1000;
      const svgString = new XMLSerializer().serializeToString(el);
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(img, 0, 0, W, H);
        URL.revokeObjectURL(url);
        setSankeyImageUrl(canvas.toDataURL("image/png"));
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
    }, 150);
    return () => clearTimeout(id);
  }, [report]);

  const today = new Date().toLocaleDateString("es-UY", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-0">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-xs text-[#707070]">
          {cached ? "En caché · " : ""}
          {today}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="text-xs px-3 py-1.5 rounded-lg border border-[#03065E]/20 text-[#03065E] hover:bg-[#03065E] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isRefreshing ? "Actualizando…" : "Actualizar Análisis"}
          </button>
          <PdfExportButton report={report} stockData={stockData} sankeyImageUrl={sankeyImageUrl} />
        </div>
      </div>

      <ReportHeader stockData={stockData} />
      <MetricsDashboard stockData={stockData} />
      <PriceChart
        historicalPrices={stockData.historicalPrices}
        ticker={stockData.ticker}
      />
      <AnalystConsensus stockData={stockData} />

      <div className="border-t border-[#03065E]/10 pt-6 mb-6">
        <InvestmentVerdict verdict={report.verdict} />
      </div>

      <div className="space-y-6 divide-y divide-[#03065E]/10">
        {SECTIONS.map(({ key, title }) => (
          <div key={key} className="pt-6 first:pt-0">
            <ReportSection title={title} content={report[key] as string} />
            {key === "revenueStreams" && report.segmentData && (
              // Break out of the max-w-3xl page container so the chart
              // uses the full viewport width with a small side gutter.
              <div
                className="mt-6"
                style={{ width: "100vw", marginLeft: "calc(-50vw + 50%)", paddingInline: "1.5rem" }}
              >
                <SankeyChart data={report.segmentData} svgRef={svgRef} />
              </div>
            )}
          </div>
        ))}

        {/* Bull / Bear cases */}
        {report.bullCase && report.bearCase && (
          <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Escenario Alcista</span>
                <span className="text-sm font-bold text-emerald-700">{pfx}{report.bullCase.priceTarget}</span>
              </div>
              <p className="text-sm text-emerald-800/80 leading-relaxed">{report.bullCase.narrative}</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-red-700">Escenario Bajista</span>
                <span className="text-sm font-bold text-red-700">{pfx}{report.bearCase.priceTarget}</span>
              </div>
              <p className="text-sm text-red-800/80 leading-relaxed">{report.bearCase.narrative}</p>
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-[#707070]/60 mt-8 pt-4 border-t border-[#03065E]/10">
        Solo con fines informativos. No constituye asesoramiento financiero. Datos obtenidos de Yahoo Finance.
      </p>
    </div>
  );
}
