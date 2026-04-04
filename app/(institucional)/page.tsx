"use client";

import { HeroInstitucional } from "@/components/institucional/HeroInstitucional";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import Link from "next/link";

/* ── Servicios Destacados ── */
const SERVICIOS_PREVIEW = [
  {
    title: "Bonos",
    description: "Renta fija nacional e internacional para diversificar tu cartera con estabilidad.",
    gradient: "from-blue-500/20 to-indigo-500/20",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-400",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M12 6v12" />
        <path d="M6 12h12" />
      </svg>
    ),
  },
  {
    title: "Acciones",
    description: "Acceso directo a los principales mercados de renta variable del mundo.",
    gradient: "from-emerald-500/20 to-green-500/20",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    title: "Fondos de Inversión",
    description: "Carteras diversificadas y gestionadas por profesionales para distintos perfiles.",
    gradient: "from-purple-500/20 to-violet-500/20",
    iconBg: "bg-purple-500/10",
    iconColor: "text-purple-400",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
];

/* ── Mercados ── */
const MERCADOS = [
  { name: "Estados Unidos", flag: "🇺🇸", exchanges: "NYSE, NASDAQ" },
  { name: "Europa", flag: "🇪🇺", exchanges: "LSE, Euronext, XETRA" },
  { name: "Uruguay", flag: "🇺🇾", exchanges: "BVM" },
  { name: "Argentina", flag: "🇦🇷", exchanges: "BYMA" },
  { name: "Brasil", flag: "🇧🇷", exchanges: "B3" },
  { name: "Global", flag: "🌎", exchanges: "Mercados emergentes" },
];

/* ── Cifras ── */
const CIFRAS = [
  { value: "1967", label: "Miembros de la Bolsa de Valores de Montevideo", icon: "🏛️" },
  { value: "57+", label: "Años de trayectoria ininterrumpida", icon: "⏳" },
  { value: "6", label: "Productos de inversión disponibles", icon: "📊" },
  { value: "100%", label: "Regulados por el BCU", icon: "🛡️" },
];

