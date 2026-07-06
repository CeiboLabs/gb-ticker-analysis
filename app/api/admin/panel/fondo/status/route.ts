// Estado operativo del fondo para el panel: último cierre, huecos hábiles,
// últimos cierres, rechazos recientes de la auditoría del fondo, snapshot de
// tenencias más nuevo (SIN el rezago de divulgación: esto es la vista interna).

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { todayUY } from "@/lib/fondoIngest";

export const dynamic = "force-dynamic";

/** Días hábiles (L-V) estrictamente entre `desde` y `hasta` (ISO). Sin feriados: es un indicador, no un calendario bursátil. */
function habilesEntre(desde: string, hasta: string): number {
  let count = 0;
  const d = new Date(`${desde}T12:00:00Z`);
  const end = Date.parse(`${hasta}T12:00:00Z`);
  for (d.setUTCDate(d.getUTCDate() + 1); d.getTime() < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) count++;
  }
  return count;
}

export async function GET(req: NextRequest) {
  const gate = await requirePanelSession(req, "fondo");
  if (!gate.ok) return gate.res;
  const { db } = gate;

  const [ultimo, total, ultimos, rechazos, snapshot] = await Promise.all([
    db.prepare("SELECT dia, nav, aum FROM fund_nav WHERE status = 'live' ORDER BY dia DESC LIMIT 1")
      .first<{ dia: string; nav: number; aum: number | null }>(),
    db.prepare("SELECT COUNT(*) AS n FROM fund_nav WHERE status = 'live'").first<{ n: number }>(),
    db.prepare("SELECT dia, nav, aum, source FROM fund_nav WHERE status = 'live' ORDER BY dia DESC LIMIT 10")
      .all<{ dia: string; nav: number; aum: number | null; source: string | null }>(),
    db.prepare(
      "SELECT ts, action, reason, target_dia, parsed_nav FROM fund_audit WHERE decision = 'rejected' ORDER BY ts DESC LIMIT 10",
    ).all<{ ts: number; action: string; reason: string | null; target_dia: string | null; parsed_nav: number | null }>(),
    db.prepare(
      "SELECT s.as_of AS as_of, COUNT(i.name) AS items FROM fund_holdings_snapshot s " +
        "LEFT JOIN fund_holdings_item i ON i.as_of = s.as_of " +
        "WHERE s.status = 'live' GROUP BY s.as_of ORDER BY s.as_of DESC LIMIT 1",
    ).first<{ as_of: string; items: number }>(),
  ]);

  const hoy = todayUY(Date.now());
  return NextResponse.json(
    {
      ultimoCierre: ultimo ?? null,
      totalCierres: Number(total?.n ?? 0),
      diasHabilesSinCierre: ultimo ? habilesEntre(ultimo.dia, hoy) : null,
      ultimos: ultimos.results ?? [],
      rechazos: rechazos.results ?? [],
      tenencias: snapshot ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
