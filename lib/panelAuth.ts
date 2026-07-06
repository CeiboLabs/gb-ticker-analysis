// Panel de administración — sesiones, cookie y gates de acceso.
//
// La criptografía pura (PBKDF2+pepper, TOTP, AES-GCM) vive en
// lib/panelCrypto.ts (sin imports de Next, testeable con tsx); acá va todo lo
// que depende de next/server y next/headers: la cookie de sesión, la creación/
// validación de sesiones contra D1 y los DOS gates que reemplazan al
// middleware (proxy.ts es Node-only, incompatible con next-on-pages):
//
//   - requirePanelSession(req, perm?, opts?) — PRIMERA línea de cada route
//     handler del panel.
//   - getPanelUser(scope?) — en cada page.tsx del panel (server component);
//     la page hace el redirect (fuera de try/catch, porque redirect() lanza).
//
// Los layouts NO cuentan como gate: no se re-ejecutan en la navegación client-side.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getMetricsDb, eventBaseFromRequest, type D1Database } from "@/lib/metrics";
import { b64u, sha256Hex, panelConfigured } from "@/lib/panelCrypto";
import {
  getSessionWithUser,
  insertSession,
  touchSession,
  revokeSession,
  toPanelUser,
  hasPerm,
  writePanelAudit,
  type PanelPerm,
  type PanelUser,
  type SessionScope,
} from "@/lib/panelStore";

// ── Lifetimes (env-tunables con bounds sanos) ────────────────────────────────

function intEnv(name: string, def: number, min: number, max: number): number {
  const n = parseInt(process.env[name] ?? String(def), 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : def;
}

/** Vencimiento ABSOLUTO de la sesión (default 12 h: una jornada laboral). */
export function sessionTtlMs(): number {
  return intEnv("PANEL_SESSION_TTL_HOURS", 12, 1, 24 * 7) * 60 * 60 * 1000;
}

/** Vencimiento por INACTIVIDAD (default 2 h). */
export function sessionIdleMs(): number {
  return intEnv("PANEL_SESSION_IDLE_MINUTES", 120, 5, 24 * 60) * 60 * 1000;
}

// ── Cookie de sesión ─────────────────────────────────────────────────────────

// __Host- exige Secure + Path=/ + sin Domain: la cookie sólo puede venir de
// este host por HTTPS. PANEL_COOKIE_INSECURE=1 (SOLO .dev.vars) degrada el
// nombre y quita Secure porque wrangler pages dev sirve http.
function insecureCookieMode(): boolean {
  return process.env.PANEL_COOKIE_INSECURE === "1";
}

export function sessionCookieName(): string {
  return insecureCookieMode() ? "bng_panel" : "__Host-bng_panel";
}

function buildSessionCookie(token: string, maxAgeMs: number): string {
  const parts = [
    `${sessionCookieName()}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (!insecureCookieMode()) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(): string {
  const parts = [`${sessionCookieName()}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (!insecureCookieMode()) parts.push("Secure");
  return parts.join("; ");
}

// ── Sesiones ─────────────────────────────────────────────────────────────────

/**
 * Emite una sesión nueva: token de 256 bits aleatorios que viaja SOLO en la
 * cookie; la DB guarda su SHA-256. Devuelve el header Set-Cookie listo.
 */
export async function createSession(
  db: D1Database,
  userId: number,
  scope: SessionScope,
  req: Request,
  nowMs: number = Date.now(),
): Promise<{ token: string; setCookie: string }> {
  const token = b64u(crypto.getRandomValues(new Uint8Array(32)));
  const base = eventBaseFromRequest(req);
  await insertSession(db, {
    tokenHash: await sha256Hex(token),
    userId,
    scope,
    expiresAt: nowMs + sessionTtlMs(),
    ipHash: base.ipHash,
    userAgent: base.userAgent,
    nowMs,
  });
  return { token, setCookie: buildSessionCookie(token, sessionTtlMs()) };
}

type LoadedSession = { user: PanelUser; sessionId: number; scope: SessionScope };

/**
 * Valida un token de cookie contra la DB: existencia, revocación, vencimiento
 * absoluto e inactividad, y estado del usuario (una sesión viva NO sobrevive a
 * un disable). Toca last_seen_at con throttle de 60 s (1 write/min máximo).
 */
async function loadSession(db: D1Database, token: string | undefined, nowMs: number): Promise<LoadedSession | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const found = await getSessionWithUser(db, await sha256Hex(token));
  if (!found) return null;
  const { session, user } = found;
  if (session.revoked_at != null) return null;
  if (session.expires_at <= nowMs) return null;
  if (session.last_seen_at + sessionIdleMs() <= nowMs) {
    await revokeSession(db, session.id, nowMs);
    return null;
  }
  if (user.status !== "active") {
    await revokeSession(db, session.id, nowMs);
    return null;
  }
  if (nowMs - session.last_seen_at > 60_000) {
    await touchSession(db, session.id, nowMs);
  }
  return { user: toPanelUser(user), sessionId: session.id, scope: session.scope };
}

// ── Gates ────────────────────────────────────────────────────────────────────

// Origin guard para métodos mutantes — misma postura que /api/contact: un POST
// cross-site con la cookie pegada (CSRF) muere acá aunque SameSite=Lax ya lo
// cubra en los navegadores modernos. Defensa en capas, no confianza en una.
// Exportada porque login/setup (que no tienen sesión todavía) la aplican solas.
export function originOk(req: NextRequest): boolean {
  const reqHost = req.headers.get("host");
  const check = (raw: string | null): boolean => {
    if (!raw || !reqHost) return false;
    try {
      return new URL(raw).host === reqHost;
    } catch {
      return false;
    }
  };
  return check(req.headers.get("origin")) || check(req.headers.get("referer"));
}

export type PanelGate =
  | { ok: true; user: PanelUser; sessionId: number; scope: SessionScope; db: D1Database }
  | { ok: false; res: NextResponse };

function deny(status: 401 | 403 | 503, error: string): { ok: false; res: NextResponse } {
  return {
    ok: false,
    res: NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } }),
  };
}

