// Videos de YouTube del canal de la casa para la sección "En video" de /informes.
//
// Datos por el RSS PÚBLICO del canal (sin API key, sin cuota, sin worker):
// `https://www.youtube.com/feeds/videos.xml?channel_id=UC...`. Los 2 últimos son
// automáticos; el DESTACADO lo elige el cliente (constante FEATURED_VIDEO_ID u
// override por env YOUTUBE_FEATURED_ID sin redeploy) y, si no hay ninguno, cae al
// más reciente. Las miniaturas de YouTube (i.ytimg.com) NO expiran, pero igual se
// sirven same-origin por /api/youtube/thumb/[id] para mantener el CSP img-src 'self'.

export const YOUTUBE_CHANNEL_ID = "UC4-RSGaHdYK8_WNqJJP6HIA"; // @gastonbengocheaciacbs.acor7376
export const YOUTUBE_CHANNEL_URL = "https://youtube.com/@gastonbengocheaciacbs.acor7376";

// Destacado a mano (elegido por el cliente): JivcaakzMIM =
// GB "Finanzas y Futuro" con Claudio Zuchovicki. Override sin redeploy: env
// YOUTUBE_FEATURED_ID. Vacío ⇒ usa el video más reciente del canal.
export const FEATURED_VIDEO_ID = "JivcaakzMIM";

export type YtVideo = { id: string; title: string; published: string };

export function rssUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}
export function oembedUrl(id: string): string {
  const watch = `https://www.youtube.com/watch?v=${id}`;
  return `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`;
}
/** Miniatura upstream en i.ytimg. hqdefault siempre existe; maxresdefault a veces 404. */
export function thumbUpstream(id: string, quality: "maxresdefault" | "hqdefault" = "hqdefault"): string {
  return `https://i.ytimg.com/vi/${id}/${quality}.jpg`;
}
/** URL del reproductor privacy-enhanced (no setea cookies hasta que se reproduce). */
export function embedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

const ID_RE = /^[A-Za-z0-9_-]{11}$/;
export function isVideoId(v: unknown): v is string {
  return typeof v === "string" && ID_RE.test(v);
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Parseo mínimo del RSS/Atom de YouTube: una entrada por `<entry>`, ya ordenadas
 * más-nuevo-primero. Sin librería de XML (edge-safe). Toma sólo id, título y fecha.
 */
export function parseRss(xml: string): YtVideo[] {
  const out: YtVideo[] = [];
  const entries = xml.split("<entry>").slice(1);
  for (const e of entries) {
    const id = e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]?.trim();
    const rawTitle = e.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim();
    const published = e.match(/<published>([^<]+)<\/published>/)?.[1]?.trim();
    if (id && isVideoId(id) && rawTitle) {
      out.push({ id, title: decodeXml(rawTitle), published: published ?? "" });
    }
  }
  return out;
}
