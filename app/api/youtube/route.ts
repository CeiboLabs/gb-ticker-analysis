import { NextResponse } from "next/server";
import {
  YOUTUBE_CHANNEL_ID,
  FEATURED_VIDEO_ID,
  rssUrl,
  oembedUrl,
  parseRss,
  isVideoId,
  type YtVideo,
} from "@/lib/youtube";
import { getMetricsDb } from "@/lib/metrics";
import { readFlag } from "@/lib/flags";
import { reboteGetPublico, trustedClientIp } from "@/lib/rateLimiter";

// Videos del canal para el módulo "En video" de /informes. Lee el RSS público del canal
// (sin API key), elige el destacado (env YOUTUBE_FEATURED_ID > constante > más
// reciente) y devuelve los 2 últimos restantes. Sólo lectura; el fetch server-side
// no está sujeto al CSP (eso es del browser). Vacío ⇒ el módulo no aparece.
//
// Gateado por el flag `videos_casa` (panel → Secciones): apagado ⇒ respuesta
// vacía ⇒ VideosDeLaCasa no se monta. El proxy de miniaturas y el VideoEmbed de
// los informes mensuales NO pasan por acá — no dependen del flag.

const REVALIDATE = 3600; // el RSS cambia con cada video nuevo; 1 h alcanza

type PublicVideo = {
  id: string;
  title: string;
  published: string;
  thumb: string;
  watch: string;
};

function toPublic(v: YtVideo): PublicVideo {
  return {
    id: v.id,
    title: v.title,
    published: v.published,
    thumb: `/api/youtube/thumb/${v.id}`,
    watch: `https://www.youtube.com/watch?v=${v.id}`,
  };
}

// ≤5 min de cache para que el toggle del panel se refleje rápido en el sitio.
const CACHE = { "Cache-Control": "public, max-age=300, s-maxage=300" };

async function oembedVideo(id: string): Promise<YtVideo | null> {
  try {
    const res = await fetch(oembedUrl(id), { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const j = (await res.json()) as { title?: unknown };
    return { id, title: typeof j.title === "string" ? j.title : "Video", published: "" };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const rebote = reboteGetPublico("youtube", trustedClientIp(req));
  if (rebote) return rebote;
  if (!(await readFlag(getMetricsDb(), "videos_casa"))) {
    return NextResponse.json({ featured: null, latest: [] }, { headers: CACHE });
  }
  let videos: YtVideo[] = [];
  try {
    const res = await fetch(rssUrl(YOUTUBE_CHANNEL_ID), {
      headers: { Accept: "application/atom+xml" },
      next: { revalidate: REVALIDATE },
    });
    if (res.ok) videos = parseRss(await res.text());
  } catch {
    /* devolvemos vacío abajo */
  }

  if (videos.length === 0) {
    return NextResponse.json({ featured: null, latest: [] }, { headers: CACHE });
  }

  const envFeatured = process.env.YOUTUBE_FEATURED_ID;
  const featuredId = isVideoId(envFeatured)
    ? envFeatured
    : isVideoId(FEATURED_VIDEO_ID)
      ? FEATURED_VIDEO_ID
      : videos[0].id;

  // El destacado puede estar fuera del RSS (evergreen viejo): metadata por oEmbed.
  const featured = videos.find((v) => v.id === featuredId) ?? (await oembedVideo(featuredId)) ?? videos[0];

  const latest = videos.filter((v) => v.id !== featured.id).slice(0, 2);

  return NextResponse.json(
    { featured: toPublic(featured), latest: latest.map(toPublic) },
    { headers: CACHE },
  );
}
