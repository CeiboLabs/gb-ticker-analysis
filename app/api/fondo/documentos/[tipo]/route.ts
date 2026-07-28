// Descarga PÚBLICA del PDF de un documento del fondo, same-origin desde R2.
// Fail-closed: tipo fuera del enum, flag apagado, fila 'hold' o archivo
// ausente ⇒ 404 sin distinguir el motivo.

import { NextResponse } from "next/server";
import { getMetricsDb, getDocsBucket } from "@/lib/metrics";
import { readFlag } from "@/lib/flags";
import { getDoc } from "@/lib/fondoDocsStore";
import { isFondoDocTipo, type FondoDocTipo } from "@/lib/panelSchemas";

export const dynamic = "force-dynamic";

// Nombre con el que el visitante se guarda el archivo. Va aparte del slug del
// enum (que es clave de base y no se toca) para que el PDF no se llame
// "ficha-tecnica" cuando la página dice Factsheet.
const NOMBRE_ARCHIVO: Record<FondoDocTipo, string> = {
  "ficha-tecnica": "Factsheet",
  "datos-fundamentales": "Datos-fundamentales",
  "reglamento": "Reglamento-de-gestion",
  "autorizacion-bcu": "Autorizacion-BCU",
  "informe-cartera": "Informe-de-cartera",
};

export async function GET(_req: Request, ctx: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await ctx.params;
  if (!isFondoDocTipo(tipo)) {
    return new NextResponse("No encontrado", { status: 404 });
  }
  const db = getMetricsDb();
  const bucket = getDocsBucket();
  if (!db || !bucket || !(await readFlag(db, "fondo_documentos"))) {
    return new NextResponse("No encontrado", { status: 404 });
  }
  const doc = await getDoc(db, tipo);
  if (!doc || doc.status !== "live") {
    return new NextResponse("No encontrado", { status: 404 });
  }
  const obj = await bucket.get(doc.r2_key);
  if (!obj) {
    return new NextResponse("No encontrado", { status: 404 });
  }
  return new NextResponse(obj.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="BNG-Seleccion-Global-${NOMBRE_ARCHIVO[tipo]}.pdf"`,
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      ETag: obj.httpEtag,
    },
  });
}
