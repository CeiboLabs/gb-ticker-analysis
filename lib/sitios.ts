// LOS DOS SITIOS DE LA CASA, EN UN SOLO DEPLOY.
//
// Decisión del equipo (2026-07-29): BNG Selección Global deja de ser una sección
// del sitio institucional y pasa a ser un SITIO propio — dominio, navbar y pie
// propios. Lo que NO cambia es el proyecto: los dos sitios son la misma app Next.
// Separar el repo habría duplicado los tokens de `globals.css`, los componentes
// compartidos (Reveal/SplitText/iconos, el gesto de arrastrar-para-medir) y —lo
// caro— el panel de empleados, que publica los documentos y el NAV del fondo
// contra la misma base.
//
// Cómo se reparte la responsabilidad:
//   · la CÁSCARA la decide el route group — `app/(institucional)` vs `app/(fondo)`,
//     cada uno con su layout. Es estructura de archivos, no lógica en runtime;
//   · el DOMINIO lo decide `next.config.ts`, que matchea el `Host` y reescribe la
//     raíz del dominio del fondo a `RUTA_FONDO`.
//
// ⚠️ El ruteo por dominio NO va en un `proxy.ts` (el middleware de Next 16). Ya se
// probó para otra cosa y falla en este server: detrás del reverse proxy llega
// `X-Forwarded-Proto: https`, así que el `new URL(path, request.url)` del rewrite
// apunta a `https://localhost:<puerto HTTP>` y la respuesta es 500 (EPROTO) — ver
// el comentario largo de `lib/paginasOcultas.ts`. Los rewrites de `next.config.ts`
// se resuelven adentro del router, sin construir ninguna URL a partir del request,
// así que son inmunes a eso.
//
// Los dos orígenes son PLACEHOLDERS hasta que se defina el dominio (decisión D1 de
// docs/SEO-plan.md). Se cambian por env, y sólo acá:
//   NEXT_PUBLIC_SITE_URL   → el sitio institucional
//   NEXT_PUBLIC_FONDO_URL  → el sitio del fondo
// Son flags de BUILD (los rewrites se hornean en el build): cambiarlos exige
// rebuild + restart, no alcanza el restart.

const sinBarraFinal = (url: string) => url.replace(/\/+$/, "");

// `||` y no `??`: en CI estas variables llegan SIEMPRE, y llegan VACÍAS cuando no
// están configuradas (`${{ vars.X }}` de una variable inexistente es la cadena
// vacía, no la ausencia). Con `??` esa cadena vacía ganaba y el canonical, el
// sitemap y los links salientes quedaban con origen "" — un deploy roto en
// silencio. Vacío es lo mismo que sin definir.

/** Origen del sitio institucional. Lo reexporta `lib/seo.ts` como `SITE_URL`. */
export const SITIO_CASA_URL = sinBarraFinal(
  process.env.NEXT_PUBLIC_SITE_URL || "https://gbengochea.com.uy",
);

/**
 * Origen del sitio del fondo.
 *
 * Decidido 2026-07-31: el fondo se sirve en la RAÍZ de `bengocheainversiones.com`
 * —dominio propio, registrado y con la zona en la cuenta de Cloudflare del
 * fondo—, y el institucional se conserva en `gbengochea.com.uy`.
 */
export const SITIO_FONDO_URL = sinBarraFinal(
  process.env.NEXT_PUBLIC_FONDO_URL || "https://bengocheainversiones.com",
);

