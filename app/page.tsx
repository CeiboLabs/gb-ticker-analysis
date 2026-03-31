"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { LoadingState } from "@/components/LoadingState";
import { ReportView } from "@/components/ReportView";
import type { StructuredReport } from "@/types/Report";
import type { StockData } from "@/types/StockData";

interface AnalysisResult {
  report: StructuredReport;
  stockData: StockData;
  cached: boolean;
}

type Status = "idle" | "loading" | "done" | "error";

export default function Home() {
  const [ticker, setTicker] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [partialStockData, setPartialStockData] = useState<StockData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const activeTicker = useRef<string>("");
  const controllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use native DOM events (bypasses React synthetic event issues on some browsers)
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const update = () => setCanSubmit(!!input.value.trim());
    input.addEventListener("input", update);
    input.addEventListener("compositionend", update);
    return () => {
      input.removeEventListener("input", update);
      input.removeEventListener("compositionend", update);
    };
  }, []);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("ticker");
    if (t) {
      const upper = t.toUpperCase();
      setTicker(upper);
      if (inputRef.current) {
        inputRef.current.value = upper;
        setCanSubmit(true);
      }
      analyze(upper);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function analyze(tickerInput: string, refresh = false) {
    const t = tickerInput.trim().toUpperCase();
    if (!t) return;

    // Abort any in-flight request before starting a new one
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    activeTicker.current = t;
    window.history.pushState({}, "", `?ticker=${encodeURIComponent(t)}`);
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
        setResult({ report: data.report, stockData: data.stockData, cached: true });
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
            setResult({ report: msg.report as StructuredReport, stockData: msg.stockData as StockData, cached: false });
            setStatus("done");
          } else if (msg.stockData) {
            // Early stockData event — show header & metrics while report is generating
            setPartialStockData(msg.stockData as StockData);
          }
        }
      }

      if (!receivedDone) {
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = inputRef.current?.value ?? ticker;
    if (!val.trim()) return;
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
        <div className="max-w-3xl mx-auto px-4 py-4">
          <form onSubmit={handleSubmit} className="flex gap-2 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-bengochea.svg"
              alt="Gastón Bengochea"
              className="hidden sm:block h-7 w-auto shrink-0 mr-2 cursor-pointer"
              style={{ filter: "brightness(0) invert(1)" }}
              onClick={() => {
                if (status === "loading") return;
                if (inputRef.current) inputRef.current.value = "";
                setCanSubmit(false);
                setTicker("");
                setStatus("idle");
                setResult(null);
                setPartialStockData(null);
                setError(null);
                activeTicker.current = "";
                window.history.pushState({}, "", "/");
              }}
            />
            <div className="hidden sm:block w-px h-5 bg-white/20 mr-1" />
            <input
              ref={inputRef}
              type="text"
              defaultValue=""
              placeholder="Ingresá un ticker… AAPL, TSLA, MSFT"
              maxLength={10}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={status === "loading"}
              className="ticker-input flex-1 bg-white/15 border border-white/25 rounded-xl px-4 py-2.5 text-white placeholder-white/40 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-transparent uppercase disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="px-3 py-2.5 sm:px-5 bg-white text-[#03065E] hover:bg-[#E8ECFF] font-semibold rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Analizar
            </button>
          </form>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {status === "idle" && (
          <div className="text-center py-12 sm:py-24 select-none">
            <div className="text-4xl font-bold text-[#03065E]/10 mb-3 tracking-widest uppercase">
              Bengochea
            </div>
            <p className="text-xs tracking-[0.3em] uppercase text-[#03065E]/40">
              Corredor de Bolsa · Análisis Institucional
            </p>
            <Link
              href="/compare"
              className="inline-block mt-6 text-xs text-[#03065E]/40 hover:text-[#03065E]/70 transition-colors tracking-widest uppercase font-semibold"
            >
              Comparar acciones →
            </Link>
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
            cached={result.cached}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        )}
      </div>
    </main>
  );
}
