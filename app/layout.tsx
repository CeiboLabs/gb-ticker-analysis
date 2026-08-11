import type { Metadata, Viewport } from "next";
import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { SITE_URL, SITE_NAME, SEO_INDEXABLE } from "@/lib/seo";
import "./globals.css";

// ── QUÉ SE PRECARGA, Y POR QUÉ CASI NADA ────────────────────────────────────
// `next/font` precarga en TODAS las rutas lo que se declara en el layout raíz
// (node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md,
// "Preloading"). Acá viven las tres familias de la casa, así que hasta agosto de
// 2026 cada página se bajaba 190 KB de woff2 con prioridad `High` —la misma
// banda que compite con el CSS que bloquea el render—, usara las que usara.
//
// Medido en /bng-seleccion-global: de esos seis archivos el renderer usaba UNO
// (`document.fonts` reportaba sólo "Newsreader 300 normal"). Los otros 135 KB se
// bajaban y se tiraban, porque `.site` resetea la tipografía a Arial del sistema
// y la única excepción es `.t-serif-display`, que pide Newsreader NORMAL.
// Ver docs/rendimiento-fondo.md §2.
//
// La regla que queda: se precarga sólo lo que puede aparecer en el primer
// pintado de CUALQUIER ruta. Todo lo demás se declara igual —el @font-face sigue
// ahí y la fuente carga cuando algo la usa— pero sin `<link rel=preload>`.

// Newsreader NORMAL: es la única que se precarga. Es la serif de display de toda
// la casa y, en el sitio del fondo, la del elemento LCP (el h1 del hero).
const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal"],
  display: "swap",
});

// Newsreader ITÁLICA, en una llamada aparte cuyo único objeto es apagarle el
// preload: es el archivo más pesado de los seis (64,5 KB) y no aparece en ningún
// primer pintado — vive en cursivas de cuerpo (`.dek`, `.inf-cita`, los `em` de
// los titulares de panel), que llegan bien abajo en la página. Se sigue
// descargando cuando algo la usa, que es lo correcto.
//
// Sobre `--font-serif-i`: hoy no hace falta para que la cursiva RESUELVA. Se
// verificó en el build: las dos llamadas emiten sus @font-face bajo la MISMA
// familia ("Newsreader"), así que el navegador elige la cara itálica por
// `font-style` venga la familia de la variable que venga. La variable existe
// para que la intención quede escrita y para no depender de esa coincidencia
// —el nombre que genera `next/font` no es contrato—: si algún día las separara,
// las reglas que ya piden `--font-serif-i` seguirían andando y el resto caería
// en oblicua sintética sin avisar. Están enumeradas en globals.css, junto a
// `.serif-i`.
const newsreaderItalic = Newsreader({
  variable: "--font-serif-i",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["italic"],
  display: "swap",
  preload: false,
});

// IBM Plex Sans y Mono: no las usa NINGUNA página del sitio institucional nuevo
// ni la del fondo —todo eso vive bajo `.site`, que es Arial—. Quedan para
// /analisis y /admin, donde sí se usan y donde cargan por descubrimiento del CSS.
const plexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
  preload: false,
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
  preload: false,
});

const DESCRIPTION =
  "Sociedad de bolsa uruguaya desde 1967. Acceso a mercados globales con nuestro asesoramiento, cuentas segregadas y regulación del BCU.";

export const metadata: Metadata = {
  // Base absoluta para que OG/canonical relativos resuelvan al dominio. TBD:
  // se cambia por env NEXT_PUBLIC_SITE_URL (ver lib/seo.ts).
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Gastón Bengochea & Cía. — Sociedad de Bolsa desde 1967",
    template: "%s · Gastón Bengochea & Cía.",
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  // OJO: sin `alternates.canonical` global — cada página declara el suyo, si no
  // toda página sin canonical propio apuntaría a "/". La home lo setea aparte.
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "es_UY",
    title: "Gastón Bengochea & Cía. — Sociedad de Bolsa desde 1967",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
  // Kill-switch de indexación: noindex global mientras SEO_INDEXABLE no sea "1"
  // (además robots.ts bloquea el crawl). Se prende al lanzar. Ver lib/seo.ts.
  robots: SEO_INDEXABLE
    ? {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-snippet": -1,
          "max-video-preview": -1,
        },
      }
    : { index: false, follow: false },
  // Verificación de Search Console: sólo se emite si está el env (dominio TBD).
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon-180x180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f2249",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-UY"
      data-scroll-behavior="smooth"
      className={`${newsreader.variable} ${newsreaderItalic.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
