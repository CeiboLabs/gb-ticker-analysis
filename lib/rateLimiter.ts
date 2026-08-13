// Rate-limit counters. Two tiers:
//
// 1. DURABLE (D1, table `rate_limits`) — the gates that guard real money or
//    auth: analyze IP/daily-fresh and failed admin logins. Counters are
//    fixed windows incremented with an atomic UPSERT, so they survive
//    isolate recycling: an F5 that lands on a fresh Cloudflare isolate sees
//    the same count as the request that tripped the 429.
//
// 2. IN-MEMORY (per-isolate Map) — high-volume public GETs (search type-ahead,
//    quote polling, logos). A D1 write per keystroke would cost more than the
//    abuse it prevents; the Yahoo outbound throttle is the real guard there.
//    Also the fallback when the METRICS_DB binding is missing (local dev).

import { after } from "next/server";
import { getMetricsDb, purgeExpiredRows } from "@/lib/metrics";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS  = 24 * 60 * 60 * 1000;

// "Mañana" para el cap diario significa medianoche Uruguay (UTC-3, sin DST),
// no medianoche UTC — mismo criterio que usa el dashboard de métricas.
const UY_OFFSET_MS = 3 * 60 * 60 * 1000;

// All analyze gates are keyed by IP — never by anything the client can mint
// itself (cookies, headers, body). A cookie-keyed bucket is a bucket the
// attacker rotates for free; the IP is the only request attribute the client
// can't cheaply choose. Shared NATs get headroom via the allowlist
// multiplier, not by trusting client state.
//
// Defaults are derived, not guessed. System ceiling at OpenAI Tier 2
// (450k TPM / 12k tokens per analysis ≈ 2,250/h) is bound by Yahoo: at
// 1 req/s sustained (yfinance maintainer's recommendation) and ~7 Yahoo
// calls per analysis, the worker can sustain ~510 analyses/h. 100/h per IP
// stays far above any honest single user without letting one address
// monopolize the worker.
const HOURLY_IP_MAX = parseInt(process.env.RATE_LIMIT_IP_MAX ?? "100", 10);
const DAILY_FRESH_MAX = parseInt(process.env.RATE_LIMIT_DAILY_FRESH_MAX ?? "50", 10);

// GLOBAL daily ceiling on fresh analyses across ALL IPs — the only barrier a
// distributed attacker (rotating IPs / botnet) cannot sidestep, since every
// per-IP gate is, by definition, per-IP. Each fresh analysis bills OpenAI, so
// this is the hard cap on total daily OpenAI spend. Sized well above honest
// aggregate traffic for an institutional tool but far below a runaway bill:
// 1500 × ~$0.06 ≈ $90/day worst case. Tune via env as real traffic grows.
// No allowlist, no per-IP scaling — it's a money kill-switch, not a fairness
// knob. Window resets at midnight Uruguay, same as the per-IP daily cap.
const GLOBAL_DAILY_FRESH_MAX = parseInt(process.env.RATE_LIMIT_GLOBAL_DAILY_MAX ?? "1500", 10);

// Allowlisted IPs (corporate NATs) get N× the analyze caps instead of a full
// bypass — a single abusive browser inside a "trusted" office still hits a
// ceiling.
const ALLOWLIST_MULTIPLIER = parseInt(process.env.RATE_LIMIT_ALLOWLIST_MULTIPLIER ?? "10", 10);

// Per-IP, per-endpoint hourly cap for public GETs. Type-ahead search and
// quote polling fan out quickly: a 10-user office easily generates >1k
// calls/h on a single endpoint. The Yahoo outbound throttle (1 req/s ≈
// 3,600 calls/h per worker) is the real cost guard upstream — these
// per-IP caps just prevent cookie-less abuse without punishing NATs.
export const PUBLIC_LIMIT_DEFAULT = parseInt(process.env.PUBLIC_LIMIT_DEFAULT ?? "1500", 10);
// Logo endpoint fans out per-ticker on list views and is heavily cached
// downstream; allow ~2x the default to accommodate a popular-tickers grid.
export const PUBLIC_LIMIT_LOGO = parseInt(process.env.PUBLIC_LIMIT_LOGO ?? "3000", 10);

