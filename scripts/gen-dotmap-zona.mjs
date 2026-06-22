// Genera components/institucional/worldDotsZona.ts: grilla densa de puntos sobre
// tierra firme de UNA zona del mundo (por defecto las Américas), como pares
// [lon, lat]. La usa FondoMundo para el "mapa de puntos" grande y en diagonal del
// Resumen del fondo. Más fino que el dotmap global (se muestra en grande). Se
// corre UNA vez y queda commiteado.
//
// Uso: node scripts/gen-dotmap-zona.mjs

import { writeFileSync } from "node:fs";

const SRC =
  "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json";

// Zona a mostrar (las Américas, con Uruguay incluido).
const ZONE = { lonMin: -135, lonMax: -28, latMin: -56, latMax: 62 };
const STEP = 1.3; // grados entre puntos (denso: se muestra en grande)

const geo = await (await fetch(SRC)).json();

function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inPolygon(lon, lat, rings) {
  if (!inRing(lon, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) if (inRing(lon, lat, rings[i])) return false;
  return true;
}

const polys = [];
for (const f of geo.features) {
  const g = f.geometry;
  if (!g) continue;
  const sets = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  for (const rings of sets) {
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lon, lat] of rings[0]) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    polys.push({ rings, minLon, maxLon, minLat, maxLat });
  }
}

const dots = [];
for (let lat = ZONE.latMin; lat <= ZONE.latMax; lat += STEP) {
  for (let lon = ZONE.lonMin; lon <= ZONE.lonMax; lon += STEP) {
    const hit = polys.some(
      (p) =>
        lon >= p.minLon && lon <= p.maxLon && lat >= p.minLat && lat <= p.maxLat &&
        inPolygon(lon, lat, p.rings),
    );
    if (hit) dots.push([+lon.toFixed(2), +lat.toFixed(2)]);
  }
}

const out = `// GENERADO por scripts/gen-dotmap-zona.mjs — no editar a mano.
// Puntos de tierra firme de una zona del mundo (Américas), [lon, lat].

export const ZONE = ${JSON.stringify(ZONE)} as const;

export const ZDOTS: [number, number][] = ${JSON.stringify(dots)};
`;

writeFileSync(new URL("../components/institucional/worldDotsZona.ts", import.meta.url), out);
console.log(`ok: ${dots.length} puntos · zona ${JSON.stringify(ZONE)}`);
