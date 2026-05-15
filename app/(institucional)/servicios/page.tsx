import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Servicios · Bengochea & Cía.",
  description:
    "Renta fija, renta variable, fondos, ETFs y productos estructurados. Acceso a NYSE, NASDAQ, LSE, Euronext, XETRA, BVM, BYMA y B3.",
};

const FAMILIAS = [
  {
    id: "bonos",
    title: "Renta fija",
    bajada:
      "Soberanos, sub-soberanos y corporativos, en USD, EUR y monedas locales. Para inversores que priorizan flujo de cupón previsible y horizonte definido.",
    items: [
      ["Bonos soberanos", "Emisiones de tesoros nacionales (US Treasuries, soberanos de la región y de Europa)."],
      ["Bonos corporativos", "Investment-grade y high-yield, con análisis crediticio y monitoreo activo de duration."],
      ["Letras de regulación monetaria", "Instrumento local de corto plazo para gestión de liquidez en pesos."],
      ["Obligaciones negociables", "Emisiones del mercado local con regulación BCU."],
    ],
  },
  {
    id: "acciones",
    title: "Renta variable",
    bajada:
      "Acceso a las principales bolsas globales y a la plaza local. Ejecución directa, custodia internacional regulada y gestión de FX.",
    items: [
      ["Acciones EE.UU.", "NYSE y NASDAQ. Universo completo de large, mid y small caps."],
      ["Acciones europeas", "LSE, Euronext y XETRA. Acceso al mercado en euros y libras."],
      ["Acciones región", "BVM, BYMA y B3. Operativa local con liquidación habitual."],
      ["ETFs", "Universo amplio de ETFs temáticos, sectoriales y de índice. Replica eficiente del benchmark con costo bajo."],
    ],
  },
  {
    id: "fondos",
    title: "Fondos y estructurados",
    bajada:
      "Vehículos gestionados por terceros seleccionados y productos estructurados a medida. Para diversificar fuera de la operativa directa.",
    items: [
      ["Fondos de inversión", "Acceso a managers globales (renta fija, equity, multi-asset, alternativos)."],
      ["Productos estructurados", "Notas con capital protegido o con apalancamiento controlado, definidas a medida."],
      ["Carteras gestionadas", "Mandatos discrecionales bajo lineamientos acordados con el cliente."],
      ["Custodia institucional", "Bóveda regulada y reporting consolidado para patrimonios complejos."],
    ],
  },
];

const PROCESO = [
  ["01", "Conversación inicial", "Una reunión sin compromiso para entender el horizonte, las restricciones y los objetivos del inversor."],
  ["02", "Diseño de cartera", "Asignación discutida en la mesa, escrita en términos verificables. El cliente sabe qué se compra y por qué."],
  ["03", "Ejecución y custodia", "Operativa multi-mercado con cuenta a nombre del cliente. Reporting periódico y disponibilidad de la mesa."],
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
            <span className="cap" style={{ color: "rgba(255,255,255,0.55)" }}>Servicios</span>
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
            Tres familias de instrumentos,{" "}
            <em style={{ fontStyle: "italic", color: "var(--gold-soft)", fontWeight: 300 }}>
              una sola mesa.
            </em>
          </h1>

          <p
            className="lede"
            style={{
              maxWidth: "40em",
              color: "rgba(255,255,255,0.82)",
              marginTop: "var(--space-5)",
            }}
          >
            Renta fija, renta variable y vehículos gestionados. La asignación se discute con el cliente; la operativa multi-mercado la corre la casa.
          </p>
        </div>
      </section>

      {/* Familias */}
      {FAMILIAS.map((fam, idx) => (
        <section key={fam.id} id={fam.id} className="section">
          <div className="wrap">
            <div className="sec-head">
              <div>
                <div className="sec-num">{String(idx + 1).padStart(2, "0")} / 04</div>
                <div className="cap-gold" style={{ marginTop: 8 }}>{fam.title}</div>
              </div>
              <div>
                <h2>{fam.title}.</h2>
                <p className="dek">{fam.bajada}</p>
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
              {fam.items.map(([title, body]) => (
                <li
                  key={title}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(180px, 240px) 1fr",
                    gap: "var(--space-5)",
                    padding: "var(--space-4) 0",
                    borderBottom: "1px solid var(--rule)",
                    alignItems: "baseline",
                  }}
                  className="instrument-row"
                >
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
                    {title}
                  </h3>
                  <p className="body-base" style={{ margin: 0 }}>{body}</p>
                </li>
              ))}
            </ol>
          </div>

          <style>{`
            @media (max-width: 640px) {
              .instrument-row { grid-template-columns: 1fr !important; gap: 6px !important; }
            }
          `}</style>
        </section>
      ))}

      {/* 04 · Proceso */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">04 / 04</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>Proceso</div>
            </div>
            <div>
              <h2>Cómo se empieza.</h2>
              <p className="dek">
                Tres pasos. El primero, una reunión. Lo demás, ejecución y seguimiento.
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
            className="proceso-grid"
          >
            {PROCESO.map(([n, title, body], i) => (
              <article
                key={n}
                style={{
                  padding: "var(--space-6) var(--space-5) var(--space-5)",
                  borderRight: i < 2 ? "1px solid var(--rule)" : "none",
                }}
              >
                <div className="mono" style={{ color: "var(--gold-deep)", fontSize: 13, letterSpacing: "0.08em", marginBottom: "var(--space-2)" }}>
                  {n}
                </div>
                <h3
                  className="serif"
                  style={{
                    fontWeight: 400,
                    fontSize: 26,
                    lineHeight: 1.15,
                    margin: "var(--space-2) 0 var(--space-3)",
                    letterSpacing: "-0.015em",
                  }}
                >
                  {title}
                </h3>
                <p className="body-base" style={{ margin: 0 }}>{body}</p>
              </article>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-5)", gap: 12 }}>
            <Link href="/contacto" className="btn btn-primary">
              Agendá una reunión <span className="arrow" />
            </Link>
          </div>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .proceso-grid { grid-template-columns: 1fr !important; }
            .proceso-grid article { border-right: 0 !important; border-bottom: 1px solid var(--rule); }
          }
        `}</style>
      </section>
    </main>
  );
}
