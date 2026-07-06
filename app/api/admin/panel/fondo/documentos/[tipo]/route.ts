// Documento regulatorio del fondo por tipo (enum cerrado): POST multipart sube
// el PDF a R2 y deja la fila apuntando a la key nueva (las versiones viejas
// quedan en el bucket); PATCH edita metadata/visibilidad sin tocar el archivo.

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { getDocsBucket, eventBaseFromRequest } from "@/lib/metrics";
import { getDoc, upsertDoc, patchDoc } from "@/lib/fondoDocsStore";
import { readPdfUpload } from "@/lib/pdfUpload";
import { isFondoDocTipo, DocumentoPatchSchema, type FondoDocTipo } from "@/lib/panelSchemas";
import { writePanelAudit } from "@/lib/panelStore";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

const TITULO_DEFAULT: Record<FondoDocTipo, string> = {
  "ficha-tecnica": "Ficha técnica",
  "datos-fundamentales": "Datos fundamentales para el inversor",
  "reglamento": "Reglamento de gestión",
  "informe-cartera": "Informe de cartera",
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ tipo: string }> }) {
  const gate = await requirePanelSession(req, "fondo");
  if (!gate.ok) return gate.res;
  const { db, user } = gate;

  const { tipo } = await ctx.params;
  if (!isFondoDocTipo(tipo)) {
    return NextResponse.json({ error: "no_existe" }, { status: 404, headers: NO_STORE });
  }
  const bucket = getDocsBucket();
  if (!bucket) {
    return NextResponse.json({ error: "sin_bindings" }, { status: 503, headers: NO_STORE });
  }

  const upload = await readPdfUpload(req, user.id);
  if (!upload.ok) return upload.res;

  // Metadata opcional del multipart; el título cae al default del tipo.
  const rawTitulo = upload.form.get("titulo");
  const titulo =
    typeof rawTitulo === "string" && rawTitulo.trim().length >= 3 ? rawTitulo.trim().slice(0, 120) : TITULO_DEFAULT[tipo];
  const rawDesc = upload.form.get("descripcion");
  const descripcion = typeof rawDesc === "string" && rawDesc.trim() ? rawDesc.trim().slice(0, 300) : null;

  const key = `fondo/${tipo}/${Date.now()}.pdf`;
  await bucket.put(key, upload.buf, { httpMetadata: { contentType: "application/pdf" } });
  await upsertDoc(db, { tipo, titulo, descripcion, r2Key: key, contentLen: upload.size, updatedBy: user.email });
  await writePanelAudit(db, {
    actorId: user.id, actorEmail: user.email, ipHash: eventBaseFromRequest(req).ipHash,
    section: "fondo", action: "upload", target: tipo, decision: "ok",
    detail: { r2Key: key, bytes: upload.size, titulo },
  });
  return NextResponse.json({ ok: true, r2Key: key }, { headers: NO_STORE });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ tipo: string }> }) {
  const gate = await requirePanelSession(req, "fondo");
  if (!gate.ok) return gate.res;
  const { db, user } = gate;

  const { tipo } = await ctx.params;
  if (!isFondoDocTipo(tipo)) {
    return NextResponse.json({ error: "no_existe" }, { status: 404, headers: NO_STORE });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }
  const parsed = DocumentoPatchSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ error: "bad_request", detalle: msg }, { status: 400, headers: NO_STORE });
  }
  const row = await getDoc(db, tipo);
  if (!row) {
    return NextResponse.json({ error: "no_existe", detalle: "Ese tipo todavía no tiene archivo subido." }, { status: 404, headers: NO_STORE });
  }

  await patchDoc(db, tipo, parsed.data, user.email);
  await writePanelAudit(db, {
    actorId: user.id, actorEmail: user.email, ipHash: eventBaseFromRequest(req).ipHash,
    section: "fondo", action: "update", target: tipo, decision: "ok",
    detail: Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => [k, v === null ? "(limpiado)" : String(v)])),
  });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
