import Link from "next/link";
import type { Metadata } from "next";

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

const PROCESO = [
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

export default function ServiciosPage() {
  return (
    <main>
      {/* Hero */}
      <section className="section-navy" style={{ position: "relative", overflow: "hidden" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(50% 70% at 80% 0%, rgba(201,168,76,0.08), transparent 60%)",
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
            <span className="cap" style={{ color: "rgba(255,255,255,0.55)" }}>Ecosistema</span>
            <span className="cap mono" style={{ color: "rgba(255,255,255,0.55)" }}>Catálogo · 2026</span>
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
            Una puerta local al mercado{" "}
            <em style={{ fontStyle: "italic", color: "var(--gold-soft)", fontWeight: 300 }}>
              internacional.
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
            En GB abrimos las puertas a nuestro amplio ecosistema financiero. Operativa en la plaza uruguaya y acceso directo a las principales bolsas globales, desde una sola mesa.
          </p>

          {/* Index */}
          <nav
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 24,
              marginTop: "var(--space-6)",
              paddingTop: "var(--space-4)",
              borderTop: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            {[
              ["01", "Mercado Local", "#local"],
              ["02", "Mercado Internacional", "#internacional"],
              ["03", "Proceso", "#proceso"],
              ["04", "Plazas", "#plazas"],
            ].map(([num, label, href]) => (
              <a
                key={href}
                href={href}
                className="mono"
                style={{
                  fontSize: 11.5,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.65)",
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 8,
                }}
              >
                <span style={{ color: "var(--gold-soft)" }}>{num}</span>
                {label}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* 01 · Mercado Local */}
      <section id="local" className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">01 / 04</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>Mercado Local</div>
            </div>
            <div>
              <h2>Operativa en la plaza uruguaya.</h2>
              <p className="dek">
                Cinco instrumentos del mercado local. Mercado primario y secundario con regulación BCU.
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
            {LOCAL.map((it, i) => (
              <li
                key={it.title}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px minmax(220px, 280px) 1fr",
                  gap: "var(--space-5)",
                  padding: "var(--space-4) 0",
                  borderBottom: "1px solid var(--rule)",
                  alignItems: "baseline",
                }}
                className="instrument-row"
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 13,
                    letterSpacing: "0.08em",
                    color: "var(--gold-deep)",
                  }}
                >
                  L · {String(i + 1).padStart(2, "0")}
                </span>
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
                  {it.title}
                </h3>
                <p className="body-base" style={{ margin: 0, maxWidth: "44em" }}>{it.body}</p>
              </li>
            ))}
          </ol>
        </div>

        <style>{`
          @media (max-width: 760px) {
            .instrument-row { grid-template-columns: 50px 1fr !important; }
            .instrument-row > p { grid-column: 2; }
          }
          @media (max-width: 480px) {
            .instrument-row { grid-template-columns: 1fr !important; gap: 6px !important; }
            .instrument-row > p { grid-column: 1; }
          }
        `}</style>
      </section>

      {/* 02 · Mercado Internacional */}
      <section id="internacional" className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">02 / 04</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>Mercado Internacional</div>
            </div>
            <div>
              <h2>Acceso directo a las bolsas globales.</h2>
              <p className="dek">
                Renta fija, renta variable, fondos y derivados, con custodia internacional regulada.
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
            {INTERNACIONAL.map((it, i) => (
              <li
                key={it.title}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px minmax(220px, 320px) 1fr",
                  gap: "var(--space-5)",
                  padding: "var(--space-4) 0",
                  borderBottom: "1px solid var(--rule)",
                  alignItems: "baseline",
                }}
                className="instrument-row"
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 13,
                    letterSpacing: "0.08em",
                    color: "var(--gold-deep)",
                  }}
                >
                  I · {String(i + 1).padStart(2, "0")}
                </span>
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
                  {it.title}
                </h3>
                <p className="body-base" style={{ margin: 0, maxWidth: "44em" }}>{it.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 03 · Proceso */}
      <section id="proceso" className="section-navy">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">03 / 04</div>
              <div className="cap-gold-on-navy cap" style={{ marginTop: 8 }}>Proceso</div>
            </div>
            <div>
              <h2 style={{ color: "var(--ivory)" }}>
                Siete pasos,{" "}
                <em className="serif-i" style={{ color: "var(--gold-soft)", fontWeight: 300 }}>
                  una sola lógica.
                </em>
              </h2>
              <p className="dek" style={{ color: "rgba(255,255,255,0.78)" }}>
                Así trabajamos con cada nuevo inversor. Lo que se hace antes, durante y después de la primera operación.
              </p>
            </div>
          </div>

          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              borderTop: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            {PROCESO.map(([n, title, body]) => (
              <li
                key={n}
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px minmax(220px, 320px) 1fr",
                  gap: "var(--space-5)",
                  padding: "var(--space-4) 0",
                  borderBottom: "1px solid rgba(255,255,255,0.18)",
                  alignItems: "baseline",
                }}
                className="proceso-row"
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 14,
                    letterSpacing: "0.08em",
                    color: "var(--gold-soft)",
                  }}
                >
                  {n}
                </span>
                <h3
                  className="serif"
                  style={{
                    color: "var(--ivory)",
                    fontWeight: 400,
                    fontSize: 22,
                    lineHeight: 1.2,
                    margin: 0,
                    letterSpacing: "-0.015em",
                  }}
                >
                  {title}
                </h3>
                <p className="body-base" style={{ color: "rgba(255,255,255,0.78)", margin: 0, maxWidth: "42em" }}>
                  {body}
                </p>
              </li>
            ))}
          </ol>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-5)" }}>
            <Link href="/contacto" className="btn btn-on-navy-primary">
              Empezar la conversación <span className="arrow" />
            </Link>
          </div>
        </div>

        <style>{`
          @media (max-width: 760px) {
            .proceso-row { grid-template-columns: 80px 1fr !important; }
            .proceso-row > p { grid-column: 2; }
          }
          @media (max-width: 480px) {
            .proceso-row { grid-template-columns: 1fr !important; gap: 6px !important; }
            .proceso-row > p { grid-column: 1; }
          }
        `}</style>
      </section>

      {/* 04 · Plazas */}
      <section id="plazas" className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">04 / 04</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>Plazas</div>
            </div>
            <div>
              <h2>Ocho mercados, una sola mesa.</h2>
              <p className="dek">
                Operativa con ejecución directa en las principales bolsas globales y en la plaza local.
              </p>
            </div>
          </div>

          <div
            className="plazas-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              borderTop: "1px solid var(--ink)",
              borderLeft: "1px solid var(--rule)",
            }}
          >
            {PLAZAS.map((m) => (
              <div
                key={m[0]}
                style={{
                  padding: "var(--space-4) var(--space-4)",
                  borderRight: "1px solid var(--rule)",
                  borderBottom: "1px solid var(--rule)",
                  background: "var(--paper)",
                }}
              >
                <div
                  className="mono"
                  style={{
                    color: "var(--gold-deep)",
                    fontSize: 18,
                    letterSpacing: "0.02em",
                    marginBottom: 6,
                  }}
                >
                  {m[0]}
                </div>
                <div className="cap" style={{ color: "var(--ink-3)" }}>
                  {m[1]}
                </div>
              </div>
            ))}
          </div>
        </div>

        <style>{`
          @media (max-width: 720px) {
            .plazas-grid { grid-template-columns: repeat(2, 1fr) !important; }
          }
          @media (max-width: 420px) {
            .plazas-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </section>
    </main>
  );
}
