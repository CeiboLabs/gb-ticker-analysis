"use client";

import { useState } from "react";

// Preguntas frecuentes del fondo. Las respuestas se mantienen en términos
// generales del producto (sin cifras de performance todavía): qué es, para
// quién, cómo se accede y cómo se sigue. Cuando haya documentación legal del
// fondo, enlazarla desde la sección Documentos.
const ITEMS: { q: string; a: string }[] = [
  {
    q: "¿Qué es BNG Selección Global?",
    a: "Es una estrategia de crecimiento balanceado que invierte en diferentes clases de activos para construir una cartera con exposición a renta variable y renta fija a nivel global. Está domiciliada en Uruguay.",
  },
  {
    q: "¿Para qué perfil de inversor está pensado?",
    a: "Para quien busca una cartera diversificada y global en un solo vehículo, con un horizonte de mediano a largo plazo, sin tener que seleccionar y rebalancear instrumentos por su cuenta. En una conversación con un asesor se evalúa si encaja con tus objetivos.",
  },
  {
    q: "¿Cómo se accede a BNG Selección Global?",
    a: "A través de Gastón Bengochea, sociedad de bolsa regulada por el Banco Central del Uruguay. El primer paso es contactar a un asesor nuestro, que te explica el producto y acompaña la suscripción.",
  },
  {
    q: "¿Cómo sigo la evolución de BNG Selección Global?",
    a: "Esta misma página publica el valor cuota y los activos bajo manejo con actualización diaria, además de un gráfico con la evolución de la performance y los rendimientos por período. Tu asesor complementa con reportes periódicos.",
  },
  {
    q: "¿Qué significa que sea una estrategia balanceada?",
    a: "Balanceado: combina renta variable y renta fija en una misma cartera.",
  },
  {
    q: "¿Dónde puedo obtener más información?",
    a: "Escribinos desde el formulario de contacto o pedí una reunión con un asesor. La documentación del fondo —ficha técnica, reglamento e informes— está disponible a pedido desde la sección Documentos de esta página.",
  },
];

export function FondoFAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div style={{ borderTop: "1px solid var(--site-border)" }}>
      {ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} style={{ borderBottom: "1px solid var(--site-border)" }}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              style={{
                width: "100%", background: "none", border: 0, padding: "28px 4px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 24, cursor: "pointer", textAlign: "left",
              }}
            >
              <span style={{
                fontSize: "clamp(19px, 1.9vw, 24px)", fontWeight: 400, letterSpacing: "-0.015em",
                color: isOpen ? "var(--navy)" : "var(--site-ink)", transition: "color 200ms ease",
              }}>
                {item.q}
              </span>
              <span aria-hidden style={{
                width: 26, height: 26, flex: "none", display: "inline-flex", alignItems: "center",
                justifyContent: "center", color: isOpen ? "var(--navy)" : "var(--site-ink-3)",
                transition: "transform 220ms ease, color 200ms ease",
                transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
              }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <path d="M9 1v16M1 9h16" />
                </svg>
              </span>
            </button>
            <div style={{
              overflow: "hidden", maxHeight: isOpen ? 400 : 0, opacity: isOpen ? 1 : 0,
              transition: "max-height 280ms ease, opacity 200ms ease",
            }}>
              <p className="t-body" style={{ margin: 0, padding: "0 4px 32px", maxWidth: "48em" }}>
                {item.a}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
