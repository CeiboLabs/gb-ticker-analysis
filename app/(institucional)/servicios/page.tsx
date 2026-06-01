import Link from "next/link";
import type { Metadata } from "next";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";

export const metadata: Metadata = {
  title: "Ecosistema · Bengochea & Cía.",
  description:
    "Mercado local e internacional: bonos globales uruguayos, Notas en UI, fideicomisos, LRM, ON, acciones globales, fondos y derivados.",
};

const LOCAL = [
  {
    title: "Bonos Globales uruguayos",
    body: "Operativa en bonos globales soberanos denominados en dólares y pesos uruguayos. Mercado primario y secundario.",
  },
  {
    title: "Notas del Tesoro en UI",
    body: "Mercado primario y secundario en Notas del Tesoro emitidas en Unidades Indexadas, instrumento de cobertura de inflación.",
  },
  {
    title: "Fideicomisos Financieros",
    body: "Vehículos de inversión para el financiamiento privado y de obras de infraestructura, bajo estructura fiduciaria local.",
  },
  {
    title: "Letras de Regulación Monetaria",
    body: "Mercado primario y secundario de LRM en pesos. Instrumento de corto plazo para la gestión de liquidez.",
  },
  {
    title: "Obligaciones Negociables",
    body: "Deuda corporativa emitida bajo jurisdicción local, con regulación del Banco Central del Uruguay.",
  },
];

const INTERNACIONAL = [
  {
    title: "Bonos soberanos y corporativos",
    body: "Renta fija global: tesoros nacionales, investment-grade y high-yield, con análisis crediticio y monitoreo de duration.",
  },
  {
    title: "Acciones comunes y preferidas",
    body: "Acceso a NYSE, NASDAQ, LSE, Euronext, XETRA y plazas regionales (BVM, BYMA, B3).",
  },
  {
    title: "Fondos de Inversión",
    body: "Vehículos gestionados por managers globales seleccionados: renta fija, equity, multi-asset y alternativos.",
  },
  {
    title: "Instrumentos derivados",
    body: "Cobertura y exposición direccional según el mandato del cliente. Definidos a medida.",
  },
  {
    title: "Apertura de cuenta internacional",
    body: "Cuenta segregada con counterparties globales (Bank of New York, Clearstream). Reporting consolidado.",
  },
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

const PLAZAS = [
  ["NYSE", "Estados Unidos"],
  ["NASDAQ", "Estados Unidos"],
  ["LSE", "Reino Unido"],
  ["Euronext", "Europa"],
  ["XETRA", "Alemania"],
  ["BVM", "Uruguay"],
  ["BYMA", "Argentina"],
  ["B3", "Brasil"],
];

const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export default function ServiciosPage() {
  return (
    <main className="site">
      {/* Hero full-bleed */}
      <div className="hero-media">
        {/* Placeholder sobrio — reemplazable por <img className="media-fill" src=... alt="" /> */}
        <div className="media-ph" aria-hidden />
        <div className="scrim" aria-hidden />

        <Reveal as="div" className="site-wrap hero-content">
          <div className="kicker" style={{ color: "var(--gold-soft)" }}>Ecosistema</div>

          <h1 className="t-display" style={{ marginTop: 20, maxWidth: "16ch", color: "#fff" }}>
            Una puerta local al mercado internacional.
          </h1>

          <p className="t-lead" style={{ maxWidth: "42em", marginTop: 24, color: "rgba(255,255,255,0.86)" }}>
            En GB abrimos las puertas a nuestro amplio ecosistema financiero. Operativa en la plaza uruguaya
            y acceso directo a las principales bolsas globales, desde una sola mesa.
          </p>

          <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
            <Link href="/contacto" className="ui-btn ui-btn-on-navy">Agendá una reunión</Link>
            <a href="#local" className="ui-btn ui-btn-on-navy-ghost">Ver el ecosistema</a>
          </div>
        </Reveal>
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
                  <span>
                    <span className="row-title">{it.title}</span>
                    <span className="row-desc" style={{ display: "block" }}>{it.body}</span>
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
                  <span>
                    <span className="row-title">{it.title}</span>
                    <span className="row-desc" style={{ display: "block" }}>{it.body}</span>
                  </span>
                </div>
              ))}
            </Reveal>
          </div>
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
            <div className="eyebrow-sm">Plazas</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "14em" }}>Ocho mercados, una sola mesa.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                Operativa con ejecución directa en las principales bolsas globales y en la plaza local.
              </p>
            </div>
          </Reveal>

          <Stagger as="div" className="plazas-grid">
            {PLAZAS.map((m) => (
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
