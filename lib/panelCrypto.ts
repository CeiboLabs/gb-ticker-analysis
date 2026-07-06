// Panel de administración — criptografía PURA (contraseñas, TOTP, cifrado).
//
// Cero imports de Next y cero I/O: sólo WebCrypto (crypto.subtle) y
// process.env. A propósito, como lib/fondoIngest.ts: este módulo lo consumen
// las rutas edge (vía lib/panelAuth.ts), los tests de Node
// (scripts/dev-tests/test-panel-auth.ts) y el generador offline de hashes
// (scripts/panel-hash-password.mts) — WebCrypto es global en ambos runtimes.
//
// Postura de seguridad:
// - PEPPER: las contraseñas pasan por HMAC-SHA256(PANEL_PEPPER, pw) ANTES del
//   PBKDF2. Un dump de D1 solo no alcanza para crackear offline: falta el
//   secret que vive en Cloudflare. Sin PANEL_PEPPER todo es fail-closed
//   (PanelConfigError → las rutas responden 503).
// - Hash autodescriptivo 'pbkdf2-sha256$<iters>$<salt>$<dk>': el costo vive en
//   la fila. Si el plan de Workers no banca 100k iteraciones (error 1102), se
//   baja PANEL_PBKDF2_ITERS y needsRehash() normaliza en el próximo login.
// - TOTP RFC 6238 con anti-replay por timestep (el caller persiste el último
//   step consumido) y secret cifrado at-rest (AES-GCM, clave derivada del pepper).

export class PanelConfigError extends Error {}

// ── Comparación constant-time ────────────────────────────────────────────────

// Movida desde lib/adminAuth.ts (que ahora la re-importa de acá) para que el
// núcleo puro no dependa de next/server. Devuelve false ante largos distintos
// pero igual itera, así el tiempo depende del valor que tiene el server, no de
// qué tan cerca está el intento del atacante.
export function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0);
  }
  return diff === 0;
}

/** Ídem para buffers (los derived keys del PBKDF2). */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ── Config por env (defaults y bounds sanos) ─────────────────────────────────

function intEnv(name: string, def: number, min: number, max: number): number {
  const n = parseInt(process.env[name] ?? String(def), 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : def;
}

/** Iteraciones PBKDF2 objetivo para hashes NUEVOS (los viejos llevan las suyas). */
export function targetIters(): number {
  return intEnv("PANEL_PBKDF2_ITERS", 100_000, 10_000, 2_000_000);
}

/** Fail-closed: sin pepper (o con uno ridículamente corto) el panel no opera. */
function requirePepper(): string {
  const p = process.env.PANEL_PEPPER;
  if (!p || p.length < 16) {
    throw new PanelConfigError("PANEL_PEPPER ausente o demasiado corto (mínimo 16 chars)");
  }
  return p;
}

export function panelConfigured(): boolean {
  const p = process.env.PANEL_PEPPER;
  return !!p && p.length >= 16;
}

// ── Helpers binarios ─────────────────────────────────────────────────────────

const te = new TextEncoder();
const td = new TextDecoder();

export function b64u(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64uDecode(s: string): Uint8Array | null {
  try {
    const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function hmac(hash: "SHA-256" | "SHA-1", keyBytes: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", keyBytes as BufferSource, { name: "HMAC", hash }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, msg as BufferSource));
}

export async function sha256Hex(s: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", te.encode(s)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Contraseñas: PBKDF2-SHA256 + pepper ──────────────────────────────────────

const PW_ALG = "pbkdf2-sha256";
const PW_SALT_LEN = 16;
const PW_DK_LEN = 32;

/** HMAC-SHA256(pepper, password): lo que realmente entra al PBKDF2. */
async function pepperedPassword(password: string): Promise<Uint8Array> {
  return hmac("SHA-256", te.encode(requirePepper()), te.encode(password));
}

async function pbkdf2(passBytes: Uint8Array, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", passBytes as BufferSource, "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    PW_DK_LEN * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, iterations: number = targetIters()): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PW_SALT_LEN));
  const dk = await pbkdf2(await pepperedPassword(password), salt, iterations);
  return `${PW_ALG}$${iterations}$${b64u(salt)}$${b64u(dk)}`;
}

/** Verifica contra el formato almacenado (usa los parámetros DE LA FILA, no los actuales). */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== PW_ALG) return false;
  const iterations = parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations < 1_000 || iterations > 5_000_000) return false;
  const salt = b64uDecode(parts[2]);
  const dk = b64uDecode(parts[3]);
  if (!salt || !dk || dk.length !== PW_DK_LEN) return false;
  const derived = await pbkdf2(await pepperedPassword(password), salt, iterations);
  return bytesEqual(derived, dk);
}

