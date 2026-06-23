import { NextResponse } from "next/server";
import { getInforme } from "@/lib/informes";

// Proxy same-origin del PDF del informe. El host del cliente
// (gbengochea.com.uy) sirve los PDF con X-Frame-Options:SAMEORIGIN y nuestro
// propio CSP bloquea fetch/iframe a terceros, así que el visor PDF.js solo
// puede traer el archivo desde nuestro dominio. Acá lo bajamos server-side y
// lo re-emitimos. El slug se valida contra la lista blanca de INFORMES: nunca
// se hace fetch de una URL arbitraria (no es un open-proxy).

// Edge runtime: este handler NO es estático — proxea el PDF en vivo (fetch con
// revalidate) y tiene [slug] dinámico sin generateStaticParams, así que no se
// puede prerenderizar. Cloudflare Pages (next-on-pages) exige edge en rutas no
// estáticas; el cacheo lo dan `next.revalidate` + los headers Cache-Control.
export const runtime = "edge";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/informes/[slug]/pdf">,
) {
  const { slug } = await ctx.params;
  const informe = getInforme(slug);

  if (!informe) {
    return new NextResponse("Informe no encontrado", { status: 404 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(informe.pdf, {
      headers: { Accept: "application/pdf" },
      // Revalida cada hora; los PDF publicados no cambian, pero permite reflejar
      // correcciones del cliente sin redeploy.
      next: { revalidate: 3600 },
    });
  } catch {
    return new NextResponse("No se pudo obtener el informe", { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new NextResponse("No se pudo obtener el informe", {
      status: 502,
    });
  }

  const filename = `${informe.slug}.pdf`;

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      // inline => el visor lo embebe; sigue siendo descargable desde el botón.
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
