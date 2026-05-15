import { HeroInstitucional } from "@/components/institucional/HeroInstitucional";
import Link from "next/link";

const SERVICIOS = [
  {
    n: "i.",
    title: "Renta fija",
    desc: "Bonos soberanos y corporativos, locales y globales. Estructura de cartera con horizonte definido y cupones predecibles.",
    tag: "Bonos · Letras · Obligaciones",
  },
  {
    n: "ii.",
    title: "Renta variable",
    desc: "Acceso a NYSE, NASDAQ, LSE, Euronext, XETRA, BVM, BYMA y B3. Operativa con ejecución directa y custodia regulada.",
    tag: "Acciones · ETFs",
  },
  {
    n: "iii.",
    title: "Fondos y gestión",
    desc: "Fondos de inversión y carteras gestionadas por terceros seleccionados. Acceso institucional al universo global de managers.",
    tag: "Fondos · Productos estructurados",
  },
];

const MERCADOS = [
  ["NYSE", "Estados Unidos"],
  ["NASDAQ", "Estados Unidos"],
  ["LSE", "Reino Unido"],
  ["Euronext", "Europa"],
  ["XETRA", "Alemania"],
  ["BVM", "Uruguay"],
  ["BYMA", "Argentina"],
  ["B3", "Brasil"],
];

const PRINCIPIOS = [
  {
    n: "i.",
    title: "Asesoramiento de la casa.",
    desc: "No vendemos producto: leemos al cliente. Cada portafolio se construye con la cabeza puesta en el horizonte y el riesgo asumible, no en la comisión.",
  },
  {
    n: "ii.",
    title: "Cuentas a nombre del cliente.",
    desc: "El patrimonio queda segregado bajo titularidad del inversor, custodiado conforme a la regulación del Banco Central del Uruguay.",
  },
  {
    n: "iii.",
    title: "Cincuenta y siete años en la plaza.",
    desc: "Atravesamos ciclos, regímenes y crisis. La trayectoria no se cuenta como adjetivo: es la base de nuestra capacidad para no improvisar.",
  },
];

