import type { MetadataRoute } from "next";
import { SITE_URL, SEO_INDEXABLE } from "@/lib/seo";

// Reemplaza al viejo public/robots.txt (que tenía `Disallow: /` y bloqueaba TODO).
// Kill-switch: sin SEO_INDEXABLE=1 el sitio entero queda bloqueado (protege el WIP
// de indexación prematura mientras se trabaja el contenido). Con el flag prendido:
// allow *, se excluyen panel/API/proxy-PDF; crawlers de IA permitidos (los cubre
// el `*`, decisión GEO). Ver docs/SEO-plan.md.
export default function robots(): MetadataRoute.Robots {
  if (!SEO_INDEXABLE) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/informes/*/pdf"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
