"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TickerSearch } from "@/components/TickerSearch";

const FEATURES = [
  ["i.", "Veredicto", "Recomendación BUY · HOLD · AVOID con convicción declarada y rationale escrito."],
  ["ii.", "Métricas", "Doce indicadores clave en tabular-nums: capitalización, múltiplos, márgenes, FCF, beta."],
  ["iii.", "Precio", "Tres años de serie histórica con barras trimestrales de revenue superpuestas."],
  ["iv.", "Sankey", "Diagrama de flujo del estado de resultados: ingresos → costos → utilidad neta."],
  ["v.", "Consenso", "Distribución de ratings de Wall Street y precio objetivo medio."],
  ["vi.", "Exportación", "PDF profesional listo para circular en cartera de clientes."],
];

const STEPS = [
  ["01", "Cargá un ticker", "Cualquier acción listada en Estados Unidos. Apple, MercadoLibre, Tesla, Coca-Cola."],
  ["02", "Datos en streaming", "El modelo procesa información de Yahoo Finance y SEC EDGAR en tiempo real."],
  ["03", "Reporte completo", "Veredicto, métricas, gráficos y narrativa, en segundos."],
];

export default function AnalisisPage() {
  const router = useRouter();

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("ticker");
    if (t) router.replace(`/analyze?ticker=${encodeURIComponent(t)}`);
  }, [router]);

  function handleSearch(ticker: string) {
    router.push(`/analyze?ticker=${encodeURIComponent(ticker.trim().toUpperCase())}`);
  }

  return (
    <main>
      {/* Hero */}
      <section className="section-navy" style={{ position: "relative", overflow: "hidden" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(50% 70% at 80% 0%, rgba(201,168,76,0.08), transparent 60%)",
          }}
        />
        <div
          className="wrap"
          style={{
            paddingTop: "calc(var(--nav-h) + var(--space-7))",
            paddingBottom: "var(--space-7)",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(255,255,255,0.18)",
              paddingBottom: "var(--space-3)",
              marginBottom: "var(--space-6)",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <span className="cap" style={{ color: "rgba(255,255,255,0.55)" }}>Herramienta · Análisis de acciones</span>
            <span className="cap mono" style={{ color: "rgba(255,255,255,0.55)" }}>Equity research · AI-assisted</span>
          </div>

          <h1
            className="serif"
            style={{
              fontWeight: 300,
              fontSize: "clamp(40px, 6vw, 84px)",
              lineHeight: 1,
              letterSpacing: "-0.025em",
              margin: 0,
              color: "var(--ivory)",
              maxWidth: "18ch",
            }}
          >
            Equity research,{" "}
            <em style={{ fontStyle: "italic", color: "var(--gold-soft)", fontWeight: 300 }}>
              en segundos.
            </em>
          </h1>

          <p
            className="lede"
            style={{
              maxWidth: "38em",
              color: "rgba(255,255,255,0.82)",
              marginTop: "var(--space-5)",
            }}
          >
            Cargá un ticker y obtené un reporte con veredicto, doce KPIs, Sankey del estado de resultados y consenso de Wall Street. Mismo rigor que un research sell-side, en lenguaje propio.
          </p>

          <div style={{ marginTop: "var(--space-6)", maxWidth: 540 }}>
            <TickerSearch variant="hero" onSubmit={handleSearch} />
          </div>

          <p className="cap mono" style={{ marginTop: 16, color: "rgba(255,255,255,0.5)" }}>
            Probá con AAPL · TSLA · MELI · KO
          </p>
        </div>
      </section>

      {/* Funcionalidades */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">01 / 02</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>Funcionalidades</div>
            </div>
            <div>
              <h2>Qué incluye cada reporte.</h2>
              <p className="dek">Seis bloques. Una sola pantalla navegable.</p>
            </div>
          </div>

          <ol style={{ listStyle: "none", padding: 0, margin: 0, borderTop: "1px solid var(--ink)" }}>
            {FEATURES.map(([n, title, body]) => (
              <li
                key={n}
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px minmax(180px, 240px) 1fr",
                  gap: "var(--space-5)",
                  padding: "var(--space-4) 0",
                  borderBottom: "1px solid var(--rule)",
                  alignItems: "baseline",
                }}
                className="feat-row"
              >
                <span className="serif-i" style={{ fontSize: 28, color: "var(--gold-deep)", lineHeight: 1 }}>{n}</span>
                <h3 className="serif" style={{ fontWeight: 400, fontSize: 22, lineHeight: 1.2, margin: 0, letterSpacing: "-0.015em" }}>
                  {title}
                </h3>
                <p className="body-base" style={{ margin: 0 }}>{body}</p>
              </li>
            ))}
          </ol>

          <style>{`
            @media (max-width: 760px) {
              .feat-row { grid-template-columns: 60px 1fr !important; }
              .feat-row > p { grid-column: 1 / -1; padding-left: 60px; }
            }
          `}</style>
        </div>
      </section>

      {/* Proceso */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">02 / 02</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>Cómo funciona</div>
            </div>
            <div>
              <h2>Tres pasos. Sin formularios.</h2>
              <p className="dek">Cargás un ticker, el modelo lee los datos, recibís el reporte.</p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              borderTop: "1px solid var(--ink)",
              borderBottom: "1px solid var(--rule)",
            }}
            className="proceso-grid"
          >
            {STEPS.map(([n, title, body], i) => (
              <article
                key={n}
                style={{
                  padding: "var(--space-6) var(--space-5)",
                  borderRight: i < 2 ? "1px solid var(--rule)" : "none",
                }}
              >
                <div className="mono" style={{ color: "var(--gold-deep)", fontSize: 13, letterSpacing: "0.08em" }}>{n}</div>
                <h3 className="serif" style={{ fontWeight: 400, fontSize: 26, lineHeight: 1.15, margin: "var(--space-3) 0 var(--space-2)", letterSpacing: "-0.015em" }}>
                  {title}
                </h3>
                <p className="body-base" style={{ margin: 0 }}>{body}</p>
              </article>
            ))}
          </div>

          <div style={{ marginTop: "var(--space-5)", maxWidth: 540 }}>
            <div className="cap-gold" style={{ marginBottom: "var(--space-2)" }}>Empezá por acá</div>
            <TickerSearch variant="footer" onSubmit={handleSearch} />
          </div>

          <p className="body-small" style={{ marginTop: "var(--space-3)" }}>
            Datos · Yahoo Finance, SEC EDGAR · Análisis asistido por OpenAI GPT-4o
          </p>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .proceso-grid { grid-template-columns: 1fr !important; }
            .proceso-grid article { border-right: 0 !important; border-bottom: 1px solid var(--rule); }
          }
        `}</style>
      </section>
    </main>
  );
}
