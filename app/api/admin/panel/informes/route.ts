// Informes — lista (con ocultos) y alta. El slug y la fecha en prosa los
// deriva el SERVER de la categoría+fecha; el alta nace SIEMPRE en 'hold' y se
// publica recién cuando hay PDF (regla en código, ver PATCH).

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { listInformesAdmin, insertInforme, slugForInforme, fechaTextoDe, readSlugsConArticulo } from "@/lib/informesStore";
import { InformeCreateSchema } from "@/lib/panelSchemas";
import { writePanelAudit } from "@/lib/panelStore";
import { eventBaseFromRequest } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const gate = await requirePanelSession(req, "informes");
  if (!gate.ok) return gate.res;
  const [informes, conArticulo] = await Promise.all([
    listInformesAdmin(gate.db),
    readSlugsConArticulo(gate.db, false),
  ]);
  return NextResponse.json({ informes, conArticulo }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const gate = await requirePanelSession(req, "informes");
  if (!gate.ok) return gate.res;
  const { db, user } = gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }
  const parsed = InformeCreateSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ error: "bad_request", detalle: msg }, { status: 400, headers: NO_STORE });
  }
  const i = parsed.data;
  if (i.categoria === "Semanal" && i.videoId) {
    return NextResponse.json(
      { error: "bad_request", detalle: "Los informes semanales no llevan video (sólo los mensuales)." },
      { status: 400, headers: NO_STORE },
    );
  }

  const slug = slugForInforme(i.categoria, i.fecha);
  try {
    await insertInforme(db, {
      slug,
      fecha: i.fecha,
      fechaTexto: i.fechaTexto ?? fechaTextoDe(i.fecha),
      titulo: i.titulo,
      categoria: i.categoria,
      pdfUrl: i.pdfUrl ?? null,
      videoId: i.videoId ?? null,
      updatedBy: user.email,
    });
  } catch (err) {
    if (String(err).includes("UNIQUE") || String(err).includes("PRIMARY")) {
      return NextResponse.json(
        { error: "slug_existente", detalle: `Ya existe un informe ${slug}.` },
        { status: 409, headers: NO_STORE },
      );
    }
    throw err;
  }
  await writePanelAudit(db, {
    actorId: user.id, actorEmail: user.email, ipHash: eventBaseFromRequest(req).ipHash,
    section: "informes", action: "create", target: slug, decision: "ok",
    detail: { titulo: i.titulo, categoria: i.categoria },
  });
  return NextResponse.json({ ok: true, slug }, { headers: NO_STORE });
}
