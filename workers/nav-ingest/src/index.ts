// Email Worker — ingesta del valor cuota de BNG Selección Global.
//
// Flujo: mail (reenviado por el cliente) → allowlist de remitente → idempotencia
// por Message-ID → parse (postal-mime) → extractor → validación + banda de
// cordura → decisión. Lo VÁLIDO se publica solo en fund_nav; lo que falla NO se
// publica (se audita y se alerta, el sitio mantiene la última cuota buena).
//
// Toda la lógica de "¿es publicable?" vive en lib/fondoIngest (puro) y la I/O en
// lib/fondoStore (recibe `db`). Acá sólo va lo específico del transporte mail:
// allowlist, parseo MIME, alertas y el dead-man-switch.
//
// ⚠️ Etapa 3 pendiente: EXTRACTORS está vacío hasta tener un mail de muestra
// real. Mientras tanto, cada mail se LOGUEA (subject + snippet + adjuntos,
// saneado) en fund_audit y se alerta, para diseñar el parser sobre datos reales.

import { parseEmail } from "./mime";
import {
  validateNav,
  runExtractors,
  todayUY,
  type ParsedEmail,
  type NavBands,
} from "../../../lib/fondoIngest";
import {
  getPrevNav,
  getNavRow,
  wasSeen,
  markSeen,
  writeAudit,
  upsertNavStmt,
  auditStmt,
  seenStmt,
} from "../../../lib/fondoStore";
import type { D1Database, D1PreparedStatement } from "../../../lib/metrics";

// ── Tipos del runtime de Cloudflare (hand-rolled, como lib/metrics) ──────────
interface ForwardableEmailMessage {
  readonly from: string; // remitente de sobre (MAIL FROM)
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream<Uint8Array>;
  readonly rawSize: number;
  setReject(reason: string): void;
  forward(rcptTo: string, headers?: Headers): Promise<void>;
}
interface ScheduledController {
  readonly cron: string;
  readonly scheduledTime: number;
}
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}
interface Env {
  NAV_DB: D1Database;
  INGEST_ALLOWED_SENDERS?: string;
  RESEND_API_KEY?: string;
  FUND_ALERT_TO?: string;
  FUND_ALERT_FROM?: string;
  NAV_MAX_DAILY_MOVE?: string;
  DEADMAN_MAX_STALE_DAYS?: string;
}

const MAX_RAW = 6 * 1024 * 1024; // 6 MiB — CF corta en 25; bajamos defensivo

// ── Helpers ──────────────────────────────────────────────────────────────────
const lc = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** Extrae la dirección de un header From crudo ('Nombre <a@b.com>' → 'a@b.com'). */
function extractAddr(raw: string | null): string {
  if (!raw) return "";
  const m = raw.match(/<([^>]+)>/);
  return lc(m ? m[1] : raw);
}

/** FNV-1a 32-bit, 8 hex — igual que metrics.hashIp. Nunca guardamos la dirección cruda. */
function hashAddr(addr: string): string | null {
  if (!addr) return null;
  let h = 0x811c9dc5;
  for (let i = 0; i < addr.length; i++) {
    h ^= addr.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

const clean = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

/** Muestra saneada para diseñar el parser / depurar: subject + snippet + adjuntos. Nunca el cuerpo completo. */
function sampleExcerpt(p: ParsedEmail): string {
  const atts = p.attachments.map((a) => `${a.filename || "?"}(${a.mimeType})`).join(", ");
  const base = clean(`[${p.subject}] ${p.text || ""}`, 360);
  return atts ? `${base} | adjuntos: ${clean(atts, 160)}` : base;
}

function allowedSenders(env: Env): Set<string> {
  return new Set(
    (env.INGEST_ALLOWED_SENDERS ?? "")
      .split(",")
      .map(lc)
      .filter(Boolean),
  );
}

function bandsFromEnv(env: Env): Partial<NavBands> {
  const b: Partial<NavBands> = {};
  if (env.NAV_MAX_DAILY_MOVE) {
    const n = Number(env.NAV_MAX_DAILY_MOVE);
    if (Number.isFinite(n) && n > 0) b.maxDailyMove = n;
  }
  return b;
}

/** Alerta por Resend, texto plano (sin HTML ⇒ sin inyección desde el mail). Best-effort. */
async function alert(env: Env, subject: string, text: string): Promise<void> {
  if (!env.RESEND_API_KEY || !env.FUND_ALERT_TO) return;
  const from = env.FUND_ALERT_FROM ?? "BNG Fondo <onboarding@resend.dev>";
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: env.FUND_ALERT_TO.split(",").map((s) => s.trim()).filter(Boolean),
        subject: `[Fondo] ${subject}`,
        text,
      }),
    });
  } catch {
    /* la alerta es best-effort; nunca debe tirar abajo la ingesta */
  }
}

