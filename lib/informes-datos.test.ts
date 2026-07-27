// Pruebas del autocompletado de datos del semanal (LRM del BCU + mini-tabla
// dólar/UI). Runner nativo `node:test` vía tsx (sin dependencias de test).
//   Unitarias (rápidas, sin red):   npm test
//   + Integración (BCU en vivo):    npm run test:int   (INTEGRATION=1)
// La lógica pura de fechas y ventanas se testea con datos sintéticos —ahí vivía
// el bug de zona horaria que se comía las subastas del viernes—.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { serialToISO, filtrarSubastasLRM, subastasLRMSemana } from "./bcuLRM";
import { miniTablaDolarUI, retornosRegional } from "./informesDatos";

const RUN_NET = !!process.env.INTEGRATION;

// Fila sintética de la hoja "LRM" (columnas 0-based: Fecha=0, Plazo=4, Venc=6, Tasa=26).
const isoToSerial = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000 + 25569;
function filaLRM(fecha: string | null, plazo: unknown, tasaFrac: unknown): unknown[] {
  const row: unknown[] = new Array(27).fill(null);
  if (fecha != null) {
    row[0] = isoToSerial(fecha);
    row[6] = isoToSerial(fecha);
  }
  row[4] = plazo;
  row[26] = tasaFrac;
  return row;
}

describe("serialToISO — fecha de Excel → ISO (determinista, sin timezone)", () => {
  it("convierte anchors conocidos", () => {
    assert.equal(serialToISO(44927), "2023-01-01");
    assert.equal(serialToISO(45658), "2025-01-01");
  });
  it("round-trip con isoToSerial", () => {
    for (const d of ["2026-05-22", "2019-01-02", "2026-07-17"]) {
      assert.equal(serialToISO(isoToSerial(d)), d);
    }
  });
});

describe("filtrarSubastasLRM — ventana semanal, orden y guardas", () => {
  const hasta = "2026-05-22"; // viernes; ventana = 2026-05-16 .. 2026-05-22
  const filas: unknown[][] = [
    ["Fecha", "Hora", null, null, "Plazo", null, "Venc."], // encabezado (strings) → descartado
    filaLRM("2026-05-22", 161, 0.059), // VIERNES — el caso del bug: debe incluirse
    filaLRM("2026-05-18", 34, 0.058), // lunes → incluida
    filaLRM("2026-05-16", 90, 0.06), // borde inicial → incluida
    filaLRM("2026-05-15", 30, 0.057), // fuera (previo a la ventana)
    filaLRM("2026-05-23", 45, 0.061), // fuera (posterior a hasta)
    filaLRM("2026-05-20", 77, "n/d"), // tasa no numérica → descartada
  ];
  const r = filtrarSubastasLRM(filas, hasta);

  it("incluye la subasta del propio viernes (regresión del bug de TZ)", () => {
    assert.ok(r.some((s) => s.plazo === 161 && s.fecha === "2026-05-22"));
  });
  it("respeta la ventana [lunes..viernes], descarta lo de afuera y ordena por plazo", () => {
    assert.deepEqual(
      r.map((s) => s.plazo),
      [34, 90, 161],
    );
  });
  it("descarta encabezados y filas con tasa no numérica", () => {
    assert.ok(!r.some((s) => s.plazo === 77));
  });
  it("pasa la tasa de fracción a porcentaje (2 decimales)", () => {
    assert.equal(r.find((s) => s.plazo === 34)?.tasa, 5.8);
    assert.equal(r.find((s) => s.plazo === 90)?.tasa, 6);
  });
});

describe("miniTablaDolarUI — ventanas Período / En el año / 1 año", () => {
  const hasta = "2026-07-17";
  const usd = [
    { t: "2025-07-17", v: 95 }, // 1 año atrás
    { t: "2025-12-31", v: 100 }, // cierre año anterior (YTD)
    { t: "2026-07-17", v: 99 }, // hasta
  ];
  const ui = [
    { t: "2025-07-17", v: 100 },
    { t: "2025-12-31", v: 102 },
    { t: "2026-07-17", v: 105 },
  ];
  const t = miniTablaDolarUI(usd, ui, hasta);

  it("Período = variación punta a punta (cuadra con el gráfico): USD 95→99 = +4,21%", () => {
    assert.equal(t.filas[0][0], "Período");
    assert.equal(t.filas[0][1], 4.21);
  });
  it("En el año = vs 31-dic (99/100 = −1%); 1 año = vs 365 días (99/95 = +4,21%)", () => {
    assert.equal(t.filas[1][0], "En el año");
    assert.equal(t.filas[1][1], -1);
    assert.equal(t.filas[2][0], "1 año");
    assert.equal(t.filas[2][1], 4.21);
  });
  it("series vacías → «s/d» (sin NaN ni crash)", () => {
    const vacio = miniTablaDolarUI([], [], hasta);
    assert.equal(vacio.filas[0][1], "s/d");
    assert.equal(vacio.filas[1][2], "s/d");
  });
});

// ── Integración: BCU en vivo. Descarga el xlsx real (TLS con cadena completa) y
//    valida contra la prosa de los informes. Correr con INTEGRATION=1. ─────────
describe("integración · LRM del BCU en vivo", { skip: !RUN_NET }, () => {
  it("05-22 reproduce EXACTO la prosa: 34/84/161 → 5,80/5,89/5,90", async () => {
    const s = await subastasLRMSemana("2026-05-22");
    const m = new Map(s.map((x) => [x.plazo, x.tasa]));
    assert.equal(m.get(34), 5.8);
    assert.equal(m.get(84), 5.89);
    assert.equal(m.get(161), 5.9);
  });
  it("05-29 reproduce EXACTO la prosa: 28/77/371 → 5,78/5,91/6,15", async () => {
    const s = await subastasLRMSemana("2026-05-29");
    const m = new Map(s.map((x) => [x.plazo, x.tasa]));
    assert.equal(m.get(28), 5.78);
    assert.equal(m.get(77), 5.91);
    assert.equal(m.get(371), 6.15);
  });
  it("semana anterior a la serie (2015) → vacío (deriva en bloque null, fail-soft)", async () => {
    assert.equal((await subastasLRMSemana("2015-05-22")).length, 0);
  });
  it("robustez: varios viernes recientes dan tasas sanas y ordenadas por plazo", async () => {
    for (const v of ["2026-06-19", "2026-06-26", "2026-07-03", "2026-07-10", "2026-07-17"]) {
      const s = await subastasLRMSemana(v);
      for (const x of s) {
        assert.ok(x.plazo > 0 && x.plazo < 4000, `plazo fuera de rango ${x.plazo} en ${v}`);
        assert.ok(x.tasa > 2 && x.tasa < 20, `tasa fuera de rango ${x.tasa} en ${v}`);
      }
      assert.deepEqual(
        s.map((x) => x.plazo),
        [...s.map((x) => x.plazo)].sort((a, b) => a - b),
        `subastas sin ordenar en ${v}`,
      );
    }
  });
  it("regional: los índices sin fuente (Chile/Perú/Colombia) van a faltantes, no se descartan", async () => {
    const b = await retornosRegional("2026-07-17");
    const indices = b.grupos.find((g) => g.nombre === "Índices");
    assert.ok(indices, "falta el grupo Índices");
    for (const etq of ["CHILE SLCT", "MSCI NUAM PERU", "COLOM COL"]) {
      assert.ok(indices.faltantes?.includes(etq), `${etq} debería estar en faltantes`);
    }
    assert.match(b.nota ?? "", /s\/d/); // la nota aclara el "s/d"
  });
});
