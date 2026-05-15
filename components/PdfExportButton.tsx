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
      <button disabled className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 12, opacity: 0.5, cursor: "not-allowed" }}>
        Preparando PDF…
      </button>
    ),
  }
);

interface Props {
  report: StructuredReport;
  stockData: StockData;
  sankeyImageUrl?: string;
  priceChartImageUrl?: string;
}

export function PdfExportButton({ report, stockData, sankeyImageUrl, priceChartImageUrl }: Props) {
  return <ReportPdfDownload report={report} stockData={stockData} sankeyImageUrl={sankeyImageUrl} priceChartImageUrl={priceChartImageUrl} />;
}
