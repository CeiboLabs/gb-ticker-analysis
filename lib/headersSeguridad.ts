// Headers de seguridad del sitio — FUENTE ÚNICA.
//
// Los consumen dos caminos que no se cruzan:
//   · `next.config.ts`, para todo lo que sirve el server de Next;
//   · `scripts/build-fondo.ts`, que los escribe en el `_headers` del deploy
//     estático del fondo en Cloudflare.
//
// Están acá y no en next.config justamente por el segundo: los assets estáticos
// se sirven SIN invocar código nuestro, así que ninguna cabecera de la app llega
// sola. Duplicar la CSP en un archivo de Cloudflare era garantía de divergencia
// silenciosa — se toca una y la otra queda vieja, y nadie se entera hasta que
// algo deja de cargar.

export function cspDirectives({ dev }: { dev: boolean }): string[] {
  return [
    "default-src 'self'",
    // 'wasm-unsafe-eval' habilita SOLO compilar WebAssembly (no eval de JS):
    // @react-pdf/renderer compila el layout engine yoga a WASM en el browser —
    // sin esto, pdf().toBlob() rechaza en prod y el export de PDF nunca termina.
    // 'unsafe-eval' completo queda restringido a dev (tooling de Next).
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    // @react-pdf/renderer carga el WASM de yoga vía fetch(data:...) y crea un worker desde blob:.
    "connect-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // El mapa de /contacto es un embed de Google Maps; los videos de /novedades usan
    // el reproductor privacy-enhanced de YouTube (no setea cookies hasta reproducir).
    "frame-src https://www.google.com https://maps.google.com https://www.youtube-nocookie.com",
    "upgrade-insecure-requests",
  ];
}

/**
 * El set completo, en la forma que pide `next.config.ts`.
 *
 * El deploy del fondo emite EXACTAMENTE estos mismos headers. Se podría afinar
 * un `frame-src` más corto ahí —esa página no tiene iframes— pero una CSP que
 * difiere por deploy es una CSP que nadie audita: la diferencia se paga cada vez
 * que alguien agrega un embed y tiene que acordarse de tocar dos lugares.
 */
export function headersSeguridad({ dev }: { dev: boolean }): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: cspDirectives({ dev }).join("; ") },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
  ];
}
