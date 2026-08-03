// Panel de administración — I/O a D1 de usuarios, sesiones y auditoría.
//
// ÚNICO lugar con el SQL de admin_users / admin_sessions / admin_audit (los
// flags viven en lib/flags.ts porque los leen también los data-APIs públicos).
// Toda función recibe `db: D1Database` EXPLÍCITO — mismo patrón que
// lib/fondoStore.ts: la lógica de crypto/gates vive en lib/panelAuth.ts y este
// módulo sólo persiste. Las mutaciones de negocio del panel componen
// db.batch([mutación, panelAuditStmt(...)]) para que dato y auditoría entren
// (o fallen) juntos.

import type { D1Database, D1PreparedStatement } from "@/lib/metrics";

// ── Tipos de dominio ─────────────────────────────────────────────────────────

// 'leads' (2026-07-28) es dato personal de gente que dejó su correo en el sitio:
// se asigna a quien atiende la mesa, no a cualquier editor. Como todos, viene
// apagado por defecto — un editor nuevo no lo tiene hasta que se le da.
export const PANEL_PERMS = ["informes", "fondo", "secciones", "monitor", "leads"] as const;
export type PanelPerm = (typeof PANEL_PERMS)[number];
export type PanelRole = "admin" | "editor";
export type SessionScope = "setup" | "full";

// Vista segura del usuario para gates y UI. NUNCA lleva password_hash ni
// secretos TOTP — eso se queda en AdminUserRow, que no sale de las rutas.
export type PanelUser = {
  id: number;
  email: string;
  nombre: string;
  role: PanelRole;
  perms: PanelPerm[];
  mustChangePassword: boolean;
  totpEnrolled: boolean;
};

export type AdminUserRow = {
  id: number;
  email: string;
  nombre: string;
  password_hash: string;
  must_change_password: number;
  password_changed_at: number | null;
  totp_secret: string | null;
  totp_pending_secret: string | null;
  totp_pending_created_at: number | null;
  totp_enrolled_at: number | null;
  totp_last_step: number;
  role: PanelRole;
  perms: string;
  status: "active" | "disabled";
  created_at: number;
  created_by: string | null;
  updated_at: number;
};

export type AdminSessionMeta = {
  id: number;
  scope: SessionScope;
  created_at: number;
  expires_at: number;
  last_seen_at: number;
  revoked_at: number | null;
};

/** CSV de la DB → permisos tipados. Ignora tokens fuera del vocabulario. */
export function parsePerms(csv: string | null | undefined): PanelPerm[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is PanelPerm => (PANEL_PERMS as readonly string[]).includes(s));
}

export function permsToCsv(perms: PanelPerm[]): string {
  // Dedupe preservando el orden canónico del vocabulario.
  return PANEL_PERMS.filter((p) => perms.includes(p)).join(",");
}

export function toPanelUser(row: AdminUserRow): PanelUser {
  return {
    id: row.id,
    email: row.email,
    nombre: row.nombre,
    role: row.role,
    perms: row.role === "admin" ? [...PANEL_PERMS] : parsePerms(row.perms),
    mustChangePassword: row.must_change_password === 1,
    totpEnrolled: row.totp_secret != null,
  };
}

/** 'usuarios' no es un permiso asignable: es exclusivo del rol admin. */
export function hasPerm(user: PanelUser, perm: PanelPerm | "usuarios"): boolean {
  if (user.role === "admin") return true;
  if (perm === "usuarios") return false;
  return user.perms.includes(perm);
}

// ── Usuarios ─────────────────────────────────────────────────────────────────

const USER_COLS =
  "id, email, nombre, password_hash, must_change_password, password_changed_at, " +
  "totp_secret, totp_pending_secret, totp_pending_created_at, totp_enrolled_at, " +
  "totp_last_step, role, perms, status, created_at, created_by, updated_at";

export async function countUsers(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS n FROM admin_users").first<{ n: number }>();
  return Number(row?.n ?? 0);
}

export async function getUserByEmail(db: D1Database, email: string): Promise<AdminUserRow | null> {
  return await db
    .prepare(`SELECT ${USER_COLS} FROM admin_users WHERE email = ? LIMIT 1`)
    .bind(email.trim().toLowerCase())
    .first<AdminUserRow>();
}

