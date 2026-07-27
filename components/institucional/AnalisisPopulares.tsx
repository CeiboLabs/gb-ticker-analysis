"use client";

import { useEffect, useState } from "react";
import { useLogoBrightness } from "@/lib/useLogoBrightness";
import { POPULAR_FALLBACK } from "@/lib/popularFallback";
import type { TrendReason } from "@/lib/trendReason";

// "Las más analizadas" — el ranking de tickers más consultados en /analisis
// durante los últimos 7 días. Los datos salen de /api/popular (getTopTickers +
// una llamada batch a Yahoo); acá los pintamos en el lenguaje .site.
//
// No es una grilla plana de celdas iguales: hay jerarquía editorial. La #1 se
// lleva un panel navy con el foco dorado de la casa; las 2–8 caen en una lista
// sobre hairlines. Los logos son protagonistas, cada uno en un chip con backdrop
// adaptativo (ver docs/lenguaje-visual.md).
//
// La tarjeta destacada NO es un tile de cotización: es un brief. Su bloque más
// grande es EL PORQUÉ —el hecho de mercado que explica la atención, redactado
// por el modelo sobre una nota de prensa Tier 1/2 y firmado con esa fuente (ver
// lib/trendReason.ts)—. El precio queda de apoyo y la serie del mes abajo, con
// el día de la noticia marcado: la frase dice qué pasó, la línea dónde se ve.
// Sin explicación respaldada, el slot cae al dato honesto (la demanda de la
// plataforma) en vez de inventar una causa.

interface Quote {
  symbol: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  currency: string | null;
  views: number | null; // consultas en la ventana de 7 días; null = relleno curado
}

// Umbral para mostrar el número crudo de consultas. Por debajo (tráfico bajo /
// pre-lanzamiento) el número queda pobre, así que mostramos algo cualitativo.
const MIN_VIEWS_FOR_COUNT = 25;

interface Props {
  onSelect: (ticker: string) => void;
}

const LIMIT = 8;

function skeleton(): Quote[] {
  return POPULAR_FALLBACK.map((s) => ({
    symbol: s,
    name: s,
    price: null,
    changePercent: null,
    currency: null,
    views: null,
  }));
}

function fmtPrice(p: number | null, currency: string | null): string {
  if (p == null) return "—";
  const n = p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return !currency || currency === "USD" ? `$${n}` : `${n} ${currency}`;
}

function fmtChange(c: number | null): string {
  if (c == null) return "—";
  return `${c >= 0 ? "+" : ""}${c.toFixed(2)}%`;
}

// "2026-07-22" → "22 jul". Se arma por partes para que la fecha no se corra un
// día al parsearla como UTC en husos al oeste (acá, siempre).
function fmtShortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d
    .toLocaleDateString("es-UY", { day: "numeric", month: "short" })
    .replace(".", "");
}

// La demanda de la plataforma: dato honesto, pero NO una causa. Es el respaldo
// del ranking (pie de la tarjeta) y el suplente del porqué cuando no hay prensa
// que lo explique. Sin consultas reales (relleno curado) no se afirma nada.
type Demand = { kind: "count"; n: number } | { kind: "lead" };

function demand(views: number | null): Demand | null {
  if (views == null || views <= 0) return null;
  return views >= MIN_VIEWS_FOR_COUNT ? { kind: "count", n: views } : { kind: "lead" };
}

// Sparkline como "firma de línea": la serie sobre coordenadas normalizadas que
// se estiran al contenedor (preserveAspectRatio="none"); el trazo queda parejo
// con vector-effect no-scaling.
function sparkPath(values: number[], w = 320, h = 96, pad = 10) {
  if (values.length < 2) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min || 1;
  const n = values.length;
  const pts = values.map((v, i) => {
    const x = (i / (n - 1)) * w;
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return `${x.toFixed(2)} ${y.toFixed(2)}`;
  });
  const line = "M" + pts.join(" L");
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  return { line, area, w, h };
}

const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const ExternalArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

