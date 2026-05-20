import { HeroInstitucional } from "@/components/institucional/HeroInstitucional";
import Link from "next/link";

const PILARES = [
  {
    n: "i.",
    title: "Presencia y experiencia",
    body: "Gestionamos el patrimonio financiero de miles de uruguayos y extranjeros por casi seis décadas. Somos miembros de la Bolsa de Valores de Montevideo desde 1967.",
  },
  {
    n: "ii.",
    title: "Una mirada global",
    body: "Somos locales pero con foco global. Invertimos en los mercados del mundo desde Uruguay, con acceso directo a las principales plazas internacionales.",
  },
  {
    n: "iii.",
    title: "Regulación",
    body: "Operamos como compañía regulada por el Banco Central del Uruguay y como miembros activos de la Bolsa de Valores de Montevideo.",
  },
  {
    n: "iv.",
    title: "Seguridad",
    body: "Cuentas segregadas a nombre del cliente. El inversor es el propietario legal de los activos en su cuenta, separados del patrimonio de la firma.",
  },
  {
    n: "v.",
    title: "Escucha activa",
    body: "Te escuchamos antes de hablar. Proponemos una cartera individual que cumple con los objetivos y restricciones de cada inversor.",
  },
  {
    n: "vi.",
    title: "Dedicación",
    body: "Dedicamos tiempo a explicar el funcionamiento del mercado y de cada activo en el que invertirás, y por qué creemos que debe formar parte de tu cartera.",
  },
  {
    n: "vii.",
    title: "Somos tu aliado",
    body: "No exigimos mínimos para la apertura de cuenta. Cuando comiences a invertir, el tiempo será tu mejor aliado. Nosotros también.",
  },
];

const ECOSISTEMA = {
  local: [
    ["Bonos Globales uruguayos", "Operativa en bonos globales denominados en dólares y pesos."],
    ["Notas del Tesoro en UI", "Mercado primario y secundario en Notas en Unidades Indexadas."],
    ["Fideicomisos Financieros", "Vehículos de inversión para el financiamiento privado y obras."],
    ["Letras de Regulación Monetaria", "Mercado primario y secundario de LRM en pesos."],
    ["Obligaciones Negociables", "Deuda corporativa emitida bajo jurisdicción local."],
  ] as [string, string][],
  internacional: [
    ["Bonos soberanos y corporativos", "Renta fija global: tesoros, investment-grade y high-yield."],
    ["Acciones comunes y preferidas", "Acceso a NYSE, NASDAQ, LSE, Euronext, XETRA y plazas regionales."],
    ["Fondos de Inversión", "Vehículos gestionados por managers globales seleccionados."],
    ["Instrumentos derivados", "Cobertura y exposición direccional según el mandato del cliente."],
    ["Apertura de cuenta internacional", "Custodia con counterparties globales bajo cuenta segregada."],
  ] as [string, string][],
};

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

