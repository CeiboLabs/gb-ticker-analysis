import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { Columns, Globe, Scales, Lock, Waveform, Compass, Handshake, Users, Rocket } from "@/components/institucional/icons";

export const metadata: Metadata = {
  title: "Nosotros · Bengochea & Cía.",
  description:
    "Sociedad de Bolsa uruguaya desde 1967. Misión, visión y valores de Gastón Bengochea CB.",
};

const VALORES: { icon: ReactNode; text: string }[] = [
  { icon: <Handshake />, text: "El cliente inversor siempre primero." },
  { icon: <Users />, text: "Promovemos el trabajo en equipo." },
  { icon: <Waveform />, text: "Valoramos las habilidades blandas: liderazgo, comunicación, flexibilidad y motivación." },
  { icon: <Compass />, text: "Fomentamos la capacitación permanente como herramienta de crecimiento profesional." },
  { icon: <Globe />, text: "Apoyamos la educación financiera y las acciones de defensa del inversor." },
  { icon: <Rocket />, text: "Proactivos y creativos para adaptarnos a los desafíos." },
];

const PILARES: { icon: ReactNode; title: string; body: string }[] = [
  { icon: <Columns />, title: "Presencia y experiencia", body: "Casi seis décadas gestionando patrimonios de uruguayos y extranjeros. Miembros de la Bolsa de Valores de Montevideo desde 1967." },
  { icon: <Globe />, title: "Una mirada global", body: "Somos locales pero con foco global. Invertimos en el mundo desde Uruguay." },
  { icon: <Scales />, title: "Regulación", body: "Compañía regulada por el Banco Central del Uruguay y miembros activos de la BVM." },
  { icon: <Lock />, title: "Seguridad", body: "Cuentas segregadas: el cliente es el propietario legal de los activos en su cuenta." },
  { icon: <Waveform />, title: "Escucha activa", body: "Proponemos una cartera individual alineada a los objetivos de cada inversor." },
  { icon: <Compass />, title: "Dedicación", body: "Explicamos el funcionamiento del mercado y de cada activo que forma parte de tu cartera." },
  { icon: <Handshake />, title: "Somos tu aliado", body: "No exigimos mínimos para abrir cuenta. El tiempo es tu mejor aliado; nosotros también." },
];

const CIFRAS: [string, string][] = [
  ["1967", "Miembros de la Bolsa de Valores de Montevideo"],
  ["~6 décadas", "Administrando inversiones de nuestros clientes"],
  ["8", "Plazas locales e internacionales"],
  ["BCU", "Regulados por el Banco Central del Uruguay"],
];

