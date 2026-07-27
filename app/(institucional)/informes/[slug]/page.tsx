import { notFound } from "next/navigation";
import { cache } from "react";
import type { Metadata } from "next";
import { INFORMES, AUTORES, getInforme, type Informe } from "@/lib/informes";
import { getContenido, tieneArticulo } from "@/lib/informeContenido";
import type { ContenidoInforme } from "@/lib/informeContenido/tipos";
import { getMetricsDb } from "@/lib/metrics";
import {
  readInformeRow,
  readInformeContenido,
  readInformesLive,
  readSlugsConArticulo,
  rowToInforme,
} from "@/lib/informesStore";
import { ArticuloInforme, type Vecino } from "@/components/institucional/informe/ArticuloInforme";
import { pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { articleLd, breadcrumbLd } from "@/lib/jsonld";

// Página-artículo de un informe. Se renderiza POR REQUEST (force-dynamic),
// leyendo la fila y el contenido de D1 —lo administra el panel— con el mismo
// status-gating que el proxy de PDF hermano (hold ⇒ 404). Sin binding (next
// build / next dev sin DB) cae al seed de código (lib/informes +
// lib/informeContenido). Antes era estática desde código (generateStaticParams);
// el contenido mudó a la base para editarse desde el panel sin redeploy.

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

type Cargado = { informe: Informe; contenido: ContenidoInforme; live: boolean };

// Memoizado por request: generateMetadata y la página comparten una sola lectura.
const cargar = cache(async (slug: string): Promise<Cargado | null> => {
  const db = getMetricsDb();
  if (db) {
    const row = await readInformeRow(db, slug);
    if (!row) return null;
    // D1 manda; si la fila aún no tiene artículo transcrito, cae al seed de código
    // (así 05-29 sigue renderizando durante la transición a la base).
    const contenido = (await readInformeContenido(db, slug)) ?? getContenido(slug);
    if (!contenido) return null;
    return { informe: rowToInforme(row), contenido, live: row.status === "live" };
  }
  const informe = getInforme(slug);
  const contenido = getContenido(slug);
  if (!informe || !contenido) return null;
  return { informe, contenido, live: true };
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await cargar(slug);
  if (!data || !data.live) return {};
  const { informe, contenido } = data;
  const autor = AUTORES.find((a) => a.tag === informe.categoria);
  return pageMetadata({
    title: `${contenido.titular} · ${contenido.volanta}`,
    description: contenido.bajada,
    path: `/informes/${slug}`,
    type: "article",
    publishedTime: informe.fecha,
    modifiedTime: informe.fecha,
    authors: autor ? [autor.nombre] : undefined,
  });
}

export default async function InformeArticuloPage({ params }: Params) {
  const { slug } = await params;
  const data = await cargar(slug);
  if (!data || !data.live) notFound();
  const { informe, contenido } = data;

  // Vecinos: orden por la lista live de D1 (o el seed sin binding), descendente
  // por fecha. Se enlaza a artículo sólo si el vecino ya tiene el suyo; si no,
  // se omite (el hub /informes lo linkea a su PDF).
  const db = getMetricsDb();
  const lista = db ? await readInformesLive(db) : INFORMES;
  const conArticulo = db
    ? new Set(await readSlugsConArticulo(db))
    : new Set(INFORMES.filter((i) => tieneArticulo(i.slug)).map((i) => i.slug));

  const idx = lista.findIndex((i) => i.slug === slug);
  const masReciente = idx > 0 ? lista[idx - 1] : undefined;
  const masAntiguo = idx >= 0 ? lista[idx + 1] : undefined;
  const aVecino = (inf: Informe | undefined): Vecino | undefined =>
    inf && conArticulo.has(inf.slug)
      ? { titulo: inf.titulo, categoria: inf.categoria, href: `/informes/${inf.slug}` }
      : undefined;

  const autor = AUTORES.find((a) => a.tag === informe.categoria);

  return (
    <>
      <JsonLd
        data={articleLd({
          slug,
          headline: contenido.titular,
          description: contenido.bajada,
          datePublished: informe.fecha,
          dateModified: informe.fecha,
          // author.url: pendiente páginas de autor; el nombre ya da la señal E-E-A-T.
          authors: autor ? [{ name: autor.nombre }] : [],
          section: informe.categoria,
        })}
      />
      <JsonLd
        data={breadcrumbLd([
          { name: "Inicio", path: "/" },
          { name: "Informes", path: "/informes" },
          { name: contenido.titular, path: `/informes/${slug}` },
        ])}
      />
      <ArticuloInforme
        informe={informe}
        contenido={contenido}
        anterior={aVecino(masAntiguo)}
        siguiente={aVecino(masReciente)}
      />
    </>
  );
}
