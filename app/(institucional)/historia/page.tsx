import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Historia · Bengochea & Cía.",
  description:
    "Sesenta años de confianza e idoneidad. Hitos de Gastón Bengochea CB desde 1967 hasta hoy.",
};

const TIMELINE = [
  {
    year: "1967",
    title: "Fundación",
    body: "Gastón Bengochea se incorpora como miembro de la Bolsa de Valores de Montevideo. Una estructura empresarial horizontal que permite a los colaboradores trabajar de forma integrada.",
  },
  {
    year: "1980s",
    title: "Primer broker local en fondos mutuos",
    body: "Acuerdo de distribución de Fondos Mutuos con Fidelity Investments. Bengochea se convierte en el primer broker local en incorporar fondos mutuos a su menú.",
  },
  {
    year: "2003",
    title: "Acuerdos con custodios internacionales",
    body: "Se establecen acuerdos directos con custodios y contrapartes internacionales, ampliando el alcance operativo fuera de fronteras.",
  },
  {
    year: "2005",
    title: "Apertura de cuentas en el exterior",
    body: "Lanzamiento del servicio de apertura de cuentas de inversión en el exterior para clientes uruguayos.",
  },
  {
    year: "2008",
    title: "Consultanet · e-banking",
    body: "Se incorpora CONSULTANET, la plataforma de consulta online de cuentas con información actualizada a diario.",
  },
  {
    year: "2013",
    title: "Matriz energética del Uruguay",
    body: "Participación en estructuras de financiamiento para parques eólicos, contribuyendo a la transformación de la matriz energética uruguaya.",
  },
  {
    year: "2015",
    title: "Clearstream Banking",
    body: "Acuerdo con Clearstream Banking para servicios post-trade y custodia global de activos.",
  },
  {
    year: "2016",
    title: "Reestructura de deuda",
    body: "Trabajos de reestructura de deuda con empresas e intendencias departamentales. Oferta de oportunidades de deuda securitizada.",
  },
  {
    year: "2018",
    title: "Mudanza al World Trade Center",
    body: "La firma traslada sus oficinas al World Trade Center de Montevideo, en la Torre I.",
  },
  {
    year: "2019",
    title: "Código de Ética CFA",
    body: "Adhesión al Código de Ética y Normas de Conducta Profesional del Instituto CFA.",
  },
  {
    year: "2020",
    title: "Principios de empoderamiento de la mujer",
    body: "Suscripción a la iniciativa de principios de empoderamiento de la mujer de Naciones Unidas (UN Women).",
  },
  {
    year: "2021",
    title: "Bank of New York · BNY Asset Servicing",
    body: "Acuerdo institucional con Bank of New York BNY para servicios de custodia y administración de activos.",
  },
];

