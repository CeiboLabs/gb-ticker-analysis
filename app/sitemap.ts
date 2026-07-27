import type { MetadataRoute } from "next";
import { abs } from "@/lib/seo";
import { getMetricsDb } from "@/lib/metrics";
import { readInformesLive } from "@/lib/informesStore";
import { INFORMES } from "@/lib/informes";
import { estaOculta } from "@/lib/paginasOcultas";

// Se arma por request: lee D1 para los informes publicados (igual que /informes);
// sin binding cae al seed de código. Volumen bajo ⇒ un solo sitemap (lejos del
// límite de 50k). Incluye /analisis (la landing, indexable); su variante reporte
// (/analisis?ticker=) es noindex y no va acá. Excluye /informes/*/pdf (proxy) y
// TODA sección sin publicar (lib/paginasOcultas.ts — hoy se caen /prensa,
// /nosotros, /historia, /servicios, /bng-seleccion-global y /educacion: si el
// sitio las 404ea, listarlas sería mandar a Google contra una pared).
// Ver docs/SEO-plan.md.
export const dynamic = "force-dynamic";

const SECTORES = ["tecnologia", "energia", "agro", "logistica"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const estaticas: MetadataRoute.Sitemap = [
    { url: abs("/"), changeFrequency: "weekly", priority: 1.0 },
    { url: abs("/bng-seleccion-global"), changeFrequency: "weekly", priority: 0.9 },
    { url: abs("/informes"), changeFrequency: "weekly", priority: 0.8 },
    { url: abs("/servicios"), changeFrequency: "monthly", priority: 0.7 },
    { url: abs("/historia"), changeFrequency: "yearly", priority: 0.7 },
    { url: abs("/nosotros"), changeFrequency: "yearly", priority: 0.7 },
    { url: abs("/equipo"), changeFrequency: "monthly", priority: 0.7 },
    { url: abs("/educacion"), changeFrequency: "monthly", priority: 0.6 },
    { url: abs("/analisis"), changeFrequency: "monthly", priority: 0.6 },
    { url: abs("/calculadora"), changeFrequency: "yearly", priority: 0.5 },
    { url: abs("/contacto"), changeFrequency: "yearly", priority: 0.5 },
  ];

  const sectores: MetadataRoute.Sitemap = SECTORES.map((s) => ({
    url: abs(`/oportunidades/${s}`),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  let informes: MetadataRoute.Sitemap = [];
  try {
    const db = getMetricsDb();
    const filas = db ? await readInformesLive(db) : INFORMES;
    informes = filas.map((i) => ({
      url: abs(`/informes/${i.slug}`),
      lastModified: i.fecha,
      changeFrequency: "yearly" as const,
      priority: 0.7,
    }));
  } catch {
    // sin binding o error de lectura: el sitemap igual sale con estáticas + sectores
  }

  return [...estaticas, ...sectores, ...informes].filter(
    (e) => !estaOculta(new URL(e.url).pathname),
  );
}
