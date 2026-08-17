"use client";

import { useEffect, useRef, useState } from "react";
import { css } from "@/lib/css";
import {
  decidir,
  hayDecisionVencida,
  leerConsentimiento,
  senales,
  CLAVE_CONSENTIMIENTO,
  VIGENCIA_CONSENTIMIENTO_MS,
} from "@/lib/consentimiento";

/**
 * Banner de consentimiento del SITIO DEL FONDO + el control para cambiar la
 * decisión, que vive en la política (`/cookies`).
 *
 * ⚠️ La URL de la política llega por prop y no se escribe acá: en el dominio del
 * fondo es `/cookies`, y donde los dos sitios comparten hostname —el dev y el
 * home server— cuelga de `/bng-seleccion-global`. La resuelve la cáscara con
 * `baseFondoServer()`. Ver `baseFondo` en lib/sitios.ts.
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
 *     pantalla tapada es CTA que no se ve. Ésta se come el 25% en un iPhone
 *     (211px de 844) y el 30% en un teléfono de 360 — sigue siendo la más chica
 *     de todo el relevamiento, con margen. Era el 22% hasta que se le agregó el
 *     nombre de la casa el 16-ago-2026; el renglón de más se pagó a sabiendas.
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
 * Lo que NO se copia de nadie es el aspecto: radio, tipografía y sombra salen de
 * `.site`. Un banner que parece parte del sitio, y no un widget alquilado, es
 * toda la diferencia.
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
  // Para que el control de la política y el banner no se contradigan si los dos
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

/**
 * Los estilos de `Interruptor`, en su propia etiqueta y no adentro del bloque de
 * cada componente, porque LOS DOS lo montan y ninguno de los dos está siempre en
 * la página: el banner se desmonta apenas hay decisión —que es justo cuando la
 * política sí está—, y el banner vive en el layout del fondo, así que aparece en
 * páginas donde la política no existe.
 *
 * Va como constante de módulo y no interpolado en el bloque de cada uno para no
 * perder la memoización de `css` (ver lib/css.ts): con interpolaciones vuelve a
 * limpiar el texto en cada render. Cuando los dos están montados —sólo mientras
 * no hay decisión tomada— el navegador recibe estas reglas dos veces; son
 * idénticas y no hay cascada que resolver.
 */
const CSS_INTERRUPTORES = css`
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
     invisible: 54×46, por encima del mínimo táctil de 44. Agrandar el dibujo
     para llegar a 44 habría engordado las tres filas y con ellas todo el panel
     — que en un teléfono chico ya es lo que más pesa. */
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
  /* "Necesarias" no se puede apagar: se dice con el cursor y la opacidad, no
     sacando el control —que dejaría la fila sin explicar por qué. */
  .cpref-sw:disabled {
    opacity: 0.45;
    cursor: default;
  }
  @media (max-width: 760px) {
    .cpref-detalle {
      max-width: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .cpref-sw,
    .cpref-sw-thumb {
      transition: none;
    }
  }
`;

