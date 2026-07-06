// Documentos del fondo — vista del panel (incluye los ocultos).

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { listDocsAdmin } from "@/lib/fondoDocsStore";
import { FONDO_DOC_TIPOS } from "@/lib/panelSchemas";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requirePanelSession(req, "fondo");
  if (!gate.ok) return gate.res;
  const documentos = await listDocsAdmin(gate.db);
  return NextResponse.json({ documentos, tipos: FONDO_DOC_TIPOS }, { headers: { "Cache-Control": "no-store" } });
}
