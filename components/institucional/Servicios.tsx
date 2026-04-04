const SERVICIOS = [
  {
    title: "Bonos",
    description:
      "Accedé a renta fija nacional e internacional. Bonos soberanos, corporativos y estructurados para diversificar tu cartera.",
    color: "from-blue-500 to-blue-600",
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/10",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M12 6v12" />
        <path d="M6 12h12" />
      </svg>
    ),
  },
  {
    title: "Acciones",
    description:
      "Invertí en los principales mercados de renta variable del mundo. Acceso directo a bolsas internacionales desde Montevideo.",
    color: "from-emerald-500 to-emerald-600",
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/10",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    title: "Fondos de Inversión",
    description:
      "Carteras diversificadas y gestionadas por profesionales. Opciones para distintos perfiles de riesgo y horizontes de inversión.",
    color: "from-purple-500 to-purple-600",
    iconColor: "text-purple-400",
    iconBg: "bg-purple-500/10",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    title: "Fideicomisos",
    description:
      "Estructuras fiduciarias para protección patrimonial, planificación sucesoria y proyectos de inversión a medida.",
    color: "from-amber-500 to-amber-600",
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/10",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    title: "Gestión de Portafolios",
    description:
      "Administración activa de carteras adaptada a tus objetivos. Monitoreo continuo y rebalanceo estratégico.",
    color: "from-teal-500 to-teal-600",
    iconColor: "text-teal-400",
    iconBg: "bg-teal-500/10",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 16l4-8 4 4 4-8" />
      </svg>
    ),
  },
  {
    title: "Asesoramiento Financiero",
    description:
      "Acompañamiento personalizado para cada decisión de inversión. Entendemos tus necesidades y diseñamos la estrategia ideal.",
    color: "from-rose-500 to-rose-600",
    iconColor: "text-rose-400",
    iconBg: "bg-rose-500/10",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

export function Servicios() {
  return (
    <section className="bg-[#F8F9FF] py-20 sm:py-28 px-6 relative overflow-hidden">
      <div
        className="absolute bottom-[10%] right-[-5%] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <div className="max-w-5xl mx-auto relative">
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#03065E]/40 text-center mb-3">
          Servicios
        </h2>
        <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#03065E] text-center mb-4">
          Soluciones de Inversión a tu Medida
        </p>
        <p className="text-sm text-[#03065E]/50 text-center max-w-xl mx-auto mb-14 leading-relaxed">
          Ofrecemos un amplio ecosistema de productos financieros para que puedas
          construir el portafolio que mejor se adapte a tus objetivos.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {SERVICIOS.map((s, i) => (
            <div
              key={s.title}
              className="group glass-light rounded-2xl p-7 glow-card transition-all duration-500 cursor-default gradient-border"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.color} text-white flex items-center justify-center mb-5 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300`}>
                {s.icon}
              </div>
              <h3 className="text-sm font-semibold text-[#03065E] mb-2">
                {s.title}
              </h3>
              <p className="text-sm text-[#03065E]/50 leading-relaxed">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