export default function NosotrosPage() {
  return (
    <main className="site">
      {/* Hero split — contenido + imagen */}
      <div className="hero-split">
        <Reveal className="hero-copy">
          <div className="kicker" style={{ color: "var(--gold-soft)" }}>
            La casa · Nosotros
          </div>
          <h1 className="t-display" style={{ marginTop: 20, color: "#fff" }}>
            La excelencia hace la diferencia.
          </h1>
          <p className="t-lead" style={{ marginTop: 24, color: "rgba(255,255,255,0.86)" }}>
            Creemos en las relaciones basadas en la confianza mutua y el profesionalismo. Un servicio
            construido sobre altos estándares de gestión, sostenido por casi seis décadas en la plaza uruguaya.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
            <Link href="/contacto" className="ui-btn ui-btn-on-navy">Agendá una reunión</Link>
            <Link href="/historia" className="ui-btn ui-btn-on-navy-ghost">Nuestra historia</Link>
          </div>
        </Reveal>
        <div className="hero-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero/nosotros.jpg" alt="Fachada de vidrio de un edificio corporativo" />
        </div>
      </div>

      {/* Premisa — declaración */}
      <section className="band site-section">
        <div className="site-wrap">
          <Reveal className="split-label">
            <div className="eyebrow-sm">Premisa</div>
            <div>
              <p className="t-h2" style={{ maxWidth: "18em" }}>
                Asumimos con responsabilidad la administración profesional de tus inversiones.
                La confianza de cada cliente siempre fue nuestro norte.
              </p>
            </div>
          </Reveal>

          <Stagger className="cifras-row" as="div">
            {CIFRAS.map(([num, label]) => (
              <StaggerItem key={label} className="cifra" as="div">
                <span className="cifra-num">{num}</span>
                <span className="cifra-label">{label}</span>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Misión & Visión — split de dos columnas, sin cards */}
      <section className="band-muted site-section">
        <div className="site-wrap">
          <Reveal className="split-label">
            <div className="eyebrow-sm">Misión y visión</div>
            <div>
              <h2 className="t-h2">Acompañar al inversor uruguayo, dentro y fuera de fronteras.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                Dos definiciones que ordenan la práctica de todos los días.
              </p>
            </div>
          </Reveal>

          <Stagger className="mv-grid" as="div">
            <StaggerItem className="mv-item" as="div">
              <div className="eyebrow-sm">Misión</div>
              <p className="t-body" style={{ marginTop: 14, marginBottom: 0 }}>
                Entregar a nuestros clientes asesoramiento profesional e independiente en inversiones
                financieras, de acuerdo a los objetivos definidos por el inversor y cumpliendo con altos
                estándares de ética y conducta profesional.
              </p>
              <p className="t-body" style={{ marginTop: 16, marginBottom: 0 }}>
                Democratizar las inversiones financieras en Uruguay, brindando y promoviendo el acceso al
                mercado al gran público.
              </p>
            </StaggerItem>
            <StaggerItem className="mv-item" as="div">
              <div className="eyebrow-sm">Visión</div>
              <p className="t-body" style={{ marginTop: 14, marginBottom: 0 }}>
                Construir y sostener liderazgo en el mercado a partir de la innovación centrada en el cliente
                y de la adaptabilidad a cambios de contexto.
              </p>
              <p className="t-body" style={{ marginTop: 16, marginBottom: 0 }}>
                Generar relaciones de largo plazo con clientes, colaboradores y proveedores basadas en la
                confianza y el profesionalismo.
              </p>
            </StaggerItem>
          </Stagger>
        </div>
      </section>

      {/* Valores — lista de filas hairline */}
      <section className="band site-section">
        <div className="site-wrap">
          <div className="split">
            <Reveal>
              <div className="eyebrow-sm">Valores</div>
              <h2 className="t-h2" style={{ marginTop: 16 }}>Seis principios que ordenan la casa.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "30em" }}>
                Lo que sostiene la convivencia interna y la relación con cada cliente.
              </p>
            </Reveal>

            <Stagger className="ui-list" as="div">
              {VALORES.map(({ icon, text }) => (
                <StaggerItem key={text} className="ui-list-row" as="div">
                  <span style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <span className="list-icon" aria-hidden>{icon}</span>
                    <span className="row-title" style={{ fontSize: "clamp(18px, 1.8vw, 22px)" }}>{text}</span>
                  </span>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      {/* Pilares — banda navy full-width, hairline-grid */}
      <section className="band-navy site-section">
        <div className="site-wrap">
          <Reveal className="split-label">
            <div className="eyebrow-sm">Por qué GB</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "14em" }}>Siete pilares, una sola promesa.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                Casi seis décadas de confianza. Estos son los atributos sobre los que se construyó la relación
                con cada cliente.
              </p>
            </div>
          </Reveal>

          <Stagger className="pilar-grid" as="div">
            {PILARES.map(({ icon, title, body }) => (
              <StaggerItem key={title} className="pilar-item" as="div">
                <span className="feat-icon" aria-hidden>{icon}</span>
                <h3 className="t-h4">{title}</h3>
                <p className="t-small" style={{ marginTop: 12, marginBottom: 0 }}>{body}</p>
              </StaggerItem>
            ))}
          </Stagger>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 48 }}>
            <Link href="/historia" className="ui-btn ui-btn-on-navy-ghost">Nuestra historia</Link>
            <Link href="/contacto" className="ui-btn ui-btn-on-navy">Agendá una reunión</Link>
          </div>
        </div>
      </section>

      <style>{`
        .mv-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
          margin-top: 56px;
          border-top: 1px solid var(--site-border);
        }
        .mv-item {
          padding: 36px 48px 36px 0;
          border-bottom: 1px solid var(--site-border);
          border-right: 1px solid var(--site-border);
        }
        .mv-item:nth-child(2n) { border-right: 0; padding-right: 0; padding-left: 48px; }
        .pilar-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
          margin-top: 56px;
          border-top: 1px solid rgba(255,255,255,0.16);
          border-left: 1px solid rgba(255,255,255,0.16);
        }
        .pilar-item {
          padding: 32px 28px;
          border-right: 1px solid rgba(255,255,255,0.16);
          border-bottom: 1px solid rgba(255,255,255,0.16);
        }
        @media (max-width: 980px) {
          .pilar-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 760px) {
          .mv-grid { grid-template-columns: 1fr; }
          .mv-item, .mv-item:nth-child(2n) {
            border-right: 0;
            padding: 32px 0;
            padding-left: 0;
          }
        }
        @media (max-width: 560px) {
          .pilar-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}