/**
 * ¿Este build es el del sitio del fondo SOLO, para su propio deploy?
 *
 * El fondo se publica en Cloudflare como HTML estático servido por el borde
 * —sin invocar worker— más un worker chico para `/api/fondo*`. Ese deploy sirve
 * UN dominio y sólo uno, así que todo lo que en el build compartido se resuelve
 * por Host acá es constante. Lo que habilita, concretamente: la página deja de
 * llamar `headers()` (ver `lib/sitiosServer.ts`) y con eso pasa a ser
 * PRERENDERIZABLE — sin HTML prerenderizado no hay archivo que subir y todo el
 * diseño se cae.
 *
 * ⚠️ ES `NEXT_PUBLIC_` DESDE EL 2026-08-17, y antes decía acá que
 * deliberadamente no lo era «porque no lo necesita ningún componente de
 * cliente». Eso dejó de ser cierto: en este deploy los datos ya no salen de
 * `/api/fondo*` —no hay worker que los sirva— sino de archivos estáticos que
 * publica el panel, y quien elige entre un origen y otro es `lib/useFondo.ts`,
 * que corre en el browser. Ver docs/plan-consolidacion-fondo.md.
 *
 * Se prefirió mover el flag existente a `NEXT_PUBLIC_` antes que agregar un
 * segundo flag para el cliente: son la misma pregunta —«¿es el deploy propio
 * del fondo?»— y dos nombres para una sola cosa se desincronizan. El costo es
 * una cadena de más en el bundle.
 */
export const FONDO_STANDALONE = process.env.NEXT_PUBLIC_FONDO_STANDALONE === "1";

/**
 * ¿El panel de empleados está abierto?
 *
 * **Cerrado mientras no se termine de pulir** (decisión del 2026-08-17).
 * `PANEL_HABILITADO=1` lo abre; cualquier otra cosa —incluida la variable sin
 * definir— lo deja cerrado. FAIL-CLOSED a propósito: el default no es «abierto
 * salvo que lo apaguen», así que un deploy nuevo o un `.env` que no viajó dejan
 * el panel cerrado en vez de expuesto.
 *
 * Vive acá, y no en lib/panelAuth.ts, porque lo leen DOS mundos: el gate de
 * cada request (panelAuth, que importa next/server) y `next.config.ts`, que no
 * puede importar nada de Next. Este módulo es el único que alcanzan los dos.
 *
 * ⚠️ NO lleva `NEXT_PUBLIC_`: en los bundles del browser queda en `false`, que
 * es lo correcto — no hay nada del panel que corra en el cliente sin pasar
 * antes por el server.
 */
export const PANEL_HABILITADO = process.env.PANEL_HABILITADO === "1";

/**
 * Path FÍSICO de la página del fondo dentro de la app. En su propio dominio se
 * sirve en la raíz (rewrite de `next.config.ts`), pero el archivo sigue viviendo
 * en esta ruta a propósito: es lo que mantiene el sitio del fondo accesible
 * cuando hay UN SOLO hostname — el dev del desarrollador y el home server, que
 * se publica por Tailscale con un único nombre y no tiene subdominios. Ahí el
 * sitio del fondo se entra por `/bng-seleccion-global`, con su cáscara propia.
 */
export const RUTA_FONDO = "/bng-seleccion-global";

/**
 * Portal de clientes. No es ninguno de los dos sitios —es el home banking de la
 * casa, una app aparte— pero los dos lo linkean, así que vive acá y no duplicado
 * en cada navbar.
 */
export const CONSULTANET_URL = "https://consultanet.gbengochea.com.uy/HBValores/wplogin.aspx";

const hostDe = (url: string) => new URL(url).hostname.toLowerCase();

export const HOST_CASA = hostDe(SITIO_CASA_URL);
export const HOST_FONDO = hostDe(SITIO_FONDO_URL);

/**
 * Alias del dominio del fondo en desarrollo. Los navegadores resuelven cualquier
 * `*.localhost` a 127.0.0.1, así que `https://fondos.localhost:3000` ejercita el
 * ruteo por Host sin tocar DNS ni /etc/hosts.
 * OJO: el certificado de `next dev --experimental-https` cubre sólo `localhost`
 * (SAN: DNS:localhost + los IP), así que el navegador va a advertir por el
 * nombre. Es esperado — se acepta y sigue.
 */
export const HOST_FONDO_DEV = "fondos.localhost";

