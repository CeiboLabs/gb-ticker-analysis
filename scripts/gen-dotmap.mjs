// Genera components/institucional/worldDots.ts: grilla de puntos sobre tierra
// firme (Américas + Europa, proyección equirrectangular) para el mapa de la
// sección Plazas. Se corre UNA vez y el resultado queda commiteado — sin
// dependencias ni fetches en runtime.
//
// Uso: node scripts/gen-dotmap.mjs

import { writeFileSync } from "node:fs";

const SRC =
  "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json";

// Región: Atlántico (Américas + Europa) — todas las plazas viven acá.
const LON0 = -105, LON1 = 25;
const LAT0 = -58, LAT1 = 64;
const STEP = 1.7; // grados entre puntos de la grilla

// ViewBox del SVG destino.
const W = 1000;
const H = Math.round((W * (LAT1 - LAT0)) / (LON1 - LON0));

const geo = await (await fetch(SRC)).json();

// Ray casting clásico. ring: [[lon, lat], ...]
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

// Polygon GeoJSON: ring 0 = exterior, resto = agujeros.
function inPolygon(lon, lat, rings) {
  if (!inRing(lon, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (inRing(lon, lat, rings[i])) return false;
  }
  return true;
}

// Pre-filtrado por bounding box para no testear polígonos lejanos.
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
    if (maxLon < LON0 || minLon > LON1 || maxLat < LAT0 || minLat > LAT1) continue;
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

const out = `// GENERADO por scripts/gen-dotmap.mjs — no editar a mano.
// Puntos de tierra firme (Américas + Europa), proyección equirrectangular.

export const MAP_W = ${W};
export const MAP_H = ${H};
export const MAP_LON = [${LON0}, ${LON1}] as const;
export const MAP_LAT = [${LAT0}, ${LAT1}] as const;

/** Proyecta [lon, lat] → [x, y] en el viewBox del mapa. */
export function project(lon: number, lat: number): [number, number] {
  return [
    ((lon - ${LON0}) / ${LON1 - LON0}) * MAP_W,
    ((${LAT1} - lat) / ${LAT1 - LAT0}) * MAP_H,
  ];
}

export const DOTS: [number, number][] = ${JSON.stringify(dots)};
`;

writeFileSync(new URL("../components/institucional/worldDots.ts", import.meta.url), out);
console.log(`ok: ${dots.length} puntos · viewBox ${W}×${H}`);
