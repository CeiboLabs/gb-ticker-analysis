// BNG Selección Global — I/O a D1 de los datos del fondo.
//
// ÚNICO lugar con el SQL de fund_nav / fund_benchmark / fund_holdings_* /
// fund_audit / fund_ingest_seen. Toda función recibe `db: D1Database`
// EXPLÍCITO y nunca llama getMetricsDb(): así el mismo código sirve para el
// Email Worker standalone (binding por `env`) y para las rutas de Pages
// (binding por process.env). Espeja la separación del repo entre lógica pura
// (lib/fondoIngest.ts) e I/O.
//
// Los helpers de escritura vienen en dos sabores: `*Stmt` devuelve un
// D1PreparedStatement para componer un db.batch() transaccional (la ingesta por
// mail del worker: UPSERT + audit + seen en una sola transacción), y un ejecutor
// de conveniencia para el caso de una sola sentencia.

import type { D1Database, D1PreparedStatement } from "@/lib/metrics";
import type { FundNavPoint, HoldingItem, HoldingsSnapshot } from "@/lib/fondo";
// Import relativo (no alias @/) a propósito: este módulo lo bundlea también el
// Email Worker (workers/nav-ingest) con esbuild, que no resuelve el path alias.
import { todayUY, type NormalizedNav } from "./fondoIngest";
import { parseGeoTarget, type GeoTarget } from "./fondoGeo";

// Rezago de divulgación de tenencias (anti front-running). El sitio sólo expone
// el snapshot más reciente con as_of <= hoy - este rezago.
//
// ⚠️ EN 0 A PROPÓSITO, Y ES TEMPORAL. El rezago protege a un fondo EN MARCHA:
// impide que un tercero opere contra las posiciones que el Fondo todavía está
// armando o deshaciendo. El Fondo aún no comenzó a funcionar (el inicio se
// comunica al BCU con 10 días hábiles de anticipación, art. 74 RNMV), así que
// no hay nada contra qué operar y la cartera publicada se ve el mismo día.
//
// RESTAURAR A 30 cuando el Fondo empiece a operar — junto con la primera fila
// real de `fund_nav`. Ver RUNBOOK-panel.md.
export const HOLDINGS_LAG_DAYS = 0;

// ── Lecturas de serie (las usa lib/fondo.ts) ─────────────────────────────────

type NavSeriesRow = { dia: string; nav: number; aum: number | null };

/** Serie diaria publicada (status='live'), ascendente. Para el snapshot/gráfico. */
export async function readNavSeries(db: D1Database): Promise<FundNavPoint[]> {
  const { results } = await db
    .prepare("SELECT dia, nav, aum FROM fund_nav WHERE status = 'live' ORDER BY dia ASC")
    .all<NavSeriesRow>();
  return (results ?? []).map((r) => ({
    dia: r.dia,
    nav: Number(r.nav),
    aum: r.aum == null ? null : Number(r.aum),
  }));
}

/** Serie del benchmark (niveles de índice), ascendente. Vacía ⇒ una sola línea. */
export async function readBenchmarkSeries(db: D1Database): Promise<FundNavPoint[]> {
  const { results } = await db
    .prepare("SELECT dia, level FROM fund_benchmark ORDER BY dia ASC")
    .all<{ dia: string; level: number }>();
  return (results ?? []).map((r) => ({ dia: r.dia, nav: Number(r.level), aum: null }));
}

/**
 * Snapshot de tenencias vigente y DIVULGABLE: el más reciente con
 * as_of <= hoy_UY - lagDays. Devuelve null si no hay ninguno (pre-lanzamiento o
 * todos demasiado recientes para el rezago).
 */
export async function readLatestHoldings(
  db: D1Database,
  lagDays: number = HOLDINGS_LAG_DAYS,
  nowMs: number = Date.now(),
): Promise<HoldingsSnapshot | null> {
  const cutoff = new Date(Date.parse(todayUY(nowMs)) - lagDays * 86_400_000).toISOString().slice(0, 10);
  const snap = await db
    .prepare(
      "SELECT as_of FROM fund_holdings_snapshot WHERE status = 'live' AND as_of <= ? ORDER BY as_of DESC LIMIT 1",
    )
    .bind(cutoff)
    .first<{ as_of: string }>();
  if (!snap) return null;

  const { results } = await db
    .prepare(
      "SELECT ord, name, short, asset_class, weight_bps FROM fund_holdings_item WHERE as_of = ? ORDER BY ord ASC",
    )
    .bind(snap.as_of)
    .all<{ ord: number; name: string; short: string | null; asset_class: string; weight_bps: number }>();
  const items: HoldingItem[] = (results ?? []).map((r) => ({
    name: r.name,
    short: r.short,
    assetClass: r.asset_class as HoldingItem["assetClass"],
    weightBps: Number(r.weight_bps),
  }));
  if (items.length === 0) return null;
  return { asOf: snap.as_of, items };
}

