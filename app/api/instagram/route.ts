import { NextResponse } from "next/server";
import { getMetricsDb } from "@/lib/metrics";
import { readLatestPosts, DEFAULT_FEED_LIMIT } from "@/lib/instagramStore";
import { readFlag } from "@/lib/flags";

// Últimos posteos de Instagram para el módulo del sitio. Sólo lectura desde D1;
// las imágenes NO se sirven acá — cada posteo trae `image` apuntando al proxy
// same-origin /api/instagram/media/[id] (el CSP sólo permite img-src 'self').
// Mientras instagram_posts esté vacía devuelve { posts: [] } y el frontend no
// muestra el módulo. Gateado además por el flag `instagram_feed` (panel →
// Secciones): apagado ⇒ { posts: [] } aunque haya posteos en D1.
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getMetricsDb();
  const habilitado = db ? await readFlag(db, "instagram_feed") : false;
  const posts = db && habilitado ? await readLatestPosts(db, DEFAULT_FEED_LIMIT) : [];
  const payload = {
    posts: posts.map((p) => ({
      id: p.id,
      caption: p.caption,
      permalink: p.permalink,
      mediaType: p.mediaType,
      takenAt: p.takenAt,
      image: `/api/instagram/media/${encodeURIComponent(p.id)}`,
    })),
  };
  return NextResponse.json(payload, {
    // Se refresca por cron cada pocas horas: cacheable unos minutos en el borde.
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}
