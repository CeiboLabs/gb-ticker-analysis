import { Calculadora } from "@/components/institucional/Calculadora";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calculadora · Bengochea & Cía.",
  description: "Simulá el crecimiento de una inversión con interés compuesto. Configurá monto inicial, aporte mensual, tasa y horizonte.",
};

const PERFILES = [
  {
    n: "i.",
    title: "Conservador",
    rango: "4 – 6 %",
    body: "Cartera dominada por renta fija de alta calidad. Cupón previsible, volatilidad acotada, capital preservado.",
    perfil: "Baja tolerancia al riesgo",
  },
  {
    n: "ii.",
    title: "Moderado",
    rango: "6 – 10 %",
    body: "Combinación balanceada de renta fija y renta variable. Crecimiento compuesto sin abandonar el ancla de la liquidez.",
    perfil: "Tolerancia media al riesgo",
  },
  {
    n: "iii.",
    title: "Agresivo",
    rango: "10 – 15 %",
    body: "Mayor exposición a renta variable global y mercados emergentes. Volatilidad mayor, horizonte largo.",
    perfil: "Alta tolerancia al riesgo",
  },
];

const CONCEPTOS = [
  ["Interés compuesto", "El rendimiento se calcula sobre el capital inicial más los rendimientos previamente acumulados. Es el motor del crecimiento de largo plazo."],
  ["Diversificación", "Distribuir entre activos de baja correlación reduce el riesgo de cartera sin sacrificar retorno esperado proporcionalmente."],
  ["Horizonte temporal", "El plazo largo permite absorber volatilidad y aprovechar el compounding. El plazo corto exige menos riesgo."],
  ["Aportes regulares", "Invertir cantidades fijas con frecuencia (DCA) suaviza el efecto de la volatilidad y disciplina el ahorro."],
];

export default function CalculadoraPage() {
  return (
    <main>
      {/* Hero */}
      <section className="section-navy" style={{ position: "relative", overflow: "hidden" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(50% 70% at 50% 0%, rgba(201,168,76,0.08), transparent 60%)",
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
            <span className="cap" style={{ color: "rgba(255,255,255,0.55)" }}>Herramientas · Calculadora</span>
            <span className="cap mono" style={{ color: "rgba(255,255,255,0.55)" }}>Simulador · v1</span>
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
            El interés compuesto,{" "}
            <em style={{ fontStyle: "italic", color: "var(--gold-soft)", fontWeight: 300 }}>
              año por año.
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
            Simulá el crecimiento de una cartera con aportes mensuales y tasa anual constante. Sin promesas: una herramienta para discutir el horizonte.
          </p>
        </div>
      </section>

      {/* Calculadora */}
      <section className="section">
        <Calculadora />
      </section>

      {/* Perfiles */}
      <section className="section-navy">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">02 / 03</div>
              <div className="cap-gold-on-navy cap" style={{ marginTop: 8 }}>Perfiles</div>
            </div>
            <div>
              <h2 style={{ color: "var(--ivory)" }}>Tres lecturas posibles del retorno esperado.</h2>
              <p className="dek" style={{ color: "rgba(255,255,255,0.78)" }}>
                Estimaciones de mercado, no garantías. La asignación concreta se discute en la mesa según el cliente.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              borderTop: "1px solid rgba(255,255,255,0.18)",
            }}
            className="perfiles-grid"
          >
            {PERFILES.map((p, i) => (
              <article
                key={p.n}
                style={{
                  padding: "var(--space-6) var(--space-5)",
                  borderRight: i < 2 ? "1px solid rgba(255,255,255,0.18)" : "none",
                  borderBottom: "1px solid rgba(255,255,255,0.18)",
                }}
              >
                <div className="serif-i" style={{ fontSize: 48, color: "var(--gold-soft)", lineHeight: 1 }}>
                  {p.n}
                </div>
                <h3
                  className="serif"
                  style={{
                    color: "var(--ivory)",
                    fontWeight: 400,
                    fontSize: 28,
                    lineHeight: 1.15,
                    margin: "var(--space-3) 0 var(--space-2)",
                    letterSpacing: "-0.015em",
                  }}
                >
                  {p.title}
                </h3>
                <div className="mono" style={{ fontSize: 22, color: "var(--gold-soft)", marginBottom: "var(--space-3)" }}>
                  {p.rango}
                </div>
                <p className="body-base" style={{ color: "rgba(255,255,255,0.78)", margin: 0 }}>{p.body}</p>
                <div
                  className="cap"
                  style={{
                    marginTop: "var(--space-4)",
                    paddingTop: "var(--space-2)",
                    borderTop: "1px dashed rgba(255,255,255,0.18)",
                    color: "rgba(255,255,255,0.55)",
                  }}
                >
                  {p.perfil}
                </div>
              </article>
            ))}
          </div>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .perfiles-grid { grid-template-columns: 1fr !important; }
            .perfiles-grid article { border-right: 0 !important; }
          }
        `}</style>
      </section>

      {/* Conceptos */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">03 / 03</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>Conceptos</div>
            </div>
            <div>
              <h2>Cuatro ideas que sostienen la simulación.</h2>
              <p className="dek">
                Para que el simulador no sea una caja negra. Lo que está adentro, en cuatro definiciones.
              </p>
            </div>
          </div>

          <ol style={{ listStyle: "none", padding: 0, margin: 0, borderTop: "1px solid var(--ink)" }}>
            {CONCEPTOS.map(([title, body]) => (
              <li
                key={title}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(180px, 220px) 1fr",
                  gap: "var(--space-5)",
                  padding: "var(--space-4) 0",
                  borderBottom: "1px solid var(--rule)",
                  alignItems: "baseline",
                }}
                className="instrument-row"
              >
                <h3 className="serif" style={{ fontWeight: 400, fontSize: 22, lineHeight: 1.2, margin: 0, letterSpacing: "-0.015em" }}>
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
    </main>
  );
}