export default function HomePage() {
  return (
    <main>
      <HeroInstitucional />

      {/* 01 · Manifiesto */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">01 / 04</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>La casa</div>
            </div>
            <div>
              <h2>Una sociedad de bolsa uruguaya con oficio de banca privada.</h2>
              <p className="dek">
                Operamos desde Montevideo desde 1967. El cliente trabaja con la casa, no con un canal: la conversación que abrís el lunes es la misma que cerrás en seis meses.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              borderTop: "1px solid var(--ink)",
              borderBottom: "1px solid var(--rule)",
            }}
            className="principios-grid"
          >
            {PRINCIPIOS.map((p, i) => (
              <article
                key={p.n}
                style={{
                  padding: "var(--space-6) var(--space-5) var(--space-5)",
                  borderRight: i < PRINCIPIOS.length - 1 ? "1px solid var(--rule)" : "none",
                  minHeight: 280,
                }}
              >
                <div
                  className="serif-i"
                  style={{
                    fontSize: 56,
                    color: "var(--gold-deep)",
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {p.n}
                </div>
                <h3
                  className="serif"
                  style={{
                    fontWeight: 400,
                    fontSize: 26,
                    lineHeight: 1.15,
                    margin: "var(--space-4) 0 var(--space-3)",
                    letterSpacing: "-0.015em",
                  }}
                >
                  {p.title}
                </h3>
                <p className="body-base" style={{ margin: 0 }}>{p.desc}</p>
              </article>
            ))}
          </div>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .principios-grid { grid-template-columns: 1fr !important; }
            .principios-grid article { border-right: 0 !important; border-bottom: 1px solid var(--rule); }
          }
        `}</style>
      </section>

      {/* 02 · Servicios */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">02 / 04</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>Servicios</div>
            </div>
            <div>
              <h2>Tres familias de instrumentos. Una sola mesa.</h2>
              <p className="dek">
                Renta fija, renta variable y vehículos gestionados. La asignación se discute en la mesa; la ejecución la hacemos nosotros.
              </p>
            </div>
          </div>

          <div className="servicios-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0, borderTop: "1px solid var(--rule)" }}>
            {SERVICIOS.map((s, i) => (
              <article
                key={s.title}
                style={{
                  padding: "var(--space-6) var(--space-5)",
                  borderRight: i < SERVICIOS.length - 1 ? "1px solid var(--rule)" : "none",
                  borderBottom: "1px solid var(--rule)",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 280,
                }}
              >
                <div className="cap-gold" style={{ marginBottom: "var(--space-3)" }}>{s.n}</div>
                <h3
                  className="serif"
                  style={{
                    fontWeight: 400,
                    fontSize: 28,
                    lineHeight: 1.15,
                    margin: 0,
                    letterSpacing: "-0.015em",
                  }}
                >
                  {s.title}
                </h3>
                <p className="body-base" style={{ margin: "var(--space-3) 0 var(--space-4)", flex: 1 }}>
                  {s.desc}
                </p>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-3)",
                    paddingTop: "var(--space-3)",
                    borderTop: "1px dashed var(--rule)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {s.tag}
                </div>
              </article>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-5)" }}>
            <Link href="/servicios" className="btn btn-secondary">
              Ver todos los servicios <span className="arrow" />
            </Link>
          </div>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .servicios-grid { grid-template-columns: 1fr !important; }
            .servicios-grid article { border-right: 0 !important; }
          }
        `}</style>
      </section>

      {/* 03 · Mercados */}
      <section className="section-navy">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">03 / 04</div>
              <div className="cap-gold-on-navy cap" style={{ marginTop: 8 }}>Plazas</div>
            </div>
            <div>
              <h2 style={{ color: "var(--ivory)" }}>
                Ocho mercados, una mesa de operaciones.
              </h2>
              <p className="dek" style={{ color: "rgba(255,255,255,0.78)" }}>
                Desde Montevideo operamos las principales bolsas globales y la plaza local con ejecución directa.
              </p>
            </div>
          </div>

          <div
            className="mercados-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              borderTop: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            {MERCADOS.map((m, i) => (
              <div
                key={m[0]}
                style={{
                  padding: "var(--space-4) var(--space-3)",
                  borderRight: (i + 1) % 4 !== 0 ? "1px solid rgba(255,255,255,0.18)" : "none",
                  borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.18)" : "none",
                }}
              >
                <div
                  className="mono"
                  style={{
                    color: "var(--gold-soft)",
                    fontSize: 18,
                    letterSpacing: "0.02em",
                    marginBottom: 6,
                  }}
                >
                  {m[0]}
                </div>
                <div className="cap" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {m[1]}
                </div>
              </div>
            ))}
          </div>
        </div>

        <style>{`
          @media (max-width: 720px) {
            .mercados-grid { grid-template-columns: repeat(2, 1fr) !important; }
            .mercados-grid > div:nth-child(4n) { border-right: 1px solid rgba(255,255,255,0.18) !important; }
            .mercados-grid > div:nth-child(2n) { border-right: 0 !important; }
          }
        `}</style>
      </section>

      {/* 04 · Análisis */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">04 / 04</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>Análisis · herramienta</div>
            </div>
            <div>
              <h2>
                Equity research a pedido,{" "}
                <em className="serif-i" style={{ color: "var(--gold-deep)" }}>en segundos.</em>
              </h2>
              <p className="dek">
                Cargá un ticker y obtené un reporte con KPIs, Sankey de estado de resultados, consenso de Wall Street y veredicto fundamentado. Para nuestros clientes, mismo rigor que un equity research sell-side.
              </p>
            </div>
          </div>

          <div className="analisis-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "var(--space-6)", alignItems: "stretch" }}>
            <div style={{ borderTop: "1px solid var(--ink)", paddingTop: "var(--space-5)" }}>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column" }}>
                {[
                  ["Veredicto", "BUY · HOLD · AVOID, con tesis fundamentada"],
                  ["Métricas", "Doce KPIs financieros en tabular-nums"],
                  ["Estado de resultados", "Sankey: ingresos → costos → utilidad"],
                  ["Consenso", "Distribución de analistas de Wall Street"],
                  ["Exportación", "PDF profesional listo para circular"],
                ].map(([k, v], i) => (
                  <li
                    key={k}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "180px 1fr",
                      gap: 16,
                      padding: "var(--space-3) 0",
                      borderBottom: i < 4 ? "1px solid var(--rule)" : "1px solid var(--ink)",
                      alignItems: "baseline",
                    }}
                  >
                    <span className="cap" style={{ color: "var(--ink-2)" }}>{k}</span>
                    <span className="body-base" style={{ color: "var(--ink)" }}>{v}</span>
                  </li>
                ))}
              </ul>

              <div style={{ marginTop: "var(--space-5)" }}>
                <Link href="/analisis" className="btn btn-primary">
                  Probar el análisis <span className="arrow" />
                </Link>
              </div>
            </div>

            {/* Mock ficha */}
            <aside
              className="section-navy"
              style={{
                padding: "var(--space-5)",
                position: "relative",
                color: "var(--ivory)",
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: "var(--space-3)",
                  right: "var(--space-3)",
                  width: 24,
                  height: 24,
                  borderTop: "1px solid var(--gold)",
                  borderRight: "1px solid var(--gold)",
                }}
              />
              <div className="cap-gold-on-navy cap">Apple Inc. · NASDAQ</div>
              <div
                className="serif"
                style={{
                  fontWeight: 400,
                  fontSize: 36,
                  lineHeight: 1.1,
                  margin: "var(--space-2) 0 var(--space-4)",
                  letterSpacing: "-0.015em",
                }}
              >
                AAPL <span className="serif-i" style={{ color: "var(--gold-soft)" }}>buy.</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)", paddingTop: "var(--space-3)", borderTop: "1px solid rgba(255,255,255,0.18)" }}>
                {[
                  ["P/E", "28,4×"],
                  ["Market Cap", "USD 3,4 T"],
                  ["Revenue", "USD 383 B"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="cap" style={{ color: "rgba(255,255,255,0.5)" }}>{k}</div>
                    <div className="mono" style={{ fontSize: 18, color: "var(--ivory)", marginTop: 4 }}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-3)", borderTop: "1px solid rgba(255,255,255,0.18)" }}>
                <div className="cap" style={{ color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>Var YTD</div>
                <svg viewBox="0 0 300 60" style={{ width: "100%", height: 48, color: "var(--gold-soft)" }}>
                  <path
                    d="M0 50 Q30 45 60 40 T120 30 T180 25 T240 15 T300 10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                </svg>
              </div>
            </aside>
          </div>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .analisis-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </section>
    </main>
  );
}
