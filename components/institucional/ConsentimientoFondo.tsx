"use client";

import { useEffect, useRef, useState } from "react";
import { css } from "@/lib/css";
import { decidir, leerConsentimiento, senales, CLAVE_CONSENTIMIENTO } from "@/lib/consentimiento";

/**
 * Banner de consentimiento del SITIO DEL FONDO + el control para cambiar la
 * decisión, que vive en la política (#cookies).
 *
 * ── LO QUE HACE Y LO QUE NO ───────────────────────────────────────────────
 * NO instala nada ni decide qué mide GTM. Las señales por defecto —denegado,
 * salvo lo estrictamente necesario— ya las fijó el script inline del HTML antes
 * de que GTM cargara (`lib/medicion.ts`); acá sólo se EMITE la decisión del
 * visitante con `consent update` y se la guarda para las próximas visitas.
 *
 * ── DE DÓNDE SALE LA FORMA (relevamiento del 13-ago-2026) ─────────────────
 * Se miraron los banners reales de 16 casas del rubro —Schroders, SSGA, Vanguard,
 * BlackRock, Pictet, Robeco, Lombard Odier, Amundi, abrdn, Ninety One, Man Group,
 * Baillie Gifford, Marex, MFS—. El hallazgo que ordena todo: **casi ninguna
 * diseña su banner, lo configura**. Man Group muestra el logo de Cookiebot dentro
 * del panel; Marex, BlackRock, Pictet y MFS son OneTrust con el color cambiado, y
 * se les nota en el radio de 2,5px, el cuerpo de 14px y los tres botones de
 * siempre. Competir ahí no es imitarlos: es no parecerse a un CMP.
 *
 * De ese relevamiento se conserva lo que ES convención y sirve:
 *   · barra compacta abajo, no modal con velo. Schroders, Baillie Gifford y
 *     Robeco tapan el 100% de la pantalla en mobile; Pictet 63%, abrdn 47%,
 *     Marex 37%, MFS 35%. Esta página recibe TRÁFICO PAGO: cada punto de
 *     pantalla tapada es CTA que no se ve. Ésta se come el 22%.
 *   · título + cuerpo a la izquierda, acciones a la derecha (abrdn, MFS);
 *   · la acción de configurar, separada y más callada que las dos decisiones
 *     (Marex, Baillie Gifford, Man Group);
 *   · cuerpo de 14px y copy corto: los buenos rondan las 35-58 palabras
 *     (Marex 35, Ninety One 38, Baillie Gifford 43); los malos, 156 y 366.
 *
 * Y se descarta lo que es mala práctica aunque sea mayoritaria: **abrdn, MFS y
 * Ninety One no tienen "Rechazar"** —el rechazo vive escondido detrás de "Manage
 * Cookies"—, que es exactamente el patrón que las autoridades vienen sancionando.
 *
 * Lo que NO se copia de nadie es el aspecto: radio y tipografía salen de `.site`
 * y el filete de oro superior es el mismo horizonte que cierra el pie. Un banner
 * que parece parte del sitio, y no un widget alquilado, es toda la diferencia.
 *
 * ── LA REGLA QUE NO SE NEGOCIA ────────────────────────────────────────────
 * Rechazar cuesta lo mismo que aceptar: un clic, el mismo tamaño, el mismo lugar,
 * sin pasos extra. De ahí que los dos botones sean gemelos salvo por el relleno.
 * "Preferencias" AGREGA una opción intermedia; no es el escondite del rechazo.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Emite la decisión a Consent Mode. Sin GTM en la página, no hace nada. */
function emitir(analitica: boolean, publicidad: boolean) {
  window.gtag?.("consent", "update", senales({ analitica, publicidad }));
  window.gtag?.("set", "ads_data_redaction", !publicidad);
}

function guardar(analitica: boolean, publicidad: boolean) {
  try {
    localStorage.setItem(CLAVE_CONSENTIMIENTO, JSON.stringify(decidir(analitica, publicidad)));
  } catch {
    // Almacenamiento bloqueado: la decisión vale para esta sesión y se vuelve a
    // preguntar en la próxima. Es lo correcto — sin poder guardar la prueba, no
    // corresponde asumir que el consentimiento sigue vigente.
  }
  emitir(analitica, publicidad);
  // Para que el control de #cookies y el banner no se contradigan si los dos
  // están montados: el que no originó el cambio se entera por acá.
  window.dispatchEvent(new CustomEvent("bng:consentimiento"));
}

