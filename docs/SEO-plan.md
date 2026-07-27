# Plan de SEO — Gastón Bengochea & Cía. (feat/institucional)

> Estado: **P0 + P1 IMPLEMENTADOS** (2026‑07‑20, validados en dev, **sin commitear**).
> **P2** (Core Web Vitals / `next/image` / INP) y **P3** (Plausible / IndexNow / GEO) **pendientes**.
> Basado en auditoría del código, mapeo de rutas, la API real de **Next.js 16.2.6**
> (runtime Node en el home server) e investigación de mejores prácticas SEO 2026.

## Estado de implementación (2026‑07‑20)

**Hecho (P0+P1), validado con `curl` sobre el dev server:**

- **Nuevos:** `lib/seo.ts` (SITE_URL + `pageMetadata`), `lib/jsonld.ts` (builders schema.org),
  `components/seo/JsonLd.tsx`, `app/robots.ts`, `app/sitemap.ts`, `app/manifest.ts`,
  `app/opengraph-image.tsx` (OG card de marca), `app/(institucional)/analyze/layout.tsx` (noindex),
  `app/(institucional)/analisis/layout.tsx` (indexable).
- **Borrado:** `public/robots.txt` (tenía `Disallow: /`).
- **Modificados:** `app/layout.tsx` (metadataBase + title.template + OG/robots/twitter + `viewport`);
  home (canonical + JSON-LD `FinancialService`/`WebSite`); todas las secciones (`pageMetadata`:
  título limpio + canonical + OG); `informes/[slug]` (OG article + fechas + autor + `NewsArticle` +
  `BreadcrumbList`); `equipo` (`Person`×21 + Organization).
- **Verificado en vivo:** robots `Allow: /`; sitemap XML con prioridades; manifest; home con title
  brand‑first, canonical, OG con imagen, theme‑color, y JSON‑LD completo; template de títulos;
  `article:author` correcto por categoría; `/analyze` noindex; `/analisis` indexable. `tsc --noEmit` = 0.

**Kill-switch de indexación:** por defecto el sitio es **NO indexable** — `app/robots.ts` devuelve
`Disallow: /` y el root layout emite `noindex` global (flag `SEO_INDEXABLE` en `lib/seo.ts`). Protege el
WIP de indexación prematura mientras se trabaja el contenido/imágenes. Validado en dev (todo `noindex`).

**Pendiente de deploy (al lanzar):** setear `SEO_INDEXABLE=1` **y** `NEXT_PUBLIC_SITE_URL=<dominio>` en el
`.env`, y **rebuild + restart** (el flag se lee en build). Después: verificar en Search Console (DNS TXT)
+ enviar sitemap, y Bing. **Nota:** en dev `og:image` sale con host `localhost` (el resto usa
metadataBase = dominio real); confirmar en prod que resuelve al dominio detrás del proxy.

**Pendiente (P2/P3):** migrar `<img>`→`next/image` + auditar INP; Plausible; IndexNow; robots explícito
de crawlers de IA (opcional, el `*` ya los permite). Ver §6 y §7.

---

## 0. Objetivo y principios

Que el sitio institucional (una **sociedad de bolsa regulada desde 1967**, contenido financiero en
español para Uruguay) tenga el mejor SEO posible: **indexable, rastreable, rápido, con identidad de
marca fuerte y señales de confianza (E‑E‑A‑T)**, y citable por buscadores generativos (AI Overviews,
ChatGPT, etc.).

Tres ejes rectores, en orden de palanca para **este** sitio:

1. **E‑E‑A‑T / YMYL** — el contenido financiero es "Your Money or Your Life": Google le exige señales
   fuertes de Experiencia, Pericia, Autoridad y Confianza. Es nuestra **mayor ventaja**: firma real,
   historia desde 1967, autores nombrados y registro regulatorio. Hoy no está expresado para máquinas
   (0 datos estructurados). Explotarlo es la mejor relación esfuerzo/impacto.
