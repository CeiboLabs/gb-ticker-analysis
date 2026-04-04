import { Servicios } from "@/components/institucional/Servicios";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Servicios | Gastón Bengochea",
  description: "Bonos, acciones, fondos de inversión, fideicomisos, gestión de portafolios y asesoramiento financiero personalizado.",
};

const DETALLE_SERVICIOS = [
  {
    title: "Bonos Soberanos",
    description:
      "Títulos emitidos por gobiernos nacionales y extranjeros. Una opción de renta fija con respaldo estatal para inversores que buscan estabilidad y previsibilidad en sus retornos.",
    color: "from-blue-500 to-blue-600",
  },
  {
    title: "Bonos Corporativos",
    description:
      "Instrumentos de deuda emitidos por empresas de primer nivel. Permiten acceder a rendimientos superiores a los soberanos con un perfil de riesgo controlado.",
    color: "from-indigo-500 to-indigo-600",
  },
  {
    title: "Acciones EE.UU.",
    description:
      "Acceso directo a las empresas más grandes del mundo a través de NYSE y NASDAQ. Desde tecnología hasta energía, con ejecución profesional.",
    color: "from-emerald-500 to-emerald-600",
  },
  {
    title: "Acciones Regionales",
    description:
      "Invertí en mercados latinoamericanos con potencial de crecimiento. Cobertura de bolsas en Uruguay, Argentina, Brasil y más.",
    color: "from-teal-500 to-teal-600",
  },
  {
    title: "Fondos Balanceados",
    description:
      "Carteras que combinan renta fija y variable para lograr un equilibrio entre crecimiento y protección del capital.",
    color: "from-purple-500 to-purple-600",
  },
  {
    title: "Fondos Temáticos",
    description:
      "Vehículos de inversión enfocados en tendencias globales como tecnología, salud, infraestructura y sustentabilidad.",
    color: "from-violet-500 to-violet-600",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Contactanos",
    description:
      "Agendá una reunión con nuestro equipo para conocer tus objetivos y perfil de inversión.",
    icon: "💬",
  },
  {
    number: "02",
    title: "Diseñamos tu Estrategia",
    description:
      "Creamos un plan personalizado con la combinación ideal de productos para vos.",
    icon: "📋",
  },
  {
    number: "03",
    title: "Invertí con Confianza",
    description:
      "Ejecutamos y monitoreamos tu portafolio con reportes periódicos y soporte continuo.",
    icon: "🚀",
  },
];

export default function ServiciosPage() {
  return (
    <main className="pt-20">
      {/* Hero */}
      <section className="relative py-24 sm:py-32 px-6 overflow-hidden" style={{ background: "linear-gradient(135deg, #03065E 0%, #0a0f6e 50%, #03065E 100%)" }}>
        {/* Gradient orbs */}
        <div
          className="absolute top-[-15%] right-[-5%] w-[500px] h-[500px] rounded-full animate-float-slow pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full animate-float-slow pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
            filter: "blur(80px)",
            animationDelay: "-5s",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="max-w-3xl mx-auto text-center relative">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-6 leading-[1.1]">
            Todo lo que necesitás para{" "}
            <span className="gradient-text">invertir</span>
          </h1>
          <p className="text-base sm:text-lg text-white/45 max-w-lg mx-auto leading-relaxed">
            Desde renta fija hasta asesoramiento personalizado, te ofrecemos las
            herramientas y productos para construir tu futuro financiero.
          </p>
        </div>
      </section>

      {/* Main services grid */}
      <Servicios />

      {/* Detailed products */}
      <ScrollReveal>
        <section className="relative py-20 sm:py-28 px-6 overflow-hidden" style={{ background: "linear-gradient(135deg, #03065E 0%, #080d5a 100%)" }}>
          <div
            className="absolute top-[20%] right-[-5%] w-[400px] h-[400px] rounded-full animate-pulse-glow pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)",
              filter: "blur(50px)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <div className="max-w-5xl mx-auto relative">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-white/35 text-center mb-3">
              Productos
            </h2>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white text-center mb-14">
              Explorá en Detalle
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {DETALLE_SERVICIOS.map((s, i) => (
                <div
                  key={s.title}
                  className="group glass rounded-2xl p-7 hover:bg-white/[0.08] transition-all duration-500 gradient-border cursor-default"
                  style={{ transitionDelay: `${i * 60}ms` }}
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-5 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-3">
                    {s.title}
                  </h3>
                  <p className="text-sm text-white/45 leading-relaxed">
                    {s.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* Process */}
      <ScrollReveal>
        <section className="bg-[#F8F9FF] py-20 sm:py-28 px-6 relative overflow-hidden">
          <div
            className="absolute top-0 left-[20%] w-[400px] h-[400px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />
          <div className="max-w-4xl mx-auto relative">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#03065E]/40 text-center mb-3">
              Proceso
            </h2>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#03065E] text-center mb-16">
              Cómo Empezar a Invertir
            </p>

            <div className="flex flex-col sm:flex-row gap-8 sm:gap-6">
              {STEPS.map((step, i) => (
                <div key={step.number} className="flex-1 text-center sm:text-left group">
                  <div className="text-4xl mb-4">{step.icon}</div>
                  <div className="text-3xl font-bold gradient-text mb-3 font-mono inline-block">
                    {step.number}
                  </div>
                  <h3 className="text-base font-semibold text-[#03065E] mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[#03065E]/50 leading-relaxed">
                    {step.description}
                  </p>
                  {i < 2 && (
                    <div className="hidden sm:block mt-6 border-t border-[#C9A84C]/20" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* CTA */}
      <ScrollReveal>
        <section className="relative py-24 sm:py-32 px-6 overflow-hidden" style={{ background: "linear-gradient(135deg, #03065E 0%, #0a0f6e 50%, #03065E 100%)" }}>
          <div
            className="absolute top-[30%] left-[15%] w-[300px] h-[300px] rounded-full animate-float-slow pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)",
              filter: "blur(50px)",
            }}
          />
          <div className="max-w-3xl mx-auto relative">
            <div className="glass rounded-3xl p-10 sm:p-14 text-center glow-gold">
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">
                ¿Listo para empezar?
              </p>
              <p className="text-sm text-white/45 mb-8 max-w-md mx-auto leading-relaxed">
                Contactanos y te asesoramos sin compromiso sobre el mejor camino para tu inversión.
              </p>
              <Link
                href="/contacto"
                className="group inline-flex items-center gap-2 bg-gradient-to-r from-[#C9A84C] to-[#d4b65e] text-[#03065E] font-semibold px-8 py-3.5 rounded-xl text-sm hover:shadow-[0_0_30px_rgba(201,168,76,0.3)] transition-all duration-300"
              >
                Contactanos
                <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
              </Link>
            </div>
          </div>
        </section>
      </ScrollReveal>
    </main>
  );
}
