import { NextRequest, NextResponse } from "next/server";
import { leadCookieName, verifyLeadToken } from "@/lib/leadGate";
import { getMetricsDb } from "@/lib/metrics";
import { estadoLector } from "@/lib/leadProfile";
import { reboteGetPublico, trustedClientIp } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

/**
 * "¿Quién sos?" para el propio visitante: su correo y su estado en el embudo.
 *
 * PARA QUÉ: es lo que hace que un solo informe se lea de cuatro formas. Al
 * anónimo no se le menciona abrir una cuenta; al recurrente sí, y citando lo que
 * viene mirando; al cliente jamás — se lo manda a su asesor. También prellena el
 * correo en los formularios de quien ya se identificó, porque cada campo que
 * sobra es gente que no lo manda.
 *
 * POR QUÉ UNA RUTA Y NO LEER LA COOKIE EN EL CLIENTE: es HttpOnly a propósito
 * (lib/leadGate.ts), así que JS no la ve. Esto no la expone: devuelve los datos
 * de la persona que está usando ese navegador, a ese mismo navegador, y sólo si
 * el token está FIRMADO y vigente. No hay parámetro que permita preguntar por
 * otro.
 *
 * no-store: depende de una cookie y no puede quedar en ningún intermedio.
 */
export async function GET(req: NextRequest) {
  const rebote = reboteGetPublico("lead-me", trustedClientIp(req));
  if (rebote) return rebote;
  const lead = await verifyLeadToken(req.cookies.get(leadCookieName())?.value);
  const info = await estadoLector(getMetricsDb(), lead?.email ?? null);
  return NextResponse.json(info, { headers: { "Cache-Control": "no-store" } });
}
