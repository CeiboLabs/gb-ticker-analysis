import { headers } from "next/headers";
import type { MetadataRoute } from "next";
import { SITE_URL, SEO_INDEXABLE } from "@/lib/seo";
import { esHostFondo, SITIO_FONDO_URL } from "@/lib/sitios";

// Reemplaza al viejo public/robots.txt (que tenía `Disallow: /` y bloqueaba TODO).
// Kill-switch: sin SEO_INDEXABLE=1 el sitio entero queda bloqueado (protege el WIP
// de indexación prematura mientras se trabaja el contenido). Con el flag prendido:
// allow *, se excluyen panel/API/proxy-PDF; crawlers de IA permitidos (los cubre
// el `*`, decisión GEO). Ver docs/SEO-plan.md.
//
// DOS SITIOS, UN DEPLOY (ver lib/sitios.ts): este archivo sirve el robots.txt de
// los dos dominios, así que la respuesta depende del Host por el que entró el
// request — de ahí el `headers()` y el force-dynamic.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  if (!SEO_INDEXABLE) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  if (esHostFondo((await headers()).get("host"))) {
    // En el dominio del fondo la ÚNICA URL legítima es la raíz. El resto de las
    // rutas de la app responde también en este host —se reescribe sólo `/`, para
    // no tocar `/_next/*` ni `/api/*`—, así que sin esto el sitio institucional
    // entero quedaría publicado dos veces, una por dominio.
    // `Allow: /$` matchea exactamente la raíz y en robots.txt gana la regla más
    // específica: se indexa la raíz y nada más. `/_next/` va permitido porque
    // Google necesita el CSS y el JS para renderizar la página.
    return {
      rules: { userAgent: "*", allow: ["/$", "/_next/"], disallow: "/" },
      sitemap: `${SITIO_FONDO_URL}/sitemap.xml`,
      host: SITIO_FONDO_URL,
    };
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
