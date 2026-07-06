// Tests de la normalización del feed de Instagram (lib/instagramIngest).
// Correr:  npx tsx scripts/dev-tests/test-instagram-ingest.ts
// Puro, sin red ni D1.

import {
  normalizeMedia,
  normalizeMediaList,
  pickImageUrl,
  mediaEndpoint,
  refreshEndpoint,
  CAPTION_MAX,
} from "../../lib/instagramIngest";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; }
  else { fail++; console.error(`  ✗ ${name}`); }
}

const IMG = "https://scontent.cdninstagram.com/img.jpg";
const THUMB = "https://scontent.cdninstagram.com/thumb.jpg";
const PERMA = "https://www.instagram.com/p/ABC123/";

// ── pickImageUrl por tipo ─────────────────────────────────────────────────────
{
  check("IMAGE → media_url", pickImageUrl({ media_type: "IMAGE", media_url: IMG }) === IMG);
}
{
  check("VIDEO → thumbnail_url", pickImageUrl({ media_type: "VIDEO", media_url: IMG, thumbnail_url: THUMB }) === THUMB);
}
{
  // VIDEO sin thumbnail no tiene still usable (media_url es el mp4, no imagen)
  check("VIDEO sin thumb → null", pickImageUrl({ media_type: "VIDEO", media_url: IMG }) === null);
}
{
  const item = { media_type: "CAROUSEL_ALBUM", children: { data: [{ media_type: "IMAGE", media_url: IMG }] } };
  check("CAROUSEL → primera diapositiva (imagen)", pickImageUrl(item) === IMG);
}
{
  const item = { media_type: "CAROUSEL_ALBUM", children: { data: [{ media_type: "VIDEO", thumbnail_url: THUMB }] } };
  check("CAROUSEL → primera diapositiva (video usa thumb)", pickImageUrl(item) === THUMB);
}
{
  // sin children usables cae al media_url de nivel superior
  const item = { media_type: "CAROUSEL_ALBUM", media_url: IMG, children: { data: [] } };
  check("CAROUSEL sin children → fallback media_url", pickImageUrl(item) === IMG);
}
{
  check("rechaza url no-https", pickImageUrl({ media_type: "IMAGE", media_url: "http://insecure/img.jpg" }) === null);
}

// ── normalizeMedia ────────────────────────────────────────────────────────────
{
  const p = normalizeMedia({ id: "123", media_type: "IMAGE", media_url: IMG, permalink: PERMA, caption: "hola", timestamp: "2026-06-03T12:00:00+0000" });
  check("normaliza un IMAGE completo", !!p && p.id === "123" && p.imageUrl === IMG && p.caption === "hola" && p.mediaType === "IMAGE");
  check("parsea takenAtMs", !!p && p.takenAtMs === Date.parse("2026-06-03T12:00:00+0000"));
}
{
  const p = normalizeMedia({ id: "1", media_type: "IMAGE", media_url: IMG /* sin permalink */, timestamp: "2026-06-03T12:00:00+0000" });
  check("descarta sin permalink", p === null);
}
{
  const p = normalizeMedia({ id: "1", media_type: "VIDEO", media_url: IMG, permalink: PERMA /* sin thumbnail */ });
  check("descarta sin imagen usable", p === null);
}
{
  const p = normalizeMedia({ media_type: "IMAGE", media_url: IMG, permalink: PERMA });
  check("descarta sin id", p === null);
}
{
  const long = "x".repeat(CAPTION_MAX + 500);
  const p = normalizeMedia({ id: "1", media_type: "IMAGE", media_url: IMG, permalink: PERMA, caption: long });
  check("topea el largo del epígrafe", !!p && p.caption!.length === CAPTION_MAX);
}
{
  const p = normalizeMedia({ id: "1", media_type: "IMAGE", media_url: IMG, permalink: PERMA, caption: "  con espacios  " });
  check("recorta extremos del epígrafe", !!p && p.caption === "con espacios");
}

// ── normalizeMediaList ────────────────────────────────────────────────────────
{
  const items = [
    { id: "a", media_type: "IMAGE", media_url: IMG, permalink: PERMA, timestamp: "2026-06-01T00:00:00+0000" },
    { id: "b", media_type: "IMAGE", media_url: IMG, permalink: PERMA, timestamp: "2026-06-05T00:00:00+0000" },
    { id: "c" /* inválido: sin imagen ni permalink */ },
  ];
  const list = normalizeMediaList(items);
  check("filtra inválidos y ordena por fecha desc", list.length === 2 && list[0].id === "b" && list[1].id === "a");
}
{
  check("lista no-array → vacío", normalizeMediaList(null).length === 0);
}

// ── constructores de URL ──────────────────────────────────────────────────────
{
  const url = mediaEndpoint("TOK EN&raro", 3);
  check("mediaEndpoint host + path", url.startsWith("https://graph.instagram.com/me/media?"));
  check("mediaEndpoint incluye limit", url.includes("limit=3"));
  check("mediaEndpoint url-encodea el token", url.includes("access_token=TOK+EN%26raro"));
  check("mediaEndpoint pide children", /children/.test(decodeURIComponent(url)));
}
{
  const url = refreshEndpoint("ABC");
  check("refreshEndpoint correcto", url === "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=ABC");
}

// ── resultado ────────────────────────────────────────────────────────────────
console.log(`\ninstagram-ingest: ${pass} ok, ${fail} fallaron`);
if (fail > 0) process.exit(1);
