import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nosotros · Bengochea & Cía.",
  description:
    "Sociedad de bolsa uruguaya desde 1967. Cincuenta y siete años de oficio en el mercado de capitales uruguayo y global.",
};

const TIMELINE = [
  {
    year: "1967",
    title: "Fundación",
    body: "Gastón Bengochea se incorpora como miembro de la Bolsa de Valores de Montevideo. Una operación pequeña, una mesa, y una lectura prudente del mercado uruguayo.",
  },
  {
    year: "1980s",
    title: "Consolidación local",
    body: "Décadas de operación continua en la plaza uruguaya. La firma atraviesa ciclos económicos, crisis cambiarias y regímenes regulatorios sin interrumpir actividad.",
  },
  {
    year: "2000s",
    title: "Apertura internacional",
    body: "Ampliación del ecosistema con acceso a NYSE, NASDAQ y mercados europeos. Bonos globales y custodia internacional incorporados al menú de la casa.",
  },
  {
    year: "2010s",
    title: "Infraestructura moderna",
    body: "Plataformas de ejecución, integración con custodios internacionales y modernización del back-office para sostener una operativa multi-mercado.",
  },
  {
    year: "2026",
    title: "Hoy",
    body: "Operamos ocho mercados con un equipo que conserva la lógica fundadora: cuentas a nombre del cliente, asesoramiento de la casa, decisiones discutidas en la mesa.",
  },
];

const REGULACION = [
  {
    n: "i.",
    title: "Banco Central del Uruguay.",
    body: "Operamos bajo supervisión y regulación del BCU. Reportamos balance, posiciones y operativa conforme a las normativas vigentes del mercado de valores uruguayo.",
  },
  {
    n: "ii.",
    title: "Bolsa de Valores de Montevideo.",
    body: "Miembros activos de la BVM desde 1967. Participamos en la formación de precios y en el desarrollo del mercado de capitales doméstico.",
  },
  {
    n: "iii.",
    title: "Cuentas segregadas.",
    body: "Los activos del cliente se custodian en cuentas segregadas a su nombre, separadas del patrimonio de la firma. Es la garantía estructural de que tu portafolio es tuyo.",
  },
  {
    n: "iv.",
    title: "Código de ética.",
    body: "Adherimos a estrictas prácticas de mercado: prevención de conflictos de interés, política de mejor ejecución, confidencialidad y trato igualitario al cliente.",
  },
];

