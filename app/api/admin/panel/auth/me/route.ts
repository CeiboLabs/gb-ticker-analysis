// Identidad de la sesión vigente — el shell del panel la usa para armar la
// navegación por permisos y decidir el redirect del flujo de setup.

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requirePanelSession(req, undefined, { scope: "setup" });
  if (!gate.ok) return gate.res;
  return NextResponse.json(
    { user: gate.user, scope: gate.scope },
    { headers: { "Cache-Control": "no-store" } },
  );
}
