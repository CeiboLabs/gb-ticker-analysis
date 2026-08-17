// Rótulos del eje de tiempo de los gráficos.
//
// El defecto que motivó el módulo no se ve como un error: el eje sigue
// dibujando, pero dice «3». Es lo que pasaba en «Máx» del backtest en el
// teléfono —«3  2023  3  2025  Feb.»— porque lightweight-charts elige la
// posición de la marca por distancia en índices y después la rotula por su peso,
// y una marca de DÍA puede terminar ocupando el lugar de una de año. Nada falla,
// nada se loguea; sólo queda un eje que no se puede leer.
//
// Las marcas de acá abajo son las que la librería eligió DE VERDAD (leídas del
// canvas en la página, ver el comentario del módulo): lo que se prueba es que
// con ese reparto de marcas el rótulo salga legible.

import { test } from "node:test";
import assert from "node:assert/strict";
import { partesDeTiempo, rotulosEjeTiempo } from "../components/ejeTiempo";

// Tipos de marca de lightweight-charts.
const ANIO = 0, MES = 1, DIA = 2, HORA = 3;

/** Serie diaria de días hábiles entre dos fechas, como la recibe el gráfico. */
function diasHabiles(desde: string, hasta: string): string[] {
  const out: string[] = [];
  const d = new Date(`${desde}T00:00:00Z`);
  const fin = new Date(`${hasta}T00:00:00Z`);
  while (d <= fin) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const SUELTO = /^\d{1,2}$/;

test("«Máx» del backtest: ninguna marca queda en un número suelto", () => {
  const rotulo = rotulosEjeTiempo(diasHabiles("2022-01-03", "2026-07-01"));
  // Las cinco marcas que la librería puso en el teléfono (370px). La segunda y
  // la cuarta son de AÑO; la primera y la tercera son de DÍA ocupando el lugar
  // de la marca de año que quedó afuera por un índice: ahí salía el «3».
  const marcas: [string, number][] = [
    ["2022-01-03", DIA], ["2023-01-03", ANIO], ["2024-01-03", DIA],
    ["2025-01-02", ANIO], ["2026-02-02", MES],
  ];
  const rotulos = marcas.map(([t, tipo]) => rotulo(t, tipo));
  assert.deepEqual(rotulos, ["ene '22", "ene '23", "ene '24", "ene '25", "feb '26"]);
  for (const r of rotulos) assert.ok(!SUELTO.test(r ?? ""), `rótulo suelto: ${r}`);
});

test("ventana de un año: el año se dice una vez, en su marca", () => {
  const rotulo = rotulosEjeTiempo(diasHabiles("2025-08-15", "2026-08-14"));
  assert.equal(rotulo("2025-09-01", MES), "sep");
  assert.equal(rotulo("2026-01-02", ANIO), "2026");   // la convención de siempre
  assert.equal(rotulo("2026-03-02", MES), "mar");
});

test("ventana corta: todas las marcas llevan día y mes", () => {
  const rotulo = rotulosEjeTiempo(diasHabiles("2026-07-16", "2026-08-14"));
  assert.equal(rotulo("2026-07-16", DIA), "16 jul");
  assert.equal(rotulo("2026-07-24", DIA), "24 jul");
  assert.equal(rotulo("2026-08-03", MES), "3 ago");   // arranque de mes, con día
});

test("la marca de día a mitad de mes no se colapsa: el eje no repite el vecino", () => {
  // Backtest 2024 en desktop (1.114px): la última marca cae el 31 de diciembre y
  // la anterior es la de diciembre. Colapsándola salía «… nov  dic  dic».
  const rotulo = rotulosEjeTiempo(diasHabiles("2023-12-29", "2024-12-31"));
  assert.equal(rotulo("2024-12-02", MES), "dic");
  assert.equal(rotulo("2024-12-31", DIA), "31 dic");
  // Y en una ventana de años, lo mismo contra el mes de al lado.
  const largo = rotulosEjeTiempo(diasHabiles("2022-01-03", "2026-07-01"));
  assert.equal(largo("2026-06-01", MES), "jun '26");
  assert.equal(largo("2026-06-24", DIA), "24 jun");
});

test("intradía: la hora va en el reloj de Uruguay", () => {
  const bar = (iso: string) => Date.parse(iso) / 1000;
  const dia = [bar("2026-08-14T13:30:00Z"), bar("2026-08-14T20:00:00Z")];
  const rotulo = rotulosEjeTiempo(dia);
  assert.equal(rotulo(bar("2026-08-14T17:30:00Z"), HORA), "14:30");   // −03
  assert.equal(rotulo(bar("2026-08-14T13:30:00Z"), DIA), "14 ago");
});

test("un cierre diario no se corre un día por el huso del lector", () => {
  // 'YYYY-MM-DD' con new Date() es medianoche UTC: leerlo con getDate() desde
  // Montevideo devolvía el 13. Es el mismo error que tenía la lectura del tramo
  // en /analisis.
  const p = partesDeTiempo("2026-08-14");
  assert.deepEqual(p, { anio: 2026, mes: 8, dia: 14, hora: "" });
});

test("ningún rótulo pasa de 8 caracteres", () => {
  // Es el presupuesto que reserva la librería por marca; más largo y las marcas
  // se pisan entre sí.
  const ventanas = [
    diasHabiles("2026-07-16", "2026-08-14"),   // 1M
    diasHabiles("2026-05-16", "2026-08-14"),   // 3M
    diasHabiles("2026-01-01", "2026-08-14"),   // YTD
    diasHabiles("2025-08-15", "2026-08-14"),   // 1A
    diasHabiles("2022-01-03", "2026-07-01"),   // Máx
  ];
  for (const v of ventanas) {
    const rotulo = rotulosEjeTiempo(v);
    for (const t of v) {
      for (const tipo of [ANIO, MES, DIA]) {
        const r = rotulo(t, tipo) ?? "";
        assert.ok(r.length <= 8, `«${r}» (${t}, tipo ${tipo}) mide ${r.length}`);
        assert.ok(!SUELTO.test(r), `rótulo suelto: «${r}» (${t}, tipo ${tipo})`);
      }
    }
  }
});