// Allowlist of trusted egress IPs (typically corporate NATs where many real
// users share a single outbound address). For analyze gates they get the
// multiplier above; for cheap public GETs they bypass the in-memory cap
// entirely. Comma-separated, no spaces required (we trim).
const IP_ALLOWLIST = new Set(
  (process.env.RATE_LIMIT_IP_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

export function isIpAllowlisted(ip: string | null): boolean {
  return !!ip && IP_ALLOWLIST.has(ip);
}

interface Gate {
  allowed: boolean;
  retryAfter: number;
}

interface Entry {
  count: number;
  windowStart: number;
}

const store = new Map<string, Entry>();

function check(key: string, max: number, windowMs: number): Gate {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= max) {
    const retryAfter = Math.ceil((windowMs - (now - entry.windowStart)) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count += 1;
  return { allowed: true, retryAfter: 0 };
}

// Durable fixed-window counter in D1. One atomic UPSERT per call: insert the
// window row or bump its count, read the result back in the same statement.
// Concurrent requests on different isolates serialize in D1, so the count is
// authoritative — no per-isolate drift, no reset on F5.
//
// windowOffsetMs shifts the window boundary (e.g. UY midnight for the daily
// cap). Falls back to the in-memory check when the binding is missing (local
// dev) or D1 errors — the limiter must never take the endpoint down with it.
async function checkDurable(
  key: string,
  max: number,
  windowMs: number,
  windowOffsetMs = 0,
): Promise<Gate> {
  const db = getMetricsDb();
  if (!db) return check(key, max, windowMs);

  const now = Date.now();
  const windowStart = Math.floor((now - windowOffsetMs) / windowMs) * windowMs + windowOffsetMs;
  try {
    const row = await db
      .prepare(
        "INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) " +
        "ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1 " +
        "RETURNING count"
      )
      .bind(key, windowStart)
      .first<{ count: number }>();
    const count = row?.count ?? 1;
    // Opportunistic retention: the first request that opens a NEW daily
    // window also purges expired rows (events past retention + dead
    // rate-limit windows). Pages has no native crons; this keeps both tables
    // bounded with zero external infra. Runs after the response, never
    // blocks, failures are swallowed.
    if (count === 1 && windowMs === DAY_MS) {
      after(() => purgeExpiredRows(db).catch(() => {}));
    }
    if (count > max) {
      return { allowed: false, retryAfter: Math.ceil((windowStart + windowMs - now) / 1000) };
    }
    return { allowed: true, retryAfter: 0 };
  } catch {
    return check(key, max, windowMs);
  }
}

// Effective cap for an IP: allowlisted NATs get the multiplier, everyone
// else the base. Never a bypass — every IP has *some* ceiling.
function effectiveMax(ip: string, base: number): number {
  return isIpAllowlisted(ip) ? base * ALLOWLIST_MULTIPLIER : base;
}

// Per-IP 1h window over ALL analyze requests (fresh + would-be-fresh).
// Requests with no resolvable IP (never happens behind Cloudflare) share a
// single conservative bucket instead of skipping the gate.
export function checkIpHourlyLimit(ip: string | null): Promise<Gate> {
  if (!ip) return checkDurable("hrip:noip", HOURLY_IP_MAX, HOUR_MS);
  return checkDurable(`hrip:${ip}`, effectiveMax(ip, HOURLY_IP_MAX), HOUR_MS);
}

// Daily cap on *fresh* analyses (cache misses) per IP. Caches still serve
// freely; this purely caps the OpenAI/upstream-fanout cost an attacker can
// burn by rotating tickers. Window resets at midnight Uruguay.
export function checkDailyFreshLimit(ip: string | null): Promise<Gate> {
  if (!ip) return checkDurable("dfresh:noip", DAILY_FRESH_MAX, DAY_MS, UY_OFFSET_MS);
  return checkDurable(`dfresh:${ip}`, effectiveMax(ip, DAILY_FRESH_MAX), DAY_MS, UY_OFFSET_MS);
}

// Contact form: 5 envíos/h por IP, durable. Bajo a propósito — nadie
// legítimo manda más de un puñado de consultas comerciales por hora, y cada
// envío dispara un email.
const CONTACT_HOURLY_MAX = parseInt(process.env.RATE_LIMIT_CONTACT_MAX ?? "5", 10);
export function checkContactLimit(ip: string | null): Promise<Gate> {
  return checkDurable(`contact:${ip ?? "noip"}`, CONTACT_HOURLY_MAX, HOUR_MS);
}

// Newsletter: 5 altas/h por IP, durable. Nadie legítimo se suscribe más de una
// vez; el cap corta el alta masiva de mails basura sin castigar al usuario real.
const NEWSLETTER_HOURLY_MAX = parseInt(process.env.RATE_LIMIT_NEWSLETTER_MAX ?? "5", 10);
export function checkNewsletterLimit(ip: string | null): Promise<Gate> {
  return checkDurable(`newsletter:${ip ?? "noip"}`, NEWSLETTER_HOURLY_MAX, HOUR_MS);
}

// Seguimiento de acciones: 60 escrituras/h por IP, durable y en su PROPIO
// balde. Antes compartía el del newsletter (5/h) y eso estaba mal por dos
// motivos distintos:
//   · No es un alta: `visto` se escribe en CADA vista de un informe seguido, así
//     que un lector normal con tres acciones seguidas agotaba el cupo navegando.
//     Al agotarlo, seguir y dejar de seguir empezaban a fallar en silencio.
//   · Compartir balde con el newsletter significa que unos pocos POST a /follow
//     bloqueaban el alta al newsletter desde la misma IP — y al revés.
// 60/h sigue siendo un techo real (el endpoint además exige cookie de lead), pero
// deja de castigar a la oficina entera detrás de un NAT compartido.
const FOLLOW_HOURLY_MAX = parseInt(process.env.RATE_LIMIT_FOLLOW_MAX ?? "60", 10);
export function checkFollowLimit(ip: string | null): Promise<Gate> {
  return checkDurable(`follow:${ip ?? "noip"}`, effectiveMax(ip ?? "noip", FOLLOW_HOURLY_MAX), HOUR_MS);
}

// GLOBAL daily cap on fresh analyses across every IP. One shared durable
// counter (key "gdfresh:all") incremented once per fresh analysis, regardless
// of source IP. When it trips, EVERY caller gets 503 until midnight Uruguay —
// the backstop against IP rotation that the per-IP gates can't provide. Falls
// back to the in-memory check when D1 is absent (local dev). Returns allowed
// when there's no usable counter rather than failing closed, so a D1 outage
// degrades to "per-IP gates only" instead of taking analyze offline.
export function checkGlobalDailyFreshLimit(): Promise<Gate> {
  return checkDurable("gdfresh:all", GLOBAL_DAILY_FRESH_MAX, DAY_MS, UY_OFFSET_MS);
}

// Brute-force cap on FAILED auth attempts, per IP, per credential. Durable on
// purpose: an in-memory bucket let an attacker reset their budget by rotating
// isolates (or just waiting for a redeploy). No allowlist bypass here — auth
// guessing from a "trusted" NAT is still auth guessing. `keyPrefix` separates
// the buckets per credential (e.g. 'adminfail' for the metrics dashboard token)
// so spraying one doesn't starve another.
//
// SIN IP el gate NO se saltea: cae a un balde compartido (`:noip`). Antes
// devolvía allowed:true, y como `trustedClientIp` sólo confía en
// `cf-connecting-ip`, fuera de Cloudflare eso dejaba el lockout entero apagado
// — justo el escenario del home server, donde Tailscale Funnel ni siquiera
// expone la IP pública del visitante al backend (tailscale/tailscale#12972).
//
// El techo compartido es MUY superior al de por-IP, y el motivo es que este
// gate se consume en CADA intento, no sólo en los fallidos (ver el comentario
// de app/api/admin/panel/auth/login/route.ts:77). Con un balde compartido
// angosto, cualquiera que queme el cupo deja al panel sin login para todos: un
// DoS de una línea. Por eso el default es ~17× el de por-IP.
//
// Y lo que este balde protege no es la contraseña sino la CPU: el gate de POR
// CUENTA (10 fallas/h, keyed por hash del email) es el que acota el guessing, y
// ese no depende de la IP, así que sigue entero incluso sin ella. Acá lo que se
// acota es el PBKDF2 que un anónimo puede hacer quemar por hora.
const NOIP_AUTH_HOURLY_MAX = parseInt(process.env.RATE_LIMIT_NOIP_AUTH_MAX ?? "500", 10);
export function checkFailedAuthLimit(ip: string | null, max: number, keyPrefix: string): Promise<Gate> {
  if (!ip) return checkDurable(`${keyPrefix}:noip`, NOIP_AUTH_HOURLY_MAX, HOUR_MS);
  return checkDurable(`${keyPrefix}:${ip}`, max, HOUR_MS);
}

// Descargas de archivos: los PDF de informes y del fondo, y la media proxeada.
// Es el único gate con DOS techos a la vez, porque cada uno cubre un agujero
// que el otro no:
//
//   · por IP  — reparte con justicia entre visitantes. Un lector abre dos o
//               tres PDF; 60/h no lo roza. Sólo existe si hay IP que mirar.
//   · GLOBAL  — el techo de gasto, y el ÚNICO que queda en pie cuando no hay
//               IP: hoy, el home server (Funnel, ver arriba).
//
// Sin IP no hay reparto posible —no existe con qué distinguir un cliente de
// otro— y pretenderlo con un balde `:noip` sería teatro: tendría que tener la
// misma capacidad que el global y se agotaría junto con él. Así que sin IP
// queda el techo global solo, que es exactamente lo que se puede prometer.
//
// Dimensionado por ancho de banda, no por requests: los PDF pesan 300-700 KB,
// así que 1000/h global es un techo de ~500 MB/h contra los ~26 GB/h que se
// midieron sin límite alguno. Durable a propósito — son pocas y caras, y un
// contador en memoria se reinicia con cada deploy.
const DOWNLOAD_IP_HOURLY_MAX = parseInt(process.env.RATE_LIMIT_DOWNLOAD_IP_MAX ?? "60", 10);
const DOWNLOAD_GLOBAL_HOURLY_MAX = parseInt(process.env.RATE_LIMIT_DOWNLOAD_GLOBAL_MAX ?? "1000", 10);

export interface DownloadGate extends Gate {
  /** `true` cuando lo que se agotó es el techo global, no el del visitante.
   *  El caller responde 503 en vez de 429: no es culpa de quien pide. */
  global: boolean;
}

export async function checkDownloadLimit(endpoint: string, ip: string | null): Promise<DownloadGate> {
  // El global se consulta DESPUÉS: a quien ya rebotó por su propio cupo no se
  // le cobra presupuesto global.
  if (ip) {
    const porIp = await checkDurable(`dl:${endpoint}:${ip}`, effectiveMax(ip, DOWNLOAD_IP_HOURLY_MAX), HOUR_MS);
    if (!porIp.allowed) return { ...porIp, global: false };
  }
  const global = await checkDurable("dl:all", DOWNLOAD_GLOBAL_HOURLY_MAX, HOUR_MS);
  return { ...global, global: !global.allowed };
}

// Compat: el gate de admin es el caso particular con prefijo 'adminfail'.
export function checkAdminFailedAuthLimit(ip: string | null, max: number): Promise<Gate> {
  return checkFailedAuthLimit(ip, max, "adminfail");
}

// Generic per-IP, per-endpoint hourly limiter for read-only public GETs
// (chart-range, quotes, search, popular). Each endpoint gets its own bucket,
// keyed by IP, so a noisy caller on /search doesn't deny /chart-range.
// Allowlisted IPs (corporate NATs) bypass the cap. Deliberately in-memory:
// these endpoints are cheap and high-volume — see header comment.
//
// Sin IP cae a un balde compartido por endpoint en vez de saltear el gate. El
// factor es alto a propósito: cuando no hay IP, TODO el tráfico honesto entra
// al mismo balde, así que un techo angosto sería un DoS contra los propios
// lectores. 20× el cupo individual (30.000/h en los endpoints por defecto,
// 60.000/h en logo) queda muy por encima del agregado real de este sitio y aun
// así pone un techo donde antes no había ninguno.
const PUBLIC_LIMIT_NOIP_FACTOR = parseInt(process.env.PUBLIC_LIMIT_NOIP_FACTOR ?? "20", 10);

export function checkPublicGetLimit(
  endpoint: string,
  ip: string | null,
  max: number,
): Gate {
  if (!ip) return check(`pub:${endpoint}:noip`, max * PUBLIC_LIMIT_NOIP_FACTOR, HOUR_MS);
  if (isIpAllowlisted(ip)) return { allowed: true, retryAfter: 0 };
  return check(`pub:${endpoint}:${ip}`, max, HOUR_MS);
}

// Azúcar para los route handlers: devuelve el 429 ya armado, o `null` si el
// pedido pasa. Existe porque el patrón se repite en una docena de rutas y
// copiado a mano se degrada — la vez que alguien se olvide el `Retry-After`,
// el cliente no tiene forma de saber cuándo reintentar y se queda martillando.
//
// Se le pasa la IP ya resuelta y no el Request, porque hay un caller que NO
// tiene Request: las rutas de convención de archivo (opengraph-image.tsx)
// reciben sólo `{ params }` y tienen que poder pedir el balde compartido
// pasando `null` a propósito.
export function reboteGetPublico(
  endpoint: string,
  ip: string | null,
  max: number = PUBLIC_LIMIT_DEFAULT,
): Response | null {
  const gate = checkPublicGetLimit(endpoint, ip, max);
  if (gate.allowed) return null;
  return new Response("rate limited", {
    status: 429,
    headers: { "Retry-After": String(gate.retryAfter), "Cache-Control": "no-store" },
  });
}

// Convenience: pull the client IP off a Request for CHEAP public GETs and
// best-effort analytics. Falls back to spoofable proxy headers, which is fine
// for in-memory per-endpoint GET buckets (worst case an attacker gets their
// own bucket) but NEVER acceptable as a key for money/auth gates — use
// trustedClientIp for those.
export function clientIpFrom(req: { headers: { get(name: string): string | null } }): string | null {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

// IP key for SECURITY gates (analyze cost caps, admin brute-force). Trusts ONLY
// cf-connecting-ip — set by Cloudflare's edge, unforgeable by the client. The
// x-forwarded-for / x-real-ip fallbacks are deliberately omitted: those are
// client-controllable, so keying a rate limit on them lets an attacker mint a
// fresh "IP" per request (X-Forwarded-For: <random>) and dodge the limit
// entirely. Returns null when cf-connecting-ip is absent; callers route null
// into a single shared conservative bucket instead of trusting a spoofed value.
//
// Home server: sin Cloudflare adelante no existe cf-connecting-ip. Si (y SOLO
// si) el server corre detrás de un reverse proxy PROPIO que pisa/setea
// X-Forwarded-For (nginx/caddy con set_header), TRUSTED_PROXY=1 habilita ese
// header como fuente. Jamás setearlo con el puerto expuesto directo a internet:
// volvería el header spoofeable y el lockout, esquivable.
export function trustedClientIp(req: { headers: { get(name: string): string | null } }): string | null {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;
  if (process.env.TRUSTED_PROXY === "1") {
    return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  }
  return null;
}
