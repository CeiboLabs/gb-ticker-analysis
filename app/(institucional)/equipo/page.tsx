import { Equipo } from "@/components/institucional/Equipo";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Equipo | Gastón Bengochea",
  description: "Conocé al equipo de profesionales de Gastón Bengochea, Corredor de Bolsa.",
};

const CULTURA = [
  {
    title: "Excelencia Profesional",
    description:
      "Cada miembro de nuestro equipo está comprometido con los más altos estándares de calidad en el asesoramiento financiero.",
    icon: "⭐",
    color: "from-amber-500 to-amber-600",
  },
  {
    title: "Formación Continua",
    description:
      "Nuestro equipo se capacita constantemente en las últimas tendencias del mercado financiero global.",
    icon: "📚",
    color: "from-blue-500 to-blue-600",
  },
  {
    title: "Trabajo en Equipo",
    description:
      "Colaboramos internamente para ofrecer la mejor combinación de conocimientos y experiencia a cada cliente.",
    icon: "🤝",
    color: "from-emerald-500 to-emerald-600",
  },
  {
    title: "Integridad",
    description:
      "Actuamos con transparencia y ética en cada interacción, priorizando siempre el interés del cliente.",
    icon: "🛡️",
    color: "from-violet-500 to-violet-600",
  },
];

export default function EquipoPage() {
  return (
    <main className="pt-20">
      {/* Hero */}
      <section className="relative py-24 sm:py-32 px-6 overflow-hidden" style={{ background: "linear-gradient(135deg, #03065E 0%, #0a0f6e 50%, #03065E 100%)" }}>
        <div
          className="absolute top-[-15%] left-[30%] w-[500px] h-[500px] rounded-full animate-float-slow pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(201,168,76,0.1) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute bottom-[-10%] right-[-5%] w-[350px] h-[350px] rounded-full animate-float-slow pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)",
            filter: "blur(70px)",
            animationDelay: "-8s",
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
            Profesionales que impulsan tu{" "}
            <span className="gradient-text">inversión</span>
          </h1>
          <p className="text-base sm:text-lg text-white/45 max-w-lg mx-auto leading-relaxed">
            Un equipo multidisciplinario con décadas de experiencia en mercados
            financieros, comprometido con el crecimiento de tu patrimonio.
          </p>
        </div>
      </section>

      {/* Team grid */}
      <Equipo />

      {/* Culture */}
      <ScrollReveal>
        <section className="bg-[#F8F9FF] py-20 sm:py-28 px-6 relative overflow-hidden">
          <div
            className="absolute top-[20%] left-[-5%] w-[400px] h-[400px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />
          <div className="max-w-5xl mx-auto relative">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#03065E]/40 text-center mb-3">
              Nuestra Cultura
            </h2>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#03065E] text-center mb-14">
              Cómo Trabajamos
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {CULTURA.map((c, i) => (
                <div
                  key={c.title}
                  className="group glass-light rounded-2xl p-8 glow-card transition-all duration-500 cursor-default gradient-border"
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-5 text-xl group-hover:scale-110 group-hover:shadow-lg transition-all duration-300`}>
                    {c.icon}
                  </div>
                  <h3 className="text-base font-semibold text-[#03065E] mb-3">
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
