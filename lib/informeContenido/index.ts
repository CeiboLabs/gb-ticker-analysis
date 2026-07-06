// Registro de informes con artículo curado. Un informe puede existir en la
// lista (lib/informes.ts) sin tener todavía su artículo transcrito: mientras
// tanto, la lista lo enlaza a su PDF. `tieneArticulo` es la fuente de verdad de
// qué slugs ya tienen página propia (la lista y generateStaticParams la usan).

import type { ContenidoInforme } from "./tipos";
import { semanal_2026_05_29 } from "./semanal-2026-05-29";

const REGISTRO: Record<string, ContenidoInforme> = {
  "semanal-2026-05-29": semanal_2026_05_29,
};

/** Contenido curado de un informe, o `undefined` si aún no fue transcrito. */
export function getContenido(slug: string): ContenidoInforme | undefined {
  return REGISTRO[slug];
}

/** ¿El informe ya tiene artículo propio (vs. sólo PDF)? */
export function tieneArticulo(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(REGISTRO, slug);
}

/** Slugs con artículo, para `generateStaticParams`. */
export function slugsConArticulo(): string[] {
  return Object.keys(REGISTRO);
}

export type { ContenidoInforme, Bloque, Dato, GrupoDatos, Columna } from "./tipos";
