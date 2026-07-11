// Contenido editorial (artículo) de un informe.
//   GET  → devuelve el ContenidoInforme guardado (o null) para hidratar el editor.
//   PUT  → reemplaza el artículo entero (el editor manda el objeto completo, no
//          parches); se valida la forma con ContenidoInformeSchema antes de
//          persistir el JSON en informes.contenido.
// La visibilidad la sigue gobernando `status` (se publica desde el PATCH de la
// fila); acá sólo se guarda el contenido, pueda o no publicarse aún.

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { readInformeRow, readInformeContenido, setInformeContenido } from "@/lib/informesStore";
import { ContenidoInformeSchema } from "@/lib/panelSchemas";
import { writePanelAudit } from "@/lib/panelStore";
import { eventBaseFromRequest } from "@/lib/metrics";
import type { ContenidoInforme } from "@/lib/informeContenido/tipos";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const SLUG_RE = /^[a-z0-9-]{3,80}$/;

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const gate = await requirePanelSession(req, "informes");
  if (!gate.ok) return gate.res;
  const { slug } = await ctx.params;
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }
  const contenido = await readInformeContenido(gate.db, slug);
  return NextResponse.json({ contenido }, { headers: NO_STORE });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const gate = await requirePanelSession(req, "informes");
  if (!gate.ok) return gate.res;
  const { db, user } = gate;

  const { slug } = await ctx.params;
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }
  const parsed = ContenidoInformeSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const donde = issue?.path.join(".");
    const msg = issue?.message ?? "Datos inválidos";
    return NextResponse.json(
      { error: "bad_request", detalle: donde ? `${donde}: ${msg}` : msg },
      { status: 400, headers: NO_STORE },
    );
  }

  const row = await readInformeRow(db, slug);
  if (!row) {
    return NextResponse.json({ error: "no_existe" }, { status: 404, headers: NO_STORE });
  }

  await setInformeContenido(db, slug, parsed.data as ContenidoInforme, user.email);
  await writePanelAudit(db, {
    actorId: user.id,
    actorEmail: user.email,
    ipHash: eventBaseFromRequest(req).ipHash,
    section: "informes",
    action: "update",
    target: slug,
    decision: "ok",
    detail: { campo: "contenido", bloques: parsed.data.bloques.length },
  });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
