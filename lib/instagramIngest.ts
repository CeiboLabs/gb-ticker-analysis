// Feed de Instagram — normalización de los posteos que trae la API.
//
// Núcleo PURO y agnóstico del runtime: nada de process.env, Next, I/O a D1 ni
// fetch. Lo usa el scheduled worker (workers/instagram-ingest) para convertir la
// respuesta cruda de la API de Instagram (Instagram Login) en filas listas para
// instagram_posts, y decidir qué imagen (still) bajar por cada posteo. La lógica
// de "qué es publicable y cuál es su imagen" vive en un solo lado.
//
// Contrato con la API (host graph.instagram.com, Instagram Login):
//   GET /me/media?fields=<MEDIA_FIELDS>&limit=N&access_token=…  → { data: [ item ] }
//   Cada item: { id, media_type, media_url?, thumbnail_url?, permalink, caption?,
//                timestamp, children?: { data: [ { media_type, media_url?, thumbnail_url? } ] } }

// Campos que pedimos. children{...} trae la portada de los carruseles.
export const MEDIA_FIELDS =
  "id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,children{media_type,media_url,thumbnail_url}";

// Los epígrafes de Instagram llegan hasta ~2200 chars; guardamos el completo con
// un tope defensivo (el componente decide cuánto muestra).
export const CAPTION_MAX = 2200;

export type MediaType = "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";

// Fila ya normalizada, lista para instagram_posts. imageUrl es la URL del CDN
// (temporal) desde donde el worker baja el still hacia R2 — NO se persiste.
export type NormalizedPost = {
  id: string;
  caption: string | null;
  permalink: string;
  mediaType: MediaType;
  takenAt: string;   // ISO8601 original, para mostrar
  takenAtMs: number; // epoch ms, para ordenar
  imageUrl: string;  // still a bajar (CDN temporal de Instagram)
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/** URL https válida (rechaza esquemas raros y URLs relativas). */
export function isHttpsUrl(v: unknown): v is string {
  if (typeof v !== "string") return false;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

function cleanCaption(v: unknown): string | null {
  if (typeof v !== "string") return null;
  // Conservamos saltos de línea (son significativos en un epígrafe); sólo
  // recortamos extremos y topeamos el largo.
  const s = v.replace(/\r\n/g, "\n").trim();
  return s ? s.slice(0, CAPTION_MAX) : null;
}

function normMediaType(v: unknown): MediaType {
  return v === "VIDEO" || v === "CAROUSEL_ALBUM" ? v : "IMAGE";
}

type RawChild = { media_type?: unknown; media_url?: unknown; thumbnail_url?: unknown };
type RawMediaItem = {
  id?: unknown;
  media_type?: unknown;
  media_url?: unknown;
  thumbnail_url?: unknown;
  permalink?: unknown;
  caption?: unknown;
  timestamp?: unknown;
  children?: { data?: unknown } | unknown;
};

/**
 * Elige el still a mostrar según el tipo de media:
 *  - IMAGE           → media_url
 *  - VIDEO           → thumbnail_url (el poster; media_url es el mp4)
 *  - CAROUSEL_ALBUM  → la primera diapositiva (imagen: media_url; video: thumbnail_url)
 * Con fallback al media_url/thumbnail_url de nivel superior. Devuelve null si no
 * hay ninguna imagen usable.
 */
export function pickImageUrl(item: RawMediaItem): string | null {
  const type = normMediaType(item.media_type);
  const topImage = asString(item.media_url);
  const topThumb = asString(item.thumbnail_url);

  if (type === "IMAGE") {
    return isHttpsUrl(topImage) ? topImage : null;
  }
  if (type === "VIDEO") {
    return isHttpsUrl(topThumb) ? topThumb : null;
  }
  // CAROUSEL_ALBUM: mirar la primera diapositiva.
  const children = (item.children as { data?: unknown } | undefined)?.data;
  if (Array.isArray(children) && children.length > 0) {
    const first = children[0] as RawChild;
    const childType = normMediaType(first.media_type);
    const childUrl =
      childType === "VIDEO" ? asString(first.thumbnail_url) : asString(first.media_url);
    if (isHttpsUrl(childUrl)) return childUrl;
  }
  // Fallbacks de nivel superior.
  if (isHttpsUrl(topImage)) return topImage;
  if (isHttpsUrl(topThumb)) return topThumb;
  return null;
}

/**
 * Normaliza un item crudo de la API a NormalizedPost. Devuelve null (se
 * descarta) si le falta lo esencial: id, permalink https o una imagen usable.
 */
export function normalizeMedia(item: RawMediaItem): NormalizedPost | null {
  const id = asString(item.id);
  const permalink = asString(item.permalink);
  if (!id || !isHttpsUrl(permalink)) return null;

  const imageUrl = pickImageUrl(item);
  if (!imageUrl) return null;

  const takenAtRaw = asString(item.timestamp);
  const takenAtMs = takenAtRaw ? Date.parse(takenAtRaw) : NaN;

  return {
    id,
    caption: cleanCaption(item.caption),
    permalink,
    mediaType: normMediaType(item.media_type),
    takenAt: takenAtRaw ?? "",
    takenAtMs: Number.isFinite(takenAtMs) ? takenAtMs : 0,
    imageUrl,
  };
}

/** Normaliza la lista completa, descartando los items inválidos, ordenada por fecha desc. */
export function normalizeMediaList(items: unknown): NormalizedPost[] {
  if (!Array.isArray(items)) return [];
  const posts: NormalizedPost[] = [];
  for (const it of items) {
    const p = normalizeMedia((it ?? {}) as RawMediaItem);
    if (p) posts.push(p);
  }
  posts.sort((a, b) => b.takenAtMs - a.takenAtMs);
  return posts;
}

// ── Constructores de URL de la API (puros) ───────────────────────────────────
// El worker sólo hace el fetch; acá se arma la URL para tener un solo lugar con
// el contrato de la API.

const GRAPH_BASE = "https://graph.instagram.com";

/** Endpoint de los últimos `limit` posteos de la cuenta dueña del token. */
export function mediaEndpoint(accessToken: string, limit: number): string {
  const p = new URLSearchParams({
    fields: MEDIA_FIELDS,
    limit: String(limit),
    access_token: accessToken,
  });
  return `${GRAPH_BASE}/me/media?${p.toString()}`;
}

/** Endpoint de refresh del token largo de Instagram Login (no requiere app secret). */
export function refreshEndpoint(accessToken: string): string {
  const p = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: accessToken,
  });
  return `${GRAPH_BASE}/refresh_access_token?${p.toString()}`;
}
