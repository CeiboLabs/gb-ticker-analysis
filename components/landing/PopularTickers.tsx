"use client";

import { useEffect, useState } from "react";

interface Quote {
  symbol: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  currency: string | null;
  domain: string | null;
  viewCount: number | null;
}

interface Props {
  onSelect: (ticker: string) => void;
}

// Used only as skeleton placeholders while /api/popular is loading.
// The real list comes from the server (tracked views + curated fallback).
const SKELETON_SYMBOLS = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AMD"];

function formatPrice(p: number | null): string {
  if (p == null) return "—";
  return p.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatChange(c: number | null): string {
  if (c == null) return "—";
  const sign = c >= 0 ? "+" : "";
  return `${sign}${c.toFixed(2)}%`;
}

export function PopularTickers({ onSelect }: Props) {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/popular?limit=8`)
      .then((r) => r.json())
      .then((data: { quotes: Quote[] }) => {
        if (cancelled) return;
        setQuotes(data.quotes);
      })
      .catch(() => {
        if (!cancelled) setQuotes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="bg-[#03065E] py-14 sm:py-20 px-5 sm:px-6 border-t border-white/5">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.3em] text-white/35 text-center mb-3">
          Tendencias
        </h2>
        <p className="text-xl sm:text-3xl font-bold text-white text-center mb-8 sm:mb-10">
          Las Más Analizadas en la Plataforma
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-4">
          {(quotes ?? SKELETON_SYMBOLS.map((s) => ({ symbol: s }) as Partial<Quote> as Quote)).map(
            (q, i) => {
              const loading = quotes == null;
              const positive = (q.changePercent ?? 0) >= 0;
              return (
                <button
                  key={q.symbol}
                  type="button"
                  onClick={() => onSelect(q.symbol)}
                  className="group bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 hover:border-white/20 rounded-xl p-3 sm:p-4 text-left transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    opacity: loading ? 0.6 : 1,
                    transition: `opacity 0.4s ease-out ${i * 40}ms, background-color 0.2s, border-color 0.2s, transform 0.2s`,
                  }}
                  aria-label={`Analizar ${q.name ?? q.symbol}`}
                >
                  <div className="flex items-center gap-2 sm:gap-2.5 mb-2.5 sm:mb-3">
                    {q.domain ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/logo?domain=${q.domain}`}
                        alt=""
                        className="w-7 h-7 rounded-md object-contain bg-white p-0.5 shrink-0"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                        }}
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-md bg-white/10 shrink-0" />
                    )}
                    <span className="font-mono font-bold text-white text-sm tracking-tight">
                      {q.symbol}
                    </span>
                  </div>

                  <div className="text-[11px] sm:text-xs text-white/50 truncate mb-2.5 sm:mb-3 leading-tight">
                    {loading ? "—" : q.name}
                  </div>

                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-white">
                      {loading ? "—" : `$${formatPrice(q.price)}`}
                    </span>
                    <span
                      className={`font-mono text-xs font-medium ${
                        loading
                          ? "text-white/30"
                          : positive
                            ? "text-emerald-400"
                            : "text-red-400"
                      }`}
                    >
                      {loading ? "—" : formatChange(q.changePercent)}
                    </span>
                  </div>
                </button>
              );
            },
          )}
        </div>
      </div>
    </section>
  );
}
