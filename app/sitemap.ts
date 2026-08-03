import { headers } from "next/headers";
import type { MetadataRoute } from "next";
import { abs } from "@/lib/seo";
import { getMetricsDb } from "@/lib/metrics";
import { readFlag } from "@/lib/flags";
import { readInformesLive } from "@/lib/informesStore";
import { INFORMES } from "@/lib/informes";
import { estaOculta } from "@/lib/paginasOcultas";
import { esHostFondo, SITIO_FONDO_URL } from "@/lib/sitios";

// Se arma por request: lee D1 para los informes publicados (igual que /informes);
// sin binding cae al seed de código. Volumen bajo ⇒ un solo sitemap (lejos del
// límite de 50k). Incluye /analisis (la landing, indexable); su variante reporte
// (/analisis?ticker=) es noindex y no va acá. Excluye /informes/*/pdf (proxy) y
// TODA sección sin publicar (lib/paginasOcultas.ts — hoy se caen /prensa,
// /nosotros, /historia, /servicios y /educacion: si el sitio las 404ea, listarlas
// sería mandar a Google contra una pared).
// Ver docs/SEO-plan.md.
//
// DOS SITIOS, UN DEPLOY (ver lib/sitios.ts): un sitemap por dominio, resuelto por
// el Host del request. El del fondo lista UNA sola URL —su raíz—, y el de la casa
// ya no lista el fondo: es otro sitio, con su propio sitemap y su propio canonical.
export const dynamic = "force-dynamic";

const SECTORES = ["tecnologia", "energia", "agro", "logistica"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (esHostFondo((await headers()).get("host"))) {
    return [{ url: `${SITIO_FONDO_URL}/`, changeFrequency: "weekly", priority: 1.0 }];
  }

  const estaticas: MetadataRoute.Sitemap = [
    { url: abs("/"), changeFrequency: "weekly", priority: 1.0 },
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

  // El récord del analizador entra SÓLO si está publicado (flag record_publico,
  // default OFF): apagado, la ruta 404ea y listarla sería mandar a Google contra
  // una pared — el mismo criterio que estaOculta() aplica al final.
  let record: MetadataRoute.Sitemap = [];
  try {
    if (await readFlag(getMetricsDb(), "record_publico")) {
      record = [{ url: abs("/analisis/record"), changeFrequency: "weekly", priority: 0.7 }];
    }
  } catch {
    // sin binding: queda afuera, que es el default seguro
  }

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

  return [...estaticas, ...record, ...sectores, ...informes].filter(
    (e) => !estaOculta(new URL(e.url).pathname),
  );
}
