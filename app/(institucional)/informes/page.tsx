import Link from "next/link";
import type { Metadata } from "next";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ArrowRight, Calendar, Clock } from "@/components/institucional/icons";
import { CarpetaInformes } from "@/components/institucional/CarpetaInformes";

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
    fecha: "2026-05-29",
    fechaTexto: "29 de mayo, 2026",
    titulo: "Informe semanal · 29 de mayo",
    categoria: "Semanal",
    pdf: "https://gbengochea.com.uy/img/informes/GB INFORME SEMANAL 29-05-2026.pdf",
  },
  {
    fecha: "2026-05-22",
    fechaTexto: "22 de mayo, 2026",
    titulo: "Informe semanal · 22 de mayo",
    categoria: "Semanal",
    pdf: "https://gbengochea.com.uy/img/informes/GB INFORME SEMANAL 22-05-2026.pdf",
  },
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

type Autor = {
  nombre: string;
  cadencia: string;
  tag: "Mensual" | "Semanal";
  foto: string;
  bio: string;
};

// NOTA: bios placeholder — reemplazar por la versión definitiva del cliente.
// Falta el retrato de Paula Bujia: dejar el archivo en public/equipo/paula-bujia.jpg
const AUTORES: Autor[] = [
  {
    nombre: "Paula Bujia",
    cadencia: "Informes mensuales",
    tag: "Mensual",
    // Sin retrato todavía: dejar el archivo en public/equipo/paula-bujia.jpg
    // y completar el path para que reemplace el placeholder.
    foto: "",
    bio:
      "Lidera el informe mensual: la visión macro internacional, la lectura de la renta fija uruguaya y el posicionamiento de cartera que ordena el mes en la mesa.",
  },
  {
    nombre: "Adrián Moreira",
    cadencia: "Informes semanales",
    tag: "Semanal",
    foto: "/equipo/adrian-moreira.jpeg",
    bio:
      "Desde la mesa de operaciones firma el informe semanal: el seguimiento de cada cierre de mercado y los movimientos relevantes de la semana en las plazas locales e internacionales.",
  },
];

export default function InformesPage() {
  const destacado = INFORMES[0];

  return (
    <main className="site">
      {/* Hero split — contenido + imagen */}
      <div className="hero-split">
        <Reveal as="div" className="hero-copy">
          <div className="kicker" style={{ color: "var(--gold-soft)" }}>
            Recomendaciones · Informes
          </div>
          <h1 className="t-display" style={{ marginTop: 20, color: "#fff" }}>
            Lectura semanal y mensual del mercado.
          </h1>
          <p className="t-lead" style={{ marginTop: 24, color: "rgba(255,255,255,0.86)" }}>
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
        <div className="hero-figure hero-figure--carpeta">
          <CarpetaInformes />
        </div>
      </div>

      {/* Cifras — cobertura editorial */}
      <section className="band-muted site-section-sm">
        <div className="site-wrap">
          <div className="cifras-row">
            <div className="cifra">
              <span className="cifra-num">Semanal</span>
              <span className="cifra-label">Lectura del cierre de cada semana</span>
            </div>
            <div className="cifra">
              <span className="cifra-num">Mensual</span>
              <span className="cifra-label">Visión macro y de cartera</span>
            </div>
            <div className="cifra">
              <span className="cifra-num">2</span>
              <span className="cifra-label">Autores que firman las ediciones</span>
            </div>
            <div className="cifra">
              <span className="cifra-num">PDF</span>
              <span className="cifra-label">Cada informe, libre para descarga</span>
            </div>
          </div>
        </div>
      </section>

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
                  <span style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <span className="list-icon" aria-hidden>
                      {it.categoria === "Mensual" ? <Calendar /> : <Clock />}
                    </span>
                    <span className="informe-main">
                      <span className="informe-meta">
                        <span className="t-small informe-fecha">{it.fechaTexto.split(",")[0]}</span>
                        <span className="ui-tag">{it.categoria}</span>
                      </span>
                      <span className="row-title" style={{ display: "block", marginTop: 8 }}>{it.titulo}</span>
                    </span>
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

      {/* Autores — quién firma cada informe */}
      <section className="band-muted site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Autores</div>
            <div>
              <h2 className="t-h2">Quién firma cada informe.</h2>
              <p className="t-lead" style={{ marginTop: 16, maxWidth: "38em" }}>
                Dos lecturas, dos plumas de la casa. El mensual ordena la visión macro y de cartera;
                el semanal sigue cada cierre de mercado.
              </p>
            </div>
          </Reveal>

          <Stagger as="div" className="autor-grid">
            {AUTORES.map((a) => (
              <StaggerItem as="div" key={a.nombre} className="autor">
                <div className={a.foto ? "autor-photo" : "autor-photo autor-photo--placeholder"}>
                  {a.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.foto} alt={a.nombre} loading="lazy" />
                  ) : (
                    <span className="autor-photo-fallback">{a.nombre}</span>
                  )}
                </div>
                <span className="autor-cadencia">{a.cadencia}</span>
                <h3 className="t-h3" style={{ marginTop: 12 }}>{a.nombre}</h3>
                <p className="t-body" style={{ marginTop: 18, marginBottom: 0, maxWidth: "34em" }}>{a.bio}</p>
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
        .hero-split .hero-figure.hero-figure--carpeta {
          background:
            radial-gradient(120% 90% at 60% 30%, #ffffff 0%, #f4f5f8 52%, #e9ebf1 100%);
        }
        .hero-figure--carpeta::after {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(58% 46% at 50% 62%, rgba(15,34,73,0.06), transparent 72%);
          pointer-events: none;
        }
        .autor-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: clamp(48px, 8vw, 120px);
          margin-top: clamp(56px, 7vw, 88px);
        }
        .autor { max-width: 38em; }
        .autor-photo {
          position: relative;
          width: 100%;
          max-width: 280px;
          aspect-ratio: 4 / 5;
          border-radius: 8px;
          overflow: hidden;
          background: var(--surface-muted);
          margin-bottom: clamp(24px, 2.6vw, 32px);
        }
        .autor-photo img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center top;
          filter: grayscale(1);
          transition: filter 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .autor:hover .autor-photo img { filter: grayscale(0); }
        .autor-photo--placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: #fff;
          border: 1px solid var(--site-border, rgba(15,34,73,0.12));
        }
        .autor-photo-fallback {
          font-size: clamp(15px, 1.5vw, 18px);
          font-weight: 600;
          letter-spacing: 0.01em;
          color: var(--ink-soft, rgba(15,34,73,0.55));
          text-align: center;
        }
        .autor-cadencia {
          display: block;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--gold-deep);
        }
        @media (prefers-reduced-motion: reduce) {
          .autor-photo img { transition: none; }
        }
        @media (max-width: 860px) {
          .autor-grid { grid-template-columns: 1fr; gap: clamp(48px, 12vw, 72px); }
        }
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
