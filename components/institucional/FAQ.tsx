"use client";

import { useState } from "react";

const FAQ_ITEMS = [
  {
    question: "¿Cómo puedo abrir una cuenta?",
    answer:
      "El proceso es sencillo. Podés contactarnos por teléfono, email o visitarnos en nuestras oficinas en el World Trade Center. Te guiamos paso a paso en la apertura de cuenta, que incluye la documentación requerida por las normas del Banco Central del Uruguay.",
  },
  {
    question: "¿Cuál es la inversión mínima?",
    answer:
      "Los montos mínimos varían según el tipo de producto. Contamos con alternativas para distintos perfiles y capacidades de inversión. Contactanos para conocer las opciones que mejor se adapten a tus posibilidades.",
  },
  {
    question: "¿Están regulados?",
    answer:
      "Sí. Gastón Bengochea CB opera bajo la supervisión del Banco Central del Uruguay (BCU) y es miembro de la Bolsa de Valores de Montevideo desde 1967. Cumplimos con todas las normativas vigentes del mercado financiero.",
  },
  {
    question: "¿Mis fondos están seguros?",
    answer:
      "Absolutamente. Trabajamos con cuentas segregadas, lo que significa que tus activos siempre están bajo tu titularidad legal. Tu patrimonio nunca se mezcla con los fondos de la empresa, garantizando la máxima protección.",
  },
  {
    question: "¿A qué mercados puedo acceder?",
    answer:
      "A través de nuestra plataforma tenés acceso a mercados internacionales incluyendo Estados Unidos, Europa y Latinoamérica. Ofrecemos bonos, acciones, fondos de inversión y fideicomisos tanto nacionales como internacionales.",
  },
  {
    question: "¿Ofrecen asesoramiento personalizado?",
    answer:
      "Sí, es uno de nuestros pilares. Cada cliente recibe atención personalizada de nuestro equipo de asesores. Escuchamos tus necesidades, evaluamos tu perfil de riesgo y diseñamos una estrategia de inversión acorde a tus objetivos.",
  },
  {
    question: "¿Cómo puedo seguir mis inversiones?",
    answer:
      "Te brindamos herramientas y reportes periódicos para que puedas monitorear el desempeño de tu portafolio. Además, nuestro equipo está disponible para consultas en cualquier momento.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="bg-[#F8F9FF] py-20 sm:py-28 px-6 relative overflow-hidden">
      <div
        className="absolute bottom-[10%] right-[-5%] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <div className="max-w-3xl mx-auto relative">
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#03065E]/40 text-center mb-3">
          Preguntas Frecuentes
        </h2>
        <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#03065E] text-center mb-14">
          Respuestas a tus Consultas
        </p>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className={`glass-light rounded-2xl overflow-hidden transition-all duration-300 ${isOpen ? "glow-gold" : ""}`}
              >
                <button
                  className="w-full flex items-center justify-between p-5 sm:p-6 text-left group"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-medium text-[#03065E] pr-4 group-hover:text-[#C9A84C] transition-colors">
                    {item.question}
                  </span>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ${isOpen ? "bg-gradient-to-br from-[#C9A84C] to-[#d4b65e] text-[#03065E]" : "bg-[#03065E]/5 text-[#03065E]/30"}`}>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="transition-transform duration-300"
                      style={{
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    >
                      <path d="M5 8l5 5 5-5" />
                    </svg>
                  </div>
                </button>

                <div
                  className="overflow-hidden transition-all duration-300"
                  style={{
                    maxHeight: isOpen ? "200px" : "0",
                    opacity: isOpen ? 1 : 0,
                  }}
                >
                  <p className="text-sm text-[#03065E]/50 leading-relaxed px-5 sm:px-6 pb-5 sm:pb-6">
                    {item.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
