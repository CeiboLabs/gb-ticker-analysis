// Descarga PÚBLICA del PDF de un documento del fondo, same-origin desde R2. El
// fail-closed y el nombre del archivo viven en lib/fondoApi.ts: el worker del
// sitio del fondo en Cloudflare sirve este mismo endpoint.

import { getMetricsDb, getDocsBucket } from "@/lib/metrics";
import { respuestaDocumento } from "@/lib/fondoApi";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await ctx.params;
  return respuestaDocumento(getMetricsDb(), getDocsBucket(), tipo);
}
