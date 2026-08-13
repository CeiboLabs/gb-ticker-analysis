// Snapshot diario de BNG Selección Global (valor cuota, AUM y serie histórica).
// La lógica y las cabeceras de cache viven en lib/fondoApi.ts porque el sitio del
// fondo en Cloudflare sirve este mismo endpoint desde su propio worker; acá sólo
// se resuelve el binding.

import { getMetricsDb } from "@/lib/metrics";
import { respuestaFondo } from "@/lib/fondoApi";
import { reboteGetPublico, trustedClientIp } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rebote = reboteGetPublico("fondo", trustedClientIp(req));
  if (rebote) return rebote;
  return respuestaFondo(getMetricsDb());
}
