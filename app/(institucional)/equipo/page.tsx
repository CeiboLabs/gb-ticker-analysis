import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Equipo · Bengochea & Cía.",
  description:
    "Equipo profesional de Bengochea & Cía. Sociedad de Bolsa. Asesoramiento financiero, mesa de operaciones y gestión de cartera.",
};

const TEAM = [
  {
    name: "Gastón Bengochea",
    role: "Director General",
    initials: "GB",
    bio: "Director y socio fundador. Más de cuatro décadas en el mercado de capitales uruguayo.",
  },
  {
    name: "Martín Rodríguez",
    role: "Director de Inversiones",
    initials: "MR",
    bio: "Mesa de operaciones y diseño de cartera. Lectura de macro y renta variable internacional.",
  },
  {
    name: "Carolina Pérez",
    role: "Gerente de Operaciones",
    initials: "CP",
    bio: "Custodia, liquidación y cumplimiento. Coordinación operativa multi-mercado.",
  },
  {
    name: "Lucía Fernández",
    role: "Asesoría Financiera",
    initials: "LF",
    bio: "Asesoría a inversores individuales. Planificación patrimonial y selección de instrumentos.",
  },
];

const CULTURA = [
  {
    n: "i.",
    title: "Mesa única.",
    body: "Las decisiones se discuten entre todos. El cliente recibe una recomendación construida, no la opinión aislada de un canal.",
  },
  {
    n: "ii.",
    title: "Formación continua.",
    body: "El mercado cambia; el oficio se actualiza. Lectura sistemática de research, certificaciones y rotación de roles internos.",
  },
  {
    n: "iii.",
    title: "Integridad.",
    body: "Política explícita de prevención de conflictos de interés. La compensación de la mesa no depende del producto que se recomienda.",
  },
];

export default function EquipoPage() {
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
              "radial-gradient(50% 70% at 80% 30%, rgba(201,168,76,0.08), transparent 60%)",
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
            <span className="cap" style={{ color: "rgba(255,255,255,0.55)" }}>La casa · Equipo</span>
            <span className="cap mono" style={{ color: "rgba(255,255,255,0.55)" }}>Montevideo · WTC</span>
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
            La mesa, en su{" "}
            <em style={{ fontStyle: "italic", color: "var(--gold-soft)", fontWeight: 300 }}>
              composición.
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
            Cuatro nombres detrás de cada portafolio. El cliente sabe con quién habla, sabe quién ejecuta, y sabe quién firma.
          </p>
        </div>
      </section>

      {/* 01 · Equipo */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">01 / 02</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>El equipo</div>
            </div>
            <div>
              <h2>Cuatro roles. Una sola conversación.</h2>
              <p className="dek">
                Cada cliente trabaja con un asesor principal y conoce, por nombre, a quienes ejecutan y custodian sus operaciones.
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
            {TEAM.map((member) => (
              <li
                key={member.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: "96px 1fr 1.4fr",
                  gap: "var(--space-5)",
                  padding: "var(--space-5) 0",
                  borderBottom: "1px solid var(--rule)",
                  alignItems: "center",
                }}
                className="team-row"
              >
                <div
                  style={{
                    width: 80,
                    height: 80,
                    border: "1px solid var(--rule-strong)",
                    background: "var(--paper)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    className="serif"
                    style={{
                      fontSize: 28,
                      fontWeight: 400,
                      letterSpacing: "-0.02em",
                      color: "var(--ink)",
                    }}
                  >
                    {member.initials}
                  </span>
                </div>
                <div>
                  <h3
                    className="serif"
                    style={{
                      fontWeight: 400,
                      fontSize: 26,
                      lineHeight: 1.15,
                      margin: 0,
                      letterSpacing: "-0.015em",
                    }}
                  >
                    {member.name}
                  </h3>
                  <div className="cap-gold" style={{ marginTop: 6 }}>{member.role}</div>
                </div>
                <p className="body-base" style={{ margin: 0 }}>{member.bio}</p>
              </li>
            ))}
          </ol>
        </div>

        <style>{`
          @media (max-width: 760px) {
            .team-row { grid-template-columns: 80px 1fr !important; }
            .team-row > p { grid-column: 1 / -1; }
          }
        `}</style>
      </section>

      {/* 02 · Cultura */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">02 / 02</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>Cultura interna</div>
            </div>
            <div>
              <h2>Cómo trabajamos puertas adentro.</h2>
              <p className="dek">
                Lo que el cliente no ve. Tres reglas que sostienen lo que sí.
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
            className="cultura-grid"
          >
            {CULTURA.map((c, i) => (
              <article
                key={c.n}
                style={{
                  padding: "var(--space-6) var(--space-5) var(--space-5)",
                  borderRight: i < CULTURA.length - 1 ? "1px solid var(--rule)" : "none",
                  minHeight: 260,
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
                  {c.n}
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
                  {c.title}
                </h3>
                <p className="body-base" style={{ margin: 0 }}>{c.body}</p>
              </article>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-5)" }}>
            <Link href="/contacto" className="btn btn-secondary">
              Agendá una reunión <span className="arrow" />
            </Link>
          </div>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .cultura-grid { grid-template-columns: 1fr !important; }
            .cultura-grid article { border-right: 0 !important; border-bottom: 1px solid var(--rule); }
          }
        `}</style>
      </section>
    </main>
  );
}
