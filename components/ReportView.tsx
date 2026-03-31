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
import ReactMarkdown from "react-markdown";
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
  { key: "industryContext",      title: "Contexto de Industria" },
  { key: "businessModel",        title: "Modelo de Negocio" },
  { key: "competitiveAdvantages", title: "Ventajas Competitivas" },
  { key: "revenueStreams",       title: "Fuentes de Ingresos" },
  { key: "profitabilityAnalysis", title: "Análisis de Rentabilidad" },
  { key: "balanceSheetHealth",   title: "Salud del Balance" },
  { key: "freeCashFlow",         title: "Flujo de Caja Libre" },
  { key: "managementQuality",    title: "Calidad de la Gestión" },
  { key: "valuationSnapshot",    title: "Valoración" },
  { key: "recentEarnings",       title: "Resultados Recientes y Estimaciones" },
  { key: "catalysts",            title: "Catalizadores" },
  { key: "riskFactors",          title: "Factores de Riesgo" },
];

export function ReportView({ report, stockData, cached, onRefresh, isRefreshing }: Props) {
  const pfx = currencyPrefix(stockData.currency);
  const svgRef = useRef<SVGSVGElement>(null);
  const [sankeyImageUrl, setSankeyImageUrl] = useState<string | undefined>();
  const [priceChartImageUrl, setPriceChartImageUrl] = useState<string | undefined>();

  useEffect(() => {
    const prices = stockData.historicalPrices;
    if (!prices || prices.length < 2) { setPriceChartImageUrl(undefined); return; }

    const rev        = stockData.quarterlyRevenue;
    const hasRevenue = !!(rev && rev.length > 0);

    // 2× resolution for sharp rendering in PDF
    const DPR    = 2;
    const MEDIA_W = 900, MEDIA_H = 280;
    const W = MEDIA_W * DPR, H = MEDIA_H * DPR;

    const PAD = {
      top:    16 * DPR,
      right:  72 * DPR,
      bottom: 32 * DPR,
      left:   hasRevenue ? 72 * DPR : 16 * DPR,
    };

    const chartW      = W - PAD.left - PAD.right;
    const chartH      = H - PAD.top  - PAD.bottom;
    const chartTop    = PAD.top;
    const chartBottom = PAD.top + chartH;

    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#0B1B5C";
    ctx.fillRect(0, 0, W, H);

    // ── Coordinate helpers ──────────────────────────────────────────────────
    const firstMs = new Date(prices[0].time).getTime();
    const lastMs  = new Date(prices[prices.length - 1].time).getTime();

    const xp  = (i: number) => PAD.left + (i / (prices.length - 1)) * chartW;
    const xpd = (dateStr: string) => {
      const ratio = (new Date(dateStr).getTime() - firstMs) / (lastMs - firstMs);
      return PAD.left + Math.max(0, Math.min(1, ratio)) * chartW;
    };

    // Price scale mirrors live chart right axis: scaleMargins { top: 0.1, bottom: 0.35 }
    // → price data sits in the vertical band [chartTop+10%, chartTop+65%]
    const priceTop = chartTop + 0.10 * chartH;
    const priceBot = chartTop + 0.65 * chartH;
    const priceH   = priceBot - priceTop;

    const pvals = prices.map(p => p.value);
    const pMin  = Math.min(...pvals), pMax = Math.max(...pvals);
    const pPad  = (pMax - pMin) * 0.05 || 1;
    const lo = pMin - pPad, hi = pMax + pPad, span = hi - lo;

    const yPrice = (v: number) => priceBot - ((v - lo) / span) * priceH;

    // Revenue scale mirrors live chart left axis: scaleMargins { top: 0.1, bottom: 0 }
    // → bars span from [chartTop+10%, chartBottom]
    const revTop = chartTop + 0.10 * chartH;
    const revBot = chartBottom;
    const revH   = revBot - revTop;

    // ── X-axis sample indices (5 evenly spaced) ─────────────────────────────
    const xIdxs = Array.from({ length: 5 }, (_, k) =>
      Math.round(k * (prices.length - 1) / 4)
    );

    // ── Vertical grid lines ──────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth   = DPR;
    for (const i of xIdxs) {
      const xx = xp(i);
      ctx.beginPath(); ctx.moveTo(xx, chartTop); ctx.lineTo(xx, chartBottom); ctx.stroke();
    }

    // ── Horizontal grid lines ────────────────────────────────────────────────
    for (let i = 0; i <= 4; i++) {
      const yy = chartTop + (i / 4) * chartH;
      ctx.beginPath(); ctx.moveTo(PAD.left, yy); ctx.lineTo(W - PAD.right, yy); ctx.stroke();
    }

    // ── Revenue bars (drawn first so price line renders on top) ──────────────
    if (hasRevenue) {
      const rvals  = rev!.map(q => Number(q.value)).filter(v => v > 0);
      const maxRev = Math.max(...rvals);
      const sorted = [...rev!].sort((a, b) => a.time.localeCompare(b.time));

      ctx.fillStyle = "rgba(99, 179, 237, 0.4)";
      sorted.forEach((q, i) => {
        const v = Number(q.value);
        if (!(v > 0)) return;
        const prevTime = i > 0 ? sorted[i - 1].time : null;
        const rightX   = xpd(q.time);
        const leftX    = prevTime
          ? xpd(prevTime)
          : rightX - (xpd(sorted[1]?.time ?? q.time) - rightX);
        const fullW = rightX - leftX;
        const barH  = (v / maxRev) * revH;
        ctx.fillRect(leftX + fullW * 0.1, revBot - barH, fullW * 0.8, barH);
      });
    }

    // ── Price line ───────────────────────────────────────────────────────────
    ctx.beginPath();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth   = 2 * DPR;
    prices.forEach((p, i) => {
      const x = xp(i), y = yPrice(p.value);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // ── Right axis — price labels ────────────────────────────────────────────
    const fmtPrice = (v: number) => {
      if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
      if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}k`;
      return `$${v.toFixed(v < 10 ? 2 : 0)}`;
    };

    ctx.fillStyle    = "rgba(255,255,255,0.4)";
    ctx.font         = `${11 * DPR}px Helvetica, sans-serif`;
    ctx.textAlign    = "left";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
      const y = priceTop + (i / 4) * priceH;
      const v = hi - (i / 4) * span;
      ctx.fillText(fmtPrice(v), W - PAD.right + 6 * DPR, y);
    }

    // ── Left axis — revenue labels ───────────────────────────────────────────
    if (hasRevenue) {
      const rvals  = rev!.map(q => Number(q.value)).filter(v => v > 0);
      const maxRev = Math.max(...rvals);

      const fmtRev = (v: number) => {
        if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
        if (v >= 1e9)  return `${(v / 1e9).toFixed(1)}B`;
        if (v >= 1e6)  return `${(v / 1e6).toFixed(0)}M`;
        return v.toFixed(0);
      };

      ctx.fillStyle    = "rgba(255,255,255,0.4)";
      ctx.textAlign    = "right";
      ctx.textBaseline = "middle";
      // i=1..4: skip the 0 value at chartBottom (overlaps x-axis labels)
      for (let i = 1; i <= 4; i++) {
        const frac = i / 4;
        const y    = revBot - frac * revH;
        ctx.fillText(fmtRev(frac * maxRev), PAD.left - 6 * DPR, y);
      }
    }

    // ── X-axis labels ────────────────────────────────────────────────────────
    ctx.fillStyle    = "rgba(255,255,255,0.4)";
    ctx.font         = `${11 * DPR}px Helvetica, sans-serif`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "alphabetic";
    for (const i of xIdxs) {
      const d   = new Date(prices[i].time);
      const lbl = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      ctx.fillText(lbl, xp(i), H - 6 * DPR);
    }

    setPriceChartImageUrl(canvas.toDataURL("image/png"));
  }, [stockData.historicalPrices, stockData.quarterlyRevenue]);

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
      <div className="flex flex-wrap items-center justify-between gap-y-2 mb-4 sm:mb-6">
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
          <PdfExportButton report={report} stockData={stockData} sankeyImageUrl={sankeyImageUrl} priceChartImageUrl={priceChartImageUrl} />
        </div>
      </div>

      <ReportHeader stockData={stockData} />
      <MetricsDashboard stockData={stockData} />
      <PriceChart
        historicalPrices={stockData.historicalPrices}
        ticker={stockData.ticker}
        quarterlyRevenue={stockData.quarterlyRevenue}
      />
      <div className="mt-6" />
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
              <div className="text-sm text-emerald-800/80 leading-relaxed prose prose-sm max-w-none prose-strong:text-current prose-p:my-0 prose-p:text-emerald-800/80">
                <ReactMarkdown>{report.bullCase.narrative}</ReactMarkdown>
              </div>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-red-700">Escenario Bajista</span>
                <span className="text-sm font-bold text-red-700">{pfx}{report.bearCase.priceTarget}</span>
              </div>
              <div className="text-sm text-red-800/80 leading-relaxed prose prose-sm max-w-none prose-strong:text-current prose-p:my-0 prose-p:text-red-800/80">
                <ReactMarkdown>{report.bearCase.narrative}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-[#707070]/60 mt-8 pt-4 border-t border-[#03065E]/10">
        © {new Date().getFullYear()} Gastón Bengochea · Potenciado por OpenAI · Solo informativo, no constituye asesoramiento de inversión · Yahoo Finance · SEC EDGAR
      </p>
    </div>
  );
}
