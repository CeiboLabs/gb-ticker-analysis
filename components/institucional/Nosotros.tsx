const VALUES = [
  {
    title: "Confianza del cliente",
    description: "Tu tranquilidad es nuestro norte en cada decisión.",
  },
  {
    title: "Perspectiva global",
    description: "Visión internacional desde una base local.",
  },
  {
    title: "Regulación vigente",
    description: "Supervisados por el Banco Central del Uruguay.",
  },
  {
    title: "Escucha activa",
    description: "Entendemos tus necesidades individuales.",
  },
  {
    title: "Cuentas segregadas",
    description: "Tu patrimonio siempre bajo tu titularidad.",
  },
  {
    title: "Educación financiera",
    description: "Dedicados a la formación del inversor.",
  },
];

export function Nosotros() {
  return (
    <section className="bg-[#03065E] py-20 sm:py-28 px-6 relative overflow-hidden">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="max-w-5xl mx-auto relative">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left column - text */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-white/35 mb-3">
              Nuestra Misión
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-white mb-6 leading-tight">
              Más de cinco décadas conectando inversores con oportunidades{" "}
              <span className="text-[#C9A84C]">globales</span>
            </p>
            <p className="text-sm text-white/55 leading-relaxed mb-6">
              Desde 1967, somos miembros de la Bolsa de Valores de Montevideo.
              Con casi seis décadas de trayectoria, hemos gestionado activos
              financieros para miles de uruguayos y extranjeros, construyendo
              relaciones basadas en la confianza y la transparencia.
            </p>
            <p className="text-sm text-white/55 leading-relaxed mb-8">
              Nuestro compromiso es ofrecer un servicio de excelencia,
              acompañando a cada cliente con asesoramiento profesional y acceso a
              los mejores mercados del mundo.
            </p>

            <a
              href="/contacto"
              className="inline-block bg-[#C9A84C] text-[#03065E] font-semibold px-6 py-3 rounded-lg text-sm hover:bg-[#d4b65e] transition-colors"
            >
              Contactanos
            </a>
          </div>

          {/* Right column - values grid */}
          <div className="border border-white/10 rounded-2xl p-6 sm:p-8 bg-white/[0.03]">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C9A84C] mb-6">
              Nuestros Valores
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {VALUES.map((v) => (
                <div key={v.title} className="flex gap-3">
                  <div className="mt-1 w-2 h-2 rounded-full bg-[#C9A84C] shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-white mb-1">
                      {v.title}
                    </p>
                    <p className="text-xs text-white/45 leading-relaxed">
                      {v.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