2. **Fundamentos técnicos** — hoy el sitio **está bloqueado entero** para los buscadores y le faltan
   metadata base, canonical, sitemap y OG. Sin esto, nada del resto importa.
3. **Rendimiento (Core Web Vitals)** — umbrales 2026: **LCP < 2,5 s · INP < 200 ms · CLS < 0,1**,
   medidos en campo (CrUX, percentil 75, ventana 28 días). El talón de Aquiles de una app React/Framer
   Motion como esta es **INP** (el CWV que más se falla en 2026 por JS pesado).

Sobre IA: Google indexa contenido generado con IA **si tiene calidad y curaduría**; castiga la
producción masiva de páginas finas. Esto define la estrategia de `/analyze` (ver §7).

---

## 1. Estado actual (resumen de la auditoría)

| Área | Estado | Detalle |
|---|---|---|
| **robots** | 🔴 **Crítico** | `public/robots.txt` = `User-agent: *` / `Disallow: /` → **bloquea el sitio entero**. No hay `app/robots.ts`. |
| **metadataBase** | 🔴 Falta | No definido en ningún lado → OG/canonical no resuelven a absoluto; rompe la única OG existente (apunta a `localhost`). |
| **Base URL / dominio** | 🟠 Sin configurar | Producción ≈ `gbengochea.com.uy` (legacy), pero no hay `SITE_URL` ni `metadataBase`. **A confirmar.** |
| **Canonical / hreflang** | 🔴 Falta | Ninguna página declara `alternates.canonical`. Sitio monolingüe `es-UY` (bien seteado en `<html lang>`). |
| **Sitemap** | 🔴 Falta | No hay `app/sitemap.ts` ni `sitemap.xml`. |
| **Open Graph / Twitter** | 🟠 Parcial | Solo `/informes/[slug]` tiene OG + imagen dinámica (`next/og`). Sin OG global, sin Twitter cards, sin imagen OG por defecto. |
| **Datos estructurados (JSON‑LD)** | 🔴 Falta | **Cero.** Ni Organization, ni Article, ni Breadcrumb, ni Person. Gran gap para un broker regulado. |
| **Metadata por página** | 🟠 Parcial | Title+description en ~10 páginas. **Home, `/analyze`, `/analisis` sin metadata.** Sin `title.template` (títulos inconsistentes). |
| **Viewport / theme‑color** | 🔴 Falta | Sin `export const viewport`, sin `theme-color`. |
| **`next/image`** | 🔴 No se usa | 17 `<img>` crudos en 14 archivos (algunos +1 MB, p.ej. `public/informes-carpeta.png`). Sin optimización/`srcset`/lazy. |
| **`next/font`** | 🟢 Bien | `Newsreader`/`IBM Plex` self‑hosted, `display:swap`, sin CLS. |
| **Manifest (PWA)** | 🔴 Falta | Sin `app/manifest.ts`. |
| **Favicons** | 🟢 Bien | `favicon.ico` + PNGs 16/32/96 + apple‑icon 180 cableados. |
| **`/admin`** | 🟢 Bien | Doble noindex (metadata.robots + `X-Robots-Tag` en `next.config.ts`). |
| **Analytics / Search Console** | 🔴 Falta | Solo Sentry (errores). Sin GA/Plausible, sin verificación de Search Console. |

**Superficie indexable una vez abierto robots:** ~14 páginas estáticas/marketing + 4 dossiers
`/oportunidades/[sector]` (`tecnologia`, `energia`, `agro`, `logistica`) + N artículos de `/informes`
desde D1 (`informes WHERE status='live'`, hoy ~7, de los cuales 2 con artículo HTML completo). Todo
`/admin/*` y `/api/*` (incluidos los `debug-*`/`test-*`) debe quedar excluido.

---

## 2. Restricciones técnicas (leer antes de implementar)

