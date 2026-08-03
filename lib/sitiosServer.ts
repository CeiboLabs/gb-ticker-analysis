// La parte de `lib/sitios.ts` que necesita el REQUEST, en un módulo aparte.
//
// Está separada por una razón concreta: `next.config.ts` importa lib/sitios para
// armar sus matchers de Host, y ese archivo lo carga Node fuera de todo contexto
// de request — un `next/headers` colgando de esa cadena de imports no tiene
// dónde resolverse. Todo lo que dependa del request vive de este lado.

import { headers } from "next/headers";
import { FONDO_STANDALONE, SITIO_CASA_URL, origenCasa } from "@/lib/sitios";

/**
 * Origen del sitio institucional para los links que SALEN del sitio del fondo.
 *
 * En el build STANDALONE del fondo la respuesta es constante y no se mira el
 * request: ese deploy sirve un solo dominio. Evitar el `headers()` no es una
 * optimización — es lo que deja la página PRERENDERIZABLE, y sin HTML
 * prerenderizado no hay assets estáticos que subir a Cloudflare.
 *
 * En el build compartido (el dev del desarrollador, el home server, y cualquier
 * deploy que sirva los dos sitios) se sigue resolviendo por Host: es lo que
 * mantiene los links RELATIVOS donde los dos sitios comparten hostname, y lo que
 * evita que staging termine con links al dominio de producción. El porqué largo
 * está en `origenCasa`, en lib/sitios.ts.
 */
export async function origenCasaServer(): Promise<string> {
  if (FONDO_STANDALONE) return SITIO_CASA_URL;
  return origenCasa((await headers()).get("host"));
}
