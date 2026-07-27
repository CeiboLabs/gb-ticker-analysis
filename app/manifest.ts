import type { MetadataRoute } from "next";

// Web manifest — instalabilidad/PWA + theme-color móvil. Íconos: se reutilizan
// los PNG existentes en public/ (para 192/512 maskable habría que generarlos;
// pendiente, no bloquea). Ver docs/SEO-plan.md.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gastón Bengochea & Cía. — Sociedad de Bolsa",
    short_name: "Bengochea",
    description:
      "Sociedad de bolsa uruguaya desde 1967. Acceso a mercados globales con nuestro asesoramiento.",
    lang: "es-UY",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f2249",
    icons: [
      { src: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { src: "/apple-icon-180x180.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
