// Gate de captura de mail de /analisis — token firmado, sin login ni sesión.
//
// POR QUÉ ACÁ Y NO DELANTE DEL REPORTE: el costo de la plataforma es por
// ANÁLISIS FRESCO (una llamada paga a GPT-4o de 40-90 s), no por lectura — un
// cache hit no toca ningún upstream y sale gratis. Poner el peaje delante del
// reporte mataría el tráfico sin ahorrar un peso; ponerlo delante de la
// generación cobra exactamente donde duele, y encima en el momento de máxima
// intención (la persona ya tipeó el ticker). El orden exacto vive en
// app/api/analyze/route.ts §2b-pre.
//
// POSTURA DE SEGURIDAD — deliberadamente distinta a la del panel:
//
//   · Esto NO es control de acceso, es un peaje comercial. Un token forjado no
//     expone datos de nadie: sólo saltea un formulario. Por eso alcanza un HMAC
//     stateless (cero I/O, cero tabla de sesiones) en lugar del esquema con
//     filas, revocación y vencimiento por inactividad de lib/panelAuth.ts.
//
//   · FAIL-OPEN, al revés que el panel (que tira PanelConfigError → 503). Sin
//     LEAD_GATE_SECRET el gate se apaga y /analisis sigue funcionando normal:
//     una variable de entorno faltante no puede tumbar el producto por un
//     formulario de mails. Se reporta el error una vez para que no pase
//     inadvertido — un gate silenciosamente abierto es peor que uno roto.
//
//   · El token es HttpOnly y firmado, pero NO es un secreto: lleva el mail en
//     claro, que es dato de la propia persona y que ya nos dio. Va sin hashear
//     a propósito, porque la capa 2 (verificación por click) va a necesitar
//     resolver `verified` POR DIRECCIÓN contra newsletter_subscribers.

import { b64u, b64uDecode, timingSafeEqual } from "@/lib/panelCrypto";
import { reportError } from "@/lib/errorReporter";

const TOKEN_VERSION = "v1";
const te = new TextEncoder();
const td = new TextDecoder();

export type LeadIdentity = {
  email: string;
  issuedAt: number;
  /**
   * Capa 2 (todavía no implementada): el mail se confirmó con un click. Hoy
   * siempre false — el campo ya viaja en el payload v1 para que activar la
   * verificación no obligue a cambiar el formato del token ni a invalidar los
   * que ya estén en la calle.
   */
  verified: boolean;
};

// ── Config por env ───────────────────────────────────────────────────────────

function intEnv(name: string, def: number, min: number, max: number): number {
  const n = parseInt(process.env[name] ?? String(def), 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : def;
}

/**
 * Vida del token. Es un marcador de identidad, no una sesión: default 1 año.
 * Que alguien tenga que volver a dejar el mail cada 12 h sería absurdo.
 */
export function leadTokenTtlMs(): number {
  return intEnv("LEAD_GATE_TTL_DAYS", 365, 1, 3650) * 24 * 60 * 60 * 1000;
}

function secret(): string | null {
  const s = process.env.LEAD_GATE_SECRET;
  return s && s.length >= 16 ? s : null;
}

let warnedMissingSecret = false;

/**
 * ¿Puede operar el gate? Sin secret devuelve false (⇒ el peaje no se aplica) y
 * avisa UNA vez por proceso, para no inundar el reporter en cada análisis.
 */
export function leadGateConfigured(): boolean {
  if (secret() !== null) return true;
  if (!warnedMissingSecret) {
    warnedMissingSecret = true;
    reportError(
      "leadGate/config",
      new Error("LEAD_GATE_SECRET ausente o de menos de 16 chars — el gate de /analisis queda ABIERTO"),
    );
  }
  return false;
}

// ── Token ────────────────────────────────────────────────────────────────────

async function sign(msg: string, key: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw",
    te.encode(key) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", k, te.encode(msg) as BufferSource)));
}

/**
 * Emite el token para un mail recién anotado. Devuelve null si el gate no está
 * configurado — el caller simplemente no manda la cookie.
 */
export async function issueLeadToken(email: string, verified = false): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  const payload = b64u(te.encode(JSON.stringify({ e: email, t: Date.now(), v: verified ? 1 : 0 })));
  const body = `${TOKEN_VERSION}.${payload}`;
  return `${body}.${await sign(body, key)}`;
}

/**
 * Valida firma + vencimiento. Devuelve la identidad o null; NUNCA tira, porque
 * un token corrupto tiene que degradar a "mostrale el formulario", no a 500.
 */
export async function verifyLeadToken(token: string | null | undefined): Promise<LeadIdentity | null> {
  const key = secret();
  if (!key || !token) return null;

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;
  const [, payload, sig] = parts;

  // Constant-time sobre el b64u — comparar strings acá alcanza: lo que se
  // protege es el secret, no el contenido del payload (que es del usuario).
  const expected = await sign(`${TOKEN_VERSION}.${payload}`, key);
  if (!timingSafeEqual(sig, expected)) return null;

  const raw = b64uDecode(payload);
  if (!raw) return null;

  let obj: { e?: unknown; t?: unknown; v?: unknown };
  try {
    obj = JSON.parse(td.decode(raw));
  } catch {
    return null;
  }

  const email = typeof obj.e === "string" ? obj.e : null;
  const issuedAt = typeof obj.t === "number" && Number.isFinite(obj.t) ? obj.t : null;
  if (!email || issuedAt === null) return null;
  if (Date.now() - issuedAt > leadTokenTtlMs()) return null;

  return { email, issuedAt, verified: obj.v === 1 };
}

// ── Cookie ───────────────────────────────────────────────────────────────────

// Mismo interruptor de dev que el panel (lib/panelAuth.ts): __Host- exige
// Secure, y algún entorno local sirve http. El dev normal del proyecto es
// https://localhost:3000, así que por defecto va con prefijo y Secure.
function insecureCookieMode(): boolean {
  return process.env.PANEL_COOKIE_INSECURE === "1";
}

export function leadCookieName(): string {
  return insecureCookieMode() ? "bng_lead" : "__Host-bng_lead";
}

export function buildLeadCookie(token: string): string {
  const parts = [
    `${leadCookieName()}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(leadTokenTtlMs() / 1000)}`,
  ];
  if (!insecureCookieMode()) parts.push("Secure");
  return parts.join("; ");
}