**Plataforma:** Next.js **16.2.6**, React 19.2.4, App Router, **runtime Node** en el home server
(`next build` + `next start` detrás de reverse proxy con TLS; ver `docs/RUNBOOK-home.md`). Los scripts
`pages:*` y `wrangler.toml` son artefactos muertos de la etapa Cloudflare. **No hay límites de edge:**
`sitemap.ts`, `robots.ts`, `next/og`, ISR e IndexNow funcionan sin restricción.

**Trampas reales de Next 16** (esto es lo que avisa `AGENTS.md`; la superficie de metadata coincide
con Next 16 upstream, no hay mods vendor):

- `params` y `searchParams` son **Promises** → `const { slug } = await params`. Aplica a
  `generateMetadata`, páginas, y a las funciones de `opengraph-image`/`icon` y `generateSitemaps` (el
  `id` es `Promise<string>`).
- `metadata` y `generateMetadata` **solo en Server Components**. `/analyze` y `/analisis` son
  `"use client"` → no pueden exportar metadata; hay que empujarla a un `layout.tsx` (server) del segmento.
- **`viewport` es export separado** (no va en `metadata`). `themeColor`/`colorScheme` van ahí.
- `ImageResponse` se importa de **`next/og`** (ya lo hace la OG de informes).
- `next/image`: **`priority` está deprecado → usar `preload`**; `images.domains` → **`remotePatterns`**.
- **Merge de metadata es shallow**: objetos anidados (`openGraph`, `robots`, `twitter`) los
  **reemplaza por completo** el último segmento que los define (no hay deep‑merge). → conviene un
  **helper que arme la metadata completa por página** (§4) para no perder `siteName`/imagen/locale.
- **Streaming de metadata (v15.2+)**: en páginas que renderizan dinámico (`force-dynamic`, como
  `/informes` y `/informes/[slug]`) la metadata puede **appendearse al `<body>`** en vez de bloquear
  en `<head>`. Los bots "HTML‑limited" (Bingbot, Twitterbot, Slackbot, facebookexternalhit) igual la
  reciben en `<head>`; Googlebot renderiza JS. Los unfurls sociales funcionan. (Optimización opcional:
  pasar `/informes/[slug]` a ISR — §6.20.)
- `title.template` **solo afecta a segmentos hijos**, no al segmento donde se define; y `page.js` con
  template "no tiene efecto". → el template va en el **root layout**.

**Restricción legal (transversal, ver memoria `marco_legal_recomendaciones`):** research general/no
personalizado es lícito; una recomendación pública personalizada ("compre X" con CTA) puede leerse como
**oferta pública de valores no inscriptos**. Implicancias SEO:
- `/analyze` (herramienta interactiva, análisis por‑ticker con IA) → **noindex** (además de fino/IA).
- `/informes` y `/bng-seleccion-global` → indexar **con** los disclaimers de no‑oferta/no‑personalizado
  presentes en la página (confirmar antes de abrir a indexación masiva). No poner rendimientos/objetivos
  como *claims* en datos estructurados del fondo.

**Restricción de marca (memoria `claims_verificables`):** todo dato institucional en JSON‑LD (fundación,
domicilio, registros, redes) debe salir de `gbengochea.com.uy` o del cliente. Nada inventado.

---

## 3. Arquitectura propuesta

Para no repetir metadata y evitar el footgun del merge shallow, centralizar en **`lib/seo.ts`**:

