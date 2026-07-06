import { thumbUpstream, isVideoId } from "@/lib/youtube";

// Proxy same-origin de las miniaturas de YouTube (i.ytimg.com), para no relajar
// el CSP img-src 'self'. Intenta maxresdefault y cae a hqdefault (que siempre
// existe). El id se valida: nunca se arma una URL upstream con input arbitrario.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isVideoId(id)) {
    return new Response("not found", { status: 404 });
  }

  for (const q of ["maxresdefault", "hqdefault"] as const) {
    try {
      const res = await fetch(thumbUpstream(id, q));
      const ct = res.headers.get("content-type") ?? "";
      // maxresdefault devuelve 404 cuando no existe → pasa a hqdefault.
      if (res.ok && res.body && ct.startsWith("image/")) {
        return new Response(res.body, {
          headers: {
            "Content-Type": ct,
            "Cache-Control": "public, max-age=86400, s-maxage=604800",
          },
        });
      }
    } catch {
      /* siguiente calidad */
    }
  }
  return new Response("not found", { status: 404 });
}
