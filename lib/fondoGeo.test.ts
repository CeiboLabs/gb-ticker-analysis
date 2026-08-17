// Exposición geográfica del fondo: validación de la forma y orden de la leyenda.
//
// Lo que se prueba acá es el borde entre la base y la página. `parseGeoTarget`
// es lo único que separa un valor corrupto en `fund_config` de un bloque roto
// en el sitio público, y su contrato es "devolver null, nunca tirar": si un día
// alguien lo hace lanzar, la página del fondo se cae por un dato decorativo.
//
// El orden de la leyenda se prueba porque es una regla que no se ve en el tipo:
// las filas van numeradas 01..05, así que tienen que salir ordenadas por peso o
// el rank contradice a los números.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGeoTarget, geoOrdenado, GEO_BASELINE, GEO_KEYS, GEO_TOTAL } from "./fondoGeo";

const OK = { NA: 46, EM: 24, EU: 22, AD: 5, OT: 3 };

test("acepta un objetivo válido y devuelve las cinco claves", () => {
  const t = parseGeoTarget(OK);
  assert.deepEqual(t, OK);
});

test("acepta el JSON crudo tal como sale de la columna value", () => {
  assert.deepEqual(parseGeoTarget(JSON.stringify(OK)), OK);
});

test("la línea de base del deploy pasa su propia validación", () => {
  // Si esto falla, el fallback publicaría algo que el panel rechazaría.
  assert.deepEqual(parseGeoTarget(GEO_BASELINE), GEO_BASELINE);
  assert.equal(
    GEO_KEYS.reduce((a, k) => a + GEO_BASELINE[k], 0),
    GEO_TOTAL,
  );
});

test("rechaza una suma distinta de 100", () => {
  assert.equal(parseGeoTarget({ ...OK, AD: 4 }), null); // suma 99
  assert.equal(parseGeoTarget({ ...OK, AD: 6 }), null); // suma 101
});

test("rechaza claves de más, de menos o desconocidas", () => {
  const sinUna: Record<string, number> = { ...OK };
  delete sinUna.OT;
  assert.equal(parseGeoTarget(sinUna), null);
  assert.equal(parseGeoTarget({ ...OK, XX: 0 }), null);
  // Una clave inventada EN LUGAR de una real: mismo conteo, sigue siendo inválido.
  const sinNa: Record<string, number> = { ...OK };
  delete sinNa.NA;
  assert.equal(parseGeoTarget({ ...sinNa, XX: 46 }), null);
});

test("rechaza valores que no son enteros dentro de rango", () => {
  assert.equal(parseGeoTarget({ ...OK, NA: 45.5, EM: 24.5 }), null);
  assert.equal(parseGeoTarget({ ...OK, NA: -1, EM: 71 }), null);
  assert.equal(parseGeoTarget({ ...OK, NA: "46" }), null);
  assert.equal(parseGeoTarget({ ...OK, NA: null }), null);
});

test("no tira con basura: devuelve null", () => {
  // El contrato entero del helper. Cualquiera de estos llega desde la base.
  for (const basura of [null, undefined, "", "{", "[]", 42, [], [1, 2], { }, "null"]) {
    assert.equal(parseGeoTarget(basura), null, `debería ser null: ${JSON.stringify(basura)}`);
  }
});

test("la leyenda sale por peso descendente", () => {
  const orden = geoOrdenado({ NA: 10, EM: 50, EU: 20, AD: 15, OT: 5 });
  assert.deepEqual(
    orden.map((r) => r.key),
    ["EM", "EU", "AD", "NA", "OT"],
  );
});

test("Otros / Efectivo va último aunque pese más que todos", () => {
  // No es una región que compita: es el residual que cierra el 100%. Si el
  // orden fuera puro peso, un día de mucha liquidez lo pondría primero.
  const orden = geoOrdenado({ NA: 10, EM: 10, EU: 10, AD: 10, OT: 60 });
  assert.equal(orden[orden.length - 1].key, "OT");
  assert.equal(orden[0].key, "NA");
});

test("la línea de base conserva el orden que ya mostraba la página", () => {
  assert.deepEqual(
    geoOrdenado(GEO_BASELINE).map((r) => r.key),
    ["NA", "EM", "EU", "AD", "OT"],
  );
});