/**
 * Interruptor de una finalidad. `role="switch"` y no una casilla: el estado es
 * "encendido/apagado", no "marcado", y los lectores de pantalla lo anuncian
 * distinto. La pista se pinta navy al encender —el único color del control— y el
 * pulgar es blanco, como el thumb del selector de período de la página.
 */
function Interruptor({
  id,
  titulo,
  detalle,
  activo,
  fijo = false,
  onCambio,
}: {
  id: string;
  titulo: string;
  detalle: string;
  activo: boolean;
  /** Finalidad que no se puede apagar (las estrictamente necesarias). */
  fijo?: boolean;
  onCambio?: (v: boolean) => void;
}) {
  return (
    <div className="cpref-fila">
      <div className="cpref-texto">
        {/* Un <span> y no un <label for>: el destino es un botón, y aunque la
            especificación lo permita, el lector de pantalla termina anunciando
            el nombre dos veces. Con aria-labelledby lo nombra una sola. */}
        <span id={`${id}-t`} className="cpref-titulo">
          {titulo}
        </span>
        <p id={`${id}-d`} className="cpref-detalle">
          {detalle}
        </p>
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={activo}
        aria-labelledby={`${id}-t`}
        aria-describedby={`${id}-d`}
        disabled={fijo}
        className="cpref-sw"
        onClick={() => onCambio?.(!activo)}
      >
        <span className="cpref-sw-thumb" />
      </button>
    </div>
  );
}

