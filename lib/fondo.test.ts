// Tenencias del fondo: qué se publica y cuándo.
//
// El caso que importa es el de HOY: el Fondo está autorizado pero todavía no
// comenzó a funcionar, así que `fund_nav` está vacía. La cartera es un dato
// INDEPENDIENTE de la serie de valor cuota y tiene que poder publicarse igual —
// una regresión acá deja el bloque "Mayores tenencias" invisible en producción
// sin que nada falle ni se loguee.

import { test } from "node:test";
import assert from "node:assert/strict";
import { getFundSnapshot, preLaunchWithBenchmark } from "./fondo";
import { readLatestHoldings } from "./fondoStore";
import type { D1Database, D1PreparedStatement } from "./metrics";

type Rows = Record<string, unknown[]>;

// D1 de mentira: rutea por la tabla que nombra el SQL. Alcanza para las tres
// lecturas de getFundSnapshot (fund_nav / fund_benchmark / fund_holdings_*).
// La consulta de snapshots SÍ aplica su `as_of <= ?`, que es justo la cláusula
// que implementa el rezago de divulgación y lo único que vale la pena probar.
function fakeDb(rows: Rows): D1Database {
  const stmt = (sql: string, bound: unknown[] = []): D1PreparedStatement => {
    const pick = () => {
      if (sql.includes("fund_nav")) return rows.nav ?? [];
      if (sql.includes("fund_benchmark")) return rows.benchmark ?? [];
      if (sql.includes("fund_holdings_snapshot")) {
        const cutoff = String(bound[0] ?? "9999-12-31");
        return (rows.snapshot ?? []).filter((r) => String((r as { as_of: string }).as_of) <= cutoff);
      }
      if (sql.includes("fund_holdings_item")) return rows.items ?? [];
      return [];
    };
    const self: D1PreparedStatement = {
      bind: (...values: unknown[]) => stmt(sql, values),
      run: async () => ({}),
      all: async () => ({ results: pick() as never[] }),
      first: async () => (pick()[0] ?? null) as never,
    };
    return self;
  };
  return { prepare: (sql: string) => stmt(sql), batch: async () => [] };
}

const HOLDINGS: Rows = {
  snapshot: [{ as_of: "2026-05-31" }],
  items: [
    { ord: 0, name: "Jupiter Merian World Equity Fund L (USD) Acc", short: "Jupiter World Equity", asset_class: "RV", weight_bps: 6000 },
    { ord: 1, name: "SPDR Gold Shares", short: "SPDR Gold Shares", asset_class: "ALT", weight_bps: 4000 },
  ],
};

test("pre-lanzamiento: sin serie de valor cuota, la cartera se publica igual", async () => {
  const snap = await getFundSnapshot(fakeDb(HOLDINGS));
  assert.equal(snap.holdings?.asOf, "2026-05-31");
  assert.equal(snap.holdings?.items.length, 2);
  assert.equal(snap.holdings?.items[1].assetClass, "ALT");
});

test("con serie: status live y la cartera viaja en el mismo snapshot", async () => {
  const snap = await getFundSnapshot(
    fakeDb({ ...HOLDINGS, nav: [{ dia: "2026-05-30", nav: 1000, aum: null }, { dia: "2026-06-01", nav: 1010, aum: null }] }),
  );
  assert.equal(snap.status, "live");
  assert.equal(snap.asOf, "2026-06-01");
  assert.equal(snap.holdings?.items.length, 2);
});

test("sin snapshot divulgable no se inventa cartera", async () => {
  const snap = await getFundSnapshot(fakeDb({}));
  assert.equal(snap.holdings, null);
});

// ── Pre-lanzamiento con benchmark ────────────────────────────────────────────
//
// El día del lanzamiento el Fondo no tiene ni un cierre propio, pero sí
// mostramos la evolución del benchmark de referencia. Lo que hay que proteger es
// que esa serie NO se filtre a los campos del fondo: un valor cuota, un
// rendimiento o un "status: live" prestados de la referencia serían un track
// record inventado en una página pública de un producto regulado.

const BENCH: Rows = {
  benchmark: [
    { dia: "2024-01-02", level: 100 },
    { dia: "2025-01-02", level: 110 },
    { dia: "2026-01-02", level: 121 },
    { dia: "2026-07-28", level: 130 },
  ],
};

