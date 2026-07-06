// Edición de un informe. Sin DELETE a propósito: ocultar = status 'hold'
// (auditable y reversible). Publicar exige PDF (pdf_url externa o r2_key).

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { readInformeRow, updateInforme, fechaTextoDe, informeTienePdf } from "@/lib/informesStore";
import { InformePatchSchema } from "@/lib/panelSchemas";
import { writePanelAudit } from "@/lib/panelStore";
import { eventBaseFromRequest } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const SLUG_RE = /^[a-z0-9-]{3,80}$/;

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
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
  const parsed = InformePatchSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ error: "bad_request", detalle: msg }, { status: 400, headers: NO_STORE });
  }
  const fields = parsed.data;

  const row = await readInformeRow(db, slug);
  if (!row) {
    return NextResponse.json({ error: "no_existe" }, { status: 404, headers: NO_STORE });
  }
  if (fields.videoId != null && row.categoria === "Semanal") {
    return NextResponse.json(
      { error: "bad_request", detalle: "Los informes semanales no llevan video." },
      { status: 400, headers: NO_STORE },
    );
  }
  // Regla "no live sin PDF": se evalúa contra el estado RESULTANTE del patch.
  if (fields.status === "live") {
    const pdfUrlFinal = fields.pdfUrl !== undefined ? fields.pdfUrl : row.pdf_url;
    if (!informeTienePdf({ pdf_url: pdfUrlFinal, r2_key: row.r2_key })) {
      return NextResponse.json(
        { error: "sin_pdf", detalle: "No se puede publicar sin PDF: subí el archivo o cargá la URL externa." },
        { status: 409, headers: NO_STORE },
      );
    }
  }
  // Si cambia la fecha y no vino la prosa, se regenera para que no queden desfasadas.
  const patch = { ...fields };
  if (patch.fecha !== undefined && patch.fechaTexto === undefined) {
    patch.fechaTexto = fechaTextoDe(patch.fecha);
  }

  await updateInforme(db, slug, patch, user.email);
  await writePanelAudit(db, {
    actorId: user.id, actorEmail: user.email, ipHash: eventBaseFromRequest(req).ipHash,
    section: "informes", action: "update", target: slug, decision: "ok",
    detail: Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === null ? "(limpiado)" : String(v)])),
  });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
