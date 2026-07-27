// SEO — helpers de metadata centralizados. Evita repetir OG/canonical por página
// y el footgun del merge shallow de Next (los objetos anidados como openGraph los
// reemplaza por completo el último segmento que los define). Ver docs/SEO-plan.md.

import type { Metadata } from "next";

/**
 * Origen canónico del sitio. El dominio real está TBD (ver decisión D1 del plan):
 * se usa gbengochea.com.uy como placeholder y se cambia en UN solo lugar por env
 * `NEXT_PUBLIC_SITE_URL`. Sin barra final (para componer paths sin dobles `//`).
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://gbengochea.com.uy"
).replace(/\/+$/, "");

export const SITE_NAME = "Gastón Bengochea & Cía.";
export const LOCALE = "es_UY";

/**
 * Interruptor de indexación (deploy-time). Por defecto el sitio NO se indexa:
 * `app/robots.ts` devuelve `Disallow: /` y el root layout emite `noindex` global.
 * Protege el WIP de indexación prematura mientras se trabaja el contenido. Al
 * lanzar: setear `SEO_INDEXABLE=1` en el `.env` y **rebuild + restart** (es un
 * flag de build; un restart sin rebuild no lo cambia). Ver docs/SEO-plan.md.
 */
export const SEO_INDEXABLE = process.env.SEO_INDEXABLE === "1";

/** URL absoluta desde un path relativo — para JSON-LD, que exige URLs absolutas. */
export const abs = (path = "/") =>
  `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

type PageMeta = {
  /** Título de la página SIN sufijo de marca — el `title.template` del root lo agrega. */
  title: string;
  description: string;
  /** Path relativo, p.ej. "/historia" → canonical + og:url (resuelto por metadataBase). */
  path: string;
  type?: "website" | "article";
  noindex?: boolean;
  /** Sólo `type: "article"` (ISO 8601). */
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
};

/**
 * Arma la Metadata de una página. Con `metadataBase` (root layout) los paths
 * relativos resuelven a absolutos. NO setea imágenes OG a propósito: el archivo
 * file-based (`app/opengraph-image.tsx`, o el propio de `informes/[slug]`) tiene
 * prioridad y provee `og:image` site-wide; Twitter cae a esa imagen vía
 * `card: summary_large_image`. Para una OG propia de una página, agregar un
 * `opengraph-image.tsx` en ese segmento (no setear `images` acá).
 */
export function pageMetadata(m: PageMeta): Metadata {
  const article = m.type === "article";
  return {
    title: m.title,
    description: m.description,
    alternates: { canonical: m.path },
    ...(m.noindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      type: m.type ?? "website",
      url: m.path,
      siteName: SITE_NAME,
      locale: LOCALE,
      title: m.title,
      description: m.description,
      ...(article
        ? {
            publishedTime: m.publishedTime,
            modifiedTime: m.modifiedTime,
            authors: m.authors,
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: m.title,
      description: m.description,
    },
  };
}
