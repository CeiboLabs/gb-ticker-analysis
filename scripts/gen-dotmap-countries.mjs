// Genera components/institucional/worldDotsCountries.ts: el código de país
// (ISO 3166-1 alfa-3) de CADA punto de GDOTS, en el mismo orden.
//
// Por qué existe: <FondoGeografia /> pinta el mapa de puntos por región, y las
// regiones del fondo NO son cajas de lat/lon — "Mercados Emergentes" y "Asia
// Desarrollada" son clasificaciones de mercado (México es EM aunque esté en
// Norteamérica; Polonia es EM aunque esté en Europa; Japón es desarrollado y
// China no). Con el país de cada punto, esa clasificación es una tabla legible
// en el componente en vez de una geometría inventada.
//
// Reusa EXACTAMENTE la grilla y la proyección de gen-dotmap-global.mjs, y
// verifica dot por dot que la secuencia generada sea idéntica a la GDOTS ya
// commiteada: si el GeoJSON de upstream cambió, el script aborta en vez de
// desalinear el mapa en silencio.
//
// Se corre UNA vez y el resultado queda commiteado.
//
// Uso: node scripts/gen-dotmap-countries.mjs

import { writeFileSync, readFileSync } from "node:fs";

const SRC =
  "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json";

// Idénticos a gen-dotmap-global.mjs — no tocar por separado.
const LON0 = -168, LON1 = 192;
const LAT0 = -56, LAT1 = 74;
const STEP = 2.4;
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

// A diferencia del generador de puntos, acá cada polígono recuerda su país.
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
    polys.push({ cc: f.id || "???", rings, minLon, maxLon, minLat, maxLat });
  }
}

const px = (lon) => ((lon - LON0) / (LON1 - LON0)) * W;
const py = (lat) => ((LAT1 - lat) / (LAT1 - LAT0)) * H;

const dots = [];
const ccs = [];
for (let lat = LAT0 + STEP / 2; lat < LAT1; lat += STEP) {
  for (let lon = LON0 + STEP / 2; lon < LON1; lon += STEP) {
    const hit = polys.find(
      (p) =>
        lon >= p.minLon && lon <= p.maxLon &&
        lat >= p.minLat && lat <= p.maxLat &&
        inPolygon(lon, lat, p.rings),
    );
    if (hit) {
      dots.push([+px(lon).toFixed(1), +py(lat).toFixed(1)]);
      ccs.push(hit.cc);
    }
  }
}

// ── Verificación: la secuencia tiene que coincidir con la GDOTS commiteada ──
const src = readFileSync("components/institucional/worldDotsGlobal.ts", "utf8");
const m = src.match(/export const GDOTS: \[number, number\]\[\] = (\[.*?\]);/s);
if (!m) throw new Error("No pude leer GDOTS de worldDotsGlobal.ts");
const committed = JSON.parse(m[1]);
if (committed.length !== dots.length) {
  throw new Error(`Desalineado: GDOTS tiene ${committed.length} puntos y generé ${dots.length}. El GeoJSON de upstream cambió — regenerá worldDotsGlobal.ts también.`);
}
for (let i = 0; i < dots.length; i++) {
  if (committed[i][0] !== dots[i][0] || committed[i][1] !== dots[i][1]) {
    throw new Error(`Desalineado en el punto ${i}: commiteado ${committed[i]} vs generado ${dots[i]}. El GeoJSON de upstream cambió.`);
  }
}

const presentes = [...new Set(ccs)].sort();
console.log(`${dots.length} puntos, ${presentes.length} países con al menos un punto.`);
console.log("Países presentes:", presentes.join(" "));

const out = `// GENERADO por scripts/gen-dotmap-countries.mjs — no editar a mano.
// País (ISO 3166-1 alfa-3) de cada punto de GDOTS, en el MISMO orden y con el
// mismo largo. Lo usa <FondoGeografia /> para clasificar cada punto por región
// de inversión (que no es una caja de lat/lon: ver el comentario del generador).
//
// Los países que a esta resolución (grilla de ${STEP}°) no tienen ningún punto no
// aparecen acá: Singapur y Hong Kong, entre otros, son demasiado chicos.

export const GDOTS_CC: string[] = ${JSON.stringify(ccs)};
`;

writeFileSync("components/institucional/worldDotsCountries.ts", out);
console.log("Escrito components/institucional/worldDotsCountries.ts");
