// SEO — helpers de metadata centralizados. Evita repetir OG/canonical por página
// y el footgun del merge shallow de Next (los objetos anidados como openGraph los
// reemplaza por completo el último segmento que los define). Ver docs/SEO-plan.md.

import type { Metadata } from "next";
import { SITIO_CASA_URL, SITIO_FONDO_URL } from "./sitios";

/**
 * Origen canónico del sitio institucional. El dominio real está TBD (ver decisión
 * D1 del plan): se usa gbengochea.com.uy como placeholder y se cambia por env
 * `NEXT_PUBLIC_SITE_URL`. Sin barra final (para componer paths sin dobles `//`).
 *
 * La definición vive en `lib/sitios.ts` —junto con la del sitio del fondo, que es
 * OTRO dominio del mismo deploy— porque `next.config.ts` también la necesita para
 * rutear por Host. Acá sólo se reexporta con el nombre que ya usa todo el sitio.
 */
export const SITE_URL = SITIO_CASA_URL;

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

/**
 * Metadata de una página del SITIO DEL FONDO (ver `lib/sitios.ts`).
 *
 * Difiere de `pageMetadata` en dos cosas, las dos por ser otro dominio:
 *   · canonical y `og:url` van ABSOLUTOS al origen del fondo. El `metadataBase`
 *     del root layout apunta al sitio institucional, así que un path relativo
 *     resolvería al dominio equivocado — y como la misma página además se sirve
 *     por path en dev y en el home server, sin canonical absoluto las dos URLs
 *     competirían entre sí en el índice;
 *   · `og:site_name` es el del fondo: al compartir un link, el sitio que se
 *     nombra es el del producto, no el de la casa.
 */
/**
 * Nombre con el que la card OG del fondo se sirve en su dominio.
 *
 * Next genera esa imagen desde `app/(fondo)/bng-seleccion-global/opengraph-image.tsx`
 * bajo una ruta con hash (`/bng-seleccion-global/opengraph-image-1wynds?…`), que
 * en el deploy estático no existe: ahí la página vive en la raíz y el hash cambia
 * con cada build. `scripts/build-fondo.mts` copia el PNG generado a este nombre
 * fijo, y por eso acá se declara la URL a mano en vez de dejar que la resuelva la
 * convención de archivo.
 */
export const OG_FONDO = "/opengraph-image.png";

export function fondoMetadata(m: {
  title: string;
  description: string;
  /** Path DENTRO del sitio del fondo. La home del fondo es "/". */
  path?: string;
}): Metadata {
  const url = `${SITIO_FONDO_URL}${m.path && m.path !== "/" ? m.path : "/"}`;
  // ABSOLUTA al origen del fondo, por la misma razón que el canonical: el
  // `metadataBase` del root layout apunta al sitio institucional, así que dejar
  // que Next la resuelva publicaba `og:image` en gbengochea.com.uy — un dominio
  // donde el archivo no existe. Verificado en el build del 6-ago-2026: salía
  // `https://gbengochea.com.uy/bng-seleccion-global/opengraph-image-1wynds?…`.
  const imagen = `${SITIO_FONDO_URL}${OG_FONDO}`;
  const images = [{ url: imagen, width: 1200, height: 630, alt: m.title }];
  return {
    title: m.title,
    description: m.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: "BNG Selección Global",
      locale: LOCALE,
      title: m.title,
      description: m.description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: m.title,
      description: m.description,
      images,
    },
  };
}
