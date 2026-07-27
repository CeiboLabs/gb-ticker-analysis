// El último informe publicado, reducido a lo que necesita un destacado (hoy: la
// carta de "Research" del mega-panel del navbar). Mismo patrón que
// lib/fondo.ts → getFundSnapshot(db): la lectura vive acá, la ruta
// (/api/informes/ultimo) es una cáscara y el hook cliente consume el tipo.

import type { D1Database } from "@/lib/metrics";
import { INFORMES } from "@/lib/informes";
import { getContenido } from "@/lib/informeContenido";
import { readInformesLive, readInformeContenido, fechaCortaDe } from "@/lib/informesStore";

export type UltimoInforme = {
  slug: string;
  categoria: "Mensual" | "Semanal";
  /** '29 de mayo' — el eyebrow del destacado (la fecha completa ya está en /informes). */
  fechaCorta: string;
  /** Titular editorial del artículo; si el informe es sólo PDF, el título de la fila. */
  titular: string;
  /** Destino: la página-artículo, o el proxy de PDF cuando todavía no hay artículo. */
  href: string;
  /** `true` ⇒ href es interno (Link); `false` ⇒ es el PDF y se abre en otra pestaña. */
  articulo: boolean;
};

/**
 * Encabezado de la lista live. Sin binding (next build / dev sin base) cae al
 * seed de código, igual que /informes. El contenido sigue la MISMA cadena que la
 * página-artículo: D1 manda y, si la fila aún no tiene el artículo transcrito,
 * cae al registro de código — así el titular curado aparece durante la transición.
 */
export async function getUltimoInforme(db: D1Database | null): Promise<UltimoInforme | null> {
  const lista = db ? await readInformesLive(db) : INFORMES;
  const ultimo = lista[0];
  if (!ultimo) return null;

  const contenido = (db ? await readInformeContenido(db, ultimo.slug) : null) ?? getContenido(ultimo.slug);

  return {
    slug: ultimo.slug,
    categoria: ultimo.categoria,
    fechaCorta: fechaCortaDe(ultimo.fecha),
    titular: contenido?.titular ?? ultimo.titulo,
    href: contenido ? `/informes/${ultimo.slug}` : `/informes/${ultimo.slug}/pdf`,
    articulo: contenido != null,
  };
}
