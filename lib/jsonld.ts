// Builders de datos estructurados (schema.org / JSON-LD). Sólo datos verificables
// (dominio del cliente + copy institucional). Google 2026: FAQ/HowTo ya no dan
// rich result; sí Organization, Article, Breadcrumb, Person. Ver docs/SEO-plan.md.

import { SITE_URL, SITE_NAME, abs } from "@/lib/seo";

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

const ORG_DESCRIPTION =
  "Sociedad de bolsa uruguaya fundada en 1967. Asesoramiento de inversiones y acceso a los mercados local e internacional, con cuentas segregadas y regulación del Banco Central del Uruguay.";

/**
 * Identidad de la casa — nodo canónico (@id reutilizable). FinancialService
 * (subtipo de LocalBusiness) porque hay oficina física: habilita address/geo/
 * horarios para SEO local. Todos los datos salen del sitio del cliente.
 */
export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FinancialService",
    "@id": ORG_ID,
    name: "Gastón Bengochea & Cía. Sociedad de Bolsa",
    alternateName: "Bengochea Inversiones",
    url: SITE_URL,
    logo: abs("/logo-bengochea.png"),
    image: abs("/logo-bengochea.png"),
    description: ORG_DESCRIPTION,
    foundingDate: "1967",
    areaServed: "UY",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Luis A. de Herrera 1248, WTC Torre I, Of. 707",
      addressLocality: "Montevideo",
      addressCountry: "UY",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: -34.9043598,
      longitude: -56.1360758,
    },
    telephone: "+598 2628 6447",
    email: "info@gbengochea.com.uy",
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "10:00",
        closes: "18:00",
      },
    ],
    memberOf: { "@type": "Organization", name: "Bolsa de Valores de Montevideo" },
    sameAs: ["https://www.instagram.com/bengochea_inversiones"],
  };
}

/** El sitio como entidad — enlaza a la Organización como publisher. */
export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE_URL,
    name: SITE_NAME,
    inLanguage: "es-UY",
    publisher: { "@id": ORG_ID },
  };
}

/** Miga de pan. `items` en orden raíz→hoja, paths relativos. */
export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}

/**
 * Artículo de research (NewsArticle). `publisher` va concreto (no @id) para que
 * la página sea autosuficiente. `image` apunta a la OG card dinámica del informe.
 */
export function articleLd(a: {
  slug: string;
  headline: string;
  description?: string;
  datePublished: string; // ISO 8601
  dateModified?: string;
  authors: { name: string; url?: string }[];
  section?: "Mensual" | "Semanal";
}) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: a.headline,
    ...(a.description ? { description: a.description } : {}),
    datePublished: a.datePublished,
    dateModified: a.dateModified ?? a.datePublished,
    author: a.authors.map((au) => ({
      "@type": "Person",
      name: au.name,
      ...(au.url ? { url: au.url } : {}),
    })),
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: abs("/logo-bengochea.png") },
    },
    image: [abs(`/informes/${a.slug}/opengraph-image`)],
    mainEntityOfPage: abs(`/informes/${a.slug}`),
    articleSection: a.section,
    inLanguage: "es-UY",
    isAccessibleForFree: true,
  };
}

/**
 * Grafo de personas del equipo (E-E-A-T). Incluye un nodo Organization mínimo
 * para que `worksFor` (@id) resuelva dentro de la misma página. Un solo bloque
 * JSON-LD para todo el staff. Ver docs/SEO-plan.md.
 */
export function personListLd(
  people: { name: string; jobTitle?: string; image?: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: "Gastón Bengochea & Cía. Sociedad de Bolsa",
        url: SITE_URL,
      },
      ...people.map((p) => ({
        "@type": "Person",
        name: p.name,
        ...(p.jobTitle ? { jobTitle: p.jobTitle } : {}),
        ...(p.image ? { image: abs(p.image) } : {}),
        worksFor: { "@id": ORG_ID },
      })),
    ],
  };
}

/** Persona individual — base E-E-A-T. `worksFor` referencia a la casa. */
export function personLd(p: {
  name: string;
  jobTitle?: string;
  url?: string;
  image?: string;
  sameAs?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.name,
    ...(p.jobTitle ? { jobTitle: p.jobTitle } : {}),
    ...(p.url ? { url: p.url } : {}),
    ...(p.image ? { image: abs(p.image) } : {}),
    ...(p.sameAs && p.sameAs.length ? { sameAs: p.sameAs } : {}),
    worksFor: { "@id": ORG_ID },
  };
}
