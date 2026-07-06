import { NextResponse } from "next/server";
import { getInstagramMediaBucket } from "@/lib/metrics";
import { getImage, r2KeyForId } from "@/lib/instagramStore";

// Proxy same-origin de los stills de Instagram, servidos desde R2. Las imágenes
// no pueden hotlinkearse (las URLs del CDN de Instagram expiran) y además el CSP
// del sitio es img-src 'self'; el worker las copia a R2 y acá las re-emitimos
// desde nuestro propio dominio. El id se valida como numérico: nunca se arma una
// key de R2 con input arbitrario.
export const dynamic = "force-dynamic";

// Los media id de Instagram son enteros largos.
const ID_RE = /^\d{1,32}$/;

export async function GET(_req: Request, ctx: RouteContext<"/api/instagram/media/[id]">) {
  const { id } = await ctx.params;
  if (!ID_RE.test(id)) {
    return new NextResponse("not found", { status: 404 });
  }

  const bucket = getInstagramMediaBucket();
  if (!bucket) {
    return new NextResponse("not found", { status: 404 });
  }

  const object = await getImage(bucket, r2KeyForId(id));
  if (!object) {
    return new NextResponse("not found", { status: 404 });
  }

  const contentType = object.httpMetadata?.contentType ?? "image/jpeg";
  return new NextResponse(object.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // El still de un media id no cambia nunca ⇒ cache agresivo e inmutable.
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: object.httpEtag,
    },
  });
}
