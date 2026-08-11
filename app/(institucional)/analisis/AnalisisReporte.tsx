"use client";

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import type { StockData } from "@/types/StockData";
import type { StructuredReport, SegmentSankeyData } from "@/types/Report";
import { Spark, type SankeyData } from "@/components/analyze/charts";
import { SankeyChart } from "@/components/SankeyChart";
import { PriceChartInstitucional } from "@/components/analyze/PriceChartInstitucional";
import { buildWorkstation, makeSkeletonWorkstation, type WorkstationData } from "@/components/analyze/adapter";
import { TickerSearch } from "@/components/TickerSearch";
import { MarketStatus } from "@/components/MarketStatus";
import { NewsletterSignup } from "@/components/institucional/NewsletterSignup";
import { PREVIEW_CREATED_AT, PREVIEW_REPORT, PREVIEW_STOCK } from "./previewReport";
import { useLogoBrightness } from "@/lib/useLogoBrightness";
import { FollowButton, SeguidosStrip } from "@/components/analyze/Seguimiento";
import { CierreSegunLector } from "@/components/analyze/Cierre";

// "gate" no es un error: el server rechazó GENERAR (no leer) porque falta el
// correo. Estado propio para no disfrazar de falla lo que es un peaje —
// ver lib/leadGate.ts y app/api/analyze/route.ts §2b-pre.
type Status = "loading" | "partial" | "done" | "error" | "gate";
type ErrorKind = "generic" | "analysis_unavailable";

/* ──────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────── */

function fmtNum(n: number | null | undefined, dec = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
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
// Cada subpath separado por "|" se emite como su propio <path>, así que TODOS
// tienen que arrancar con un moveto. Sin la M, el navegador descarta el subpath
// entero y lo tira por consola: al ícono de PDF le faltaban la esquina doblada y
// la flecha de descarga, y al escudo su check.
const ICON_PDF = "M7 3h7l3 3v14H7z|M14 3v3h3|M12 10v8|M9 15l3 3 3-3";
const ICON_SHIELD = "M12 3l8 3v7c0 4.5-3.5 7.5-8 8-4.5-.5-8-3.5-8-8V6z|M9 12l2 2 4-4";
// Recargar: flecha en círculo (subpaths con M para no romper el parser SVG).
const ICON_RELOAD = "M21 12a9 9 0 1 1-2.64-6.36|M21 3v5h-5";

// Lenguaje analítico deliberado: describe la solidez de la tesis, nunca da
// instrucciones operativas (iniciar/añadir/reducir) — el reporte es una
// recomendación general no personalizada, no una orden a cartera.
const CONVICTION_COPY: Record<"BUY" | "HOLD" | "AVOID", Record<"Alta" | "Media" | "Baja", string>> = {
  BUY: {
    Alta: "Datos cuantitativos y cualitativos alineados; la tesis no depende de supuestos frágiles.",
    Media: "Tesis razonable con 1–2 factores en conflicto; el próximo earnings es la prueba clave.",
    Baja: "Tesis dependiente de supuestos aún no verificables; requiere más evidencia.",
  },
  HOLD: {
    Alta: "Equilibrio claro entre catalizadores y riesgos; sin ventaja direccional identificable.",
    Media: "Señales mixtas, sin dirección dominante; las métricas clave quedan bajo monitoreo.",
    Baja: "Datos insuficientes para una lectura direccional con convicción.",
  },
  AVOID: {
    Alta: "Riesgos materiales claramente identificados que dominan la tesis.",
    Media: "Los factores negativos pesan más que los positivos, con incertidumbre en la magnitud.",
    Baja: "Datos insuficientes o supuestos frágiles; la lectura pide prudencia.",
  },
};

/* ──────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────── */

// Cuerpo del reporte por-ticker. Lo monta AnalisisSwitch SÓLO cuando la URL trae
// `?ticker=` — la landing (sin ticker) es otro componente. Named export: la page
// server (analisis/page.tsx) delega en el switch, no en este componente directo.
export function AnalisisReporte() {
  return (
    <Suspense fallback={<div style={{ paddingTop: "var(--nav-h)" }} />}>
      <AnalisisReporteInner />
    </Suspense>
  );
}

function AnalisisReporteInner() {
  const params = useSearchParams();
  const urlTicker = params.get("ticker")?.toUpperCase() ?? null;

  const [stockData, setStockData] = useState<StockData | null>(null);
  const [report, setReport] = useState<StructuredReport | null>(null);
  // AnalisisSwitch sólo monta este componente cuando la URL trae ?ticker=, así
  // que siempre arranca cargando — el effect de abajo dispara el análisis.
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind>("generic");
  // Timestamp in ms hasta cuándo el botón "Regenerar" queda bloqueado.
  // GPT-4o a temperature=0 no es determinístico — sin cooldown, regenerar puede
  // devolver HOLD y luego AVOID para el mismo input. El server impone el límite;
  // acá solo lo reflejamos en la UI.
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [now, setNow] = useState<number>(() => Date.now());
  // Momento real de generación del reporte mostrado: createdAt del cache en
  // respuestas cacheadas, Date.now() en generaciones frescas. El informe es
  // una foto congelada — el timestamp y el aviso de vigencia salen de acá.
  const [reportCreatedAt, setReportCreatedAt] = useState<number | null>(null);
  // Distingue una regeneración explícita (botón "Actualizar análisis") de la
  // primera generación, para el label del botón: "Regenerando…" vs "Generando…".
  // Lo fija analyze() según su flag `refresh`.
  const [isRefresh, setIsRefresh] = useState(false);

  const activeTicker = useRef<string>("");
  const controllerRef = useRef<AbortController | null>(null);

  const ticker = stockData?.ticker ?? urlTicker ?? "";
  const data = useMemo<WorkstationData | null>(() => {
    if (!stockData) return null;
    return buildWorkstation(stockData, report, reportCreatedAt);
  }, [stockData, report, reportCreatedAt]);

  // Estado de arranque: pusiste el ticker y todavía no llegó NADA del upstream.
  // En vez del LoadingShell genérico (otro DOM → salto), pintamos la estructura
  // base con un esqueleto y cada dato cae en su lugar cuando llega el fetch. Si
  // venimos del peaje con la ficha ya en mano (keepVisible), data existe y NO
  // estamos bootstrapping: se muestran los valores reales del teaser.
  const skeletonData = useMemo(() => makeSkeletonWorkstation(ticker), [ticker]);
  const bootstrapping = status === "loading" && !data;
  const viewData = data ?? skeletonData;

  const analyze = useCallback(async (symbol: string, refresh = false, keepVisible = false) => {
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
        window.history.pushState({}, "", `/analisis${newSearch}`);
      } else {
        window.history.replaceState({}, "", `/analisis${newSearch}`);
      }
    }

    setErrorMsg(null);
    setErrorKind("generic");
    setStatus("loading");
    setIsRefresh(refresh);
    // keepVisible: venimos del peaje con la MISMA info (el memo de fetchStockData
    // hace que la generación reuse el teaser que ya se mostró), así que NO vaciamos
    // stockData — el masthead con identidad, precio y métricas queda montado en su
    // lugar y el stream lo actualiza encima, en vez de parpadear al LoadingShell y
    // volver. report/reportCreatedAt ya son null en el peaje, mantenerlos es inocuo.
    if (!keepVisible) {
      setStockData(null);
      setReport(null);
      setReportCreatedAt(null);
    }
    // Reset del cooldown — el server decide el nuevo valor según el cache de este ticker.
    setCooldownUntil(0);

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
          const e = new Error(json.error ?? "Unknown error") as Error & {
            code?: string;
            stockData?: StockData | null;
          };
          if (typeof json.code === "string") e.code = json.code;
          // El peaje viaja con la ficha de Yahoo para poder dibujar la cabecera
          // real detrás del formulario (ver el teaser en /api/analyze).
          if (json.stockData) e.stockData = json.stockData as StockData;
          throw e;
        }
        setStockData(json.stockData);
        setReport(json.report);
        setReportCreatedAt(typeof json.cachedAt === "number" ? json.cachedAt : Date.now());
        setStatus("done");
        // Server signals cuándo se desbloquea la regeneración (cooldown anti-flap).
        const remaining = typeof json.cooldownRemainingSeconds === "number" ? json.cooldownRemainingSeconds : 0;
        if (remaining > 0) setCooldownUntil(Date.now() + remaining * 1000);
        else setCooldownUntil(0);
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
            setReportCreatedAt(Date.now());
            setStatus("done");
            // Análisis fresco recién cacheado → arranca el cooldown de 1 h.
            setCooldownUntil(Date.now() + 60 * 60 * 1000);
          } else if (msg.partial && typeof msg.partial === "object") {
            // Partial report fragment emitted by a specialist completing. Merge
            // into the current report state so panels fill in progressively.
            const partial = msg.partial as Partial<StructuredReport>;
            setReport((prev) => ({ ...(prev ?? {}), ...partial } as StructuredReport));
            setStatus("partial");
          } else if (msg.stockData) {
            setStockData(msg.stockData as StockData);
            setStatus("partial");
          }
          // Stage events (msg.stage / msg.status) are ignored here but could
          // drive a progress indicator in the sidebar if desired.
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
      // El peaje no es una falla: mostramos la cabecera real con lo que vino de
      // Yahoo, borroneamos el cuerpo y pedimos el correo ahí mismo. Si Yahoo
      // falló, stockData viene null y cae al formulario sin cabecera.
      if (code === "email_required") {
        const teaser = (err as { stockData?: StockData | null }).stockData ?? null;
        if (teaser) setStockData(teaser);
        setStatus("gate");
        return;
      }
      setErrorKind(code === "analysis_unavailable" ? "analysis_unavailable" : "generic");
      setErrorMsg(err instanceof Error ? err.message : "Algo salió mal.");
      setStatus("error");
    }
  }, []);

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

  // Avisa al Navbar que el reporte está en pantalla → modo claro forzado. La
  // landing de /analisis es hero navy y el reporte no, pero comparten pathname,
  // así que la barra no puede decidirlo por la URL. El montaje/desmontaje (el
  // switch remonta al aparecer/desaparecer el ?ticker=) es la señal.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("analisis:report", { detail: true }));
    return () => {
      window.dispatchEvent(new CustomEvent("analisis:report", { detail: false }));
    };
  }, []);

  // Scroll to top once we have data
  const wasLoading = useRef(false);
  useEffect(() => {
    if (status === "done" && wasLoading.current) {
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
    wasLoading.current = status === "loading" || status === "partial";
  }, [status]);

  function handleRefresh() {
    if (!activeTicker.current) return;
    if (Date.now() < cooldownUntil) return; // bloqueado por cooldown
    analyze(activeTicker.current, true);
  }

  // Reintento desde el estado de error: cache-first (refresh=false). Si el
  // análisis se generó y cacheó pero el stream murió en el camino — o si otro
  // usuario lo completó entre medio — resuelve instantáneo del cache. Con
  // refresh=true este botón BORRABA el cache y forzaba siempre el camino
  // fresco: el peor reintento posible durante un incidente de upstream.
  // (Trasplantado del fix f10b369 de main, donde vivía en app/analyze/page.tsx.)
  function handleRetry() {
    if (!activeTicker.current) return;
    if (Date.now() < cooldownUntil) return;
    analyze(activeTicker.current);
  }

  // El alta ya dejó la cookie del gate, así que reintentamos EXACTAMENTE lo que
  // había pedido: si lo bloqueado era un "Actualizar análisis", vuelve como
  // refresh; si era la primera generación, como generación normal.
  function handleGateUnlocked() {
    if (!activeTicker.current) return;
    // Mantené en pantalla lo que ya mostró el teaser: es exactamente la misma
    // info que va a usar la generación (mismo fetchStockData, ahora memoizado).
    analyze(activeTicker.current, isRefresh, true);
  }

  // Tick cada segundo solo mientras el cooldown está activo, para refrescar
  // el countdown que muestra el hero.
  useEffect(() => {
    if (cooldownUntil <= now) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cooldownUntil, now]);

  return (
    <main className="analyze-root">
      {/* La barra vive en el layout y NO ve el ?ticker= en SSR, así que en la
          carga directa del reporte renderiza en modo oscuro (texto claro) y
          recién el effect del Navbar la corrige — un parpadeo de bajo contraste
          sobre el shell blanco. Este override por presencia de .analyze-root la
          deja clara desde el primer paint (gana por especificidad a las reglas
          [data-mode="dark"]) y se va solo al desmontar el reporte. Espeja el
          modo claro del Navbar; si aquél cambia, actualizar acá. */}
      <style>{`
        :root:has(.analyze-root) .nav-root:not([data-panel-open="1"]) {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.62) 0%, rgba(248, 249, 255, 0.48) 100%);
          -webkit-backdrop-filter: blur(22px) saturate(180%);
          backdrop-filter: blur(22px) saturate(180%);
          border-bottom-color: rgba(215, 217, 232, 0.45);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85), 0 8px 32px rgba(3, 6, 94, 0.07);
        }
        :root:has(.analyze-root) .nav-root .nav-logo { filter: none; }
        :root:has(.analyze-root) .nav-root .nav-trigger { color: #4A4E6B; }
        :root:has(.analyze-root) .nav-root .nav-trigger[data-active="1"] { color: var(--ink); border-bottom-color: var(--gold-deep); }
        :root:has(.analyze-root) .nav-root .nav-consultanet { color: var(--gold-deep); }
        :root:has(.analyze-root) .nav-root .nav-cta {
          background: var(--navy); color: #fff;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
        }
        :root:has(.analyze-root) .nav-root .nav-burger { color: var(--ink); }

        /* El cuerpo del informe emerge con un fade cuando aparece —al salir del
           peaje o al arrancar una generación fresca—. Sólo opacidad: no toca el
           layout, así que las bandas full-bleed y los skeletons no saltan. Corre
           una sola vez (el wrapper queda montado de partial a done). */
        @keyframes az-report-in { from { opacity: 0; } to { opacity: 1; } }
        .analyze-root .az-report-reveal { animation: az-report-in 0.55s ease both; }
        @media (prefers-reduced-motion: reduce) {
          .analyze-root .az-report-reveal { animation: none; }
        }
      `}</style>
      {status === "error" && <ErrorPanel kind={errorKind} message={errorMsg} onRetry={handleRetry} />}
      {/* Peaje sin ficha de Yahoo (falló el upstream): formulario solo. */}
      {status === "gate" && !data && <LeadGatePanel isRefresh={isRefresh} onUnlocked={handleGateUnlocked} />}
      {/* Estructura base desde el arranque: en loading puro va el esqueleto
          (bootstrapping) y cada dato aparece en su lugar; con data ya presente
          (teaser/partial/done) van los valores reales. Es la MISMA instancia del
          masthead rellenándose in situ, sin saltar a otro shell. */}
      {(status === "loading" || ((status === "partial" || status === "done" || status === "gate") && !!data)) && (
        <>
          {/* La tira de seguidos ya NO va acá: montada como primer hijo de main
              caía debajo del navbar fijo y no se veía nunca. Ahora la dibuja el
              masthead, arriba del buscador. Ver el comentario de SeguidosStrip. */}
          <AnalyzeMasthead
            data={viewData}
            ticker={ticker}
            domain={stockData?.domain ?? null}
            hasReport={!!report}
            status={status}
            loading={bootstrapping}
            isRefresh={isRefresh}
            onRefresh={handleRefresh}
            cooldownRemainingMs={Math.max(0, cooldownUntil - now)}
            onSelectTicker={selectTicker}
            gated={status === "gate"}
          />
          {status === "gate" ? (
            <GatedPreview isRefresh={isRefresh} onUnlocked={handleGateUnlocked} />
          ) : (
            <div className="az-report-reveal">
              <ReportBody data={viewData} ticker={ticker} hasReport={!!report} loading={bootstrapping} stockData={stockData} report={report} />
            </div>
          )}
        </>
      )}
    </main>
  );
}

