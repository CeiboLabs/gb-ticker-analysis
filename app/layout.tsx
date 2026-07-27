import type { Metadata, Viewport } from "next";
import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { SITE_URL, SITE_NAME, SEO_INDEXABLE } from "@/lib/seo";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
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
      className={`${newsreader.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
