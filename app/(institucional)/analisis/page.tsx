"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TickerSearch } from "@/components/TickerSearch";
import { ScrollReveal } from "@/components/landing/ScrollReveal";

const FEATURES = [
  {
    title: "Veredicto de Inversión",
    description: "Recomendación BUY, HOLD o AVOID con nivel de convicción y rationale cuantitativo.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
  {
    title: "Métricas Financieras Clave",
    description: "12 indicadores en tiempo real: P/E, márgenes, revenue, FCF, beta y más.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    title: "Gráfico de Precio Interactivo",
    description: "3 años de datos históricos con revenue trimestral superpuesto.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    title: "Diagrama Sankey de Ingresos",
    description: "Desglose visual de revenue, costos y márgenes desde SEC EDGAR.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 16l4-8 4 4 4-8" />
      </svg>
    ),
  },
  {
    title: "Consenso de Analistas",
    description: "Objetivos de precio, potencial de upside y distribución de ratings de Wall Street.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: "Exportación PDF",
    description: "Descargá el reporte completo en formato profesional listo para compartir.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <polyline points="9 15 12 18 15 15" />
      </svg>
    ),
  },
];

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

export default function AnalisisPage() {
  const router = useRouter();

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("ticker");
    if (t) {
      router.replace(`/analyze?ticker=${encodeURIComponent(t)}`);
    }
  }, [router]);

  function handleSearch(ticker: string) {
    router.push(`/analyze?ticker=${encodeURIComponent(ticker.trim().toUpperCase())}`);
  }

  return (
    <main className="pt-20">
      {/* Hero */}
      <section className="bg-[#03065E] text-white px-6 py-24 sm:py-32 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="max-w-3xl mx-auto text-center relative">
          <h1 className="text-xs font-semibold uppercase tracking-[0.3em] text-white/35 mb-4">
            Análisis de Acciones
          </h1>
          <p className="text-3xl md:text-4xl lg:text-5xl font-bold mb-5 leading-tight">
            Reportes con Calidad{" "}
            <span className="text-[#C9A84C]">Profesional</span>
          </p>
          <p className="text-base sm:text-lg text-white/55 max-w-xl mx-auto mb-10">
            Investigación de renta variable con calidad profesional para
            acciones listadas en EE.UU. Datos reales. Veredictos claros. En
            segundos.
          </p>

          <div className="w-full max-w-md mx-auto mb-4">
            <TickerSearch variant="hero" onSubmit={handleSearch} />
          </div>

          <p className="text-xs text-white/30 tracking-wide">
            Probá con Apple, Tesla, MELI o cualquier empresa listada en EE.UU.
          </p>
        </div>
      </section>

      {/* Features */}
      <ScrollReveal>
        <section className="bg-[#F8F9FF] py-20 sm:py-28 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#03065E]/40 text-center mb-3">
              Funcionalidades
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-[#03065E] text-center mb-14">
              Qué Incluye Cada Reporte
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="bg-white border border-[#03065E]/8 rounded-xl p-6 hover:shadow-lg transition-shadow duration-300"
                >
                  <div className="text-[#03065E]/50 mb-4">{f.icon}</div>
                  <h3 className="text-sm font-semibold text-[#03065E] mb-2">{f.title}</h3>
                  <p className="text-sm text-[#03065E]/50 leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* How it works */}
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
          <div className="max-w-4xl mx-auto relative">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-white/35 text-center mb-3">
              Proceso
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-white text-center mb-16">
              Cómo Funciona
            </p>

            <div className="flex flex-col sm:flex-row gap-8 sm:gap-6">
              {STEPS.map((step, i) => (
                <div key={step.number} className="flex-1 text-center sm:text-left">
                  <div className="text-3xl font-bold text-[#C9A84C] mb-4 font-mono">
                    {step.number}
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-white/50 leading-relaxed">
                    {step.description}
                  </p>
                  {i < STEPS.length - 1 && (
                    <div className="hidden sm:block mt-6 border-t border-white/10" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* CTA */}
      <ScrollReveal>
        <section className="bg-[#F8F9FF] border-t-2 border-[#C9A84C]/30 py-16 sm:py-20 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-2xl sm:text-3xl font-bold text-[#03065E] mb-3">
              Comenzá tu Análisis
            </p>
            <p className="text-sm text-[#03065E]/45 mb-8">
              Buscá cualquier empresa listada en EE.UU. y recibí un reporte
              profesional en segundos.
            </p>
            <div className="max-w-md mx-auto mb-8">
              <TickerSearch variant="footer" onSubmit={handleSearch} />
            </div>
            <p className="text-xs text-[#03065E]/25">
              Datos de Yahoo Finance · SEC EDGAR · Análisis por OpenAI GPT-4o
            </p>
          </div>
        </section>
      </ScrollReveal>
    </main>
  );
}
