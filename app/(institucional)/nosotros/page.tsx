import { Nosotros } from "@/components/institucional/Nosotros";
import { PorQueElegirnos } from "@/components/institucional/PorQueElegirnos";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nosotros | Gastón Bengochea",
  description: "Miembros de la Bolsa de Valores de Montevideo desde 1967. Conocé nuestra historia, misión y valores.",
};

const TIMELINE = [
  {
    year: "1967",
    title: "Fundación",
    description:
      "Gastón Bengochea se incorpora como miembro de la Bolsa de Valores de Montevideo, marcando el inicio de una trayectoria de excelencia.",
    icon: "🏛️",
    color: "from-amber-500 to-amber-600",
  },
  {
    year: "1980s",
    title: "Consolidación",
    description:
      "Décadas de crecimiento sostenido posicionan a la firma como referente en el mercado de valores local.",
    icon: "📈",
    color: "from-blue-500 to-blue-600",
  },
  {
    year: "2000s",
    title: "Expansión Internacional",
    description:
      "Ampliación del ecosistema con acceso a mercados internacionales, bonos globales y nuevos productos financieros.",
    icon: "🌎",
    color: "from-emerald-500 to-emerald-600",
  },
  {
    year: "2010s",
    title: "Innovación Tecnológica",
    description:
      "Incorporación de herramientas digitales y plataformas modernas para mejorar la experiencia del inversor.",
    icon: "💡",
    color: "from-purple-500 to-purple-600",
  },
  {
    year: "Hoy",
    title: "Liderazgo Continuo",
    description:
      "Con casi seis décadas de experiencia, seguimos evolucionando para ofrecer el mejor servicio a miles de clientes.",
    icon: "🚀",
    color: "from-[#C9A84C] to-[#d4b65e]",
  },
];

const REGULACION = [
  {
    title: "Banco Central del Uruguay",
    description:
      "Operamos bajo la supervisión y regulación del BCU, cumpliendo con todas las normativas vigentes del mercado financiero uruguayo.",
    icon: "🏦",
    color: "from-blue-500 to-blue-600",
  },
  {
    title: "Bolsa de Valores de Montevideo",
    description:
      "Somos miembros activos de la BVM desde 1967, participando en el desarrollo del mercado de capitales del país.",
    icon: "🏛️",
    color: "from-emerald-500 to-emerald-600",
  },
  {
    title: "Código de Ética",
    description:
      "Adherimos a estrictos códigos de ética y buenas prácticas que rigen nuestra actividad profesional.",
    icon: "📜",
    color: "from-amber-500 to-amber-600",
  },
  {
    title: "Cuentas Segregadas",
    description:
      "Los activos de nuestros clientes se mantienen en cuentas segregadas, garantizando su titularidad legal.",
    icon: "🔒",
    color: "from-violet-500 to-violet-600",
  },
];

export default function NosotrosPage() {
  return (
    <main className="pt-20">
      {/* Hero */}
      <section className="relative py-24 sm:py-32 px-6 overflow-hidden" style={{ background: "linear-gradient(135deg, #03065E 0%, #0a0f6e 50%, #03065E 100%)" }}>
        <div
          className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full animate-float-slow pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(201,168,76,0.1) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute bottom-[-15%] right-[-10%] w-[400px] h-[400px] rounded-full animate-float-slow pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
            filter: "blur(80px)",
            animationDelay: "-7s",
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
            Casi seis décadas de{" "}
            <span className="gradient-text">confianza</span>
          </h1>
          <p className="text-base sm:text-lg text-white/45 max-w-lg mx-auto leading-relaxed">
            Desde 1967, hemos construido relaciones duraderas basadas en la
            transparencia, la profesionalidad y el compromiso con tus objetivos financieros.
          </p>
        </div>
      </section>

      {/* Mission & Values */}
      <Nosotros />

      {/* Timeline */}
      <ScrollReveal>
        <section className="bg-[#F8F9FF] py-20 sm:py-28 px-6 relative overflow-hidden">
          <div
            className="absolute top-[30%] right-[-5%] w-[400px] h-[400px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />
          <div className="max-w-4xl mx-auto relative">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#03065E]/40 text-center mb-3">
              Nuestra Historia
            </h2>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#03065E] text-center mb-16">
              Un Camino de Excelencia
            </p>

            <div className="relative">
              {/* Vertical line with gradient */}
              <div
                className="absolute left-6 sm:left-1/2 top-0 bottom-0 w-px -translate-x-1/2"
                style={{ background: "linear-gradient(to bottom, transparent, rgba(201,168,76,0.3), rgba(201,168,76,0.3), transparent)" }}
              />

              <div className="space-y-12">
                {TIMELINE.map((item, i) => (
                  <div
                    key={item.year}
                    className={`relative flex flex-col sm:flex-row gap-6 sm:gap-10 ${
                      i % 2 === 0 ? "sm:flex-row" : "sm:flex-row-reverse"
                    }`}
                  >
                    {/* Dot */}
                    <div className={`absolute left-6 sm:left-1/2 w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} -translate-x-1/2 flex items-center justify-center text-lg z-10 shadow-lg`}>
                      {item.icon}
                    </div>

                    {/* Content */}
                    <div className={`flex-1 pl-16 sm:pl-0 ${i % 2 === 0 ? "sm:text-right sm:pr-16" : "sm:text-left sm:pl-16"}`}>
                      <span className="text-xs font-bold gradient-text font-mono tracking-wider inline-block mb-1">
                        {item.year}
                      </span>
                      <h3 className="text-base font-semibold text-[#03065E] mb-2">
                        {item.title}
                      </h3>
                      <p className="text-sm text-[#03065E]/50 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="hidden sm:block flex-1" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* Why choose us */}
      <ScrollReveal>
        <PorQueElegirnos />
      </ScrollReveal>

      {/* Regulation */}
      <ScrollReveal>
        <section className="relative py-20 sm:py-28 px-6 overflow-hidden" style={{ background: "linear-gradient(135deg, #03065E 0%, #080d5a 100%)" }}>
          <div
            className="absolute top-[-10%] right-[10%] w-[400px] h-[400px] rounded-full animate-pulse-glow pointer-events-none"
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
              Regulación y Transparencia
            </h2>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white text-center mb-14">
              Tu Seguridad es Nuestra <span className="gradient-text">Prioridad</span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {REGULACION.map((r, i) => (
                <div
                  key={r.title}
                  className="group glass rounded-2xl p-7 hover:bg-white/[0.08] transition-all duration-500 gradient-border cursor-default"
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${r.color} flex items-center justify-center mb-5 text-xl group-hover:scale-110 group-hover:shadow-lg transition-all duration-300`}>
                    {r.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-3">
                    {r.title}
                  </h3>
                  <p className="text-sm text-white/45 leading-relaxed">
                    {r.description}
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