// Chip de logo con backdrop adaptativo. Muchos logos corporativos son wordmarks
// blancos sobre transparente (AMZN, NKE…) que desaparecen sobre claro; el probe
// de useLogoBrightness detecta ese caso y elige el fondo del chip. Si el logo
// falla (404), cae a la inicial del ticker en el mismo chip — nada de huecos.
function TickerLogo({
  symbol,
  size,
  surface,
}: {
  symbol: string;
  size: number;
  surface: "light" | "navy";
}) {
  const src = `/api/logo?ticker=${encodeURIComponent(symbol)}`;
  const brightness = useLogoBrightness(src);
  const [failed, setFailed] = useState(false);

  const light = brightness === "light";
  const chip =
    surface === "navy"
      ? {
          background: light ? "rgba(255,255,255,0.10)" : "#FFFFFF",
          borderColor: "rgba(255,255,255,0.18)",
        }
      : {
          background: light ? "var(--navy)" : "#FFFFFF",
          borderColor: light ? "transparent" : "var(--site-border)",
        };

  const initialColor =
    surface === "navy" ? "rgba(255,255,255,0.82)" : "var(--site-ink-2)";

  return (
    <span
      className="tl-chip"
      style={{ width: size, height: size, ...chip }}
      aria-hidden
    >
      {failed ? (
        <span className="tl-initial" style={{ color: initialColor, fontSize: size * 0.42 }}>
          {symbol.charAt(0)}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setFailed(true)} />
      )}
    </span>
  );
}

