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
    //
    // ⚠️ LA ESTRUCTURA VA ACÁ, no sólo en los paneles de Cartera. El Reglamento
    // (3.1) dice que el Fondo invierte "predominantemente en cuotaspartes o
    // participaciones de fondos de inversión, fondos mutuos, o fondos de
    // inversión estructurados como ETFs": es un hecho estructural, no un detalle
    // de implementación. Sin esto, el titular de la página ("Acciones + Bonos +
    // Activos alternativos") se lee como tenencia directa. Sobrevivió a la
    // reescritura del cliente ("invirtiendo principalmente a través de ETFs y
    // Fondos Mutuos"): no lo saques.
    //
    // Redacción del cliente (5-ago-2026). Lo que se fue respecto de la anterior:
    // la deuda directa de soberanos y organismos internacionales (Activo
    // Elegible B). Entró en cambio "aprobado por el BCU" y la tercera clase
    // (alternativos), que antes no figuraba en esta respuesta.
    a: "Es un fondo de inversión domiciliado en Uruguay —«Fondo BNG Selección Global, Fondo de Inversión»—, aprobado por el BCU, abierto y de plazo ilimitado. El mismo utiliza una estrategia de crecimiento balanceado: el portafolio cuenta con exposición a renta variable, renta fija y activos alternativos a nivel global, invirtiendo principalmente a través de ETFs y Fondos Mutuos.",
  },
  {
    q: "¿Para qué perfil de inversor está pensado?",
    // Redacción del cliente (5-ago-2026). Define el perfil por RIESGO —moderado,
    // menos volátil que 100% renta variable— donde antes se definía por
    // comportamiento (un solo vehículo, horizonte largo, sin rebalancear). La
    // comparación de volatilidad es una afirmación del equipo del fondo sobre su
    // propio producto; el que la puso es quien lo gestiona.
    a: "Para un perfil de riesgo moderado, quien busca exposición a crecimiento de capital pero con menor volatilidad que invirtiendo 100% en renta variable.",
  },
  {
    q: "¿Cómo se accede a BNG Selección Global?",
    // Redacción del cliente (5-ago-2026): queda sólo el paso comercial.
    //
    // Los dos hechos que se fueron de acá NO desaparecieron de la página, y por
    // eso el recorte se pudo aplicar:
    //   · quién administra y quién gestiona → sigue completo en "¿Quién
    //     administra y quién controla el fondo?", tres preguntas más abajo;
    //   · la adhesión al Reglamento (cláusula 8.3, art. 17 de la Ley N° 16.774)
    //     → sigue en «Información legal», al pie ("La suscripción de cuotapartes
    //     implica la adhesión al Reglamento de Gestión, cuya lectura previa se
    //     recomienda").
    // Si alguna de esas dos piezas se cae de su lugar actual, esta respuesta
    // vuelve a ser el único lugar donde el dato existía: revisar antes de tocar.
    a: "El primer paso es contactar a un asesor nuestro, que te explicará el producto y acompañará en la suscripción.",
  },
  {
    q: "¿Cómo se suscribe y cómo se rescata?",
    // Literales (h), (i), (j) y (k) del resumen; cláusulas 9.3 y 9.5.
    // Va lo que el lector necesita para decidir —cuánto entra, cada cuánto sale,
    // cuándo cobra— y NO la letra chica operativa (hora de corte, fecha de
    // valuación, cuenta de destino): eso es término del contrato y vive en el
    // Reglamento, que la página publica.
    //
    // ⚠️ ACÁ VIVÍAN LOS DOS LÍMITES A LA LIQUIDEZ, y los sacó el cliente en la
    // pasada del 5-ago-2026. Lo que decía la respuesta y de dónde salía:
    //   · 9.5 — el plazo de 4 días cede ante "causas no imputables a la Sociedad
    //     Administradora (tales como huelgas, feriados bancarios, o demoras o
    //     incumplimientos de Custodios y/o terceros)". Este NO quedó en ningún
    //     otro lado de la página: hoy el plazo de 4 días hábiles se afirma sin
    //     su salvedad. Es la pérdida real de este recorte.
    //   · 9.8 — el rescate se puede SUSPENDER hasta 3 meses como medida de
    //     defensa del patrimonio común (art. 20 de la Ley N° 16.774). Éste sí
    //     sigue en la página, textual, en «Información legal» al pie.
    // También se fue "No hay comisión de rescate" (literal (k)), que es un dato
    // favorable al inversor y sigue disponible en el Reglamento.
    //
    // El principio que lo sostenía —un producto que se presenta como líquido
    // tiene que decir dónde termina esa liquidez— sigue siendo el correcto y por
    // eso queda escrito. Pero es una objeción ya planteada y resuelta por quien
    // decide: no la revuelvas por tu cuenta.
    a: "El mínimo de suscripción es de USD 100 por titular, sin monto máximo, y las suscripciones se procesan en forma diaria. Los rescates se solicitan en cualquier momento por medios digitales, se procesan los martes y viernes hábiles y se pagan en dólares dentro de los 4 días hábiles siguientes. Los horarios de corte y el detalle del procedimiento están en el Reglamento de Gestión.",
  },
  {
    q: "¿Qué costos tiene?",
    // Cláusula 12.1: "como máximo", "descontado de provisiones", "incluyendo el
    // Impuesto al Valor Agregado" — los tres calificativos son del texto, no
    // glosa. La comisión se cobra AL FONDO, así que el valor cuota ya nace neta
    // de ella (por eso la calculadora la descuenta una sola vez: netear de nuevo
    // sobre la serie real la contaría dos veces, ver FondoCalculadora).
    //
    // ⚠️ EL RECORTE MÁS SENSIBLE DE LA PASADA DEL CLIENTE (5-ago-2026). La
    // respuesta quedó en la comisión del Fondo y nada más. Lo que se fue:
    //
    //   · LA SEGUNDA CAPA DE COMISIONES. El propio Reglamento la enumera como
    //     factor de riesgo 7 ("costos adicionales por comisiones de
    //     administración en DOS NIVELES: el del Fondo y el de los vehículos
    //     subyacentes") y la cláusula 3.1 dice que el Fondo invierte
    //     "predominantemente" a través de ellos: no es un costo marginal, es
    //     estructural. La respuesta de hoy contesta "¿Qué costos tiene?" con un
    //     número —1,5%— que no es el costo total de estar invertido.
    //   · los gastos de funcionamiento (12.2) y los tributos a cargo del
    //     inversor (12.3);
    //   · que la comisión es MODIFICABLE con 15 días de preaviso y ventana de
    //     rescate (12.1 y 14.2);
    //   · la comisión de liquidación de 5% por única vez (5.2);
    //   · "no se suma el tarifario de la sociedad de bolsa" y "no hay comisión
    //     de rescate", que eran los dos datos favorables de la respuesta.
    //
    // Ninguno de esos quedó en otra parte de la página: el único que se puede
    // reconstruir es el segundo nivel de comisiones, y de forma indirecta, por
    // la estructura declarada en "¿Qué es BNG Selección Global?" y en Estrategia.
    //
    // La objeción está planteada y resuelta por quien decide. Queda escrita para
    // que quien la vuelva a levantar sepa que ya se discutió — NO la reviertas
    // por iniciativa propia. Si el día de mañana hay que reponer una sola línea,
    // la que más pesa es la de los dos niveles de comisión.
    a: "La comisión del Fondo es de hasta 1,5% anual, IVA incluido, sobre su patrimonio neto descontado de provisiones: se devenga a diario y se cobra al Fondo, por lo que el valor cuota ya se publica neta de ella.",
  },
  {
    q: "¿Quién administra y quién controla el fondo?",
    // La resolución AUTORIZA A CONTRATAR a EY (punto 2); todavía no hay estados
    // contables del Fondo, que aún no comenzó a funcionar.
    a: "El Fondo lo administra Valores Administradora de Fondos de Inversión y Fideicomisos S.A., sociedad autorizada por el Banco Central del Uruguay, y la gestión de la cartera está a cargo de Gastón Bengochea y Compañía Corredor de Bolsa S.A. El Banco Central aprobó el reglamento de gestión, inscribió al Fondo en el Registro del Mercado de Valores y autorizó la contratación de Ernst & Young Uy S.A.S. —firma inscripta en el Registro de Auditores Externos del Banco Central— como auditor externo del Fondo.",
  },
  {
    q: "¿Cómo sigo la evolución de BNG Selección Global?",
    // La publicación en esta página NO arranca junto con el Fondo: entre que
    // empieza a operar y que el valor cuota llega acá pasa una o dos semanas
    // (mismo motivo por el que el aviso de Performance no dice "en cuanto
    // comience a operar" — ver FondoPerformance). Por eso la respuesta habla de
    // lo que la página va a publicar, sin atarlo al arranque. La fuente oficial
    // del valor cuota y del detalle de cartera es la Sociedad Administradora
    // (cláusula 8.3), y eso sí rige desde el primer día.
    a: "Esta misma página publica el valor cuota y los activos bajo manejo con actualización diaria, además de un gráfico con la evolución y los rendimientos por período; la publicación comienza en las próximas semanas. La información oficial —valor cuota, detalle de la cartera y estados de cuenta— la pone a disposición la Sociedad Administradora en los términos del Reglamento, y tu asesor complementa con reportes periódicos.",
  },
  {
    q: "¿Qué significa que sea una estrategia balanceada?",
    // La TABLA de Límites (3.3.1) no se transcribe: es término del contrato y
    // está en el Reglamento. Acá alcanza con que la asignación es activa y
    // acotada. (Detalle no menor: publicar "renta fija de grado especulativo
    // 0%-50%" sin el contexto del documento entero define al fondo por su peor
    // escenario permitido.)
    a: "Que combina renta variable y renta fija en una misma cartera, con un complemento táctico de activos alternativos. La asignación no es estática: se ajusta de forma activa según el contexto de mercado, dentro de los límites que fija el Reglamento de Gestión.",
  },
  {
    q: "¿Dónde puedo obtener más información?",
    // El factsheet todavía no existe: la respuesta NO puede ofrecer pedirlo (ver
    // components/institucional/FondoDocumentos.tsx).
    a: "Escribinos desde el formulario de contacto o pedí una reunión con un asesor. En la sección Documentos de esta página está la documentación del fondo: el reglamento y la autorización del Banco Central se descargan ahí mismo, y el factsheet se publica en esa misma sección cuando esté disponible.",
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
            {/* Apertura por grid-template-rows (0fr → 1fr) y NO por un
                max-height con número mágico. El número mágico ya falló una vez:
                estaba en 400, se subió a 760 cuando crecieron las respuestas
                legales, y la revisión legal del 3-ago-2026 volvió a alargar
                «¿Qué costos tiene?» y «¿Cómo se suscribe y cómo se rescata?»
                hasta rozarlo otra vez en pantallas angostas. Un tope que hay que
                acordarse de subir cada vez que crece un aviso legal es un aviso
                legal que en algún momento se va a mostrar cortado.
                Con 0fr → 1fr el alto lo pone el contenido: no hay nada que
                mantener y no hay forma de que recorte. El overflow:hidden va en
                el track (este div) y el padding en el hijo, que es lo que la
                técnica pide para que no se filtre altura con la fila en 0fr. */}
            <div style={{
              display: "grid", gridTemplateRows: isOpen ? "1fr" : "0fr",
              overflow: "hidden", opacity: isOpen ? 1 : 0,
              transition: "grid-template-rows 280ms ease, opacity 200ms ease",
            }}>
              {/* `overflow: hidden` acá adentro NO es decorativo y no se puede
                  mover al padre: un ítem de grilla tiene `min-height: auto`, o
                  sea que su contenido le pone un piso al alto y la fila jamás
                  llegaría a 0fr (la respuesta quedaría siempre desplegada). Un
                  overflow distinto de `visible` es justamente lo que baja ese
                  mínimo automático a cero. */}
              <p className="t-body" style={{ margin: 0, padding: "0 4px 32px", maxWidth: "48em", overflow: "hidden" }}>
                {item.a}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
