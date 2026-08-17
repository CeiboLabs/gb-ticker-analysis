// Medición del SITIO DEL FONDO (bengocheainversiones.com) — FUENTE ÚNICA.
//
// Acá viven las dos mitades de una misma decisión, y viven juntas a propósito:
//
//   1. el contenedor de GTM que se hornea en el HTML (`GTM_ID`);
//   2. los dominios que la CSP tiene que dejar pasar para que los tags DE ADENTRO
//      de ese contenedor funcionen (`MEDICION_CSP`).
//
// Separarlas es el error clásico: instalar el contenedor, verlo cargar, y que
// cada tag que la agencia publique después muera contra la CSP sin que nadie del
// lado de ellos pueda diagnosticarlo — el navegador reporta el bloqueo en NUESTRA
// consola, no en su panel de GTM. Quien agregue una familia de tags nueva toca
// este archivo y la CSP lo sigue sola (`lib/headersSeguridad.ts` importa de acá).
//
// Contexto: contenedor creado por Orange Attitude (agencia) para la campaña paga
// del fondo, informado por mail el 2026-08-13. Es un contenedor NUEVO — no el
// GTM-54XCKR2R que corre en el sitio institucional viejo (gbengochea.com.uy).

import {
  CLAVE_CONSENTIMIENTO,
  VERSION_CONSENTIMIENTO,
  VIGENCIA_CONSENTIMIENTO_MS,
} from "./consentimiento";
import { FONDO_STANDALONE } from "./sitios";

/**
 * Contenedor de Google Tag Manager de la landing del fondo.
 *
 * No es un secreto: viaja en el HTML de cualquier visitante, como todo ID de GTM.
 * Está hardcodeado y no en `.env` justamente por eso — un `.env.local` que no se
 * commitea haría que cualquier rebuild en otra máquina publicara el sitio SIN
 * medición y sin que nada falle a la vista. Cambiarlo es un cambio de código,
 * que es lo correcto para algo que además obliga a revisar `MEDICION_CSP`.
 */
export const GTM_ID = "GTM-NQNQN62H";

/**
 * ¿Se emite el contenedor en este build?
 *
 * Sólo en el build STANDALONE del fondo, o sea el que se sube al hosting. Queda
 * deliberadamente afuera de:
 *   · el `next dev` del desarrollador;
 *   · el build COMPARTIDO — el home server de staging, donde revisa el cliente.
 * Los dos sirven la misma página del fondo (por `/bng-seleccion-global`), y sin
 * este corte cada revisión interna entraría a la propiedad de GA4 como tráfico
 * real. Ensuciar la data del primer mes de campaña con nuestras propias visitas
 * es difícil de detectar después y imposible de limpiar.
 *
 * Kill-switch: `MEDICION_OFF=1` en el env del build apaga la medición sin tocar
 * código — para publicar un build limpio si hubiera que sacarla de apuro.
 */
export const MEDICION_ACTIVA = FONDO_STANDALONE && process.env.MEDICION_OFF !== "1";

/**
 * Los dominios que la CSP tiene que habilitar, por directiva.
 *
 * Esto NO es la lista de lo que el sitio carga: es la lista de lo que la agencia
 * PUEDE llegar a disparar desde GTM sin volver a pedirnos un deploy. Es el stack
 * estándar de una campaña de performance —GTM, GA4, Google Ads, pixel de Meta—
 * decidido así a sabiendas: la alternativa (habilitar sólo googletagmanager.com)
 * obliga a un cambio de código y una subida al hosting por cada tag que
 * publiquen, y en la práctica se traduce en varias rondas de "no nos anda".
 *
 * Habilitar el dominio no enciende nada por sí solo. Sin un tag publicado en el
 * contenedor, ninguno de estos hosts se contacta jamás: esto sólo deja de
 * bloquear lo que ellos decidan publicar.
 *
 * ⚠️ Lo que esta lista NO cubre, y hay que pedir explícitamente si aparece:
 *   · Variables de «JavaScript personalizado» de GTM — necesitan 'unsafe-eval' en
 *     script-src, que hoy está restringido a dev. Es aflojar la directiva que
 *     frena la clase entera de XSS por inyección de string; no se concede de
 *     oficio, se conversa.
 *   · Tags de terceros fuera de Google/Meta (LinkedIn, TikTok, Hotjar, Clarity…):
 *     cada uno trae sus propios hosts y va agregado acá.
 *   · La vista previa de GTM que EMBEBE el sitio en un iframe de
 *     tagassistant.google.com: la frena `frame-ancestors 'none'`, que es
 *     antiframing y no se toca. El flujo de Tag Assistant que abre el sitio en
 *     una PESTAÑA nueva sí funciona, y es el que hay que usar para depurar.
 */
