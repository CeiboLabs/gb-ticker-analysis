// Estado de los flags de visibilidad (vocabulario cerrado de lib/flags.ts).

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { readAllFlags } from "@/lib/flags";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requirePanelSession(req, "secciones");
  if (!gate.ok) return gate.res;
  const flags = await readAllFlags(gate.db);
  return NextResponse.json({ flags }, { headers: { "Cache-Control": "no-store" } });
}
