import { NextResponse } from "next/server";
import { getInforme } from "@/lib/informes";
import { getMetricsDb, getDocsBucket } from "@/lib/metrics";
import { readInformeRow, readInformeContenido, informeTienePdf } from "@/lib/informesStore";
import { tieneArticulo } from "@/lib/informeContenido";
import { PDF_URL_HOSTS } from "@/lib/panelSchemas";
import { checkDownloadLimit, trustedClientIp } from "@/lib/rateLimiter";

// Proxy same-origin del PDF del informe. Dos orígenes posibles, resueltos por
// la fila de D1 (que administra el panel de empleados):
//   1. r2_key  → PDF subido desde el panel al bucket bengochea-docs (preferido).
//   2. pdf_url → histórico en gbengochea.com.uy (X-Frame-Options:SAMEORIGIN +
//      nuestro CSP obligan a re-emitirlo desde este dominio).
// La fila también manda en visibilidad: status='hold' o slug inexistente ⇒ 404.
// El pdf_url se valida contra la allowlist de hosts aunque venga de la DB
// (defensa en capas: jamás open-proxy). Sin binding (next dev) cae al seed
// hardcodeado de lib/informes.

const CACHE = "public, max-age=3600, s-maxage=86400";

function hostPermitido(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (PDF_URL_HOSTS as readonly string[]).includes(u.hostname);
  } catch {
    return false;
  }
}

export async function GET(
  req: Request,
  ctx: RouteContext<"/informes/[slug]/pdf">,
) {
  const { slug } = await ctx.params;

  const db = getMetricsDb();
  const row = db ? await readInformeRow(db, slug) : null;

  // Muerte del PDF: si el informe ya tiene artículo publicado, el PDF deja de
  // circular — se redirige a la página (lo que se comparte ahora es la URL, no el
  // archivo). Los informes sin artículo transcrito siguen sirviendo su PDF
  // (transición). 307 temporal: el comportamiento puede evolucionar (ej. PDF
  // generado desde el artículo).
  const tieneArticuloLive =
    row?.status === "live" && (((db && (await readInformeContenido(db, slug))) != null) || tieneArticulo(slug));
  if (tieneArticuloLive) {
    // Location relativo a propósito: el browser lo resuelve contra la request, así
    // no dependemos del host de req.url (en el home server es 0.0.0.0; detrás del
    // proxy sería el interno) — el redirect apunta siempre al dominio correcto.
    return new NextResponse(null, { status: 307, headers: { Location: `/informes/${slug}`, "Cache-Control": "no-store" } });
  }

  // Con D1 la fila manda (incluida la visibilidad); sin D1, el seed en código.
  let r2Key: string | null = null;
  let pdfUrl: string | null = null;
  if (db) {
    if (!row || row.status !== "live" || !informeTienePdf(row)) {
      return new NextResponse("Informe no encontrado", { status: 404 });
    }
    r2Key = row.r2_key;
    pdfUrl = row.pdf_url;
  } else {
    const informe = getInforme(slug);
    if (!informe) {
      return new NextResponse("Informe no encontrado", { status: 404 });
    }
    pdfUrl = informe.pdf;
  }

  const filename = `${slug}.pdf`;

  // Techo de descargas, JUSTO acá y no al entrar: el gate se cobra sólo cuando
  // de verdad vamos a mover un archivo. Un slug inexistente (404) o uno que ya
  // tiene artículo (307) no consumen cupo — así un link viejo circulando no le
  // gasta el presupuesto a nadie, y el contador queda atado al ancho de banda,
  // que es lo que se está protegiendo.
  //
  // Es la ruta de archivo más cara que hay: la rama de abajo re-proxea
  // gbengochea.com.uy, o sea que cada hit gasta ancho de banda del cliente Y el
  // nuestro. Hasta hoy no tenía ningún límite.
  const gate = await checkDownloadLimit("informe-pdf", trustedClientIp(req));
  if (!gate.allowed) {
    return new NextResponse(
      gate.global ? "Descargas momentáneamente saturadas" : "Demasiadas descargas",
      {
        // 503 cuando el que se agotó es el techo global: no es culpa de quien
        // pide, y el status tiene que decir "volvé", no "portate bien".
        status: gate.global ? 503 : 429,
        headers: { "Retry-After": String(gate.retryAfter), "Cache-Control": "no-store" },
      },
    );
  }

  // Preferido: el PDF subido a R2 (nuestro, versionado por key con timestamp).
  if (r2Key) {
    const bucket = getDocsBucket();
    if (!bucket) {
      return new NextResponse("No se pudo obtener el informe", { status: 503 });
    }
    const obj = await bucket.get(r2Key);
    if (!obj) {
      return new NextResponse("No se pudo obtener el informe", { status: 502 });
    }
    return new NextResponse(obj.body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": CACHE,
        ETag: obj.httpEtag,
      },
    });
  }

  // Histórico: fetch al host del cliente, con allowlist (nunca URL arbitraria).
  if (!pdfUrl || !hostPermitido(pdfUrl)) {
    return new NextResponse("Informe no encontrado", { status: 404 });
  }
  let upstream: Response;
  try {
    upstream = await fetch(pdfUrl, {
      headers: { Accept: "application/pdf" },
      // Revalida cada hora; los PDF publicados no cambian, pero permite reflejar
      // correcciones del cliente sin redeploy.
      next: { revalidate: 3600 },
    });
  } catch {
    return new NextResponse("No se pudo obtener el informe", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return new NextResponse("No se pudo obtener el informe", { status: 502 });
  }
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      // inline => el visor lo embebe; sigue siendo descargable desde el botón.
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": CACHE,
    },
  });
}
