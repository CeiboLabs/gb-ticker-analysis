"use client";

import type { StockData } from "@/types/StockData";
import { currencyPrefix } from "@/lib/currencyPrefix";

interface Props {
  stockData: StockData;
}

export function AnalystConsensus({ stockData: d }: Props) {
  const pfx = currencyPrefix(d.currency);
  const total =
    d.analystStrongBuy + d.analystBuy + d.analystHold + d.analystSell + d.analystStrongSell;

  if (total === 0 && !d.targetMeanPrice) return null;

  const bullish = d.analystStrongBuy + d.analystBuy;
  const bearish = d.analystSell + d.analystStrongSell;

  const upside =
    d.targetMeanPrice != null && d.currentPrice != null
      ? ((d.targetMeanPrice - d.currentPrice) / d.currentPrice) * 100
      : null;

  const upsideStr =
    upside != null ? `${upside >= 0 ? "+" : "−"}${Math.abs(upside).toFixed(1).replace(".", ",")} %` : null;

  const bars: { label: string; count: number; color: string }[] = [
    { label: "Compra fuerte", count: d.analystStrongBuy, color: "var(--pos)" },
    { label: "Compra", count: d.analystBuy, color: "#3F8B66" },
    { label: "Mantener", count: d.analystHold, color: "var(--neu)" },
    { label: "Vender", count: d.analystSell, color: "#B05050" },
    { label: "Venta fuerte", count: d.analystStrongSell, color: "var(--neg)" },
  ];

  return (
    <div
      style={{
        borderTop: "1px solid var(--ink)",
        borderBottom: "1px solid var(--rule)",
        padding: "var(--space-5) 0",
        marginBottom: "var(--space-5)",
      }}
    >
      <div className="cap-gold" style={{ marginBottom: "var(--space-3)" }}>Consenso de Wall Street</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)",
          gap: "var(--space-6)",
          alignItems: "start",
        }}
        className="consensus-grid"
      >
        {d.targetMeanPrice != null && (
          <div>
            <div className="cap" style={{ marginBottom: 4 }}>Precio objetivo · medio</div>
            <div
              className="mono"
              style={{
                fontSize: 32,
                color: "var(--ink)",
                letterSpacing: "-0.01em",
                fontWeight: 500,
              }}
            >
              {pfx}{d.targetMeanPrice.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            {upsideStr && (
              <div
                className="mono"
                style={{
                  fontSize: 14,
                  color: (upside ?? 0) >= 0 ? "var(--pos)" : "var(--neg)",
                  marginTop: 4,
                }}
              >
                {upsideStr} potencial
              </div>
            )}
            {d.targetLowPrice != null && d.targetHighPrice != null && (
              <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8 }}>
                Rango {pfx}{d.targetLowPrice.toFixed(2).replace(".", ",")} – {pfx}{d.targetHighPrice.toFixed(2).replace(".", ",")}
              </div>
            )}
          </div>
        )}

        {total > 0 && (
          <div>
            <div className="cap" style={{ marginBottom: "var(--space-2)" }}>
              {total} analistas · {bullish} alcistas · {d.analystHold} neutros · {bearish} bajistas
            </div>
            <div style={{ display: "flex", height: 10, marginBottom: "var(--space-3)", border: "1px solid var(--rule)" }}>
              {bars.map((b) =>
                b.count > 0 ? (
                  <div
                    key={b.label}
                    style={{ background: b.color, width: `${(b.count / total) * 100}%` }}
                    title={`${b.label}: ${b.count}`}
                  />
                ) : null
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 18px" }}>
              {bars.map((b) => (
                <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, background: b.color, display: "inline-block" }} />
                  <span className="cap" style={{ color: "var(--ink-2)" }}>
                    {b.label} <span className="mono" style={{ marginLeft: 6, color: "var(--ink)" }}>{b.count}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 760px) {
          .consensus-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
