"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import type { StockData } from "@/types/StockData";
import type { StructuredReport, SegmentSankeyData } from "@/types/Report";
import { LineChart, BarChart, Spark, DonutChart, type SankeyData } from "@/components/analyze/charts";
import { SankeyChart } from "@/components/SankeyChart";
import { buildWorkstation, type WorkstationData } from "@/components/analyze/adapter";

const TAPE_CHIPS = ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN"];

const NAV_SECTIONS = [
  ["p01", "Tesis de inversión"],
  ["p02", "Resumen del negocio"],
  ["p03", "Métricas y KPIs"],
  ["p04", "Precio y trimestrales"],
  ["p05", "Income statement"],
  ["p06", "Wall Street"],
  ["p07", "Riesgos · catalizadores"],
  ["p08", "Conclusión"],
] as const;

const PERIODS = ["1M", "6M", "1Y", "3Y", "5Y"] as const;
type Period = (typeof PERIODS)[number];

type Status = "idle" | "loading" | "partial" | "done" | "error";
type ErrorKind = "generic" | "analysis_unavailable";

/* ──────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────── */

function fmtNum(n: number, dec = 2): string {
  const fixed = n.toFixed(dec);
  const [whole, frac] = fixed.split(".");
  const withSep = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return frac ? `${withSep},${frac}` : withSep;
}
function fmtPct(n: number | null | undefined, dec = 2): string {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "−";
  return `${sign}${fmtNum(Math.abs(n), dec)} %`;
}
function fmtSigned(n: number | null | undefined, dec = 2): string {
  if (n == null) return "—";
  const sign = n >= 0 ? "+" : "−";
  return `${sign}${fmtNum(Math.abs(n), dec)}`;
}

/* ──────────────────────────────────────────────────────────────
   Icons
   ────────────────────────────────────────────────────────────── */

function Icon({ d, size = 14, fill }: { d: string; size?: number; fill?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d.split("|").map((p, i) => (<path key={i} d={p} />))}
    </svg>
  );
}
const ICON_PDF = "M8 3h7l4 4v14H8z|14 3v4h5|9 13h6|9 17h4";
const ICON_DOWNLOAD = "M12 4v12|7 11l5 5 5-5|4 20h16";
const ICON_REFRESH = "M3 12a9 9 0 0 1 15.5-6.3L21 8|21 4v4h-4|21 12a9 9 0 0 1-15.5 6.3L3 16|3 20v-4h4";
const ICON_STAR = "M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z";
const ICON_SHIELD = "M12 3l8 3v7c0 4.5-3.5 7.5-8 8-4.5-.5-8-3.5-8-8V6z|9 12l2 2 4-4";

/* ──────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────── */

export default function AnalyzePage() {
  return (
    <Suspense fallback={<div style={{ paddingTop: "var(--nav-h)" }} />}>
      <AnalyzePageInner />
    </Suspense>
  );
}

function AnalyzePageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const urlTicker = params.get("ticker")?.toUpperCase() ?? null;

  const [stockData, setStockData] = useState<StockData | null>(null);
  const [report, setReport] = useState<StructuredReport | null>(null);
  const [status, setStatus] = useState<Status>(urlTicker ? "loading" : "idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind>("generic");
  const [input, setInput] = useState("");
  const [activeSection, setActiveSection] = useState<string>("p01");

  const activeTicker = useRef<string>("");
  const controllerRef = useRef<AbortController | null>(null);

  const ticker = stockData?.ticker ?? urlTicker ?? "";
  const data = useMemo<WorkstationData | null>(() => {
    if (!stockData) return null;
    return buildWorkstation(stockData, report);
  }, [stockData, report]);

  const analyze = useCallback(async (symbol: string, refresh = false) => {
    const t = symbol.trim().toUpperCase();
    if (!t) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const previousTicker = activeTicker.current;
    activeTicker.current = t;
    const newSearch = `?ticker=${encodeURIComponent(t)}`;
    if (typeof window !== "undefined" && window.location.search !== newSearch) {
      if (previousTicker) {
        window.history.pushState({}, "", `/analyze${newSearch}`);
      } else {
        window.history.replaceState({}, "", `/analyze${newSearch}`);
      }
    }

    setErrorMsg(null);
    setErrorKind("generic");
    setStatus("loading");
    setStockData(null);
    setReport(null);
    setActiveSection("p01");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: t, refresh }),
        signal: controller.signal,
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const json = await res.json();
        if (!res.ok) {
          const e = new Error(json.error ?? "Unknown error") as Error & { code?: string };
          if (typeof json.code === "string") e.code = json.code;
          throw e;
        }
        setStockData(json.stockData);
        setReport(json.report);
        setStatus("done");
        return;
      }

      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let receivedDone = false;
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
            setStockData(msg.stockData as StockData);
            setReport(msg.report as StructuredReport);
            setStatus("done");
          } else if (msg.stockData) {
            setStockData(msg.stockData as StockData);
            setStatus("partial");
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
      setErrorMsg(err instanceof Error ? err.message : "Algo salió mal.");
      setStatus("error");
    }
  }, [router]);

  function selectTicker(symbol: string) {
    const s = symbol.toUpperCase().trim();
    if (!s) return;
    if (s === activeTicker.current && status !== "error") return;
    analyze(s);
  }

  // Initial load from URL
  useEffect(() => {
    if (urlTicker && urlTicker !== activeTicker.current) {
      analyze(urlTicker);
    }
    // Listen to back/forward
    function onPop() {
      const t = new URLSearchParams(window.location.search).get("ticker")?.toUpperCase();
      if (t && t !== activeTicker.current) analyze(t);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scrollspy
  useEffect(() => {
    function onScroll() {
      const y = window.scrollY + 200;
      let last: string = NAV_SECTIONS[0][0];
      for (const [id] of NAV_SECTIONS) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.offsetTop <= y) last = id;
      }
      setActiveSection(last);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [status]);

  // Scroll to top once we have data
  const wasLoading = useRef(false);
  useEffect(() => {
    if (status === "done" && wasLoading.current) {
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
    wasLoading.current = status === "loading" || status === "partial";
  }, [status]);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 130;
    window.scrollTo({ top, behavior: "smooth" });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim()) {
      selectTicker(input);
      setInput("");
    }
  }

  function handleRefresh() {
    if (activeTicker.current) analyze(activeTicker.current, true);
  }

  return (
    <main className="analyze-root" style={{ background: "var(--ivory)", color: "var(--ink)", paddingTop: "var(--nav-h)" }}>
      {data ? (
        <TickerTape data={data} chips={TAPE_CHIPS} current={ticker} onSelect={selectTicker} input={input} setInput={setInput} onSubmit={handleSubmit} />
      ) : (
        <EmptyTape chips={TAPE_CHIPS} current={ticker} onSelect={selectTicker} input={input} setInput={setInput} onSubmit={handleSubmit} />
      )}

      <div
        className="analyze-shell"
        style={{
          display: "grid",
          gridTemplateColumns: "240px minmax(0, 1fr)",
          maxWidth: 1440,
          margin: "0 auto",
        }}
      >
        <Sidebar
          data={data}
          activeSection={activeSection}
          onNavClick={scrollTo}
          current={ticker}
          status={status}
          onRefresh={handleRefresh}
        />
        <div className="analyze-main" style={{ borderLeft: "1px solid var(--rule)", background: "var(--paper)", minWidth: 0 }}>
          {status === "idle" && <IdleHero />}
          {status === "error" && <ErrorPanel kind={errorKind} message={errorMsg} onRetry={handleRefresh} />}
          {(status === "loading" || status === "partial" || status === "done") && data && (
            <>
              <Panel01Tesis data={data} ticker={ticker} hasReport={!!report} />
              <Panel02Business data={data} hasReport={!!report} />
              <Panel03KPIs data={data} />
              <Panel04PriceQuarters data={data} ticker={ticker} />
              <Panel05Income data={data} hasReport={!!report} segmentData={report?.segmentData ?? null} />
              <Panel06WallStreet data={data} ticker={ticker} hasReport={!!report} />
              <Panel07RisksCatalysts data={data} hasReport={!!report} />
              <Panel08Conclusion data={data} hasReport={!!report} />
              <Panel09Disclaimer />
            </>
          )}
          {status === "loading" && !data && <LoadingShell ticker={ticker || input || "..."} />}
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .analyze-shell { grid-template-columns: 1fr !important; }
          .analyze-sidebar { display: none !important; }
          .analyze-main { border-left: 0 !important; }
        }
        @media (max-width: 1100px) {
          .tape-strip { display: none !important; }
        }
      `}</style>
    </main>
  );
}

/* ──────────────────────────────────────────────────────────────
   Tape (con data) y EmptyTape (sin data)
   ────────────────────────────────────────────────────────────── */

function tapeShellStyle(): React.CSSProperties {
  return {
    position: "sticky",
    top: "var(--nav-h)",
    zIndex: 40,
    background: "var(--navy)",
    color: "var(--ivory)",
    borderBottom: "1px solid rgba(255,255,255,0.18)",
  };
}

function TapeForm({
  chips,
  current,
  onSelect,
  input,
  setInput,
  onSubmit,
}: {
  chips: string[];
  current: string;
  onSelect: (s: string) => void;
  input: string;
  setInput: (s: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <form onSubmit={onSubmit} style={{ display: "flex", gap: 0 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="TICKER"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.25)",
            color: "var(--ivory)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            padding: "8px 12px",
            outline: "none",
            width: 96,
          }}
        />
        <button
          type="submit"
          style={{
            background: "var(--gold)",
            color: "var(--ink)",
            fontFamily: "var(--font-sans)",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "8px 14px",
            border: "1px solid var(--gold)",
            cursor: "pointer",
          }}
        >
          Run
        </button>
      </form>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {chips.map((c) => {
          const active = c === current;
          return (
            <button
              key={c}
              onClick={() => onSelect(c)}
              style={{
                background: active ? "var(--gold)" : "transparent",
                color: active ? "var(--ink)" : "rgba(255,255,255,0.72)",
                border: `1px solid ${active ? "var(--gold)" : "rgba(255,255,255,0.18)"}`,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                padding: "5px 9px",
                letterSpacing: "0.04em",
                cursor: "pointer",
                transition: "background 160ms ease, color 160ms ease, border-color 160ms ease",
              }}
            >
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyTape(props: {
  chips: string[];
  current: string;
  onSelect: (s: string) => void;
  input: string;
  setInput: (s: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <header className="ticker-tape" style={tapeShellStyle()}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          gap: 16,
          alignItems: "center",
          maxWidth: 1440,
          margin: "0 auto",
          padding: "10px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="pulse-dot" />
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: "var(--gold-soft)", letterSpacing: "0.02em", lineHeight: 1 }}>
              —
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 4 }}>
              Sin ticker activo
            </div>
          </div>
        </div>
        <div />
        <TapeForm {...props} />
      </div>
    </header>
  );
}

function TickerTape({
  data,
  chips,
  current,
  onSelect,
  input,
  setInput,
  onSubmit,
}: {
  data: WorkstationData;
  chips: string[];
  current: string;
  onSelect: (s: string) => void;
  input: string;
  setInput: (s: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const chg = data.change1dPct;
  const ytd = data.changeYtdPct;

  const cells: Array<[string, React.ReactNode, "ivory" | "pos" | "neg"]> = [
    ["Last", <span key="l">{fmtNum(data.price)}</span>, "ivory"],
    ["Chg", <span key="c">{fmtSigned(data.change1d)}</span>, chg >= 0 ? "pos" : "neg"],
    ["% Chg", <span key="cp">{fmtPct(chg)}</span>, chg >= 0 ? "pos" : "neg"],
    ["YTD", <span key="y">{fmtPct(ytd)}</span>, (ytd ?? 0) >= 0 ? "pos" : "neg"],
    ["Mkt Cap", <span key="mc">{data.marketCap}</span>, "ivory"],
    ["52w Rng", <span key="wr">{data.week52Low != null && data.week52High != null ? `${fmtNum(data.week52Low)} – ${fmtNum(data.week52High)}` : "—"}</span>, "ivory"],
  ];

  return (
    <header className="ticker-tape" style={tapeShellStyle()}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          gap: 16,
          alignItems: "center",
          maxWidth: 1440,
          margin: "0 auto",
          padding: "10px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="pulse-dot" />
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: "var(--gold-soft)", letterSpacing: "0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {current}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 4 }}>
              {data.exchange} · {data.currency}
            </div>
          </div>
        </div>
        <div className="tape-strip" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ display: "flex", minWidth: "max-content" }}>
            {cells.map(([label, node, tone], i) => (
              <div
                key={i}
                style={{
                  borderRight: i < cells.length - 1 ? "1px solid rgba(255,255,255,0.14)" : "none",
                  padding: "4px 16px",
                  minWidth: 110,
                }}
              >
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "rgba(255,255,255,0.55)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                  {label}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: label === "Last" ? 16 : 13,
                    color: tone === "pos" ? "#7BC9A0" : tone === "neg" ? "#E9999A" : "var(--ivory)",
                    marginTop: 4,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {node}
                </div>
              </div>
            ))}
          </div>
        </div>
        <TapeForm chips={chips} current={current} onSelect={onSelect} input={input} setInput={setInput} onSubmit={onSubmit} />
      </div>
    </header>
  );
}

/* ──────────────────────────────────────────────────────────────
   Sidebar
   ────────────────────────────────────────────────────────────── */

function Sidebar({
  data,
  activeSection,
  onNavClick,
  current,
  status,
  onRefresh,
}: {
  data: WorkstationData | null;
  activeSection: string;
  onNavClick: (id: string) => void;
  current: string;
  status: Status;
  onRefresh: () => void;
}) {
  const tone = data && data.change1dPct >= 0 ? "var(--pos)" : "var(--neg)";
  const isWorking = status === "loading" || status === "partial";

  return (
    <aside
      className="analyze-sidebar"
      style={{
        position: "sticky",
        top: "var(--nav-h)",
        height: "calc(100vh - var(--nav-h))",
        overflowY: "auto",
        background: "var(--ivory)",
        fontFamily: "var(--font-sans)",
        fontSize: 13,
      }}
    >
      {/* Snapshot */}
      <div style={{ padding: "24px 18px", borderBottom: "1px solid var(--rule)" }}>
        <div className="eyebrow-plain" style={{ marginBottom: 14 }}>Snapshot</div>
        {data ? (
          <>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 500, letterSpacing: "0.02em", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
              {current}
            </div>
            <div className="serif" style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 4, marginBottom: 12, letterSpacing: "-0.01em" }}>
              {data.name}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>
                {fmtNum(data.price)}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: tone, fontVariantNumeric: "tabular-nums" }}>
                {fmtPct(data.change1dPct)}
              </span>
            </div>
            <div style={{ marginBottom: 10 }}>
              <Spark
                data={data.spark}
                width={204}
                height={32}
                color={tone}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="pulse-dot" style={{ width: 5, height: 5 }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)" }}>
                {data.lastUpdated}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="skeleton-block" style={{ height: 20, width: 80, marginBottom: 8 }} />
            <div className="skeleton-block" style={{ height: 14, width: 140, marginBottom: 14 }} />
            <div className="skeleton-block" style={{ height: 22, marginBottom: 10 }} />
            <div className="skeleton-block" style={{ height: 32 }} />
          </>
        )}
      </div>

      {/* Reporte nav */}
      <div style={{ padding: "20px 18px", borderBottom: "1px solid var(--rule)" }}>
        <div className="eyebrow-plain" style={{ marginBottom: 12 }}>Reporte</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV_SECTIONS.map(([id, label], i) => {
            const active = activeSection === id;
            const num = String(i + 1).padStart(2, "0");
            return (
              <button
                key={id}
                role="button"
                tabIndex={0}
                className="nav-link"
                onClick={() => onNavClick(id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "26px 1fr",
                  gap: 10,
                  background: "none",
                  border: 0,
                  textAlign: "left",
                  cursor: "pointer",
                  padding: "6px 0",
                  paddingLeft: active ? 10 : 0,
                  marginLeft: active ? -10 : 0,
                  borderLeft: active ? "2px solid var(--gold)" : "2px solid transparent",
                  transition: "color 160ms ease",
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: active ? "var(--gold-deep)" : "var(--ink-3)", letterSpacing: "0.08em" }}>{num}</span>
                <span style={{ fontSize: 13, color: active ? "var(--ink)" : "var(--ink-2)" }}>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Acciones */}
      <div style={{ padding: "20px 18px", borderBottom: "1px solid var(--rule)" }}>
        <div className="eyebrow-plain" style={{ marginBottom: 12 }}>Acciones</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {([
            { icon: <Icon d={ICON_PDF} />, label: "Exportar PDF", onClick: () => window.print() },
            { icon: <Icon d={ICON_DOWNLOAD} />, label: "Descargar CSV", onClick: () => {} },
            { icon: <Icon d={ICON_STAR} />, label: "Agregar a watchlist", onClick: () => {} },
            { icon: <Icon d={ICON_REFRESH} />, label: isWorking ? "Regenerando…" : "Regenerar reporte", onClick: onRefresh },
          ] as const).map((item, i) => (
            <button
              key={i}
              onClick={item.onClick}
              disabled={isWorking && i === 3}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "none",
                border: 0,
                cursor: isWorking && i === 3 ? "not-allowed" : "pointer",
                padding: 0,
                fontFamily: "var(--font-sans)",
                fontSize: 12.5,
                color: "var(--ink-2)",
                textAlign: "left",
                opacity: isWorking && i === 3 ? 0.5 : 1,
              }}
            >
              <span style={{ color: "var(--ink-3)", display: "inline-flex" }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fuentes */}
      <div style={{ padding: "20px 18px" }}>
        <div className="eyebrow-plain" style={{ marginBottom: 10 }}>Fuentes · as of {data?.asOf ?? "—"}</div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-3)", lineHeight: 1.7 }}>
          <li>SEC EDGAR · {data?.filingRef ?? "—"}</li>
          <li>Yahoo Finance (delayed 15m)</li>
          <li>OpenAI GPT-4o · análisis</li>
        </ul>
      </div>
    </aside>
  );
}

/* ──────────────────────────────────────────────────────────────
   Panel chrome
   ────────────────────────────────────────────────────────────── */

function PanelHead({
  num,
  eyebrow,
  title,
  meta,
  children,
}: {
  num: string;
  eyebrow: string;
  title: React.ReactNode;
  meta?: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, marginBottom: 24, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="eyebrow-bar"><span>{num} · {eyebrow}</span></div>
        <h2 className="panel-h2">{title}</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        {children}
        {meta && <div className="meta-row">{meta}</div>}
      </div>
    </div>
  );
}

function panelStyle(extra?: React.CSSProperties): React.CSSProperties {
  return { padding: "28px 32px", borderBottom: "1px solid var(--rule)", ...extra };
}

/* ──────────────────────────────────────────────────────────────
   Idle hero / Loading / Error
   ────────────────────────────────────────────────────────────── */

function IdleHero() {
  return (
    <div style={{ padding: "64px 32px", textAlign: "center" }}>
      <div className="eyebrow-bar" style={{ justifyContent: "center", display: "inline-flex" }}>
        <span>Workstation · Análisis institucional</span>
      </div>
      <h1
        className="serif"
        style={{
          fontWeight: 300,
          fontSize: "clamp(36px, 5vw, 64px)",
          lineHeight: 1.05,
          letterSpacing: "-0.025em",
          margin: "12px 0 18px",
          color: "var(--ink)",
        }}
      >
        Cargá un ticker para{" "}
        <em style={{ fontStyle: "italic", fontWeight: 300, color: "var(--gold-deep)" }}>
          comenzar.
        </em>
      </h1>
      <p className="body-base" style={{ maxWidth: "32em", margin: "0 auto", color: "var(--ink-2)" }}>
        El reporte se genera en segundos a partir de Yahoo Finance, SEC EDGAR y análisis del modelo. Probá con AAPL, NVDA, MSFT, MELI o TSLA.
      </p>
    </div>
  );
}

function LoadingShell({ ticker }: { ticker: string }) {
  return (
    <div style={{ padding: 32 }}>
      <div className="eyebrow-bar" style={{ marginBottom: 12 }}>
        <span>Cargando · {ticker.toUpperCase()}</span>
      </div>
      <div className="skeleton-block" style={{ height: 200, marginBottom: 18 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton-block" style={{ height: 80 }} />
        ))}
      </div>
      <div className="skeleton-block" style={{ height: 280, marginBottom: 18 }} />
      <div className="skeleton-block" style={{ height: 120 }} />
    </div>
  );
}

function ErrorPanel({ kind, message, onRetry }: { kind: ErrorKind; message: string | null; onRetry: () => void }) {
  const title = kind === "analysis_unavailable" ? "Análisis no disponible por el momento" : "Error en el análisis";
  return (
    <div style={{ padding: 32 }}>
      <div style={{ border: "1px solid var(--rule-strong)", borderLeft: "3px solid var(--neg)", padding: "var(--space-4) var(--space-5)", background: "var(--paper)" }}>
        <div className="eyebrow-bar" style={{ color: "var(--neg)" }}><span>{title}</span></div>
        <p className="body-base" style={{ margin: "10px 0 14px" }}>
          {kind === "analysis_unavailable"
            ? "El servicio está experimentando demoras. Intentá nuevamente en unos minutos."
            : message ?? "Algo salió mal."}
        </p>
        <button onClick={onRetry} className="btn btn-secondary" style={{ padding: "8px 16px", fontSize: 13 }}>
          Reintentar
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Skeleton helpers
   ────────────────────────────────────────────────────────────── */

function ProseSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton-block" style={{ height: 12, width: i === lines - 1 ? "60%" : "100%" }} />
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Panel 01 · Tesis
   ────────────────────────────────────────────────────────────── */

function Panel01Tesis({ data, ticker, hasReport }: { data: WorkstationData; ticker: string; hasReport: boolean }) {
  const verdictColor =
    data.verdict === "BUY" ? "var(--pos)" : data.verdict === "AVOID" ? "var(--neg)" : "var(--neu)";
  const verdictItalic = data.verdict ? data.verdict.toLowerCase() + "." : "—";
  const reportId = `BGC-${ticker}-${new Date().getFullYear()}-Q4-${Math.floor(Math.random() * 99).toString().padStart(2, "0")}`;

  return (
    <section id="p01" className="analyze-panel" style={panelStyle()}>
      <div className="hairline-row" style={{ marginBottom: 24 }}>
        <div className="cell">
          <div className="label">Reporte ID</div>
          <div className="value">{reportId}</div>
        </div>
        <div className="cell">
          <div className="label">Mesa</div>
          <div className="value">Research · Bengochea &amp; Cía.</div>
        </div>
        <div className="cell">
          <div className="label">Cobertura</div>
          <div className="value">Equity Research</div>
        </div>
        <div className="cell">
          <div className="label">Horizonte</div>
          <div className="value">12 meses</div>
        </div>
        <div className="cell">
          <div className="label">Generado</div>
          <div className="value">{data.lastUpdated}</div>
        </div>
      </div>

      <div className="tesis-grid" style={{ display: "grid", gridTemplateColumns: "280px 1fr 220px", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)" }}>
        {/* Veredicto */}
        <div style={{ background: verdictColor, color: "var(--ivory)", padding: 24, borderRight: "1px solid var(--rule)" }}>
          <div className="eyebrow-bar" style={{ color: "rgba(255,255,255,0.78)" }}>
            <span style={{ background: "rgba(255,255,255,0.6)" }} />
            <span style={{ color: "rgba(255,255,255,0.78)" }}>Veredicto · Bengochea</span>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 56, fontWeight: 500, lineHeight: 1, letterSpacing: "-0.01em", marginTop: 12, marginBottom: 18 }}>
            {data.verdict ?? "···"}
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.25)", marginBottom: 14 }} />
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.7)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Target 12m</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 500, color: "var(--ivory)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
            {data.target != null ? `USD ${fmtNum(data.target, 0)}` : "—"}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.78)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
            {data.targetUpside != null ? `Upside ${fmtPct(data.targetUpside)} desde USD ${fmtNum(data.price)}` : "Upside no disponible"}
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.25)", margin: "16px 0 14px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.7)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Conviction</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--ivory)", marginTop: 4 }}>{data.conviction ?? "—"}</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.7)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Δ vs Q3</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--ivory)", marginTop: 4 }}>{data.convictionChange}</div>
            </div>
          </div>
        </div>

        {/* Tesis */}
        <div style={{ padding: 28, borderRight: "1px solid var(--rule)", minWidth: 0 }}>
          <div className="eyebrow-bar"><span>01 · Tesis de inversión</span></div>
          <h2 className="panel-h2" style={{ marginTop: 8, marginBottom: 18 }}>
            {data.verdict
              ? <>Argumentos que sostienen el veredicto <em>{verdictItalic}</em></>
              : <>Esperando la lectura del modelo<em>.</em></>}
          </h2>
          {hasReport && data.thesisMd ? (
            <div className="drop-cap" style={{ maxWidth: "70ch", color: "var(--ink-2)", fontFamily: "var(--font-serif)", fontSize: 17, lineHeight: 1.6 }}>
              <ReactMarkdown>{data.thesisMd}</ReactMarkdown>
            </div>
          ) : (
            <ProseSkeleton lines={6} />
          )}
        </div>

        {/* Quick ref */}
        <div style={{ padding: "20px 18px", minWidth: 0 }}>
          <div className="eyebrow-plain" style={{ marginBottom: 12 }}>Quick ref</div>
          <SnapshotRow label="Mercado" value={data.exchange} />
          <SnapshotRow label="Sector" value={data.sector} />
          <SnapshotRow label="Industria" value={data.industry} />
          <SnapshotRow label="Moneda" value={data.currency} />
          <div style={{ height: 1, background: "var(--rule)", margin: "12px 0" }} />
          <SnapshotRow label="P/E TTM" value={data.kpis.find(k => k[0] === "P/E TTM")?.[1] ?? "—"} />
          <SnapshotRow label="P/E Fwd" value={data.kpis.find(k => k[0] === "P/E Fwd")?.[1] ?? "—"} />
          <SnapshotRow label="EV/EBITDA" value={data.kpis.find(k => k[0] === "EV/EBITDA")?.[1] ?? "—"} />
          <SnapshotRow label="Div yield" value={data.kpis.find(k => k[0] === "Div. yield")?.[1] ?? "—"} />
          <SnapshotRow label="Beta 5y" value={data.kpis.find(k => k[0] === "Beta 5y")?.[1] ?? "—"} />

          {data.peers.length > 0 && (
            <>
              <div style={{ height: 1, background: "var(--rule)", margin: "12px 0" }} />
              <div className="eyebrow-plain" style={{ marginBottom: 8 }}>Comparables</div>
              {data.peers.map((p, i) => (
                <div
                  key={p.t}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr",
                    gap: 8,
                    padding: "5px 0",
                    borderTop: i === 0 ? "1px solid var(--rule)" : "1px dashed var(--rule-soft)",
                    alignItems: "baseline",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--navy)", fontWeight: 500 }}>{p.t}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.pe}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .tesis-grid { grid-template-columns: 1fr !important; }
          .tesis-grid > div { border-right: 0 !important; border-bottom: 1px solid var(--rule); }
        }
      `}</style>
    </section>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, padding: "5px 0", borderBottom: "1px dashed var(--rule-soft)" }}>
      <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Panel 02 · Business
   ────────────────────────────────────────────────────────────── */

