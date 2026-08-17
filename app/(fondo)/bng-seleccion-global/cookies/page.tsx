import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CambiarConsentimiento } from "@/components/institucional/ConsentimientoFondo";
import { fondoMetadata } from "@/lib/seo";
import { estaOculta } from "@/lib/paginasOcultas";
import { RUTA_FONDO } from "@/lib/sitios";
import { baseFondoServer } from "@/lib/sitiosServer";
import { css } from "@/lib/css";

/**
 * Política de cookies del SITIO DEL FONDO — la segunda página del sitio.
 *
 * ── POR QUÉ ES UNA PÁGINA Y NO LA SECCIÓN QUE ERA ─────────────────────────
 * Hasta el 16-ago-2026 esto vivía como `#cookies`, una banda más al pie de la
 * home. Salió de ahí por pedido del usuario, y la razón de fondo es que no era
 * copy del fondo: la home cerraba con 576 palabras de letra chica repartidas en
 * DOS secciones —1.531 px en desktop, 2.148 px en un iPhone, medido— y sólo la
 * mitad regulatoria tenía que estar ahí.
 *
 * El corte no es por largo, es por MATERIA. «Información legal» sale del
 * Reglamento de Gestión y de la Resolución del BCU, y califica a los números que
 * la propia página muestra: la leyenda de autorización y «los rendimientos
 * pasados no garantizan resultados futuros» tienen que leerse cerca del gráfico
 * y del backtest que califican, así que ésa se queda en la home. Esto es otra
 * cosa —tratamiento de datos personales, Ley 18.331—, es una política del SITIO
 * y no del producto, y es lo único de la página que además trae un control
 * interactivo (los tres interruptores) metido en medio de la lectura.
 *
 * Y es la convención del rubro sin excepción: en el relevamiento de banners del
 * 13-ago-2026 —Schroders, SSGA, Vanguard, BlackRock, Pictet, Robeco, Amundi,
 * abrdn, Man Group, Baillie Gifford, Marex, MFS— la política de cookies está
 * SIEMPRE en URL propia, enlazada desde el banner y desde el pie. Nadie la lee
 * scrolleando una página de producto: se la va a buscar. Tener URL propia además
 * la vuelve citable, que es lo que corresponde para el registro ante la URCDP.
 *
 * ── DÓNDE VIVE ────────────────────────────────────────────────────────────
 * El archivo cuelga de `RUTA_FONDO` por lo mismo que la home (ver lib/sitios.ts):
 * en el dominio del fondo se sirve como `/cookies` —rewrite de next.config.ts, y
 * `armar()` en scripts/build-fondo.mts la emite como `cookies/index.html`—, y
 * donde los dos sitios comparten hostname se entra por
 * `/bng-seleccion-global/cookies`. Ningún link la escribe a mano: sale de
 * `baseFondoServer()`.
 *
 * ── EL COPY ───────────────────────────────────────────────────────────────
 * Los cuatro párrafos son TEXTUALES de la sección que reemplaza — pasaron por la
 * revisión del 3-ago-2026 y no se reescriben en una mudanza de maqueta. Lo único
 * nuevo es la bajada y la vuelta al fondo.
 *
 * ⚠️ Describe PROPÓSITOS, no nombres de cookies. Los tags concretos los publica
 * la agencia desde el contenedor y pueden cambiar sin que este repo se entere:
 * una lista de nombres nacería desactualizada, y una política que miente sobre lo
 * que hace es peor que una genérica.
 */

export const metadata: Metadata = fondoMetadata({
  title: "Cookies · BNG Selección Global",
  description:
    "Qué cookies utiliza el sitio de BNG Selección Global, con qué finalidad, y cómo revisar o retirar tu consentimiento en cualquier momento.",
  path: "/cookies",
});

