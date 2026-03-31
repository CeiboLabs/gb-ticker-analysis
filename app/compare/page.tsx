"use client";

import { useState } from "react";
import Link from "next/link";
import { CompareView } from "@/components/CompareView";
import type { CompareTickerResult } from "@/components/CompareView";

type Status = "idle" | "loading" | "done" | "error";

export default function ComparePage() {
  const [tickers, setTickers] = useState<string[]>(["", ""]);
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<CompareTickerResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateTicker(index: number, value: string) {
    setTickers((prev) => prev.map((t, i) => (i === index ? value.toUpperCase() : t)));
  }

  function addTicker() {
    if (tickers.length < 3) setTickers((prev) => [...prev, ""]);
  }

  function removeTicker(index: number) {
    if (tickers.length > 2) setTickers((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const filtered = tickers.map((t) => t.trim()).filter(Boolean);
    if (filtered.length < 2) {
      setError("Ingresá al menos 2 tickers.");
      return;
    }

    setStatus("loading");
    setResults(null);
    setError(null);

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: filtered }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error desconocido.");
      setResults(data.results);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal.");
      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F9FF] text-[#03065E]">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-[#03065E] shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-2 sm:items-center">
            {/* Back link + logo */}
            <Link
              href="/"
              className="text-white/60 hover:text-white text-xs font-medium transition-colors whitespace-nowrap mr-1"
            >
              ← Volver
            </Link>
            <div className="hidden sm:block w-px h-5 bg-white/20 mr-1" />

            {/* Ticker inputs */}
            <div className="flex gap-2 w-full sm:flex-1 flex-wrap">
              {tickers.map((t, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={t}
                    onChange={(e) => updateTicker(i, e.target.value)}
                    placeholder={`Ticker ${i + 1}`}
                    maxLength={10}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="flex-1 min-w-[96px] max-w-[140px] bg-white/15 border border-white/25 rounded-xl px-3 py-2 text-white placeholder-white/40 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-transparent"
                  />
                  {tickers.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeTicker(i)}
                      className="text-white/50 hover:text-white text-lg leading-none px-1 transition-colors"
                      aria-label="Eliminar ticker"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {tickers.length < 3 && (
                <button
                  type="button"
                  onClick={addTicker}
                  className="text-white/60 hover:text-white text-xs font-medium px-2 py-2 border border-white/20 rounded-xl transition-colors whitespace-nowrap"
                >
                  + Agregar
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full sm:w-auto px-5 py-2 bg-white text-[#03065E] hover:bg-[#E8ECFF] disabled:opacity-50 disabled:cursor-not-allowed font-semibold rounded-xl text-sm transition-colors"
            >
              {status === "loading" ? "Comparando…" : "Comparar"}
            </button>
          </form>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Idle state */}
        {status === "idle" && (
          <div className="text-center py-16 text-[#707070]">
            <p className="text-base font-medium text-[#03065E]/60">
              Ingresá 2 o 3 tickers para comparar métricas clave lado a lado.
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {status === "loading" && (
          <div className="space-y-3 animate-pulse">
            <div className="flex gap-4 mb-6">
              {tickers.filter(Boolean).map((_, i) => (
                <div key={i} className="flex-1 h-16 bg-[#03065E]/8 rounded-xl" />
              ))}
            </div>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-8 bg-[#03065E]/6 rounded-lg" />
            ))}
          </div>
        )}

        {/* Error */}
        {status === "error" && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {status === "done" && results && (
          <div className="bg-white rounded-2xl border border-[#03065E]/10 shadow-sm p-6">
            <CompareView results={results} />
          </div>
        )}
      </div>
    </main>
  );
}
