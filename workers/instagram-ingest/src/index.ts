// Scheduled Worker — feed de Instagram del sitio.
//
// Flujo (cada 6 h): lee el token de D1 → lo refresca si está por vencer → pide
// los últimos N posteos a la API de Instagram (Instagram Login) → por cada
// posteo NUEVO baja el still al bucket R2 (las URLs del CDN de Instagram
// expiran, no se pueden hotlinkear) → UPSERT de la metadata en instagram_posts →
// poda los que ya no están entre los últimos N (fila + still). El sitio lee todo
// por /api/instagram y sirve las imágenes same-origin por /api/instagram/media/[id].
//
// La normalización ("qué es publicable y cuál es su imagen") vive en
// lib/instagramIngest (puro) y la I/O en lib/instagramStore (recibe db/bucket).
// Acá sólo va lo específico del transporte: fetch a la API, refresh de token,
// descarga de imágenes, alertas.

import {
  mediaEndpoint,
  refreshEndpoint,
  normalizeMediaList,
} from "../../../lib/instagramIngest";
import {
  DEFAULT_FEED_LIMIT,
  r2KeyForId,
  getToken,
  setToken,
  readStoredPosts,
  upsertPostStmt,
  deletePostStmt,
  auditStmt,
  writeAudit,
  putImage,
  deleteImages,
} from "../../../lib/instagramStore";
import type { D1Database, D1PreparedStatement, R2Bucket } from "../../../lib/metrics";

// ── Tipos del runtime de Cloudflare (hand-rolled, como lib/metrics) ──────────
interface ScheduledController {
  readonly cron: string;
  readonly scheduledTime: number;
}
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}
interface Env {
  INSTAGRAM_DB: D1Database;
  INSTAGRAM_MEDIA: R2Bucket;
  RESEND_API_KEY?: string;
  INSTAGRAM_ALERT_TO?: string;
  INSTAGRAM_ALERT_FROM?: string;
  INSTAGRAM_FETCH_LIMIT?: string;
  SYNC_TOKEN?: string;
}

// Refrescamos el token cuando le quedan menos de 15 días de vida (el cron corre
// muchas veces antes de eso; sobra margen).
const REFRESH_MARGIN_MS = 15 * 24 * 60 * 60 * 1000;
// Vida por defecto de un token largo si la API no devuelve expires_in (~60 días).
const DEFAULT_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000;
// Tope defensivo por still: una foto de Instagram pesa cientos de KB.
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

// ── Helpers ──────────────────────────────────────────────────────────────────
const clean = (s: string, max = 200) => s.replace(/\s+/g, " ").trim().slice(0, max);

function fetchLimit(env: Env): number {
  const n = Number(env.INSTAGRAM_FETCH_LIMIT);
  return Number.isFinite(n) && n > 0 && n <= 25 ? Math.floor(n) : DEFAULT_FEED_LIMIT;
}

/** Alerta por Resend, texto plano. Best-effort: nunca debe tirar abajo la sync. */
async function alert(env: Env, subject: string, text: string): Promise<void> {
  if (!env.RESEND_API_KEY || !env.INSTAGRAM_ALERT_TO) return;
  const from = env.INSTAGRAM_ALERT_FROM ?? "BNG Instagram <onboarding@resend.dev>";
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: env.INSTAGRAM_ALERT_TO.split(",").map((s) => s.trim()).filter(Boolean),
        subject: `[Instagram] ${subject}`,
        text,
      }),
    });
  } catch {
    /* best-effort */
  }
}

