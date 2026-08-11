// Builders de datos estructurados (schema.org / JSON-LD). Sólo datos verificables
// (dominio del cliente + copy institucional). Google 2026: FAQ/HowTo ya no dan
// rich result; sí Organization, Article, Breadcrumb, Person. Ver docs/SEO-plan.md.

import { SITE_URL, SITE_NAME, abs } from "@/lib/seo";
import { SITIO_FONDO_URL } from "@/lib/sitios";

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

// ─────────────────────────────────────────────────────────────────────────────
// SITIO DEL FONDO (bengocheainversiones.com) — ver lib/sitios.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// Builders aparte de los de arriba y no reutilizados, por una razón concreta:
// los de arriba resuelven todas sus URLs con `abs()`, que compone contra
// `SITE_URL` (el dominio institucional). En el sitio del fondo eso publicaría
// `@id` y `url` del dominio equivocado — el mismo footgun que ya obligó a que
// `fondoMetadata()` arme el canonical absoluto en `lib/seo.ts`.
//
// ⚠️ REGLA QUE MANDA ACÁ: Google exige que los datos estructurados COINCIDAN con
// el contenido visible de la página. Cada campo de abajo está anotado con dónde
// se lee en la página; si algún día se saca ese texto, hay que sacar el campo.
// No se agrega nada que la página no diga — en particular, NINGÚN dato de
// rendimiento (`interestRate`, `annualPercentageRate`, `aggregateRating`): un
// rendimiento como claim estructurado es exactamente la línea que trazó la
// revisión legal en el copy visible.

const ORG_FONDO_ID = `${SITIO_FONDO_URL}/#organization`;
const FONDO_ID = `${SITIO_FONDO_URL}/#fondo`;

/**
 * La gestora, declarada en el dominio del fondo.
 *
 * `url` apunta al sitio INSTITUCIONAL a propósito: es la casa la que tiene ahí
 * su home, y declararlo es lo que le permite a Google unificar las dos entidades
 * (la de este dominio y la de `gbengochea.com.uy`) en vez de tratarlas como dos
 * empresas distintas con el mismo nombre.
 *
 * `leiCode` es el desempate de identidad más fuerte disponible y por eso está:
 * la marca compite en el grafo de entidades con un homónimo mucho más famoso del
 * fútbol uruguayo (ver docs/SEO-fondo.md §4 I2). Es el ÚNICO campo de este
 * objeto que no se lee en la página — sale del registro oficial GLEIF
 * (api.gleif.org, estado ACTIVE/ISSUED), no de un scraper. Google lo soporta
 * explícitamente como propiedad de Organization.
 */
export function organizationFondoLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FinancialService",
    "@id": ORG_FONDO_ID,
    // Nombre legal exacto, tal como lo escribe el pie del sitio del fondo.
    name: "Gastón Bengochea y Compañía Corredor de Bolsa S.A.",
    legalName: "Gastón Bengochea y Compañía Corredor de Bolsa S.A.",
    alternateName: SITE_NAME,
    url: SITE_URL,
    leiCode: "254900BI9042HIUZ0P25",
    // "sociedad de bolsa uruguaya desde 1967" — sección La casa.
    foundingDate: "1967",
    // "Miembros de la Bolsa de Valores de Montevideo" — sección La casa.
    memberOf: { "@type": "Organization", name: "Bolsa de Valores de Montevideo" },
    areaServed: "UY",
    // Los tres canales del pie, tal cual.
    telephone: "+598 2628 6447",
    email: "info@gbengochea.com.uy",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Luis A. de Herrera 1248, WTC Torre I, Of. 707",
      addressLocality: "Montevideo",
      addressCountry: "UY",
    },
    // Las cinco redes que el pie muestra como links (components/institucional/redes.tsx).
    sameAs: [
      "https://www.linkedin.com/company/gaston-bengochea-cia-corredor-de-bolsa-s-a/",
      "https://www.instagram.com/bengochea_inversiones/",
      "https://x.com/BENGOCHEA_SB",
      "https://www.facebook.com/p/Gaston-Bengochea-100068421873890/",
      "https://youtube.com/@gastonbengocheaciacbs.acor7376",
    ],
  };
}

/**
 * El sitio del fondo como entidad.
 *
 * Su trabajo concreto: es lo que gobierna el NOMBRE DEL SITIO en el resultado de
 * Google. La doc oficial (Site names in Google Search) dice que este marcado
 * gana sobre `og:site_name`, el `<title>` y los encabezados, que tiene que estar
 * en la home del dominio y que funciona a nivel dominio/subdominio. Acá la home
 * del dominio ES esta página, así que el requisito se cumple solo.
 *
 * El `name` es el del PRODUCTO, no el de la casa: en este dominio el sitio es el
 * fondo — es la misma decisión que ya tomó `fondoMetadata()` con `og:site_name`.
 */
export function websiteFondoLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITIO_FONDO_URL}/#website`,
    url: `${SITIO_FONDO_URL}/`,
    name: "BNG Selección Global",
    inLanguage: "es-UY",
    publisher: { "@id": ORG_FONDO_ID },
  };
}

/**
 * El fondo como producto financiero.
 *
 * `InvestmentFund` (schema.org: Thing → Intangible → Service → FinancialProduct →
 * InvestmentOrDeposit → InvestmentFund) NO da rich result — Google no lo lista en
 * su galería. Está igual porque es lo que describe la entidad para el grafo de
 * conocimiento y para los motores que citan respuestas: sin esto, "BNG Selección
 * Global" es una cadena de texto; con esto es un fondo de inversión, con gestora
 * y jurisdicción.
 *
 * `description` se pasa desde `fondoMetadata()` para que sea LA MISMA cadena que
 * la meta description — que no diverjan es justamente lo que Google pide.
 */
export function investmentFundLd(description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "InvestmentFund",
    "@id": FONDO_ID,
    name: "BNG Selección Global",
    // Denominación legal, tal como la escriben el pie y el bloque #legal.
    alternateName: "Fondo BNG Selección Global, Fondo de Inversión",
    url: `${SITIO_FONDO_URL}/`,
    description,
    inLanguage: "es-UY",
    // "domiciliada en Uruguay" / "gestionado profesionalmente desde Uruguay".
    areaServed: "UY",
    // El pie: "es gestionado por Gastón Bengochea y Compañía Corredor de Bolsa S.A.".
    provider: { "@id": ORG_FONDO_ID },
    // Cita literal de la respuesta "¿Qué costos tiene?" de la FAQ. Se transcribe
    // en vez de resumirse para no introducir un número que la página no diga
    // —la comisión se cobra AL FONDO, así que la cuota ya nace neta, y perder esa
    // glosa convertiría el 1,5% en un costo del inversor, que no es lo que dice.
    feesAndCommissionsSpecification:
      "La comisión del Fondo es de hasta 1,5% anual, IVA incluido, sobre su patrimonio neto descontado de provisiones: se devenga a diario y se cobra al Fondo, por lo que el valor cuota ya se publica neta de ella.",
  };
}