export default function NosotrosPage() {
  return (
    <main>
      {/* Hero */}
      <section className="section-navy" style={{ position: "relative", overflow: "hidden" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(50% 70% at 20% 20%, rgba(201,168,76,0.08), transparent 60%)",
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
            <span className="cap" style={{ color: "rgba(255,255,255,0.55)" }}>La casa · Nosotros</span>
            <span className="cap mono" style={{ color: "rgba(255,255,255,0.55)" }}>EST. 1967</span>
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
            Cincuenta y siete años{" "}
            <em style={{ fontStyle: "italic", color: "var(--gold-soft)", fontWeight: 300 }}>
              de oficio.
            </em>
          </h1>

          <p
            className="lede"
            style={{
              maxWidth: "40em",
              color: "rgba(255,255,255,0.82)",
              marginTop: "var(--space-5)",
            }}
          >
            Bengochea &amp; Cía. es una sociedad de bolsa uruguaya fundada en 1967. Operamos los principales mercados globales desde Montevideo con la convicción de que la trayectoria no se cuenta: se demuestra, año tras año, en cómo se ejecuta cada operación.
          </p>
        </div>
      </section>

      {/* 01 · Misión */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">01 / 03</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>Misión</div>
            </div>
            <div>
              <h2>Acompañar al inversor uruguayo, dentro y fuera de fronteras.</h2>
              <p className="dek">
                Somos la casa de bolsa que prefiere una conversación larga a una recomendación apurada. El portafolio es del cliente; nosotros somos la mesa que lo acompaña.
              </p>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--ink)" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-6)",
                padding: "var(--space-6) 0",
                borderBottom: "1px solid var(--rule)",
              }}
              className="mision-grid"
            >
              <p className="body-lead" style={{ margin: 0, maxWidth: "30em" }}>
                Construimos relaciones largas con cada cliente. La cartera se diseña en función del horizonte y del riesgo asumible, no del producto del mes.
              </p>
              <p className="body-base" style={{ margin: 0 }}>
                A lo largo de casi seis décadas hemos asesorado a familias, empresas e instituciones uruguayas y de la región. La continuidad del oficio — los mismos socios, la misma lectura prudente — es nuestra promesa más concreta.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 0,
              }}
              className="valores-grid"
            >
              {[
                ["Cuentas segregadas", "El patrimonio del cliente queda a su nombre, custodiado bajo regulación del BCU."],
                ["Asesoramiento de la casa", "El cliente trabaja con la mesa, no con un canal. Una sola conversación, todo el tiempo."],
                ["Perspectiva uruguaya", "Operamos los mercados globales con la lente de quien entiende la plaza local."],
              ].map(([title, body], i) => (
                <div
                  key={title}
                  style={{
                    padding: "var(--space-5) var(--space-4) var(--space-5) 0",
                    paddingLeft: i === 0 ? 0 : "var(--space-5)",
                    borderRight: i < 2 ? "1px solid var(--rule)" : "none",
                    borderBottom: "1px solid var(--rule)",
                  }}
                >
                  <div className="cap-gold" style={{ marginBottom: 8 }}>{title}</div>
                  <p className="body-base" style={{ margin: 0 }}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <style>{`
          @media (max-width: 760px) {
            .mision-grid { grid-template-columns: 1fr !important; }
            .valores-grid { grid-template-columns: 1fr !important; }
            .valores-grid > div { border-right: 0 !important; padding-left: 0 !important; }
          }
        `}</style>
      </section>

      {/* 02 · Historia */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">02 / 03</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>Historia</div>
            </div>
            <div>
              <h2>Cinco décadas y media en la plaza.</h2>
              <p className="dek">Cinco etapas, una sola firma. Sin discontinuidades.</p>
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
            {TIMELINE.map((t) => (
              <li
                key={t.year}
                style={{
                  display: "grid",
                  gridTemplateColumns: "180px 220px 1fr",
                  gap: "var(--space-5)",
                  padding: "var(--space-5) 0",
                  borderBottom: "1px solid var(--rule)",
                  alignItems: "baseline",
                }}
                className="timeline-row"
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 24,
                    color: "var(--gold-deep)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {t.year}
                </div>
                <h3
                  className="serif"
                  style={{
                    fontWeight: 400,
                    fontSize: 24,
                    lineHeight: 1.15,
                    margin: 0,
                    letterSpacing: "-0.015em",
                  }}
                >
                  {t.title}
                </h3>
                <p className="body-base" style={{ margin: 0 }}>{t.body}</p>
              </li>
            ))}
          </ol>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .timeline-row { grid-template-columns: 120px 1fr !important; }
            .timeline-row > h3 { grid-column: 2; }
            .timeline-row > p { grid-column: 2; }
          }
          @media (max-width: 600px) {
            .timeline-row { grid-template-columns: 1fr !important; gap: 8px !important; }
          }
        `}</style>
      </section>

      {/* 03 · Regulación */}
      <section className="section-navy">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">03 / 03</div>
              <div className="cap-gold-on-navy cap" style={{ marginTop: 8 }}>Regulación</div>
            </div>
            <div>
              <h2 style={{ color: "var(--ivory)" }}>Cuatro garantías estructurales.</h2>
              <p className="dek" style={{ color: "rgba(255,255,255,0.78)" }}>
                El marco regulatorio bajo el que operamos no es un detalle del pie de página: es la arquitectura sobre la que se sostiene la relación con el cliente.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 0,
              borderTop: "1px solid rgba(255,255,255,0.18)",
            }}
            className="regulacion-grid"
          >
            {REGULACION.map((r, i) => (
              <article
                key={r.title}
                style={{
                  padding: "var(--space-5)",
                  borderRight: i % 2 === 0 ? "1px solid rgba(255,255,255,0.18)" : "none",
                  borderBottom: "1px solid rgba(255,255,255,0.18)",
                }}
              >
                <div
                  className="serif-i"
                  style={{
                    fontSize: 36,
                    color: "var(--gold-soft)",
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {r.n}
                </div>
                <h3
                  className="serif"
                  style={{
                    color: "var(--ivory)",
                    fontWeight: 400,
                    fontSize: 24,
                    lineHeight: 1.2,
                    margin: "var(--space-3) 0 var(--space-2)",
                    letterSpacing: "-0.015em",
                  }}
                >
                  {r.title}
                </h3>
                <p className="body-base" style={{ color: "rgba(255,255,255,0.78)", margin: 0 }}>
                  {r.body}
                </p>
              </article>
            ))}
          </div>
        </div>

        <style>{`
          @media (max-width: 760px) {
            .regulacion-grid { grid-template-columns: 1fr !important; }
            .regulacion-grid article { border-right: 0 !important; }
          }
        `}</style>
      </section>
    </main>
  );
}