export const MEDICION_CSP: Record<string, string[]> = {
  // El loader de GTM y el de gtag/js (GA4 y Ads salen del mismo host), más los
  // scripts que inyecta la vista previa cuando depuran el contenedor.
  "script-src": [
    "https://www.googletagmanager.com",
    "https://tagmanager.google.com",
    // Google Ads: conversiones y remarketing.
    "https://www.googleadservices.com",
    "https://googleads.g.doubleclick.net",
    "https://www.google.com",
    // Pixel de Meta.
    "https://connect.facebook.net",
  ],
  // Adonde SALEN los hits. Es la directiva que más rompe cuando falta: el tag
  // carga, dispara, y el evento muere en el `sendBeacon` sin ruido visible.
  // El comodín de google-analytics cubre los hosts regionales (region1…regionN),
  // que Google asigna por ubicación del visitante y no son enumerables.
  "connect-src": [
    "https://www.googletagmanager.com",
    "https://tagassistant.google.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://stats.g.doubleclick.net",
    "https://googleads.g.doubleclick.net",
    "https://www.google.com",
    "https://connect.facebook.net",
    "https://www.facebook.com",
  ],
  // Varios tags miden por pixel (img de 1×1) en vez de por fetch: Meta lo usa de
  // fallback y las conversiones de Ads pegan al dominio local de Google.
  "img-src": [
    "https://www.googletagmanager.com",
    "https://*.google-analytics.com",
    "https://googleads.g.doubleclick.net",
    "https://www.google.com",
    "https://www.google.com.uy",
    "https://www.facebook.com",
    "https://ssl.gstatic.com",
    "https://www.gstatic.com",
  ],
  // Sólo la vista previa de GTM: el panel de depuración trae su propia hoja de
  // estilos y su tipografía. Nada de esto carga en una visita normal.
  "style-src": ["https://tagmanager.google.com", "https://fonts.googleapis.com"],
  "font-src": ["https://fonts.gstatic.com"],
  // El `<noscript>` de GTM y el iframe del conversion linker de Ads.
  "frame-src": [
    "https://www.googletagmanager.com",
    "https://td.doubleclick.net",
    "https://tagassistant.google.com",
  ],
};

/**
 * Consent Mode v2 + el snippet de GTM, en ESE orden y en el mismo `<script>`.
 *
 * ── POR QUÉ EL ORDEN ES TODO ──────────────────────────────────────────────
 * Las señales por defecto tienen que estar puestas ANTES de que GTM se cargue.
 * Si llegan después, los tags que ya dispararon lo hicieron sin restricción: el
 * consentimiento se aplicaría recién a partir del segundo evento, que es
 * exactamente el evento que a nadie le importa. Por eso esto no puede vivir en un
 * `useEffect`, ni en un componente de cliente, ni en `next/script`: para cuando
 * React hidrata, GTM ya corrió. Va acá, síncrono, en el HTML.
 *
 * Por la misma razón la decisión guardada se lee de `localStorage` a mano y en
 * crudo: al visitante que ya aceptó hay que concederle desde el primer tick, sin
 * un parpadeo de "denegado" que le costaría la primera vista de cada sesión.
 *
 * ── QUÉ MODO ES ÉSTE ──────────────────────────────────────────────────────
 * Consent Mode AVANZADO: GTM carga siempre y los tags respetan las señales. Con
 * `analytics_storage: denied`, GA4 no escribe cookies ni identifica a nadie, pero
 * manda pings sin cookies. Es el modo que Google diseñó para esto y el que asumen
 * las agencias — con `ads_data_redaction` prendido mientras no haya publicidad
 * consentida, que además borra los identificadores de anuncios.
 *
 * ⚠️ Si legales pide CERO tráfico antes del consentimiento —lectura más estricta,
 * defendible—, el cambio es de una línea: mover el bloque del loader de GTM
 * adentro de un `if` sobre la decisión guardada, y hacer que el banner lo inyecte
 * al aceptar. El costo es que la agencia deja de ver el contenedor hasta que
 * alguien acepta, incluido su propio modo vista previa.
 */
export function snippetGTM(id: string): string {
  // El ID se interpola dentro de un `<script>` que se inyecta por
  // `dangerouslySetInnerHTML`. Hoy es una constante de este archivo y no hay
  // superficie de inyección — pero el día que alguien lo cablee a un env o, peor,
  // a un query param, esto sería XSS de libro. La forma de un contenedor de GTM es
  // conocida y angosta, así que se valida acá, en el único lugar que construye el
  // string, y no en el llamador: una validación que se puede saltear no es una.
  if (!/^GTM-[A-Z0-9]+$/.test(id)) {
    throw new Error(`ID de contenedor GTM inválido: ${JSON.stringify(id)}`);
  }

  // Se arma con concatenación y no con una plantilla multilínea porque este texto
  // viaja en el HTML de cada visita: sin saltos ni sangrías son ~200 bytes menos.
  const consentimiento =
    `<script>window.dataLayer=window.dataLayer||[];` +
    `function gtag(){dataLayer.push(arguments)}` +
    // `arguments` a propósito: gtag define su API por posición y un spread a un
    // array la rompe en silencio (el push guardaría un array, no el objeto que
    // Google lee). Es el error clásico al "modernizar" este snippet.
    `var a='denied',b='denied';` +
    `try{var c=JSON.parse(localStorage.getItem(${JSON.stringify(CLAVE_CONSENTIMIENTO)}));` +
    // La MISMA condición que `leerConsentimiento` (lib/consentimiento.ts): versión
    // del contrato y vigencia. Los dos lados tienen que decidir igual — si acá
    // concediera una decisión que allá ya venció, el banner volvería a preguntar
    // mientras GTM ya está midiendo con el consentimiento viejo.
    `if(c&&c.v===${VERSION_CONSENTIMIENTO}&&Date.now()-(c.ts||0)<=${VIGENCIA_CONSENTIMIENTO_MS})` +
    `{if(c.analitica)a='granted';if(c.publicidad)b='granted'}}catch(e){}` +
    `gtag('consent','default',{ad_storage:b,ad_user_data:b,ad_personalization:b,` +
    `analytics_storage:a,functionality_storage:'granted',security_storage:'granted'});` +
    `gtag('set','ads_data_redaction',b!=='granted');` +
    // Sin cookies de publicidad, el clic pagado pierde el identificador al
    // aterrizar. `url_passthrough` lo mantiene en la URL para que la campaña siga
    // siendo atribuible sin almacenar nada en el navegador.
    `gtag('set','url_passthrough',true);</script>`;

  return (
    consentimiento +
    `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':` +
    `new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],` +
    `j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=` +
    `'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);` +
    `})(window,document,'script','dataLayer','${id}');</script>` +
    `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${id}"` +
    ` height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`
  );
}