export default function HistoriaPage() {
  return (
    <main>
      {/* Hero */}
      <section className="section-navy" style={{ position: "relative", overflow: "hidden" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(50% 70% at 80% 10%, rgba(201,168,76,0.10), transparent 60%)",
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
            <span className="cap" style={{ color: "rgba(255,255,255,0.55)" }}>La casa · Historia</span>
            <span className="cap mono" style={{ color: "rgba(255,255,255,0.55)" }}>1967 — 2026</span>
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
              maxWidth: "16ch",
            }}
          >
            Sesenta años de{" "}
            <em style={{ fontStyle: "italic", color: "var(--gold-soft)", fontWeight: 300 }}>
              confianza e idoneidad.
            </em>
          </h1>

          <p
            className="lede"
            style={{
              maxWidth: "42em",
              color: "rgba(255,255,255,0.82)",
              marginTop: "var(--space-5)",
            }}
          >
            Gastón Bengochea CB es miembro de la Bolsa de Valores de Montevideo desde 1967. Una sola firma, sin discontinuidades, atravesando ciclos económicos, regímenes regulatorios y crisis cambiarias.
          </p>
        </div>
      </section>

      {/* 01 · Origen */}
      <section className="section">
        <div className="wrap-narrow" style={{ paddingTop: "var(--space-7)", paddingBottom: "var(--space-7)" }}>
          <div className="cap-gold" style={{ marginBottom: "var(--space-3)" }}>Origen</div>
          <h2
            className="serif"
            style={{
              fontWeight: 400,
              fontSize: "clamp(28px, 3.4vw, 40px)",
              lineHeight: 1.15,
              letterSpacing: "-0.015em",
              margin: 0,
              maxWidth: "24ch",
            }}
          >
            Una casa fundada con estructura horizontal.
          </h2>
          <p className="body-lead" style={{ marginTop: "var(--space-4)", maxWidth: "44em" }}>
            La compañía fue fundada por Gastón Bengochea con una estructura empresarial horizontal, permitiendo a sus colaboradores trabajar de forma integrada. Esa lógica fundacional —oficio compartido, decisiones discutidas en la mesa— se mantiene intacta seis décadas después.
          </p>
          <p className="body-base" style={{ marginTop: "var(--space-3)", maxWidth: "44em" }}>
            En la década del ochenta, Bengochea firmó un acuerdo de distribución de Fondos Mutuos con Fidelity Investments y se convirtió en el primer broker local en incorporar fondos mutuos a su catálogo. La apertura internacional empezó allí.
          </p>
        </div>
      </section>

      {/* 02 · Timeline */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">01 / 02</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>A través de los años</div>
            </div>
            <div>
              <h2>Doce hitos que cuentan la trayectoria.</h2>
              <p className="dek">
                De la fundación a los acuerdos institucionales con custodios globales. Sin saltos.
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
            {TIMELINE.map((t) => (
              <li
                key={t.year}
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 280px 1fr",
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
                    fontSize: 22,
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
                    fontSize: 22,
                    lineHeight: 1.2,
                    margin: 0,
                    letterSpacing: "-0.015em",
                  }}
                >
                  {t.title}
                </h3>
                <p className="body-base" style={{ margin: 0, maxWidth: "44em" }}>
                  {t.body}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <style>{`
          @media (max-width: 1000px) {
            .timeline-row { grid-template-columns: 120px 1fr !important; }
            .timeline-row > h3 { grid-column: 2; }
            .timeline-row > p { grid-column: 2; }
          }
          @media (max-width: 600px) {
            .timeline-row { grid-template-columns: 1fr !important; gap: 6px !important; }
            .timeline-row > h3, .timeline-row > p { grid-column: 1; }
          }
        `}</style>
      </section>

      {/* 03 · Cierre */}
      <section className="section-navy">
        <div className="wrap" style={{ paddingTop: "var(--space-7)", paddingBottom: "var(--space-7)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)",
              gap: "var(--space-6)",
              alignItems: "end",
            }}
            className="cierre-grid"
          >
            <div>
              <div className="cap-gold-on-navy cap">2026 · hoy</div>
              <h2
                className="serif"
                style={{
                  fontStyle: "italic",
                  fontWeight: 300,
                  fontSize: "clamp(28px, 4vw, 48px)",
                  lineHeight: 1.1,
                  margin: "var(--space-3) 0 0",
                  color: "var(--gold-soft)",
                  letterSpacing: "-0.015em",
                  maxWidth: "18em",
                }}
              >
                La misma lectura prudente que abrió la casa en 1967.
              </h2>
            </div>
            <div>
              <p className="lede" style={{ color: "rgba(255,255,255,0.82)", margin: 0, maxWidth: "36em" }}>
                Hoy operamos ocho mercados desde Montevideo con un equipo que conserva la lógica fundadora: cuentas a nombre del cliente, asesoramiento de la casa y decisiones que se discuten en la mesa.
              </p>
              <div style={{ display: "flex", gap: 12, marginTop: "var(--space-5)", flexWrap: "wrap" }}>
                <Link href="/equipo" className="btn btn-on-navy-secondary">
                  Conocé el equipo
                </Link>
                <Link href="/contacto" className="btn btn-on-navy-primary">
                  Agendá una reunión <span className="arrow" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .cierre-grid { grid-template-columns: 1fr !important; gap: var(--space-5) !important; }
          }
        `}</style>
      </section>
    </main>
  );
}