// ── Handler de mail entrante ─────────────────────────────────────────────────
async function handleEmail(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
  const db = env.NAV_DB;
  const nowMs = Date.now();
  const envelope = lc(message.from);
  const headerFrom = extractAddr(message.headers.get("from"));
  const senderHash = hashAddr(headerFrom || envelope);
  const messageId = message.headers.get("message-id") ?? undefined;
  const allow = allowedSenders(env);

  // 1. Allowlist (cuando está configurada). Miss ⇒ drop SILENCIOSO (sin alerta:
  //    no le hacemos backscatter a un remitente posiblemente spoofeado).
  if (allow.size > 0 && !allow.has(envelope) && !allow.has(headerFrom)) {
    await writeAudit(db, {
      actor: "email-worker", channel: "email", action: "ingest",
      decision: "rejected", reason: "sender", senderHash, messageId, nowMs,
    });
    return;
  }

  // 2. Idempotencia: un Message-ID ya procesado no se reprocesa ni re-alerta.
  if (messageId && (await wasSeen(db, messageId))) return;

  // 3. Guarda de tamaño.
  if (message.rawSize > MAX_RAW) {
    await writeAudit(db, {
      actor: "email-worker", channel: "email", action: "ingest",
      decision: "rejected", reason: "parse", senderHash, messageId,
      rawExcerpt: `rawSize ${message.rawSize} > ${MAX_RAW}`, nowMs,
    });
    if (messageId) await markSeen(db, messageId, "rejected", nowMs);
    ctx.waitUntil(alert(env, "Mail del fondo demasiado grande", `rawSize=${message.rawSize}. No se procesó.`));
    return;
  }

  // 4. Parse MIME.
  let parsed: ParsedEmail;
  try {
    parsed = await parseEmail(message.raw);
  } catch (e) {
    await writeAudit(db, {
      actor: "email-worker", channel: "email", action: "ingest",
      decision: "rejected", reason: "parse", senderHash, messageId,
      rawExcerpt: clean(`parse error: ${e instanceof Error ? e.message : String(e)}`, 200), nowMs,
    });
    if (messageId) await markSeen(db, messageId, "rejected", nowMs);
    ctx.waitUntil(alert(env, "No se pudo parsear el mail del fondo", "Falló postal-mime. Revisá fund_audit."));
    return;
  }

  const excerpt = sampleExcerpt(parsed);

  // 5. Extracción. Etapa 3 pendiente ⇒ EXTRACTORS vacío ⇒ logueamos la muestra
  //    para diseñar el parser sobre el mail real, y alertamos.
  const ex = runExtractors(parsed);
  if (!ex || ex.nav == null || !ex.dia) {
    await writeAudit(db, {
      actor: "email-worker", channel: "email", action: "ingest",
      decision: "rejected", reason: ex ? "low_confidence" : "parse",
      strategy: ex?.strategy ?? null, senderHash, messageId, rawExcerpt: excerpt, nowMs,
    });
    if (messageId) await markSeen(db, messageId, "rejected", nowMs);
    ctx.waitUntil(alert(
      env,
      "Mail recibido — parser pendiente (Etapa 3)",
      `Llegó un mail del fondo pero todavía no hay extractor activo. Muestra para diseñar el parser:\n\n${excerpt}`,
    ));
    return;
  }

  // 6. Validación con contexto de serie.
  const prevRow = await getPrevNav(db, ex.dia);
  const existingRow = await getNavRow(db, ex.dia);
  const v = validateNav(
    { dia: ex.dia, nav: ex.nav, aum: ex.aum ?? null, nota: ex.nota ?? null },
    { prevRow, existingRow, nowMs, bands: bandsFromEnv(env) },
  );

  // 6a. Aceptado ⇒ publica (UPSERT + audit + seen en un batch transaccional).
  if (v.ok && v.decision === "accepted") {
    const stmts: D1PreparedStatement[] = [
      upsertNavStmt(db, v.value, { source: "email", messageId, senderHash, nowMs }),
      auditStmt(db, {
        actor: "email-worker", channel: "email", action: "ingest",
        decision: "accepted", reason: "ok", targetDia: v.value.dia,
        parsedNav: v.value.nav, parsedAum: v.value.aum, prevNav: prevRow?.nav ?? null,
        strategy: ex.strategy, senderHash, messageId, nowMs,
      }),
    ];
    if (messageId) stmts.push(seenStmt(db, messageId, "accepted", nowMs));
    await db.batch(stmts);
    ctx.waitUntil(alert(
      env,
      `Valor cuota publicado: ${v.value.dia}`,
      `${v.value.dia} = ${v.value.nav}${v.value.aum != null ? ` · AUM ${v.value.aum}` : ""} (vía mail). Publicado en el sitio.`,
    ));
    return;
  }

  // 6b. Duplicado (mismo valor para un día ya publicado) ⇒ no-op silencioso.
  if (v.ok && v.decision === "duplicate") {
    await writeAudit(db, {
      actor: "email-worker", channel: "email", action: "ingest",
      decision: "duplicate", reason: "ok", targetDia: v.value.dia,
      parsedNav: v.value.nav, strategy: ex.strategy, senderHash, messageId, nowMs,
    });
    if (messageId) await markSeen(db, messageId, "duplicate", nowMs);
    return;
  }

  // 6c. Rechazado (conflicto, banda, fecha, etc.) ⇒ NO publica + alerta.
  const reason = v.ok ? "ok" : v.reason;
  const detail = v.ok ? "" : v.message;
  await writeAudit(db, {
    actor: "email-worker", channel: "email", action: "ingest",
    decision: "rejected", reason, targetDia: ex.dia, parsedNav: ex.nav,
    prevNav: prevRow?.nav ?? null, strategy: ex.strategy, senderHash, messageId,
    rawExcerpt: excerpt, nowMs,
  });
  if (messageId) await markSeen(db, messageId, "rejected", nowMs);
  ctx.waitUntil(alert(
    env,
    `Cuota rechazada (${reason}): ${ex.dia}`,
    `${detail}\n\nNo se publicó; el sitio mantiene la última cuota buena. Si el valor es correcto, corregí el día a mano en D1 (tabla fund_nav) — receta en docs/RUNBOOK-fondo.md.`,
  ));
}

