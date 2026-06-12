"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { TickerSearch } from "@/components/TickerSearch";
import { AnalisisHero } from "@/components/institucional/AnalisisHero";
import { Verdict, BarChart, LineChart, Flow, Poll, FileDown } from "@/components/institucional/icons";

const FEATURES: { icon: ReactNode; title: string; body: string }[] = [
  { icon: <Verdict />, title: "Veredicto", body: "Recomendación BUY · HOLD · AVOID con convicción declarada y rationale escrito." },
  { icon: <BarChart />, title: "Métricas", body: "Doce indicadores clave: capitalización, múltiplos, márgenes, FCF, beta." },
  { icon: <LineChart />, title: "Precio", body: "Tres años de serie histórica con barras trimestrales de revenue superpuestas." },
  { icon: <Flow />, title: "Sankey", body: "Diagrama de flujo del estado de resultados: ingresos → costos → utilidad neta." },
  { icon: <Poll />, title: "Consenso", body: "Distribución de ratings de Wall Street y precio objetivo medio." },
  { icon: <FileDown />, title: "Exportación", body: "PDF profesional listo para circular en cartera de clientes." },
];

const STEPS: [string, string, string][] = [
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
    <main className="site">
      {/* Hero pinneado — la preview del reporte emerge desde abajo al
          scrollear, estilo "plataforma que se despliega" */}
      <AnalisisHero onSearch={handleSearch} />

      {/* Funcionalidades — split (intro a la izquierda, lista de filas a la derecha) */}
      <section className="band site-section">
        <div className="site-wrap">
          <div className="split">
            <div>
              <div className="eyebrow-sm">Funcionalidades</div>
              <h2 className="t-h2" style={{ marginTop: 16 }}>Qué incluye cada reporte.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "32em" }}>
                Seis bloques sobre una sola pantalla navegable. El mismo material que circula una mesa,
                generado a pedido.
              </p>
            </div>

            <div className="ui-list">
              {FEATURES.map(({ icon, title, body }) => (
                <div key={title} className="ui-list-row">
                  <span style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <span className="list-icon" aria-hidden>{icon}</span>
                    <span>
                      <span className="row-title">{title}</span>
                      <span className="row-desc" style={{ display: "block" }}>{body}</span>
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Proceso — split-label con hairline-grid de pasos */}
      <section className="band-muted site-section">
        <div className="site-wrap">
          <div className="split-label">
            <div className="eyebrow-sm">Cómo funciona</div>
            <div>
              <h2 className="t-h2">Tres pasos, sin formularios.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                Cargás un ticker, el modelo lee los datos, recibís el reporte. Nada más entre vos y el research.
              </p>
            </div>
          </div>

          <div className="step-grid">
            {STEPS.map(([n, title, body]) => (
              <div key={n} className="step-item">
                <div className="step-num">{n}</div>
                <h3 className="t-h3" style={{ marginTop: 18 }}>{title}</h3>
                <p className="t-body" style={{ marginTop: 12, marginBottom: 0 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cierre — buscador secundario en banda navy */}
      <section className="band-navy site-section">
        <div className="site-wrap">
          <div className="split-label">
            <div className="eyebrow-sm">Empezá por acá</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "14em" }}>Cargá un ticker y mirá el reporte.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                Sin registro. El resultado aparece en segundos, listo para exportar a PDF.
              </p>

              <div style={{ marginTop: 32, maxWidth: 560 }}>
                <TickerSearch variant="hero" onSubmit={handleSearch} />
              </div>

              <p className="t-small" style={{ marginTop: 16, marginBottom: 0 }}>
                Datos · Yahoo Finance, SEC EDGAR · Análisis asistido por OpenAI GPT-4o
              </p>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        .step-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          margin-top: 56px;
          border-top: 1px solid var(--site-border);
          border-left: 1px solid var(--site-border);
        }
        .step-item {
          padding: 36px 32px;
          border-right: 1px solid var(--site-border);
          border-bottom: 1px solid var(--site-border);
        }
        .step-num {
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--gold-deep);
        }
        @media (max-width: 900px) {
          .step-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}
