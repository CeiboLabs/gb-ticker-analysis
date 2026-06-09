// Genera components/institucional/worldDotsGlobal.ts: grilla de puntos sobre
// tierra firme de TODO el mundo (proyección equirrectangular), para el mapa
// "Selección Global" de la página del fondo. Variante global de
// scripts/gen-dotmap.mjs (que cubre solo Atlántico y lo usa PlazasStack).
// Se corre UNA vez y el resultado queda commiteado.
//
// Uso: node scripts/gen-dotmap-global.mjs

import { writeFileSync } from "node:fs";

const SRC =
  "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json";

// Mundo entero (incluye Asia/Oceanía).
const LON0 = -168, LON1 = 192;
const LAT0 = -56, LAT1 = 74;
const STEP = 2.4; // grados entre puntos (más espaciado: es decorativo y global)

const W = 1100;
const H = Math.round((W * (LAT1 - LAT0)) / (LON1 - LON0));

const geo = await (await fetch(SRC)).json();

function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function inPolygon(lon, lat, rings) {
  if (!inRing(lon, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (inRing(lon, lat, rings[i])) return false;
  }
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

const px = (lon) => ((lon - LON0) / (LON1 - LON0)) * W;
const py = (lat) => ((LAT1 - lat) / (LAT1 - LAT0)) * H;

const dots = [];
for (let lat = LAT0 + STEP / 2; lat < LAT1; lat += STEP) {
  for (let lon = LON0 + STEP / 2; lon < LON1; lon += STEP) {
    const hit = polys.some(
      (p) =>
        lon >= p.minLon && lon <= p.maxLon &&
        lat >= p.minLat && lat <= p.maxLat &&
        inPolygon(lon, lat, p.rings),
    );
    if (hit) dots.push([+px(lon).toFixed(1), +py(lat).toFixed(1)]);
  }
}

const out = `// GENERADO por scripts/gen-dotmap-global.mjs — no editar a mano.
// Puntos de tierra firme de todo el mundo, proyección equirrectangular.

export const GMAP_W = ${W};
export const GMAP_H = ${H};

/** Proyecta [lon, lat] → [x, y] en el viewBox del mapa global. */
export function gproject(lon: number, lat: number): [number, number] {
  return [
    ((lon - ${LON0}) / ${LON1 - LON0}) * GMAP_W,
    ((${LAT1} - lat) / ${LAT1 - LAT0}) * GMAP_H,
  ];
}

export const GDOTS: [number, number][] = ${JSON.stringify(dots)};
`;

writeFileSync(new URL("../components/institucional/worldDotsGlobal.ts", import.meta.url), out);
console.log(`ok: ${dots.length} puntos · viewBox ${W}×${H}`);
