const STEPS = [
  {
    number: "01",
    title: "Buscá una Empresa",
    description: "Escribí el nombre o ticker de cualquier acción listada en EE.UU.",
  },
  {
    number: "02",
    title: "IA Analiza los Datos",
    description: "GPT-4o procesa datos financieros reales de Yahoo Finance y SEC EDGAR en tiempo real.",
  },
  {
    number: "03",
    title: "Recibí tu Reporte",
    description: "Obtenés un análisis profesional completo con veredicto, métricas y gráficos interactivos.",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-[#F8F9FF] py-16 sm:py-28 px-5 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.3em] text-[#03065E]/40 text-center mb-3">
          Proceso
        </h2>
        <p className="text-xl sm:text-3xl font-bold text-[#03065E] text-center mb-10 sm:mb-16">
          Cómo Funciona
        </p>

        <div className="flex flex-col sm:flex-row gap-7 sm:gap-6">
          {STEPS.map((step, i) => (
            <div key={step.number} className="flex-1 text-center sm:text-left">
              {/* Step number */}
              <div className="text-2xl sm:text-3xl font-bold text-[#C9A84C] mb-3 sm:mb-4 font-mono">
                {step.number}
              </div>
              <h3 className="text-base font-semibold text-[#03065E] mb-1.5 sm:mb-2">{step.title}</h3>
              <p className="text-[13px] sm:text-sm text-[#03065E]/50 leading-relaxed">{step.description}</p>

              {/* Connector line (hidden on last step and mobile) */}
              {i < STEPS.length - 1 && (
                <div className="hidden sm:block mt-6 border-t border-[#03065E]/10" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
