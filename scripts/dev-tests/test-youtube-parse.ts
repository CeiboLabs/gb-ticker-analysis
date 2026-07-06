// Test del parser del RSS de YouTube (lib/youtube). Puro, sin red.
// Correr:  npx tsx scripts/dev-tests/test-youtube-parse.ts

import { parseRss, isVideoId } from "../../lib/youtube";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; }
  else { fail++; console.error(`  ✗ ${name}`); }
}

// Muestra mínima con el formato del feed real de YouTube (channel-level <title>
// primero, luego <entry> por video, más nuevo primero).
const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <title>GASTON BENGOCHEA &amp; Cia CB</title>
  <published>2018-10-23T11:41:13+00:00</published>
  <entry>
    <yt:videoId>mWJ8df43m34</yt:videoId>
    <title>Webinar | Wall Street en MÁXIMOS &amp; la FED: ¿A DÓNDE MIRAR?</title>
    <published>2026-07-02T11:25:40+00:00</published>
  </entry>
  <entry>
    <yt:videoId>VZurikenThY</yt:videoId>
    <title>IRPF e inversiones en el exterior</title>
    <published>2026-06-25T14:09:05+00:00</published>
  </entry>
</feed>`;

const vids = parseRss(SAMPLE);

check("extrae exactamente 2 videos (no el <title> del canal)", vids.length === 2);
check("orden preservado, más nuevo primero", vids[0]?.id === "mWJ8df43m34" && vids[1]?.id === "VZurikenThY");
check("decodifica entidades XML (&amp; → &)", vids[0]?.title.includes("Wall Street en MÁXIMOS & la FED"));
check("conserva la fecha", vids[0]?.published === "2026-07-02T11:25:40+00:00");
check("no arrastra el título del canal", !vids.some((v) => v.title.startsWith("GASTON BENGOCHEA")));

// isVideoId
check("acepta un id válido (11 chars)", isVideoId("mWJ8df43m34"));
check("rechaza id con largo incorrecto", !isVideoId("abc"));
check("rechaza no-string", !isVideoId(null));
check("rechaza id con caracteres inválidos", !isVideoId("mWJ8df43m3/"));

// Feed vacío / basura
check("feed sin entries → []", parseRss("<feed><title>x</title></feed>").length === 0);
check("string vacío → []", parseRss("").length === 0);

console.log(`\nyoutube-parse: ${pass} ok, ${fail} fallaron`);
if (fail > 0) process.exit(1);