function Panel02Business({ data, hasReport }: { data: WorkstationData; hasReport: boolean }) {
  return (
    <section id="p02" className="analyze-panel" style={panelStyle()}>
      <PanelHead num="02" eyebrow="Resumen del negocio" title="Qué hace la compañía y cómo gana plata." meta={`As of ${data.asOf} · ${data.filingRef}`} />

      <div className="twocol-rev" style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 32 }}>
        <div>
          <div className="eyebrow-bar" style={{ marginBottom: 10 }}><span>Drivers recientes</span></div>
          {hasReport && data.driversMd ? (
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 16, lineHeight: 1.6, color: "var(--ink-2)", maxWidth: "44ch" }}>
              <ReactMarkdown>{data.driversMd}</ReactMarkdown>
            </div>
          ) : (
            <ProseSkeleton lines={5} />
          )}
        </div>

        <div>
          {hasReport && data.businessSummaryMd ? (
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 17, lineHeight: 1.6, color: "var(--ink)", marginBottom: 20, maxWidth: "70ch" }}>
              <ReactMarkdown>{data.businessSummaryMd}</ReactMarkdown>
            </div>
          ) : (
            <div style={{ marginBottom: 20 }}>
              <ProseSkeleton lines={6} />
            </div>
          )}

          {data.segments.length > 0 && (
            <>
              <div className="eyebrow-bar" style={{ marginBottom: 10 }}><span>Mix de revenue por segmento</span></div>
              <div style={{ display: "flex", height: 22, width: "100%", border: "1px solid var(--rule)", marginBottom: 12 }}>
                {data.segments.map((s, i) => (
                  <div
                    key={s.name}
                    style={{
                      width: `${s.share}%`,
                      background: s.color,
                      borderRight: i < data.segments.length - 1 ? "1px solid rgba(255,255,255,0.15)" : "none",
                    }}
                    title={`${s.name} · ${s.share} %`}
                  />
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px 16px" }}>
                {data.segments.map((s) => (
                  <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, background: s.color, display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-2)", flex: 1 }}>{s.name}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{s.share} %</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .twocol-rev { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   Panel 03 · KPIs
   ────────────────────────────────────────────────────────────── */

function Panel03KPIs({ data }: { data: WorkstationData }) {
  const [openLabel, setOpenLabel] = useState<string | null>(null);

  return (
    <section id="p03" className="analyze-panel" style={panelStyle()}>
      <PanelHead num="03" eyebrow="Métricas y KPIs" title="Dieciséis indicadores, leídos juntos." meta={`Yahoo Finance · TTM`} />

      <div className="kpi-grid">
        {data.kpis.map(([label, value, t, info]) => (
          <KpiTile
            key={label}
            label={label}
            value={value}
            tone={t}
            info={info}
            spark={data.spark}
            isOpen={openLabel === label}
            onToggle={() => setOpenLabel(openLabel === label ? null : label)}
            onClose={() => setOpenLabel(null)}
          />
        ))}
      </div>

      <div className="iline" style={{ marginTop: 14 }}>
        <strong>Notas:</strong>
        <span className="sep">·</span>TTM = trailing twelve months
        <span className="sep">·</span>Sparklines: precio 52 semanas
      </div>
    </section>
  );
}

function KpiTile({
  label,
  value,
  tone,
  info,
  spark,
  isOpen,
  onToggle,
  onClose,
}: {
  label: string;
  value: string;
  tone: "pos" | "neg" | null;
  info?: string;
  spark: number[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [isOpen, onClose]);

  const sparkColor = tone === "pos" ? "var(--pos)" : tone === "neg" ? "var(--neg)" : "var(--navy-300)";

  return (
    <div
      ref={ref}
      className={`kpi-tight ${tone === "pos" ? "tone-pos" : tone === "neg" ? "tone-neg" : ""}`}
      style={{ position: "relative" }}
    >
      {info && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-label={`Información sobre ${label}`}
          aria-expanded={isOpen}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 16,
            height: 16,
            border: "1px solid var(--rule-strong)",
            background: isOpen ? "var(--navy)" : "transparent",
            color: isOpen ? "var(--ivory)" : "var(--ink-3)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10,
            fontWeight: 500,
            lineHeight: 1,
            cursor: "pointer",
            padding: 0,
            transition: "background 140ms ease, color 140ms ease, border-color 140ms ease",
          }}
          onMouseEnter={(e) => {
            if (!isOpen) {
              e.currentTarget.style.borderColor = "var(--ink)";
              e.currentTarget.style.color = "var(--ink)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isOpen) {
              e.currentTarget.style.borderColor = "var(--rule-strong)";
              e.currentTarget.style.color = "var(--ink-3)";
            }
          }}
        >
          i
        </button>
      )}
      <div className="label" style={{ paddingRight: info ? 22 : 0 }}>{label}</div>
      <div className="row">
        <div className="v">{value}</div>
        <Spark data={spark} color={sparkColor} />
      </div>
      {isOpen && info && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            top: 30,
            right: 8,
            left: 8,
            zIndex: 30,
            background: "var(--navy)",
            color: "var(--ivory)",
            fontFamily: "var(--font-sans), sans-serif",
            fontSize: 11.5,
            lineHeight: 1.5,
            padding: "10px 12px",
            border: "1px solid var(--navy-700)",
            boxShadow: "0 6px 24px rgba(14,17,48,0.18)",
          }}
        >
          {info}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Panel 04 · Precio y trimestrales
   ────────────────────────────────────────────────────────────── */

function Panel04PriceQuarters({ data, ticker }: { data: WorkstationData; ticker: string }) {
  const [period, setPeriod] = useState<Period>("1Y");

  const sliceLen: Record<Period, number> = { "1M": 5, "6M": 26, "1Y": 52, "3Y": 156, "5Y": 156 };
  const len = sliceLen[period];
  const pts = data.pricePath.slice(-len).map((p) => ({ y: p.y, time: p.time }));

  const haveEps = data.quarters.some((q) => q.eps != null);

  return (
    <section id="p04" className="analyze-panel" style={panelStyle()}>
      <PanelHead num="04" eyebrow="Precio y trimestrales" title={<>Precio histórico y resultados, <em>juntos en pantalla.</em></>}>
        <div style={{ display: "flex", border: "1px solid var(--rule)" }}>
          {PERIODS.map((p) => {
            const active = p === period;
            return (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  background: active ? "var(--navy)" : "transparent",
                  color: active ? "var(--ivory)" : "var(--ink-2)",
                  border: 0,
                  padding: "6px 12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  cursor: "pointer",
                }}
              >
                {p}
              </button>
            );
          })}
        </div>
      </PanelHead>

      <div className="twocol" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }}>
        <div style={{ background: "var(--paper)", border: "1px solid var(--rule)", padding: "16px 18px" }}>
          <div className="iline" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
            <span><strong>{ticker}</strong><span className="sep">·</span>{period}</span>
            <span>Live · Yahoo Finance</span>
          </div>
          {pts.length > 1 ? (
            <LineChart
              height={280}
              formatY={(n) => fmtNum(n, 0)}
              showLastValue
              series={[{ points: pts, color: "var(--navy)", area: true, label: ticker }]}
            />
          ) : (
            <div className="skeleton-block" style={{ height: 280 }} />
          )}
        </div>

        <div style={{ background: "var(--paper)", border: "1px solid var(--rule)", padding: "16px 18px" }}>
          <div className="iline" style={{ marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
            <span><strong>Quarterly results</strong><span className="sep">·</span>Últimos {data.quarters.length} trim.</span>
            <span style={{ display: "inline-flex", gap: 12, alignItems: "center" }}>
              <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <span style={{ width: 8, height: 8, background: "var(--navy)", display: "inline-block" }} />Rev (B)
              </span>
              {haveEps && (
                <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <span style={{ width: 8, height: 8, background: "var(--gold)", display: "inline-block" }} />EPS × 10
                </span>
              )}
            </span>
          </div>
          {data.quarters.length > 0 ? (
            <BarChart
              height={220}
              formatY={(n) => fmtNum(n, 0)}
              groups={data.quarters.map((q) => ({
                label: q.q,
                bars: haveEps
                  ? [
                      { value: q.rev ?? 0, color: q.beat === false ? "var(--navy-300)" : "var(--navy)" },
                      { value: (q.eps ?? 0) * 10, color: q.beat === false ? "var(--gold-soft)" : "var(--gold)" },
                    ]
                  : [{ value: q.rev ?? 0, color: "var(--navy)" }],
              }))}
            />
          ) : (
            <div className="skeleton-block" style={{ height: 220 }} />
          )}
        </div>
      </div>

      {/* Beat/miss table — only if we have eps data */}
      {haveEps && (
        <div style={{ marginTop: 24, overflowX: "auto" }}>
          <table className="ctbl">
            <thead>
              <tr>
                <th>Trim.</th>
                <th>Revenue act. (B)</th>
                <th>EPS act.</th>
                <th>EPS cons.</th>
                <th>Δ EPS</th>
                <th>Sorpresa</th>
                <th style={{ textAlign: "right" }}>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {data.quarters
                .filter((q) => q.eps != null && q.consEps != null)
                .map((q) => {
                  const dEps = q.consEps && q.consEps !== 0 ? ((q.eps! - q.consEps) / Math.abs(q.consEps)) * 100 : null;
                  return (
                    <tr key={q.q}>
                      <td>{q.q}</td>
                      <td>{q.rev != null ? fmtNum(q.rev, 1) : "—"}</td>
                      <td>{fmtNum(q.eps!, 2)}</td>
                      <td>{fmtNum(q.consEps!, 2)}</td>
                      <td style={{ color: dEps == null ? "var(--ink)" : dEps >= 0 ? "var(--pos)" : "var(--neg)" }}>
                        {dEps != null ? `${dEps >= 0 ? "+" : "−"}${fmtNum(Math.abs(dEps), 1)} %` : "—"}
                      </td>
                      <td style={{ color: (q.surprisePct ?? 0) >= 0 ? "var(--pos)" : "var(--neg)" }}>
                        {q.surprisePct != null ? `${q.surprisePct >= 0 ? "+" : "−"}${fmtNum(Math.abs(q.surprisePct), 1)} %` : "—"}
                      </td>
                      <td>
                        <span className={`rpill ${q.beat ? "buy" : "sell"}`}>{q.beat ? "Beat" : "Miss"}</span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        @media (max-width: 980px) {
          .twocol { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   Panel 05 · Income statement
   ────────────────────────────────────────────────────────────── */

function Panel05Income({ data, hasReport, segmentData }: { data: WorkstationData; hasReport: boolean; segmentData: SegmentSankeyData | null }) {
  return (
    <section id="p05" className="analyze-panel" style={panelStyle({ background: "var(--ivory-warm)" })}>
      <PanelHead num="05" eyebrow="Income statement" title="De dónde sale cada dólar de utilidad neta." meta={`${data.filingRef} · ${data.asOf}`} />

      {/* Sankey full-width — el componente original maneja layout, ramas por industria y attribution link al filing */}
      <div style={{ background: "var(--paper)", border: "1px solid var(--rule)", padding: 16, marginBottom: 24 }}>
        {segmentData ? (
          <SankeyChart data={segmentData} />
        ) : (
          <div className="skeleton-block" style={{ height: 420 }} />
        )}
      </div>

      {/* Narrativa + cascade derivada */}
      <div className="twocol" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>
          <div className="eyebrow-bar" style={{ marginBottom: 8 }}><span>Análisis del income statement</span></div>
          {hasReport && data.incomeNarrativeMd ? (
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 16, lineHeight: 1.6, color: "var(--ink-2)", maxWidth: "44ch" }}>
              <ReactMarkdown>{data.incomeNarrativeMd}</ReactMarkdown>
            </div>
          ) : (
            <ProseSkeleton lines={6} />
          )}
        </div>
        <div>
          {data.sankey && (
            <>
              <div className="eyebrow-bar" style={{ marginBottom: 8 }}><span>Cascada · valores absolutos y % sobre revenue</span></div>
              <CascadeTable s={data.sankey} />
            </>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          #p05 .twocol { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

function CascadeTable({ s }: { s: SankeyData }) {
  const pct = (v: number) => (s.revenue > 0 ? `${fmtNum((v / s.revenue) * 100, 1)} %` : "—");
  const rows: Array<[string, number, string, "neg" | "highlight" | null]> = [
    ["Revenue", s.revenue, "100,0 %", "highlight"],
    ["Cost of revenue", s.costOfRevenue, pct(s.costOfRevenue), "neg"],
    ["Gross profit", s.grossProfit, pct(s.grossProfit), "highlight"],
    ["Operating expense", s.opex, pct(s.opex), "neg"],
    ["Operating income", s.operatingIncome, pct(s.operatingIncome), "highlight"],
    ["Tax + other", s.otherAndTax, pct(s.otherAndTax), "neg"],
    ["Net income", s.netIncome, pct(s.netIncome), "highlight"],
  ];
  return (
    <table className="ctbl" style={{ background: "var(--paper)" }}>
      <thead>
        <tr>
          <th>Línea</th>
          <th>Valor (B)</th>
          <th>% Rev</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, v, pctText, t]) => {
          const bg = t === "highlight" ? "var(--navy-050)" : undefined;
          const weight = t === "highlight" && (label === "Revenue" || label === "Net income") ? 600 : 400;
          const color = t === "neg" ? "var(--neg)" : "var(--ink)";
          return (
            <tr key={label}>
              <td style={{ background: bg, fontWeight: weight, color: "var(--ink)" }}>{label}</td>
              <td style={{ background: bg, fontWeight: weight, color }}>{fmtNum(v, 1)}</td>
              <td style={{ background: bg, fontWeight: weight, color }}>{pctText}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ──────────────────────────────────────────────────────────────
   Panel 06 · Wall Street
   ────────────────────────────────────────────────────────────── */

function Panel06WallStreet({ data, ticker, hasReport }: { data: WorkstationData; ticker: string; hasReport: boolean }) {
  const c = data.consensus;
  const total = c.buy + c.hold + c.sell;
  const hasTargets = c.targetLow != null && c.targetHigh != null && c.targetAvg != null;
  const range = hasTargets ? c.targetHigh! - c.targetLow! : 0;
  const hoyPos = range > 0 ? ((data.price - c.targetLow!) / range) * 100 : 50;
  const avgPos = range > 0 ? ((c.targetAvg! - c.targetLow!) / range) * 100 : 50;
  const upside = c.targetAvg != null && data.price > 0 ? ((c.targetAvg - data.price) / data.price) * 100 : null;

  if (total === 0 && !hasTargets && data.analystActions.length === 0) {
    return (
      <section id="p06" className="analyze-panel" style={panelStyle()}>
        <PanelHead num="06" eyebrow="Wall Street" title={`Sin cobertura disponible para ${ticker}.`} />
        <p className="body-base" style={{ color: "var(--ink-3)" }}>
          Yahoo Finance no reporta consenso de analistas ni acciones recientes para este ticker.
        </p>
      </section>
    );
  }

  return (
    <section id="p06" className="analyze-panel" style={panelStyle()}>
      <PanelHead num="06" eyebrow="Wall Street" title={`${total} analistas siguen ${ticker}.`} meta="Yahoo Finance consensus" />

      <div className="twocol-rev" style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {total > 0 && (
            <div style={{ background: "var(--paper)", border: "1px solid var(--rule)", padding: 18 }}>
              <div className="eyebrow-bar" style={{ marginBottom: 12 }}><span>Distribución de recomendaciones</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <DonutChart
                  size={130}
                  thickness={20}
                  centerLabel={String(total)}
                  centerSub="ANALISTAS"
                  data={[
                    { value: c.buy, color: "var(--pos)", label: "Buy" },
                    { value: c.hold, color: "var(--neu)", label: "Hold" },
                    { value: c.sell, color: "var(--neg)", label: "Sell" },
                  ]}
                />
                <div style={{ flex: 1, display: "grid", gridTemplateColumns: "12px 1fr 36px 38px", rowGap: 8, columnGap: 10, alignItems: "center" }}>
                  {[
                    ["Buy", c.buy, "var(--pos)"],
                    ["Hold", c.hold, "var(--neu)"],
                    ["Sell", c.sell, "var(--neg)"],
                  ].map(([lbl, count, color]) => (
                    <ConsensusLegendRow key={lbl as string} label={lbl as string} count={count as number} color={color as string} total={total} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {hasTargets && (
            <div style={{ background: "var(--paper)", border: "1px solid var(--rule)", padding: 18 }}>
              <div className="eyebrow-bar" style={{ marginBottom: 14 }}><span>Target price · rango</span></div>
              <div style={{ position: "relative", height: 4, background: "linear-gradient(to right, var(--navy-050), var(--gold), var(--navy-050))", margin: "26px 0 22px" }}>
                <div style={{ position: "absolute", left: `calc(${Math.max(0, Math.min(100, hoyPos))}% - 1px)`, top: -10, bottom: -10, width: 2, background: "var(--ink)" }}>
                  <span style={{ position: "absolute", left: "50%", top: -16, transform: "translateX(-50%)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink)", whiteSpace: "nowrap" }}>
                    Hoy {fmtNum(data.price, 0)}
                  </span>
                </div>
                <div style={{ position: "absolute", left: `calc(${Math.max(0, Math.min(100, avgPos))}% - 1px)`, top: -10, bottom: -10, width: 2, background: "var(--gold-deep)" }}>
                  <span style={{ position: "absolute", left: "50%", bottom: -18, transform: "translateX(-50%)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, color: "var(--gold-deep)", whiteSpace: "nowrap" }}>
                    Avg {fmtNum(c.targetAvg!, 0)}
                  </span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 28 }}>
                <div>
                  <div className="eyebrow-plain" style={{ marginBottom: 4 }}>Low</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>USD {fmtNum(c.targetLow!, 0)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="eyebrow-plain" style={{ marginBottom: 4 }}>High</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>USD {fmtNum(c.targetHigh!, 0)}</div>
                </div>
              </div>
              {upside != null && (
                <>
                  <div style={{ height: 1, background: "var(--rule)", margin: "14px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 12, color: "var(--ink-2)" }}>Upside al promedio</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 500, color: upside >= 0 ? "var(--pos)" : "var(--neg)", fontVariantNumeric: "tabular-nums" }}>
                      {fmtPct(upside)}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          <div>
            <div className="eyebrow-bar" style={{ marginBottom: 8 }}><span>Interpretación de la mesa</span></div>
            {hasReport && data.consensusNarrativeMd ? (
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 16, lineHeight: 1.6, color: "var(--ink-2)", maxWidth: "44ch" }}>
                <ReactMarkdown>{data.consensusNarrativeMd}</ReactMarkdown>
              </div>
            ) : (
              <ProseSkeleton lines={4} />
            )}
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="eyebrow-bar"><span>Acciones recientes de analistas</span></div>
            <div className="meta-row">{data.analystActions.length} de {data.analystActions.length} mostradas</div>
          </div>
          {data.analystActions.length > 0 ? (
            <div style={{ border: "1px solid var(--rule)", background: "var(--paper)", overflowX: "auto" }}>
              <table className="ctbl">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Firma</th>
                    <th>Acción</th>
                    <th>De</th>
                    <th>A</th>
                  </tr>
                </thead>
                <tbody>
                  {data.analystActions.map((a, i) => (
                    <tr key={`${a.firm}-${i}`}>
                      <td>{a.date}</td>
                      <td>{a.firm}</td>
                      <td>{a.action}</td>
                      <td style={{ color: "var(--ink-3)" }}>{a.fromGrade || "—"}</td>
                      <td>
                        {a.toGrade ? (
                          <span className={`rpill ${classifyGrade(a.toGrade)}`}>{a.toGrade}</span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="body-base" style={{ color: "var(--ink-3)" }}>Sin acciones recientes reportadas.</div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          #p06 .twocol-rev { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

function classifyGrade(grade: string): "buy" | "hold" | "sell" {
  const g = grade.toLowerCase();
  if (g.includes("buy") || g.includes("outperform") || g.includes("overweight") || g.includes("strong")) return "buy";
  if (g.includes("sell") || g.includes("underperform") || g.includes("underweight")) return "sell";
  return "hold";
}

function ConsensusLegendRow({ label, count, color, total }: { label: string; count: number; color: string; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <>
      <span style={{ width: 12, height: 12, background: color, display: "inline-block" }} />
      <span style={{ fontSize: 12, color: "var(--ink)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{count}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-3)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(pct, 0)} %</span>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────
   Panel 07 · Risks / Catalysts
   ────────────────────────────────────────────────────────────── */

function Panel07RisksCatalysts({ data, hasReport }: { data: WorkstationData; hasReport: boolean }) {
  return (
    <section id="p07" className="analyze-panel" style={panelStyle()}>
      <PanelHead num="07" eyebrow="Riesgos · catalizadores" title="Lo que puede ir mal. Lo que puede ir mejor." />

      <div className="twocol" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        <div>
          <div className="eyebrow-bar" style={{ marginBottom: 14 }}><span>Riesgos</span></div>
          {hasReport && data.risksMd ? (
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 16, lineHeight: 1.6, color: "var(--ink-2)", maxWidth: "60ch" }}>
              <ReactMarkdown>{data.risksMd}</ReactMarkdown>
            </div>
          ) : (
            <ProseSkeleton lines={8} />
          )}
        </div>
        <div>
          <div className="eyebrow-bar" style={{ marginBottom: 14 }}><span>Catalizadores</span></div>
          {hasReport && data.catalystsMd ? (
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 16, lineHeight: 1.6, color: "var(--ink-2)", maxWidth: "60ch" }}>
              <ReactMarkdown>{data.catalystsMd}</ReactMarkdown>
            </div>
          ) : (
            <ProseSkeleton lines={8} />
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          #p07 .twocol { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   Panel 08 · Conclusión
   ────────────────────────────────────────────────────────────── */

function Panel08Conclusion({ data, hasReport }: { data: WorkstationData; hasReport: boolean }) {
  const verdictColor =
    data.verdict === "BUY" ? "var(--pos)" : data.verdict === "AVOID" ? "var(--neg)" : "var(--neu)";

  return (
    <section id="p08" className="analyze-panel" style={panelStyle()}>
      <PanelHead num="08" eyebrow="Conclusión" title="Lo que se llevan de este reporte." />

      <div style={{ maxWidth: "70ch", marginBottom: 32 }}>
        {hasReport && data.conclusionMd ? (
          <div className="drop-cap" style={{ fontFamily: "var(--font-serif)", fontSize: 17, lineHeight: 1.6, color: "var(--ink-2)" }}>
            <ReactMarkdown>{data.conclusionMd}</ReactMarkdown>
          </div>
        ) : (
          <ProseSkeleton lines={6} />
        )}
      </div>

      {data.verdict && (
        <div style={{ background: "var(--ivory-warm)", padding: 32, border: "1px solid var(--rule)" }}>
          <div className="eyebrow-bar" style={{ marginBottom: 14 }}><span>Veredicto final</span></div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 32, fontWeight: 500, color: verdictColor, letterSpacing: "-0.01em" }}>
              {data.verdict}
            </span>
            <span style={{ color: "var(--ink-3)", fontFamily: "var(--font-mono)", fontSize: 16 }}>—</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
              {data.target != null
                ? `Target USD ${fmtNum(data.target, 0)}${data.targetUpside != null ? ` (${fmtPct(data.targetUpside)})` : ""}`
                : "Target no disponible"}
            </span>
            <span style={{ color: "var(--ink-3)", fontFamily: "var(--font-mono)", fontSize: 16 }}>·</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--ink-2)" }}>Horizonte 12 meses</span>
          </div>
        </div>
      )}
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
   Panel 09 · Disclaimer
   ────────────────────────────────────────────────────────────── */

function Panel09Disclaimer() {
  return (
    <section className="analyze-panel" style={panelStyle({ background: "var(--ivory-warm)", borderBottom: "none" })}>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 24, alignItems: "start", padding: "12px 0", maxWidth: 900 }}>
        <div style={{ color: "var(--gold-deep)", flexShrink: 0 }}>
          <Icon d={ICON_SHIELD} size={36} />
        </div>
        <div>
          <div className="eyebrow-bar" style={{ marginBottom: 8 }}>
            <span>Importante · sin sustituir asesoramiento</span>
          </div>
          <h3 className="serif" style={{ fontSize: 22, fontWeight: 400, margin: "0 0 12px", letterSpacing: "-0.012em", color: "var(--ink)" }}>
            Esta herramienta es complemento, no reemplazo.
          </h3>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.6, color: "var(--ink-2)", margin: 0, maxWidth: "60ch" }}>
            El reporte se construye con datos públicos (Yahoo Finance, SEC EDGAR) y un análisis asistido por OpenAI GPT-4o. No constituye recomendación personalizada de inversión. Cada decisión debe discutirse con un asesor habilitado de la casa, considerando perfil, horizonte y restricciones del cliente. La información puede contener errores u omisiones y está sujeta a actualización sin previo aviso.
          </p>
        </div>
      </div>
    </section>
  );
}
