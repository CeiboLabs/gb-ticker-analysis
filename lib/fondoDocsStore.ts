// Documentos regulatorios del fondo — I/O a D1 de `fondo_documentos`.
// Un documento VIGENTE por tipo (PK); cada upload escribe una key NUEVA en R2
// (con timestamp) y pisa la fila — las versiones anteriores quedan en el
// bucket para rollback manual. `db` explícito, como el resto de los stores.

import type { D1Database } from "@/lib/metrics";
import type { FondoDocTipo } from "@/lib/panelSchemas";

export type FondoDocRow = {
  tipo: FondoDocTipo;
  titulo: string;
  descripcion: string | null;
  r2_key: string;
  content_len: number | null;
  status: "live" | "hold";
  updated_at: number;
  updated_by: string;
};

const COLS = "tipo, titulo, descripcion, r2_key, content_len, status, updated_at, updated_by";

/** Todos los tipos cargados (también hold) — para el panel. */
export async function listDocsAdmin(db: D1Database): Promise<FondoDocRow[]> {
  const { results } = await db.prepare(`SELECT ${COLS} FROM fondo_documentos ORDER BY tipo ASC`).all<FondoDocRow>();
  return results ?? [];
}

/** Sólo los publicados — para el API público (que además respeta el flag). */
export async function listDocsLive(db: D1Database): Promise<FondoDocRow[]> {
  const { results } = await db
    .prepare(`SELECT ${COLS} FROM fondo_documentos WHERE status = 'live' ORDER BY tipo ASC`)
    .all<FondoDocRow>();
  return results ?? [];
}

export async function getDoc(db: D1Database, tipo: FondoDocTipo): Promise<FondoDocRow | null> {
  return await db.prepare(`SELECT ${COLS} FROM fondo_documentos WHERE tipo = ? LIMIT 1`).bind(tipo).first<FondoDocRow>();
}

/** Alta/reemplazo tras un upload validado: la fila queda apuntando a la key nueva. */
export async function upsertDoc(
  db: D1Database,
  d: { tipo: FondoDocTipo; titulo: string; descripcion?: string | null; r2Key: string; contentLen: number; updatedBy: string; nowMs?: number },
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO fondo_documentos (tipo, titulo, descripcion, r2_key, content_len, status, updated_at, updated_by) " +
        "VALUES (?,?,?,?,?, 'live', ?, ?) " +
        "ON CONFLICT(tipo) DO UPDATE SET titulo = excluded.titulo, descripcion = excluded.descripcion, " +
        "r2_key = excluded.r2_key, content_len = excluded.content_len, status = 'live', " +
        "updated_at = excluded.updated_at, updated_by = excluded.updated_by",
    )
    .bind(d.tipo, d.titulo, d.descripcion ?? null, d.r2Key, d.contentLen, d.nowMs ?? Date.now(), d.updatedBy)
    .run();
}

/** Edición de metadata / visibilidad, sin tocar el archivo. */
export async function patchDoc(
  db: D1Database,
  tipo: FondoDocTipo,
  fields: { titulo?: string; descripcion?: string | null; status?: "live" | "hold" },
  updatedBy: string,
  nowMs?: number,
): Promise<void> {
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (fields.titulo !== undefined) { sets.push("titulo = ?"); binds.push(fields.titulo); }
  if (fields.descripcion !== undefined) { sets.push("descripcion = ?"); binds.push(fields.descripcion); }
  if (fields.status !== undefined) { sets.push("status = ?"); binds.push(fields.status); }
  if (sets.length === 0) return;
  sets.push("updated_at = ?", "updated_by = ?");
  binds.push(nowMs ?? Date.now(), updatedBy, tipo);
  await db.prepare(`UPDATE fondo_documentos SET ${sets.join(", ")} WHERE tipo = ?`).bind(...binds).run();
}
