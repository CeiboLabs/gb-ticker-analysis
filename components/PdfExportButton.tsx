"use client";

import dynamic from "next/dynamic";
import type { StructuredReport } from "@/types/Report";
import type { StockData } from "@/types/StockData";

// Lazy-load PDF components — react-pdf uses browser-only APIs
const ReportPdfDownload = dynamic(
  () => import("./ReportPdf").then((m) => m.ReportPdfDownload),
  {
    ssr: false,
    loading: () => (
      <button
        disabled
        className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-[#03065E]/20 text-[#03065E]/40 cursor-not-allowed"
      >
        Preparando PDF…
      </button>
    ),
  }
);

interface Props {
  report: StructuredReport;
  stockData: StockData;
  sankeyImageUrl?: string;
}

export function PdfExportButton({ report, stockData, sankeyImageUrl }: Props) {
  return <ReportPdfDownload report={report} stockData={stockData} sankeyImageUrl={sankeyImageUrl} />;
}