export function AnalisisPopulares({ onSelect }: Props) {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [spark, setSpark] = useState<{ symbol: string; values: number[] } | null>(null);
  // Guardado con su símbolo, igual que la serie: al cambiar el destacado, el
  // motivo viejo deja de valer solo, sin resetear estado dentro del efecto.
  const [reasonFor, setReasonFor] = useState<{ symbol: string; value: TrendReason | null } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/popular?limit=${LIMIT}`)
      .then((r) => r.json())
      .then((data: { quotes?: Quote[] }) => {
        if (cancelled) return;
        const arr = Array.isArray(data?.quotes) ? data.quotes : [];
        setQuotes(arr.length > 0 ? arr : skeleton());
      })
      .catch(() => {
        if (!cancelled) setQuotes(skeleton());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = quotes == null;
  const rows = quotes ?? skeleton();
  const featured = rows[0];
  const rest = rows.slice(1);

  const featPositive = (featured.changePercent ?? 0) >= 0;
  const featName = featured.name && featured.name !== featured.symbol ? featured.name : "";

  // Serie del destacado: un mes de cierres (1 fetch, cacheado en
  // /api/chart-range). Sólo tras cargar los datos reales, para no pedir la serie
  // del placeholder; degrada a nada si el upstream falla.
  useEffect(() => {
    if (loading) return;
    const sym = featured.symbol;
    let cancelled = false;
    fetch(`/api/chart-range?ticker=${encodeURIComponent(sym)}&range=1M`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { prices?: { value: number }[] } | null) => {
        if (cancelled || !data?.prices) return;
        const vals = data.prices.map((p) => p.value).filter((v) => Number.isFinite(v));
        if (vals.length >= 2) setSpark({ symbol: sym, values: vals });
      })
      .catch(() => {
        /* upstream caído: se conserva lo previo, la tarjeta no se rompe */
      });
    return () => {
      cancelled = true;
    };
  }, [featured.symbol, loading]);

  // El porqué. Llega después de la lista y a su propio ritmo (prensa + modelo);
  // la tarjeta ya está dibujada, así que sólo se rellena el slot.
  useEffect(() => {
    if (loading) return;
    const sym = featured.symbol;
    let cancelled = false;
    fetch(`/api/trend-reason?ticker=${encodeURIComponent(sym)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { reason?: TrendReason | null } | null) => {
        if (!cancelled) setReasonFor({ symbol: sym, value: data?.reason ?? null });
      })
      .catch(() => {
        if (!cancelled) setReasonFor({ symbol: sym, value: null });
      });
    return () => {
      cancelled = true;
    };
  }, [featured.symbol, loading]);

  // undefined = todavía buscando el porqué · null = no hay uno respaldado
  const reason = reasonFor?.symbol === featured.symbol ? reasonFor.value : undefined;

  // Sólo dibujamos si el spark cacheado corresponde al destacado actual — así,
  // al cambiar de símbolo, la línea vieja no parpadea hasta que llega la nueva.
  const sparkVals = spark && spark.symbol === featured.symbol ? spark.values : null;
  const sparkGeo = sparkVals ? sparkPath(sparkVals) : null;

  const featDemand = loading ? null : demand(featured.views);
  const demandText =
    featDemand?.kind === "count"
      ? `${featDemand.n.toLocaleString("en-US")} análisis en 7 días`
      : featDemand
        ? "Lidera las consultas de la semana"
        : null;

  return (
    <section className="band site-section">
      <div className="site-wrap">
        <div className="split-label">
          <div className="eyebrow-sm">Tendencias</div>
          <div>
            <h2 className="t-h2">Las más analizadas de la semana.</h2>
            <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
              El pulso de la plataforma: los tickers que más consultaron otros inversores en los
              últimos siete días. Tocá cualquiera para abrir su reporte.
            </p>
          </div>
        </div>

        <div className="pop-layout" aria-busy={loading}>
          {/* Destacado — brief de la #1: identidad, el porqué firmado, la serie.
              Toda la superficie abre el reporte, pero el control REAL es el botón
              del pie (es lo que ve el teclado y el lector de pantalla): acá no hay
              overlay, que es justo lo que hacía fallar el clic —un ::after con
              inset:0 se ancla al ancestro posicionado más cercano, o sea el pie, y
              terminaba cubriendo sólo esa franja—. El link de la fuente gana: si el
              clic salió de un <a>, la tarjeta no se mete. */}
          <article
            className="pop-feat"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) return;
              onSelect(featured.symbol);
            }}
          >
            <span className="pop-feat-glow" aria-hidden />

            {/* El ordinal es lo que hace legible el conjunto: sin él, la tarjeta
                era un panel suelto al lado de unas cotizaciones. El 01 grande de
                acá y los 02–08 de la lista son el MISMO sistema de numeración, y
                eso es lo que las convierte en un ranking (la convención de
                cualquier chart). El rótulo va a su lado, ya en tamaño de título. */}
            <header className="pop-feat-top">
              <span className="pop-feat-rank">
                <span className="pop-feat-rank-num">01</span>
                <span className="pop-feat-rank-sep" aria-hidden>·</span>
                <span className="pop-feat-rank-title">La más analizada</span>
              </span>

              <span className="pop-feat-head">
              <span className="pop-feat-brand">
                <TickerLogo symbol={featured.symbol} size={46} surface="navy" />
                <span className="pop-feat-id">
                  <span className="pop-feat-sym">{featured.symbol}</span>
                  {featName && <span className="pop-feat-name">{featName}</span>}
                </span>
              </span>
              <span className="pop-feat-quote">
                <span className="pop-feat-price">{fmtPrice(featured.price, featured.currency)}</span>
                {!loading && (
                  <span className={`pop-feat-chg ${featPositive ? "is-pos" : "is-neg"}`}>
                    {fmtChange(featured.changePercent)} hoy
                  </span>
                )}
              </span>
              </span>
            </header>

            {/* El porqué — el bloque que manda en la tarjeta. Sin motivo no
                reserva altura: el aire se lo queda la serie, que crece. */}
            <div className={`pop-why${reason === null ? " is-empty" : ""}`}>
              {reason ? (
                <>
                  <span className="pop-why-label">Por qué</span>
                  <p className="pop-why-text">{reason.reason}</p>
                  <a
                    className="pop-why-src"
                    href={reason.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={reason.source.title}
                  >
                    {reason.source.publisher}
                    {reason.source.date ? ` · ${fmtShortDate(reason.source.date)}` : ""}
                    <ExternalArrow />
                  </a>
                </>
              ) : reason === undefined ? (
                <span className="pop-why-wait" aria-hidden>
                  <span className="pop-why-label">Por qué</span>
                  <span className="pop-why-bar" />
                  <span className="pop-why-bar is-short" />
                </span>
              ) : (
                <>
                  <span className="pop-why-label">En la plataforma</span>
                  <p className="pop-why-text is-quiet">
                    {demandText ?? "Encabeza el ranking de consultas de la semana."}
                  </p>
                </>
              )}
            </div>

            {/* Serie del mes: contexto del precio, nada más */}
            <div className="pop-feat-series">
              {sparkGeo && (
                <span className="pop-spark-canvas" aria-hidden>
                  <svg viewBox={`0 0 ${sparkGeo.w} ${sparkGeo.h}`} preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="popSparkFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F2E3B0" stopOpacity="0.14" />
                        <stop offset="100%" stopColor="#F2E3B0" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={sparkGeo.area} fill="url(#popSparkFill)" />
                    <path className="pop-spark-line" d={sparkGeo.line} />
                  </svg>
                </span>
              )}
              <span className="pop-feat-scale" aria-hidden>
                30 días
              </span>
            </div>

            <footer className="pop-feat-foot">
              <button
                type="button"
                className="pop-feat-cta"
                onClick={(e) => {
                  e.stopPropagation(); // si no, el handler de la tarjeta lo repite
                  onSelect(featured.symbol);
                }}
                aria-label={`Analizar ${featured.name || featured.symbol}, la más analizada`}
              >
                Analizar <Arrow />
              </button>
            </footer>
          </article>

          {/* Lista — hairlines, logo + ticker + cotización por fila */}
          <div className="pop-list">
            {rest.map((q, i) => {
              const positive = (q.changePercent ?? 0) >= 0;
              const name = q.name && q.name !== q.symbol ? q.name : "";
              const rank = String(i + 2).padStart(2, "0"); // continúa el 01 del destacado
              return (
                <button
                  key={q.symbol}
                  type="button"
                  className="pop-row"
                  onClick={() => onSelect(q.symbol)}
                  aria-label={`Analizar ${q.name || q.symbol}, número ${i + 2}`}
                  style={{ opacity: loading ? 0.55 : 1 }}
                >
                  <span className="pop-rank" aria-hidden>
                    {rank}
                  </span>
                  <TickerLogo symbol={q.symbol} size={34} surface="light" />
                  <span className="pop-id">
                    <span className="pop-sym">{q.symbol}</span>
                    {name && <span className="pop-name">{name}</span>}
                  </span>
                  <span className="pop-quote">
                    <span className="pop-price">{fmtPrice(q.price, q.currency)}</span>
                    <span className={`pop-chg ${loading ? "" : positive ? "is-pos" : "is-neg"}`}>
                      {fmtChange(q.changePercent)}
                    </span>
                  </span>
                  <span className="pop-arrow" aria-hidden>
                    <Arrow />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        .pop-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: clamp(18px, 2.2vw, 30px); /* juntas leen como un solo ranking */
          margin-top: clamp(40px, 5vw, 56px);
          align-items: stretch;
        }

        /* ---- Chip de logo (compartido) ---- */
        .tl-chip {
          display: flex; align-items: center; justify-content: center;
          border-radius: 10px;
          border: 1px solid var(--site-border);
          overflow: hidden;
          flex: none;
        }
        .tl-chip img { width: 100%; height: 100%; object-fit: contain; padding: 15%; display: block; }
        .tl-initial {
          font-family: var(--font-mono), monospace;
          font-weight: 600;
          line-height: 1;
        }

        /* ---- Destacado navy ---- */
        .pop-feat {
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-height: 340px;
          padding: clamp(24px, 2.6vw, 32px);
          border-radius: var(--r-card);
          background: linear-gradient(135deg, #02043F 0%, var(--navy) 45%, #0A0E78 100%);
          color: #fff;
          cursor: pointer;
          box-shadow: 0 18px 44px rgba(3, 6, 94, 0.16);
          transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 300ms ease;
        }
        .pop-feat:hover { transform: translateY(-3px); box-shadow: 0 26px 60px rgba(3, 6, 94, 0.24); }
        .pop-feat:has(.pop-feat-cta:focus-visible) { outline: 2px solid var(--gold-soft); outline-offset: 3px; }
        .pop-feat-glow {
          position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(120% 90% at 82% 0%, rgba(201, 168, 76, 0.16), transparent 55%);
        }

        /* Cabecera: rótulo arriba; abajo identidad a la izquierda y cotización de
           apoyo a la derecha, centradas sobre el mismo eje que el logo. */
        .pop-feat-top { position: relative; z-index: 1; }
        .pop-feat-head {
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px;
          margin-top: clamp(14px, 1.6vw, 18px);
        }
        .pop-feat-brand { display: flex; align-items: center; gap: 14px; min-width: 0; }
        .pop-feat-id { display: flex; flex-direction: column; min-width: 0; }
        /* Ordinal del destacado: una sola línea, el número como parte de la frase
           y no como elemento gráfico. En display grande competía con el ticker y
           con el precio, y volvía masa el oro (que en la casa es acento). El peso
           lo lleva el rótulo; el 01 sólo tiene que atar con los 02–08 de la lista. */
        .pop-feat-rank { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; }
        .pop-feat-rank-num {
          font-family: var(--font-mono), monospace;
          font-feature-settings: "tnum" 1;
          font-size: 17px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: var(--gold-soft);
        }
        .pop-feat-rank-sep { color: rgba(255, 255, 255, 0.28); }
        .pop-feat-rank-title {
          font-size: clamp(15px, 1.6vw, 17px);
          letter-spacing: -0.01em;
          color: rgba(255, 255, 255, 0.95);
        }
        .pop-feat-sym {
          font-family: var(--font-mono), monospace;
          font-feature-settings: "tnum" 1;
          font-size: clamp(20px, 2.2vw, 26px);
          font-weight: 600;
          letter-spacing: -0.01em;
          line-height: 1;
        }
        .pop-feat-name {
          margin-top: 6px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.66);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pop-feat-quote { display: flex; flex-direction: column; align-items: flex-end; flex: none; }
        .pop-feat-price {
          font-family: var(--font-mono), monospace;
          font-feature-settings: "tnum" 1;
          font-size: clamp(22px, 2.4vw, 28px);
          font-weight: 400;
          letter-spacing: -0.02em;
          line-height: 1; /* mismo interlineado que el ticker: si no, las dos
                             columnas centran distinto y las bases se corren */
        }
        .pop-feat-chg {
          margin-top: 6px;
          font-family: var(--font-mono), monospace;
          font-feature-settings: "tnum" 1;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
        }
        .pop-feat-chg.is-pos { color: #7BC9A0; }
        .pop-feat-chg.is-neg { color: #E9999A; }

        /* ---- El porqué: el bloque grande, abierto por hairline dorada ---- */
        .pop-why {
          position: relative; z-index: 1;
          flex: none;
          margin-top: clamp(22px, 2.6vw, 30px);
          padding-top: clamp(18px, 2vw, 22px);
          border-top: 1px solid rgba(242, 227, 176, 0.28);
          min-height: 132px;
        }
        .pop-why.is-empty { min-height: 0; }
        .pop-why-label {
          display: block;
          font-family: var(--font-mono), monospace;
          font-size: 10.5px; font-weight: 600;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--gold-soft);
        }
        .pop-why-text {
          margin: 12px 0 0;
          font-size: clamp(16.5px, 1.8vw, 20px);
          line-height: 1.42;
          letter-spacing: -0.01em;
          color: rgba(255, 255, 255, 0.94);
          text-wrap: pretty;
        }
        .pop-why-text.is-quiet {
          font-size: clamp(15px, 1.5vw, 17px);
          color: rgba(255, 255, 255, 0.8);
        }
        /* La fuente ES lo que hace verificable la frase: link real, por encima
           del overlay que hace clickeable toda la tarjeta. */
        .pop-why-src {
          position: relative; z-index: 2;
          display: inline-flex; align-items: center; gap: 6px;
          margin-top: 12px;
          font-family: var(--font-mono), monospace;
          font-size: 11.5px;
          letter-spacing: 0.02em;
          color: rgba(242, 227, 176, 0.82);
          text-decoration: none;
          border-bottom: 1px solid rgba(242, 227, 176, 0.28);
          padding-bottom: 2px;
        }
        .pop-why-src:hover { color: var(--gold-soft); border-bottom-color: var(--gold-soft); }
        .pop-why-src svg { width: 11px; height: 11px; }
        /* Espera: dos barras tenues en el lugar exacto que ocupará la frase, para
           que el bloque no salte cuando llega. */
        .pop-why-wait { display: block; }
        .pop-why-bar {
          display: block; height: 11px; margin-top: 14px; border-radius: 2px;
          background: rgba(255, 255, 255, 0.09);
          animation: popPulse 1.6s ease-in-out infinite;
        }
        .pop-why-bar.is-short { width: 62%; margin-top: 9px; }
        @keyframes popPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }

        /* ---- Serie del mes ----
           Es la que absorbe el alto sobrante de la tarjeta (la lista de al lado
           manda la altura): la línea se estira, en vez de dejar un hueco muerto
           entre el gráfico y el pie. */
        .pop-feat-series {
          position: relative; z-index: 1;
          flex: 1 1 auto;
          display: flex; flex-direction: column;
          margin-top: 18px;
          min-height: 74px;
        }
        .pop-spark-canvas { position: relative; display: block; flex: 1 1 auto; min-height: 58px; }
        .pop-spark-canvas svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; overflow: visible; }
        .pop-spark-line {
          fill: none;
          stroke: rgba(255, 255, 255, 0.6);
          stroke-width: 2;
          vector-effect: non-scaling-stroke;
          stroke-linejoin: round;
          stroke-linecap: round;
        }
        .pop-feat-scale {
          display: block;
          margin-top: 8px;
          font-family: var(--font-mono), monospace;
          font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
          color: rgba(255, 255, 255, 0.42);
        }

        /* ---- Pie: sólo el CTA ---- */
        .pop-feat-foot {
          position: relative; z-index: 1;
          display: flex; align-items: center; justify-content: flex-end;
          margin-top: clamp(18px, 2vw, 22px);
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
        }
        .pop-feat-cta {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 0; border: 0; background: transparent;
          font: inherit; font-size: 14px; font-weight: 500;
          color: var(--gold-soft);
          cursor: pointer;
        }
        .pop-feat-cta:focus-visible { outline: none; } /* el anillo lo dibuja la tarjeta */
        .pop-feat-cta svg { width: 17px; height: 17px; transition: transform 200ms ease; }
        .pop-feat:hover .pop-feat-cta svg { transform: translateX(3px); }

        /* ---- Lista 02–08 ---- */
        .pop-list {
          display: flex;
          flex-direction: column;
          border-top: 1.5px solid var(--site-ink); /* apertura fuerte sobre filas suaves */
        }
        .pop-row {
          display: grid;
          grid-template-columns: auto auto minmax(0, 1fr) auto auto;
          align-items: center;
          gap: clamp(12px, 1.4vw, 18px);
          width: 100%;
          flex: 1;
          padding: 0 6px;
          min-height: 62px;
          border: 0;
          border-bottom: 1px solid var(--site-border);
          background: transparent;
          text-align: left;
          font: inherit;
          color: inherit;
          cursor: pointer;
          transition: padding-left 200ms cubic-bezier(0.16, 1, 0.3, 1), background-color 200ms ease;
        }
        .pop-row:hover { padding-left: 14px; background: color-mix(in srgb, var(--site-ink) 3%, transparent); }
        .pop-row:focus-visible { outline: 2px solid var(--gold-deep); outline-offset: -2px; }
        /* Continúa la numeración del destacado: mismo oro, tamaño de dato */
        .pop-rank {
          font-family: var(--font-mono), monospace;
          font-feature-settings: "tnum" 1;
          font-size: 12px;
          letter-spacing: 0.06em;
          color: var(--gold-deep);
          width: 1.6em;
        }
        .pop-id { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .pop-sym {
          font-family: var(--font-mono), monospace;
          font-feature-settings: "tnum" 1;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: var(--site-ink);
        }
        .pop-name {
          font-size: 12px;
          color: var(--site-ink-3);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .pop-quote { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; white-space: nowrap; }
        .pop-price {
          font-family: var(--font-mono), monospace;
          font-feature-settings: "tnum" 1;
          font-size: 14px;
          color: var(--site-ink);
        }
        .pop-chg {
          font-family: var(--font-mono), monospace;
          font-feature-settings: "tnum" 1;
          font-size: 12px;
          color: var(--site-ink-3);
        }
        .pop-chg.is-pos { color: var(--pos); }
        .pop-chg.is-neg { color: var(--neg); }
        .pop-arrow {
          display: flex; align-items: center;
          color: var(--site-ink-3);
          opacity: 0; transform: translateX(-3px);
          transition: opacity 180ms ease, transform 180ms ease, color 180ms ease;
        }
        .pop-arrow svg { width: 15px; height: 15px; }
        .pop-row:hover .pop-arrow { opacity: 1; transform: translateX(0); color: var(--gold-deep); }
        @media (hover: none) { .pop-arrow { opacity: 0.4; transform: none; } }

        @media (max-width: 900px) {
          .pop-layout { grid-template-columns: 1fr; }
          .pop-feat { min-height: 0; }
          .pop-why { min-height: 0; }
        }

        /* En pantallas angostas el nombre largo tiene lugar para respirar en dos
           líneas (el eyebrow ya no comparte fila con nada). */
        @media (max-width: 560px) {
          .pop-feat-name {
            white-space: normal;
            display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .pop-feat, .pop-feat-cta svg, .pop-row, .pop-arrow { transition: none; }
          .pop-feat:hover { transform: none; }
          .pop-why-bar { animation: none; }
        }
      `}</style>
    </section>
  );
}