export function ConsentimientoFondo({ politica }: { politica: string }) {
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

  // ⚠️ SE LEE `location` DESPUÉS DEL RETURN DE ARRIBA, y ahí está todo el truco.
  // `visible` arranca en false en el server y en el primer render del cliente, o
  // sea que el único camino que llega hasta acá es un render posterior al efecto
  // — cliente puro—. Leerlo antes ramificaría el primer render contra el del
  // server y rompería la hidratación de la página entera; leerlo acá no puede.
  // Por eso tampoco necesita ser estado.
  const sinBarra = (p: string) => p.replace(/\/+$/, "");
  const enLaPolitica = sinBarra(location.pathname) === sinBarra(politica);

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
                recibe tráfico pago: el detalle va en la política, no acá.

                ── LO ÚNICO QUE SE LE SUMÓ (16-ago-2026) ──────────────────────
                El NOMBRE DE LA CASA al frente. Sale de la letra de la Guía de
                Cookies y Perfiles de la URCDP (dic-2018), que al enumerar lo que
                hay que informar pide "la utilización de esta tecnología, QUIÉN ES
                SU RESPONSABLE y para qué se van a utilizar los datos". Las otras
                dos ya estaban; el responsable no aparecía por ningún lado del
                banner.

                Va el nombre COMERCIAL —"Bengochea Inversiones", el del wordmark,
                el del dominio y el que `lib/jsonld.ts` declara como
                `alternateName` de la organización— y no la razón social entera:
                "Gastón Bengochea y Compañía Corredor de Bolsa S.A." son ocho
                palabras que empujan el banner un renglón entero en mobile, y la
                razón social está en la política, a un toque de acá y en la misma
                oración. Es la estructura en dos capas de siempre: lo esencial en
                el aviso, lo completo en el documento.

                Y es el mismo criterio que ya rige en el resto del sitio, no una
                excepción de este banner: la prosa editorial dice "Bengochea
                Inversiones" (ver el comentario de La casa en la página del
                fondo) y el nombre legal queda para donde identifica jurídicamente
                al gestor — Partes intervinientes y el aviso legal al pie.

                ⚠️ LO QUE SIGUE SIN ESTAR, y es decisión tomada: la guía además
                pide dejar en claro "que se va a rastrear su actividad en línea".
                Eso narra el mecanismo, que es justamente lo que el cliente
                descartó el 13-ago-2026. Vive en la política. No reintroducirlo
                acá sin pedido expreso. */}
            {/* ⚠️ SIN PUNTO FINAL EN ESTA ORACIÓN: lo pone el bloque de abajo, en
                las dos ramas. Con el punto acá y otro después del link, la
                variante sin link cerraba con dos puntos seguidos. */}
            En Bengochea Inversiones utilizamos cookies propias y de terceros para mejorar la
            navegación, analizar el uso del sitio y colaborar con nuestras acciones de marketing
            {/* El link se cae cuando el visitante YA está en la política: ahí
                apuntaría a la página que tiene delante, y un link que no lleva a
                ninguna parte es peor que no tenerlo — sobre todo en el único
                lugar del sitio donde el lector está prestando atención a esto.

                El banner en cambio SÍ se queda, y eso está medido: de ocho pares
                con política propia, seis lo muestran encima de ella (Pictet, Man
                Group, Marex, abrdn, PIMCO, Baillie Gifford) y sólo Schroders y
                BBVA lo suprimen. Tiene sentido: la política explica, el banner
                pide la decisión, y son dos cosas distintas aunque estén en la
                misma pantalla. */}
            {enLaPolitica ? (
              "."
            ) : (
              <>
                .{" "}
                <a href={politica} className="cbanner-link">
                  Más información
                </a>
                .
              </>
            )}
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
           esta página muestra todo lo demás. Las filas en sí las pinta
           CSS_INTERRUPTORES, que comparte con el control de la política. */
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
        }
      `}</style>
      <style>{CSS_INTERRUPTORES}</style>
    </div>
  );
}

const FECHA = new Intl.DateTimeFormat("es-UY", { day: "numeric", month: "long", year: "numeric" });

/**
 * Control para revisar y cambiar la decisión, dentro de la política (`/cookies`).
 *
 * Existe porque retirar el consentimiento tiene que ser tan fácil como darlo. Sin
 * esto, el visitante que aceptó una vez no tendría camino de vuelta salvo borrar
 * el almacenamiento del navegador a mano, que no es un camino.
 *
 * ── POR QUÉ LAS MISMAS TRES FINALIDADES Y NO DOS BOTONES ──────────────────
 * Hasta el 15-ago-2026 esto eran un "Rechazar" y un "Aceptar", y con eso el
 * control quedaba MÁS POBRE que el banner: los interruptores por finalidad viven
 * sólo ahí, y el banner no vuelve nunca —se monta únicamente cuando no hay
 * decisión guardada—. Quien había elegido una combinación intermedia (analítica
 * sí, marketing no) no tenía forma de volver a ella: cualquiera de los dos
 * botones la aplastaba a todo-o-nada. Modificar el consentimiento por finalidad
 * era, en los hechos, imposible después de la primera visita.
 *
 * ── Y POR QUÉ ACÁ NO HAY "GUARDAR" ────────────────────────────────────────
 * El banner es una decisión que se toma y se cierra, y por eso allá "Guardar"
 * confirma y lo despide. Esto es un panel de ajustes permanente: cada cambio se
 * aplica en el acto. Con un "Guardar" de por medio, retirar el consentimiento
 * pasaría a costar dos clics cuando darlo costó uno —justo la asimetría que se
 * sanciona—, y quedaría un borrador que se pierde en silencio al navegar.
 */
export function CambiarConsentimiento() {
  const [analitica, setAnalitica] = useState(false);
  const [publicidad, setPublicidad] = useState(false);
  const [ts, setTs] = useState(0);
  // `null` mientras no se leyó el almacenamiento: no se sabe si hay decisión. En
  // el server y en el primer render del cliente vale eso mismo, que es lo que
  // mantiene los dos árboles iguales (leer localStorage en el render rompería la
  // hidratación de la página entera).
  const [decidido, setDecidido] = useState<boolean | null>(null);
  // Distingue "nunca eligió" de "eligió y se le venció", que desde que hay
  // caducidad no son lo mismo para contárselo. Ver `hayDecisionVencida`.
  const [vencida, setVencida] = useState(false);
  // Si el almacenamiento está bloqueado —modo privado, cookies de terceros
  // apagadas—, `guardar` igual emite la decisión pero `leerConsentimiento` sigue
  // devolviendo null. Sin esta marca, el interruptor que el visitante acaba de
  // mover se volvería a apagar solo y el control parecería roto.
  const propio = useRef(false);

  useEffect(() => {
    const revisar = () => {
      const c = leerConsentimiento();
      if (c) {
        setAnalitica(c.analitica);
        setPublicidad(c.publicidad);
        setTs(c.ts);
        setDecidido(true);
        setVencida(false);
      } else if (!propio.current) {
        setVencida(hayDecisionVencida());
        // Sin decisión, los interruptores muestran lo que REALMENTE está pasando:
        // Consent Mode arrancó todo en denegado, así que van los dos apagados. No
        // se propone nada preencendido — eso es del banner, donde hay una
        // pregunta abierta; acá sería afirmar un consentimiento que no se dio.
        setAnalitica(false);
        setPublicidad(false);
        setTs(0);
        setDecidido(false);
      }
    };
    revisar();
    window.addEventListener("bng:consentimiento", revisar);
    return () => window.removeEventListener("bng:consentimiento", revisar);
  }, []);

  // El estado local se actualiza acá y no se espera al evento que emite
  // `guardar`: el interruptor tiene que seguir al dedo. El evento llega igual y
  // reconcilia contra lo guardado —y de paso mantiene esto al día si quien
  // decidió fue el banner, que puede estar montado al mismo tiempo.
  const aplicar = (a: boolean, p: boolean) => {
    propio.current = true;
    setAnalitica(a);
    setPublicidad(p);
    setTs(Date.now());
    setDecidido(true);
    setVencida(false);
    guardar(a, p);
  };

  // La leyenda dice lo que los interruptores NO pueden decir: cuándo se decidió,
  // hasta cuándo vale esa decisión —el consentimiento caduca a los doce meses
  // desde el 16-ago-2026, ver VIGENCIA_CONSENTIMIENTO_MS— y, si todavía no se
  // decidió, que mientras tanto no se mide nada.
  //
  // La fecha de la decisión es la prueba del consentimiento que hay que poder
  // mostrar, y el vencimiento se CALCULA acá en vez de guardarse: la fuente de
  // verdad es ese `ts` más la vigencia, y un segundo campo derivado sólo abre la
  // puerta a que los dos digan cosas distintas.
  //
  // Repetir en palabras el estado de los tres controles que están justo abajo
  // sería ruido: la leyenda dice lo otro, lo que los interruptores no muestran.
  const leyenda =
    decidido === null
      ? // Antes de leer el almacenamiento no se sabe: se reserva el alto con un
        // espacio duro en vez de no renderizar nada, para que la política no salte.
        " "
      : decidido
        ? `Tu elección quedó guardada el ${FECHA.format(new Date(ts))} y vale hasta el ${FECHA.format(new Date(ts + VIGENCIA_CONSENTIMIENTO_MS))}.`
        : vencida
          ? "Tu elección anterior venció: por ahora sólo se usan las cookies necesarias."
          : "Todavía no elegiste: por ahora sólo se usan las cookies necesarias.";

  return (
    <div className="ccambiar">
      <div className="ccambiar-cab">
        <p className="ccambiar-titulo">Tus preferencias</p>
        {/* Los dos atajos, en registro parejo y los dos secundarios. El primario
            navy de antes se leía como una llamada a la acción pendiente —"te
            falta aceptar"— cuando en realidad ya estaba aceptado; y empujar
            hacia una de las dos opciones en el panel donde se ejerce el derecho
            a retirar el consentimiento es exactamente lo que no corresponde.
            Cuál está vigente lo dicen los interruptores de abajo, que es donde
            se puede decir sin ambigüedad —incluida la combinación intermedia,
            que ningún par de botones puede representar. */}
        <div className="ccambiar-atajos">
          <button
            type="button"
            className="ui-btn ui-btn-secondary"
            disabled={decidido === null}
            onClick={() => aplicar(false, false)}
          >
            Rechazar todo
          </button>
          <button
            type="button"
            className="ui-btn ui-btn-secondary"
            disabled={decidido === null}
            onClick={() => aplicar(true, true)}
          >
            Aceptar todo
          </button>
        </div>
      </div>

      <div className="ccambiar-lista">
        <Interruptor
          // Prefijo propio y no el `cpref-` del banner: los dos pueden estar
          // montados a la vez —mientras no haya decisión— y los ids se
          // duplicarían, que además de HTML inválido deja los aria-labelledby
          // apuntando al elemento equivocado.
          id="cpol-nec"
          titulo="Necesarias"
          detalle="Permiten el funcionamiento del sitio y el registro de tus preferencias. No se pueden desactivar."
          activo
          fijo
        />
        <Interruptor
          id="cpol-ana"
          titulo="Estadísticas"
          detalle="Permiten analizar el uso del sitio con fines estadísticos, en forma agregada."
          activo={analitica}
          onCambio={(v) => aplicar(v, publicidad)}
        />
        <Interruptor
          id="cpol-pub"
          titulo="Marketing"
          detalle="Se utilizan con fines de marketing y para medir el rendimiento de nuestras campañas."
          activo={publicidad}
          onCambio={(v) => aplicar(analitica, v)}
        />
      </div>

      <p className="t-small ccambiar-estado">{leyenda}</p>

      <style>{css`
        .ccambiar {
          margin-top: 18px;
          padding-top: 18px;
          border-top: 1px solid var(--site-border);
          /* La misma medida que los párrafos de la política, para que el
             interruptor caiga cerca de la fila que rotula. Sin esto la lista
             toma los 1152px del contenedor y el control queda a 650px de su
             propio texto, que ya no se leen como una sola fila.

             ⚠️ El font-size no es decorativo: --medida-legal está en unidades ch
             y ésas se resuelven contra el tamaño del ELEMENTO. Los párrafos de
             al lado miden 12.5px y acá se heredan 17, así que sin fijarlo la
             misma variable daría 907px en vez de 667 y el bloque no alinearía
             con ellos. No afecta a nada adentro: todos los hijos traen su propio
             tamaño. */
          font-size: 12.5px;
          max-width: var(--medida-legal);
        }
        .ccambiar-cab {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px 18px;
          margin-bottom: 4px;
        }
        .ccambiar-titulo {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--site-ink);
        }
        .ccambiar-atajos {
          display: flex;
          gap: 8px;
        }
        /* Más chicos que los del banner a propósito: allá los dos botones SON la
           decisión; acá la decisión son los interruptores y esto es un atajo. */
        .ccambiar-atajos .ui-btn {
          padding: 9px 15px;
          font-size: 13px;
        }
        .ccambiar-atajos .ui-btn:disabled {
          opacity: 0.45;
          cursor: default;
        }
        /* 12.5px y no los 14 de .t-small: es una nota al pie de un bloque legal
           que entero se lee a ese tamaño, y a 14 pesaba más que la política. */
        .ccambiar-estado {
          margin: 12px 0 0;
          font-size: 12.5px;
        }
        /* Con el dedo, los atajos vuelven al mínimo táctil y se reparten el
           ancho: a 13px de texto y 9 de padding quedaban en 31 de alto.
           15 y no 14: con 14 el botón da 44,0 clavado —13 de texto (la línea es
           1 en .ui-btn), 28 de relleno y 3 de borde— y cualquier redondeo lo
           deja abajo del mínimo. Con 15 quedan 46. */
        @media (pointer: coarse) {
          .ccambiar-atajos {
            flex: 1 1 100%;
          }
          .ccambiar-atajos .ui-btn {
            flex: 1;
            padding: 15px 12px;
          }
        }
      `}</style>
      <style>{CSS_INTERRUPTORES}</style>
    </div>
  );
}