export default function HomePage() {
  return (
    <main>
      <HeroInstitucional />

      {/* Pull quote breakaway */}
      <section style={{ background: "var(--ivory)", borderTop: "1px solid var(--ink)" }}>
        <div
          className="wrap-narrow pullquote-wrap"
          style={{
            paddingTop: "var(--space-7)",
            paddingBottom: "var(--space-7)",
            display: "grid",
            gridTemplateColumns: "120px 1fr",
            gap: "var(--space-5)",
            alignItems: "start",
          }}
        >
          <div>
            <div
              className="serif-i"
              style={{
                fontSize: 96,
                lineHeight: 0.8,
                color: "var(--gold-deep)",
                letterSpacing: "-0.04em",
              }}
              aria-hidden
            >
              &ldquo;
            </div>
          </div>
          <div>
            <p
              className="serif"
              style={{
                fontWeight: 300,
                fontSize: "clamp(24px, 3vw, 36px)",
                lineHeight: 1.25,
                letterSpacing: "-0.012em",
                color: "var(--ink)",
                margin: 0,
              }}
            >
              Desde 1967 monitoreamos el mercado en búsqueda de las mejores oportunidades de inversión.{" "}
              <em className="serif-i" style={{ color: "var(--gold-deep)" }}>
                La confianza de nuestros clientes siempre fue nuestro norte.
              </em>
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginTop: "var(--space-5)",
              }}
            >
              <span style={{ width: 28, height: 1, background: "var(--ink)" }} />
              <span className="cap" style={{ color: "var(--ink-2)" }}>
                Gastón Bengochea & Cía. · Sociedad de Bolsa
              </span>
            </div>
          </div>
        </div>

        <style>{`
          @media (max-width: 720px) {
            .pullquote-wrap { grid-template-columns: 1fr !important; gap: var(--space-3) !important; }
          }
        `}</style>
      </section>

      {/* 01 · ¿Por qué GB? — 7 pilares */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">01 / 04</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>¿Por qué GB?</div>
            </div>
            <div>
              <h2>
                Siete maneras de leer la confianza{" "}
                <em className="serif-i" style={{ color: "var(--gold-deep)" }}>
                  que nos dieron casi seis décadas.
                </em>
              </h2>
              <p className="dek">
                Los atributos no se proclaman: se ejecutan. Estos son los siete que sostienen la relación con cada cliente.
              </p>
            </div>
          </div>

          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              borderTop: "1px solid var(--ink)",
            }}
          >
            {PILARES.map((p) => (
              <li
                key={p.n}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 260px 1fr",
                  gap: "var(--space-5)",
                  padding: "var(--space-5) 0",
                  borderBottom: "1px solid var(--rule)",
                  alignItems: "baseline",
                }}
                className="pilar-row"
              >
                <div
                  className="serif-i"
                  style={{
                    fontSize: 32,
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
                    fontSize: 24,
                    lineHeight: 1.2,
                    margin: 0,
                    letterSpacing: "-0.015em",
                  }}
                >
                  {p.title}
                </h3>
                <p className="body-base" style={{ margin: 0, maxWidth: "44em" }}>
                  {p.body}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .pilar-row { grid-template-columns: 48px 1fr !important; }
            .pilar-row > p { grid-column: 2 / -1; }
          }
          @media (max-width: 560px) {
            .pilar-row { grid-template-columns: 1fr !important; gap: 6px !important; }
            .pilar-row > p { grid-column: 1; }
          }
        `}</style>
      </section>

      {/* 02 · Ecosistema */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">02 / 04</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>Ecosistema</div>
            </div>
            <div>
              <h2>Accedé a nuestro amplio ecosistema de inversiones.</h2>
              <p className="dek">
                Operativa local con la plaza uruguaya y operativa internacional con las principales bolsas del mundo. Una sola mesa para ambas.
              </p>
            </div>
          </div>

          <div className="ecosistema-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, borderTop: "1px solid var(--ink)" }}>
            {/* Mercado Local */}
            <div
              style={{
                padding: "var(--space-5) var(--space-5) var(--space-5) 0",
                borderRight: "1px solid var(--rule)",
              }}
              className="ecosistema-col"
            >
              <div className="cap-gold" style={{ marginBottom: "var(--space-3)" }}>Mercado Local</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {ECOSISTEMA.local.map(([t, b], i) => (
                  <li
                    key={t}
                    style={{
                      padding: "var(--space-3) 0",
                      borderBottom: i < ECOSISTEMA.local.length - 1 ? "1px solid var(--rule)" : "none",
                    }}
                  >
                    <h3
                      className="serif"
                      style={{
                        fontWeight: 400,
                        fontSize: 19,
                        lineHeight: 1.25,
                        margin: 0,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {t}
                    </h3>
                    <p className="body-base" style={{ margin: "6px 0 0", fontSize: 14 }}>{b}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Mercado Internacional */}
            <div
              style={{
                padding: "var(--space-5) 0 var(--space-5) var(--space-5)",
              }}
              className="ecosistema-col"
            >
              <div className="cap-gold" style={{ marginBottom: "var(--space-3)" }}>Mercado Internacional</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {ECOSISTEMA.internacional.map(([t, b], i) => (
                  <li
                    key={t}
                    style={{
                      padding: "var(--space-3) 0",
                      borderBottom: i < ECOSISTEMA.internacional.length - 1 ? "1px solid var(--rule)" : "none",
                    }}
                  >
                    <h3
                      className="serif"
                      style={{
                        fontWeight: 400,
                        fontSize: 19,
                        lineHeight: 1.25,
                        margin: 0,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {t}
                    </h3>
                    <p className="body-base" style={{ margin: "6px 0 0", fontSize: 14 }}>{b}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-5)" }}>
            <Link href="/servicios" className="btn btn-secondary">
              Ver el ecosistema completo <span className="arrow" />
            </Link>
          </div>
        </div>

        <style>{`
          @media (max-width: 760px) {
            .ecosistema-grid { grid-template-columns: 1fr !important; }
            .ecosistema-col { padding: var(--space-4) 0 !important; border-right: 0 !important; border-bottom: 1px solid var(--rule); }
            .ecosistema-col:last-child { border-bottom: 0; }
          }
        `}</style>
      </section>

      {/* 03 · Plazas */}
      <section className="section-navy">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">03 / 04</div>
              <div className="cap-gold-on-navy cap" style={{ marginTop: 8 }}>Plazas</div>
            </div>
            <div>
              <h2 style={{ color: "var(--ivory)" }}>
                Una puerta local al mercado{" "}
                <em className="serif-i" style={{ color: "var(--gold-soft)", fontWeight: 300 }}>
                  internacional.
                </em>
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
          @media (max-width: 420px) {
            .mercados-grid { grid-template-columns: 1fr !important; }
            .mercados-grid > div { border-right: 0 !important; }
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
                    className="analisis-row"
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

              <div className="analisis-mock-stats" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)", paddingTop: "var(--space-3)", borderTop: "1px solid rgba(255,255,255,0.18)" }}>
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
          @media (max-width: 520px) {
            .analisis-row { grid-template-columns: 1fr !important; gap: 4px !important; }
            .analisis-mock-stats { grid-template-columns: 1fr 1fr !important; gap: var(--space-3) !important; }
          }
        `}</style>
      </section>
    </main>
  );
}