```ts
// lib/seo.ts
import type { Metadata } from "next";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://gbengochea.com.uy"; // placeholder; dominio real TBD (D1)
export const SITE_NAME = "Gastón Bengochea & Cía.";
export const DEFAULT_OG = "/og-default.png"; // imagen OG por defecto (crear, 1200×630)

type PageMeta = {
  title: string;
  description: string;
  path: string;            // p.ej. "/historia" → canonical + og:url
  image?: string;          // OG específica; default DEFAULT_OG
  type?: "website" | "article";
  noindex?: boolean;
  publishedTime?: string;  // ISO 8601, solo article
  modifiedTime?: string;
  authors?: string[];
};

export function pageMetadata(m: PageMeta): Metadata {
  const url = m.path;
  const images = [{ url: m.image ?? DEFAULT_OG, width: 1200, height: 630, alt: m.title }];
  return {
    title: m.title,
    description: m.description,
    alternates: { canonical: url },
    robots: m.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: m.type ?? "website",
      url, siteName: SITE_NAME, locale: "es_UY",
      title: m.title, description: m.description, images,
      ...(m.type === "article" && {
        publishedTime: m.publishedTime, modifiedTime: m.modifiedTime, authors: m.authors,
      }),
    },
    twitter: { card: "summary_large_image", title: m.title, description: m.description, images },
  };
}
```

Con `metadataBase` seteado en el root layout, todos los `url`/`image` relativos resuelven a absolutos.

**JSON‑LD** como pequeño Server Component reutilizable:

```tsx
// components/seo/JsonLd.tsx  (server component)
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

---

## 4. FASE P0 — Fundamentos técnicos (bloqueantes de lanzamiento)

> Esfuerzo bajo, impacto máximo. Sin esto el sitio no existe para Google.

### 4.1 Abrir el rastreo — `app/robots.ts` (y **borrar** `public/robots.txt`)

`public/robots.txt` y `app/robots.ts` ambos sirven `/robots.txt` → conflicto. **Eliminar el estático.**

```ts
// app/robots.ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/informes/*/pdf"] },
      // Crawlers de IA (GEO): PERMITIDOS (decisión tomada). El `*` de arriba ya los cubre;
      // opcionalmente listarlos explícito (GPTBot, ClaudeBot, PerplexityBot, Google-Extended)
      // con allow "/" para dejar la intención documentada. NO agregar Disallow para ellos.
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
```

**Criterio de aceptación:** `curl https://<host>/robots.txt` devuelve `Allow: /` + URL del sitemap;
`/admin` y `/api` en `Disallow`.

### 4.2 Base URL + `metadataBase` + root layout completo

- Agregar `NEXT_PUBLIC_SITE_URL=https://gbengochea.com.uy` a `.env` (y al `.env` del RUNBOOK‑home).
- En `app/layout.tsx`, ampliar el `metadata` export:

```ts
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Gastón Bengochea & Cía. — Sociedad de Bolsa desde 1967",
    template: "%s · Gastón Bengochea & Cía.",
  },
  description: "...", // la actual
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website", siteName: SITE_NAME, locale: "es_UY", url: SITE_URL,
    title: "Gastón Bengochea & Cía. — Sociedad de Bolsa",
    description: "...", images: [{ url: DEFAULT_OG, width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  icons: { /* la config actual */ },
  verification: { google: "TOKEN_SEARCH_CONSOLE" }, // o verificar por DNS (preferido)
};
```

### 4.3 `export const viewport` (nuevo, en root layout)

```ts
import type { Viewport } from "next";
export const viewport: Viewport = {
  themeColor: "#0a1f44", // navy de marca (ajustar al token real)
  colorScheme: "light",
  width: "device-width", initialScale: 1,
};
```

### 4.4 Imagen OG por defecto

Crear `public/og-default.png` (1200×630) con la identidad institucional (navy + logo). Alternativa:
`app/opengraph-image.tsx` con `next/og` reutilizando el estilo de la card de informes. Hoy solo
`/informes/[slug]` unfurlea con imagen; el resto del sitio comparte sin imagen.

### 4.5 Metadata de la Home (peor ofensor: hoy no tiene)

`app/(institucional)/page.tsx` es Server Component → agregar `export const metadata = pageMetadata({...})`
con título propio, descripción rica y `canonical: "/"`.

### 4.6 `app/sitemap.ts`