/* ──────────────────────────────────────────────────────────────
   Section shell — banda aireada + cabecera split-label
   ────────────────────────────────────────────────────────────── */

function Section({
  id,
  tone = "band",
  tight,
  children,
}: {
  id?: string;
  tone?: "band" | "muted" | "navy";
  tight?: boolean;
  children: React.ReactNode;
}) {
  const band = tone === "muted" ? "band-muted" : tone === "navy" ? "band-navy" : "band";
  return (
    <section id={id} className={`az-sec ${tight ? "az-sec--tight" : ""} ${band}`}>
      <div className="site-wrap">{children}</div>
    </section>
  );
}

function SectionHead({
  eyebrow,
  meta,
  title,
  dek,
}: {
  eyebrow: string;
  meta?: React.ReactNode;
  title: React.ReactNode;
  dek?: React.ReactNode;
}) {
  return (
    <div className="az-head split-label">
      <div className="az-head-label">
        <div className="eyebrow-sm">{eyebrow}</div>
        {meta && <div className="az-meta">{meta}</div>}
      </div>
      <div>
        <h2 className="az-title">{title}</h2>
        {dek && <p className="az-dek">{dek}</p>}
      </div>
    </div>
  );
}

function ProseSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton-block" style={{ height: 12, width: i === lines - 1 ? "60%" : "100%", borderRadius: 2 }} />
      ))}
    </div>
  );
}

// Barrita de esqueleto inline para los slots de dato del masthead (precio, spark,
// variación, métricas): ocupa el lugar exacto del valor y se reemplaza por el
// número cuando llega el fetch, sin mover el layout.
function SkBar({ w, h = 13, style }: { w: number | string; h?: number; style?: React.CSSProperties }) {
  return <span className="skeleton-block" style={{ display: "inline-block", width: w, height: h, borderRadius: 3, verticalAlign: "middle", ...style }} />;
}

/* ──────────────────────────────────────────────────────────────
   Hero navy — snapshot + veredicto (reemplaza sidebar + bloque verde)
   ────────────────────────────────────────────────────────────── */

