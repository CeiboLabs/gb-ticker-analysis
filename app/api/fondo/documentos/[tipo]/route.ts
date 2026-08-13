// Descarga PÚBLICA del PDF de un documento del fondo, same-origin desde R2. El
// fail-closed y el nombre del archivo viven en lib/fondoApi.ts: el worker del
// sitio del fondo en Cloudflare sirve este mismo endpoint.

import { getMetricsDb, getDocsBucket } from "@/lib/metrics";
import { respuestaDocumento } from "@/lib/fondoApi";
import { checkDownloadLimit, trustedClientIp } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await ctx.params;

  // Techo de descargas. Acá el gate va ANTES de resolver el documento —al revés
  // que en /informes/[slug]/pdf, donde va después—, y la diferencia es que el
  // espacio de `tipo` es cerrado: cinco valores del enum, sin slugs que rastrillar.
  // No hay 404 masivos que un atacante pueda provocar, así que cobrar por
  // adelantado no castiga a nadie y evita el `bucket.get()` de R2, que es el costo.
  //
  // El gate vive en la ruta y no en lib/fondoApi.ts a propósito: ese módulo lo
  // comparte el worker del sitio del fondo, y no quiero que un cambio de límites
  // acá le cambie el comportamiento a un deploy que no puedo probar desde el repo.
  const gate = await checkDownloadLimit("fondo-doc", trustedClientIp(req));
  if (!gate.allowed) {
    return new Response(
      gate.global ? "Descargas momentáneamente saturadas" : "Demasiadas descargas",
      {
        status: gate.global ? 503 : 429,
        headers: { "Retry-After": String(gate.retryAfter), "Cache-Control": "no-store" },
      },
    );
  }

  return respuestaDocumento(getMetricsDb(), getDocsBucket(), tipo);
}
