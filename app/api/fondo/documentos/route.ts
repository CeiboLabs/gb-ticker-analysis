// Documentos del fondo publicados — lectura PÚBLICA. Respeta el flag
// `fondo_documentos` y sólo lista filas 'live'; vacío ⇒ el componente cae al
// fallback "Solicitar". Nunca expone r2_key: la descarga va por [tipo].

import { NextResponse } from "next/server";
import { getMetricsDb } from "@/lib/metrics";
import { readFlag } from "@/lib/flags";
import { listDocsLive } from "@/lib/fondoDocsStore";

export const dynamic = "force-dynamic";

const CACHE = { "Cache-Control": "public, max-age=300, s-maxage=300" };

export async function GET() {
  const db = getMetricsDb();
  if (!db || !(await readFlag(db, "fondo_documentos"))) {
    return NextResponse.json({ documentos: [] }, { headers: CACHE });
  }
  const documentos = (await listDocsLive(db)).map((d) => ({
    tipo: d.tipo,
    titulo: d.titulo,
    descripcion: d.descripcion,
    actualizado: d.updated_at,
  }));
  return NextResponse.json({ documentos }, { headers: CACHE });
}