/* ── Por Qué Elegirnos ── */
const DIFERENCIADORES = [
  {
    title: "Regulación BCU",
    desc: "Supervisados por el Banco Central del Uruguay con los más altos estándares.",
    color: "from-blue-500 to-blue-600",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Cuentas Segregadas",
    desc: "Tu patrimonio siempre bajo tu titularidad legal.",
    color: "from-emerald-500 to-emerald-600",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    title: "Experiencia",
    desc: "Más de 57 años en el mercado de valores uruguayo.",
    color: "from-amber-500 to-amber-600",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
  {
    title: "Perspectiva Global",
    desc: "Acceso a mercados internacionales desde Montevideo.",
    color: "from-violet-500 to-violet-600",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
];

export default function HomePage() {
  return (
    <main>
      <HeroInstitucional />

      {/* ── Servicios Preview ── */}
      <ScrollReveal>
        <section className="bg-[#F8F9FF] py-20 sm:py-28 px-6 relative">
          {/* Decorative blob */}
          <div
            className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full opacity-30 pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)",
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
              Ofrecemos un amplio ecosistema de productos financieros para que
              puedas construir el portafolio ideal.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
              {SERVICIOS_PREVIEW.map((s) => (
                <div
                  key={s.title}
                  className="group glass-light rounded-2xl p-7 glow-card transition-all duration-500 cursor-default gradient-border"
                >
                  <div className={`w-12 h-12 rounded-xl ${s.iconBg} ${s.iconColor} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                    {s.icon}
                  </div>
                  <h3 className="text-base font-semibold text-[#03065E] mb-2">{s.title}</h3>
                  <p className="text-sm text-[#03065E]/50 leading-relaxed">{s.description}</p>
                </div>
              ))}
            </div>

            <div className="text-center">
              <Link
                href="/servicios"
                className="group text-sm font-semibold text-[#C9A84C] hover:text-[#b8963f] transition-colors inline-flex items-center gap-2"
              >
                Ver todos los servicios
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:translate-x-1 transition-transform">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ── Nosotros Teaser ── */}
      <ScrollReveal>
        <section className="bg-[#03065E] py-20 sm:py-28 px-6 relative overflow-hidden">
          {/* Gradient orb */}
          <div
            className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full animate-float-slow pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(201,168,76,0.1) 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <div className="max-w-5xl mx-auto relative">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-white/35 mb-3">
                  Quiénes Somos
                </h2>
                <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-6 leading-tight">
                  Más de cinco décadas conectando inversores con oportunidades{" "}
                  <span className="gradient-text">globales</span>
                </p>
                <p className="text-sm text-white/50 leading-relaxed mb-4">
                  Desde 1967, somos miembros de la Bolsa de Valores de Montevideo.
                  Con casi seis décadas de trayectoria, hemos gestionado activos
                  financieros para miles de uruguayos y extranjeros.
                </p>
                <p className="text-sm text-white/40 leading-relaxed mb-8">
                  Construimos relaciones basadas en la confianza y la transparencia,
                  ofreciendo un servicio de excelencia con acceso a los mejores
                  mercados del mundo.
                </p>
                <Link
                  href="/nosotros"
                  className="group inline-flex items-center gap-2 bg-gradient-to-r from-[#C9A84C] to-[#d4b65e] text-[#03065E] font-semibold px-6 py-3 rounded-xl text-sm hover:shadow-[0_0_30px_rgba(201,168,76,0.3)] transition-all duration-300"
                >
                  Conocé Nuestra Historia
                  <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                </Link>
              </div>

              {/* Cifras grid */}
              <div className="grid grid-cols-2 gap-4">
                {CIFRAS.map((c) => (
                  <div
                    key={c.label}
                    className="glass rounded-2xl p-6 text-center hover:bg-white/[0.08] transition-colors duration-300 gradient-border"
                  >
                    <div className="text-2xl mb-2">{c.icon}</div>
                    <div className="text-2xl sm:text-3xl font-bold gradient-text mb-2">
                      {c.value}
                    </div>
                    <p className="text-[11px] text-white/35 leading-snug">{c.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ── Mercados ── */}
      <ScrollReveal>
        <section className="bg-[#F8F9FF] py-20 sm:py-28 px-6 relative overflow-hidden">
          <div
            className="absolute top-[50%] left-[-5%] w-[300px] h-[300px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)",
              filter: "blur(50px)",
            }}
          />
          <div className="max-w-5xl mx-auto relative">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#03065E]/40 text-center mb-3">
              Alcance Global
            </h2>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#03065E] text-center mb-4">
              Mercados que Podés Acceder
            </p>
            <p className="text-sm text-[#03065E]/50 text-center max-w-xl mx-auto mb-14 leading-relaxed">
              Desde Montevideo, te conectamos con las principales bolsas del
              mundo.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {MERCADOS.map((m, i) => (
                <div
                  key={m.name}
                  className="group glass-light rounded-2xl p-5 text-center glow-card transition-all duration-500 cursor-default"
                  style={{ transitionDelay: `${i * 50}ms` }}
                >
                  <div className="text-4xl mb-3 group-hover:scale-125 transition-transform duration-300">
                    {m.flag}
                  </div>
                  <h3 className="text-xs font-semibold text-[#03065E] mb-1">
                    {m.name}
                  </h3>
                  <p className="text-[10px] text-[#03065E]/40 font-mono">
                    {m.exchanges}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ── Calculadora Teaser ── */}
      <ScrollReveal>
        <section className="relative py-20 sm:py-28 px-6 overflow-hidden" style={{ background: "linear-gradient(135deg, #03065E 0%, #0a0f6e 50%, #03065E 100%)" }}>
          {/* Animated gradient orbs */}
          <div
            className="absolute top-[-10%] left-[20%] w-[400px] h-[400px] rounded-full animate-float-slow pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(201,168,76,0.15) 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />
          <div
            className="absolute bottom-[-10%] right-[10%] w-[350px] h-[350px] rounded-full animate-float-slow pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)",
              filter: "blur(60px)",
              animationDelay: "-7s",
            }}
          />

          <div className="max-w-4xl mx-auto relative">
            <div className="glass rounded-3xl p-10 sm:p-14 text-center glow-gold">
              <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-white/35 mb-4">
                Herramientas
              </h2>
              <p className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Calculadora de{" "}
                <span className="gradient-text">Inversión</span>
              </p>
              <p className="text-sm sm:text-base text-white/45 max-w-lg mx-auto mb-10 leading-relaxed">
                Simulá el crecimiento de tu inversión a lo largo del tiempo.
                Configurá monto inicial, aportes mensuales y horizonte temporal
                para visualizar tu potencial de retorno.
              </p>

              {/* Mini preview bars */}
              <div className="flex items-end justify-center gap-1.5 mb-10 h-16">
                {[20, 35, 30, 50, 45, 60, 55, 75, 70, 90, 85, 100].map((h, i) => (
                  <div
                    key={i}
                    className="w-3 sm:w-4 rounded-t-sm animate-float"
                    style={{
                      height: `${h}%`,
                      background: `linear-gradient(to top, rgba(201,168,76,0.3), rgba(201,168,76,${0.4 + (h / 200)}))`,
                      animationDelay: `${i * 0.2}s`,
                      animationDuration: `${3 + (i % 3)}s`,
                    }}
                  />
                ))}
              </div>

              <Link
                href="/calculadora"
                className="group inline-flex items-center gap-2 bg-gradient-to-r from-[#C9A84C] to-[#d4b65e] text-[#03065E] font-semibold px-8 py-3.5 rounded-xl text-sm hover:shadow-[0_0_30px_rgba(201,168,76,0.3)] transition-all duration-300"
              >
                Probar la Calculadora
                <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
              </Link>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ── Por Qué Elegirnos ── */}
      <ScrollReveal>
        <section className="bg-[#F8F9FF] py-20 sm:py-28 px-6 relative">
          <div className="max-w-5xl mx-auto relative">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#03065E]/40 text-center mb-3">
              Por Qué Elegirnos
            </h2>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#03065E] text-center mb-14">
              Valoramos tu patrimonio tanto como vos
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {DIFERENCIADORES.map((item, i) => (
                <div
                  key={item.title}
                  className="group glass-light rounded-2xl p-7 text-center glow-card transition-all duration-500 cursor-default"
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} text-white flex items-center justify-center mx-auto mb-5 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300`}>
                    {item.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-[#03065E] mb-2">{item.title}</h3>
                  <p className="text-xs text-[#03065E]/50 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ── Análisis Teaser ── */}
      <ScrollReveal>
        <section className="bg-[#03065E] py-20 sm:py-28 px-6 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <div
            className="absolute top-[20%] right-[-5%] w-[400px] h-[400px] rounded-full animate-pulse-glow pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)",
              filter: "blur(50px)",
            }}
          />
          <div className="max-w-5xl mx-auto relative">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-white/35 mb-3">
                  Herramienta IA
                </h2>
                <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-6 leading-tight">
                  Análisis de Acciones con{" "}
                  <span className="gradient-text">Inteligencia Artificial</span>
                </p>
                <p className="text-sm text-white/50 leading-relaxed mb-4">
                  Generá reportes de investigación de renta variable con calidad
                  profesional para cualquier acción listada en EE.UU.
                </p>
                <ul className="space-y-3 mb-8">
                  {["Veredicto BUY / HOLD / AVOID", "12 métricas financieras clave", "Gráficos interactivos y Sankey", "Consenso de analistas de Wall Street", "Exportación a PDF profesional"].map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-white/60">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7"/></svg>
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/analisis"
                  className="group inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold px-6 py-3 rounded-xl text-sm hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all duration-300"
                >
                  Probar el Análisis
                  <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                </Link>
              </div>

              {/* Mock report card */}
              <div className="glass rounded-2xl p-6 glow-gold">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white font-bold text-sm font-mono">
                    AAPL
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Apple Inc.</p>
                    <p className="text-xs text-white/40">NASDAQ · Technology</p>
                  </div>
                  <span className="ml-auto px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                    BUY
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: "P/E", value: "28.4x" },
                    { label: "Market Cap", value: "$3.4T" },
                    { label: "Revenue", value: "$383B" },
                  ].map((m) => (
                    <div key={m.label} className="bg-white/5 rounded-lg p-3 text-center">
                      <p className="text-[10px] text-white/30 uppercase">{m.label}</p>
                      <p className="text-sm font-bold text-white font-mono">{m.value}</p>
                    </div>
                  ))}
                </div>
                {/* Mock chart line */}
                <svg viewBox="0 0 300 60" className="w-full h-12 text-emerald-400/60">
                  <path
                    d="M0 50 Q30 45 60 40 T120 30 T180 25 T240 15 T300 10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M0 50 Q30 45 60 40 T120 30 T180 25 T240 15 T300 10 V60 H0Z"
                    fill="currentColor"
                    opacity="0.1"
                  />
                </svg>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ── CTA Final ── */}
      <ScrollReveal>
        <section className="relative py-24 sm:py-32 px-6 overflow-hidden" style={{ background: "linear-gradient(180deg, #F8F9FF 0%, #eef0ff 100%)" }}>
          {/* Decorative elements */}
          <div
            className="absolute top-[20%] left-[10%] w-[300px] h-[300px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)",
              filter: "blur(50px)",
            }}
          />
          <div
            className="absolute bottom-[10%] right-[15%] w-[250px] h-[250px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)",
              filter: "blur(50px)",
            }}
          />
          <div className="max-w-3xl mx-auto text-center relative">
            <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#03065E] mb-5 leading-tight">
              ¿Listo para invertir en tu{" "}
              <span className="gradient-text">futuro</span>?
            </p>
            <p className="text-base text-[#03065E]/45 mb-10 max-w-lg mx-auto leading-relaxed">
              Dá el primer paso. Nuestro equipo está listo para asesorarte y
              acompañarte en cada decisión de inversión.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/contacto"
                className="group bg-gradient-to-r from-[#C9A84C] to-[#d4b65e] text-[#03065E] font-semibold px-8 py-3.5 rounded-xl text-sm hover:shadow-[0_0_30px_rgba(201,168,76,0.3)] transition-all duration-300"
              >
                Contactanos
                <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">&rarr;</span>
              </Link>
              <Link
                href="/servicios"
                className="border-2 border-[#03065E]/15 text-[#03065E] font-medium px-8 py-3.5 rounded-xl text-sm hover:bg-[#03065E]/5 hover:border-[#03065E]/25 transition-all duration-300"
              >
                Explorar Servicios
              </Link>
            </div>
          </div>
        </section>
      </ScrollReveal>
    </main>
  );
}