// ── fund_config: documentos chicos del fondo (ajustes y estado) ──────────────

/** Valor crudo de una clave de configuración. null si no hay fila. */
export async function readConfig(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT value FROM fund_config WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  return row ? row.value : null;
}

/** Metadatos de la última escritura de una clave. */
export async function readConfigMeta(
  db: D1Database,
  key: string,
): Promise<{ updatedAt: number; updatedBy: string | null } | null> {
  const row = await db
    .prepare("SELECT updated_at, updated_by FROM fund_config WHERE key = ?")
    .bind(key)
    .first<{ updated_at: number; updated_by: string | null }>();
  return row ? { updatedAt: Number(row.updated_at), updatedBy: row.updated_by } : null;
}

/**
 * UPSERT de una clave. Es `*Stmt` y no un ejecutor porque la mayoría de los
 * usos van adentro de un `db.batch` junto a su auditoría: el dato y su rastro
 * entran o no entran juntos.
 */
export function upsertConfigStmt(
  db: D1Database,
  key: string,
  value: string,
  by: string,
  nowMs: number = Date.now(),
): D1PreparedStatement {
  return db
    .prepare(
      "INSERT INTO fund_config (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
    )
    .bind(key, value, nowMs, by);
}

// ── Exposición geográfica (asignación objetivo) ──────────────────────────────

const GEO_KEY = "geo_target";

/**
 * Los cinco pesos por región que carga el panel. null si no hay fila todavía, o
 * si lo guardado no valida — en los dos casos la página cae a `GEO_BASELINE`,
 * la línea de base que viaja en el deploy.
 *
 * Que un valor corrupto degrade en vez de tirar es deliberado: esto lo lee el
 * snapshot público, y un JSON roto en una tabla de configuración no tiene por
 * qué dejar sin página al fondo.
 */
export async function readGeoTarget(db: D1Database): Promise<GeoTarget | null> {
  const raw = await readConfig(db, GEO_KEY);
  return raw === null ? null : parseGeoTarget(raw);
}

/**
 * Guarda los cinco pesos. Como es un documento indivisible, es un UPSERT de una
 * fila y no un delete+insert: no hay estado intermedio posible ni necesidad de
 * transacción propia (igual va en el batch de la ruta, junto a la auditoría).
 *
 * El JSON se serializa desde el objeto YA VALIDADO por GeoTargetSchema, así que
 * lo que entra a la base no puede tener claves de más.
 */
export function upsertGeoTargetStmt(
  db: D1Database,
  target: GeoTarget,
  by: string,
  nowMs: number = Date.now(),
): D1PreparedStatement {
  return upsertConfigStmt(db, GEO_KEY, JSON.stringify(target), by, nowMs);
}

/** Metadatos de la última edición, para mostrar "actualizado por X" en el panel. */
export async function readGeoMeta(db: D1Database) {
  return readConfigMeta(db, GEO_KEY);
}

// ── Lecturas puntuales (contexto de validación) ──────────────────────────────

/** Último cierre publicado estrictamente anterior a `dia` (para la banda día-a-día). */
export async function getPrevNav(db: D1Database, dia: string): Promise<{ dia: string; nav: number } | null> {
  const row = await db
    .prepare("SELECT dia, nav FROM fund_nav WHERE status = 'live' AND dia < ? ORDER BY dia DESC LIMIT 1")
    .bind(dia)
    .first<{ dia: string; nav: number }>();
  return row ? { dia: row.dia, nav: Number(row.nav) } : null;
}

