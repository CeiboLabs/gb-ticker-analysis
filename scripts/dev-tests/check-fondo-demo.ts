// Chequeo del snapshot del fondo contra la base local — sin levantar el server.
//
// Sirve para ver qué va a mostrar la página antes de una presentación: si está
// en pre-lanzamiento, en modo sólo benchmark o con valor cuota, y con qué
// números. Lee la base en SÓLO LECTURA.
//
//   npx tsx scripts/dev-tests/check-fondo-demo.ts              # como se ve hoy
//   FONDO_DEMO=1 npx tsx scripts/dev-tests/check-fondo-demo.ts # con el demo prendido
//   DATA_DIR=/otro/dir npx tsx scripts/dev-tests/check-fondo-demo.ts

import path from "node:path";
import Database from "better-sqlite3";
import { getFundSnapshot } from "@/lib/fondo";
import type { D1Database, D1PreparedStatement } from "@/lib/metrics";

const file = path.join(process.env.DATA_DIR ?? "data", "bengochea.sqlite3");
const db = new Database(file, { readonly: true });

// Shim mínimo de D1 sobre better-sqlite3 — sólo lecturas, que es lo único que
// hace getFundSnapshot.
const shim: D1Database = {
  prepare(sql: string): D1PreparedStatement {
    const mk = (params: unknown[]): D1PreparedStatement => ({
      bind: (...v: unknown[]) => mk(v),
      run: async () => ({}),
      all: async () => ({ results: db.prepare(sql).all(...params) as never[] }),
      first: async () => (db.prepare(sql).get(...params) ?? null) as never,
    });
    return mk([]);
  },
  batch: async () => [],
};

const f = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(2));

async function main() {
  const s = await getFundSnapshot(shim);
  const modo =
    s.status === "live"
      ? process.env.FONDO_DEMO === "1"
        ? "VALOR CUOTA (⚠️ SIMULADO — FONDO_DEMO=1)"
        : "VALOR CUOTA (datos reales)"
      : s.benchmark.length > 1
        ? "SÓLO BENCHMARK (pre-lanzamiento con referencia)"
        : "PRE-LANZAMIENTO (gráfico vacío)";

  console.log(`base        ${file}`);
  console.log(`modo        ${modo}`);
  console.log(`asOf        ${s.asOf ?? "—"}`);
  console.log(`valor cuota ${f(s.latest?.nav)} USD · día ${f(s.latest?.changePct)}%`);
  console.log(`AUM         ${s.latest?.aum?.toLocaleString("es-UY") ?? "—"}`);
  console.log(`serie fondo ${s.series.length} ${s.series[0]?.dia ?? ""} → ${s.series.at(-1)?.dia ?? ""}`);
  console.log(`benchmark   ${s.benchmark.length} ${s.benchmark[0]?.dia ?? ""} → ${s.benchmark.at(-1)?.dia ?? ""}`);
  console.log(`retornos    ${s.returns.map((r) => `${r.key} ${f(r.pct)}%`).join("  ")}`);
  console.log(`bench       ${s.benchReturns.map((r) => `${r.key} ${f(r.pct)}%`).join("  ") || "—"}`);
  console.log(`calendario  ${s.calendar.map((c) => `${c.year} ${f(c.pct)}%`).join("  ") || "—"}`);
  console.log(`bench cal.  ${s.benchCalendar.map((c) => `${c.year} ${f(c.pct)}%`).join("  ") || "—"}`);
  console.log(`riesgo      vol1A ${f(s.stats.vol1y)}%  anualizado ${f(s.stats.annualizedSI)}%`);
  console.log(`tenencias   ${s.holdings?.items.length ?? 0} líneas · as_of ${s.holdings?.asOf ?? "—"}`);
}

main();