export default async function CookiesPage() {
  // Misma guarda que la home del fondo: mientras la sección siga listada en
  // lib/paginasOcultas.ts, todo el sitio devuelve 404 — no sólo la portada.
  if (estaOculta(RUTA_FONDO)) notFound();

  const base = await baseFondoServer();
  const home = base || "/";

  return (
    <main id="top" className="site fondo-cookies">
      {/* ⚠️ EL ENCABEZADO ES NAVY POR OBLIGACIÓN, NO POR GUSTO. `NavbarFondo`
          está pensada para flotar sobre el hero: va `position: absolute` sobre
          el tope del documento, sin fondo propio, con el wordmark BLANCO y el
          link a la casa en blanco al 72%. Sobre una banda clara desaparecen los
          dos —queda sólo el "INVERSIONES" dorado colgando en el aire— y encima
          la barra se superpone a los primeros 72px de la página (--nav-h).
          La banda navy le devuelve el piso que la cáscara da por sentado y
          reserva ese alto en el padding. Si algún día la barra deja de ser
          absoluta, esto se puede volver una banda clara. */}
      <header className="band-navy ck-masthead">
        <div className="site-wrap">
          <div className="ck-col">
          <div className="eyebrow-sm">Política</div>
          <h1 className="t-h2" style={{ marginTop: 14 }}>
            Cookies
          </h1>
          <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
            Qué utilizamos, con qué finalidad, y cómo cambiar tu decisión cuando quieras.
          </p>
          </div>
        </div>
      </header>

      <section className="band site-section-sm">
        <div className="site-wrap">
          <div className="ck-col">
          <div className="ck-cuerpo">
            <p>
              Este sitio utiliza cookies propias y de terceros. Las estrictamente necesarias
              permiten su funcionamiento y el registro de tus preferencias, por lo que se utilizan
              siempre. Las demás se activan únicamente con tu consentimiento, que podés modificar en
              cualquier momento desde esta página.
            </p>

            {/* La cláusula de alcance. Cinco casas del relevamiento la tienen y
                la de Pictet es la más clara: cualquier método de almacenamiento
                del navegador cuenta como cookie a los efectos de la política.
                Acá no es formalismo — es literalmente cierto y verificable: el
                sitio no escribe NI UNA cookie, y la decisión del visitante se
                guarda en `localStorage` (lib/consentimiento.ts). Sin esta
                cláusula, la palabra «cookies» no nombraba lo único que el sitio
                sí guarda. */}
            <h2 className="ck-h">Qué alcanza esta política</h2>
            <p>
              Cuando decimos «cookies» nos referimos también a cualquier otro método de
              almacenamiento del navegador —el almacenamiento local y el de sesión— y a las
              tecnologías equivalentes de medición, como los píxeles y las etiquetas de seguimiento.
              De hecho, tu decisión sobre esta página se guarda en el almacenamiento local de tu
              navegador y no en una cookie.
            </p>

            <h2 className="ck-h">Para qué se usan</h2>
            <p>
              <strong>Estadísticas.</strong> Permiten analizar el uso del sitio con fines
              estadísticos y en forma agregada. Son provistas por Google (Google Analytics), que
              puede almacenar la información en servidores ubicados fuera del país.
            </p>
            <p>
              <strong>Marketing.</strong> Se utilizan con fines de marketing y para medir el
              rendimiento de nuestras campañas. Son provistas por Google y Meta.
            </p>

            {/* ⚠️ ESTE PÁRRAFO CORRIGE UNA AFIRMACIÓN QUE ERA MÁS FUERTE QUE LA
                REALIDAD. Hasta el 16-ago-2026 la política decía que Google
                «actúa como encargado del tratamiento». Para Analytics es
                discutible; para Google Ads y para el remarketing de Meta es
                directamente otra cosa — ahí tratan los datos para sus propios
                fines y no bajo nuestras instrucciones.

                La redacción sale de PIMCO, que es la única del relevamiento que
                lo dice de frente: «podemos otorgar a algunos de nuestros socios
                como Google derechos independientes sobre tus datos personales…
                no controlamos su uso posterior». Prometer un encargo que no
                existe es peor que no decir nada. */}
            <h2 className="ck-h">Qué hacen los terceros con esos datos</h2>
            <p>
              Google y Meta reciben datos de tu visita —entre ellos tu dirección IP— y, en el caso
              de las cookies de marketing, los utilizan además para sus propios fines. Ese uso
              posterior no lo controlamos: se rige por las políticas de privacidad de cada uno, que
              podés consultar en{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="site-link">
                policies.google.com/privacy
              </a>{" "}
              y{" "}
              <a href="https://www.facebook.com/privacy/policy" target="_blank" rel="noopener noreferrer" className="site-link">
                facebook.com/privacy/policy
              </a>
              . Esta política tampoco cubre los sitios de terceros a los que enlazamos, que tienen
              las suyas.
            </p>

            {/* Sección nueva y con respaldo en el código: el plazo que dice acá
                es el que aplica `VIGENCIA_CONSENTIMIENTO_MS`. Si alguien cambia
                uno, tiene que cambiar el otro — un texto legal que promete doce
                meses sobre un consentimiento que no caduca es exactamente la
                clase de afirmación que no se puede sostener. */}
            <h2 className="ck-h">Cuánto vale tu decisión</h2>
            <p>
              Tu elección vale doce meses. Cumplido ese plazo volvemos a preguntarte. También te
              vamos a preguntar de nuevo si entrás desde otro dispositivo o navegador, si borrás
              los datos de navegación, o si cambian las finalidades sobre las que te preguntamos.
            </p>

            <h2 className="ck-h">Cómo cambiarla o retirarla</h2>
            <p>
              Desde el panel que está más abajo en esta misma página, en cualquier momento y sin
              dar explicaciones. Retirar el consentimiento cuesta lo mismo que darlo. Podés además
              bloquear o borrar cookies desde la configuración de tu navegador, con independencia de
              lo que elijas acá.
            </p>

            <h2 className="ck-h">Tus derechos</h2>
            <p>
              El tratamiento de datos personales se rige por la Ley N° 18.331 y su reglamentación:
              podés ejercer tus derechos de acceso, rectificación, actualización, inclusión o
              supresión escribiendo a{" "}
              <a href="mailto:info@gbengochea.com.uy" className="site-link">
                info@gbengochea.com.uy
              </a>
              .
            </p>
            {/* El derecho del art. 16, que faltaba. No es adorno: las cookies de
                marketing sirven para elaborar perfiles, y la Guía de Cookies y
                Perfiles de la URCDP (dic-2018) define el perfilado exactamente
                así —«la inferencia a partir de la observación continua del
                comportamiento de las personas, especialmente las páginas que
                visita y los anuncios en los que hace clic»— y le dedica media
                guía. Enumerar los cinco derechos del art. 14 y omitir el del 16
                era omitir justo el que corresponde a lo que hacemos. */}
            <p>
              Y como las cookies de marketing permiten elaborar perfiles, podés también impugnar las
              valoraciones automatizadas que se hagan a partir de ellos y pedirnos los criterios de
              valoración utilizados, conforme al artículo 16 de esa misma ley. El responsable del
              tratamiento es Gastón Bengochea y Compañía Corredor de Bolsa S.A.
            </p>

            {/* La última sección del canon (Marex, PIMCO, Lombard Odier, BBVA).
                La segunda oración no es una fórmula: la respalda
                VERSION_CONSENTIMIENTO, que al subirse descarta las decisiones
                tomadas sobre otra pregunta y hace reaparecer el banner. */}
            <h2 className="ck-h">Cambios en esta política</h2>
            <p>
              Las finalidades y los proveedores pueden cambiar. Cuando eso pase actualizamos esta
              página; y si el cambio afecta a lo que te preguntamos, te lo volvemos a preguntar en
              lugar de darlo por consentido.
            </p>
          </div>

          {/* El control, y no un párrafo que explique dónde está el control:
              retirar el consentimiento tiene que costar lo mismo que darlo, y
              acá es donde el visitante llega a buscarlo. */}
          <div className="ck-control">
            <CambiarConsentimiento />
          </div>

          {/* La salida. Es la única página del sitio del fondo que no es la home,
              así que sin esto el visitante que entró por el link del banner
              queda sin camino de vuelta más que el botón del navegador. */}
          <p className="ck-volver">
            <a href={home} className="site-link">
              Volver a BNG Selección Global
            </a>
          </p>
          </div>
        </div>
      </section>

      <style>{css`
        /* El alto de la barra de marca va en el padding: la barra es absoluta y
           no ocupa lugar en el flujo, así que sin esto el título le quedaría
           debajo. Ver el comentario del encabezado. */
        .ck-masthead {
          padding-top: calc(var(--nav-h) + clamp(40px, 5vw, 64px));
          padding-bottom: clamp(44px, 5vw, 64px);
        }

        /* La columna de lectura. Va como TOPE adentro del site-wrap de siempre y
           no con el site-wrap-narrow (que además centra): el margen izquierdo de
           esta página tiene que ser el mismo que el del wordmark de la barra y el
           del pie —los tres son la misma cáscara—, y con el wrap angosto el
           título arrancaba 160px a la derecha del logo. */
        .ck-col { max-width: 780px; }

        /* Página-documento: se lee, no se recorre. De ahí que el cuerpo vaya en
           el tamaño de lectura de la casa y no en la letra chica de 12,5px del
           colofón de la home — allá es una nota al pie de otra cosa, acá es el
           texto principal. */
        .ck-cuerpo { margin-top: 0; }
        .ck-cuerpo p { margin: 0; font-size: 16px; line-height: 1.7; color: var(--site-ink-2); }
        .ck-cuerpo p + p { margin-top: 18px; }
        .ck-cuerpo strong { font-weight: 600; color: var(--site-ink); }

        /* Encabezados de sección. La política pasó de cuatro párrafos corridos a
           siete apartados el 16-ago-2026 y sin rótulos se volvía un muro: las
           políticas del rubro que se leen —Marex, Lombard Odier, Pictet, BBVA—
           están todas seccionadas. Chicos y en negrita, no en la escala de
           titular: son señales de navegación adentro de un documento, no
           jerarquía editorial. El filete de arriba los separa sin gritar.

           ⚠️ VA CON DOS CLASES A PROPÓSITO. El reset de la casa es «.site h2»
           —(0,1,1)— y le impone peso 400, interlínea 1.12 y tracking negativo,
           que es lo contrario de lo que quiere un rótulo de apartado. Un «.ck-h»
           pelado es (0,1,0) y PIERDE contra el reset. Con el ancestro suma
           (0,2,0) y gana.

           ⚠️ Y ESTE COMENTARIO YA SE ROMPIÓ DOS VECES el 16-ago-2026, las dos
           por lo mismo: una secuencia de cierre de comentario suelta en el medio
           del texto. La primera fue un cierre de más al editar; la segunda, peor,
           fue NOMBRAR esa secuencia entre comillas para advertir sobre ella —
           entre comillas cierra igual, el parser no lee comillas.
           El síntoma no es un error: es que todo lo que sigue deja de parsearse
           y los encabezados salen sin margen ni filete, pegados al párrafo de
           arriba. El CSS inválido no avisa, desaparece. Nombrar la secuencia en
           prosa, nunca escribirla. */
        .fondo-cookies .ck-h {
          margin: 36px 0 14px;
          font-size: 15px; font-weight: 700; line-height: 1.35; letter-spacing: 0;
          color: var(--site-ink);
          padding-top: 18px; border-top: 1px solid var(--site-border);
        }

        .ck-control { margin-top: 44px; }
        .ck-volver { margin: 40px 0 0; }
      `}</style>
    </main>
  );
}
