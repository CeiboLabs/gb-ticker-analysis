"use client";

import { useState } from "react";

const FAQ_ITEMS = [
  {
    question: "¿Cómo se abre una cuenta?",
    answer:
      "La apertura se inicia con una reunión presencial o por videollamada. Recolectamos la documentación que exige la normativa del Banco Central del Uruguay, completamos el KYC y, una vez aprobada, la cuenta queda operativa a nombre del cliente.",
  },
  {
    question: "¿Cuál es la inversión mínima?",
    answer:
      "Varía por producto y por mercado. Tenemos alternativas para perfiles distintos. En la primera conversación dimensionamos lo que tenga sentido para tu situación específica.",
  },
  {
    question: "¿Están regulados?",
    answer:
      "Sí. Operamos bajo regulación y supervisión del Banco Central del Uruguay, y somos miembros de la Bolsa de Valores de Montevideo desde 1967.",
  },
  {
    question: "¿Cómo se custodia mi patrimonio?",
    answer:
      "En cuentas segregadas a nombre del cliente, separadas del patrimonio de la firma. Eso significa que tus activos no se mezclan con el balance de Bengochea & Cía. en ningún momento.",
  },
  {
    question: "¿A qué mercados se accede?",
    answer:
      "NYSE, NASDAQ, LSE, Euronext, XETRA, BVM, BYMA y B3. Renta fija, renta variable, ETFs, fondos y productos estructurados, en USD, EUR y monedas locales según el instrumento.",
  },
  {
    question: "¿Hay asesoramiento personalizado?",
    answer:
      "Es el modo en el que trabajamos. Cada cliente tiene un asesor principal de la casa con quien discute la estrategia y de quien recibe ejecución y reporte.",
  },
  {
    question: "¿Cómo sigo mis inversiones?",
    answer:
      "Reportes periódicos consolidados y acceso a la mesa para consultas puntuales. La forma exacta del reporting se acuerda al inicio de la relación.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="site">
      <section className="band site-section">
        <div className="site-wrap">
          <div className="split-label">
            <div className="eyebrow-sm">Preguntas frecuentes</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "14em" }}>Respuestas a lo que más nos consultan.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                Si tu pregunta no está acá, escribinos. La mejor respuesta sigue siendo una conversación.
              </p>
            </div>
          </div>

          <div style={{ marginTop: 56, borderTop: "1px solid var(--site-border)" }}>
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openIndex === i;
              return (
                <div key={i} style={{ borderBottom: "1px solid var(--site-border)" }}>
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    style={{
                      width: "100%",
                      background: "none",
                      border: 0,
                      padding: "28px 4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 24,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "clamp(19px, 1.9vw, 24px)",
                        fontWeight: 400,
                        letterSpacing: "-0.015em",
                        color: isOpen ? "var(--navy)" : "var(--site-ink)",
                        transition: "color 200ms ease",
                      }}
                    >
                      {item.question}
                    </span>
                    <span
                      aria-hidden
                      style={{
                        width: 26,
                        height: 26,
                        flex: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: isOpen ? "var(--navy)" : "var(--site-ink-3)",
                        transition: "transform 220ms ease, color 200ms ease",
                        transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                        <path d="M9 1v16M1 9h16" />
                      </svg>
                    </span>
                  </button>

                  <div
                    style={{
                      overflow: "hidden",
                      maxHeight: isOpen ? 400 : 0,
                      opacity: isOpen ? 1 : 0,
                      transition: "max-height 280ms ease, opacity 200ms ease",
                    }}
                  >
                    <p
                      className="t-body"
                      style={{ margin: 0, padding: "0 4px 32px", maxWidth: "48em" }}
                    >
                      {item.answer}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
