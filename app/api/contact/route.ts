import { NextRequest, NextResponse } from "next/server";
import { getMetricsDb, eventBaseFromRequest } from "@/lib/metrics";
import { checkContactLimit, clientIpFrom } from "@/lib/rateLimiter";
import { ContactRequestSchema, CONTACT_MOTIVOS } from "@/lib/validators";

export const dynamic = "force-dynamic";

const MOTIVO_LABEL: Record<(typeof CONTACT_MOTIVOS)[number], string> = {
  "cuenta-personal": "Abrir una cuenta personal",
  "cuenta-empresa": "Abrir una cuenta empresa",
  "asesoria": "Asesoramiento financiero",
  "productos": "Información de productos",
  "otro": "Otra consulta",
};

// Notificación por email vía Resend (HTTP API directa — edge-friendly, sin
// SDK). Si falta la key o el destinatario, el mensaje igual queda en D1 y
// devolvemos ok: el email es notificación, no fuente de verdad. Cuerpo en
// texto plano a propósito — sin HTML no hay inyección posible con los datos
// del remitente.
async function sendNotification(data: {
  nombre: string; apellido: string; email: string;
  telefono: string; motivo: string; mensaje: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO;
  if (!key || !to) return false;
  const from = process.env.CONTACT_FROM ?? "Bengochea Web <onboarding@resend.dev>";
  const label = MOTIVO_LABEL[data.motivo as keyof typeof MOTIVO_LABEL] ?? data.motivo;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: to.split(",").map((s) => s.trim()).filter(Boolean),
        reply_to: data.email,
        subject: `[Web] ${label} — ${data.nombre} ${data.apellido}`,
        text:
          `Nuevo mensaje desde el formulario de contacto:\n\n` +
          `Nombre:   ${data.nombre} ${data.apellido}\n` +
          `Email:    ${data.email}\n` +
          `Teléfono: ${data.telefono || "—"}\n` +
          `Motivo:   ${label}\n\n` +
          `${data.mensaje}\n`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // Origin guard — same posture as /api/analyze: reject cross-site POSTs.
  const reqHost = req.headers.get("host");
  const checkOriginHost = (raw: string | null): boolean => {
    if (!raw || !reqHost) return false;
    try { return new URL(raw).host === reqHost; } catch { return false; }
  };
  if (!checkOriginHost(req.headers.get("origin")) && !checkOriginHost(req.headers.get("referer"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Durable per-IP gate — every submission fans out to an email.
  const gate = await checkContactLimit(clientIpFrom(req));
  if (!gate.allowed) {
    return NextResponse.json(
      { error: "Demasiados envíos. Intentá de nuevo más tarde." },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = ContactRequestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const data = parsed.data;

  const db = getMetricsDb();
  if (!db) {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }

  const emailed = await sendNotification(data);

  await db
    .prepare(
      "INSERT INTO contact_messages (ts, nombre, apellido, email, telefono, motivo, mensaje, ip_hash, emailed) " +
      "VALUES (?,?,?,?,?,?,?,?,?)"
    )
    .bind(
      Date.now(),
      data.nombre,
      data.apellido,
      data.email,
      data.telefono || null,
      data.motivo,
      data.mensaje,
      eventBaseFromRequest(req).ipHash,
      emailed ? 1 : 0,
    )
    .run();

  return NextResponse.json({ ok: true });
}
