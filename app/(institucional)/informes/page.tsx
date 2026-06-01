import Link from "next/link";
import type { Metadata } from "next";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";

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

const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export default function InformesPage() {
  const destacado = INFORMES[0];

  return (
    <main className="site">
      {/* Hero full-bleed */}
      <div className="hero-media">
        <div className="media-ph" aria-hidden />
        <div className="scrim" aria-hidden />
        <Reveal as="div" className="site-wrap hero-content">
          <div className="kicker" style={{ color: "var(--gold-soft)" }}>
            Recomendaciones · Informes
          </div>
          <h1 className="t-display" style={{ marginTop: 20, maxWidth: "16ch", color: "#fff" }}>
            Lectura semanal y mensual del mercado.
          </h1>
          <p className="t-lead" style={{ maxWidth: "42em", marginTop: 24, color: "rgba(255,255,255,0.86)" }}>
            Nuestros informes recogen la lectura de la mesa: macro internacional, renta fija uruguaya,
            equity global y las oportunidades de cada cierre de mercado.
          </p>
          <div style={{ marginTop: 32 }}>
            <a
              href={destacado.pdf}
              target="_blank"
              rel="noopener noreferrer"
              className="ui-btn ui-btn-on-navy"
            >
              Descargar último informe
            </a>
          </div>
        </Reveal>
      </div>

      {/* Archivo — lista de filas con hairlines */}
      <section className="band site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Archivo</div>
            <div>
              <h2 className="t-h2">Ediciones recientes.</h2>
              <p className="t-lead" style={{ marginTop: 16, maxWidth: "36em" }}>
                Lectura de cada cierre, con comentarios sobre los movimientos relevantes de la semana
                y del mes. Disponibles para descarga en PDF.
              </p>
            </div>
          </Reveal>

          <Stagger as="div" className="ui-list" style={{ marginTop: 56 }}>
            {INFORMES.map((it) => (
              <StaggerItem as="div" key={it.pdf}>
                <a
                  href={it.pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ui-list-row informe-row"
                >
                  <span className="informe-main">
                    <span className="informe-meta">
                      <span className="t-small informe-fecha">{it.fechaTexto.split(",")[0]}</span>
                      <span className="ui-tag">{it.categoria}</span>
                    </span>
                    <span className="row-title" style={{ display: "block", marginTop: 8 }}>{it.titulo}</span>
                  </span>
                  <span className="link-arrow informe-cta">
                    Descargar PDF <ArrowRight />
                  </span>
                </a>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* CTA — banda navy */}
      <section className="band-navy site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Asesoramiento</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "16em" }}>
                Las recomendaciones a medida no caben en un PDF.
              </h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "38em" }}>
                Los informes son una lectura general. Para tu cartera, hace falta una conversación.
                Agendá una reunión con un asesor de la casa.
              </p>
              <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
                <Link href="/contacto" className="ui-btn ui-btn-on-navy">
                  Agendá una reunión
                </Link>
                <Link href="/servicios" className="ui-btn ui-btn-on-navy-ghost">
                  Ver el ecosistema
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <style>{`
        .informe-meta { display: inline-flex; align-items: center; gap: 14px; }
        .informe-fecha { font-weight: 600; color: var(--gold-deep); letter-spacing: 0.02em; }
        .informe-cta { pointer-events: none; flex: none; }
        @media (max-width: 640px) {
          .informe-row { flex-direction: column; align-items: flex-start; gap: 14px; }
        }
      `}</style>
    </main>
  );
}
