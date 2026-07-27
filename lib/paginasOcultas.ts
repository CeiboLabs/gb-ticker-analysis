// Rutas que TODAVÍA NO se publican: la sección existe en el código pero no está
// terminada, así que se BLOQUEA EL ACCESO — no la visibilidad.
//
// Decisión deliberada: el navbar y el footer siguen listando estas secciones. El
// equipo tiene que ver el mapa completo del sitio; lo que no puede es entrar a
// contenido a medio hacer. Un link del nav a una de estas rutas lleva al 404.
//
// Ésta es la ÚNICA fuente de verdad. Con la ruta en esta lista:
//   · la página llama `notFound()` y devuelve un 404 real con el
//     `app/not-found.tsx` de la casa (las subrutas ya no existen: 404 solo);
//   · `app/sitemap.ts` no la lista (no se le ofrece a un crawler una URL que
//     devuelve 404).
//
// El bloqueo NO va en un `proxy.ts` (el middleware de Next 16). Se intentó y se
// descartó: detrás del reverse proxy del server llega `X-Forwarded-Proto: https`,
// así que el `new URL(path, request.url)` del rewrite apuntaba a
// `https://localhost:8788` — TLS contra el puerto HTTP del propio Next — y las
// seis rutas devolvían 500 (EPROTO) en vez de 404. La guarda en la página es
// inmune al esquema porque nunca sale del proceso.
//
// Terminar una sección = borrar su línea de acá y rebuildear. No hay nada más
// que tocar: la página deja de 404ear y vuelve al sitemap.

export const PAGINAS_OCULTAS: readonly string[] = [
  "/nosotros",
  "/historia",
  "/servicios",
  "/educacion",
  "/prensa",
  // Cubre las cuatro rutas de sector (/oportunidades/tecnologia, /energia,
  // /agro, /logistica) por la regla de prefijo de `estaOculta`.
  "/oportunidades",
];

/**
 * Path normalizado de un href interno, o null si el href sale del sitio
 * (https://…, mailto:, tel:, un PDF externo). Saca hash y query — `/servicios#local`
 * cuenta como `/servicios` — y la barra final.
 */
function ruta(href: string): string | null {
  if (!href.startsWith("/")) return null;
  const soloPath = href.split("#")[0].split("?")[0];
  const limpio = soloPath.replace(/\/+$/, "").toLowerCase();
  return limpio === "" ? "/" : limpio;
}

/** ¿Esta ruta (o su padre) está sin publicar? Los hrefs externos nunca lo están. */
export function estaOculta(href: string): boolean {
  const r = ruta(href);
  if (r === null) return false;
  return PAGINAS_OCULTAS.some((oculta) => r === oculta || r.startsWith(`${oculta}/`));
}
