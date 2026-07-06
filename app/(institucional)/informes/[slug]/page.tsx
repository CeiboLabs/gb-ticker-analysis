import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { INFORMES, getInforme, type Informe } from "@/lib/informes";
import { getContenido, slugsConArticulo, tieneArticulo } from "@/lib/informeContenido";
import { ArticuloInforme, type Vecino } from "@/components/institucional/informe/ArticuloInforme";

// Página-artículo de un informe. Estática: sólo se prerenderiza para los slugs
// que ya tienen contenido curado (slugsConArticulo). `dynamicParams = false`
// evita el render en runtime — cualquier otro slug devuelve 404 estático, sin
// necesitar runtime edge (a diferencia del proxy PDF hermano [slug]/pdf).

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return slugsConArticulo().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const informe = getInforme(slug);
  const contenido = getContenido(slug);
  if (!informe || !contenido) return {};
  return {
    title: `${contenido.titular} · ${contenido.volanta} · Bengochea & Cía.`,
    description: contenido.bajada,
    openGraph: {
      title: contenido.titular,
      description: contenido.bajada,
      type: "article",
    },
  };
}

/** Convierte un informe vecino en link, sólo si ya tiene artículo propio. */
function aVecino(inf: Informe | undefined): Vecino | undefined {
  if (!inf || !tieneArticulo(inf.slug)) return undefined;
  return { titulo: inf.titulo, categoria: inf.categoria, href: `/informes/${inf.slug}` };
}

export default async function InformeArticuloPage({ params }: Params) {
  const { slug } = await params;
  const informe = getInforme(slug);
  const contenido = getContenido(slug);
  if (!informe || !contenido) notFound();

  // INFORMES está ordenado del más reciente al más antiguo.
  const idx = INFORMES.findIndex((i) => i.slug === slug);
  const masReciente = idx > 0 ? INFORMES[idx - 1] : undefined;
  const masAntiguo = idx >= 0 ? INFORMES[idx + 1] : undefined;

  return (
    <ArticuloInforme
      informe={informe}
      contenido={contenido}
      anterior={aVecino(masAntiguo)}
      siguiente={aVecino(masReciente)}
    />
  );
}
