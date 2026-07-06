// Toggle de un flag de visibilidad. Una key fuera del vocabulario cerrado no
// existe (404): no se pueden inventar flags desde el cliente.

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { isFlagKey, setFlag, FLAG_DEFS } from "@/lib/flags";
import { FlagPatchSchema } from "@/lib/panelSchemas";
import { writePanelAudit } from "@/lib/panelStore";
import { eventBaseFromRequest } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const gate = await requirePanelSession(req, "secciones");
  if (!gate.ok) return gate.res;
  const { db, user } = gate;

  const { key } = await ctx.params;
  if (!isFlagKey(key)) {
    return NextResponse.json({ error: "no_existe" }, { status: 404, headers: NO_STORE });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }
  const parsed = FlagPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }

  await setFlag(db, key, parsed.data.enabled, user.email);
  await writePanelAudit(db, {
    actorId: user.id, actorEmail: user.email, ipHash: eventBaseFromRequest(req).ipHash,
    section: "secciones", action: "toggle", target: key, decision: "ok",
    detail: { label: FLAG_DEFS[key].label, enabled: parsed.data.enabled },
  });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
