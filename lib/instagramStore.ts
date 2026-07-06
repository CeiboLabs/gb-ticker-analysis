// Feed de Instagram — I/O a D1 (tablas instagram_*) y a R2 (stills).
//
// ÚNICO lugar con el SQL de instagram_posts / instagram_auth / instagram_audit y
// con el acceso al bucket R2. Toda función recibe `db: D1Database` / `bucket:
// R2Bucket` EXPLÍCITO y nunca llama a los getters de Pages: así el mismo código
// sirve para el scheduled worker (bindings por `env`) y para las rutas de Pages
// (bindings por process.env). Espeja lib/fondoStore.ts.
//
// Las escrituras que el worker batchea (upsert de posteos + delete de podados +
// auditoría en una sola transacción) vienen como `*Stmt` que devuelven un
// D1PreparedStatement; los helpers de R2 son I/O suelto (no van en db.batch).

import type { D1Database, D1PreparedStatement, R2Bucket, R2ObjectBody } from "@/lib/metrics";
// Import relativo (no alias @/) a propósito: este módulo lo bundlea también el
// worker (workers/instagram-ingest) con esbuild, que no resuelve el path alias.
// (Los imports de tipo de arriba se borran en el bundle, así que el alias no molesta.)
import type { NormalizedPost } from "./instagramIngest";

// Cuántos posteos guardamos/servimos como máximo. El sitio suele renderizar
// menos (p. ej. 3); guardar algunos de más deja mostrar más sin re-armar nada.
export const DEFAULT_FEED_LIMIT = 6;

/** Key del still en R2 para un media id. id ya viene validado (numérico). */
export function r2KeyForId(id: string): string {
  return `posts/${id}`;
}

// ── Lectura para el sitio (/api/instagram) ───────────────────────────────────

export type PublicPost = {
  id: string;
  caption: string | null;
  permalink: string;
  mediaType: string;
  takenAt: string;
};

/** Los últimos `limit` posteos publicados (status='live'), más nuevo primero. */
export async function readLatestPosts(db: D1Database, limit: number = DEFAULT_FEED_LIMIT): Promise<PublicPost[]> {
  const { results } = await db
    .prepare(
      "SELECT id, caption, permalink, media_type, taken_at FROM instagram_posts " +
        "WHERE status = 'live' ORDER BY taken_at_ms DESC LIMIT ?",
    )
    .bind(limit)
    .all<{ id: string; caption: string | null; permalink: string; media_type: string; taken_at: string }>();
  return (results ?? []).map((r) => ({
    id: r.id,
    caption: r.caption,
    permalink: r.permalink,
    mediaType: r.media_type,
    takenAt: r.taken_at,
  }));
}

// ── Lectura para el worker (reconciliar contra lo ya guardado) ────────────────

export type StoredPost = { id: string; r2Key: string; contentType: string | null };

/** Todos los posteos guardados (id + key/mime del still) para detectar nuevos y podar. */
export async function readStoredPosts(db: D1Database): Promise<StoredPost[]> {
  const { results } = await db
    .prepare("SELECT id, r2_key, content_type FROM instagram_posts")
    .all<{ id: string; r2_key: string; content_type: string | null }>();
  return (results ?? []).map((r) => ({ id: r.id, r2Key: r.r2_key, contentType: r.content_type }));
}

// ── Escrituras (componibles en db.batch) ─────────────────────────────────────

const UPSERT_POST_SQL =
  "INSERT INTO instagram_posts " +
  "(id, caption, permalink, media_type, taken_at, taken_at_ms, r2_key, content_type, updated_at, status) " +
  "VALUES (?,?,?,?,?,?,?,?,?, 'live') " +
  "ON CONFLICT(id) DO UPDATE SET " +
  "caption = excluded.caption, permalink = excluded.permalink, media_type = excluded.media_type, " +
  "taken_at = excluded.taken_at, taken_at_ms = excluded.taken_at_ms, " +
  "r2_key = excluded.r2_key, content_type = excluded.content_type, " +
  "updated_at = excluded.updated_at, status = 'live'";

/** UPSERT de un posteo ya normalizado. status se fuerza a 'live'. */
export function upsertPostStmt(
  db: D1Database,
  post: NormalizedPost,
  r2Key: string,
  contentType: string | null,
  nowMs: number,
): D1PreparedStatement {
  return db
    .prepare(UPSERT_POST_SQL)
    .bind(
      post.id,
      post.caption,
      post.permalink,
      post.mediaType,
      post.takenAt,
      post.takenAtMs,
      r2Key,
      contentType,
      nowMs,
    );
}

/** Borra un posteo (para podar los que ya no están entre los últimos N). */
export function deletePostStmt(db: D1Database, id: string): D1PreparedStatement {
  return db.prepare("DELETE FROM instagram_posts WHERE id = ?").bind(id);
}

// ── Token (fila única id=1) ──────────────────────────────────────────────────

export type StoredToken = { accessToken: string; expiresAt: number };

/** Lee el token largo vigente, o null si todavía no se sembró. */
export async function getToken(db: D1Database): Promise<StoredToken | null> {
  const row = await db
    .prepare("SELECT access_token, expires_at FROM instagram_auth WHERE id = 1")
    .first<{ access_token: string; expires_at: number }>();
  return row ? { accessToken: row.access_token, expiresAt: Number(row.expires_at) } : null;
}

const SET_TOKEN_SQL =
  "INSERT INTO instagram_auth (id, access_token, expires_at, updated_at) VALUES (1,?,?,?) " +
  "ON CONFLICT(id) DO UPDATE SET " +
  "access_token = excluded.access_token, expires_at = excluded.expires_at, updated_at = excluded.updated_at";

export function setTokenStmt(db: D1Database, accessToken: string, expiresAt: number, nowMs: number): D1PreparedStatement {
  return db.prepare(SET_TOKEN_SQL).bind(accessToken, expiresAt, nowMs);
}

/** Guarda/actualiza el token (ejecuta setTokenStmt suelto). */
export async function setToken(db: D1Database, accessToken: string, expiresAt: number, nowMs: number): Promise<void> {
  await setTokenStmt(db, accessToken, expiresAt, nowMs).run();
}

// ── Auditoría ────────────────────────────────────────────────────────────────

export type IgAuditEntry = {
  action: "sync" | "refresh_token" | "prune";
  decision: "ok" | "error" | "noop";
  detail?: string | null;
  nowMs?: number;
};

const IG_AUDIT_SQL = "INSERT INTO instagram_audit (ts, action, decision, detail) VALUES (?,?,?,?)";

export function auditStmt(db: D1Database, e: IgAuditEntry): D1PreparedStatement {
  return db.prepare(IG_AUDIT_SQL).bind(e.nowMs ?? Date.now(), e.action, e.decision, e.detail ?? null);
}

/** Ejecuta una entrada de auditoría suelta (cuando no se batchea). */
export async function writeAudit(db: D1Database, e: IgAuditEntry): Promise<void> {
  await auditStmt(db, e).run();
}

// ── R2 (stills) ──────────────────────────────────────────────────────────────

/** Sube un still a R2 con su content-type (para que la ruta lo re-emita igual). */
export async function putImage(
  bucket: R2Bucket,
  key: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<void> {
  await bucket.put(key, body, { httpMetadata: { contentType } });
}

/** Lee un still de R2 (o null si no está). */
export function getImage(bucket: R2Bucket, key: string): Promise<R2ObjectBody | null> {
  return bucket.get(key);
}

/** Borra stills de R2 (best-effort; un objeto huérfano no rompe nada). */
export async function deleteImages(bucket: R2Bucket, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await bucket.delete(keys);
}
