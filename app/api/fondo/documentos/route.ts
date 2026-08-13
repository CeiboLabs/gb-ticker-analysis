// Documentos del fondo publicados — lectura PÚBLICA. La lógica (flag, filas
// 'live', qué campos se exponen) vive en lib/fondoApi.ts: el worker del sitio del
// fondo en Cloudflare sirve este mismo endpoint.

import { getMetricsDb } from "@/lib/metrics";
import { respuestaDocumentos } from "@/lib/fondoApi";
import { reboteGetPublico, trustedClientIp } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rebote = reboteGetPublico("fondo-docs", trustedClientIp(req));
  if (rebote) return rebote;
  return respuestaDocumentos(getMetricsDb());
}
