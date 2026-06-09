import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ArrowRight, Certificate, Shield, Layers, Clock, Building, Globe, TrendingUp, Flow, Lock } from "@/components/institucional/icons";

export const metadata: Metadata = {
  title: "Ecosistema · Bengochea & Cía.",
  description:
    "Mercado local e internacional: bonos globales uruguayos, Notas en UI, fideicomisos, LRM, ON, acciones globales, fondos y derivados.",
};

const LOCAL: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: <Certificate />,
    title: "Bonos Globales uruguayos",
    body: "Operativa en bonos globales soberanos denominados en dólares y pesos uruguayos. Mercado primario y secundario.",
  },
  {
    icon: <Shield />,
    title: "Notas del Tesoro en UI",
    body: "Mercado primario y secundario en Notas del Tesoro emitidas en Unidades Indexadas, instrumento de cobertura de inflación.",
  },
  {
    icon: <Layers />,
    title: "Fideicomisos Financieros",
    body: "Vehículos de inversión para el financiamiento privado y de obras de infraestructura, bajo estructura fiduciaria local.",
  },
  {
    icon: <Clock />,
    title: "Letras de Regulación Monetaria",
    body: "Mercado primario y secundario de LRM en pesos. Instrumento de corto plazo para la gestión de liquidez.",
  },
  {
    icon: <Building />,
    title: "Obligaciones Negociables",
    body: "Deuda corporativa emitida bajo jurisdicción local, con regulación del Banco Central del Uruguay.",
  },
];

const INTERNACIONAL: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: <Globe />,
    title: "Bonos soberanos y corporativos",
    body: "Renta fija global: tesoros nacionales, investment-grade y high-yield, con análisis crediticio y monitoreo de duration.",
  },
  {
    icon: <TrendingUp />,
    title: "Acciones comunes y preferidas",
    body: "Acciones listadas en Estados Unidos y otros mercados, operadas desde la mesa local.",
  },
  {
    icon: <Layers />,
    title: "Fondos de Inversión",
    body: "Vehículos gestionados por managers globales seleccionados: renta fija, equity, multi-asset y alternativos.",
  },
  {
    icon: <Flow />,
    title: "Instrumentos derivados",
    body: "Cobertura y exposición direccional según el mandato del cliente. Definidos a medida.",
  },
  {
    icon: <Lock />,
    title: "Apertura de cuenta internacional",
    body: "Cuenta en el exterior a nombre del cliente, con custodia segregada y reporting consolidado.",
  },
];

const CIFRAS: [string, string][] = [
  ["10", "Instrumentos entre plaza local e internacional"],
  ["2", "Mercados: plaza local e internacional"],
  ["Global", "Acceso a los mercados del mundo desde Uruguay"],
  ["1", "Una sola mesa, local y global"],
];

const PROCESO: [string, string, string][] = [
  ["01", "Escuchamos al cliente", "Una reunión sin compromiso para entender objetivos, restricciones y horizonte."],
  ["02", "Entendemos las necesidades", "Traducimos los objetivos a parámetros concretos: liquidez, riesgo asumible, plazo y moneda."],
  ["03", "Diseñamos la propuesta", "Asignación discutida en la mesa, escrita en términos verificables. El cliente sabe qué se compra y por qué."],
  ["04", "Proyectamos rendimientos", "Estimaciones razonadas para cada componente de la cartera. Sin promesas."],
  ["05", "Ejecutamos con eficiencia", "Operativa multi-mercado con cuenta a nombre del cliente. Custodia regulada."],
  ["06", "Administramos con rigurosidad", "Reporting periódico, conciliación y disponibilidad permanente de la mesa."],
  ["07", "Seguimiento y revisión", "Revisión continua ex-post. Reajustes ante cambios de contexto o de objetivos."],
];

/* Instrumentos reales del ecosistema (gbengochea.com.uy/ecosistema.php) */
const INSTRUMENTOS_GRID = [
  ["Bonos globales", "Uruguay · USD y pesos"],
  ["Notas en UI", "Tesoro · Uruguay"],
  ["Letras LRM", "BCU · Uruguay"],
  ["ONs y fideicomisos", "Uruguay"],
  ["Bonos soberanos", "Mercado internacional"],
  ["Bonos corporativos", "Mercado internacional"],
  ["Acciones", "EE. UU. y otros mercados"],
  ["Fondos y derivados", "Mercado internacional"],
];