export function ConsentimientoFondo() {
  // Arranca oculto en el server Y en el primer render del cliente. La decisión
  // vive en localStorage, que no existe al renderizar en el server: leerla
  // durante el render daría dos árboles distintos y rompería la hidratación de la
  // página entera. Se consulta recién en el efecto.
  const [visible, setVisible] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [analitica, setAnalitica] = useState(true);
  const [publicidad, setPublicidad] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const revisar = () => setVisible(leerConsentimiento() === null);
    revisar();
    window.addEventListener("bng:consentimiento", revisar);
    return () => window.removeEventListener("bng:consentimiento", revisar);
  }, []);

  // Al abrir Preferencias el panel crece hacia arriba y los botones se corren
  // bajo el dedo. Mover el foco al encabezado del detalle evita que el siguiente
  // tabulador caiga en un botón que ya no está donde estaba.
  useEffect(() => {
    if (abierto) panel.current?.focus();
  }, [abierto]);

  if (!visible) return null;

  return (
    <div className="site cbanner" role="dialog" aria-labelledby="cbanner-t">
      <div className={`cbanner-panel${abierto ? " is-abierto" : ""}`}>
        <div className="cbanner-texto">
          <p id="cbanner-t" className="cbanner-titulo">
            Cookies
          </p>
          <p className="cbanner-cuerpo">
            {/* ── EL COPY, Y POR QUÉ ES ÉSTE ──────────────────────────────────
                Registro DELIBERADAMENTE contenido, alineado al del sector
                (decisión del cliente, 13-ago-2026). Se enumeran FINALIDADES
                —navegación, análisis de uso, marketing— y no se narra el
                mecanismo. Es la fórmula de Marex, Schroders y MFS, y es
                deliberada: en un sitio institucional, describir en detalle qué se
                mide y cómo llama la atención sobre algo que el visitante no
                estaba mirando, y deja por escrito una descripción de la operación
                comercial de la casa que después hay que mantener al día.

                Una versión anterior decía el mecanismo en voz alta ("si nuestras
                campañas traen visitas", "volver a mostrarte publicidad nuestra en
                otros sitios"). Se descartó. ⚠️ Si alguien la reintroduce por
                "honestidad": el estándar legal es que las FINALIDADES estén
                identificadas —y lo están—, no que se narre la implementación.

                Cada línea de más tapa el CTA del hero en mobile, y esta página
                recibe tráfico pago: el detalle va en la política, no acá. */}
            Utilizamos cookies propias y de terceros para mejorar la navegación, analizar el uso
            del sitio y colaborar con nuestras acciones de marketing.{" "}
            <a href="#cookies" className="cbanner-link">
              Más información
            </a>
            .
          </p>
        </div>

        {abierto && (
          <div className="cbanner-pref" ref={panel} tabIndex={-1}>
            <Interruptor
              id="cpref-nec"
              titulo="Necesarias"
              detalle="Permiten el funcionamiento del sitio y el registro de tus preferencias. No se pueden desactivar."
              activo
              fijo
            />
            <Interruptor
              id="cpref-ana"
              titulo="Estadísticas"
              detalle="Permiten analizar el uso del sitio con fines estadísticos, en forma agregada."
              activo={analitica}
              onCambio={setAnalitica}
            />
            <Interruptor
              id="cpref-pub"
              // "Marketing" y no "Publicidad": es la categoría con la que nombra esto el
              // sector (Robeco, Cookiebot, Schroders) y no invita a preguntarse qué
              // anuncio, dónde y en base a qué.
              titulo="Marketing"
              detalle="Se utilizan con fines de marketing y para medir el rendimiento de nuestras campañas."
              activo={publicidad}
              onCambio={setPublicidad}
            />
          </div>
        )}

        <div className="cbanner-acciones">
          {!abierto && (
            <button type="button" className="cbanner-mas" onClick={() => setAbierto(true)}>
              Preferencias
            </button>
          )}
          {abierto && (
            <button
              type="button"
              className="ui-btn ui-btn-secondary cbanner-guardar"
              onClick={() => guardar(analitica, publicidad)}
            >
              Guardar
            </button>
          )}
          <div className="cbanner-par">
            <button type="button" className="ui-btn ui-btn-secondary" onClick={() => guardar(false, false)}>
              Rechazar
            </button>
            <button type="button" className="ui-btn ui-btn-primary" onClick={() => guardar(true, true)}>
              Aceptar
            </button>
          </div>
        </div>
      </div>

      <style>{css`
        .cbanner {
          position: fixed;
          z-index: 120;
          left: 0;
          right: 0;
          bottom: 0;
          padding: 0 16px 16px;
          pointer-events: none;
        }
        .cbanner-panel {
          pointer-events: auto;
          /* 1060 y no menos: con 980 la columna de texto quedaba en 482px y el
             enlace del final partía al medio, dejando el subrayado cortado entre
             dos líneas. El ancho está atado al largo del copy — si se reescribe,
             hay que volver a mirar dónde corta. */
          max-width: 1060px;
          margin: 0 auto;
          background: var(--surface);
          border-radius: var(--r-card);
          /* El acento de marca entra como filete y nunca como superficie: es el
             mismo horizonte de oro que cierra el pie y cruza el wordmark del
             hero. Es lo único que ningún CMP de estantería puede tener. */
          border-top: 1.5px solid var(--gold-deep);
          box-shadow: 0 -2px 8px rgba(3, 6, 94, 0.04), 0 18px 44px rgba(3, 6, 94, 0.16);
          padding: 18px 22px;
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 14px 28px;
          animation: cbanner-entra 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        /* Con las preferencias abiertas deja de ser una barra y pasa a ser una
           ficha: el detalle ocupa el ancho y las acciones bajan. */
        .cbanner-panel.is-abierto {
          grid-template-columns: 1fr;
          max-width: 620px;
          padding: 20px 22px 18px;
        }
        @keyframes cbanner-entra {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
        }
        .cbanner-titulo {
          font-size: 14px;
          font-weight: 600;
          color: var(--site-ink);
          margin: 0 0 5px;
        }
        .cbanner-cuerpo {
          margin: 0;
          font-size: 14px;
          line-height: 1.55;
          color: var(--site-ink-2);
          /* 60ch es la medida cómoda de lectura, pero acá el texto son dos
             renglones: lo que gobierna no es la fatiga sino dónde corta. Con 60
             el enlace del final quedaba partido en dos. */
          max-width: 72ch;
        }
        .cbanner-link {
          color: var(--gold-ink);
          text-decoration: underline;
          text-underline-offset: 2px;
          /* Que se vaya entero al renglón siguiente antes que partirse: un
             subrayado cortado a la mitad de una frase se lee como un error. */
          white-space: nowrap;
        }
        .cbanner-link:hover {
          color: var(--navy);
        }

        /* ── Acciones ──
           Las dos decisiones van juntas y del mismo tamaño; "Preferencias" queda
           afuera del par y en registro de enlace. Es la jerarquía de Marex y
           Baillie Gifford, con una diferencia: acá el rechazo NO vive adentro de
           preferencias, está al lado de aceptar. */
        .cbanner-acciones {
          display: flex;
          align-items: center;
          gap: 18px;
        }
        .cbanner-par {
          display: flex;
          gap: 10px;
        }
        .cbanner-acciones .ui-btn {
          min-width: 122px;
          padding: 13px 20px;
        }
        .cbanner-mas {
          font-family: var(--site-font);
          font-size: 14px;
          font-weight: 600;
          color: var(--site-ink-2);
          background: none;
          border: 0;
          padding: 6px 2px;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
          text-decoration-color: var(--site-border-2);
        }
        .cbanner-mas:hover {
          color: var(--navy);
          text-decoration-color: currentColor;
        }
        .cbanner-panel.is-abierto .cbanner-acciones {
          justify-content: flex-end;
        }
        .cbanner-guardar {
          margin-right: auto;
        }

        /* ── Preferencias ──
           Filas sobre hairlines, sin cajas ni sombras: es el idioma con el que
           esta página muestra todo lo demás. */
        .cbanner-pref {
          border-top: 1px solid var(--site-border);
          margin-top: 4px;
          outline: none;
          animation: cpref-entra 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes cpref-entra {
          from {
            opacity: 0;
          }
        }
        .cpref-fila {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 22px;
          padding: 12px 0;
          border-bottom: 1px solid var(--site-border);
        }
        .cpref-titulo {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: var(--site-ink);
        }
        .cpref-detalle {
          margin: 2px 0 0;
          font-size: 13px;
          line-height: 1.5;
          color: var(--site-ink-3);
          max-width: 48ch;
        }
        .cpref-sw {
          flex: none;
          width: 42px;
          height: 24px;
          margin-top: 2px;
          border-radius: 999px;
          border: 1px solid var(--site-border-2);
          background: var(--surface-muted);
          cursor: pointer;
          padding: 0;
          position: relative;
          transition: background 0.26s cubic-bezier(0.16, 1, 0.3, 1),
            border-color 0.26s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .cpref-sw[aria-checked="true"] {
          background: var(--navy);
          border-color: var(--navy);
        }
        /* El control DIBUJADO mide 42×24 porque a esa escala se lee como un
           interruptor y no como un botón. El que se toca es este pseudo-elemento
           invisible: 54×46, por encima del mínimo táctil de 44. Agrandar el
           dibujo para llegar a 44 habría engordado las tres filas y con ellas
           todo el panel — que en un teléfono chico ya es lo que más pesa. */
        .cpref-sw::after {
          content: "";
          position: absolute;
          inset: -11px -6px;
        }
        .cpref-sw-thumb {
          position: absolute;
          top: 50%;
          left: 2px;
          width: 18px;
          height: 18px;
          margin-top: -9px;
          border-radius: 999px;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(3, 6, 94, 0.28);
          transition: transform 0.26s cubic-bezier(0.34, 1.2, 0.4, 1);
        }
        .cpref-sw[aria-checked="true"] .cpref-sw-thumb {
          transform: translateX(18px);
        }
        /* "Necesarias" no se puede apagar: se dice con el cursor y la opacidad,
           no sacando el control —que dejaría la fila sin explicar por qué. */
        .cpref-sw:disabled {
          opacity: 0.45;
          cursor: default;
        }

        @media (max-width: 760px) {
          .cbanner {
            padding: 0 10px 10px;
          }
          .cbanner-panel,
          .cbanner-panel.is-abierto {
            grid-template-columns: 1fr;
            max-width: none;
            padding: 16px 16px 14px;
            gap: 12px;
          }
          /* Las tres acciones en UNA fila. Darle renglón propio a "Preferencias"
             costaba 48px de alto, y en esta página el alto del banner es CTA del
             hero tapado. La jerarquía la sostiene el registro —enlace contra
             botón—, no la posición, igual que en desktop. */
          .cbanner-acciones {
            display: grid;
            grid-template-columns: auto 1fr 1fr;
            align-items: stretch;
            gap: 8px;
          }
          .cbanner-par {
            display: contents;
          }
          .cbanner-mas {
            font-size: 13px;
            padding: 6px 8px 6px 0;
          }
          /* En táctil se recupera el alto completo del botón: el mínimo de un
             objetivo que se toca con el dedo son 44px, y estos dos botones son
             literalmente la decisión legal entera. */
          .cbanner-acciones .ui-btn {
            min-width: 0;
            padding: 14px 16px;
          }
          /* Con las preferencias abiertas "Preferencias" ya no está, y Guardar
             toma su lugar: pasa a fila propia para no comprimir a tres botones
             de 44px en 390px de ancho. */
          .cbanner-guardar {
            grid-column: 1 / -1;
            margin-right: 0;
            justify-self: stretch;
          }
          /* ⚠️ Sin esto, Rechazar y Aceptar caerían en las columnas auto y 1fr
             que dejó "Preferencias" y saldrían de ANCHOS DISTINTOS — justo la
             asimetría que todo este componente evita. */
          .cbanner-panel.is-abierto .cbanner-acciones {
            grid-template-columns: 1fr 1fr;
          }
          .cpref-detalle {
            max-width: none;
          }
          /* ── El caso del teléfono chico ──
             En un iPhone SE (375×667) las tres finalidades desplegadas dejaban el
             panel en 557px: el 83% de la pantalla. Es exactamente el modal que
             tapa todo que se descartó de Schroders, Baillie Gifford y Robeco al
             elegir la forma de esto.

             La lista scrollea en vez de empujar, así que el alto total queda
             acotado y —lo que importa— Guardar, Rechazar y Aceptar siguen SIEMPRE
             a la vista: un panel de consentimiento cuyas acciones quedan abajo
             del pliegue es un panel del que no se puede salir. En pantallas con
             lugar la regla no hace nada, porque el contenido nunca llega al tope. */
          .cbanner-pref {
            max-height: 44vh;
            overflow-y: auto;
            overscroll-behavior: contain;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .cbanner-panel,
          .cbanner-pref {
            animation: none;
          }
          .cpref-sw,
          .cpref-sw-thumb {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Control para revisar y cambiar la decisión, dentro de la política (#cookies).
 *
 * Existe porque retirar el consentimiento tiene que ser tan fácil como darlo. Sin
 * esto, el visitante que aceptó una vez no tendría camino de vuelta salvo borrar
 * el almacenamiento del navegador a mano, que no es un camino.
 */
export function CambiarConsentimiento() {
  const [estado, setEstado] = useState<"cargando" | "aceptado" | "parcial" | "rechazado" | "sin-decidir">(
    "cargando",
  );

  useEffect(() => {
    const revisar = () => {
      const c = leerConsentimiento();
      setEstado(
        c === null
          ? "sin-decidir"
          : c.analitica && c.publicidad
            ? "aceptado"
            : c.analitica || c.publicidad
              ? "parcial"
              : "rechazado",
      );
    };
    revisar();
    window.addEventListener("bng:consentimiento", revisar);
    return () => window.removeEventListener("bng:consentimiento", revisar);
  }, []);

  // Antes de leer localStorage no se sabe el estado. Se reserva el alto con un
  // texto neutro en vez de no renderizar nada, para que la política no salte.
  const leyenda = {
    aceptado: "Aceptaste las cookies de estadísticas y marketing.",
    parcial: "Aceptaste sólo algunas finalidades.",
    rechazado: "Rechazaste las cookies de estadísticas y marketing.",
    "sin-decidir": "Todavía no elegiste.",
    cargando: " ",
  }[estado];

  return (
    <div className="ccambiar">
      <p className="t-small ccambiar-estado">{leyenda}</p>
      <div className="ccambiar-acciones">
        <button
          type="button"
          className="ui-btn ui-btn-secondary"
          disabled={estado === "cargando"}
          onClick={() => guardar(false, false)}
        >
          Rechazar
        </button>
        <button
          type="button"
          className="ui-btn ui-btn-primary"
          disabled={estado === "cargando"}
          onClick={() => guardar(true, true)}
        >
          Aceptar
        </button>
      </div>

      <style>{css`
        .ccambiar {
          margin-top: 18px;
          padding-top: 18px;
          border-top: 1px solid var(--site-border);
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }
        .ccambiar-estado {
          margin: 0;
        }
        .ccambiar-acciones {
          display: flex;
          gap: 10px;
        }
        .ccambiar-acciones .ui-btn {
          min-width: 118px;
          padding: 11px 18px;
          font-size: 14px;
        }
        .ccambiar-acciones .ui-btn:disabled {
          opacity: 0.45;
          cursor: default;
        }
      `}</style>
    </div>
  );
}
