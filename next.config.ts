import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Baseline CSP without nonces. We allow 'unsafe-inline' for script/style because
// Next emits inline bootstrap and several components use the `style` prop;
// upgrading to nonce-based CSP requires switching every page to dynamic rendering.
// All third-party data (Yahoo, EDGAR, logo providers) is proxied through our own
// /api/* routes, so connect-src/img-src can stay 'self'.
const cspDirectives = [
  "default-src 'self'",
  // 'wasm-unsafe-eval' habilita SOLO compilar WebAssembly (no eval de JS):
  // @react-pdf/renderer compila el layout engine yoga a WASM en el browser —
  // sin esto, pdf().toBlob() rechaza en prod y el export de PDF nunca termina.
  // 'unsafe-eval' completo queda restringido a dev (tooling de Next).
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
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

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives.join("; ") },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

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
  async redirects() {
    return [
      // /analyze (nombre viejo en inglés) → /analisis. El query (?ticker=) se
      // arrastra solo. 307 y no 308: la ruta del reporte es noindex y de bajo
      // tráfico — no clavamos un redirect permanente en el browser por si el
      // esquema de URL sigue evolucionando.
      { source: "/analyze", destination: "/analisis", permanent: false },
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
