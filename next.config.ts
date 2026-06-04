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
  turbopack: {
    resolveAlias: {
      "@deno/shim-deno": "./lib/deno-shim-edge/index.js",
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
