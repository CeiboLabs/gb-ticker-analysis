import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nosotros · Bengochea & Cía.",
  description:
    "Sociedad de Bolsa uruguaya desde 1967. Misión, visión y valores de Gastón Bengochea CB.",
};

const VALORES = [
  "El cliente inversor siempre primero.",
  "Promovemos el trabajo en equipo.",
  "Valoramos las habilidades blandas: liderazgo, comunicación, flexibilidad y motivación.",
  "Fomentamos la capacitación permanente como herramienta de crecimiento profesional.",
  "Apoyamos la educación financiera y las acciones de defensa del inversor.",
  "Proactivos y creativos para adaptarnos a los desafíos.",
];

const PILARES = [
  ["Presencia y experiencia", "Casi seis décadas gestionando patrimonios de uruguayos y extranjeros. Miembros de la Bolsa de Valores de Montevideo desde 1967."],
  ["Una mirada global", "Somos locales pero con foco global. Invertimos en el mundo desde Uruguay."],
  ["Regulación", "Compañía regulada por el Banco Central del Uruguay y miembros activos de la BVM."],
  ["Seguridad", "Cuentas segregadas: el cliente es el propietario legal de los activos en su cuenta."],
  ["Escucha activa", "Proponemos una cartera individual alineada a los objetivos de cada inversor."],
  ["Dedicación", "Explicamos el funcionamiento del mercado y de cada activo que forma parte de tu cartera."],
  ["Somos tu aliado", "No exigimos mínimos para abrir cuenta. El tiempo es tu mejor aliado; nosotros también."],
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
            La excelencia hace{" "}
            <em style={{ fontStyle: "italic", color: "var(--gold-soft)", fontWeight: 300 }}>
              la diferencia.
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
            Creemos en las relaciones basadas en la confianza mutua y el profesionalismo. Brindamos un servicio profesional construido sobre altos estándares de gestión, sostenido por casi seis décadas en la plaza uruguaya.
          </p>
        </div>
      </section>

      {/* 01 · Pull cita */}
      <section className="section">
        <div className="wrap-narrow" style={{ paddingTop: "var(--space-7)", paddingBottom: "var(--space-7)" }}>
          <div className="cap-gold">Premisa</div>
          <p
            className="serif"
            style={{
              fontWeight: 300,
              fontSize: "clamp(28px, 3.6vw, 44px)",
              lineHeight: 1.2,
              letterSpacing: "-0.015em",
              margin: "var(--space-3) 0 0",
              maxWidth: "22ch",
            }}
          >
            Asumimos con responsabilidad la{" "}
            <em className="serif-i" style={{ color: "var(--gold-deep)" }}>
              administración profesional
            </em>{" "}
            de tus inversiones.
          </p>
        </div>
      </section>

      {/* 02 · Misión & Visión */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">01 / 03</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>Misión y visión</div>
            </div>
            <div>
              <h2>Acompañar al inversor uruguayo, dentro y fuera de fronteras.</h2>
              <p className="dek">
                Dos definiciones que ordenan la práctica de todos los días.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 0,
              borderTop: "1px solid var(--ink)",
            }}
            className="mv-grid"
          >
            <article
              style={{
                padding: "var(--space-5) var(--space-5) var(--space-5) 0",
                borderRight: "1px solid var(--rule)",
                borderBottom: "1px solid var(--rule)",
              }}
              className="mv-col"
            >
              <div className="cap-gold" style={{ marginBottom: "var(--space-3)" }}>Misión</div>
              <p className="body-lead" style={{ margin: 0, maxWidth: "32em" }}>
                Entregar a nuestros clientes asesoramiento profesional e independiente en inversiones financieras, de acuerdo a los objetivos definidos por el inversor y cumpliendo con altos estándares de ética y conducta profesional.
              </p>
              <p className="body-base" style={{ marginTop: "var(--space-3)", maxWidth: "32em" }}>
                Democratizar las inversiones financieras en Uruguay, brindando y promoviendo el acceso al mercado al gran público.
              </p>
            </article>

            <article
              style={{
                padding: "var(--space-5) 0 var(--space-5) var(--space-5)",
                borderBottom: "1px solid var(--rule)",
              }}
              className="mv-col"
            >
              <div className="cap-gold" style={{ marginBottom: "var(--space-3)" }}>Visión</div>
              <p className="body-lead" style={{ margin: 0, maxWidth: "32em" }}>
                Construir y sostener liderazgo en el mercado a partir de la innovación centrada en el cliente y de la adaptabilidad a cambios de contexto.
              </p>
              <p className="body-base" style={{ marginTop: "var(--space-3)", maxWidth: "32em" }}>
                Generar relaciones de largo plazo con clientes, colaboradores y proveedores basadas en la confianza y el profesionalismo.
              </p>
            </article>
          </div>
        </div>

        <style>{`
          @media (max-width: 760px) {
            .mv-grid { grid-template-columns: 1fr !important; }
            .mv-col { padding: var(--space-4) 0 !important; border-right: 0 !important; }
          }
        `}</style>
      </section>

      {/* 03 · Valores */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">02 / 03</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>Valores</div>
            </div>
            <div>
              <h2>Seis principios que ordenan la casa.</h2>
              <p className="dek">
                Lo que sostiene la convivencia interna y la relación con cada cliente.
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
            {VALORES.map((v, i) => (
              <li
                key={v}
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr",
                  gap: "var(--space-4)",
                  padding: "var(--space-4) 0",
                  borderBottom: "1px solid var(--rule)",
                  alignItems: "baseline",
                }}
                className="valor-row"
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 13,
                    letterSpacing: "0.08em",
                    color: "var(--gold-deep)",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="body-lead" style={{ margin: 0, maxWidth: "40em" }}>{v}</p>
              </li>
            ))}
          </ol>
        </div>

        <style>{`
          @media (max-width: 600px) {
            .valor-row { grid-template-columns: 40px 1fr !important; gap: var(--space-3) !important; }
          }
        `}</style>
      </section>

      {/* 04 · Pilares */}
      <section className="section-navy">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">03 / 03</div>
              <div className="cap-gold-on-navy cap" style={{ marginTop: 8 }}>Por qué GB</div>
            </div>
            <div>
              <h2 style={{ color: "var(--ivory)" }}>
                Siete pilares,{" "}
                <em className="serif-i" style={{ color: "var(--gold-soft)", fontWeight: 300 }}>
                  una sola promesa.
                </em>
              </h2>
              <p className="dek" style={{ color: "rgba(255,255,255,0.78)" }}>
                La confianza de nuestros clientes siempre fue nuestro norte. Estos son los atributos sobre los que se construyó.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              borderTop: "1px solid rgba(255,255,255,0.18)",
              borderLeft: "1px solid rgba(255,255,255,0.18)",
            }}
            className="pilar-grid"
          >
            {PILARES.map(([title, body]) => (
              <article
                key={title}
                style={{
                  padding: "var(--space-5)",
                  borderRight: "1px solid rgba(255,255,255,0.18)",
                  borderBottom: "1px solid rgba(255,255,255,0.18)",
                }}
              >
                <h3
                  className="serif"
                  style={{
                    color: "var(--ivory)",
                    fontWeight: 400,
                    fontSize: 20,
                    lineHeight: 1.2,
                    margin: 0,
                    letterSpacing: "-0.015em",
                  }}
                >
                  {title}
                </h3>
                <p className="body-base" style={{ color: "rgba(255,255,255,0.78)", margin: "var(--space-2) 0 0", fontSize: 14 }}>
                  {body}
                </p>
              </article>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-5)", gap: 12 }}>
            <Link href="/historia" className="btn btn-on-navy-secondary">
              Nuestra historia
            </Link>
            <Link href="/contacto" className="btn btn-on-navy-primary">
              Agendá una reunión <span className="arrow" />
            </Link>
          </div>
        </div>

        <style>{`
          @media (max-width: 1000px) {
            .pilar-grid { grid-template-columns: repeat(2, 1fr) !important; }
          }
          @media (max-width: 560px) {
            .pilar-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </section>
    </main>
  );
}