/** Escapa un hostname para incrustarlo en los matchers de abajo. */
const escapar = (h: string) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Valores para `has: [{ type: "host", value }]` de `next.config.ts`.
 *
 * ⚠️ DOS DETALLES DE LA FORMA, los dos verificados contra el source de Next
 * 16.2.6 (`shared/lib/router/utils/prepare-destination.js`):
 *
 *  1. Next compila el valor como `new RegExp("^" + value + "$")`, y en un regex
 *     el `|` tiene la precedencia MÁS BAJA: `^a|b$` significa `(^a)|(b$)`. Sin el
 *     grupo que envuelve todo, esto matchearía cualquier host que EMPIECE con el
 *     dominio del fondo o que TERMINE con el alias de dev. De ahí el `(?: )`.
 *  2. Los grupos son SIN captura: Next vuelca los grupos nombrados de la coincidencia
 *     en los params del destino, y no queremos ensuciarlos.
 *
 * El `Host` llega sin puerto y en minúsculas (Next hace `host.split(":", 1)[0]
 * .toLowerCase()`), así que los matchers no tienen que preverlo.
 */
export const MATCH_HOST_FONDO = `(?:(?:www\\.)?${escapar(HOST_FONDO)}|${escapar(HOST_FONDO_DEV)})`;
export const MATCH_HOST_CASA = `(?:(?:www\\.)?${escapar(HOST_CASA)})`;

/** ¿Este request entró por el dominio del fondo? `host` sale del header `Host` (puede traer puerto). */
export function esHostFondo(host?: string | null): boolean {
  const nombre = (host ?? "").split(":")[0].toLowerCase();
  return nombre === HOST_FONDO || nombre === `www.${HOST_FONDO}` || nombre === HOST_FONDO_DEV;
}

/**
 * Prefijo para linkear al sitio institucional DESDE el del fondo.
 *
 * Devuelve `""` —o sea, links RELATIVOS— cuando los dos sitios comparten
 * hostname: el dev del desarrollador y el home server. Ahí `/contacto` es
 * exactamente lo correcto. Y devuelve el origen absoluto de la casa sólo cuando
 * el request entró de verdad por el dominio del fondo.
 *
 * Por qué se resuelve por request y no de una constante: un
 * `${SITIO_CASA_URL}/contacto` hardcodeado mandaría al dominio de PRODUCCIÓN
 * desde la máquina del desarrollador y desde staging, donde ese dominio todavía
 * no existe — el cliente revisa en staging y encontraría links muertos.
 */
export function origenCasa(host?: string | null): string {
  const h = (host ?? "").toLowerCase();
  if (!esHostFondo(h)) return "";
  const nombre = h.split(":")[0];
  // `fondos.localhost:3000` → `https://localhost:3000` (el dev corre con
  // --experimental-https, ver el script `dev` del package.json).
  if (nombre === HOST_FONDO_DEV) return `https://${h.slice("fondos.".length)}`;
  return SITIO_CASA_URL;
}

/**
 * Prefijo para linkear ENTRE páginas del sitio del fondo — el espejo hacia
 * adentro de `origenCasa`.
 *
 * El fondo dejó de ser una sola página el 16-ago-2026, cuando la política de
 * cookies salió a ruta propia (`/cookies`). Y esa URL no es la misma en todos
 * lados: en el dominio del fondo la página vive en la RAÍZ, así que su política
 * es `/cookies` a secas; donde los dos sitios comparten hostname —el dev y el
 * home server— el sitio del fondo cuelga de `RUTA_FONDO`, y ahí la política es
 * `/bng-seleccion-global/cookies`. Un literal `/cookies` hardcodeado apuntaría,
 * en el dev y en staging, a una ruta del sitio institucional que no existe.
 *
 * Devuelve `""` (links relativos a la raíz) en el dominio del fondo, y
 * `RUTA_FONDO` en cualquier otro host. Es exactamente la condición inversa a la
 * de `origenCasa`: cuando aquélla tiene que salir con origen absoluto, ésta ya
 * está en casa; cuando aquélla puede ser relativa, ésta necesita el prefijo.
 */
export function baseFondo(host?: string | null): string {
  return esHostFondo(host) ? "" : RUTA_FONDO;
}
