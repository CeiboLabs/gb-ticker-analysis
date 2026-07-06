// Bootstrap del PRIMER admin del panel. Gateado por el ADMIN_TOKEN existente
// (secret ya desplegado) y auto-deshabilitado: el INSERT es atómico con
// WHERE NOT EXISTS — con un solo usuario en la tabla, esta ruta muere en 409
// para siempre. La recuperación de un panel sin admins operativos va por SQL
// (docs/RUNBOOK-panel.md), no por acá.

import { NextRequest, NextResponse } from "next/server";
import { getMetricsDb, eventBaseFromRequest } from "@/lib/metrics";
import { checkFailedAuthLimit, trustedClientIp } from "@/lib/rateLimiter";
import { originOk } from "@/lib/panelAuth";
import { panelConfigured, timingSafeEqual, hashPassword } from "@/lib/panelCrypto";
import { createFirstAdmin, writePanelAudit } from "@/lib/panelStore";
import { SetupSchema } from "@/lib/panelSchemas";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const SETUP_HOURLY_MAX = 10;

export async function POST(req: NextRequest) {
  if (!originOk(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: NO_STORE });
  }
  const db = getMetricsDb();
  if (!db || !panelConfigured()) {
    return NextResponse.json({ error: "sin_bindings" }, { status: 503, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }
  const parsed = SetupSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ error: "bad_request", detalle: msg }, { status: 400, headers: NO_STORE });
  }
  const { token, email, nombre, password } = parsed.data;
  const nowMs = Date.now();
  const ipHash = eventBaseFromRequest(req).ipHash;

  // Fail-closed sin ADMIN_TOKEN; comparación constant-time; gate durable por IP
  // consumido SOLO en fallas (mismo criterio que requireToken).
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || !timingSafeEqual(token, expected)) {
    const gate = await checkFailedAuthLimit(trustedClientIp(req), SETUP_HOURLY_MAX, "panelsetup");
    await writePanelAudit(db, {
      ipHash, section: "auth", action: "setup", target: email,
      decision: "rejected", detail: { reason: "token" }, nowMs,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: "rate_limited" },
        { status: 429, headers: { ...NO_STORE, "Retry-After": String(gate.retryAfter) } },
      );
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const created = await createFirstAdmin(db, { email, nombre, passwordHash: await hashPassword(password), nowMs });
  if (!created) {
    return NextResponse.json({ error: "ya_configurado" }, { status: 409, headers: NO_STORE });
  }
  await writePanelAudit(db, {
    actorEmail: email, ipHash, section: "auth", action: "setup", target: email, decision: "ok", nowMs,
  });
  // Sin sesión acá a propósito: el primer login pasa por el MISMO flujo que
  // cualquier empleado (y enrola el TOTP en configurar-acceso). Un solo camino.
  return NextResponse.json({ ok: true, next: "/admin/login" }, { headers: NO_STORE });
}