/** Refresca el token largo de Instagram Login. Devuelve null si falla. */
async function refreshToken(token: string): Promise<{ accessToken: string; expiresInMs: number } | null> {
  try {
    const res = await fetch(refreshEndpoint(token), { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
    const accessToken = typeof j.access_token === "string" ? j.access_token : null;
    if (!accessToken) return null;
    const expiresInSec = Number(j.expires_in);
    const expiresInMs = Number.isFinite(expiresInSec) && expiresInSec > 0 ? expiresInSec * 1000 : DEFAULT_TOKEN_TTL_MS;
    return { accessToken, expiresInMs };
  } catch {
    return null;
  }
}

type SyncSummary = { ok: boolean; detail: string };

// ── Núcleo de la sincronización ──────────────────────────────────────────────
async function runSync(env: Env, ctx: ExecutionContext): Promise<SyncSummary> {
  const db = env.INSTAGRAM_DB;
  const bucket = env.INSTAGRAM_MEDIA;
  const nowMs = Date.now();
  const limit = fetchLimit(env);

  // 1. Token. Sin token sembrado no hay nada que hacer.
  const auth = await getToken(db);
  if (!auth) {
    await writeAudit(db, { action: "sync", decision: "error", detail: "token no sembrado", nowMs });
    ctx.waitUntil(alert(env, "Falta el token", "No hay token en instagram_auth. Sembralo (ver docs/RUNBOOK-instagram.md)."));
    return { ok: false, detail: "token no sembrado" };
  }

  // 2. Refresh preventivo si está por vencer.
  let token = auth.accessToken;
  if (auth.expiresAt - nowMs < REFRESH_MARGIN_MS) {
    const refreshed = await refreshToken(token);
    if (refreshed) {
      token = refreshed.accessToken;
      await setToken(db, refreshed.accessToken, nowMs + refreshed.expiresInMs, nowMs);
      await writeAudit(db, {
        action: "refresh_token", decision: "ok",
        detail: `renovado +${Math.round(refreshed.expiresInMs / 86_400_000)}d`, nowMs,
      });
    } else {
      await writeAudit(db, { action: "refresh_token", decision: "error", detail: "falló el refresh", nowMs });
      ctx.waitUntil(alert(
        env, "No se pudo refrescar el token",
        "El refresh del token largo falló. Si ya venció, hay que regenerarlo a mano (ver RUNBOOK).",
      ));
      // Si el token ya venció no tiene sentido seguir; si todavía sirve, seguimos con el viejo.
      if (auth.expiresAt <= nowMs) return { ok: false, detail: "token vencido" };
    }
  }

  // 3. Traer los últimos posteos.
  let rawItems: unknown;
  try {
    const res = await fetch(mediaEndpoint(token, limit), { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`media HTTP ${res.status}`);
    const json = (await res.json()) as { data?: unknown };
    rawItems = json?.data;
  } catch (e) {
    const detail = clean(`API: ${e instanceof Error ? e.message : String(e)}`);
    await writeAudit(db, { action: "sync", decision: "error", detail, nowMs });
    ctx.waitUntil(alert(env, "Falló la API de Instagram", `${detail}\n\nEl sitio mantiene los últimos posteos buenos.`));
    return { ok: false, detail };
  }

  // 4. Normalizar.
  const posts = normalizeMediaList(rawItems);
  if (posts.length === 0) {
    await writeAudit(db, { action: "sync", decision: "noop", detail: "0 posteos usables", nowMs });
    return { ok: true, detail: "0 posteos" };
  }
  const fetchedIds = new Set(posts.map((p) => p.id));

  // 5. Reconciliar contra lo ya guardado: sólo bajamos la imagen de los NUEVOS
  //    (los bytes de un media id no cambian; ahorra egress y escrituras a R2).
  const stored = await readStoredPosts(db);
  const storedById = new Map(stored.map((s) => [s.id, s]));

  const stmts: D1PreparedStatement[] = [];
  let downloaded = 0;
  const imgErrors: string[] = [];

  for (const p of posts) {
    const key = r2KeyForId(p.id);
    const existing = storedById.get(p.id);
    let contentType: string | null = existing?.contentType ?? "image/jpeg";

    if (!existing) {
      // Nuevo: bajar el still y subirlo a R2. Si falla, saltar ESTE posteo (los
      // demás siguen) — no lo metemos en instagram_posts sin imagen.
      try {
        const img = await fetch(p.imageUrl);
        if (!img.ok) throw new Error(`HTTP ${img.status}`);
        const ct = img.headers.get("content-type") ?? "image/jpeg";
        if (!ct.startsWith("image/")) throw new Error(`no es imagen (${ct})`);
        const declared = Number(img.headers.get("content-length"));
        if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) throw new Error(`pesa ${declared}`);
        const buf = await img.arrayBuffer();
        if (buf.byteLength > MAX_IMAGE_BYTES) throw new Error(`pesa ${buf.byteLength}`);
        await putImage(bucket, key, buf, ct);
        contentType = ct;
        downloaded++;
      } catch (e) {
        imgErrors.push(clean(`${p.id}: ${e instanceof Error ? e.message : String(e)}`, 80));
        continue;
      }
    }

    stmts.push(upsertPostStmt(db, p, key, contentType, nowMs));
  }

  // 6. Podar: lo guardado que ya no está entre los últimos N (fila + still).
  const pruneKeys: string[] = [];
  for (const s of stored) {
    if (!fetchedIds.has(s.id)) {
      stmts.push(deletePostStmt(db, s.id));
      pruneKeys.push(s.r2Key);
    }
  }

  // 7. Auditoría + commit transaccional de toda la metadata.
  const detail = `${stmts.length ? posts.length - imgErrors.length : 0} posteos` +
    ` (${downloaded} nuevos, ${pruneKeys.length} podados)` +
    (imgErrors.length ? ` · ${imgErrors.length} imágenes fallaron` : "");
  stmts.push(auditStmt(db, { action: "sync", decision: imgErrors.length ? "error" : "ok", detail, nowMs }));
  await db.batch(stmts);

  // 8. Borrar de R2 los stills podados (best-effort; un huérfano no rompe nada).
  if (pruneKeys.length) ctx.waitUntil(deleteImages(bucket, pruneKeys));

  if (imgErrors.length) {
    ctx.waitUntil(alert(
      env, "Algunas imágenes no se pudieron bajar",
      `No se pudieron bajar ${imgErrors.length} imágenes:\n${imgErrors.join("\n")}\n\nEl resto del feed se actualizó igual.`,
    ));
  }
  return { ok: imgErrors.length === 0, detail };
}

// ── Handlers ─────────────────────────────────────────────────────────────────
async function handleScheduled(_c: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
  try {
    await runSync(env, ctx);
  } catch (e) {
    const detail = clean(`error inesperado: ${e instanceof Error ? e.message : String(e)}`);
    await writeAudit(env.INSTAGRAM_DB, { action: "sync", decision: "error", detail }).catch(() => {});
    ctx.waitUntil(alert(env, "Error inesperado en la sync", detail));
  }
}

// Trigger manual para el primer pull / debugging: POST /sync con el header
// x-sync-token == SYNC_TOKEN. Sin ese secret configurado, responde 403 (fail-closed).
async function handleFetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname !== "/sync" || req.method !== "POST") {
    return new Response("not found", { status: 404 });
  }
  if (!env.SYNC_TOKEN || req.headers.get("x-sync-token") !== env.SYNC_TOKEN) {
    return new Response("forbidden", { status: 403 });
  }
  try {
    const summary = await runSync(env, ctx);
    return Response.json(summary, { status: summary.ok ? 200 : 500 });
  } catch (e) {
    const detail = clean(`error inesperado: ${e instanceof Error ? e.message : String(e)}`);
    await writeAudit(env.INSTAGRAM_DB, { action: "sync", decision: "error", detail }).catch(() => {});
    return Response.json({ ok: false, detail }, { status: 500 });
  }
}

const worker = {
  scheduled: handleScheduled,
  fetch: handleFetch,
};
export default worker;
