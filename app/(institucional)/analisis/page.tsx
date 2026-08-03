import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { AnalisisSwitch } from "./AnalisisSwitch";

// /analisis tiene dos caras en UNA ruta: la landing (sin ticker) y el reporte
// por-acción (con ?ticker=). Es server component sólo para resolver la metadata
// condicional — toda la parte interactiva vive en AnalisisSwitch (client).
//
// generateMetadata lee el searchParams y decide:
//   ·  landing → indexable, es la entrada SEO al tool (ver docs/SEO-plan.md).
//   ·  reporte → NOINDEX: contenido fino generado con IA + marco legal de
//      recomendaciones públicas (oferta pública). La herramienta sigue usable;
//      la landing es la puerta indexable.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ ticker?: string | string[] }>;
}): Promise<Metadata> {
  const raw = (await searchParams).ticker;
  const ticker = (Array.isArray(raw) ? raw[0] : raw)?.trim().toUpperCase();

  if (ticker) {
    const meta = pageMetadata({
      title: `Análisis · ${ticker}`,
      description:
        "Reporte de análisis bursátil por acción: veredicto, métricas clave, escenarios y contexto de mercado.",
      path: "/analisis",
      noindex: true,
    });
    // Tarjeta OG POR ACCIÓN. noindex no impide compartir: un informe reenviado por
    // WhatsApp es una presentación tibia de la casa —el canal que más convierte en
    // este negocio— y hasta ahora ese link salía pelado. La imagen la arma
    // /api/og/analisis leyendo el último veredicto de verdict_log.
    return {
      ...meta,
      openGraph: {
        ...meta.openGraph,
        images: [{ url: `/api/og/analisis?ticker=${encodeURIComponent(ticker)}`, width: 1200, height: 630 }],
      },
      twitter: {
        ...meta.twitter,
        images: [`/api/og/analisis?ticker=${encodeURIComponent(ticker)}`],
      },
    };
  }

  return pageMetadata({
    title: "Análisis de acciones",
    description:
      "Analizá una acción con nuestra lectura: métricas de calidad, valuación, escenarios y contexto para entender una empresa antes de invertir.",
    path: "/analisis",
  });
}

export default function AnalisisPage() {
  return <AnalisisSwitch />;
}
