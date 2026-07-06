// Upload del PDF de un informe a R2 (bucket bengochea-docs). La key se genera
// server-side con timestamp: las versiones anteriores quedan en el bucket para
// rollback manual, y el filename del usuario ni se lee.

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { getDocsBucket, eventBaseFromRequest } from "@/lib/metrics";
import { readInformeRow, setInformeR2Key } from "@/lib/informesStore";
import { readPdfUpload } from "@/lib/pdfUpload";
import { writePanelAudit } from "@/lib/panelStore";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const SLUG_RE = /^[a-z0-9-]{3,80}$/;

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const gate = await requirePanelSession(req, "informes");
  if (!gate.ok) return gate.res;
  const { db, user } = gate;

  const { slug } = await ctx.params;
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }
  const row = await readInformeRow(db, slug);
  if (!row) {
    return NextResponse.json({ error: "no_existe" }, { status: 404, headers: NO_STORE });
  }
  const bucket = getDocsBucket();
  if (!bucket) {
    return NextResponse.json({ error: "sin_bindings" }, { status: 503, headers: NO_STORE });
  }

  const upload = await readPdfUpload(req, user.id);
  if (!upload.ok) return upload.res;

  const key = `informes/${slug}/${Date.now()}.pdf`;
  await bucket.put(key, upload.buf, { httpMetadata: { contentType: "application/pdf" } });
  await setInformeR2Key(db, slug, key, user.email);
  await writePanelAudit(db, {
    actorId: user.id, actorEmail: user.email, ipHash: eventBaseFromRequest(req).ipHash,
    section: "informes", action: "upload", target: slug, decision: "ok",
    detail: { r2Key: key, bytes: upload.size },
  });
  return NextResponse.json({ ok: true, r2Key: key }, { headers: NO_STORE });
}