```ts
// app/sitemap.ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
// import { readInformesLive } from "@/lib/informesStore"; + el mismo acceso a D1 que /informes

const SECTORES = ["tecnologia", "energia", "agro", "logistica"];
const ESTATICAS = ["", "/historia", "/nosotros", "/equipo", "/servicios",
  "/bng-seleccion-global", "/educacion", "/calculadora", "/contacto", "/analisis", "/informes"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = ESTATICAS.map((p) => ({
    url: `${SITE_URL}${p}`, changeFrequency: "monthly" as const,
    priority: p === "" ? 1 : 0.7,
  }));
  const sectores = SECTORES.map((s) => ({ url: `${SITE_URL}/oportunidades/${s}`, priority: 0.6 }));
  // const db = getDb(); const informes = await readInformesLive(db);
  // const arts = informes.map((i) => ({ url: `${SITE_URL}/informes/${i.slug}`,
  //   lastModified: i.fecha, changeFrequency: "yearly", priority: 0.8 }));
  return [...base, ...sectores /*, ...arts */];
}
```

Notas: leer D1 con el mismo binding local que `app/(institucional)/informes/page.tsx`. Excluir
`/prensa` (vacío), `/analyze` (noindex), `/informes/*/pdf`, `/admin`, `/api`. Volumen bajo → **no** hace
falta `generateSitemaps` (el límite de 50k URLs no se acerca).

### 4.7 Alta y verificación

- **Google Search Console**: verificar por **DNS TXT** (método más robusto; no se rompe en deploys).
  Enviar `sitemap.xml`. Es donde vamos a ver los CWV de campo.
- **Bing Webmaster Tools**: importar desde Search Console (2 min) + enviar sitemap.

**Definición de "P0 hecho":** el sitio es rastreable, cada página tiene title único + description +
canonical + OG con imagen, hay sitemap y robots correctos, y está verificado en Search Console.

---

## 5. FASE P1 — Datos estructurados y E‑E‑A‑T (la mayor palanca)

> Confirmado contra la galería de Google: **siguen** Organization, Article, Breadcrumb, Video,
> Profile page, Q&A; **salieron** FAQ y HowTo (sin rich result desde may‑2026).

### 5.1 `Organization` / `FinancialService` (site‑wide, en la Home)

Es "el schema que más mueve la aguja para servicios financieros" (identidad de marca que la IA usa para
juzgar si la fuente es confiable). Colocarlo en la Home o en `/nosotros`. Solo datos verificables:

```jsonc
{
  "@context": "https://schema.org", "@type": "FinancialService",
  "name": "Gastón Bengochea & Cía. Sociedad de Bolsa",
  "legalName": "…", "url": "https://gbengochea.com.uy",
  "logo": "https://gbengochea.com.uy/logo.png",   // ≥112×112, fondo blanco, rastreable
  "foundingDate": "1967",
  "address": { "@type": "PostalAddress", "addressCountry": "UY", "addressLocality": "Montevideo", "streetAddress": "…" },
  "contactPoint": { "@type": "ContactPoint", "email": "info@gbengochea.com.uy", "telephone": "+598…", "contactType": "customer service" },
  "sameAs": ["https://www.instagram.com/bengochea_inversiones", "…LinkedIn…"],
  "description": "Sociedad de bolsa uruguaya desde 1967…",
  "areaServed": "UY"
}
```

Registro regulatorio (BCU/RNMV) como señal de confianza en el copy visible + `identifier` si aplica.

### 5.2 `WebSite` (site‑wide)

`{ "@type": "WebSite", "name": …, "url": …, "inLanguage": "es-UY", "publisher": {"@id": …Organization} }`.
El `SearchAction` (Sitelinks Searchbox) ya no da rich result → opcional/omitir.

### 5.3 `Article` / `NewsArticle` en `/informes/[slug]` — **prioridad E‑E‑A‑T**