export default function ServiciosPage() {
  return (
    <main className="site">
      {/* Hero split — contenido + imagen */}
      <div className="hero-split">
        <Reveal as="div" className="hero-copy">
          <div className="kicker" style={{ color: "var(--gold-soft)" }}>Ecosistema</div>

          <h1 className="t-display" style={{ marginTop: 20, color: "#fff" }}>
            Locales, con foco global.
          </h1>

          <p className="t-lead" style={{ marginTop: 24, color: "rgba(255,255,255,0.86)" }}>
            En GB abrimos las puertas a nuestro amplio ecosistema financiero. Operativa en la plaza uruguaya
            y acceso directo a las principales bolsas globales, desde una sola mesa.
          </p>

          <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
            <Link href="/contacto" className="ui-btn ui-btn-on-navy">Agendá una reunión</Link>
            <a href="#local" className="ui-btn ui-btn-on-navy-ghost">Ver el ecosistema</a>
          </div>
        </Reveal>
        <div className="hero-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero/servicios.jpg" alt="Distrito financiero al atardecer" />
        </div>
      </div>

      {/* Mercado Local — split: intro a la izquierda, lista de filas a la derecha */}
      <section id="local" className="band site-section">
        <div className="site-wrap">
          <div className="split">
            <div className="split-intro-sticky">
              <Reveal as="div">
                <div className="eyebrow-sm">Mercado Local</div>
                <h2 className="t-h2" style={{ marginTop: 16 }}>Operativa en la plaza uruguaya.</h2>
                <p className="t-lead" style={{ marginTop: 20, maxWidth: "32em" }}>
                  Cinco instrumentos del mercado local. Mercado primario y secundario con regulación BCU.
                </p>
              </Reveal>
            </div>

            <Reveal as="div" className="ui-list">
              {LOCAL.map((it) => (
                <div key={it.title} className="ui-list-row">
                  <span style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <span className="list-icon" aria-hidden>{it.icon}</span>
                    <span>
                      <span className="row-title">{it.title}</span>
                      <span className="row-desc" style={{ display: "block" }}>{it.body}</span>
                    </span>
                  </span>
                </div>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      {/* Mercado Internacional — split */}
      <section id="internacional" className="band-muted site-section">
        <div className="site-wrap">
          <div className="split">
            <div className="split-intro-sticky">
              <Reveal as="div">
                <div className="eyebrow-sm">Mercado Internacional</div>
                <h2 className="t-h2" style={{ marginTop: 16 }}>Acceso directo a las bolsas globales.</h2>
                <p className="t-lead" style={{ marginTop: 20, maxWidth: "32em" }}>
                  Renta fija, renta variable, fondos y derivados, con custodia internacional regulada.
                </p>
              </Reveal>
            </div>

            <Reveal as="div" className="ui-list">
              {INTERNACIONAL.map((it) => (
                <div key={it.title} className="ui-list-row">
                  <span style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <span className="list-icon" aria-hidden>{it.icon}</span>
                    <span>
                      <span className="row-title">{it.title}</span>
                      <span className="row-desc" style={{ display: "block" }}>{it.body}</span>
                    </span>
                  </span>
                </div>
              ))}
            </Reveal>
          </div>

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

      {/* Proceso — split-label + lista de filas con número */}
      <section id="proceso" className="band-navy site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Proceso</div>
            <div>
              <h2 className="t-h2">Siete pasos, una sola lógica.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                Así trabajamos con cada nuevo inversor. Lo que se hace antes, durante y después de la primera operación.
              </p>
            </div>
          </Reveal>

          <div className="ui-list" style={{ marginTop: 48 }}>
            {PROCESO.map(([n, title, body]) => (
              <div key={n} className="ui-list-row">
                <span style={{ display: "flex", gap: 28, alignItems: "baseline" }}>
                  <span className="proc-num">{n}</span>
                  <span>
                    <span className="row-title">{title}</span>
                    <span className="row-desc" style={{ display: "block" }}>{body}</span>
                  </span>
                </span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 40 }}>
            <Link href="/contacto" className="link-arrow">
              Empezar la conversación <ArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {/* Plazas — hairline-grid navy */}
      <section id="plazas" className="band-navy site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Mercados</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "14em" }}>Dos mercados, una sola mesa.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                Operativa en la plaza local y en el mercado internacional, desde una misma mesa.
              </p>
            </div>
          </Reveal>

          <Stagger as="div" className="plazas-grid">
            {INSTRUMENTOS_GRID.map((m) => (
              <StaggerItem key={m[0]} as="div" className="plaza-cell">
                <div className="plaza-name">{m[0]}</div>
                <div className="plaza-loc">{m[1]}</div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <style>{`
        .split-intro-sticky {
          position: sticky;
          top: calc(var(--nav-h) + 24px);
          align-self: start;
        }
        .proc-num {
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--gold-soft);
          flex: none;
          padding-top: 8px;
        }
        .plazas-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          margin-top: 56px;
          border-top: 1px solid rgba(255,255,255,0.16);
          border-left: 1px solid rgba(255,255,255,0.16);
        }
        .plaza-cell {
          padding: 28px 24px;
          border-right: 1px solid rgba(255,255,255,0.16);
          border-bottom: 1px solid rgba(255,255,255,0.16);
        }
        .plaza-name {
          font-size: 24px;
          font-weight: 400;
          letter-spacing: -0.015em;
          color: #fff;
        }
        .plaza-loc {
          font-size: 14px;
          color: rgba(255,255,255,0.6);
          margin-top: 6px;
        }
        @media (max-width: 900px) {
          .plazas-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 560px) {
          .plazas-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </main>
  );
}
