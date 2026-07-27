import { NextRequest, NextResponse } from "next/server";
import { getMetricsDb, eventBaseFromRequest } from "@/lib/metrics";
import { checkNewsletterLimit, clientIpFrom } from "@/lib/rateLimiter";
import { NewsletterRequestSchema } from "@/lib/validators";
import { NEWSLETTER_CONSENT_TEXT } from "@/lib/newsletterConsent";
import { buildLeadCookie, issueLeadToken } from "@/lib/leadGate";
import { isDisposableDomain, splitEmail } from "@/lib/emailValidation";
import { domainAcceptsMail } from "@/lib/emailMx";

export const dynamic = "force-dynamic";

// Alta al newsletter de la casa. Etapa 1: SOLO recolección en D1 — el envío de
// campañas (Resend/otro) se enchufa después sin tocar esta ruta. Opt-in simple
// con consentimiento expreso; guardamos el TEXTO aceptado como prueba (Ley
// 18.331, Art. 9). No mandamos ningún mail acá, así que no hay fan-out de costo.
export async function POST(req: NextRequest) {
  // Origin guard — misma postura que /api/contact y /api/analyze: rechazar POSTs
  // cross-site.
  const reqHost = req.headers.get("host");
  const checkOriginHost = (raw: string | null): boolean => {
    if (!raw || !reqHost) return false;
    try { return new URL(raw).host === reqHost; } catch { return false; }
  };
  if (!checkOriginHost(req.headers.get("origin")) && !checkOriginHost(req.headers.get("referer"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Cap durable por IP — corta el alta masiva de mails basura.
  const gate = await checkNewsletterLimit(clientIpFrom(req));
  if (!gate.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Probá de nuevo más tarde." },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = NewsletterRequestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const data = parsed.data;

  // ── Validación de la dirección (capa 1) ───────────────────────────────────
  // Va ACÁ: antes del alta y antes de emitir la cookie del peaje. Una dirección
  // que no puede recibir correo no entra a la base ni desbloquea /analisis.
  // Zod ya validó la forma; esto valida que el dominio exista y sirva.
  const partes = splitEmail(data.email);
  const dominio = partes?.domain ?? "";

  if (isDisposableDomain(dominio)) {
    return NextResponse.json(
      { error: "Ese dominio es de correo temporal. Necesitamos una dirección donde podamos escribirte." },
      { status: 400 },
    );
  }

  const mx = await domainAcceptsMail(dominio);
  if (!mx.ok) {
    return NextResponse.json(
      {
        error:
          mx.motivo === "dominio_inexistente"
            ? `No existe el dominio "${dominio}". ¿Está bien escrito?`
            : `El dominio "${dominio}" no recibe correo. ¿Está bien escrito?`,
      },
      { status: 400 },
    );
  }

  const db = getMetricsDb();
  if (!db) {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }

  // UPSERT idempotente: un re-alta del mismo mail no duplica ni filtra si ya
  // estaba anotado (mismo ok para todos → sin enumeración de suscriptores).
  // Si estaba dado de baja, lo reactiva y limpia unsubscribed_at.
  await db
    .prepare(
      "INSERT INTO newsletter_subscribers (email, ts, status, source, consent, consent_text, ip_hash, unsubscribed_at) " +
      "VALUES (?, ?, 'active', ?, 1, ?, ?, NULL) " +
      "ON CONFLICT(email) DO UPDATE SET " +
      "status='active', ts=excluded.ts, source=excluded.source, consent=1, " +
      "consent_text=excluded.consent_text, ip_hash=excluded.ip_hash, unsubscribed_at=NULL"
    )
    .bind(
      data.email,
      Date.now(),
      data.source,
      NEWSLETTER_CONSENT_TEXT,
      eventBaseFromRequest(req).ipHash,
    )
    .run();

  // Junto con el alta emitimos el token del gate de /analisis: quien ya dejó su
  // correo —acá o en el bloque de /informes— no vuelve a ver el formulario. Es
  // una cookie de identidad, no una sesión (ver lib/leadGate.ts). Si el gate no
  // está configurado, issueLeadToken devuelve null y simplemente no se manda.
  const res = NextResponse.json({ ok: true });
  const token = await issueLeadToken(data.email);
  if (token) res.headers.set("Set-Cookie", buildLeadCookie(token));
  return res;
}
