// Login del panel de empleados — single-shot: email + contraseña + código TOTP
// en un solo POST. Sin TOTP enrolado (o con clave temporal) emite una sesión
// scope='setup' que sólo habilita /admin/configurar-acceso.
//
// Anti-abuso, en orden: origin guard → gate durable por IP (30/h, consumido en
// CADA intento para acotar el costo PBKDF2 que un atacante puede quemar) →
// verificación → gate durable por CUENTA (10 fallas/h, keyed por hash del email
// ENVIADO, exista o no — no revela cuentas) sólo en fallas. La respuesta de
// error es SIEMPRE el mismo 401 "credenciales": ni el password correcto con
// TOTP malo, ni la cuenta deshabilitada, ni el email inexistente se distinguen
// (contra el inexistente se verifica un hash señuelo para igualar el timing).

import { NextRequest, NextResponse } from "next/server";
import { getMetricsDb, eventBaseFromRequest } from "@/lib/metrics";
import { checkFailedAuthLimit, trustedClientIp } from "@/lib/rateLimiter";
import { originOk, createSession, panelHabilitado } from "@/lib/panelAuth";
import {
  panelConfigured,
  verifyPassword,
  dummyPasswordHash,
  needsRehash,
  hashPassword,
  verifyTotp,
  decryptSecret,
  sha256Hex,
} from "@/lib/panelCrypto";
import {
  getUserByEmail,
  setPassword,
  bumpTotpStep,
  purgeExpiredSessions,
  writePanelAudit,
} from "@/lib/panelStore";
import { LoginSchema } from "@/lib/panelSchemas";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Fallas de login por IP por hora. Generoso para una oficina detrás de un NAT
// (varios empleados comparten IP), letal para un sprayer.
const LOGIN_IP_HOURLY_MAX = 30;
// Fallas por cuenta por hora (protege una cuenta puntual del guessing distribuido).
const LOGIN_ACCOUNT_HOURLY_MAX = 10;

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "credenciales" }, { status: 401, headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  // Panel cerrado ⇒ acá no se entra. Es una de las DOS rutas del panel que no
  // pasan por `requirePanelSession` (no hay sesión todavía), o sea justo la
  // superficie de credenciales. 404 y no 403: no confirmar que existe.
  if (!panelHabilitado()) {
    return NextResponse.json({ error: "no_encontrado" }, { status: 404, headers: NO_STORE });
  }
  if (!originOk(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: NO_STORE });
  }
  const db = getMetricsDb();
  if (!db || !panelConfigured()) {
    return NextResponse.json(
      { error: "sin_bindings", detalle: "Panel sin D1/PANEL_PEPPER — en local usá `npm run pages:preview`." },
      { status: 503, headers: NO_STORE },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }
  const { email, password, totp } = parsed.data;
  const ip = trustedClientIp(req);
  const ipHash = eventBaseFromRequest(req).ipHash;
  const nowMs = Date.now();

  // Gate por IP ANTES de verificar: cada intento (bueno o malo) consume. Acota
  // el PBKDF2 que se puede quemar desde una IP aunque todos los intentos fallen.
  const ipGate = await checkFailedAuthLimit(ip, LOGIN_IP_HOURLY_MAX, "panelfail");
  if (!ipGate.allowed) {
    await writePanelAudit(db, {
      ipHash, section: "auth", action: "login", target: email,
      decision: "rejected", detail: { reason: "rate_limited_ip" }, nowMs,
    });
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(ipGate.retryAfter) } },
    );
  }

  // Bucket por cuenta, keyed por hash del email ENVIADO (exista o no la cuenta:
  // el 429 no confirma nada). Se consume sólo en fallas.
  const accountKey = (await sha256Hex(`panel-login:${email}`)).slice(0, 32);
  const failAccount = async (reason: string): Promise<NextResponse> => {
    const acctGate = await checkFailedAuthLimit(accountKey, LOGIN_ACCOUNT_HOURLY_MAX, "panelfailu");
    await writePanelAudit(db, {
      ipHash, section: "auth", action: "login", target: email,
      decision: "rejected", detail: { reason }, nowMs,
    });
    if (!acctGate.allowed) {
      return NextResponse.json(
        { error: "rate_limited" },
        { status: 429, headers: { ...NO_STORE, "Retry-After": String(acctGate.retryAfter) } },
      );
    }
    return unauthorized();
  };

  const user = await getUserByEmail(db, email);
  // Sin usuario se verifica igual contra un hash señuelo: mismo costo, mismo
  // tiempo, misma respuesta — el endpoint no enumera cuentas.
  const pwOk = await verifyPassword(password, user?.password_hash ?? (await dummyPasswordHash()));
  if (!user || !pwOk) return failAccount("credenciales");
  if (user.status !== "active") return failAccount("deshabilitado");

  // Primer acceso o clave temporal: sesión restringida al flujo de setup.
  if (user.must_change_password === 1 || user.totp_secret == null) {
    const { setCookie } = await createSession(db, user.id, "setup", req, nowMs);
    await writePanelAudit(db, {
      actorId: user.id, actorEmail: user.email, ipHash, section: "auth", action: "login",
      decision: "ok", detail: { scope: "setup" }, nowMs,
    });
    return NextResponse.json(
      { ok: true, next: "/admin/configurar-acceso" },
      { headers: { ...NO_STORE, "Set-Cookie": setCookie } },
    );
  }

  // TOTP obligatorio para la sesión completa.
  if (!totp) return failAccount("totp_ausente");
  const secret = await decryptSecret(user.totp_secret);
  if (!secret) {
    // Pepper rotado o fila corrupta: fail-closed y a auditoría — esto es un
    // problema de operación (runbook), no del usuario.
    await writePanelAudit(db, {
      actorId: user.id, actorEmail: user.email, ipHash, section: "auth", action: "login",
      decision: "error", detail: { reason: "totp_indescifrable" }, nowMs,
    });
    return NextResponse.json({ error: "config" }, { status: 503, headers: NO_STORE });
  }
  const totpRes = await verifyTotp(secret, totp, user.totp_last_step, nowMs);
  if (!totpRes.ok) return failAccount("totp");

  // Éxito: quemar el timestep (anti-replay), normalizar el costo del hash si
  // cambió el objetivo, limpiar sesiones muertas y emitir la sesión completa.
  await bumpTotpStep(db, user.id, totpRes.step);
  if (needsRehash(user.password_hash)) {
    await setPassword(db, user.id, await hashPassword(password), { mustChange: false, nowMs });
  }
  await purgeExpiredSessions(db, nowMs);
  const { setCookie } = await createSession(db, user.id, "full", req, nowMs);
  await writePanelAudit(db, {
    actorId: user.id, actorEmail: user.email, ipHash, section: "auth", action: "login",
    decision: "ok", detail: { scope: "full" }, nowMs,
  });
  return NextResponse.json({ ok: true, next: "/admin" }, { headers: { ...NO_STORE, "Set-Cookie": setCookie } });
}