/** Cierre ya publicado EN `dia` (para detectar duplicado/conflicto). */
export async function getNavRow(db: D1Database, dia: string): Promise<{ dia: string; nav: number } | null> {
  const row = await db
    .prepare("SELECT dia, nav FROM fund_nav WHERE status = 'live' AND dia = ? LIMIT 1")
    .bind(dia)
    .first<{ dia: string; nav: number }>();
  return row ? { dia: row.dia, nav: Number(row.nav) } : null;
}

// ── Escrituras (componibles en db.batch) ─────────────────────────────────────

export type NavWriteMeta = {
  source: "email" | "backfill" | "override";
  messageId?: string | null;
  senderHash?: string | null;
  nowMs?: number;
};

const UPSERT_NAV_SQL =
  "INSERT INTO fund_nav (dia, nav, aum, nota, updated_at, status, source, message_id, sender_hash) " +
  "VALUES (?,?,?,?,?, 'live', ?, ?, ?) " +
  "ON CONFLICT(dia) DO UPDATE SET " +
  "nav = excluded.nav, aum = excluded.aum, nota = excluded.nota, " +
  "updated_at = excluded.updated_at, status = 'live', " +
  "source = excluded.source, message_id = excluded.message_id, sender_hash = excluded.sender_hash";

/** UPSERT de un cierre ya validado. status se fuerza a 'live'. */
export function upsertNavStmt(db: D1Database, value: NormalizedNav, meta: NavWriteMeta): D1PreparedStatement {
  return db
    .prepare(UPSERT_NAV_SQL)
    .bind(
      value.dia,
      value.nav,
      value.aum,
      value.nota,
      meta.nowMs ?? Date.now(),
      meta.source,
      meta.messageId ?? null,
      meta.senderHash ?? null,
    );
}

export type AuditEntry = {
  actor: "email-worker" | "admin" | "backfill" | "deadman";
  channel: "email" | "http" | "cron";
  action: "ingest" | "override" | "backfill" | "holdings" | "deadman_alert";
  decision: "accepted" | "rejected" | "duplicate" | "superseded";
  reason?: string | null;
  targetDia?: string | null;
  parsedNav?: number | null;
  parsedAum?: number | null;
  prevNav?: number | null;
  strategy?: string | null;
  messageId?: string | null;
  senderHash?: string | null;
  ipHash?: string | null;
  rawExcerpt?: string | null;
  nowMs?: number;
};

const AUDIT_SQL =
  "INSERT INTO fund_audit (" +
  "ts, actor, channel, action, decision, reason, target_dia, parsed_nav, parsed_aum, " +
  "prev_nav, strategy, message_id, sender_hash, ip_hash, raw_excerpt" +
  ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

export function auditStmt(db: D1Database, e: AuditEntry): D1PreparedStatement {
  return db
    .prepare(AUDIT_SQL)
    .bind(
      e.nowMs ?? Date.now(),
      e.actor,
      e.channel,
      e.action,
      e.decision,
      e.reason ?? null,
      e.targetDia ?? null,
      e.parsedNav ?? null,
      e.parsedAum ?? null,
      e.prevNav ?? null,
      e.strategy ?? null,
      e.messageId ?? null,
      e.senderHash ?? null,
      e.ipHash ?? null,
      e.rawExcerpt ?? null,
    );
}

/** Ejecuta una entrada de auditoría suelta (cuando no se batchea). */
export async function writeAudit(db: D1Database, e: AuditEntry): Promise<void> {
  await auditStmt(db, e).run();
}

const SEEN_SQL =
  "INSERT INTO fund_ingest_seen (message_id, ts, outcome) VALUES (?,?,?) " +
  "ON CONFLICT(message_id) DO UPDATE SET ts = excluded.ts, outcome = excluded.outcome";

export function seenStmt(db: D1Database, messageId: string, outcome: string, nowMs?: number): D1PreparedStatement {
  return db.prepare(SEEN_SQL).bind(messageId, nowMs ?? Date.now(), outcome);
}

/** ¿Ya procesamos este Message-ID? (supresión de replay para todo desenlace). */
export async function wasSeen(db: D1Database, messageId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 AS x FROM fund_ingest_seen WHERE message_id = ? LIMIT 1")
    .bind(messageId)
    .first<{ x: number }>();
  return !!row;
}

/** Marca un Message-ID como procesado (ejecuta seenStmt suelto). */
export async function markSeen(db: D1Database, messageId: string, outcome: string, nowMs?: number): Promise<void> {
  await seenStmt(db, messageId, outcome, nowMs).run();
}
