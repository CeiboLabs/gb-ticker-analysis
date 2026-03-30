"use client";

import type { StockData } from "@/types/StockData";

interface Props {
  stockData: StockData;
}

export function AnalystConsensus({ stockData: d }: Props) {
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
    upside != null ? `${upside >= 0 ? "+" : ""}${upside.toFixed(1)}%` : null;

  const bars: { label: string; count: number; color: string }[] = [
    { label: "Compra Fuerte", count: d.analystStrongBuy, color: "bg-emerald-500" },
    { label: "Compra", count: d.analystBuy, color: "bg-emerald-400" },
    { label: "Mantener", count: d.analystHold, color: "bg-yellow-400" },
    { label: "Vender", count: d.analystSell, color: "bg-red-400" },
    { label: "Venta Fuerte", count: d.analystStrongSell, color: "bg-red-600" },
  ];

  return (
    <div className="bg-white border border-[#03065E]/10 rounded-xl p-4 mb-6 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[#03065E]/50 mb-4">
        Consenso de Analistas
      </h2>

      <div className="flex gap-6 flex-wrap">
        {d.targetMeanPrice != null && (
          <div className="flex-1 min-w-[140px]">
            <div className="text-xs text-[#707070] mb-1">Precio Objetivo Medio</div>
            <div className="font-mono font-bold text-[#03065E] text-xl">
              ${d.targetMeanPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            {upsideStr && (
              <div className={`text-sm font-mono font-medium mt-0.5 ${(upside ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {upsideStr} potencial
              </div>
            )}
            {d.targetLowPrice != null && d.targetHighPrice != null && (
              <div className="text-xs text-[#707070] mt-1">
                Rango: ${d.targetLowPrice.toFixed(2)} – ${d.targetHighPrice.toFixed(2)}
              </div>
            )}
          </div>
        )}

        {total > 0 && (
          <div className="flex-[2] min-w-[200px]">
            <div className="text-xs text-[#707070] mb-2">
              {d.numberOfAnalystOpinions ?? total} analistas · {bullish} alcistas · {d.analystHold} neutros · {bearish} bajistas
            </div>
            <div className="flex h-3 rounded-full overflow-hidden gap-px mb-3">
              {bars.map((b) =>
                b.count > 0 ? (
                  <div
                    key={b.label}
                    className={b.color}
                    style={{ width: `${(b.count / total) * 100}%` }}
                    title={`${b.label}: ${b.count}`}
                  />
                ) : null
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {bars.map((b) => (
                <div key={b.label} className="flex items-center gap-1 text-xs text-[#707070]">
                  <div className={`w-2 h-2 rounded-sm ${b.color}`} />
                  {b.label}: {b.count}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