Ya hay `generateMetadata` + OG dinámica; **falta el JSON‑LD**. Article con `author`, `dateModified` y
`publisher` completos mejora la probabilidad de ser citado en AI Overviews. Autores desde `AUTORES`
(`lib/informes.ts`: Paula Bujia, Adrián Moreira):

```jsonc
{
  "@context": "https://schema.org", "@type": "NewsArticle",
  "headline": "…titulo…",
  "datePublished": "2026-05-29", "dateModified": "2026-05-29",
  "author": [{ "@type": "Person", "name": "Paula Bujia", "url": "https://gbengochea.com.uy/equipo#paula-bujia" }],
  "publisher": { "@type": "Organization", "name": "Gastón Bengochea & Cía.",
    "logo": { "@type": "ImageObject", "url": "https://gbengochea.com.uy/logo.png" } },
  "image": ["…la OG del informe…"],
  "inLanguage": "es-UY"
}
```

Requisitos de Google (verificados en la doc): sin props obligatorias, pero recomienda `author` (name+url),
`datePublished`, `dateModified`, `headline`, `image` (idealmente 1:1, 4:3, 16:9). Enriquecer el
`generateMetadata` con `openGraph.type:"article"` + `publishedTime`/`modifiedTime`/`authors` vía el helper.

### 5.4 `BreadcrumbList`

En páginas de sección y en artículos (`Inicio › Informes › <título>`). Da migas en el SERP y ayuda a la
comprensión de jerarquía. Componente que arma el `itemListElement` desde el path.

### 5.5 `Person` / `ProfilePage` en `/equipo`

Cada integrante como `Person` (name, jobTitle, credenciales, sameAs a LinkedIn). En 2026 la
**Experiencia** pesa fuerte en finanzas: bios con títulos/certificaciones (CFA/CPA/etc.) y link a
LinkedIn. Enlazar los autores de los `Article` a su ancla en `/equipo` (o a `ProfilePage` propias). Esta
es la conexión E‑E‑A‑T más valiosa del sitio.

### 5.6 Metadata OG + canonical en TODAS las secciones (helper §3)

Aplicar `pageMetadata()` a: `/historia`, `/nosotros`, `/equipo`, `/servicios`, `/bng-seleccion-global`,
`/educacion`, `/calculadora`, `/contacto`. Hoy tienen solo title+description. Agrega canonical + OG
completa + Twitter, consistente.

### 5.7 `/analyze` y `/analisis` (client components)

- **`app/(institucional)/analyze/layout.tsx`** (nuevo, server): `export const metadata` con
  **`robots: { index:false, follow:false }`**. Motivo: análisis por‑ticker con IA = contenido fino +
  riesgo legal (oferta pública). La herramienta sigue usable, solo no se indexa.
- **`app/(institucional)/analisis/layout.tsx`** (nuevo, server): metadata **indexable** (landing de
  marketing que explica la herramienta en términos generales; es la puerta de entrada SEO al tool).

### 5.8 `app/manifest.ts`

`name`, `short_name`, `theme_color` navy, `background_color`, `display:"standalone"`, íconos. Cierra el
PWA/instalabilidad y el theme‑color móvil.

### 5.9 FAQ (`/educacion`, `FondoFAQ`)

Google discontinuó los rich results de FAQ (7‑may‑2026) → **no** esperar snippet. Mantener el contenido
(bueno para usuarios y para extracción por IA). Opcional: emitir `FAQPage` JSON‑LD igual (inocuo, algunos
motores de IA/otros buscadores lo usan). Prioridad baja.

---

## 6. FASE P2 — Rendimiento / Core Web Vitals

> Objetivo: pasar los tres CWV en campo. Foco en **INP** (React/Framer Motion/Lenis) y **LCP** (imágenes).

### 6.1 Migrar `<img>` → `next/image` (17 tags, 14 archivos)

Empezar por los **LCP** (héroes de home/fondo/informes) y los assets pesados (`informes-carpeta.png`
~1,2 MB). Config en `next.config.ts`:

```ts
images: {
  formats: ["image/avif", "image/webp"],
  remotePatterns: [{ protocol: "https", hostname: "gbengochea.com.uy" }], // imágenes de informes legacy
},
```

- `alt` es **obligatorio** en Next 16 (decorativas → `alt=""`).
- Reservar `width`/`height` (o `fill` + contenedor) → mata CLS.
- LCP: usar **`preload`** (no `priority`, deprecado) en la imagen principal above‑the‑fold.
- `sizes` correcto para no bajar imágenes gigantes en mobile.

### 6.2 INP — auditar JS del cliente

- **Framer Motion + Lenis (smooth scroll)** son fuentes típicas de INP alto. Medir con la interacción
  real (memoria `verificar_sin_enmascarar`), no con overrides. Revisar handlers de scroll, animaciones
  `whileInView`, y widgets client‑side de la home que hidratan datos vivos.
- **`dynamic import`** para lo below‑the‑fold y widgets pesados (charts `lightweight-charts`, Sankey
  `d3-sankey`, el propio `/analyze`). No cargar JS de la herramienta en páginas que no lo usan.
- Evitar re‑renders y trabajo largo en el hilo principal en el primer input.

### 6.3 (Opcional) `/informes/[slug]` de `force-dynamic` → **ISR**

Hoy es `force-dynamic` (SSR por request contra D1). Pasarlo a `revalidate` + `revalidatePath("/informes/…")`
disparado desde la acción de publicar del panel:
- HTML cacheado → mejor TTFB/LCP y **metadata en `<head>`** (sin streaming al body).
- Menos carga en el server (relevante por el historial de cuelgues, memoria `prod_hang_diagnosis`).

### 6.4 Headers de cache en el reverse proxy

Next ya hashea assets estáticos (`immutable`). Confirmar que Caddy/nginx no pisa `Cache-Control` de
`/_next/static/*`. HTML de páginas ISR con `s-maxage` acorde.

---

## 7. FASE P3 — Distribución, GEO y medición

### 7.1 Analytics + medición de CWV

**Decidido: Plausible** (privacy‑first, liviano, sin cookies, coherente con `interest-cohort=()` del CSP;
self‑hostable en el mismo home server). Cargar con `next/script` (`strategy="afterInteractive"`) y sumar
al CSP el `connect-src`/`script-src` del endpoint de Plausible. Sumar `web-vitals` para reportar
INP/LCP/CLS reales. Search Console sigue siendo la fuente de verdad de CWV de campo.

### 7.2 IndexNow (indexación instantánea)

El server es Node self‑hosted → podemos **POST a IndexNow** al publicar/editar un informe (hook en la
acción de publicar del panel). Bing, Yandex, DuckDuckGo lo consumen (Google no). Ideal para frescura de
`/informes`.

### 7.3 Política de crawlers de IA (GEO) — **DECIDIDO: permitir todos**

`GPTBot` (OpenAI), `ClaudeBot` (Anthropic), `PerplexityBot`, `Google-Extended`: **permitidos** (el `*`
del `robots.ts` ya los cubre; sin Disallow para ellos). El research es público y la marca gana siendo
citada en respuestas de IA. `llms.txt` **no** lo usa Google (lo dijeron explícito); las bases (contenido
útil, rastreable, estructurado, confiable) son lo que importa, así que GEO es capa aditiva sobre buen SEO
— no requiere trabajo extra más allá de no bloquear.

### 7.4 Prácticas GEO de contenido

Para ser citado por AI Overviews/ChatGPT: citar fuentes autoritativas, **expertos nombrados** (ya los
tenemos), estadísticas concretas, prosa segura, frescura (`dateModified`), y owning de queries
"mejores/comparativa" del rubro. Es lo mismo que buen E‑E‑A‑T + estructura clara.

### 7.5 (Opcional avanzado) Google News / Publisher Center

