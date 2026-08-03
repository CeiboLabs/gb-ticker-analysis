// Worker del SITIO de BNG Selección Global.
//
// QUÉ HACE, Y SOBRE TODO QUÉ NO HACE
// La página es HTML estático (scripts/build-fondo.mts → dist/fondo) y la sirve el
// asset server de Cloudflare SIN invocar este código: cuando la URL matchea un
// archivo del directorio de assets, ese archivo se sirve y el worker ni arranca —
// y esos requests no se facturan. Este worker existe sólo para los tres endpoints
// de datos, que son lo único vivo de la página.
//
// Por eso el sitio del fondo no paga el impuesto de correr Next adentro de un
// worker: no hay servidor de Next acá. Los endpoints son los MISMOS que sirve la
// app en el dev y en el home server — la lógica está compartida en lib/fondoApi.ts
// para que no puedan divergir.
//
// LOS BINDINGS
//   METRICS_DB — D1 con las tablas del fondo (fund_nav, fund_benchmark,
//                fund_holdings, fund_docs, site_flags). Es la MISMA base que
//                escriben el panel de empleados y el worker de ingesta del NAV.
//   DOCS       — R2 con los PDFs publicados por el panel.
//   ASSETS     — el sitio estático. Se usa para el fallback: si la URL no matchea
//                ningún archivo, Cloudflare corre este worker, y devolverlo por
//                acá es lo que aplica el 404.html del deploy.
//
// ⚠️ FONDO_DEMO no va NUNCA en este worker: prende el valor cuota simulado de
// lib/fondo.ts. Es una variable del dev y de nadie más.

import type { D1Database, R2Bucket } from "../../../lib/metrics";
import {
  respuestaFondo,
  respuestaDocumentos,
  respuestaDocumento,
} from "../../../lib/fondoApi";

interface Env {
  METRICS_DB: D1Database;
  // OPCIONAL a propósito: mientras no haya documentos publicados, el sitio no
  // necesita R2, y exigir el binding ataría el primer deploy a habilitar el
  // servicio en el dashboard. Sin bucket, la descarga 404ea — exactamente lo
  // mismo que hace con el flag `fondo_documentos` apagado, que es el estado de
  // hoy. Se agrega el binding cuando el cliente publique el primer PDF.
  DOCS?: R2Bucket;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

/**
 * Los headers de seguridad del deploy viajan en el `_headers` del sitio estático,
 * que aplica SÓLO a los assets. Las respuestas que salen de este worker se los
 * ponen acá. No va la CSP entera —no tiene sentido en un JSON o un PDF—: va lo
 * que sí protege a un recurso servido, que es que el browser no adivine el tipo.
 */
function conSeguridad(res: Response): Response {
  const salida = new Response(res.body, res);
  salida.headers.set("X-Content-Type-Options", "nosniff");
  salida.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return salida;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    // Todo lo que no sea un endpoint de datos es el sitio estático. En la
    // práctica sólo llegan acá las URLs que NO matchean un archivo (las que sí,
    // las sirvió el borde sin invocarnos): devolverlas por el binding es lo que
    // hace que respondan con el 404 del deploy y no con uno genérico.
    if (!pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return conSeguridad(new Response("Método no permitido", { status: 405, headers: { Allow: "GET, HEAD" } }));
    }

    if (pathname === "/api/fondo") {
      return conSeguridad(await respuestaFondo(env.METRICS_DB));
    }
    if (pathname === "/api/fondo/documentos") {
      return conSeguridad(await respuestaDocumentos(env.METRICS_DB));
    }

    // /api/fondo/documentos/<tipo> — el tipo se valida contra el enum adentro de
    // respuestaDocumento, que 404ea sin distinguir el motivo (fail-closed).
    const doc = /^\/api\/fondo\/documentos\/([^/]+)$/.exec(pathname);
    if (doc) {
      return conSeguridad(
        await respuestaDocumento(env.METRICS_DB, env.DOCS ?? null, decodeURIComponent(doc[1])),
      );
    }

    return conSeguridad(new Response("No encontrado", { status: 404 }));
  },
};