export async function getUserById(db: D1Database, id: number): Promise<AdminUserRow | null> {
  return await db.prepare(`SELECT ${USER_COLS} FROM admin_users WHERE id = ? LIMIT 1`).bind(id).first<AdminUserRow>();
}

export async function listUsers(db: D1Database): Promise<AdminUserRow[]> {
  const { results } = await db
    .prepare(`SELECT ${USER_COLS} FROM admin_users ORDER BY created_at ASC`)
    .all<AdminUserRow>();
  return results ?? [];
}

/**
 * Bootstrap del PRIMER admin, atómico: el INSERT sólo pasa si la tabla está
 * vacía (WHERE NOT EXISTS) — dos requests concurrentes no pueden crear dos
 * "primeros" usuarios. Devuelve false si ya había alguno.
 */
export async function createFirstAdmin(
  db: D1Database,
  u: { email: string; nombre: string; passwordHash: string; nowMs?: number },
): Promise<boolean> {
  const now = u.nowMs ?? Date.now();
  const res = (await db
    .prepare(
      "INSERT INTO admin_users (email, nombre, password_hash, must_change_password, role, perms, status, created_at, created_by, updated_at) " +
        "SELECT ?, ?, ?, 0, 'admin', '', 'active', ?, 'setup', ? " +
        "WHERE NOT EXISTS (SELECT 1 FROM admin_users)",
    )
    .bind(u.email.trim().toLowerCase(), u.nombre.trim(), u.passwordHash, now, now)
    .run()) as { meta?: { changes?: number } };
  return (res?.meta?.changes ?? 0) > 0;
}

/** Alta normal (por un admin). Lanza si el email ya existe (índice único) — la ruta lo mapea a 409. */
export async function insertUser(
  db: D1Database,
  u: { email: string; nombre: string; passwordHash: string; role: PanelRole; perms: PanelPerm[]; createdBy: string; nowMs?: number },
): Promise<void> {
  const now = u.nowMs ?? Date.now();
  await db
    .prepare(
      "INSERT INTO admin_users (email, nombre, password_hash, must_change_password, role, perms, status, created_at, created_by, updated_at) " +
        "VALUES (?, ?, ?, 1, ?, ?, 'active', ?, ?, ?)",
    )
    .bind(u.email.trim().toLowerCase(), u.nombre.trim(), u.passwordHash, u.role, permsToCsv(u.perms), now, u.createdBy, now)
    .run();
}

export async function updateUserProfile(
  db: D1Database,
  id: number,
  fields: { nombre: string; role: PanelRole; perms: PanelPerm[]; status: "active" | "disabled"; nowMs?: number },
): Promise<void> {
  await db
    .prepare("UPDATE admin_users SET nombre = ?, role = ?, perms = ?, status = ?, updated_at = ? WHERE id = ?")
    .bind(fields.nombre.trim(), fields.role, permsToCsv(fields.perms), fields.status, fields.nowMs ?? Date.now(), id)
    .run();
}

export async function countOtherActiveAdmins(db: D1Database, exceptId: number): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM admin_users WHERE role = 'admin' AND status = 'active' AND id != ?")
    .bind(exceptId)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