function AnalyzeMasthead({
  data,
  ticker,
  domain,
  hasReport,
  status,
  isRefresh,
  onRefresh,
  cooldownRemainingMs,
  onSelectTicker,
  gated = false,
  loading = false,
}: {
  data: WorkstationData;
  ticker: string;
  domain: string | null;
  hasReport: boolean;
  status: Status;
  isRefresh: boolean;
  onRefresh: () => void;
  cooldownRemainingMs: number;
  onSelectTicker: (t: string) => void;
  /**
   * Teaser del peaje: hay ficha de Yahoo pero NO hay reporte todavía. Se corta
   * después de la ficha técnica — el veredicto y las fuentes no se muestran
   * porque no existen, y no se inventan detrás de un blur.
   */
  gated?: boolean;
  /**
   * Bootstrapping: pusiste el ticker y todavía no llegó el fetch. Los slots de
   * dato (nombre, precio, spark, variación, métricas) van como barritas de
   * esqueleto y se reemplazan por el valor cuando llega, sin mover el layout.
   */
  loading?: boolean;
}) {
  const isWorking = status === "loading" || status === "partial";
  const inCooldown = cooldownRemainingMs > 0;
  const refreshDisabled = isWorking || inCooldown || gated;
  // Listo = ni generando ni en cooldown → el anillo se colapsa y el texto se centra.
  const isReady = !isWorking && !inCooldown;
  const cooldownLabel = inCooldown
    ? (() => {
        const totalSec = Math.ceil(cooldownRemainingMs / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return m > 0 ? `Regenerar en ${m}m ${String(s).padStart(2, "0")}s` : `Regenerar en ${s}s`;
      })()
    : null;
  // Primera generación → "Generando…"; regeneración explícita (botón) → "Regenerando…".
  const refreshLabel = isWorking ? (isRefresh ? "Regenerando…" : "Generando…") : cooldownLabel ?? "Actualizar análisis";
  // El cooldown anti-flap es de 1 h desde la generación. El anillo se llena a
  // medida que transcurre (vacío recién regenerado → lleno = listo de nuevo).
  const COOLDOWN_TOTAL_MS = 60 * 60 * 1000;
  const cooldownProgress = inCooldown
    ? Math.max(0, Math.min(1, (COOLDOWN_TOTAL_MS - cooldownRemainingMs) / COOLDOWN_TOTAL_MS))
    : 1;

  const reportId = data.asOf ? `BGC-${ticker}-${data.asOf.replace(/-/g, "")}` : `BGC-${ticker}`;
  const changeTone = data.change1dPct == null ? "var(--ink-3)" : data.change1dPct >= 0 ? "var(--pos)" : "var(--neg)";
  const ytdTone = data.changeYtdPct == null ? "var(--ink)" : data.changeYtdPct >= 0 ? "var(--pos)" : "var(--neg)";
  // Sin veredicto todavía (generando) el panel va NAVY —el mismo azul que hay
  // detrás del blur del teaser—, no gris: el gris es el color del HOLD y un panel
  // gris con "•••" se leía como un HOLD ya emitido. BUY verde · AVOID rojo ·
  // HOLD gris · pendiente navy.
  const verdictColor =
    data.verdict === "BUY" ? "var(--pos)" :
    data.verdict === "AVOID" ? "var(--neg)" :
    data.verdict === "HOLD" ? "var(--neu)" :
    "var(--navy)";
  const verdictItalic = data.verdict ? data.verdict.toLowerCase() + "." : ".";
  const qref = (label: string) => data.kpis.find((k) => k[0] === label)?.[1] ?? "—";

  return (
    <header id="masthead" className="analyze-masthead">
      <div className="site-wrap">
        {/* Volver a una acción que ya seguís. Comparte el bloque de navegación
            con el buscador —buscar una nueva y volver a las de siempre son la
            misma tarea— y se auto-oculta si no sigue ninguna (o si es anónima),
            así que para la mayoría de las visitas no existe. */}
        <SeguidosStrip tickerActual={ticker} onSelect={onSelectTicker} />

        {/* Saltar de acción sin volver a la landing. Hasta acá el único disparador
            de onSelectTicker eran los comparables del Quick ref. La variante es
            "footer" (no "header"): esa está pintada para barra oscura —borde
            inferior blanco, botón oro— y el masthead es marfil. Sin defaultValue
            a propósito: el ticker actual ya se lee gigante abajo, precargarlo
            el campo lleva el ticker que estás viendo, así el control también
            dice dónde estás parado. Para que eso no obligue a borrar antes de
            escribir otro, el input selecciona su contenido al recibir foco.
            Tampoco se deshabilita mientras genera: el LoadingShell muestra este
            mismo control activo, y bloquearlo acá lo haría parpadear entre
            estados. Cambiar de ticker a mitad es seguro — analyze() aborta el
            fetch en curso antes de arrancar el nuevo. */}
        <div className="am-search">
          <TickerSearch variant="masthead" onSubmit={onSelectTicker} defaultValue={ticker} />
        </div>

        {/* Snapshot bar: identidad + precio + spark a la izquierda, acciones a la derecha */}
        <div className="am-snap">
          <div className="am-ident">
            <div className="am-ident-head">
              {/* key={ticker}: al cambiar de ticker se remonta con estado fresco
                  (loaded/failed), así el logo nuevo también entra por esqueleto en
                  vez de heredar el "ya cargado" del anterior. */}
              <TickerLogo key={ticker} ticker={ticker} domain={domain} company={data.name} pending={loading} />
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 500, letterSpacing: "0.02em", color: "var(--ink)", fontVariantNumeric: "tabular-nums", lineHeight: 1.15 }}>{ticker}</div>
                <div style={{ fontSize: 15.5, color: "var(--ink-2)", letterSpacing: "-0.01em", marginTop: 3, lineHeight: 1.2 }}>{loading ? <SkBar w={170} h={14} /> : data.name}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
              {loading ? (
                <>
                  <SkBar w={120} h={28} />
                  <SkBar w={62} h={20} style={{ borderRadius: 4 }} />
                  <SkBar w={150} h={30} />
                </>
              ) : (
                <>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 30, fontWeight: 500, lineHeight: 1, letterSpacing: "-0.01em", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{fmtNum(data.price)}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-3)", alignSelf: "flex-start", marginTop: 2 }}>{data.currency}</span>
                  {/* Variación del día en chip pleno, igual que los gráficos. El
                      absoluto y el "hoy" quedan fuera en tinta neutra: el color ya
                      lo carga el chip. Sin dato, pizarra — no se inventa un signo. */}
                  <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, lineHeight: 1,
                        fontVariantNumeric: "tabular-nums", color: "var(--paper)",
                        background: data.change1dPct == null ? "var(--neu)" : data.change1dPct >= 0 ? "var(--pos)" : "var(--neg)",
                        padding: "5px 8px", borderRadius: 4,
                      }}
                    >
                      {fmtPct(data.change1dPct)}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>
                      {data.change1d != null ? `${data.change1d >= 0 ? "+" : "−"}${fmtNum(Math.abs(data.change1d))} · ` : ""}hoy
                    </span>
                  </span>
                  <span style={{ marginLeft: 2, marginBottom: 2 }}><Spark data={data.spark} width={150} height={30} color={changeTone} /></span>
                </>
              )}
            </div>
            <div className="iline" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
              <span>YTD <strong style={{ color: ytdTone }}>{loading ? <SkBar w={42} /> : fmtPct(data.changeYtdPct)}</strong></span>
              <span className="sep">·</span>
              <span>Cap. <strong>{loading ? <SkBar w={54} /> : data.marketCap}</strong></span>
              <span className="sep">·</span>
              <span>52 sem. <strong>{loading ? <SkBar w={92} /> : (data.week52Low != null && data.week52High != null ? `${fmtNum(data.week52Low)} – ${fmtNum(data.week52High)}` : "—")}</strong></span>
              <span className="sep">·</span>
              <span>P/E <strong>{loading ? <SkBar w={36} /> : (data.trailingPE != null ? fmtNum(data.trailingPE, 1) : "—")}</strong></span>
            </div>
          </div>

          {/* Columna derecha: estado del mercado sobre las acciones. El badge sale
              del reloj, no del upstream, así que no rompe la foto congelada — pero
              califica el precio de arriba: con el mercado cerrado ese número es el
              cierre; con el mercado abierto es el de "Generado". */}
          <div className="am-right">
            <MarketStatus tone="light" />

            <div className="am-actions">
              {/* Seguir la ACCIÓN, colgando de su identidad y con el mismo
                  vestido que sus dos vecinos. Primero de la fila porque es el
                  único que actúa sobre la empresa: los otros dos actúan sobre
                  este documento. Sólo con informe real — seguir un esqueleto no
                  significa nada. */}
              {!gated && hasReport && <FollowButton key={ticker} ticker={ticker} />}
              {/* Sin reporte no hay nada que exportar: en el teaser el botón
                  sobra y prometería un PDF vacío. */}
              {!gated && !loading && (
                <button className="am-btn" onClick={() => window.print()}>
                  <Icon d={ICON_PDF} size={14} /> Exportar PDF
                </button>
              )}
              <button
                className="am-btn"
                onClick={onRefresh}
                disabled={refreshDisabled}
                title="Regenerar"
              >
                {isWorking
                  ? <CircularProgress spinning />
                  : isReady
                    ? <span className="am-reload" aria-hidden><Icon d={ICON_RELOAD} size={15} /></span>
                    : <CircularProgress progress={cooldownProgress} />}
                {" "}{refreshLabel}
              </button>
            </div>
          </div>
        </div>

        {/* Masthead: ficha técnica del reporte en hairlines */}
        <div className="am-mast-wrap">
          <div className="hairline-row am-mast">
            <div className="cell"><div className="label">Reporte ID</div><div className="value">{reportId}</div></div>
            <div className="cell"><div className="label">Mesa</div><div className="value">Research · Bengochea &amp; Cía.</div></div>
            <div className="cell"><div className="label">Cobertura</div><div className="value">Equity Research</div></div>
            <div className="cell"><div className="label">Horizonte</div><div className="value">12 meses</div></div>
            {/* La hora se agrega SÓLO cuando el informe está generado (status
                "done", con timestamp real). En cualquier estado previo —teaser del
                peaje o generación en curso— va sólo la fecha de hoy: es honesta
                (el informe se genera hoy) sin inventar la hora de algo que todavía
                no corrió. */}
            <div className="cell"><div className="label">Generado</div><div className="value">{status === "done" ? data.lastUpdated : data.lastUpdatedDate}</div></div>
            {/* CINCO celdas, ni una más: .hairline-row es `repeat(5, 1fr)` y
                cualquier sexta cae sola a una segunda fila, sin borde derecho y
                más alta que las de arriba. Acá vivía el control de seguimiento y
                ése era el efecto. Si algún día hay un sexto metadato, cambiar
                antes la grilla — y que sea metadato DEL DOCUMENTO, no un control. */}
          </div>
        </div>

        {/* Tesis: veredicto + argumento + referencia rápida. Junto con la línea
            de fuentes queda fuera del teaser del peaje: sin reporte no hay
            veredicto ni modelo que citar, y no se simula uno detrás del blur. */}
        {!gated && (
        <>
        <div className="tesis-grid" style={{ display: "grid", gridTemplateColumns: "280px 1fr 240px", borderBottom: "1px solid var(--rule)" }}>
          {/* Veredicto */}
          <div className="tesis-verdict" style={{ background: verdictColor, color: "var(--ivory)", padding: 24, borderRight: "1px solid var(--rule)", transition: "background 0.45s ease" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.8)" }}>
              Veredicto
            </div>
            <div className="tesis-verdict-value" style={{ fontFamily: "var(--font-mono)", fontSize: 56, fontWeight: 500, lineHeight: 1, letterSpacing: "-0.01em", marginTop: 12, marginBottom: 10 }}>
              {data.verdict ?? "•••"}
            </div>
            {/* Convicción pegada al veredicto: rating y convicción son una sola lectura */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>Convicción</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--ivory)" }}>{data.conviction ?? "—"}</span>
            </div>
            {data.verdict && data.conviction && CONVICTION_COPY[data.verdict]?.[data.conviction] && (
              <div style={{ fontFamily: "var(--site-font)", fontSize: 12, lineHeight: 1.5, color: "rgba(255,255,255,0.78)", marginTop: 8, maxWidth: "26em" }}>
                {CONVICTION_COPY[data.verdict][data.conviction]}
              </div>
            )}

            <div style={{ height: 1, background: "rgba(255,255,255,0.25)", margin: "16px 0 14px" }} />
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.7)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              {hasReport ? "Target 12 meses" : "Target consenso · 12 meses"}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 500, color: "var(--ivory)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
              {data.target != null ? `USD ${fmtNum(data.target, 0)}` : "—"}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.78)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
              {data.targetUpside != null ? `Upside ${fmtPct(data.targetUpside)} desde USD ${fmtNum(data.price)}` : "Upside no disponible"}
            </div>
            {data.scenarioLow != null && data.scenarioHigh != null && (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.78)", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
                Rango escenarios USD {fmtNum(data.scenarioLow, 0)} – {fmtNum(data.scenarioHigh, 0)}
              </div>
            )}

            {(data.expectedValue != null || data.riskReward) && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.18)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {data.expectedValue != null && (
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.6)", letterSpacing: "0.14em", textTransform: "uppercase" }}>EV ponderado</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--ivory)", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>USD {fmtNum(data.expectedValue, 0)}</div>
                    {data.expectedValueUpside != null && (
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: data.expectedValueUpside >= 0 ? "#7BC9A0" : "#E9999A", marginTop: 2 }}>{fmtPct(data.expectedValueUpside)}</div>
                    )}
                  </div>
                )}
                {data.riskReward && (
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.6)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Risk / reward</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--ivory)", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{data.riskReward}</div>
                  </div>
                )}
              </div>
            )}

            {/* El archivo de la propia calificación. Va ANTES del aviso legal —
                que cierra el panel— y sólo aparece si hay más de un veredicto
                registrado para este ticker. */}
            <VerdictHistoryBlock key={ticker} ticker={ticker} />

            <div style={{ height: 1, background: "rgba(255,255,255,0.25)", margin: "16px 0 12px" }} />
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, lineHeight: 1.6, letterSpacing: "0.02em", color: "rgba(255,255,255,0.62)", maxWidth: "26em" }}>
              Análisis general no personalizado. No constituye oferta ni recomendación de inversión.
            </div>
          </div>

          {/* Tesis */}
          <div style={{ padding: 28, borderRight: "1px solid var(--rule)", minWidth: 0 }}>
            <div className="eyebrow-bar"><span>Tesis de inversión</span></div>
            <h2 className="panel-h2" style={{ marginTop: 8, marginBottom: 18 }}>
              {data.verdict ? <>Argumentos que sostienen el veredicto <em>{verdictItalic}</em></> : <>Esperando la lectura del modelo<em>.</em></>}
            </h2>
            {/* .az-prose y no estilos sueltos: es la clase de prosa del informe
                (misma medida y color) y además separa los párrafos. Sin ella el
                markdown salía corrido —Tailwind deja los párrafos en margin 0—,
                algo que la capitular disimulaba y en Arial quedaba como bloque. */}
            {hasReport && data.thesisMd ? (
              <div className="az-prose" style={{ maxWidth: "70ch" }}>
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
            <SnapshotRow label="P/E TTM" value={qref("P/E TTM")} />
            <SnapshotRow label="P/E Fwd" value={qref("P/E Fwd")} />
            <SnapshotRow label="EV/EBITDA" value={qref("EV/EBITDA")} />
            <SnapshotRow label="Div yield" value={qref("Div. yield")} />
            <SnapshotRow label="Beta 5y" value={qref("Beta 5y")} />

            {data.peers.length > 0 && (
              <>
                <div style={{ height: 1, background: "var(--rule)", margin: "12px 0" }} />
                <div className="eyebrow-plain" style={{ marginBottom: 8 }}>Comparables · P/E TTM</div>
                <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 8, padding: "5px 0", borderTop: "1px solid var(--rule)", alignItems: "baseline" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--navy)", fontWeight: 700 }}>{ticker}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--navy)", fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{qref("P/E TTM")}</span>
                </div>
                {data.peers.map((p) => (
                  <div key={p.t} style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 8, padding: "5px 0", borderTop: "1px dashed var(--rule-soft)", alignItems: "baseline" }}>
                    <button
                      type="button"
                      onClick={() => onSelectTicker(p.t)}
                      title={`Analizar ${p.t}`}
                      style={{ all: "unset", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--navy)", fontWeight: 500, textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: "var(--rule)", textUnderlineOffset: 3 }}
                      onMouseEnter={(e) => { e.currentTarget.style.textDecorationColor = "var(--navy)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.textDecorationColor = "var(--rule)"; }}
                    >
                      {p.t}
                    </button>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.pe}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div style={{ marginTop: 16, fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.04em", color: "var(--ink-4)", lineHeight: 1.7 }}>
          Fuentes · {data.provenance?.sourceLine ? `${data.provenance.sourceLine} · ` : ""}Yahoo Finance (delayed 15m) · OpenAI GPT-4o
        </div>
        </>
        )}
      </div>

      <style>{`
        #masthead .am-snap { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; flex-wrap: wrap; padding-bottom: 24px; margin-bottom: 24px; border-bottom: 1px solid var(--rule); }
        #masthead .am-ident { min-width: 0; }
        #masthead .am-ident-head { display: flex; align-items: center; gap: 14px; }
        #masthead .am-logo { width: 46px; height: 46px; flex: none; border-radius: 6px; object-fit: contain; padding: 4px; box-sizing: border-box; }
        #masthead .am-logo--fallback { display: flex; align-items: center; justify-content: center; padding: 0; background: var(--navy); color: #fff; font-family: var(--site-font); font-size: 21px; font-weight: 500; line-height: 1; }
        #masthead .am-right { display: flex; flex-direction: column; align-items: flex-end; gap: 14px; }
        #masthead .am-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
        #masthead .am-btn { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-sans); font-size: 12.5px; color: var(--ink-2); background: none; border: 1px solid var(--rule-strong); border-radius: 3px; padding: 9px 14px; cursor: pointer; line-height: 1; white-space: nowrap; transition: border-color .16s ease, color .16s ease, background-color .16s ease; }
        #masthead .am-btn:hover:not(:disabled) { border-color: var(--ink); color: var(--ink); }
        #masthead .am-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        #masthead .am-btn svg { color: var(--ink-3); }
        /* Botón de regenerar: en cooldown muestra el anillo de progreso; al quedar
           LISTO muestra el ícono de recargar (flecha en círculo), que entra con un
           giro suave. */
        @keyframes am-reload-in { from { opacity: 0; transform: rotate(-150deg); } to { opacity: 1; transform: rotate(0); } }
        #masthead .am-reload { display: inline-flex; animation: am-reload-in .42s cubic-bezier(0.16,1,0.3,1); }
        @media (prefers-reduced-motion: reduce) {
          #masthead .am-reload { animation: none; }
        }
        @keyframes am-spin-kf { to { transform: rotate(360deg); } }
        #masthead .am-spin { animation: am-spin-kf 0.85s linear infinite; transform-origin: 50% 50%; }
        #masthead .am-mast-wrap { position: relative; }
        #masthead .am-mast { margin-bottom: 0; }
        @media (max-width: 1100px) {
          #masthead .tesis-grid { grid-template-columns: 1fr !important; }
          #masthead .tesis-grid > div { border-right: 0 !important; border-bottom: 1px solid var(--rule); }
        }
        @media (max-width: 640px) {
          /* Al envolver, la columna derecha baja a su propia línea y arranca a la
             izquierda: alineamos su contenido al mismo borde que la identidad. */
          #masthead .am-right { align-items: flex-start; }
          #masthead .am-actions { justify-content: flex-start; }
          #masthead .tesis-verdict { padding: 20px 16px !important; }
          #masthead .tesis-verdict-value { font-size: 44px !important; }
          #masthead .am-mast { grid-template-columns: repeat(2, 1fr) !important; }
          #masthead .am-mast > .cell { border-right: 1px solid var(--rule) !important; }
          #masthead .am-mast > .cell:nth-child(2n) { border-right: 0 !important; }
          /* Cinco celdas en dos columnas dejan a la última —Generado— sola en su
             fila, y su borde derecho seguía bajando contra un hueco vacío: una
             vertical colgando de la nada. Ocupa el ancho entero y se le quita. */
          #masthead .am-mast > .cell:last-child:nth-child(odd) {
            grid-column: 1 / -1;
            border-right: 0 !important;
          }
        }
        /* La banda de tesis (veredicto · argumento · quick ref) entra al aparecer:
           en la generación fresca monta cuando llega el stockData, y al salir del
           peaje monta cuando gated pasa a false. En los dos casos es la primera vez
           que este bloque se inserta, así que la animación corre una sola vez. */
        @keyframes az-tesis-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        #masthead .tesis-grid { animation: az-tesis-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          #masthead .tesis-grid { animation: none; }
        }
      `}</style>
    </header>
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

// Logo de marca de la empresa del ticker (pedido del equipo — vive en main).
// Proxy propio /api/logo (ticker + dominio resuelto). useLogoBrightness sondea
// la luminancia: los wordmarks blancos sobre transparente (AMZN, NKE…) van sobre
// un tile navy; el resto sobre blanco. Sin logo → tile con la inicial.
function TickerLogo({ ticker, domain, company, pending = false }: { ticker: string; domain: string | null; company: string; pending?: boolean }) {
  // Cadena de intentos: 0 = por TICKER (FMP lo resuelve sin domain, así arranca
  // YA en el bootstrap, en paralelo con Yahoo); 1 = por DOMAIN (fallback si FMP
  // no tiene el ticker — logo.dev/Google/DDG); 2 = agotado → inicial. Clave del
  // anti-parpadeo: la URL de stage 0 NO depende del domain, así que cuando Yahoo
  // lo trae la URL no cambia → el caso común no re-fetchea y el logo no queda
  // último. Sólo un FMP-miss cambia de URL, y ahí es un fallback real, no un flash.
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [loaded, setLoaded] = useState(false);

  const tickerUrl = ticker ? `/api/logo?ticker=${encodeURIComponent(ticker)}` : null;
  const domainUrl = domain ? `/api/logo?ticker=${encodeURIComponent(ticker)}&domain=${encodeURIComponent(domain)}` : null;
  const logoUrl = stage === 0 ? tickerUrl : stage === 1 ? domainUrl : null;

  const brightness = useLogoBrightness(logoUrl);
  const bg = brightness === "light" ? "var(--navy)" : "#FFFFFF";

  const skel = <span className="am-logo skeleton-block" aria-hidden style={{ display: "inline-block", borderRadius: 6 }} />;

  if (!logoUrl) {
    // Sin URL: agotado → inicial. En stage 1 sin domain y con datos YA presentes
    // (no va a llegar un domain) → también inicial. Si todavía es bootstrap,
    // esqueleto y esperamos (puede llegar el domain, o cargar el de ticker).
    const giveUp = stage === 2 || (stage === 1 && !domainUrl && !pending);
    return giveUp ? <div className="am-logo am-logo--fallback" aria-hidden>{ticker.charAt(0)}</div> : skel;
  }
  // El esqueleto se mantiene hasta que el <img> pinta (revela en onLoad), sin
  // flash en blanco. key={logoUrl} para que un cambio de stage (fallback) monte
  // una img nueva y sus onLoad/onError disparen para la URL correcta.
  return (
    <>
      {!loaded && skel}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={logoUrl}
        src={logoUrl}
        alt={company}
        width={48}
        height={48}
        className="am-logo"
        style={{ background: bg, display: loaded ? undefined : "none" }}
        onLoad={() => setLoaded(true)}
        onError={() => setStage((s) => (s === 0 ? 1 : 2))}
      />
    </>
  );
}

// Indicador circular para el botón de regenerar. `spinning` → arco indeterminado
// (mientras genera); si no, anillo determinado que se llena con `progress` 0→1
// (el cooldown transcurriendo). Hereda el color del botón vía currentColor.
function CircularProgress({ size = 15, stroke = 2, progress = 0, spinning = false }: { size?: number; stroke?: number; progress?: number; spinning?: boolean }) {
  const c = size / 2;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  if (spinning) {
    return (
      <svg className="am-spin" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden style={{ flex: "none" }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={stroke} />
        <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(circ * 0.3).toFixed(2)} ${circ.toFixed(2)}`} />
      </svg>
    );
  }
  const p = Math.max(0, Math.min(1, progress));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden style={{ flex: "none" }}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={stroke} />
      <circle
        cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${(circ * p).toFixed(2)} ${circ.toFixed(2)}`}
        transform={`rotate(-90 ${c} ${c})`}
      />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────
   Report body — todas las secciones en bandas alternadas
   ────────────────────────────────────────────────────────────── */

function ReportBody({
  data,
  ticker,
  hasReport,
  loading,
  stockData,
  report,
}: {
  data: WorkstationData;
  ticker: string;
  hasReport: boolean;
  loading: boolean;
  stockData: StockData | null;
  report: StructuredReport | null;
}) {
  // La mayoría de las secciones ya esqueletean solas cuando hasReport=false (con
  // datos skeleton los sub-bloques de dato quedan ocultos). Sólo estas tres
  // necesitan el flag `loading` porque su estado "vacío" es un desenlace real
  // (return null / "sin cobertura" / grilla vacía) que no debe verse mientras
  // todavía no llegó nada.
  return (
    <>
      <SecKeyDebate data={data} hasReport={hasReport} loading={loading} />
      <SecBusiness data={data} hasReport={hasReport} />
      <SecKpis data={data} loading={loading} />
      <SecPrice data={data} ticker={ticker} hasReport={hasReport} stockData={stockData} />
      <SecIncome data={data} hasReport={hasReport} segmentData={report?.segmentData ?? null} />
      <SecBalance data={data} hasReport={hasReport} />
      <SecIndustry data={data} hasReport={hasReport} />
      <SecWallStreet data={data} ticker={ticker} hasReport={hasReport} loading={loading} />
      <SecNews data={data} />
      <SecScenarios data={data} hasReport={hasReport} />
      <SecRisks data={data} hasReport={hasReport} />
      {/* El cierre se GANA: al desconocido no se le menciona abrir una cuenta, y
          al cliente nunca —ya la tiene—. Ver components/analyze/Cierre.tsx. */}
      {hasReport && <CierreSegunLector ticker={ticker} />}
      <SecDisclaimer />
    </>
  );
}

/* ── Key debate ── */

function SecKeyDebate({ data, hasReport, loading = false }: { data: WorkstationData; hasReport: boolean; loading?: boolean }) {
  // En loading mostramos el esqueleto; sólo se oculta cuando YA hay reporte y ese
  // reporte no trae debate (no todos lo traen).
  if (!loading && !hasReport && !data.keyDebateMd) return null;
  return (
    <Section id="key-debate" tone="muted" tight>
      <SectionHead eyebrow="El debate" title="Dónde está el desacuerdo." />
      {hasReport && data.keyDebateMd ? (
        <div className="az-prose prose-cols">
          <ReactMarkdown>{data.keyDebateMd}</ReactMarkdown>
        </div>
      ) : (
        <ProseSkeleton lines={5} />
      )}
    </Section>
  );
}

/* ── Negocio ── */

function SecBusiness({ data, hasReport }: { data: WorkstationData; hasReport: boolean }) {
  return (
    <Section id="negocio" tone="band">
      <SectionHead
        eyebrow="El negocio"
        meta={data.asOf ? <>As of {data.asOf}{data.filingRef ? <><br />{data.filingRef}</> : null}</> : undefined}
        title="Qué hace la compañía y cómo gana plata."
      />
      <div style={{ marginBottom: 34 }}>
        {hasReport && data.businessSummaryMd ? (
          <div className="az-prose prose-cols">
            <ReactMarkdown>{data.businessSummaryMd}</ReactMarkdown>
          </div>
        ) : (
          <ProseSkeleton lines={6} />
        )}
      </div>

      <div className="split" style={{ paddingTop: 30, borderTop: "1px solid var(--site-border)" }}>
        <div>
          <div className="az-block-lbl">Ventajas competitivas</div>
          {hasReport && data.competitiveAdvantagesMd ? (
            <div className="az-prose az-prose--tight"><ReactMarkdown>{data.competitiveAdvantagesMd}</ReactMarkdown></div>
          ) : <ProseSkeleton lines={5} />}
        </div>
        <div>
          <div className="az-block-lbl">Fuentes de ingresos</div>
          {hasReport && data.revenueStreamsMd ? (
            <div className="az-prose az-prose--tight"><ReactMarkdown>{data.revenueStreamsMd}</ReactMarkdown></div>
          ) : <ProseSkeleton lines={5} />}
        </div>
      </div>

      {data.segments.length > 0 && (
        <div style={{ marginTop: 34, paddingTop: 30, borderTop: "1px solid var(--site-border)" }}>
          <div className="az-block-lbl">Mix de revenue por segmento</div>
          <div style={{ display: "flex", height: 22, width: "100%", border: "1px solid var(--site-border)", borderRadius: 3, overflow: "hidden", marginBottom: 14 }}>
            {data.segments.map((s, i) => (
              <div key={s.name} style={{ width: `${s.share}%`, background: s.color, borderRight: i < data.segments.length - 1 ? "1px solid rgba(255,255,255,0.2)" : "none" }} title={`${s.name} · ${s.share} %`} />
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "8px 18px" }}>
            {data.segments.map((s) => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 10, height: 10, background: s.color, display: "inline-block", flexShrink: 0, borderRadius: 2 }} />
                <span style={{ fontFamily: "var(--site-font)", fontSize: 13, color: "var(--ink-2)", flex: 1 }}>{s.name}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{s.share} %</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

/* ── KPIs ── */

function SecKpis({ data, loading = false }: { data: WorkstationData; loading?: boolean }) {
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  // 16 tiles de esqueleto mientras no hay métricas; el .kpi-tight (flex column,
  // space-between, min-height 92) deja la barrita-etiqueta arriba y la
  // barrita-valor abajo, calcando el tile real → sin salto al llegar los datos.
  const skeleton = loading || data.kpis.length === 0;
  return (
    <Section id="kpis" tone="muted">
      <SectionHead eyebrow="Métricas" meta="Yahoo Finance · TTM" title="Dieciséis indicadores, leídos juntos." />
      <div className="kpi-grid" style={{ background: "var(--surface)" }}>
        {skeleton
          ? Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="kpi-tight">
                <SkBar w="52%" h={9} />
                <SkBar w="66%" h={17} />
              </div>
            ))
          : data.kpis.map(([label, value, t, info]) => (
          <KpiTile
            key={label}
            label={label}
            value={value}
            tone={t}
            info={info}
            isOpen={openLabel === label}
            onToggle={() => setOpenLabel(openLabel === label ? null : label)}
            onClose={() => setOpenLabel(null)}
          />
        ))}
      </div>
      <div className="iline" style={{ marginTop: 14 }}>
        <strong>Notas:</strong>
        <span className="sep">·</span>TTM = trailing twelve months
      </div>
    </Section>
  );
}

function KpiTile({
  label, value, tone, info, isOpen, onToggle, onClose,
}: {
  label: string; value: string; tone: "pos" | "neg" | null; info?: string; isOpen: boolean; onToggle: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    function onClickOutside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onClickOutside); document.removeEventListener("keydown", onEsc); };
  }, [isOpen, onClose]);

  return (
    <div ref={ref} className={`kpi-tight ${tone === "pos" ? "tone-pos" : tone === "neg" ? "tone-neg" : ""}`} style={{ position: "relative" }}>
      {info && (
        <button
          type="button"
          className="kpi-info"
          data-open={isOpen}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          aria-label={`Información sobre ${label}`}
        >
          i
        </button>
      )}
      <div className="label" style={{ paddingRight: info ? 22 : 0 }}>{label}</div>
      <div className="row"><div className="v">{value}</div></div>
      {/* Toggletip, no tooltip: el panel lo abre el click, así que role="tooltip"
          mentía (ese rol describe algo disparado por hover/focus) y encima
          chocaba con el aria-expanded del botón —dos contratos mezclados. El
          patrón correcto es la live region: se anuncia el texto recién cuando
          el usuario aprieta. Por eso NO va aria-describedby en el botón: le
          leería la explicación antes de tocarlo y el control parecería muerto. */}
      {info && (
        <div className="kpi-info-live" role="status">
          {isOpen && <div className="kpi-info-bubble">{info}</div>}
        </div>
      )}
    </div>
  );
}

/* ── Precio y resultados ── */

function SecPrice({ data, ticker, hasReport, stockData }: { data: WorkstationData; ticker: string; hasReport: boolean; stockData: StockData | null }) {
  const haveEps = data.quarters.some((q) => q.eps != null);
  const historicalPrices = stockData?.historicalPrices ?? null;
  const quarterlyRevenue = stockData?.quarterlyRevenue ?? null;

  return (
    <Section id="precio" tone="band">
      <SectionHead eyebrow="Precio y resultados" title={<>Precio histórico y resultados, <em>juntos.</em></>} />

      {/* El gráfico trae su propia tira de cotización y su barra de controles
          FUERA del marco (label + slider de período), igual que el valor cuota
          en /bng-seleccion-global. La tira vive ahí adentro porque el porcentaje
          sigue al período elegido, que es estado del gráfico. */}
      {historicalPrices && historicalPrices.length > 1 ? (
        <PriceChartInstitucional
          ticker={ticker}
          historicalPrices={historicalPrices}
          quarterlyRevenue={quarterlyRevenue}
          currency={data.currency}
          price={data.price}
          change1dPct={data.change1dPct}
          asOf={data.lastUpdated}
        />
      ) : (
        <div className="az-figure">
          <div className="az-figure-hd">
            <span className="lbl"><strong>{ticker}</strong> · Precio histórico</span>
            <span className="src">Yahoo Finance</span>
          </div>
          <div className="skeleton-block" style={{ height: 280, borderRadius: 4 }} />
        </div>
      )}

      {haveEps && (
        <div style={{ marginTop: 26, overflowX: "auto" }}>
          <div className="az-block-lbl">Beat / miss por trimestre</div>
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
              {data.quarters.filter((q) => q.eps != null && q.consEps != null).map((q) => {
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
                    <td><span className={`rpill ${q.beat ? "buy" : "sell"}`}>{q.beat ? "Beat" : "Miss"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 30, paddingTop: 26, borderTop: "1px solid var(--site-border)" }}>
        <div className="az-block-lbl">Lectura del último trimestre</div>
        {hasReport && data.driversMd ? (
          <div className="az-prose prose-cols"><ReactMarkdown>{data.driversMd}</ReactMarkdown></div>
        ) : (
          <ProseSkeleton lines={5} />
        )}
      </div>
    </Section>
  );
}

/* ── Estado de resultados (Sankey) ── */

function SecIncome({ data, hasReport, segmentData }: { data: WorkstationData; hasReport: boolean; segmentData: SegmentSankeyData | null }) {
  return (
    <Section id="income" tone="muted">
      <SectionHead
        eyebrow="Estado de resultados"
        meta={data.filingRef ? <>{data.filingRef}{data.asOf ? <><br />{data.asOf}</> : null}</> : undefined}
        title="De dónde sale cada dólar de utilidad neta."
      />

      <div className="az-figure" style={{ marginBottom: segmentData && data.provenance.note ? 12 : 30 }}>
        {segmentData ? (
          <SankeyChart data={segmentData} />
        ) : hasReport ? (
          <div style={{ padding: "56px 16px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-3)", lineHeight: 1.6, maxWidth: "60ch", marginInline: "auto" }}>
            {data.provenance.note ?? "Estado de resultados no disponible para este informe."}
          </div>
        ) : (
          <div className="skeleton-block" style={{ height: 420, borderRadius: 4 }} />
        )}
      </div>

      {segmentData && data.provenance.note && (
        <div style={{ marginBottom: 30, paddingLeft: 14, borderLeft: "2px solid var(--rule-strong)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)", lineHeight: 1.55 }}>
          {data.provenance.note}
        </div>
      )}

      <div className="split">
        <div>
          <div className="az-block-lbl">Análisis del income statement</div>
          {hasReport && data.incomeNarrativeMd ? (
            <div className="az-prose az-prose--tight"><ReactMarkdown>{data.incomeNarrativeMd}</ReactMarkdown></div>
          ) : (
            <ProseSkeleton lines={6} />
          )}
        </div>
        <div>
          {data.sankey && (
            <>
              <div className="az-block-lbl">Cascada · valores absolutos y % sobre revenue</div>
              <CascadeTable s={data.sankey} />
            </>
          )}
        </div>
      </div>
    </Section>
  );
}

function CascadeTable({ s }: { s: SankeyData }) {
  const pct = (v: number) => (s.revenue > 0 ? `${fmtNum((v / s.revenue) * 100, 1)} %` : "—");
  const unit: "B" | "M" | "K" = s.revenue >= 1 ? "B" : s.revenue >= 0.001 ? "M" : "K";
  const scale = unit === "B" ? 1 : unit === "M" ? 1_000 : 1_000_000;
  const dec = unit === "B" ? 1 : 0;
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
    <table className="ctbl" style={{ background: "var(--surface)" }}>
      <thead>
        <tr><th>Línea</th><th>Valor ({unit})</th><th>% Rev</th></tr>
      </thead>
      <tbody>
        {rows.map(([label, v, pctText, t]) => {
          const bg = t === "highlight" ? "var(--navy-050)" : undefined;
          const weight = t === "highlight" && (label === "Revenue" || label === "Net income") ? 600 : 400;
          const color = t === "neg" ? "var(--neg)" : "var(--ink)";
          return (
            <tr key={label}>
              <td style={{ background: bg, fontWeight: weight, color: "var(--ink)" }}>{label}</td>
              <td style={{ background: bg, fontWeight: weight, color }}>{fmtNum(v * scale, dec)}</td>
              <td style={{ background: bg, fontWeight: weight, color }}>{pctText}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ── Balance y caja ── */

function SecBalance({ data, hasReport }: { data: WorkstationData; hasReport: boolean }) {
  const acf = data.annualCashFlow;
  const blocks: Array<[string, string]> = [
    ["Salud del balance", data.balanceSheetMd],
    ["Free cash flow", data.freeCashFlowMd],
    ["Inversión de capital · CAPEX", data.capitalExpenditureMd],
    ["Asignación de capital · track record", data.capitalAllocationMd],
  ];
  return (
    <Section id="balance" tone="band">
      <SectionHead eyebrow="Balance y caja" meta="Yahoo Finance · anual 10-K" title={<>De los pasivos al track record, <em>cuatro lecturas.</em></>} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "34px clamp(32px,5vw,64px)", marginBottom: 34 }} className="az-balance-grid">
        {blocks.map(([lbl, md]) => (
          <div key={lbl}>
            <div className="az-block-lbl">{lbl}</div>
            {hasReport && md ? (
              <div className="az-prose az-prose--tight"><ReactMarkdown>{md}</ReactMarkdown></div>
            ) : <ProseSkeleton lines={5} />}
          </div>
        ))}
      </div>

      {acf.length > 0 && (
        <div style={{ paddingTop: 30, borderTop: "1px solid var(--site-border)" }}>
          <div className="az-block-lbl">CAPEX · OCF · FCF · últimos {acf.length} ejercicios</div>
          <div style={{ overflowX: "auto" }}>
            <table className="ctbl">
              <thead>
                <tr><th>Línea</th>{acf.map((y) => (<th key={y.year}>FY {y.year}</th>))}</tr>
              </thead>
              <tbody>
                <tr>
                  <td>CAPEX</td>
                  {acf.map((y) => (<td key={y.year} className="neg-fg">{y.capitalExpenditure != null ? fmtCompactB(Math.abs(y.capitalExpenditure)) : "—"}</td>))}
                </tr>
                <tr>
                  <td>OCF</td>
                  {acf.map((y) => (<td key={y.year}>{y.operatingCashFlow != null ? fmtCompactB(y.operatingCashFlow) : "—"}</td>))}
                </tr>
                <tr>
                  <td>FCF</td>
                  {acf.map((y) => (<td key={y.year} className={(y.freeCashFlow ?? 0) >= 0 ? "pos-fg" : "neg-fg"}>{y.freeCashFlow != null ? fmtCompactB(y.freeCashFlow) : "—"}</td>))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`@media (max-width: 760px) { #balance .az-balance-grid { grid-template-columns: 1fr !important; } }`}</style>
    </Section>
  );
}

function fmtCompactB(n: number): string {
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${sign}${fmtNum(abs / 1e12, 2)} T`;
  if (abs >= 1e9) return `${sign}${fmtNum(abs / 1e9, 1)} B`;
  if (abs >= 1e6) return `${sign}${fmtNum(abs / 1e6, 0)} M`;
  return sign + fmtNum(abs, 0);
}

/* ── Industria y gestión ── */

function SecIndustry({ data, hasReport }: { data: WorkstationData; hasReport: boolean }) {
  return (
    <Section id="industria" tone="muted">
      <SectionHead eyebrow="Industria y gestión" meta="Contexto sectorial · 10-K · Proxy" title="Dónde compite, quiénes la dirigen." />
      <div className="split">
        <div>
          <div className="az-block-lbl">Contexto de industria</div>
          {hasReport && data.industryContextMd ? (
            <div className="az-prose az-prose--tight"><ReactMarkdown>{data.industryContextMd}</ReactMarkdown></div>
          ) : <ProseSkeleton lines={8} />}
        </div>
        <div>
          <div className="az-block-lbl">Calidad de la gestión</div>
          {hasReport && data.managementQualityMd ? (
            <div className="az-prose az-prose--tight"><ReactMarkdown>{data.managementQualityMd}</ReactMarkdown></div>
          ) : <ProseSkeleton lines={8} />}
        </div>
      </div>
    </Section>
  );
}

/* ── Wall Street ──────────────────────────────────────────────────────────────

   UNA lámina, no cuatro bloques. Antes esta sección eran cuatro objetos sueltos
   —donut enmarcado, rango enmarcado, prosa suelta y tabla enmarcada— repartidos
   en dos columnas que terminaban a distinta altura. Ahora es un solo registro
   contable continuo: la regla fuerte de tinta abre, cada renglón comparte el
   mismo gutter de etiqueta, y las hairlines internas son lo único que separa.

   La opinión de la calle son tres registros del mismo enunciado —cuántos
   recomiendan qué (dirección), a qué precio (magnitud), y cómo cambió eso
   últimamente (revisiones)— y se cierran con la lectura de la casa. El donut
   muere: la convención institucional para una distribución de ratings es la
   barra apilada horizontal, y acá la barra es el propio filete que corona
   celdas de ancho proporcional, así que forma y cifra son un mismo objeto.
   ────────────────────────────────────────────────────────────────────────── */

function SecWallStreet({ data, ticker, hasReport, loading = false }: { data: WorkstationData; ticker: string; hasReport: boolean; loading?: boolean }) {
  const c = data.consensus;
  const total = c.buy + c.hold + c.sell;
  const hasTargets = c.targetLow != null && c.targetHigh != null && c.targetAvg != null;
  const price = data.price != null && data.price > 0 ? data.price : null;
  const upside = c.targetAvg != null && price != null ? ((c.targetAvg - price) / price) * 100 : null;

  // En loading, esqueleto de los cuatro registros — NO el mensaje "sin cobertura",
  // que es un desenlace real que todavía no se conoce.
  if (loading) {
    return (
      <Section id="wallst" tone="band">
        <SectionHead eyebrow="Wall Street" meta="Yahoo Finance · consenso y revisiones" title={<>La calle, sobre {ticker}.</>} />
        <div className="az-ws">
          {["Consenso", "Precio objetivo", "Revisiones", "Interpretación de la mesa"].map((l, i) => (
            <div key={l} className="az-ws-reg">
              <div className="az-ws-lbl"><div className="l">{l}</div></div>
              <ProseSkeleton lines={i === 2 ? 3 : 2} />
            </div>
          ))}
        </div>
      </Section>
    );
  }

  if (total === 0 && !hasTargets && data.analystActions.length === 0) {
    return (
      <Section id="wallst" tone="band">
        <SectionHead eyebrow="Wall Street" meta="Yahoo Finance · consenso" title={`Sin cobertura disponible para ${ticker}.`} />
        <p className="az-prose az-prose--tight" style={{ color: "var(--ink-3)" }}>
          Yahoo Finance no reporta consenso de analistas ni revisiones recientes para este ticker.
          La ausencia de cobertura no es en sí una señal negativa: describe el interés del
          sell-side, no el valor del negocio.
        </p>
      </Section>
    );
  }

  const buckets = ([
    ["Comprar", c.buy, "var(--pos)"],
    ["Mantener", c.hold, "var(--neu)"],
    ["Vender", c.sell, "var(--neg)"],
  ] as const).filter(([, n]) => n > 0);

  return (
    <Section id="wallst" tone="band">
      <SectionHead
        eyebrow="Wall Street"
        meta="Yahoo Finance · consenso y revisiones"
        title={total > 0 ? <>{total} analistas siguen a {ticker}.</> : <>La calle, sobre {ticker}.</>}
        dek={streetDek(c, total, upside, ticker)}
      />

      <div className="az-ws">
        {total > 0 && (
          <div className="az-ws-reg">
            <div className="az-ws-lbl">
              <div className="l">Consenso</div>
              <div className="s">{total} {total === 1 ? "analista" : "analistas"}</div>
            </div>
            <div className="az-ws-dist" style={{ gridTemplateColumns: buckets.map(([, n]) => `minmax(min-content, ${n}fr)`).join(" ") }}>
              {buckets.map(([label, n, color]) => (
                <div key={label} className="az-ws-seg" style={{ "--seg": color, "--share": `${(n / total) * 100}%` } as React.CSSProperties}>
                  <div className="k">{label}</div>
                  <div className="n">{n}</div>
                  <div className="p">{fmtNum((n / total) * 100, 0)} %</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasTargets && (
          <div className="az-ws-reg">
            <div className="az-ws-lbl">
              <div className="l">Precio objetivo</div>
              <div className="s">Rango de la calle</div>
            </div>
            <TargetRail low={c.targetLow!} avg={c.targetAvg!} high={c.targetHigh!} price={price} upside={upside} />
          </div>
        )}

        <div className="az-ws-reg">
          <div className="az-ws-lbl">
            <div className="l">Revisiones</div>
            <div className="s">
              {data.analystActions.length > 0
                ? `Últimas ${data.analystActions.length}`
                : "Sin registro"}
            </div>
          </div>
          <div>
            {data.analystActions.length > 0 ? (
              data.analystActions.map((a, i) => {
                const kind = actionKind(a.action);
                const from = a.fromGrade && a.fromGrade !== "—" ? a.fromGrade : null;
                const to = a.toGrade && a.toGrade !== "—" ? a.toGrade : null;
                return (
                  <div className="az-ws-row" key={`${a.firm}-${a.date}-${i}`}>
                    <span className="d">{fmtDateEs(a.date)}</span>
                    <span className="f">{a.firm}</span>
                    <span className={`v ${kind ?? ""}`}>{kind ? ACTION_LABEL[kind] : ""}</span>
                    <span className="g">
                      {/* El "de → a" se imprime sólo si la calificación se movió
                          de verdad: en reiteraciones Yahoo manda from = to, y
                          repetirla dos veces con una flecha en el medio es ruido. */}
                      {from && to && from !== to && <>{from}<span className="ar">→</span></>}
                      {to ? <span className={`to ${classifyGrade(to)}`}>{to}</span> : "—"}
                    </span>
                  </div>
                );
              })
            ) : (
              <div style={{ fontFamily: "var(--site-font)", fontSize: 16, lineHeight: 1.58, color: "var(--ink-3)" }}>
                Ninguna firma cambió su calificación en el período reportado.
              </div>
            )}
          </div>
        </div>

        <div className="az-ws-reg">
          <div className="az-ws-lbl">
            <div className="l">Interpretación de la mesa</div>
            <div className="s">Modelo Bengochea</div>
          </div>
          <div style={{ maxWidth: "68ch" }}>
            {hasReport && data.consensusNarrativeMd ? (
              <div className="az-prose az-prose--tight"><ReactMarkdown>{data.consensusNarrativeMd}</ReactMarkdown></div>
            ) : (
              <ProseSkeleton lines={5} />
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}

/* Eje del precio objetivo. El rango de la calle es CONTEXTO —bracket de
   hairline con topes—, y lo único que lleva color es el tramo firmado entre el
   precio de hoy y el consenso: verde si la calle todavía ve recorrido, rojo si
   el precio ya lo pasó. El dominio se estira para incluir el precio actual, así
   un precio fuera del rango nunca queda pegado al tope mintiendo. */
function TargetRail({
  low, avg, high, price, upside,
}: { low: number; avg: number; high: number; price: number | null; upside: number | null }) {
  const dLo = Math.min(low, price ?? low);
  const dHi = Math.max(high, price ?? high);
  const span = dHi - dLo;
  const pad = span > 0 ? span * 0.07 : Math.max(Math.abs(dHi) * 0.05, 1);
  const d0 = dLo - pad;
  const d1 = dHi + pad;
  const P = (v: number) => (d1 > d0 ? ((v - d0) / (d1 - d0)) * 100 : 50);

  const pLow = P(low), pHigh = P(high), pAvg = P(avg);
  const pNow = price != null ? P(price) : null;
  // Un solo criterio de decimales para TODO el eje: decidirlo cifra por cifra
  // dejaba "Mínimo 99,00" al lado de "Máximo 101" en el mismo renglón.
  const dec = [low, avg, high, price].some((v) => v != null && Math.abs(v) < 100) ? 2 : 0;
  const f = (v: number) => fmtNum(v, dec);
  // El label se ancla al marcador sin desbordar nunca el contenedor: a 0 % queda
  // alineado a izquierda, a 100 % a derecha, y centrado en el medio.
  const flag = (p: number): React.CSSProperties => ({ left: `${p}%`, transform: `translateX(-${p}%)` });
  const gapColor = upside != null && upside >= 0 ? "var(--pos)" : "var(--neg)";

  return (
    <div className="az-ws-axis">
      {price != null && pNow != null && (
        <div className="az-ws-flags">
          <span className="az-ws-flag now" style={flag(pNow)}>Hoy · USD {f(price)}</span>
        </div>
      )}

      <div className="az-ws-rail">
        <span className="base" />
        <span className="range" style={{ left: `${pLow}%`, width: `${Math.max(0, pHigh - pLow)}%` }} />
        {pNow != null && (
          <span className="gap" style={{ left: `${Math.min(pNow, pAvg)}%`, width: `${Math.abs(pAvg - pNow)}%`, background: gapColor }} />
        )}
        {/* Los topes van DESPUÉS del tramo firmado: cuando el precio se sale del
            rango, la barra de color los tapaba y el mínimo/máximo desaparecía. */}
        <span className="cap" style={{ left: `${pLow}%` }} />
        <span className="cap" style={{ left: `${pHigh}%` }} />
        <span className="avg" style={{ left: `${pAvg}%` }} />
        {pNow != null && <span className="now" style={{ left: `${pNow}%` }} />}
      </div>

      <div className="az-ws-flags head">
        <span className="az-ws-flag avg" style={flag(pAvg)}>
          <span className="t">Consenso</span>USD {f(avg)}
          {upside != null && (
            <span className="dl" style={{ color: upside >= 0 ? "var(--pos)" : "var(--neg)" }}>{fmtPct(upside, 1)}</span>
          )}
        </span>
      </div>

      <div className="az-ws-flags tight">
        <span className="az-ws-flag end" style={flag(pLow)}>Mínimo {f(low)}</span>
        <span className="az-ws-flag end" style={flag(pHigh)}>Máximo {f(high)}</span>
      </div>
    </div>
  );
}

/* Bajada derivada SOLO de los datos: qué recomienda la mayoría de la cobertura y
   si el precio ya se comió el objetivo medio. Enunciado atributivo (lo dice la
   calle, no la casa), nunca una instrucción a cartera. */
function streetDek(
  c: WorkstationData["consensus"],
  total: number,
  upside: number | null,
  ticker: string,
): React.ReactNode {
  const parts: string[] = [];

  if (total > 0) {
    const top = ([
      ["compra", c.buy],
      ["mantener", c.hold],
      ["venta", c.sell],
    ] as const).reduce((a, b) => (b[1] > a[1] ? b : a));
    const pct = fmtNum((top[1] / total) * 100, 0);
    parts.push(
      top[0] === "mantener"
        ? `El ${pct} % de la cobertura mantiene a ${ticker} en neutral`
        : `El ${pct} % de la cobertura califica a ${ticker} como ${top[0]}`,
    );
  }

  if (upside != null) {
    const mag = fmtNum(Math.abs(upside), 1);
    if (upside < -1) parts.push(`y el precio ya cotiza ${mag} % por encima del objetivo medio`);
    else if (upside > 1) parts.push(`y el objetivo medio deja ${mag} % de recorrido`);
    else parts.push("y el precio está en línea con el objetivo medio");
  }

  if (parts.length === 0) return undefined;
  return `${parts.join(" ")}.`;
}

const ACTION_LABEL: Record<"up" | "down" | "flat" | "init", string> = {
  up: "Suba",
  down: "Baja",
  flat: "Reitera",
  init: "Inicia",
};

// Yahoo entrega el movimiento en su jerga cruda ("up", "down", "main", "reit",
// "init"), que hasta ahora se imprimía tal cual en una página en español. Un
// código que no reconocemos no se traduce a nada: inventarle "Reitera" sería
// afirmar un movimiento que no consta.
function actionKind(action: string): "up" | "down" | "flat" | "init" | null {
  const a = action.toLowerCase();
  if (a.includes("up")) return "up";
  if (a.includes("down")) return "down";
  if (a.includes("init")) return "init";
  if (a.includes("main") || a.includes("reit")) return "flat";
  return null;
}

/* ──────────────────────────────────────────────────────────────
   Historia de la calificación
   ────────────────────────────────────────────────────────────── */

type VerdictRun = {
  rating: "BUY" | "HOLD" | "AVOID";
  conviction: string | null;
  since: number;
  priceAt: number | null;
  count: number;
};

/**
 * Archivo de calificaciones del ticker. Sale de verdict_log vía
 * /api/verdict-history: una consulta indexada, sin upstreams y sin costo, así
 * que se pide en paralelo al análisis y no lo demora.
 *
 * Falla en silencio a propósito: sin historia el bloque no se dibuja y el
 * informe queda exactamente como antes.
 */
function useVerdictHistory(ticker: string) {
  const [data, setData] = useState<{ runs: VerdictRun[]; previous: string | null; total: number } | null>(null);

  // Sin resets al cambiar de ticker: el bloque se monta con key={ticker}, así que
  // un ticker nuevo trae estado limpio. Resetear acá además viola la regla de no
  // llamar setState sincrónico dentro de un effect.
  useEffect(() => {
    if (!ticker) return;
    let cancelado = false;
    fetch(`/api/verdict-history?ticker=${encodeURIComponent(ticker)}`, { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelado) setData(j); })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [ticker]);

  return data;
}

/**
 * "Cómo se movió esta calificación", dentro del panel de veredicto.
 *
 * Muestra el arranque de cada TRAMO, no cada generación: lo que importa es desde
 * cuándo la casa dice lo que dice, y cuál era la lectura anterior. Un solo tramo
 * también es información —"sostenido en N análisis"—, pero con un único veredicto
 * en el archivo no hay nada que contar y el bloque se calla.
 *
 * Todo el texto va en la rampa blanca del panel, sin teñir los ratings viejos: el
 * fondo del bloque YA es el color del veredicto vigente, y pintar un BUY verde
 * ahí adentro competiría con esa señal.
 */
function VerdictHistoryBlock({ ticker }: { ticker: string }) {
  const hist = useVerdictHistory(ticker);
  if (!hist || hist.total < 2 || hist.runs.length === 0) return null;

  const sinCambios = hist.runs.length === 1;

  return (
    <>
      <div style={{ height: 1, background: "rgba(255,255,255,0.25)", margin: "16px 0 12px" }} />
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>
        {sinCambios ? "Calificación sostenida" : "Cómo se movió"}
      </div>
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
        {hist.runs.map((r) => (
          <div key={r.since} style={{ display: "flex", alignItems: "baseline", gap: 8, fontFamily: "var(--font-mono)", fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
            <span style={{ color: "rgba(255,255,255,0.6)", minWidth: 62 }}>{fmtFechaMs(r.since)}</span>
            <span style={{ color: "var(--ivory)", letterSpacing: "0.06em", minWidth: 42 }}>{r.rating}</span>
            <span style={{ color: "rgba(255,255,255,0.72)" }}>
              {r.priceAt != null ? `USD ${fmtNum(r.priceAt)}` : "—"}
            </span>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: "var(--site-font)", fontSize: 11, lineHeight: 1.5, color: "rgba(255,255,255,0.62)", marginTop: 8, maxWidth: "26em" }}>
        {sinCambios
          ? `Sin cambios en ${hist.total} análisis de esta acción.`
          : `${hist.total} análisis registrados. La fecha es el día en que la casa pasó a esa calificación.`}
      </div>
    </>
  );
}

const MESES_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Las fechas llegan como ISO (YYYY-MM-DD). Se parsean por partes —no con
// `new Date(iso)`— para que no se corran un día por zona horaria.
function fmtDateEs(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const mes = MESES_ES[parseInt(m[2], 10) - 1];
  if (!mes) return iso;
  return `${parseInt(m[3], 10)} ${mes} ${m[1]}`;
}

// Fecha a partir de un timestamp en ms (lo que guarda verdict_log). No alcanza
// con `fmtDateEs(new Date(ms).toISOString())`: eso entrega la marca ENTERA
// —"2026-07-21T01:54:41.101Z"—, el regex de fmtDateEs no matchea y devolvía el
// ISO crudo, que es lo que se veía en el archivo del veredicto. Las partes se
// leen en hora local (el resto del informe estampa en es-UY con getters locales,
// ver fmtStampDate en el adaptador); recortar el ISO en UTC corría un día para
// atrás toda calificación sellada después de las 21:00 de Uruguay.
function fmtFechaMs(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return fmtDateEs(`${d.getFullYear()}-${mm}-${dd}`);
}

function classifyGrade(grade: string): "buy" | "hold" | "sell" {
  const g = grade.toLowerCase();
  if (g.includes("buy") || g.includes("outperform") || g.includes("overweight") || g.includes("strong")) return "buy";
  if (g.includes("sell") || g.includes("underperform") || g.includes("underweight")) return "sell";
  return "hold";
}

/* ── Noticias ── */

function SecNews({ data }: { data: WorkstationData }) {
  if (!data.recentNews || data.recentNews.length === 0) return null;
  const news = [...data.recentNews].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return b.publishedAt.localeCompare(a.publishedAt);
  });
  const publisherColor = (tier: 1 | 2 | 3 | 4): string => (tier === 1 ? "var(--ink)" : tier === 2 ? "var(--ink-2)" : "var(--ink-3)");

  return (
    <Section id="noticias" tone="muted" tight>
      <SectionHead eyebrow="Noticias" meta={`${news.length} items · por relevancia y fecha`} title={<>Flujo de información <em>relevante.</em></>} />
      <ol style={{ listStyle: "none", padding: 0, margin: 0, borderTop: "1px solid var(--site-border)" }}>
        {news.map((n, i) => (
          <li key={`${n.publishedAt}-${i}`} style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: 20, padding: "16px 0", borderBottom: "1px solid var(--site-border)", alignItems: "baseline" }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>{n.publishedAt}</span>
            <div>
              {n.link ? (
                <a href={n.link} target="_blank" rel="noopener noreferrer" className="news-title-link" style={{ fontSize: 17, fontWeight: 400, color: "var(--ink)", letterSpacing: "-0.01em", lineHeight: 1.35, textDecoration: "none", borderBottom: "1px solid transparent", transition: "border-color 160ms ease" }}>
                  {n.title}
                </a>
              ) : (
                <span style={{ fontSize: 17, color: "var(--ink)", letterSpacing: "-0.01em" }}>{n.title}</span>
              )}
              {n.description && (
                <div style={{ fontFamily: "var(--site-font)", fontSize: 14.5, lineHeight: 1.5, color: "var(--ink-2)", marginTop: 6, maxWidth: "72ch" }}>{n.description}</div>
              )}
              <div className="mono" style={{ fontSize: 11, color: publisherColor(n.tier), marginTop: n.description ? 8 : 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>{n.publisher}</div>
            </div>
          </li>
        ))}
      </ol>
      <style>{`#noticias .news-title-link:hover { border-bottom-color: var(--gold-deep) !important; }`}</style>
    </Section>
  );
}

/* ── Escenarios ── */

function SecScenarios({ data, hasReport }: { data: WorkstationData; hasReport: boolean }) {
  const bull = data.bullCase;
  const bear = data.bearCase;
  const hasProbs = data.bullProbability != null && data.bearProbability != null;

  return (
    <Section id="escenarios" tone="band">
      <SectionHead eyebrow="Escenarios" meta="Modelo Bengochea · probabilidad y EV" title={<>Tres lecturas, <em>tres precios.</em></>} />

      {hasReport && (bull || bear) ? (
        <>
          <div className="az-scen-grid">
            {bull && (
              <article className="az-scen bull">
                <div className="az-scen-lbl">Escenario alcista</div>
                <div className="az-scen-val">USD {bull.priceTarget}</div>
                {hasProbs && <div className="az-scen-prob" style={{ color: "var(--pos)" }}>Probabilidad {data.bullProbability} %</div>}
                <div className="az-scen-body"><ReactMarkdown>{bull.narrative}</ReactMarkdown></div>
              </article>
            )}
            {data.target != null && (
              <article className="az-scen base">
                <div className="az-scen-lbl">Caso base · objetivo casa</div>
                <div className="az-scen-val">USD {fmtNum(data.target, 0)}</div>
                {hasProbs && data.baseProbability != null && <div className="az-scen-prob" style={{ color: "var(--gold-deep)" }}>Probabilidad {data.baseProbability} %</div>}
                <div className="az-scen-body" style={{ fontFamily: "var(--site-font)", fontSize: 14 }}>
                  Escenario más probable según la lectura cuantitativa del modelo.{data.targetUpside != null ? ` Upside ${fmtPct(data.targetUpside)} vs precio actual.` : ""}
                </div>
              </article>
            )}
            {bear && (
              <article className="az-scen bear">
                <div className="az-scen-lbl">Escenario bajista</div>
                <div className="az-scen-val">USD {bear.priceTarget}</div>
                {hasProbs && <div className="az-scen-prob" style={{ color: "var(--neg)" }}>Probabilidad {data.bearProbability} %</div>}
                <div className="az-scen-body"><ReactMarkdown>{bear.narrative}</ReactMarkdown></div>
              </article>
            )}
          </div>

          {(data.expectedValue != null || data.riskReward) && (
            <div style={{ marginTop: 26, paddingTop: 20, borderTop: "1px solid var(--site-border)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
              {data.expectedValue != null && (
                <div>
                  <div className="eyebrow-plain">Valor esperado ponderado</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
                    <div className="mono" style={{ fontSize: 24, color: "var(--ink)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>USD {fmtNum(data.expectedValue, 0)}</div>
                    {data.expectedValueUpside != null && (
                      <div className="mono" style={{ fontSize: 13, color: data.expectedValueUpside >= 0 ? "var(--pos)" : "var(--neg)", fontVariantNumeric: "tabular-nums" }}>{fmtPct(data.expectedValueUpside)} vs {fmtNum(data.price)}</div>
                    )}
                  </div>
                </div>
              )}
              {data.riskReward && (
                <div>
                  <div className="eyebrow-plain">Risk / reward asimetría</div>
                  <div className="mono" style={{ fontSize: 24, color: "var(--ink)", fontWeight: 500, marginTop: 8, fontVariantNumeric: "tabular-nums" }}>{data.riskReward}</div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="az-scen-grid">
          <div className="az-scen"><ProseSkeleton lines={6} /></div>
          <div className="az-scen"><ProseSkeleton lines={6} /></div>
          <div className="az-scen"><ProseSkeleton lines={6} /></div>
        </div>
      )}
    </Section>
  );
}

/* ── Riesgos y catalizadores ── */

function SecRisks({ data, hasReport }: { data: WorkstationData; hasReport: boolean }) {
  return (
    <Section id="riesgos" tone="muted">
      <SectionHead eyebrow="Riesgos y catalizadores" title="Lo que puede ir mal. Lo que puede ir mejor." />
      <div className="split">
        <div>
          <div className="az-block-lbl">Riesgos</div>
          {hasReport && data.risksMd ? (
            <div className="az-prose az-prose--tight"><ReactMarkdown>{data.risksMd}</ReactMarkdown></div>
          ) : <ProseSkeleton lines={8} />}
        </div>
        <div>
          <div className="az-block-lbl">Catalizadores</div>
          {hasReport && data.catalystsMd ? (
            <div className="az-prose az-prose--tight"><ReactMarkdown>{data.catalystsMd}</ReactMarkdown></div>
          ) : <ProseSkeleton lines={8} />}
        </div>
      </div>
    </Section>
  );
}

/* ── Disclaimer ── */

function SecDisclaimer() {
  return (
    <Section id="disclaimer" tone="muted" tight>
      <div className="az-disclaimer">
        <div className="ic"><Icon d={ICON_SHIELD} size={34} /></div>
        <div>
          <div className="eyebrow-sm" style={{ marginBottom: 10 }}>Aviso legal</div>
          <h3 className="az-title" style={{ fontSize: "clamp(21px,2.2vw,27px)", marginBottom: 14 }}>Esta herramienta es complemento, no reemplazo.</h3>
          <p style={{ fontFamily: "var(--site-font)", fontSize: 14, lineHeight: 1.65, color: "var(--ink-2)", margin: 0, maxWidth: "68ch" }}>
            El reporte se construye con datos públicos (Yahoo Finance, SEC EDGAR) y un análisis asistido por OpenAI GPT-4o, con fines exclusivamente informativos. Es un análisis general, no personalizado: no constituye oferta, invitación ni promoción para comprar o vender valor alguno, ni asesoramiento de inversión, legal o fiscal. Los valores analizados son instrumentos extranjeros no inscriptos en el Registro del Mercado de Valores del Banco Central del Uruguay y no son objeto de oferta pública en Uruguay. Toda decisión de inversión debe discutirse con uno de nuestros asesores habilitados, considerando el perfil, horizonte y restricciones de cada cliente. La información puede contener errores u omisiones y está sujeta a actualización sin previo aviso; el desempeño pasado no garantiza resultados futuros.
          </p>
        </div>
      </div>
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────
   Estados: loading / error
   ────────────────────────────────────────────────────────────── */

// (LoadingShell eliminado: el estado de carga ahora renderiza el masthead + el
// cuerpo REALES en modo esqueleto — ver `bootstrapping` en AnalisisReporteInner
// y el prop `loading` del masthead / ReportBody —, así la estructura no salta a
// otro shell cuando llegan los datos: cada dato cae en su lugar.)

/**
 * Peaje de correo antes de GENERAR un análisis (nunca antes de leer uno ya
 * hecho — esos salen del cache y no cuestan nada).
 *
 * El copy dice la verdad del intercambio en vez de disfrazarlo de "registrate":
 * este análisis no existe todavía, correrlo cuesta, y queda publicado para
 * cualquiera. Se cobra en el momento de máxima intención — la persona ya eligió
 * el ticker — y no antes.
 *
 * El formulario es el MISMO NewsletterSignup de /informes: una sola captura,
 * un solo consentimiento, un solo lugar donde meter la validación de dirección
 * cuando llegue.
 */
function LeadGateForm({ isRefresh, onUnlocked }: { isRefresh: boolean; onUnlocked: () => void }) {
  return (
    <>
      {/* Eyebrow callado en sentence-case (docs/lenguaje-visual.md §2): el
          .eyebrow-sm es ink-3, NO dorado. El oro se raciona a una palabra del
          titular, vía `.az-title em` — que en este sistema pinta oro SIN
          itálica. */}
      <div className="eyebrow-sm">{isRefresh ? "Actualizar" : "Análisis completo"}</div>
      <h2 className="az-title gp-title">
        {isRefresh ? (
          <>Para rehacerlo, dejanos tu <em>correo</em>.</>
        ) : (
          <>Para verlo, dejanos tu <em>correo</em>.</>
        )}
      </h2>
      {/* El copy anterior abría con "Todavía no lo generamos", que es cierto pero
          arranca desinflando. Éste lidera con lo que se recibe y deja el tiempo
          como dato de rapidez, no como excusa.
          NO sacar la referencia al minuto: el informe todavía no existe. Sin ese
          dato, "para verlo" sobre un informe desenfocado se lee como que ya está
          hecho esperando atrás, y quien lo crea se come 60-90 s de espera que no
          esperaba. Además el propio lenguaje de la casa es anti-hype y pide
          estados honestos (docs/lenguaje-visual.md §6 y §7). */}
      <p className="gp-lead">
        {isRefresh
          ? "Vuelve a leer los estados contables y el mercado desde cero. Lo tenés en pantalla en menos de un minuto."
          : "Veredicto, métricas, flujo de resultados, escenarios y riesgos. Lo tenés en pantalla en menos de un minuto."}
      </p>
      {/* "Ver análisis" y no "Generar análisis": el titular ya promete verlo, y
          que el botón dijera "generar" delataba dentro del mismo panel que el
          informe no está hecho. Lo que sostiene la honestidad de la pieza es el
          "menos de un minuto" del lead — ahí se avisa la espera. Si alguna vez
          se saca esa frase, este botón tiene que volver a decir "generar". */}
      <NewsletterSignup
        source="analisis"
        ctaLabel={isRefresh ? "Actualizar" : "Ver análisis"}
        sendingLabel="Abriendo…"
        onSuccess={onUnlocked}
      />
    </>
  );
}


/**
 * Réplica estructural de la banda de tesis (veredicto · argumento · referencia
 * rápida) para el teaser. Es una copia SIMPLIFICADA de la que vive en
 * AnalyzeMasthead, no la misma: aquella depende de selectores `#masthead …` que
 * fuera de ese header no aplican, y sacarla de ahí para compartirla arriesgaba
 * la cabecera real a cambio de nada — desenfocada, la réplica es indistinguible.
 */
function TesisPreview({ data }: { data: WorkstationData }) {
  return (
    <div className="tp-grid">
      <div className="tp-verdict">
        <div className="tp-label">Veredicto</div>
        {/* El RATING no se dibuja, aunque la muestra lo tenga. A 56px seguía
            legible a través del desenfoque, y debajo del encabezado del ticker
            que la persona buscó se leía como el veredicto de la casa sobre ESA
            acción — una recomendación que nunca se emitió. Lo mismo con el
            target (28px). El resto del bloque va con los datos reales: a 11-13px
            no se lee nada, y así el bloque conserva su peso visual. */}
        <div className="tp-verdict-value">•••</div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="tp-label" style={{ opacity: 0.75 }}>Convicción</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 14 }}>{data.conviction ?? "—"}</span>
        </div>
        {data.verdict && data.conviction && CONVICTION_COPY[data.verdict]?.[data.conviction] && (
          <div className="tp-conviction-copy">{CONVICTION_COPY[data.verdict][data.conviction]}</div>
        )}

        <div className="tp-rule" />
        <div className="tp-label">Target 12 meses</div>
        <div className="tp-target">USD —</div>
        <div className="tp-fine">
          {data.targetUpside != null
            ? `Upside ${fmtPct(data.targetUpside)} desde USD ${fmtNum(data.price)}`
            : "Upside no disponible"}
        </div>
        {data.scenarioLow != null && data.scenarioHigh != null && (
          <div className="tp-fine">
            Rango escenarios USD {fmtNum(data.scenarioLow, 0)} – {fmtNum(data.scenarioHigh, 0)}
          </div>
        )}
        {(data.expectedValue != null || data.riskReward) && (
          <div className="tp-ev">
            {data.expectedValue != null && (
              <div>
                <div className="tp-label" style={{ fontSize: 9, opacity: 0.7 }}>EV ponderado</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, marginTop: 3 }}>
                  USD {fmtNum(data.expectedValue, 0)}
                </div>
              </div>
            )}
            {data.riskReward && (
              <div>
                <div className="tp-label" style={{ fontSize: 9, opacity: 0.7 }}>Riesgo / beneficio</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, marginTop: 3 }}>{data.riskReward}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="tp-thesis">
        <div className="eyebrow-sm" style={{ color: "var(--gold-deep)" }}>Tesis de inversión</div>
        <h3 className="az-title-serif" style={{ marginTop: 14, fontSize: 30 }}>
          Argumentos que sostienen el veredicto<em>.</em>
        </h3>
        {/* Markdown como en la banda real: el texto trae **negritas** y sin
            renderizarlo se veían los asteriscos crudos. */}
        <div className="az-prose" style={{ marginTop: 16 }}>
          <ReactMarkdown>{data.thesisMd}</ReactMarkdown>
        </div>
      </div>

      <div className="tp-qref">
        <div className="eyebrow-plain" style={{ marginBottom: 10 }}>Quick ref</div>
        {data.kpis.slice(0, 7).map(([label, value]) => (
          <div key={label} className="tp-qref-row">
            <span>{label}</span>
            <span className="tp-qref-val">{value}</span>
          </div>
        ))}
      </div>

      <style>{`
        .tp-grid {
          display: grid;
          grid-template-columns: 280px 1fr 240px;
          border-top: 1px solid var(--rule);
          border-bottom: 1px solid var(--rule);
        }
        /* NAVY, no el color del rating. En el informe real este bloque se tiñe
           con el veredicto —verde BUY, rojo AVOID, gris HOLD— así que el color
           es un segundo canal que comunica la calificación aunque no se lea la
           palabra: un bloque gris sobre la página de ORCL se interpreta como un
           HOLD para ORCL. El navy de la casa está fuera de esa paleta (ya se usa
           como banda institucional en el propio informe) y a #0f2249 se
           distingue del gris #5C5F7A incluso desenfocado. */
        .tp-verdict { background: var(--navy); color: var(--ivory); padding: 24px; border-right: 1px solid var(--rule); }
        .tp-label {
          font-family: var(--font-mono); font-size: 10px; font-weight: 500;
          letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.8);
        }
        .tp-verdict-value {
          font-family: var(--font-mono); font-size: 56px; font-weight: 500; line-height: 1;
          letter-spacing: -0.01em; margin: 12px 0 10px;
        }
        .tp-conviction-copy {
          font-family: var(--site-font); font-size: 12px; line-height: 1.5;
          color: rgba(255,255,255,0.78); margin-top: 8px; max-width: 26em;
        }
        .tp-rule { height: 1px; background: rgba(255,255,255,0.25); margin: 16px 0 14px; }
        .tp-target {
          font-family: var(--font-mono); font-size: 28px; font-weight: 500; line-height: 1;
          margin-top: 4px; font-variant-numeric: tabular-nums;
        }
        .tp-fine {
          font-family: var(--font-mono); font-size: 11px; color: rgba(255,255,255,0.78);
          margin-top: 4px; font-variant-numeric: tabular-nums;
        }
        .tp-ev {
          margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.18);
          display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
        }
        .tp-thesis { padding: 24px 32px; border-right: 1px solid var(--rule); }
        .tp-qref { padding: 24px; }
        .tp-qref-row {
          display: flex; justify-content: space-between; gap: 10px; align-items: baseline;
          padding: 5px 0; border-top: 1px solid var(--rule);
          font-family: var(--font-mono); font-size: 11px; color: var(--ink-3);
        }
        .tp-qref-val { color: var(--ink); font-variant-numeric: tabular-nums; }
        @media (max-width: 900px) {
          .tp-grid { grid-template-columns: 1fr; }
          .tp-verdict, .tp-thesis { border-right: 0; border-bottom: 1px solid var(--rule); }
        }
      `}</style>
    </div>
  );
}

/**
 * Teaser: cabecera real (la ficha de Yahoo ya la tenemos y no cuesta nada) y de
 * ahí para abajo el informe de MUESTRA desenfocado, con el formulario encima.
 * Muro seco → previsualización; es el patrón de la prensa financiera y convierte
 * mucho mejor que un formulario en una página vacía.
 *
 * La estructura es la del informe real —misma banda de tesis, mismas trece
 * secciones, mismo Sankey, mismas métricas— pero el texto es de relleno y las
 * cifras propias del análisis no existen. Los números que SÍ son reales son los
 * de Yahoo (métricas y gráfico de precio), que ya teníamos gratis.
 *
 * `inert` + aria-hidden dejan el bloque fuera del foco y del lector de pantalla:
 * es decorado, no contenido navegable.
 */
function GatedPreview({ isRefresh, onUnlocked }: { isRefresh: boolean; onUnlocked: () => void }) {
  // La previsualización se arma con el informe de MUESTRA, no con el real (que
  // no existe): así las trece secciones salen llenas en vez de esqueletos. Las
  // métricas y el gráfico siguen saliendo del stockData verdadero.
  // La muestra se arma con SU PROPIO stockData congelado, no con el del ticker
  // que se está mirando. Mezclarlos hacía que el adaptador cruzara dos empresas
  // y fabricara números inexistentes — el objetivo de la muestra contra el
  // precio de la otra acción daba un "upside" que no significa nada. Ver la
  // nota en previewReport.ts. Sin dependencias: es constante.
  const previewData = useMemo(
    () => buildWorkstation(PREVIEW_STOCK, PREVIEW_REPORT, PREVIEW_CREATED_AT),
    [],
  );

  // Centrado del panel en el viewport de entrada. No se puede hacer sólo con
  // CSS: el offset depende de dónde arranca el velo (o sea, del alto de la
  // cabecera, que es responsive) y de la altura del propio panel. Se mide en
  // useLayoutEffect —antes del paint, así no hay salto visible— y se publica
  // como custom property; el CSS conserva su valor por defecto como fallback si
  // el efecto no llegara a correr.
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardTop, setCardTop] = useState<number | null>(null);
  useLayoutEffect(() => {
    const card = cardRef.current;
    const gate = card?.parentElement;
    if (!card || !gate) return;
    const place = () => {
      // Centrado en el espacio LIBRE bajo la cabecera, no en el viewport entero.
      // El centrado literal se probó y tapaba la ficha técnica (con viewport de
      // 900px el panel arrancaba en 258 y la ficha termina en 430): escondía
      // media identidad de la acción, que es justo el contenido real y gratuito
      // que el teaser quiere mostrar. Acá queda lo más centrado posible sin
      // pisarla, y en pantallas altas sí se centra de verdad.
      const gateTop = gate.getBoundingClientRect().top + window.scrollY;
      const libre = window.innerHeight - gateTop;
      setCardTop(Math.max(24, (libre - card.offsetHeight) / 2));
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, []);

  return (
    <div className="az-gate">
      {/* SÓLO la banda de tesis y "Dónde está el desacuerdo". Antes acá iba el
          ReportBody entero y las once secciones siguientes montaban y pintaban
          del otro lado del recorte, sin que nadie las viera: 687 de 858 nodos
          (80 %) y 10 canvas — incluida la librería de gráficos arrancando para
          dibujar tres años de precio recortados y encima desenfocados. Si algún
          día hay que mostrar más, se agregan secciones sueltas acá; no vuelvas
          a colgar el ReportBody completo. */}
      <div className="az-gate-veil" inert aria-hidden="true">
        <div className="site-wrap">
          <TesisPreview data={previewData} />
        </div>
        <SecKeyDebate data={previewData} hasReport />
      </div>

      {/* Rampa de desenfoque. CSS no interpola el radio de un blur, así que la
          transición se arma apilando capas de radio creciente, cada una revelada
          por su propia máscara: donde sólo asoma la primera hay 1px de niebla y
          abajo, con las cuatro encima, ~6px. Los tramos van en PÍXELES y no en
          porcentajes porque el velo mide miles de píxeles de alto — en % la
          rampa se estiraría a lo largo de todo el informe. */}
      <div className="az-gate-frost" aria-hidden="true">
        <span /><span /><span /><span />
      </div>

      <div
        className="az-gate-card"
        ref={cardRef}
        style={cardTop != null ? ({ "--gp-top": `${Math.round(cardTop)}px` } as React.CSSProperties) : undefined}
      >
        <LeadGateForm isRefresh={isRefresh} onUnlocked={onUnlocked} />
      </div>

      <style>{`
        .az-gate {
          position: relative;
          /* Cuánto sube la rampa por encima del velo. Medido en el DOM: el
             medio de la ficha técnica está 80px arriba, y la rampa arranca unos
             10px ANTES para que el degradado se vea dentro de los cuadros —
             etiquetas nítidas, valores ya entrando en la niebla. */
          --frost-subida: 90px;
        }
        .az-gate-veil {
          /* Sin filter propio: el desenfoque lo pone la rampa de arriba. Si se
             blurea acá también, el tramo de transición queda doblemente velado y
             la rampa no se ve.
             La altura llega hasta las secciones que SÍ tienen datos (métricas,
             gráfico de precio); el degradado del final evita el corte seco. */
          pointer-events: none;
          user-select: none;
          /* Sin max-height: el velo ya no se recorta, termina donde termina su
             contenido (tesis + "Dónde está el desacuerdo"). El recorte existía
             para tapar secciones que ahora directamente no se renderizan, así
             que sobra un número mágico que había que re-medir a cada cambio. El
             degradado de abajo hace el cierre. */
          overflow: hidden;
          -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 76%, transparent 100%);
          mask-image: linear-gradient(180deg, #000 0%, #000 76%, transparent 100%);
        }
        .az-gate-frost {
          position: absolute;
          left: 0; right: 0;
          top: calc(-1 * var(--frost-subida));
          bottom: 0;
          pointer-events: none;
        }
        .az-gate-frost > span {
          position: absolute;
          inset: 0;
          display: block;
        }
        /* Radios elegidos para que el apilado cierre en ~6px: dos desenfoques
           sucesivos equivalen a uno de raíz(a² + b²), así que 1·2·3·4,6 ≈ 5,9. */
        .az-gate-frost > span:nth-child(1) {
          -webkit-backdrop-filter: blur(1px); backdrop-filter: blur(1px);
          -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 14px);
          mask-image: linear-gradient(to bottom, transparent 0, #000 14px);
        }
        .az-gate-frost > span:nth-child(2) {
          -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px);
          -webkit-mask-image: linear-gradient(to bottom, transparent 10px, #000 50px);
          mask-image: linear-gradient(to bottom, transparent 10px, #000 50px);
        }
        .az-gate-frost > span:nth-child(3) {
          -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
          -webkit-mask-image: linear-gradient(to bottom, transparent 45px, #000 105px);
          mask-image: linear-gradient(to bottom, transparent 45px, #000 105px);
        }
        .az-gate-frost > span:nth-child(4) {
          -webkit-backdrop-filter: blur(4.6px); backdrop-filter: blur(4.6px);
          -webkit-mask-image: linear-gradient(to bottom, transparent 100px, #000 175px);
          mask-image: linear-gradient(to bottom, transparent 100px, #000 175px);
        }
        .az-gate-card {
          /* ABSOLUTE, no sticky: la tarjeta tiene que quedar FUERA del flujo.
             Con position sticky hay que tirarla hacia arriba con un margen
             negativo, y ese margen le saca la misma altura al contenedor — el
             pre-footer y el footer se trepaban encima del informe borroneado. */
          position: absolute;
          top: var(--gp-top, 180px);
          left: 50%;
          transform: translateX(-50%);
          width: min(560px, calc(100% - 40px));
          box-sizing: border-box;
          background: var(--surface);
          /* Masthead de doble hairline —regla fuerte arriba, suave alrededor—:
             el tell editorial de la casa (docs/lenguaje-visual.md §5). Reemplaza
             la barra dorada de 3px, que usaba el oro como superficie y leía como
             callout de alerta; acá el oro es una palabra del titular y nada más.
             Radio 3px: el de los objetos-documento, no el de card .site (14px). */
          border: 1px solid var(--rule);
          border-top: 1px solid var(--ink);
          border-radius: 3px;
          padding: 30px 32px 28px;
          /* Sombra baja y teñida de azul. Tiene que despegar del informe
             desenfocado, pero la guía la reserva para objetos-documento y la
             quiere mínima; la anterior (70px de radio a 0.16) convertía el panel
             en una tarjeta flotante de app. */
          box-shadow: 0 18px 44px rgba(3, 6, 94, 0.10);
          /* La Arial del panel ya no se declara acá: desde que el informe entero
             va en Arial, .analyze-root fija la familia y baja por herencia. */
        }
        .az-gate-card .gp-title {
          margin-top: 12px;
          font-size: clamp(23px, 2.2vw, 29px);
          max-width: 13em;
        }
        .az-gate-card .gp-lead {
          margin: 16px 0 0;
          max-width: 34em;
          font-size: 15.5px;
          line-height: 1.6;
          color: var(--ink-2);
        }

        /* Controles en el registro del REPORTE, no en el de marketing.
           NewsletterSignup pinta .ui-input/.ui-btn de .site —radio 8px, borde
           1,5px, navy sólido peso 700—, que es justo lo que ya se retiró del
           buscador del masthead por pesar más que la ficha de la acción (ver la
           nota de .am-search en globals.css). Se pisa por CSS y no con una
           variante del componente para no tocar su uso en /informes ni el pie,
           igual que allá. El botón se mantiene navy porque acá SÍ es la acción
           primaria, pero baja a peso 500 y radio 3: manda por contraste, no por
           grosor. */
        .az-gate-card .nl-form { margin-top: 22px; gap: 14px; }
        .az-gate-card .ui-input {
          font-size: 14px;
          border: 1px solid var(--rule-strong);
          border-radius: 3px;
          padding: 11px 13px;
        }
        .az-gate-card .ui-input:focus {
          border-color: var(--navy);
          box-shadow: none;
        }
        .az-gate-card .ui-btn {
          font-size: 13.5px;
          font-weight: 500;
          border-radius: 3px;
          padding: 11px 20px;
          box-shadow: none;
        }
        /* Consentimiento = el registro de disclaimer de la casa: 12px ink-3
           sobre una hairline superior (docs/lenguaje-visual.md §7). */
        .az-gate-card .nl-consent-row {
          padding-top: 14px;
          border-top: 1px solid var(--rule);
        }
        .az-gate-card .nl-consent-text { font-size: 12px; color: var(--ink-3); }
        /* Debajo de 640px la ficha técnica pasa a dos columnas y casi triplica
           su alto (85 → 211px medidos), así que el medio queda mucho más arriba:
           sin esto la rampa arrancaba ~47px por debajo del punto buscado. */
        @media (max-width: 640px) {
          .az-gate { --frost-subida: 145px; }
        }
        /* Mobile SÍ conserva recorte, a diferencia de desktop: al apilar a una
           columna la banda de tesis sola mide 1763px y el contenido completo
           llega a 2476px, o sea ~5100px de página para mirar borroneado. Se
           corta dentro de la tesis y el degradado lo resuelve sin costura. */
        @media (max-width: 700px) {
          .az-gate-veil { max-height: 1100px; }
          .az-gate-card { top: 96px; padding: 24px 22px; }
        }
      `}</style>
    </div>
  );
}

/**
 * Peaje sin cabecera. Defensivo: hoy el server sólo cobra peaje cuando tiene la
 * ficha de Yahoo, así que no debería verse — pero si alguna vez llega un
 * email_required sin stockData, mejor el formulario pelado que una página en
 * blanco.
 */
function LeadGatePanel({ isRefresh, onUnlocked }: { isRefresh: boolean; onUnlocked: () => void }) {
  return (
    <div className="site-wrap az-state">
      <div
        style={{
          maxWidth: 620,
          border: "1px solid var(--site-border-2)",
          borderLeft: "3px solid var(--gold-deep)",
          borderRadius: 8,
          padding: "26px 28px",
          background: "var(--surface)",
        }}
      >
        <LeadGateForm isRefresh={isRefresh} onUnlocked={onUnlocked} />
      </div>
    </div>
  );
}

function ErrorPanel({ kind, message, onRetry }: { kind: ErrorKind; message: string | null; onRetry: () => void }) {
  const title = kind === "analysis_unavailable" ? "Análisis no disponible por el momento" : "Error en el análisis";
  return (
    <div className="site-wrap az-state">
      <div style={{ maxWidth: 620, border: "1px solid var(--site-border-2)", borderLeft: "3px solid var(--neg)", borderRadius: 8, padding: "26px 28px", background: "var(--surface)" }}>
        <div className="eyebrow-sm" style={{ color: "var(--neg)", marginBottom: 10 }}>{title}</div>
        <p className="az-prose az-prose--tight" style={{ margin: "0 0 18px", color: "var(--ink-2)" }}>
          {kind === "analysis_unavailable"
            ? "El servicio está experimentando demoras. Intentá nuevamente en unos minutos."
            : message ?? "Algo salió mal."}
        </p>
        <button onClick={onRetry} className="btn btn-primary" style={{ padding: "10px 18px", fontSize: 13 }}>
          Reintentar
        </button>
      </div>
    </div>
  );
}
