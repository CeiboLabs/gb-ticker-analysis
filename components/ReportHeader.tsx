"use client";

import { useState } from "react";
import type { StockData } from "@/types/StockData";
import { currencyPrefix } from "@/lib/currencyPrefix";

interface Props {
  stockData: StockData;
}

function priceColor(change: number | null): string {
  if (change == null) return "text-[#707070]";
  return change >= 0 ? "text-emerald-600" : "text-red-600";
}

export function ReportHeader({ stockData }: Props) {
  const [logoFailed, setLogoFailed] = useState(false);
  const initial = stockData.ticker.charAt(0);

  const logoUrl = !logoFailed && stockData.domain
    ? `https://www.google.com/s2/favicons?domain=${stockData.domain}&sz=128`
    : null;

  const changeSign = (stockData.priceChangePercent ?? 0) >= 0 ? "+" : "";
  const changePct =
    stockData.priceChangePercent != null
      ? `${changeSign}${(stockData.priceChangePercent * 100).toFixed(2)}%`
      : null;

  return (
    <div className="flex items-center gap-3 mb-6 sm:gap-4">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={stockData.companyName}
          width={48}
          height={48}
          style={{ imageRendering: "auto" }}
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-contain bg-white p-1 shadow-sm border border-[#03065E]/10 shrink-0"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#03065E] flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
          {initial}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h1 className="text-base sm:text-2xl font-bold text-[#03065E] truncate max-w-full">{stockData.companyName}</h1>
          <span className="text-[11px] sm:text-sm font-mono text-white bg-[#03065E] px-1.5 sm:px-2 py-0.5 rounded shrink-0">
            {stockData.ticker}
          </span>
        </div>
        {stockData.sector && (
          <p className="text-xs sm:text-sm text-[#707070] mt-0.5 truncate">
            {stockData.sector} · {stockData.industry}
          </p>
        )}
      </div>

      {stockData.currentPrice != null && (
        <div className="text-right shrink-0 sm:ml-auto">
          <div className="text-lg sm:text-2xl font-mono font-bold text-[#03065E] tabular-nums">
            {currencyPrefix(stockData.currency)}{stockData.currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {changePct && (
            <div className={`text-xs sm:text-sm font-mono font-medium tabular-nums ${priceColor(stockData.priceChangePercent)}`}>
              {changePct}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
