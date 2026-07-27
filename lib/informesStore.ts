// Informes — I/O a D1 de la tabla `informes` (la lista pública, el proxy de
// PDF y el panel leen/escriben por acá). Mismo patrón que fondoStore: `db`
// explícito, cero process.env. Los ARTÍCULOS curados NO viven acá (siguen en
// código, lib/informeContenido) — esta tabla es la metadata + el PDF.

import type { D1Database } from "@/lib/metrics";
import type { Informe } from "@/lib/informes";
import type { ContenidoInforme } from "@/lib/informeContenido/tipos";

export type InformeRow = {
  slug: string;
  fecha: string;
  fecha_texto: string;
  titulo: string;
  categoria: "Mensual" | "Semanal";
  pdf_url: string | null;
  r2_key: string | null;
  video_id: string | null;
  status: "live" | "hold";
  created_at: number;
  updated_at: number;
  updated_by: string | null;
};

const COLS = "slug, fecha, fecha_texto, titulo, categoria, pdf_url, r2_key, video_id, status, created_at, updated_at, updated_by";

/** Fila → tipo público `Informe` (la lista no usa `pdf`: linkea al proxy por slug). */
export function rowToInforme(row: InformeRow): Informe {
  return {
    slug: row.slug,
    fecha: row.fecha,
    fechaTexto: row.fecha_texto,
    titulo: row.titulo,
    categoria: row.categoria,
    pdf: row.pdf_url ?? "",
    ...(row.video_id ? { videoId: row.video_id } : {}),
  };
}

/** Informes publicados, descendente por fecha — lo que ve el sitio. */
export async function readInformesLive(db: D1Database): Promise<Informe[]> {
  const { results } = await db
    .prepare(`SELECT ${COLS} FROM informes WHERE status = 'live' ORDER BY fecha DESC`)
    .all<InformeRow>();
  return (results ?? []).map(rowToInforme);
}

/** Fila cruda por slug, cualquier status — para el proxy de PDF y el panel. */
export async function readInformeRow(db: D1Database, slug: string): Promise<InformeRow | null> {
  return await db.prepare(`SELECT ${COLS} FROM informes WHERE slug = ? LIMIT 1`).bind(slug).first<InformeRow>();
}

/** Todas las filas para el panel (también las ocultas), descendente. */
export async function listInformesAdmin(db: D1Database): Promise<InformeRow[]> {
  const { results } = await db.prepare(`SELECT ${COLS} FROM informes ORDER BY fecha DESC`).all<InformeRow>();
  return results ?? [];
}

/** ¿Puede publicarse? La regla "no live sin PDF" vive en código (sin CHECK en DB). */
export function informeTienePdf(row: Pick<InformeRow, "pdf_url" | "r2_key">): boolean {
  return row.pdf_url != null || row.r2_key != null;
}

