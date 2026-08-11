import { NextRequest, NextResponse } from "next/server";
import { getMetricsDb } from "@/lib/metrics";
import { leadCookieName, verifyLeadToken } from "@/lib/leadGate";
import { checkFollowLimit, clientIpFrom } from "@/lib/rateLimiter";
import { dejarDeSeguir, listarSeguidos, marcarVisto, seguir, sigue } from "@/lib/followStore";
import { esCliente, marcarCliente } from "@/lib/leadProfile";

export const dynamic = "force-dynamic";

const TICKER_RE = /^[A-Z0-9.\-]{1,12}$/;

/** Identidad del visitante. Sin correo no hay seguimiento posible. */
async function identidad(req: NextRequest): Promise<string | null> {
  const lead = await verifyLeadToken(req.cookies.get(leadCookieName())?.value);
  return lead?.email ?? null;
}

function originOk(req: NextRequest): boolean {
  const host = req.headers.get("host");
  const check = (raw: string | null) => {
    if (!raw || !host) return false;
    try { return new URL(raw).host === host; } catch { return false; }
  };
  return check(req.headers.get("origin")) || check(req.headers.get("referer"));
}

/**
 * Estado de seguimiento. Con `?ticker=` responde sólo por esa acción (lo que
 * necesita el informe para pintar el control); sin él, la lista completa con lo
 * que cambió en cada una.
 *
 * Sin identidad NO es un error: es un visitante anónimo. Devuelve
 * `{ identificado: false }` y el informe muestra el control pidiendo el correo.
 */
export async function GET(req: NextRequest) {
  const db = getMetricsDb();
  const email = await identidad(req);
  const noStore = { "Cache-Control": "no-store" };

  if (!db || !email) {
    return NextResponse.json({ identificado: false, siguiendo: false, seguidos: [] }, { headers: noStore });
  }

  const raw = new URL(req.url).searchParams.get("ticker")?.trim().toUpperCase();
  if (raw) {
    if (!TICKER_RE.test(raw)) {
      return NextResponse.json({ error: "ticker inválido" }, { status: 400, headers: noStore });
    }
    return NextResponse.json(
      { identificado: true, siguiendo: await sigue(db, email, raw), esCliente: await esCliente(db, email) },
      { headers: noStore },
    );
  }

  return NextResponse.json(
    { identificado: true, seguidos: await listarSeguidos(db, email), esCliente: await esCliente(db, email) },
    { headers: noStore },
  );
}

/**
 * Acciones: seguir, dejar de seguir y marcar como visto.
 *
 * `visto` es la que apaga el aviso de "cambió desde que lo viste", y se manda
 * cuando la persona efectivamente abrió el informe de esa acción — no al leer la
 * lista, o el aviso se apagaría antes de que lo lea.
 *
 * `esCliente` viaja acá y no en un formulario aparte porque el momento de seguir
 * es el único en el que preguntarlo no interrumpe nada: es un dato más del alta.
 */
export async function POST(req: NextRequest) {
  const noStore = { "Cache-Control": "no-store" };
  if (!originOk(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: noStore });
  }

  const db = getMetricsDb();
  const email = await identidad(req);
  if (!db) return NextResponse.json({ error: "service unavailable" }, { status: 503, headers: noStore });
  // 401 y no 403: la respuesta correcta del cliente es pedir el correo, no
  // avisar que algo falló.
  //
  // Va ANTES del rate limit a propósito, al revés de lo habitual: verificar la
  // cookie es un JWT sin tocar la base, y si no se hiciera primero, cualquier
  // anónimo podría quemarle el cupo horario a los lectores identificados que
  // salen por la misma IP (una oficina detrás de un NAT es exactamente eso).
  if (!email) return NextResponse.json({ error: "sin_identidad" }, { status: 401, headers: noStore });

  // Balde propio, no el del newsletter: acá `visto` escribe en cada vista de un
  // informe seguido, así que el cupo de un alta (5/h) se agotaba navegando y
  // dejaba los botones mudos. Ver checkFollowLimit en lib/rateLimiter.ts.
  const gate = await checkFollowLimit(clientIpFrom(req));
  if (!gate.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Probá de nuevo más tarde." },
      { status: 429, headers: { ...noStore, "Retry-After": String(gate.retryAfter) } },
    );
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: noStore });
  }
  const b = body as { ticker?: unknown; accion?: unknown; esCliente?: unknown };

  const ticker = typeof b.ticker === "string" ? b.ticker.trim().toUpperCase() : "";
  if (!TICKER_RE.test(ticker)) {
    return NextResponse.json({ error: "ticker inválido" }, { status: 400, headers: noStore });
  }

  const accion = b.accion;
  if (accion !== "seguir" && accion !== "dejar" && accion !== "visto") {
    return NextResponse.json({ error: "acción inválida" }, { status: 400, headers: noStore });
  }

  if (accion === "seguir") {
    await seguir(db, email, ticker);
    if (typeof b.esCliente === "boolean") {
      await marcarCliente(db, email, b.esCliente);
    }
  } else if (accion === "dejar") {
    await dejarDeSeguir(db, email, ticker);
  } else {
    await marcarVisto(db, email, ticker);
  }

  return NextResponse.json(
    { ok: true, siguiendo: accion !== "dejar" && (await sigue(db, email, ticker)) },
    { headers: noStore },
  );
}
