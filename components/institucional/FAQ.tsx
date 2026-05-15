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
    <section className="section">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <div className="sec-num">03 / 03</div>
            <div className="cap-gold" style={{ marginTop: 8 }}>Preguntas frecuentes</div>
          </div>
          <div>
            <h2>Respuestas a lo que más nos consultan.</h2>
            <p className="dek">
              Si tu pregunta no está acá, escribinos. La mejor respuesta sigue siendo una conversación.
            </p>
          </div>
        </div>

        <ol style={{ listStyle: "none", padding: 0, margin: 0, borderTop: "1px solid var(--ink)" }}>
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <li
                key={i}
                style={{
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  style={{
                    width: "100%",
                    background: "none",
                    border: 0,
                    padding: "var(--space-4) 0",
                    display: "grid",
                    gridTemplateColumns: "60px 1fr 32px",
                    gap: "var(--space-4)",
                    alignItems: "baseline",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 13,
                      color: isOpen ? "var(--gold-deep)" : "var(--ink-3)",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="serif"
                    style={{
                      fontWeight: 400,
                      fontSize: 22,
                      lineHeight: 1.25,
                      color: "var(--ink)",
                      letterSpacing: "-0.015em",
                    }}
                  >
                    {item.question}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 24,
                      height: 24,
                      color: "var(--ink-2)",
                      transition: "transform 200ms ease",
                      transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M7 1v12M1 7h12" />
                    </svg>
                  </span>
                </button>

                <div
                  style={{
                    overflow: "hidden",
                    maxHeight: isOpen ? 320 : 0,
                    opacity: isOpen ? 1 : 0,
                    transition: "max-height 260ms ease, opacity 200ms ease",
                  }}
                >
                  <p
                    className="body-base"
                    style={{
                      margin: 0,
                      padding: "0 0 var(--space-5) 60px",
                      maxWidth: "44em",
                    }}
                  >
                    {item.answer}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <style>{`
        @media (max-width: 640px) {
          button[aria-expanded] { grid-template-columns: 40px 1fr 24px !important; }
          .body-base[style*="60px"] { padding-left: 40px !important; }
        }
      `}</style>
    </section>
  );
}
