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
type ErrorKind = "generic" | "analysis_unavailable";

export default function AnalyzePage() {
  const [ticker, setTicker] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [partialStockData, setPartialStockData] = useState<StockData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind>("generic");
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

  async function analyze(tickerInput: string, refresh = false) {
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
    setErrorKind("generic");

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
        if (!res.ok) {
          const e = new Error(data.error ?? "Unknown error") as Error & { code?: string };
          if (typeof data.code === "string") e.code = data.code;
          throw e;
        }
        setResult({ report: data.report, stockData: data.stockData });
        setStatus("done");
        return;
      }

      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let receivedDone = false;
      // The final {done: true, report, stockData} payload is large enough to
      // span multiple TCP chunks. Buffer partial lines across reads so a split
      // mid-payload doesn't drop the message and force the retry path below.
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const newlineIdx = buffer.lastIndexOf("\n");
        if (newlineIdx === -1) continue;
        const complete = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);

        for (const line of complete.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;

          let msg: Record<string, unknown>;
          try { msg = JSON.parse(payload); } catch { continue; }

          if (msg.error) {
            const e = new Error(msg.error as string) as Error & { code?: string };
            if (typeof msg.code === "string") e.code = msg.code;
            throw e;
          }
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
        const e = new Error("La respuesta fue interrumpida. Intentá de nuevo.") as Error & { code?: string };
        e.code = "analysis_unavailable";
        throw e;
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      const code = (err as { code?: string })?.code;
      setErrorKind(code === "analysis_unavailable" ? "analysis_unavailable" : "generic");
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
    <main className="min-h-screen bg-[#F8F9FF] text-[#03065E] pt-20">
      {/* Search bar — sticky bajo la nav institucional (h-16 móvil, h-20 desktop) */}
      <header className="sticky top-16 sm:top-20 z-10 bg-[#03065E] shadow-md">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex gap-2 items-center">
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

        {status === "error" && errorKind === "analysis_unavailable" && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 text-amber-900 text-sm">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 shrink-0 text-amber-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="font-semibold mb-1">Análisis no disponible por el momento</p>
                <p className="text-amber-800/90">
                  El servicio de análisis está experimentando demoras. Intente nuevamente en unos minutos.
                </p>
                <button
                  onClick={() => activeTicker.current && analyze(activeTicker.current, true)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium px-3 py-1.5 transition-colors"
                >
                  Reintentar
                </button>
              </div>
            </div>
          </div>
        )}

        {status === "error" && errorKind !== "analysis_unavailable" && (
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
