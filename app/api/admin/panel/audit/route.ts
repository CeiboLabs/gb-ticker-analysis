// Lectura de la auditoría del panel — solo rol admin.

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { readAudit } from "@/lib/panelStore";

export const dynamic = "force-dynamic";

const SECTIONS = new Set(["auth", "informes", "fondo", "secciones", "usuarios"]);

export async function GET(req: NextRequest) {
  const gate = await requirePanelSession(req, "usuarios");
  if (!gate.ok) return gate.res;

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(1, parseInt(sp.get("limit") ?? "100", 10) || 100), 500);
  const rawSection = sp.get("section");
  const section = rawSection && SECTIONS.has(rawSection) ? rawSection : null;

  const entries = await readAudit(gate.db, { limit, section });
  return NextResponse.json({ entries }, { headers: { "Cache-Control": "no-store" } });
}
