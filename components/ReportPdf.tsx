"use client";

import { Fragment, useState, useCallback, useEffect } from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { StructuredReport } from "@/types/Report";
import type { StockData } from "@/types/StockData";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    backgroundColor: "#ffffff",
    color: "#111827",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#03065E",
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  logo: {
    width: 138,
    height: 24,
    objectFit: "contain",
  },

  ticker: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  companyName: {
    fontSize: 13,
    color: "#374151",
    marginTop: 2,
  },
  meta: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginTop: 6,
  },
  price: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16,
  },
  metricBox: {
    width: "22%",
    backgroundColor: "#f3f4f6",
    borderRadius: 4,
    padding: 6,
  },
  metricLabel: {
    fontSize: 7,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  chartContainer: {
    marginBottom: 16,
    borderRadius: 4,
    overflow: "hidden",
  },
  chartLabel: {
    fontSize: 7,
    color: "#9ca3af",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  verdictBox: {
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  verdictBadge: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },
  verdictConviction: {
    fontSize: 8,
    marginTop: 2,
  },
  verdictRationale: {
    fontSize: 9,
    marginTop: 4,
    lineHeight: 1.5,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#03065E",
    marginBottom: 4,
    marginTop: 14,
  },
  sectionText: {
    fontSize: 9,
    color: "#374151",
    lineHeight: 1.6,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "column",
    fontSize: 7,
    color: "#9ca3af",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 6,
  },
});

