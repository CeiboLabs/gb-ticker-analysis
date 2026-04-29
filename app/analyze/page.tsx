"use client";

import { useState, useRef, useEffect } from "react";
import { LoadingState } from "@/components/LoadingState";
import { ReportView } from "@/components/ReportView";
import { TickerSearch } from "@/components/TickerSearch";
import { MarketStatus } from "@/components/MarketStatus";
import type { StructuredReport } from "@/types/Report";
import type { StockData } from "@/types/StockData";

interface AnalysisResult {
  report: StructuredReport;
  stockData: StockData;
}

type Status = "idle" | "loading" | "done" | "error";

export default function AnalyzePage() {
  const [ticker, setTicker] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [partialStockData, setPartialStockData] = useState<StockData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const activeTicker = useRef<string>("");
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function loadFromUrl() {
      const t = new URLSearchParams(window.location.search).get("ticker");
      if (t) {
        const upper = t.toUpperCase();
        if (upper === activeTicker.current) return;
        setTicker(upper);
        analyze(upper);
      } else if (activeTicker.current) {
        // Back-navigated to /analyze with no ticker — return to landing
        window.location.replace("/");
      }
    }
    loadFromUrl();
    window.addEventListener("popstate", loadFromUrl);
    return () => window.removeEventListener("popstate", loadFromUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function analyze(tickerInput: string, refresh = false, isRetry = false) {
    const t = tickerInput.trim().toUpperCase();
    if (!t) return;

    // Abort any in-flight request before starting a new one
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const previousTicker = activeTicker.current;
    activeTicker.current = t;
    const newSearch = `?ticker=${encodeURIComponent(t)}`;
    if (window.location.search !== newSearch) {
      // Only push a new history entry when actually changing tickers; on initial
      // mount the URL already matches (avoid duplicate entries that break back-nav).
      if (previousTicker) {
        window.history.pushState({}, "", `/analyze${newSearch}`);
      } else {
        window.history.replaceState({}, "", `/analyze${newSearch}`);
      }
    }
    setError(null);

    if (refresh) {
      setIsRefreshing(true);
    } else {
      setStatus("loading");
      setResult(null);
      setPartialStockData(null);
    }

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: t, refresh }),
        signal: controller.signal,
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Unknown error");
        setResult({ report: data.report, stockData: data.stockData });
        setStatus("done");
        return;
      }

      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let receivedDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;

          let msg: Record<string, unknown>;
          try { msg = JSON.parse(payload); } catch { continue; }

          if (msg.error) throw new Error(msg.error as string);
          if (msg.done && msg.report && msg.stockData) {
            receivedDone = true;
            setResult({ report: msg.report as StructuredReport, stockData: msg.stockData as StockData });
            setStatus("done");
          } else if (msg.stockData) {
            // Early stockData event — show header & metrics while report is generating
            setPartialStockData(msg.stockData as StockData);
          }
        }
      }

      if (!receivedDone) {
        // The server likely completed and cached the result before the stream was cut.
        // Retry once — the cache hit will resolve instantly.
        if (!isRetry) return analyze(tickerInput, false, true);
        throw new Error("La respuesta fue interrumpida. Intentá de nuevo.");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Algo salió mal.");
      setStatus("error");
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleSearch(val: string) {
    setTicker(val);
    analyze(val);
  }

  function handleRefresh() {
    if (activeTicker.current) analyze(activeTicker.current, true);
  }

  return (
    <main className="min-h-screen bg-[#F8F9FF] text-[#03065E]">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-[#03065E] shadow-md">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex gap-2 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-bengochea.svg?v=2"
              alt="Gastón Bengochea"
              className="hidden sm:block h-7 w-auto shrink-0 mr-2 cursor-pointer"
              onClick={() => {
                if (status === "loading") return;
                window.location.href = "/";
              }}
            />
            <div className="hidden sm:block w-px h-5 bg-white/20 mr-1" />
            <TickerSearch
              variant="header"
              onSubmit={handleSearch}
              disabled={status === "loading"}
              defaultValue={ticker}
            />
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        <div className="flex justify-end -mt-2 mb-4 sm:mb-6">
          <MarketStatus tone="light" />
        </div>

        {status === "idle" && (
          <div className="text-center py-12 sm:py-24 select-none">
            <div className="text-3xl sm:text-4xl font-bold text-[#03065E]/10 mb-3 tracking-widest uppercase">
              Bengochea
            </div>
            <p className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-[#03065E]/40">
              Corredor de Bolsa · Análisis Institucional
            </p>
          </div>
        )}

        {status === "loading" && <LoadingState ticker={ticker} stockData={partialStockData} />}

        {status === "error" && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-5 text-red-700 text-sm">
            <strong>Error:</strong> {error ?? "Algo salió mal."}
          </div>
        )}

        {(status === "done" || isRefreshing) && result && (
          <ReportView
            report={result.report}
            stockData={result.stockData}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        )}
      </div>
    </main>
  );
}