/**
 * Gate de los route handlers del panel. Se llama como PRIMERA línea de cada
 * handler (no hay middleware). `perm` exige una sección ('usuarios' = sólo rol
 * admin); `scope: "setup"` acepta también las sesiones restringidas del primer
 * acceso (default: sólo 'full'). Fail-closed: sin binding D1 o sin
 * PANEL_PEPPER ⇒ 503.
 */
export async function requirePanelSession(
  req: NextRequest,
  perm?: PanelPerm | "usuarios",
  opts: { scope?: SessionScope } = {},
): Promise<PanelGate> {
  const db = getMetricsDb();
  if (!db || !panelConfigured()) {
    return deny(503, "sin_bindings");
  }
  // CSRF: todo método mutante exige Origin/Referer same-host, antes de tocar
  // la DB — un cross-site ni siquiera gasta lookups.
  if (req.method !== "GET" && req.method !== "HEAD" && !originOk(req)) {
    return deny(403, "forbidden");
  }
  const nowMs = Date.now();
  const token = req.cookies.get(sessionCookieName())?.value;
  const loaded = await loadSession(db, token, nowMs);
  if (!loaded) return deny(401, "sin_sesion");
  if ((opts.scope ?? "full") === "full" && loaded.scope !== "full") {
    return deny(403, "setup_pendiente");
  }
  if (perm && !hasPerm(loaded.user, perm)) {
    await writePanelAudit(db, {
      actorId: loaded.user.id,
      actorEmail: loaded.user.email,
      ipHash: eventBaseFromRequest(req).ipHash,
      section: perm === "usuarios" ? "usuarios" : perm,
      action: "denied",
      target: req.nextUrl.pathname,
      decision: "denied",
      nowMs,
    });
    return deny(403, "sin_permiso");
  }
  return { ok: true, user: loaded.user, sessionId: loaded.sessionId, scope: loaded.scope, db };
}

/**
 * Gate de las PAGES del panel (server components): lee la cookie con
 * `await cookies()` (async en Next 16) y devuelve el usuario o null — la page
 * decide el redirect. scope "setup" acepta ambas.
 */
export async function getPanelUser(scope: SessionScope = "full"): Promise<PanelUser | null> {
  const db = getMetricsDb();
  if (!db || !panelConfigured()) return null;
  const store = await cookies();
  const token = store.get(sessionCookieName())?.value;
  const loaded = await loadSession(db, token, Date.now());
  if (!loaded) return null;
  if (scope === "full" && loaded.scope !== "full") return null;
  return loaded.user;
}

/**
 * Gate estándar de las pages del panel completo: resuelve usuario o el destino
 * del redirect (login si no hay sesión; configurar-acceso si la sesión es de
 * setup; /admin si falta el permiso). El redirect() lo ejecuta LA PAGE — fuera
 * de try/catch — porque lanza una excepción de control de flujo.
 */
export async function panelPageGate(
  perm?: PanelPerm | "usuarios",
): Promise<{ user: PanelUser; redirectTo: null } | { user: null; redirectTo: string }> {
  const user = await getPanelUser();
  if (!user) {
    const setupUser = await getPanelUser("setup");
    return { user: null, redirectTo: setupUser ? "/admin/configurar-acceso" : "/admin/login" };
  }
  if (perm && !hasPerm(user, perm)) {
    return { user: null, redirectTo: "/admin" };
  }
  return { user, redirectTo: null };
}

export { hasPerm, type PanelPerm, type PanelUser, type SessionScope } from "@/lib/panelStore";
