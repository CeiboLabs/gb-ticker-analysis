import { Calculadora } from "@/components/institucional/Calculadora";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calculadora de Inversión | Gastón Bengochea",
  description: "Simulá el crecimiento de tu inversión con nuestra calculadora interactiva.",
};

const ESCENARIOS = [
  {
    title: "Conservador",
    retorno: "4-6%",
    descripcion:
      "Portafolio enfocado en bonos soberanos y renta fija de alta calidad. Menor volatilidad con retornos estables.",
    perfil: "Baja tolerancia al riesgo",
    color: "from-blue-500 to-blue-600",
    textColor: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Moderado",
    retorno: "6-10%",
    descripcion:
      "Combinación balanceada de renta fija y variable. Equilibrio entre crecimiento y protección del capital.",
    perfil: "Tolerancia media al riesgo",
    color: "from-[#C9A84C] to-[#d4b65e]",
    textColor: "text-[#C9A84C]",
    bgColor: "bg-[#C9A84C]/10",
  },
  {
    title: "Agresivo",
    retorno: "10-15%",
    descripcion:
      "Mayor exposición a renta variable y mercados emergentes. Potencial de alto retorno con mayor volatilidad.",
    perfil: "Alta tolerancia al riesgo",
    color: "from-emerald-500 to-emerald-600",
    textColor: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
  },
];

const CONCEPTOS = [
  {
    title: "Interés Compuesto",
    description:
      "El interés se calcula sobre el capital inicial más los intereses acumulados. Es el factor más poderoso para el crecimiento a largo plazo.",
    icon: "📈",
    color: "from-emerald-500 to-emerald-600",
  },
  {
    title: "Diversificación",
    description:
      "Distribuir la inversión entre diferentes activos reduce el riesgo total sin necesariamente sacrificar retorno.",
    icon: "🎯",
    color: "from-blue-500 to-blue-600",
  },
  {
    title: "Horizonte Temporal",
    description:
      "Cuanto más largo es el plazo, mayor es la capacidad de absorber volatilidad y aprovechar el crecimiento compuesto.",
    icon: "⏳",
    color: "from-purple-500 to-purple-600",
  },
  {
    title: "Aportes Regulares",
    description:
      "Invertir cantidades fijas de forma regular (DCA) suaviza el impacto de la volatilidad y construye disciplina.",
    icon: "🔄",
    color: "from-amber-500 to-amber-600",
  },
];

export default function CalculadoraPage() {
  return (
    <main className="pt-20">
      {/* Hero */}
      <section className="relative py-24 sm:py-32 px-6 overflow-hidden" style={{ background: "linear-gradient(135deg, #03065E 0%, #0a0f6e 50%, #03065E 100%)" }}>
        <div
          className="absolute top-[-10%] right-[10%] w-[500px] h-[500px] rounded-full animate-float-slow pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(201,168,76,0.15) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full animate-float-slow pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)",
            filter: "blur(70px)",
            animationDelay: "-6s",
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
            Calculadora de{" "}
            <span className="gradient-text">Inversión</span>
          </h1>
          <p className="text-base sm:text-lg text-white/45 max-w-lg mx-auto leading-relaxed">
            Simulá el crecimiento de tu inversión a lo largo del tiempo.
            Ajustá los parámetros para visualizar distintos escenarios.
          </p>
        </div>
      </section>

      {/* Calculator */}
      <section className="bg-[#F8F9FF] py-16 sm:py-24 px-6 relative overflow-hidden">
        <div
          className="absolute top-[10%] right-[-5%] w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div className="relative">
          <Calculadora />
        </div>
      </section>

      {/* Scenarios */}
      <ScrollReveal>
        <section className="relative py-20 sm:py-28 px-6 overflow-hidden" style={{ background: "linear-gradient(135deg, #03065E 0%, #080d5a 100%)" }}>
          <div
            className="absolute top-[20%] left-[10%] w-[400px] h-[400px] rounded-full animate-pulse-glow pointer-events-none"
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
              Perfiles de Inversión
            </h2>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white text-center mb-14">
              Escenarios de <span className="gradient-text">Retorno</span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {ESCENARIOS.map((e, i) => (
                <div
                  key={e.title}
                  className="group glass rounded-2xl p-7 hover:bg-white/[0.08] transition-all duration-500 gradient-border cursor-default"
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  <div className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${e.bgColor} ${e.textColor} mb-4`}>
                    {e.perfil}
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1">
                    {e.title}
                  </h3>
                  <p className={`text-3xl font-bold gradient-text font-mono mb-3 inline-block`}>
                    {e.retorno}
                  </p>
                  <p className="text-sm text-white/45 leading-relaxed">
                    {e.descripcion}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* Concepts */}
      <ScrollReveal>
        <section className="bg-[#F8F9FF] py-20 sm:py-28 px-6 relative overflow-hidden">
          <div
            className="absolute bottom-[10%] left-[10%] w-[300px] h-[300px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)",
              filter: "blur(50px)",
            }}
          />
          <div className="max-w-5xl mx-auto relative">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#03065E]/40 text-center mb-3">
              Educación Financiera
            </h2>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#03065E] text-center mb-14">
              Conceptos Clave
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {CONCEPTOS.map((c, i) => (
                <div
                  key={c.title}
                  className="group glass-light rounded-2xl p-7 glow-card transition-all duration-500 cursor-default gradient-border"
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-5 text-xl group-hover:scale-110 group-hover:shadow-lg transition-all duration-300`}>
                    {c.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-[#03065E] mb-2">
                    {c.title}
                  </h3>
                  <p className="text-sm text-[#03065E]/50 leading-relaxed">
                    {c.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>
    </main>
  );
}
