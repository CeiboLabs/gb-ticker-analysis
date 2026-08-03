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
    // de implementación, y es lo que sostiene la segunda capa de comisiones que
    // se explica en "¿Qué costos tiene?". Sin esto, el titular de la página
    // ("Acciones + Bonos + Activos alternativos") se lee como tenencia directa.
    a: "Es un fondo de inversión uruguayo —«Fondo BNG Selección Global, Fondo de Inversión»—, abierto y de plazo ilimitado, con una estrategia de crecimiento balanceado: construye una cartera con exposición a renta variable y renta fija a nivel global, invirtiendo principalmente a través de ETFs y fondos gestionados por terceros, y de forma directa en deuda de Estados soberanos y de organismos internacionales de crédito.",
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
    //
    // ⚠️ LOS DOS LÍMITES A LA LIQUIDEZ VAN ACÁ, pegados a la promesa que
    // califican, y no sólo en el bloque legal del pie:
    //   · 9.5 — el plazo de 4 días cede ante "causas no imputables a la Sociedad
    //     Administradora (tales como huelgas, feriados bancarios, o demoras o
    //     incumplimientos de Custodios y/o terceros)";
    //   · 9.8 — el rescate se puede SUSPENDER hasta 3 meses como medida de
    //     defensa del patrimonio común (art. 20 de la Ley N° 16.774).
    // El factor de riesgo 4 del Reglamento agrega que los propios ETFs y fondos
    // subyacentes pueden suspender sus rescates en condiciones de estrés. Un
    // producto que se presenta como líquido tiene que decir dónde termina esa
    // liquidez.
    a: "El mínimo de suscripción es de USD 100 por titular, sin monto máximo, y las suscripciones se procesan en forma diaria. Los rescates se solicitan en cualquier momento por medios digitales, se procesan los martes y viernes hábiles y se pagan en dólares dentro de los 4 días hábiles siguientes, salvo causas ajenas a la Sociedad Administradora —huelgas, feriados bancarios o demoras de los custodios—. No hay comisión de rescate. El Reglamento prevé además que el rescate pueda suspenderse por hasta tres meses como medida de defensa del patrimonio del Fondo, por ejemplo si no pudiera determinarse razonablemente el valor cuota. Los horarios de corte y el detalle del procedimiento están en el Reglamento de Gestión.",
  },
  {
    q: "¿Qué costos tiene?",
    // Cláusulas 12.1, 12.2 y 12.3. La comisión se cobra AL FONDO, así que el
    // valor cuota ya nace neta de ella. Y NO es el único costo: por eso se dice
    // que existen gastos y tributos, pero NO se transcribe acá el tope del 2%
    // anual ni la excepción del primer año. Son términos del contrato y están en
    // el Reglamento; sacados de contexto, un techo que probablemente nunca se
    // use se lee como si fuera el costo real.
    //
    // ⚠️ LA SEGUNDA CAPA DE COMISIONES NO SE OMITE. El propio Reglamento la
    // enumera como factor de riesgo 7 ("costos adicionales por comisiones de
    // administración en DOS NIVELES: el del Fondo y el de los vehículos
    // subyacentes") y la cláusula 3.1 dice que el Fondo invierte
    // "predominantemente" a través de ellos: no es un costo marginal, es
    // estructural. Sin esta línea, el "no se suma el tarifario de la sociedad de
    // bolsa" que sigue cierra la respuesta con un "1,5% y nada más" que es falso.
    //
    // También van acá los dos hechos que cambian el número que el lector acaba
    // de leer: que la comisión es MODIFICABLE (12.1 y 14.2, con 15 días de
    // preaviso y ventana de rescate) y la comisión de liquidación de 5.2. Ese
    // último es el único costo del Reglamento que no aparecía en ningún lado de
    // la página.
    a: "La comisión del Fondo es de hasta 1,5% anual, IVA incluido, sobre su patrimonio neto descontado de provisiones: se devenga a diario y se cobra al Fondo, por lo que el valor cuota ya se publica neta de ella. Incluye lo que corresponde a la Sociedad Administradora, al Gestor y a la distribución de las cuotapartes — no se suma el tarifario de la sociedad de bolsa. No hay comisión de rescate. No es el único costo: como el Fondo invierte principalmente a través de ETFs y fondos de terceros, esos vehículos cobran su propia comisión de administración, ya descontada en el precio de cada uno, que se suma a la del Fondo. El Fondo soporta además los gastos propios de su funcionamiento, y los tributos que gravan los rendimientos son de cargo del inversor. La Sociedad Administradora puede modificar las comisiones avisando con 15 días de anticipación, plazo durante el cual se puede rescatar; y si el Fondo se liquidara, percibiría por esa tarea una comisión de 5% por única vez. El detalle está en el Reglamento de Gestión.",
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
    a: "Que combina renta variable y renta fija en una misma cartera, con un complemento táctico de activos alternativos. La asignación no es fija: se ajusta de forma activa según el contexto de mercado, dentro de los límites que fija el Reglamento de Gestión.",
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