// ── Dead-man-switch (cron) ───────────────────────────────────────────────────
async function handleScheduled(_c: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
  const db = env.NAV_DB;
  const nowMs = Date.now();
  const maxStale = (() => {
    const n = Number(env.DEADMAN_MAX_STALE_DAYS ?? "3");
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3;
  })();

  const last = await db
    .prepare("SELECT MAX(dia) AS dia FROM fund_nav WHERE status = 'live'")
    .first<{ dia: string | null }>();
  const lastDia = last?.dia ?? null;
  // Sin ninguna cuota todavía (pre-lanzamiento): no alertamos — aún no arrancó.
  if (!lastDia) return;

  const staleDays = Math.floor((Date.parse(todayUY(nowMs)) - Date.parse(lastDia)) / 86_400_000);
  if (staleDays > maxStale) {
    await writeAudit(db, {
      actor: "deadman", channel: "cron", action: "deadman_alert",
      decision: "rejected", reason: "stale_date", targetDia: lastDia, nowMs,
    });
    ctx.waitUntil(alert(
      env,
      `Sin valor cuota hace ${staleDays} días`,
      `El último cierre publicado es ${lastDia}. No llegó (o no se pudo procesar) la cuota diaria. Revisá el reenvío del mail y la cola de rechazos en fund_audit (consultas en docs/RUNBOOK-fondo.md).`,
    ));
  }
}

const worker = {
  email: handleEmail,
  scheduled: handleScheduled,
};
export default worker;
