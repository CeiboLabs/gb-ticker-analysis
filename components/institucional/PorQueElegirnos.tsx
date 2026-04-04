const DIFERENCIADORES = [
  {
    title: "Regulación BCU",
    description:
      "Operamos bajo la supervisión del Banco Central del Uruguay, cumpliendo con los más altos estándares regulatorios del mercado financiero.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Cuentas Segregadas",
    description:
      "Tu patrimonio es tuyo. Mantenemos cuentas segregadas donde los activos siempre están bajo tu titularidad legal, nunca mezclados con los de la empresa.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    title: "Experiencia Comprobada",
    description:
      "Más de cinco décadas en el mercado de valores nos avalan. Somos miembros de la Bolsa de Valores de Montevideo desde 1967.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
  {
    title: "Perspectiva Global",
    description:
      "Desde Montevideo, te conectamos con los principales mercados financieros internacionales. Una visión global con raíces locales.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
];

export function PorQueElegirnos() {
  return (
    <section className="bg-[#F8F9FF] py-20 sm:py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#03065E]/40 text-center mb-3">
          Por Qué Elegirnos
        </h2>
        <p className="text-2xl sm:text-3xl font-bold text-[#03065E] text-center mb-4">
          Valoramos tu patrimonio tanto como vos
        </p>
        <p className="text-sm text-[#03065E]/50 text-center max-w-xl mx-auto mb-14 leading-relaxed">
          Nuestra trayectoria y compromiso nos distinguen en el mercado
          financiero uruguayo.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {DIFERENCIADORES.map((d) => (
            <div
              key={d.title}
              className="bg-white border border-[#03065E]/8 rounded-xl p-8 hover:shadow-lg transition-shadow duration-300"
            >
              <div className="text-[#C9A84C] mb-5">{d.icon}</div>
              <h3 className="text-base font-semibold text-[#03065E] mb-3">
                {d.title}
              </h3>
              <p className="text-sm text-[#03065E]/50 leading-relaxed">
                {d.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
