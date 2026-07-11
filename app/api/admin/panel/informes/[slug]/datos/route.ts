// Autocompletado de mercado: trae los cuadros que hoy se resuelven solos (serie
// del dólar, retornos regionales y globales) para la semana del informe. NO
// guarda nada — devuelve los bloques y el editor los inserta; el analista los
// ubica, los revisa y recién ahí guarda/publica (Opción A: dato confiable +
// visto bueno humano). El viernes de la semana = la fecha del informe.

import { NextRequest, NextResponse } from "next/server";
import { requirePanelSession } from "@/lib/panelAuth";
import { readInformeRow } from "@/lib/informesStore";
import { datosDelSemanal } from "@/lib/informesDatos";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const SLUG_RE = /^[a-z0-9-]{3,80}$/;

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const gate = await requirePanelSession(req, "informes");
  if (!gate.ok) return gate.res;
  const { slug } = await ctx.params;
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: NO_STORE });
  }
  const row = await readInformeRow(gate.db, slug);
  if (!row) {
    return NextResponse.json({ error: "no_existe" }, { status: 404, headers: NO_STORE });
  }
  try {
    const bloques = await datosDelSemanal(row.fecha);
    return NextResponse.json({ bloques }, { headers: NO_STORE });
  } catch {
    return NextResponse.json(
      { error: "upstream", detalle: "No se pudieron traer los datos de mercado. Probá de nuevo." },
      { status: 502, headers: NO_STORE },
    );
  }
}
