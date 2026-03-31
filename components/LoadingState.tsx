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

function Skeleton({ className }: { className: string }) {
  return <div className={`bg-[#03065E]/8 rounded-lg animate-pulse ${className}`} />;
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
        <div key={s} className="space-y-2 pt-4 border-t border-[#03065E]/10 first:border-t-0">
          <div className="h-3 w-36 bg-[#03065E]/8 rounded-lg animate-pulse" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ))}
    </>
  );
}

export function LoadingState({ ticker, stockData }: Props) {
  if (stockData) {
    return (
      <div className="space-y-0">
        <div className="flex items-center justify-between mb-6">
          <div className="text-xs text-[#707070]">Analizando…</div>
          <div className="flex items-center gap-2 text-xs text-[#03065E] font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-[#03065E] animate-ping" />
            Generando análisis IA
          </div>
        </div>

        <ReportHeader stockData={stockData} />
        <MetricsDashboard stockData={stockData} />
        <PriceChart historicalPrices={stockData.historicalPrices} ticker={stockData.ticker} quarterlyRevenue={stockData.quarterlyRevenue} />
        <div className="mt-6" />
        <AnalystConsensus stockData={stockData} />

        {/* Verdict skeleton */}
        <div className="border-t border-[#03065E]/10 pt-6 mb-6">
          <Skeleton className="h-20 rounded-xl" />
        </div>

        {/* Report sections skeleton */}
        <div className="space-y-2">
          <ReportSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="text-right space-y-2">
          <Skeleton className="h-7 w-24 ml-auto" />
          <Skeleton className="h-4 w-16 ml-auto" />
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-[#03065E] font-medium">
        <span className="inline-block w-2 h-2 rounded-full bg-[#03065E] animate-ping" />
        Analizando {ticker}…
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>

      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-20 rounded-xl" />

      {SECTION_NAMES.map((s) => (
        <div key={s} className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}
