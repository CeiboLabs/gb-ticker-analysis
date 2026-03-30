"use client";

import { useState } from "react";
import type { StockData } from "@/types/StockData";

interface Props {
  stockData: StockData;
}

function priceColor(change: number | null): string {
  if (change == null) return "text-[#707070]";
  return change >= 0 ? "text-emerald-600" : "text-red-600";
}

export function ReportHeader({ stockData }: Props) {
  const [fallback, setFallback] = useState(0);
  const initial = stockData.ticker.charAt(0);

  const logoSources = stockData.domain
    ? [
        `https://logo.clearbit.com/${stockData.domain}`,
        `https://www.google.com/s2/favicons?domain=${stockData.domain}&sz=64`,
      ]
    : [];

  const logoUrl = logoSources[fallback] ?? null;

  const changeSign = (stockData.priceChangePercent ?? 0) >= 0 ? "+" : "";
  const changePct =
    stockData.priceChangePercent != null
      ? `${changeSign}${(stockData.priceChangePercent * 100).toFixed(2)}%`
      : null;

  return (
    <div className="flex items-center gap-4 mb-6">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={stockData.companyName}
          width={48}
          height={48}
          className="rounded-xl object-contain bg-white p-1 shadow-sm border border-[#03065E]/10"
          onError={() => setFallback((f) => f + 1)}
        />
      ) : (
        <div className="w-12 h-12 rounded-xl bg-[#03065E] flex items-center justify-center text-white font-bold text-lg shadow-sm">
          {initial}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-[#03065E] truncate">{stockData.companyName}</h1>
          <span className="text-sm font-mono text-white bg-[#03065E] px-2 py-0.5 rounded">
            {stockData.ticker}
          </span>
        </div>
        {stockData.sector && (
          <p className="text-sm text-[#707070] mt-0.5">
            {stockData.sector} · {stockData.industry}
          </p>
        )}
      </div>

      {stockData.currentPrice != null && (
        <div className="text-right shrink-0">
          <div className="text-2xl font-mono font-bold text-[#03065E]">
            ${stockData.currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {changePct && (
            <div className={`text-sm font-mono font-medium ${priceColor(stockData.priceChangePercent)}`}>
              {changePct}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