/** Slug canónico derivado de la categoría y la fecha (el server manda, nunca el cliente). */
export function slugForInforme(categoria: "Mensual" | "Semanal", fecha: string): string {
  return categoria === "Mensual" ? `mensual-${fecha.slice(0, 7)}` : `semanal-${fecha}`;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** '29 de mayo, 2026' — mismo formato que el seed. */
export function fechaTextoDe(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return `${d} de ${MESES[m - 1]}, ${y}`;
}

/** '29 de mayo' — sin año, para rótulos breves (el destacado del navbar). */
export function fechaCortaDe(fecha: string): string {
  const [, m, d] = fecha.split("-").map(Number);
  return `${d} de ${MESES[m - 1]}`;
}

/** Alta. Lanza si el slug ya existe (PK) — la ruta lo mapea a 409. */
export async function insertInforme(
  db: D1Database,
  i: {
    slug: string;
    fecha: string;
    fechaTexto: string;
    titulo: string;
    categoria: "Mensual" | "Semanal";
    pdfUrl: string | null;
    videoId: string | null;
    updatedBy: string;
    nowMs?: number;
  },
): Promise<void> {
  const now = i.nowMs ?? Date.now();
  await db
    .prepare(
      "INSERT INTO informes (slug, fecha, fecha_texto, titulo, categoria, pdf_url, r2_key, video_id, status, created_at, updated_at, updated_by) " +
        "VALUES (?,?,?,?,?,?,NULL,?, 'hold', ?, ?, ?)",
    )
    .bind(i.slug, i.fecha, i.fechaTexto, i.titulo, i.categoria, i.pdfUrl, i.videoId, now, now, i.updatedBy)
    .run();
}

export type InformeUpdate = {
  titulo?: string;
  fecha?: string;
  fechaTexto?: string;
  videoId?: string | null;
  pdfUrl?: string | null;
  status?: "live" | "hold";
};

/** Actualización parcial: sólo pisa lo que viene definido (null = limpiar). */
export async function updateInforme(
  db: D1Database,
  slug: string,
  fields: InformeUpdate,
  updatedBy: string,
  nowMs?: number,
): Promise<void> {
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (fields.titulo !== undefined) { sets.push("titulo = ?"); binds.push(fields.titulo); }
  if (fields.fecha !== undefined) { sets.push("fecha = ?"); binds.push(fields.fecha); }
  if (fields.fechaTexto !== undefined) { sets.push("fecha_texto = ?"); binds.push(fields.fechaTexto); }
  if (fields.videoId !== undefined) { sets.push("video_id = ?"); binds.push(fields.videoId); }
  if (fields.pdfUrl !== undefined) { sets.push("pdf_url = ?"); binds.push(fields.pdfUrl); }
  if (fields.status !== undefined) { sets.push("status = ?"); binds.push(fields.status); }
  if (sets.length === 0) return;
  sets.push("updated_at = ?", "updated_by = ?");
  binds.push(nowMs ?? Date.now(), updatedBy, slug);
  await db.prepare(`UPDATE informes SET ${sets.join(", ")} WHERE slug = ?`).bind(...binds).run();
}

/** Registra el PDF subido a R2 (la key la genera el server, jamás el cliente). */
export async function setInformeR2Key(
  db: D1Database,
  slug: string,
  r2Key: string,
  updatedBy: string,
  nowMs?: number,
): Promise<void> {
  await db
    .prepare("UPDATE informes SET r2_key = ?, updated_at = ?, updated_by = ? WHERE slug = ?")
    .bind(r2Key, nowMs ?? Date.now(), updatedBy, slug)
    .run();
}

// ── Contenido editorial (artículo) ───────────────────────────────────────────

/**
 * Contenido del artículo de un informe (JSON parseado). `null` si todavía no se
 * transcribió, o si la columna `contenido` aún no existe (base sin migrar) — en
 * ese caso el llamador cae al seed de código. Se confía en el JSON almacenado:
 * se validó con ContenidoInformeSchema al escribirlo.
 */
export async function readInformeContenido(db: D1Database, slug: string): Promise<ContenidoInforme | null> {
  try {
    const row = await db
      .prepare("SELECT contenido FROM informes WHERE slug = ? LIMIT 1")
      .bind(slug)
      .first<{ contenido: string | null }>();
    if (!row?.contenido) return null;
    return JSON.parse(row.contenido) as ContenidoInforme;
  } catch (err) {
    // Columna inexistente (base sin migrar) o JSON corrupto: cae al seed.
    if (String(err).includes("no such column") || err instanceof SyntaxError) return null;
    throw err;
  }
}

/** Persiste el artículo (o lo limpia con null). El JSON ya viene validado. */
export async function setInformeContenido(
  db: D1Database,
  slug: string,
  contenido: ContenidoInforme | null,
  updatedBy: string,
  nowMs?: number,
): Promise<void> {
  await db
    .prepare("UPDATE informes SET contenido = ?, updated_at = ?, updated_by = ? WHERE slug = ?")
    .bind(contenido ? JSON.stringify(contenido) : null, nowMs ?? Date.now(), updatedBy, slug)
    .run();
}

/**
 * Slugs con artículo transcrito (contenido IS NOT NULL). `soloLive` (default) los
 * restringe a los publicados — para decidir en el hub/vecinos si linkear al
 * artículo o al PDF. Tolera la columna ausente (base sin migrar ⇒ []).
 */
export async function readSlugsConArticulo(db: D1Database, soloLive = true): Promise<string[]> {
  const where = soloLive ? "status = 'live' AND contenido IS NOT NULL" : "contenido IS NOT NULL";
  try {
    const { results } = await db.prepare(`SELECT slug FROM informes WHERE ${where}`).all<{ slug: string }>();
    return (results ?? []).map((r) => r.slug);
  } catch (err) {
    if (String(err).includes("no such column")) return [];
    throw err;
  }
}