`/informes` es un publisher de research financiero → evaluar alta en Publisher Center + `NewsArticle`
para elegibilidad en Google News/Discover. Mayor esfuerzo editorial y de cumplimiento; dejar para cuando
haya cadencia estable de publicación.

---

## 8. Datos estructurados — catálogo por página (referencia)

| Página | JSON‑LD | Metadata especial |
|---|---|---|
| `/` (home) | `FinancialService` + `WebSite` | title propio, OG default, canonical `/` |
| `/nosotros`, `/historia` | (Organization ya en home) + `BreadcrumbList` | OG + canonical |
| `/equipo` | `Person`×N (o `ProfilePage`) + `BreadcrumbList` | OG + canonical |
| `/bng-seleccion-global` | `Organization`/`Service` (⚠ sin claims de rendimiento) + `BreadcrumbList` | OG propia, canonical |
| `/servicios` | `BreadcrumbList` | OG + canonical |
| `/educacion` | `BreadcrumbList` (+ `FAQPage` opcional) | OG + canonical |
| `/informes` | `BreadcrumbList` (+ `ItemList` opcional del hub) | OG + canonical |
| `/informes/[slug]` | **`NewsArticle`** + `BreadcrumbList` | OG `article` + dates + authors (ya tiene OG image) |
| `/oportunidades/[sector]` | `BreadcrumbList` (+ `Article` si aplica) | OG + canonical (ya tiene generateMetadata) |
| `/calculadora` | `WebApplication` opcional | OG + canonical |
| `/contacto` | `ContactPoint` (parte de Organization) | OG + canonical |
| `/analyze` | — | **noindex** (layout) |
| `/analisis` | `WebApplication` opcional | metadata indexable (layout) |
| `/prensa` | — | excluir hasta poblar |
| `/admin/*`, `/api/*` | — | noindex (ya) / excluido |

---

## 9. Decisiones (tomadas 2026‑07‑20)

- **D1 — Dominio de producción: TBD.** Todavía sin definir. Se usa `https://gbengochea.com.uy` como
  **placeholder en el env `NEXT_PUBLIC_SITE_URL`** (un solo lugar para cambiarlo). Todo P0/P1 se puede
  implementar ya con el placeholder; lo único que espera al dominio real es la **verificación en Search
  Console** y los eventuales **redirects 301** del sitio PHP legacy (si el nuevo lo reemplaza).
- **D2 — `/analyze`: NOINDEX.** ✅ Confirmado. Herramienta usable, no indexada; `/analisis` (landing) sí
  se indexa.
- **D3 — Analytics: Plausible.** ✅ Privacy‑first, sin cookies, self‑hostable. Ajustar CSP para su endpoint.
- **D4 — Crawlers de IA: permitir todos.** ✅ GPTBot/ClaudeBot/Google‑Extended/Perplexity habilitados (GEO).
- **Gate legal (pendiente):** antes de abrir a indexación masiva `/informes` y `/bng-seleccion-global`,
  confirmar que los disclaimers de no‑oferta/no‑personalizado están en la página.

---

## 10. Orden de ejecución sugerido

1. **P0 completo** (robots + metadataBase + root layout + viewport + OG default + home + sitemap +
   Search Console). Medio día. Desbloquea todo.
2. **P1** helper `lib/seo.ts` + JSON‑LD Organization/WebSite/Article/Breadcrumb/Person + metadata OG en
   todas las secciones + noindex `/analyze`. Es la mayor palanca de ranking (E‑E‑A‑T).
3. **P2** `next/image` en LCP + auditoría INP. Continuo.
4. **P3** analytics + IndexNow + política IA + GEO. Continuo.

> Nota: todo P0/P1 es de bajo riesgo y alto impacto; P2 (imágenes/INP) es el trabajo más largo pero es
> donde están los CWV. Ninguna tarea requiere tocar `main` (prod actual) — es todo `feat/institucional`.
