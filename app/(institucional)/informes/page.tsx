import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Informes · Bengochea & Cía.",
  description:
    "Informes mensuales y semanales de mercado de Gastón Bengochea CB. Recomendaciones, lectura macro y oportunidades de inversión.",
};

type Informe = {
  fecha: string;
  fechaTexto: string;
  titulo: string;
  categoria: "Mensual" | "Semanal";
  pdf: string;
};

const INFORMES: Informe[] = [
  {
    fecha: "2026-05-18",
    fechaTexto: "18 de mayo, 2026",
    titulo: "Informe mensual · Mayo 2026",
    categoria: "Mensual",
    pdf: "https://gbengochea.com.uy/img/informes/Bengochea Inversiones - Informe mensual Mayo 2026.pdf",
  },
  {
    fecha: "2026-05-15",
    fechaTexto: "15 de mayo, 2026",
    titulo: "Informe semanal · 15 de mayo",
    categoria: "Semanal",
    pdf: "https://gbengochea.com.uy/img/informes/GB INFORME SEMANAL 15-05-2026.pdf",
  },
  {
    fecha: "2026-05-11",
    fechaTexto: "11 de mayo, 2026",
    titulo: "Informe semanal · 11 de mayo",
    categoria: "Semanal",
    pdf: "https://gbengochea.com.uy/img/informes/GB INFORME SEMANAL 11-05-2026.pdf",
  },
  {
    fecha: "2026-04-24",
    fechaTexto: "24 de abril, 2026",
    titulo: "Informe semanal · 24 de abril",
    categoria: "Semanal",
    pdf: "https://gbengochea.com.uy/img/informes/GB INFORME SEMANAL 24-04-2026.pdf",
  },
  {
    fecha: "2026-04-20",
    fechaTexto: "20 de abril, 2026",
    titulo: "Informe semanal · 20 de abril",
    categoria: "Semanal",
    pdf: "https://gbengochea.com.uy/img/informes/GB INFORME SEMANAL 20-04-2026.pdf",
  },
];

