"use client";

import { useState } from "react";

// Preguntas frecuentes del fondo. Sin cifras de performance: el Fondo todavía
// no comenzó a funcionar.
//
// ⚠️ Toda respuesta con contenido legal sale del Reglamento de Gestión aprobado
// por el BCU o de la Resolución RR-SSF-2026-434, los dos publicados en la
// sección Documentos de esta misma página. Los literales que se citan en los
// comentarios son los del "Resumen de las características del Fondo".
const ITEMS: { q: string; a: string }[] = [
  {
    q: "¿Qué es BNG Selección Global?",
    // Nombre registral + tipo, del literal (b) y de la cláusula 1: fondo
    // abierto, de plazo ilimitado, regido por la Ley N° 16.774.
    a: "Es un fondo de inversión uruguayo —«Fondo BNG Selección Global, Fondo de Inversión»—, abierto y de plazo ilimitado, con una estrategia de crecimiento balanceado: invierte en diferentes clases de activos para construir una cartera con exposición a renta variable y renta fija a nivel global.",
  },
  {
    q: "¿Para qué perfil de inversor está pensado?",
    a: "Para quien busca una cartera diversificada y global en un solo vehículo, con un horizonte de mediano a largo plazo, sin tener que seleccionar y rebalancear instrumentos por su cuenta. En una conversación con un asesor se evalúa si encaja con tus objetivos.",
  },
  {
    q: "¿Cómo se accede a BNG Selección Global?",
    // La contraparte de la suscripción es la Sociedad Administradora, no la
    // sociedad de bolsa: suscribir implica adhesión de pleno derecho al
    // Reglamento (cláusula 8.3, art. 17 de la Ley N° 16.774).
    a: "El Fondo lo administra Valores Administradora de Fondos de Inversión y Fideicomisos S.A. y la gestión de la cartera está a cargo de Gastón Bengochea y Compañía Corredor de Bolsa S.A. El primer paso es contactar a un asesor nuestro, que te explica el producto y acompaña la suscripción. Suscribir cuotapartes implica la adhesión al Reglamento de Gestión, así que conviene leerlo antes: se descarga en la sección Documentos de esta página.",
  },
  {
    q: "¿Cómo se suscribe y cómo se rescata?",
    // Literales (h), (i), (j) y (k) del resumen; cláusulas 9.3 y 9.5.
    // Va lo que el lector necesita para decidir —cuánto entra, cada cuánto sale,
    // cuándo cobra— y NO la letra chica operativa (hora de corte, fecha de
    // valuación, cuenta de destino): eso es término del contrato y vive en el
    // Reglamento, que la página publica.
    a: "El mínimo de suscripción es de USD 100 por titular, sin monto máximo, y las suscripciones se procesan en forma diaria. Los rescates se solicitan en cualquier momento por medios digitales, se procesan los martes y viernes hábiles y se pagan en dólares dentro de los 4 días hábiles siguientes. No hay comisión de rescate. Los horarios de corte y el detalle del procedimiento están en el Reglamento de Gestión.",
  },
  {
    q: "¿Qué costos tiene?",
    // Cláusulas 12.1, 12.2 y 12.3. La comisión se cobra AL FONDO, así que el
    // valor cuota ya nace neta de ella. Y NO es el único costo: por eso se dice
    // que existen gastos y tributos, pero NO se transcribe acá el tope del 2%
    // anual ni la excepción del primer año. Son términos del contrato y están en
    // el Reglamento; sacados de contexto, un techo que probablemente nunca se
    // use se lee como si fuera el costo real.
    a: "La comisión del Fondo es de hasta 1,5% anual, IVA incluido, sobre su patrimonio neto: se devenga a diario y se cobra al Fondo, por lo que el valor cuota ya se publica neta de ella. Incluye lo que corresponde a la Sociedad Administradora, al Gestor y a la distribución de las cuotapartes — no se suma el tarifario de la sociedad de bolsa. No hay comisión de rescate. El Fondo soporta además los gastos propios de su funcionamiento, y los tributos que gravan los rendimientos son de cargo del inversor: el detalle está en el Reglamento de Gestión.",
  },
  {
    q: "¿Quién administra y quién controla el fondo?",
    // La resolución AUTORIZA A CONTRATAR a EY (punto 2); todavía no hay estados
    // contables del Fondo, que aún no comenzó a funcionar.
    a: "El Fondo lo administra Valores Administradora de Fondos de Inversión y Fideicomisos S.A., sociedad autorizada por el Banco Central del Uruguay, y la gestión de la cartera está a cargo de Gastón Bengochea y Compañía Corredor de Bolsa S.A. El Banco Central aprobó el reglamento de gestión, inscribió al Fondo en el Registro del Mercado de Valores y autorizó la contratación de Ernst & Young Uy S.A.S. —firma inscripta en el Registro de Auditores Externos del Banco Central— como auditor externo del Fondo.",
  },
  {
    q: "¿Cómo sigo la evolución de BNG Selección Global?",
    // En futuro: el Fondo aún no comenzó a funcionar y Performance muestra el
    // estado "en proceso de lanzamiento". La fuente oficial del valor cuota y
    // del detalle de cartera es la Sociedad Administradora (cláusula 8.3).
    a: "Cuando el Fondo comience a funcionar, esta misma página publicará el valor cuota y los activos bajo manejo con actualización diaria, además de un gráfico con la evolución y los rendimientos por período. La información oficial —valor cuota, detalle de la cartera y estados de cuenta— la pone a disposición la Sociedad Administradora en los términos del Reglamento, y tu asesor complementa con reportes periódicos.",
  },
  {
    q: "¿Qué significa que sea una estrategia balanceada?",
    // La TABLA de Límites (3.3.1) no se transcribe: es término del contrato y
    // está en el Reglamento. Acá alcanza con que la asignación es activa y
    // acotada. (Detalle no menor: publicar "renta fija de grado especulativo
    // 0%-50%" sin el contexto del documento entero define al fondo por su peor
    // escenario permitido.)
    a: "Que combina renta variable y renta fija en una misma cartera, con un complemento táctico de activos alternativos. La asignación no es fija: se ajusta de forma activa según el contexto de mercado, dentro de los límites que fija el Reglamento de Gestión.",
  },
  {
    q: "¿Dónde puedo obtener más información?",
    a: "Escribinos desde el formulario de contacto o pedí una reunión con un asesor. En la sección Documentos de esta página está la documentación del fondo: el reglamento y la autorización del Banco Central se descargan ahí mismo, y el factsheet y los informes te los hace llegar un asesor.",
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
              // 760 y no 400: las respuestas legales (costos, quién administra)
              // son largas y en pantallas angostas se cortaban.
              overflow: "hidden", maxHeight: isOpen ? 760 : 0, opacity: isOpen ? 1 : 0,
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