export async function setPassword(
  db: D1Database,
  id: number,
  passwordHash: string,
  opts: { mustChange: boolean; nowMs?: number },
): Promise<void> {
  const now = opts.nowMs ?? Date.now();
  await db
    .prepare(
      "UPDATE admin_users SET password_hash = ?, must_change_password = ?, password_changed_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(passwordHash, opts.mustChange ? 1 : 0, now, now, id)
    .run();
}

// ── TOTP (enrolamiento y anti-replay) ────────────────────────────────────────

export async function setTotpPending(db: D1Database, id: number, encSecret: string, nowMs?: number): Promise<void> {
  const now = nowMs ?? Date.now();
  await db
    .prepare("UPDATE admin_users SET totp_pending_secret = ?, totp_pending_created_at = ?, updated_at = ? WHERE id = ?")
    .bind(encSecret, now, now, id)
    .run();
}

/** Promueve el secret pendiente a definitivo tras verificar el primer código. */
export async function promoteTotpPending(db: D1Database, id: number, step: number, nowMs?: number): Promise<void> {
  const now = nowMs ?? Date.now();
  await db
    .prepare(
      "UPDATE admin_users SET totp_secret = totp_pending_secret, totp_pending_secret = NULL, " +
        "totp_pending_created_at = NULL, totp_enrolled_at = ?, totp_last_step = ?, updated_at = ? WHERE id = ?",
    )
    .bind(now, step, now, id)
    .run();
}

/** Reset de TOTP (admin): el próximo login del usuario re-enrola. */
export async function clearTotp(db: D1Database, id: number, nowMs?: number): Promise<void> {
  const now = nowMs ?? Date.now();
  await db
    .prepare(
      "UPDATE admin_users SET totp_secret = NULL, totp_pending_secret = NULL, totp_pending_created_at = NULL, " +
        "totp_enrolled_at = NULL, totp_last_step = 0, updated_at = ? WHERE id = ?",
    )
    .bind(now, id)
    .run();
}

/** Registra el timestep TOTP consumido. Monotónico: nunca retrocede. */
export async function bumpTotpStep(db: D1Database, id: number, step: number): Promise<void> {
  await db
    .prepare("UPDATE admin_users SET totp_last_step = ? WHERE id = ? AND totp_last_step < ?")
    .bind(step, id, step)
    .run();
}

// ── Sesiones ─────────────────────────────────────────────────────────────────

export async function insertSession(
  db: D1Database,
  s: {
    tokenHash: string;
    userId: number;
    scope: SessionScope;
    expiresAt: number;
    ipHash: string | null;
    userAgent: string | null;
    nowMs?: number;
  },
): Promise<void> {
  const now = s.nowMs ?? Date.now();
  await db
    .prepare(
      "INSERT INTO admin_sessions (token_hash, user_id, scope, created_at, expires_at, last_seen_at, ip_hash, user_agent) " +
        "VALUES (?,?,?,?,?,?,?,?)",
    )
    .bind(s.tokenHash, s.userId, s.scope, now, s.expiresAt, now, s.ipHash, s.userAgent?.slice(0, 200) ?? null)
    .run();
}

type SessionJoinRow = AdminUserRow & {
  s_id: number;
  s_scope: SessionScope;
  s_created_at: number;
  s_expires_at: number;
  s_last_seen_at: number;
  s_revoked_at: number | null;
};

/** Sesión + usuario en un solo viaje (lookup por hash del token). */
export async function getSessionWithUser(
  db: D1Database,
  tokenHash: string,
): Promise<{ session: AdminSessionMeta; user: AdminUserRow } | null> {
  const row = await db
    .prepare(
      "SELECT s.id AS s_id, s.scope AS s_scope, s.created_at AS s_created_at, s.expires_at AS s_expires_at, " +
        "s.last_seen_at AS s_last_seen_at, s.revoked_at AS s_revoked_at, " +
        `u.${USER_COLS.split(", ").join(", u.")} ` +
        "FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id WHERE s.token_hash = ? LIMIT 1",
    )
    .bind(tokenHash)
    .first<SessionJoinRow>();
  if (!row) return null;
  const { s_id, s_scope, s_created_at, s_expires_at, s_last_seen_at, s_revoked_at, ...user } = row;
  return {
    session: {
      id: s_id,
      scope: s_scope,
      created_at: s_created_at,
      expires_at: s_expires_at,
      last_seen_at: s_last_seen_at,
      revoked_at: s_revoked_at,
    },
    user: user as AdminUserRow,
  };
}

export async function touchSession(db: D1Database, id: number, nowMs?: number): Promise<void> {
  await db.prepare("UPDATE admin_sessions SET last_seen_at = ? WHERE id = ?").bind(nowMs ?? Date.now(), id).run();
}

export async function revokeSession(db: D1Database, id: number, nowMs?: number): Promise<void> {
  await db
    .prepare("UPDATE admin_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL")
    .bind(nowMs ?? Date.now(), id)
    .run();
}

/** Revoca TODAS las sesiones vivas de un usuario (disable, reset, cambio de clave). */
export async function revokeUserSessions(db: D1Database, userId: number, opts: { exceptId?: number; nowMs?: number } = {}): Promise<void> {
  const now = opts.nowMs ?? Date.now();
  if (opts.exceptId != null) {
    await db
      .prepare("UPDATE admin_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL AND id != ?")
      .bind(now, userId, opts.exceptId)
      .run();
  } else {
    await db
      .prepare("UPDATE admin_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL")
      .bind(now, userId)
      .run();
  }
}

/** Sesiones del usuario para la vista de seguridad (metadata, sin hashes). */
export async function listUserSessions(db: D1Database, userId: number): Promise<Array<AdminSessionMeta & { user_agent: string | null }>> {
  const { results } = await db
    .prepare(
      "SELECT id, scope, created_at, expires_at, last_seen_at, revoked_at, user_agent " +
        "FROM admin_sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY last_seen_at DESC LIMIT 20",
    )
    .bind(userId, Date.now())
    .all<AdminSessionMeta & { user_agent: string | null }>();
  return results ?? [];
}

/** Limpieza lazy (se llama en cada login exitoso): borra sesiones vencidas hace >7 días. */
export async function purgeExpiredSessions(db: D1Database, nowMs?: number): Promise<void> {
  const cutoff = (nowMs ?? Date.now()) - 7 * 24 * 60 * 60 * 1000;
  await db.prepare("DELETE FROM admin_sessions WHERE expires_at < ?").bind(cutoff).run();
}

// ── Auditoría (append-only, calcada de fund_audit) ───────────────────────────

export type PanelAuditEntry = {
  actorId?: number | null;
  actorEmail?: string | null;
  ipHash?: string | null;
  section: "auth" | "informes" | "fondo" | "secciones" | "monitor" | "usuarios" | "leads";
  action: string;
  target?: string | null;
  decision: "ok" | "denied" | "rejected" | "error";
  detail?: Record<string, unknown> | null;
  nowMs?: number;
};

const AUDIT_SQL =
  "INSERT INTO admin_audit (ts, actor_id, actor_email, ip_hash, section, action, target, decision, detail) " +
  "VALUES (?,?,?,?,?,?,?,?,?)";

export function panelAuditStmt(db: D1Database, e: PanelAuditEntry): D1PreparedStatement {
  return db
    .prepare(AUDIT_SQL)
    .bind(
      e.nowMs ?? Date.now(),
      e.actorId ?? null,
      e.actorEmail ?? null,
      e.ipHash ?? null,
      e.section,
      e.action,
      e.target ?? null,
      e.decision,
      e.detail ? JSON.stringify(e.detail).slice(0, 800) : null,
    );
}

/**
 * Auditoría suelta (logins, denegaciones): best-effort — un error de D1 en el
 * audit no debe tumbar el login. Las mutaciones de negocio NO usan esto: van en
 * db.batch([mutación, panelAuditStmt(...)]) para que sean atómicas.
 */
export async function writePanelAudit(db: D1Database, e: PanelAuditEntry): Promise<void> {
  try {
    await panelAuditStmt(db, e).run();
  } catch (err) {
    console.error("[panel] audit write failed:", err);
  }
}

export type AuditRow = {
  id: number;
  ts: number;
  actor_email: string | null;
  section: string;
  action: string;
  target: string | null;
  decision: string;
  detail: string | null;
};

export async function readAudit(db: D1Database, opts: { limit: number; section?: string | null }): Promise<AuditRow[]> {
  const limit = Math.min(Math.max(1, opts.limit), 500);
  const { results } = opts.section
    ? await db
        .prepare(
          "SELECT id, ts, actor_email, section, action, target, decision, detail FROM admin_audit WHERE section = ? ORDER BY ts DESC LIMIT ?",
        )
        .bind(opts.section, limit)
        .all<AuditRow>()
    : await db
        .prepare("SELECT id, ts, actor_email, section, action, target, decision, detail FROM admin_audit ORDER BY ts DESC LIMIT ?")
        .bind(limit)
        .all<AuditRow>();
  return results ?? [];
}