export default function InformesPage() {
  const destacado = INFORMES[0];
  const restantes = INFORMES.slice(1);

  return (
    <main>
      {/* Hero */}
      <section className="section-navy" style={{ position: "relative", overflow: "hidden" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(50% 70% at 10% 20%, rgba(201,168,76,0.10), transparent 60%)",
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
            <span className="cap" style={{ color: "rgba(255,255,255,0.55)" }}>Recomendaciones · Informes</span>
            <span className="cap mono" style={{ color: "rgba(255,255,255,0.55)" }}>Mensuales y semanales</span>
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
              maxWidth: "20ch",
            }}
          >
            Lectura semanal y mensual del{" "}
            <em style={{ fontStyle: "italic", color: "var(--gold-soft)", fontWeight: 300 }}>
              mercado.
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
            Recibí asesoramiento personalizado de acuerdo a tu perfil de inversor y necesidades particulares. Nuestros informes recogen la lectura de la mesa: macro, fija, equity y oportunidades.
          </p>
        </div>
      </section>

      {/* Destacado */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">Último</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>Edición vigente</div>
            </div>
            <div>
              <h2>{destacado.titulo}.</h2>
              <p className="dek">
                Publicado el {destacado.fechaTexto}. Disponible para descarga en PDF.
              </p>
            </div>
          </div>

          <article
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              borderTop: "1px solid var(--ink)",
              borderBottom: "1px solid var(--ink)",
              padding: "var(--space-6) 0",
              gap: "var(--space-6)",
              alignItems: "center",
            }}
            className="destacado-grid"
          >
            <div>
              <div className="cap-gold" style={{ marginBottom: "var(--space-2)" }}>{destacado.categoria}</div>
              <h3
                className="serif"
                style={{
                  fontWeight: 400,
                  fontSize: "clamp(28px, 3.6vw, 44px)",
                  lineHeight: 1.1,
                  margin: 0,
                  letterSpacing: "-0.02em",
                  maxWidth: "16ch",
                }}
              >
                {destacado.titulo}
              </h3>
              <p className="body-base" style={{ marginTop: "var(--space-3)" }}>
                Lectura de la macro internacional, posicionamiento en renta fija uruguaya, oportunidades en equity global y comentarios sobre la operativa de la semana.
              </p>
              <div style={{ marginTop: "var(--space-4)" }}>
                <a
                  href={destacado.pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  Descargar PDF <span className="arrow" />
                </a>
              </div>
            </div>

            {/* Mock cover */}
            <a
              href={destacado.pdf}
              target="_blank"
              rel="noopener noreferrer"
              className="section-navy"
              style={{
                position: "relative",
                padding: "var(--space-6) var(--space-5)",
                color: "var(--ivory)",
                minHeight: 280,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "var(--space-5)",
                textDecoration: "none",
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
              <div>
                <div className="cap-gold-on-navy cap">Bengochea Inversiones</div>
                <h4
                  className="serif"
                  style={{
                    fontWeight: 400,
                    fontSize: 30,
                    lineHeight: 1.1,
                    margin: "var(--space-2) 0 0",
                    letterSpacing: "-0.015em",
                  }}
                >
                  Informe <span className="serif-i" style={{ color: "var(--gold-soft)" }}>mensual.</span>
                </h4>
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 12,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.6)",
                  borderTop: "1px solid rgba(255,255,255,0.18)",
                  paddingTop: "var(--space-3)",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>Mayo · 2026</span>
                <span style={{ color: "var(--gold-soft)" }}>PDF ↗</span>
              </div>
            </a>
          </article>
        </div>

        <style>{`
          @media (max-width: 760px) {
            .destacado-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </section>

      {/* Histórico */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">Archivo</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>Ediciones anteriores</div>
            </div>
            <div>
              <h2>Informes semanales recientes.</h2>
              <p className="dek">
                Lectura de cada cierre de mercado, con comentarios sobre los movimientos relevantes.
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
            {restantes.map((it, i) => (
              <li
                key={it.pdf}
                style={{
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                <a
                  href={it.pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="informe-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px 100px 1fr 80px",
                    gap: "var(--space-4)",
                    padding: "var(--space-4) 0",
                    alignItems: "baseline",
                    textDecoration: "none",
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontSize: 13, color: "var(--gold-deep)", letterSpacing: "0.06em" }}
                  >
                    {it.fechaTexto.split(",")[0]}
                  </span>
                  <span className="cap" style={{ color: "var(--ink-3)" }}>{it.categoria}</span>
                  <h3
                    className="serif"
                    style={{
                      fontWeight: 400,
                      fontSize: 20,
                      lineHeight: 1.2,
                      margin: 0,
                      letterSpacing: "-0.015em",
                      color: "var(--ink)",
                    }}
                  >
                    {it.titulo}
                  </h3>
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--ink-2)", letterSpacing: "0.08em", textAlign: "right" }}
                  >
                    PDF ↗
                  </span>
                </a>
                <style>{i === 0 ? `
                  .informe-row { transition: background 160ms ease; }
                  .informe-row:hover { background: var(--rule-soft); }
                  @media (max-width: 760px) {
                    .informe-row { grid-template-columns: 1fr auto !important; gap: var(--space-2) !important; }
                    .informe-row > .cap { display: none; }
                    .informe-row > h3 { grid-column: 1 / -1; }
                    .informe-row > .mono:last-child { grid-column: 2; }
                  }
                ` : ""}</style>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="section-navy">
        <div className="wrap" style={{ paddingTop: "var(--space-7)", paddingBottom: "var(--space-7)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)",
              gap: "var(--space-6)",
              alignItems: "end",
            }}
            className="informes-cta-grid"
          >
            <div>
              <div className="cap-gold-on-navy cap">Asesoramiento</div>
              <h2
                className="serif"
                style={{
                  fontStyle: "italic",
                  fontWeight: 300,
                  fontSize: "clamp(28px, 3.6vw, 44px)",
                  lineHeight: 1.1,
                  margin: "var(--space-3) 0 0",
                  color: "var(--gold-soft)",
                  letterSpacing: "-0.01em",
                  maxWidth: "20ch",
                }}
              >
                Las recomendaciones a medida no caben en un PDF.
              </h2>
            </div>
            <div>
              <p className="lede" style={{ color: "rgba(255,255,255,0.82)", margin: 0, maxWidth: "36em" }}>
                Los informes son una lectura general. Para tu cartera, hace falta una conversación. Agendá una reunión con un asesor de la casa.
              </p>
              <div style={{ display: "flex", gap: 12, marginTop: "var(--space-5)", flexWrap: "wrap" }}>
                <Link href="/contacto" className="btn btn-on-navy-primary">
                  Agendá una reunión <span className="arrow" />
                </Link>
                <Link href="/servicios" className="btn btn-on-navy-secondary">
                  Ver el ecosistema
                </Link>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .informes-cta-grid { grid-template-columns: 1fr !important; gap: var(--space-5) !important; }
          }
        `}</style>
      </section>
    </main>
  );
}
