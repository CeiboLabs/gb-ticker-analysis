import type { NextConfig } from "next";
import {
  MATCH_HOST_CASA,
  MATCH_HOST_FONDO,
  RUTA_FONDO,
  SITIO_FONDO_URL,
} from "./lib/sitios";
import { headersSeguridad } from "./lib/headersSeguridad";

const isDev = process.env.NODE_ENV === "development";

// Baseline CSP without nonces. We allow 'unsafe-inline' for script/style because
// Next emits inline bootstrap and several components use the `style` prop;
// upgrading to nonce-based CSP requires switching every page to dynamic rendering.
// All third-party data (Yahoo, EDGAR, logo providers) is proxied through our own
// /api/* routes, so connect-src/img-src can stay 'self'.
//
// La lista vive en lib/headersSeguridad.ts porque el deploy estático del fondo en
// Cloudflare la necesita también, y ahí no hay server de Next que la agregue.
const securityHeaders = headersSeguridad({ dev: isDev });

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.7"],
  // better-sqlite3 es un addon NATIVO (bindings del home server, ver
  // lib/homeBindings.ts): no se bundlea — se resuelve desde node_modules en
  // runtime, como corresponde a un .node. `xlsx` (SheetJS) hace requires
  // condicionales de builtins de node al parsear el Excel de LRM del BCU
  // (lib/bcuLRM.ts): externalizarlo evita que el bundler los siga.
  serverExternalPackages: ["better-sqlite3", "xlsx"],
  turbopack: {
    resolveAlias: {
      "@deno/shim-deno": "./lib/deno-shim-edge/index.js",
    },
  },
  // ── DOS SITIOS, UN DEPLOY (ver lib/sitios.ts) ──────────────────────────────
  // La raíz del dominio del fondo ES la página del fondo. `beforeFiles` porque
  // tiene que ganarle a la ruta de archivo `/` (la home institucional). Es un
  // rewrite INTERNO: la URL que ve el usuario sigue siendo la raíz.
  //
  // Sólo se reescribe `/` — todo lo demás (`/_next/*`, `/api/*`, los assets)
  // sigue derecho, que es lo que hace que el mismo build sirva los dos sitios.
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          has: [{ type: "host", value: MATCH_HOST_FONDO }],
          destination: RUTA_FONDO,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async redirects() {
    return [
      // /analyze (nombre viejo en inglés) → /analisis. El query (?ticker=) se
      // arrastra solo. 307 y no 308: la ruta del reporte es noindex y de bajo
      // tráfico — no clavamos un redirect permanente en el browser por si el
      // esquema de URL sigue evolucionando.
      { source: "/analyze", destination: "/analisis", permanent: false },

      // El fondo se mudó a su propio dominio: en el dominio de la CASA, su path
      // viejo rebota al sitio nuevo. Así el usuario que entra por el navbar
      // institucional termina con el dominio del fondo en la barra de
      // direcciones — que es la decisión del equipo— y no queda la misma página
      // publicada en dos orígenes.
      // 307 y no 308 por lo mismo que arriba: el dominio está TBD (decisión D1
      // de docs/SEO-plan.md) y un permanente queda cacheado en el browser.
      {
        source: RUTA_FONDO,
        has: [{ type: "host", value: MATCH_HOST_CASA }],
        destination: `${SITIO_FONDO_URL}/`,
        permanent: false,
      },
      // Y en el dominio del fondo, el path viejo colapsa a la raíz: una sola URL
      // por página también adentro de ese host. No hay loop con el rewrite de
      // arriba — los redirects se evalúan contra el path que ENTRÓ (`/`, que no
      // matchea este source), y el rewrite no los vuelve a disparar.
      {
        source: RUTA_FONDO,
        has: [{ type: "host", value: MATCH_HOST_FONDO }],
        destination: "/",
        permanent: false,
      },

      // ⚠️ En cualquier host que no sea ninguno de los dos —el dev del
      // desarrollador y el home server, que se publica por Tailscale con UN solo
      // nombre— no matchea ni el rewrite ni los redirects: los dos sitios quedan
      // accesibles por path (`/` la casa, `/bng-seleccion-global` el fondo, cada
      // uno con su cáscara). Es deliberado: es la única forma de revisar el sitio
      // del fondo donde no hay subdominios.
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // El panel de empleados no tiene nada que hacer en un buscador (además
      // del metadata.robots noindex de app/admin/layout.tsx — cinturón y tiradores).
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