test("sin serie del fondo pero con benchmark: se grafica la referencia, no el fondo", async () => {
  const snap = await getFundSnapshot(fakeDb({ ...HOLDINGS, ...BENCH }));

  // La referencia viaja entera y con sus rendimientos calculados.
  assert.equal(snap.benchmark.length, 4);
  assert.ok(Math.abs((snap.benchReturns.find((r) => r.key === "SI")?.pct ?? 0) - 30) < 1e-9);
  assert.ok(snap.benchCalendar.length > 0);

  // …y el fondo sigue sin historia: nada prestado del benchmark.
  assert.equal(snap.status, "pre-launch");
  assert.equal(snap.asOf, null);
  assert.equal(snap.latest, null);
  assert.equal(snap.series.length, 0);
  assert.ok(snap.returns.every((r) => r.pct === null));
  assert.equal(snap.calendar.length, 0);
  assert.equal(snap.stats.annualizedSI, null);
  assert.equal(snap.stats.vol1y, null);

  // La cartera se sigue publicando igual (es un dato independiente).
  assert.equal(snap.holdings?.items.length, 2);
});

test("un solo punto de benchmark no alcanza para graficar", async () => {
  // Un punto no es una curva: ni rendimientos ni años calendario.
  const snap = preLaunchWithBenchmark([{ dia: "2026-07-28", nav: 100, aum: null }]);
  assert.equal(snap.benchReturns.length, 0);
  assert.equal(snap.benchCalendar.length, 0);
  assert.equal(snap.status, "pre-launch");

  // Y getFundSnapshot tampoco lo publica como serie del gráfico (con un solo
  // punto sigue de largo al camino de siempre: placeholder en dev, vacío en prod).
  const routed = await getFundSnapshot(fakeDb({ benchmark: [{ dia: "2026-07-28", level: 100 }] }));
  assert.notEqual(routed.benchmark.length, 1);
});

test("el modo demo está APAGADO salvo que alguien setee FONDO_DEMO=1", async () => {
  // Propiedad de seguridad, no detalle: el demo inventa un valor cuota que la
  // página no distingue de uno real. Si algún día el default se invierte, esto
  // rompe acá y no en una instancia que vea un inversor.
  assert.notEqual(process.env.FONDO_DEMO, "1");
  const snap = await getFundSnapshot(fakeDb(BENCH));
  assert.equal(snap.status, "pre-launch");
  assert.equal(snap.latest, null);
  assert.equal(snap.series.length, 0);
});

test("cuando llega el primer valor cuota, el fondo toma el protagonismo", async () => {
  const snap = await getFundSnapshot(
    fakeDb({
      benchmark: [...(BENCH.benchmark as unknown[]), { dia: "2026-07-29", level: 131 }],
      nav: [
        { dia: "2026-07-28", nav: 1000, aum: 5_000_000 },
        { dia: "2026-07-29", nav: 1002, aum: 5_010_000 },
      ],
    }),
  );
  assert.equal(snap.status, "live");
  assert.equal(snap.latest?.nav, 1002);
  // El benchmark pasa a segunda línea y se ACOTA a la vida del fondo: los años
  // previos que tiene cargados no pueden colarse en la comparación (si no, el
  // «desde inicio» del fondo se mediría contra el del benchmark desde 2024).
  assert.deepEqual(
    snap.benchmark.map((p) => p.dia),
    ["2026-07-28", "2026-07-29"],
  );
  assert.ok(Math.abs((snap.benchReturns.find((r) => r.key === "SI")?.pct ?? 0) - (131 / 130 - 1) * 100) < 1e-9);
});

test("el rezago de divulgación filtra por as_of <= hoy - lagDays", async () => {
  const nowMs = Date.parse("2026-07-28T12:00:00Z");
  const hoy = fakeDb({ ...HOLDINGS, snapshot: [{ as_of: "2026-07-28" }] });

  // Con rezago 0 (Fondo sin operar) la cartera del día ya es divulgable…
  assert.equal((await readLatestHoldings(hoy, 0, nowMs))?.asOf, "2026-07-28");
  // …y con el rezago de 30 días que vuelve cuando empiece a operar, no.
  assert.equal(await readLatestHoldings(hoy, 30, nowMs), null);
  // Un snapshot viejo pasa los dos filtros.
  assert.equal((await readLatestHoldings(fakeDb(HOLDINGS), 30, nowMs))?.asOf, "2026-05-31");
});