/** true si el hash almacenado no está en el costo objetivo actual (re-hash on login). */
export function needsRehash(stored: string): boolean {
  const parts = stored.split("$");
  return parts.length !== 4 || parts[0] !== PW_ALG || parseInt(parts[1], 10) !== targetIters();
}

// Hash señuelo para cuando el email NO existe: se verifica igual, así el tiempo
// de respuesta no delata qué cuentas existen. Se construye lazy con el costo
// objetivo VIGENTE (un señuelo fijo con otras iteraciones reabriría la
// diferencia de timing) y se cachea por isolate.
let dummyHashPromise: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  if (!dummyHashPromise) dummyHashPromise = hashPassword("panel-dummy-timing-equalizer");
  return dummyHashPromise;
}

// ── TOTP RFC 6238 (SHA-1, 6 dígitos, período 30 s) ───────────────────────────

export const TOTP_STEP_MS = 30_000;
const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Uint8Array | null {
  const clean = s.trim().toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  if (!clean || /[^A-Z2-7]/.test(clean)) return null;
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    value = (value << 5) | B32_ALPHABET.indexOf(clean[i]);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** Secret nuevo para enrolar: 20 bytes aleatorios (tamaño canónico SHA-1) en base32. */
export function generateTotpSecret(): string {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

/** URL otpauth:// para el QR y el alta manual en la app autenticadora. */
export function otpauthUrl(email: string, secretB32: string): string {
  const issuer = encodeURIComponent("Panel Bengochea");
  return `otpauth://totp/${issuer}:${encodeURIComponent(email)}?secret=${secretB32}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

/** Código HOTP/TOTP de 6 dígitos para un timestep dado. */
export async function totpCode(secretB32: string, step: number): Promise<string> {
  const key = base32Decode(secretB32);
  if (!key || key.length === 0) throw new Error("Secret TOTP inválido");
  const msg = new Uint8Array(8);
  const dv = new DataView(msg.buffer);
  dv.setUint32(0, Math.floor(step / 0x1_0000_0000));
  dv.setUint32(4, step >>> 0);
  const mac = await hmac("SHA-1", key, msg);
  const off = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

/**
 * Verifica un código con ventana ±1 step (90 s de tolerancia de reloj) y
 * ANTI-REPLAY: sólo acepta timesteps estrictamente posteriores al último
 * consumido (el caller persiste `step` con bumpTotpStep). Evalúa los tres
 * timesteps siempre — sin early-return — para no filtrar por timing cuál matcheó.
 */
export async function verifyTotp(
  secretB32: string,
  code: string,
  lastUsedStep: number,
  nowMs: number = Date.now(),
): Promise<{ ok: true; step: number } | { ok: false }> {
  if (!/^\d{6}$/.test(code)) return { ok: false };
  const current = Math.floor(nowMs / TOTP_STEP_MS);
  let matched: number | null = null;
  for (const delta of [-1, 0, 1]) {
    const step = current + delta;
    const expected = await totpCode(secretB32, step);
    if (timingSafeEqual(expected, code) && step > lastUsedStep && matched === null) {
      matched = step;
    }
  }
  return matched === null ? { ok: false } : { ok: true, step: matched };
}

// ── Secret TOTP at-rest: AES-GCM-256 con clave derivada del pepper ───────────

async function totpEncKey(): Promise<CryptoKey> {
  const raw = await hmac("SHA-256", te.encode(requirePepper()), te.encode("totp-key-v1"));
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, await totpEncKey(), te.encode(plain)),
  );
  return `enc$${b64u(iv)}$${b64u(ct)}`;
}

/** null si el formato es inválido o la clave no corresponde (pepper rotado). */
export async function decryptSecret(stored: string): Promise<string | null> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "enc") return null;
  const iv = b64uDecode(parts[1]);
  const ct = b64uDecode(parts[2]);
  if (!iv || !ct || iv.length !== 12) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      await totpEncKey(),
      ct as BufferSource,
    );
    return td.decode(plain);
  } catch {
    return null;
  }
}
