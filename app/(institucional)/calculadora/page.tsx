import { Calculadora } from "@/components/institucional/Calculadora";
import type { Metadata } from "next";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";

export const metadata: Metadata = {
  title: "Calculadora · Bengochea & Cía.",
  description: "Simulá el crecimiento de una inversión con interés compuesto. Configurá monto inicial, aporte mensual, tasa y horizonte.",
};

const PERFILES = [
  {
    title: "Conservador",
    rango: "4 – 6 %",
    body: "Cartera dominada por renta fija de alta calidad. Cupón previsible, volatilidad acotada, capital preservado.",
    perfil: "Baja tolerancia al riesgo",
  },
  {
    title: "Moderado",
    rango: "6 – 10 %",
    body: "Combinación balanceada de renta fija y renta variable. Crecimiento compuesto sin abandonar el ancla de la liquidez.",
    perfil: "Tolerancia media al riesgo",
  },
  {
    title: "Agresivo",
    rango: "10 – 15 %",
    body: "Mayor exposición a renta variable global y mercados emergentes. Volatilidad mayor, horizonte largo.",
    perfil: "Alta tolerancia al riesgo",
  },
];

const CONCEPTOS: [string, string][] = [
  ["Interés compuesto", "El rendimiento se calcula sobre el capital inicial más los rendimientos previamente acumulados. Es el motor del crecimiento de largo plazo."],
  ["Diversificación", "Distribuir entre activos de baja correlación reduce el riesgo de cartera sin sacrificar retorno esperado proporcionalmente."],
  ["Horizonte temporal", "El plazo largo permite absorber volatilidad y aprovechar el compounding. El plazo corto exige menos riesgo."],
  ["Aportes regulares", "Invertir cantidades fijas con frecuencia (DCA) suaviza el efecto de la volatilidad y disciplina el ahorro."],
];

export default function CalculadoraPage() {
  return (
    <main className="site">
      {/* Hero full-bleed */}
      <div className="hero-media">
        <div className="media-ph" aria-hidden />
        <div className="scrim" aria-hidden />

        <Reveal as="div" className="site-wrap hero-content">
          <div className="kicker" style={{ color: "var(--gold-soft)" }}>
            Herramientas · Calculadora
          </div>

          <h1 className="t-display" style={{ marginTop: 20, maxWidth: "16ch", color: "#fff" }}>
            El interés compuesto, año por año.
          </h1>

          <p className="t-lead" style={{ maxWidth: "40em", marginTop: 24, color: "rgba(255,255,255,0.86)" }}>
            Simulá el crecimiento de una cartera con aportes mensuales y tasa anual constante. Sin promesas: una herramienta para discutir el horizonte.
          </p>
        </Reveal>
      </div>

      {/* Calculadora */}
      <section className="band site-section">
        <Reveal as="div">
          <Calculadora />
        </Reveal>
      </section>

      {/* Perfiles — hairline grid */}
      <section className="band-muted site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Perfiles</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "14em" }}>
                Tres lecturas posibles del retorno esperado.
              </h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                Estimaciones de mercado, no garantías. La asignación concreta se discute en la mesa según el cliente.
              </p>
            </div>
          </Reveal>

          <Stagger as="div" className="perfiles-grid">
            {PERFILES.map((p) => (
              <StaggerItem as="article" key={p.title} className="perfil-item">
                <div className="eyebrow-sm">{p.perfil}</div>
                <h3 className="t-h3" style={{ marginTop: 18 }}>{p.title}</h3>
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 400,
                    letterSpacing: "-0.02em",
                    color: "var(--gold-deep)",
                    marginTop: 8,
                  }}
                >
                  {p.rango}
                </div>
                <p className="t-body" style={{ marginTop: 18, marginBottom: 0 }}>{p.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Conceptos — hairline grid */}
      <section className="band site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Conceptos</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "14em" }}>
                Cuatro ideas que sostienen la simulación.
              </h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                Para que el simulador no sea una caja negra. Lo que está adentro, en cuatro definiciones.
              </p>
            </div>
          </Reveal>

          <div className="conceptos-grid">
            {CONCEPTOS.map(([title, body]) => (
              <div key={title} className="concepto-item">
                <h3 className="t-h4">{title}</h3>
                <p className="t-body" style={{ marginTop: 12, marginBottom: 0 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        .perfiles-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          margin-top: 56px;
          border-top: 1px solid var(--site-border);
        }
        .perfil-item {
          padding: 36px 32px 36px 0;
          border-bottom: 1px solid var(--site-border);
          border-right: 1px solid var(--site-border);
        }
        .perfil-item:last-child { border-right: 0; padding-right: 0; }
        .perfil-item:not(:first-child) { padding-left: 32px; }
        .conceptos-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          margin-top: 56px;
          border-top: 1px solid var(--site-border);
        }
        .concepto-item {
          padding: 32px 32px 32px 0;
          border-bottom: 1px solid var(--site-border);
          border-right: 1px solid var(--site-border);
        }
        .concepto-item:nth-child(2n) { border-right: 0; padding-right: 0; }
        .concepto-item:nth-child(2n) { padding-left: 32px; }
        @media (max-width: 900px) {
          .perfiles-grid { grid-template-columns: 1fr; }
          .perfil-item { border-right: 0; padding: 28px 0; }
          .perfil-item:not(:first-child) { padding-left: 0; }
        }
        @media (max-width: 760px) {
          .conceptos-grid { grid-template-columns: 1fr; }
          .concepto-item, .concepto-item:nth-child(2n) { border-right: 0; padding: 28px 0; padding-left: 0; }
        }
      `}</style>
    </main>
  );
}