function fmtPrice(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtLarge(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString("en-US")}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

interface ReportDocProps {
  report: StructuredReport;
  stockData: StockData;
  sankeyImageUrl?: string;
  priceChartImageUrl?: string;
}

const VERDICT_COLORS = {
  BUY:   { bg: "#f0fdf4", border: "#22c55e", badge: "#15803d", sub: "#16a34a", text: "#166534" },
  HOLD:  { bg: "#fffbeb", border: "#f59e0b", badge: "#92400e", sub: "#b45309", text: "#78350f" },
  AVOID: { bg: "#fef2f2", border: "#ef4444", badge: "#991b1b", sub: "#dc2626", text: "#7f1d1d" },
} as const;

function ReportDocument({ report, stockData: d, sankeyImageUrl, priceChartImageUrl }: ReportDocProps) {
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const metrics = [
    ["Market Cap", fmtLarge(d.marketCap)],
    ["Forward P/E", d.forwardPE != null ? `${d.forwardPE.toFixed(1)}x${d.peerComparison?.avgForwardPE != null ? ` (Peers: ${d.peerComparison.avgForwardPE.toFixed(1)}x)` : ""}` : "—"],
    ["CAPE (Shiller P/E)", d.capeRatio != null ? `${d.capeRatio.toFixed(1)}x${d.capeYears != null ? ` (${d.capeYears}yr)` : ""}` : "—"],
    ["EPS (TTM)", d.trailingEps != null ? `$${d.trailingEps.toFixed(2)}` : "—"],
    ["Revenue (TTM)", fmtLarge(d.totalRevenue)],
    ["Rev. Growth", fmtPct(d.revenueGrowth)],
    ["Gross Margin", fmtPct(d.grossMargins)],
    ["Net Margin", fmtPct(d.profitMargins)],
    ["Free Cash Flow", fmtLarge(d.freeCashflow)],
    ["52W High", fmtPrice(d.fiftyTwoWeekHigh)],
    ["52W Low", fmtPrice(d.fiftyTwoWeekLow)],
    ["Beta", d.beta != null ? d.beta.toFixed(2) : "—"],
  ];

  const vc = VERDICT_COLORS[report.verdict.rating as keyof typeof VERDICT_COLORS] ?? VERDICT_COLORS.HOLD;

  const sections: [string, string][] = [
    ["Contexto de Industria",                report.industryContext],
    ["Modelo de Negocio",                    report.businessModel],
    ["Ventajas Competitivas",               report.competitiveAdvantages],
    ["Fuentes de Ingresos",                  report.revenueStreams],
    ["Análisis de Rentabilidad",             report.profitabilityAnalysis],
    ["Salud del Balance",                    report.balanceSheetHealth],
    ["Flujo de Caja Libre",                  report.freeCashFlow],
    ["Inversión de Capital (CAPEX)",         report.capitalExpenditure],
    ["Calidad de la Gestión",               report.managementQuality],
    ["Valoración",                           report.valuationSnapshot],
    ["Resultados Recientes y Estimaciones",  report.recentEarnings],
    ["Catalizadores",                        report.catalysts],
    ["Factores de Riesgo",                   report.riskFactors],
    ["Escenario Alcista — $" + report.bullCase.priceTarget, report.bullCase.narrative],
    ["Escenario Bajista — $" + report.bearCase.priceTarget, report.bearCase.narrative],
  ];

  // Clean markdown but preserve **bold** markers for rendering
  function cleanMd(value: unknown): string {
    const md = typeof value === "string" ? value : typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
    return md
      .replace(/#{1,6}\s+(.*)/g, "$1")
      .replace(/`(.*?)`/g, "$1")
      .replace(/^- /gm, "• ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // Parse text into bold/normal segments
  function parseBold(text: string): Array<{ t: string; bold: boolean }> {
    const parts: Array<{ t: string; bold: boolean }> = [];
    const re = /\*\*(.*?)\*\*/g;
    let last = 0;
    for (const m of text.matchAll(re)) {
      if (m.index! > last) parts.push({ t: text.slice(last, m.index), bold: false });
      parts.push({ t: m[1], bold: true });
      last = m.index! + m[0].length;
    }
    if (last < text.length) parts.push({ t: text.slice(last), bold: false });
    return parts;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function PdfText({ content, style }: { content: unknown; style: any }) {
    const parts = parseBold(cleanMd(content));
    return (
      <Text style={style}>
        {parts.map((p, i) =>
          p.bold
            ? <Text key={i} style={{ fontFamily: "Helvetica-Bold" }}>{p.t}</Text>
            : p.t
        )}
      </Text>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.ticker}>{d.ticker}</Text>
            <Text style={styles.companyName}>{d.companyName}</Text>
            {d.sector && (
              <Text style={styles.meta}>
                {d.sector} · {d.industry}
              </Text>
            )}
            <View style={styles.priceRow}>
              <Text style={styles.price}>{fmtPrice(d.currentPrice)}</Text>
            </View>
          </View>
          <Image style={styles.logo} src="/logo-bengochea.png" />
        </View>

        {/* Metrics grid */}
        <View style={styles.metricsGrid}>
          {metrics.map(([label, value]) => (
            <View key={label} style={styles.metricBox}>
              <Text style={styles.metricLabel}>{label}</Text>
              <Text style={styles.metricValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Price chart */}
        {priceChartImageUrl && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartLabel}>Precio — Últimos 3 años</Text>
            <Image src={priceChartImageUrl} style={{ width: "100%", borderRadius: 4 }} />
            {d.quarterlyRevenue && d.quarterlyRevenue.length > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                <View style={{ width: 10, height: 10, backgroundColor: "rgba(99,179,237,0.6)", borderRadius: 1, borderWidth: 0.5, borderColor: "#6b7280" }} />
                <Text style={{ fontSize: 7, color: "#9ca3af" }}>Revenue trimestral</Text>
                <View style={{ width: 10, height: 10, backgroundColor: "#ffffff", borderWidth: 0.5, borderColor: "#111827", borderRadius: 1, marginLeft: 6 }} />
                <Text style={{ fontSize: 7, color: "#9ca3af" }}>Precio</Text>
              </View>
            )}
          </View>
        )}

        {/* Verdict */}
        <View style={[styles.verdictBox, { backgroundColor: vc.bg, borderLeftColor: vc.border }]}>
          <Text style={[styles.verdictBadge, { color: vc.badge }]}>
            {report.verdict.rating === "BUY" ? "COMPRAR" : report.verdict.rating === "HOLD" ? "MANTENER" : "EVITAR"}
          </Text>
          <Text style={[styles.verdictConviction, { color: vc.sub }]}>
            CONVICCIÓN {report.verdict.conviction === "HIGH" ? "ALTA" : report.verdict.conviction === "MEDIUM" ? "MEDIA" : "BAJA"}
          </Text>
          <PdfText content={report.verdict.rationale} style={[styles.verdictRationale, { color: vc.text }]} />
        </View>

        {/* Sections — flattened so titles are direct Page children (minPresenceAhead needs prior siblings) */}
        {sections.map(([title, content], idx) => (
          <Fragment key={title}>
            <Text style={styles.sectionTitle} minPresenceAhead={120}>{title}</Text>
            <PdfText content={content} style={styles.sectionText} />
            {idx === 7 && d.annualCashFlow && d.annualCashFlow.length > 0 && (
              <View style={{ marginTop: 6, borderWidth: 0.5, borderColor: "#e5e7eb", borderRadius: 3 }}>
                <View style={{ flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb", backgroundColor: "#f9fafb" }}>
                  <Text style={{ width: 50, fontSize: 7, fontFamily: "Helvetica-Bold", color: "#6b7280", padding: 4, textTransform: "uppercase" }}> </Text>
                  {d.annualCashFlow.map((y) => (
                    <Text key={y.year} style={{ flex: 1, fontSize: 7, fontFamily: "Helvetica-Bold", color: "#03065E", padding: 4, textAlign: "right" }}>FY{y.year}</Text>
                  ))}
                </View>
                {(["CAPEX", "OCF", "FCF"] as const).map((label, ri) => (
                  <View key={label} style={{ flexDirection: "row", borderBottomWidth: ri < 2 ? 0.5 : 0, borderBottomColor: "#f3f4f6" }}>
                    <Text style={{ width: 50, fontSize: 7, color: "#6b7280", padding: 4 }}>{label}</Text>
                    {d.annualCashFlow!.map((y) => {
                      const v = label === "CAPEX" ? (y.capitalExpenditure != null ? Math.abs(y.capitalExpenditure) : null)
                              : label === "OCF" ? y.operatingCashFlow
                              : y.freeCashFlow;
                      return (
                        <Text key={y.year} style={{ flex: 1, fontSize: 7, color: label === "CAPEX" ? "#03065E" : "#374151", fontFamily: label === "CAPEX" ? "Helvetica-Bold" : "Helvetica", padding: 4, textAlign: "right" }}>
                          {v != null ? fmtLarge(v) : "—"}
                        </Text>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
            {idx === 1 && sankeyImageUrl && report.segmentData && (
              <View style={{ marginTop: 6 }}>
                <Text style={{ fontSize: 7, color: "#9ca3af", marginBottom: 3 }}>
                  {report.segmentData.period +
                    (report.segmentData.segmentPeriod && report.segmentData.segmentPeriod !== report.segmentData.period
                      ? " · Segmentos: " + report.segmentData.segmentPeriod
                      : "") +
                    " · en " + report.segmentData.currency + ", " + report.segmentData.unit}
                </Text>
                <Image src={sankeyImageUrl} style={{ width: "100%", borderRadius: 4 }} />
              </View>
            )}
          </Fragment>
        ))}

        {/* Disclosure — flows after last section on final page */}
        <View style={{ marginTop: 20, borderTopWidth: 0.5, borderTopColor: "#e5e7eb", paddingTop: 8, gap: 4 }}>
          <Text style={{ fontSize: 6.5, color: "#9ca3af", lineHeight: 1.6 }}>
            Esta herramienta analiza únicamente acciones listadas en bolsas de valores de Estados Unidos. Este reporte ha sido generado mediante inteligencia artificial (OpenAI GPT-4o) con fines exclusivamente informativos y educativos. El contenido aquí presentado no constituye asesoramiento financiero, de inversión, legal o fiscal, ni debe interpretarse como una recomendación de compra, venta o mantenimiento de ningún valor o instrumento financiero.
          </Text>
          <Text style={{ fontSize: 6.5, color: "#9ca3af", lineHeight: 1.6 }}>
            La información contenida en este documento proviene de fuentes consideradas confiables (Yahoo Finance, SEC EDGAR), pero no se garantiza su exactitud, integridad o vigencia. Las proyecciones, estimaciones y opiniones expresadas reflejan el criterio del autor a la fecha de publicación y están sujetas a cambios sin previo aviso. Los modelos de lenguaje pueden producir información inexacta o desactualizada. El contenido generado no ha sido verificado por un analista humano.
          </Text>
          <Text style={{ fontSize: 6.5, color: "#9ca3af", lineHeight: 1.6 }}>
            Gastón Bengochea es un corredor de bolsa regulado por el Banco Central del Uruguay (BCU) conforme a la Ley N° 18.627 de Mercado de Valores. No obstante, esta herramienta de análisis automatizado no constituye un servicio de asesoramiento de inversión regulado. El contenido generado no ha sido revisado ni aprobado por el BCU y su distribución no implica respaldo regulatorio alguno.
          </Text>
          <Text style={{ fontSize: 6.5, color: "#9ca3af", lineHeight: 1.6 }}>
            Cada inversor debe realizar su propio análisis independiente y consultar con un asesor de inversión habilitado antes de tomar cualquier decisión. El autor no asume responsabilidad alguna por pérdidas o daños derivados del uso de esta información.
          </Text>
        </View>

        {/* Footer — all pages */}
        <View style={styles.footer} fixed>
          <Text>
            {d.ticker} · Reporte de Investigación · {today} · © {new Date().getFullYear()} Gastón Bengochea
          </Text>
        </View>
      </Page>
    </Document>
  );
}

interface DownloadProps {
  report: StructuredReport;
  stockData: StockData;
  sankeyImageUrl?: string;
  priceChartImageUrl?: string;
}

export function ReportPdfDownload({ report, stockData, sankeyImageUrl, priceChartImageUrl }: DownloadProps) {
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  // Pre-generate the PDF as soon as the report is ready. iOS Safari requires
  // navigator.share() to run inside the user-activation window (~5s after
  // click); if we generate on click, react-pdf's async work eats that window
  // and share() throws NotAllowedError. Pre-generating keeps the click
  // handler synchronous so user activation is preserved.
  useEffect(() => {
    let cancelled = false;
    setPdfBlob(null);
    pdf(
      <ReportDocument report={report} stockData={stockData} sankeyImageUrl={sankeyImageUrl} priceChartImageUrl={priceChartImageUrl} />
    )
      .toBlob()
      .then((blob) => {
        if (!cancelled) setPdfBlob(blob);
      });
    return () => {
      cancelled = true;
    };
  }, [report, stockData, sankeyImageUrl, priceChartImageUrl]);

  const handleClick = useCallback(() => {
    if (!pdfBlob) return;
    const today = new Date().toISOString().split("T")[0];
    const filename = `${stockData.ticker}-analysis-${today}.pdf`;
    const file = new File([pdfBlob], filename, { type: "application/pdf" });

    // Try share unconditionally if the API exists. canShare() is unreliable
    // on iOS Safari — it returns false for perfectly valid PDF Files created
    // from a Blob, even though share() itself would succeed. If share rejects
    // (not supported / error), we fall back to download.
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      navigator.share({ files: [file], title: `${stockData.ticker} — Análisis` }).catch((err) => {
        if ((err as DOMException)?.name === "AbortError") return;
        downloadFallback(pdfBlob, filename);
      });
      return;
    }

    downloadFallback(pdfBlob, filename);
  }, [pdfBlob, stockData.ticker]);

  const ready = pdfBlob !== null;

  return (
    <button
      onClick={handleClick}
      disabled={!ready}
      className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-white text-[#03065E] hover:bg-[#E8ECFF] font-semibold transition-colors cursor-pointer disabled:opacity-50"
    >
      {ready ? "Exportar PDF" : "Preparando PDF…"}
    </button>
  );
}

function downloadFallback(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
