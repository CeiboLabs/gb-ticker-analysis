"use client";

import { useState } from "react";
import type { StockData } from "@/types/StockData";
import { currencyPrefix } from "@/lib/currencyPrefix";

interface Props {
  stockData: StockData;
}

function priceColor(change: number | null): string {
  if (change == null) return "var(--ink-3)";
  return change >= 0 ? "var(--pos)" : "var(--neg)";
}

export function ReportHeader({ stockData }: Props) {
  const [logoFailed, setLogoFailed] = useState(false);
  const initial = stockData.ticker.charAt(0);

  const logoUrl = !logoFailed
    ? `/api/logo?ticker=${encodeURIComponent(stockData.ticker)}${stockData.domain ? `&domain=${encodeURIComponent(stockData.domain)}` : ""}`
    : null;

  const changeSign = (stockData.priceChangePercent ?? 0) >= 0 ? "+" : "";
  const changePct =
    stockData.priceChangePercent != null
      ? `${changeSign}${(stockData.priceChangePercent * 100).toFixed(2).replace(".", ",")} %`
      : null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: "var(--space-4)",
        alignItems: "center",
        paddingTop: "var(--space-5)",
        paddingBottom: "var(--space-4)",
        borderTop: "1px solid var(--ink)",
        borderBottom: "1px solid var(--rule)",
        marginBottom: "var(--space-5)",
      }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={stockData.companyName}
          width={48}
          height={48}
          style={{
            width: 56,
            height: 56,
            objectFit: "contain",
            padding: 6,
            background: "var(--paper)",
            border: "1px solid var(--rule)",
          }}
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <div
          style={{
            width: 56,
            height: 56,
            background: "var(--navy)",
            color: "var(--ivory)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          className="serif"
        >
          <span style={{ fontSize: 28, fontWeight: 400 }}>{initial}</span>
        </div>
      )}

      <div style={{ minWidth: 0 }}>
        <div className="cap-gold" style={{ marginBottom: 4 }}>
          {stockData.ticker}
          {stockData.sector && <span style={{ marginLeft: 10, color: "var(--ink-3)" }}>· {stockData.sector}</span>}
        </div>
        <h1
          className="serif"
          style={{
            fontWeight: 400,
            fontSize: "clamp(24px, 3vw, 36px)",
            lineHeight: 1.1,
            margin: 0,
            letterSpacing: "-0.015em",
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {stockData.companyName}
        </h1>
        {stockData.industry && (
          <div className="body-small" style={{ marginTop: 4 }}>{stockData.industry}</div>
        )}
      </div>

      {stockData.currentPrice != null && (
        <div style={{ textAlign: "right" }}>
          <div className="cap" style={{ marginBottom: 4 }}>Última</div>
          <div className="mono" style={{ fontSize: 26, color: "var(--ink)", letterSpacing: "-0.01em" }}>
            {currencyPrefix(stockData.currency)}
            {stockData.currentPrice.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {changePct && (
            <div className="mono" style={{ fontSize: 13, color: priceColor(stockData.priceChangePercent), marginTop: 2 }}>
              {changePct}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
