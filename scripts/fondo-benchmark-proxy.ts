// BNG Selección Global — reconstrucción del benchmark 60/40 con proxies ETF.
//
// POR QUÉ ESTE SCRIPT EXISTE
// El benchmark de referencia del fondo es 60% MSCI ACWI / 40% Bloomberg Global
// Aggregate (LEGATRUU). Los NIVELES de esos dos índices son datos licenciados
// (Bloomberg/MSCI): no hay fuente pública que los sirva. Mientras el
// administrador no nos pase el export real, la serie se RECONSTRUYE con ETFs
// que replican esos índices, usando precios ajustados por dividendos
// (total return) — que es lo que miden los índices originales.
//
//   Renta variable (60%)  ACWI  iShares MSCI ACWI ETF        → réplica directa del índice
//   Renta fija     (40%)  AGG   iShares Core US Aggregate    → 45% del tramo
//                         BWX   SPDR Bloomberg Global
//                               Treasury ex-US (SIN cobertura)→ 55% del tramo
//
// El tramo de renta fija es el aproximado: NO existe un ETF accesible que siga
// al Global Aggregate SIN cobertura de moneda en USD (los que hay —BNDX, BNDW,
// AGGU— están cubiertos, y la cobertura es justamente lo que diferencia a
// LEGATRUU de su gemelo cubierto). Se arma entonces con dos piezas de la misma
// familia Bloomberg: el agregado de EE.UU. y el tesoro global ex-EE.UU. sin
// cobertura, en 45/55 — la partición por moneda del Global Aggregate real
// (~45% USD, ~55% resto). Es una APROXIMACIÓN, y la página lo dice al pie.
//
// Rebalanceo DIARIO a pesos constantes (60/40 sobre los retornos del día): es la
// convención simple y auditable para un compuesto de referencia; contra un
// rebalanceo mensual la diferencia es de unos pocos puntos básicos por año.
//
// La serie sale en NIVELES base 100 en el primer día — `fund_benchmark.level` es
// un índice de escala arbitraria (el gráfico lo reescala solo).
//
// Uso:
//   npx tsx scripts/fondo-benchmark-proxy.ts            # 5 años → db/seeds/fondo-benchmark.sql
//   npx tsx scripts/fondo-benchmark-proxy.ts --years=3
//   npx tsx scripts/fondo-benchmark-proxy.ts --out=/tmp/bench.sql
//
// Es IDEMPOTENTE (UPSERT por día): volver a correrlo extiende la serie hasta
// el último cierre sin duplicar nada.

import { writeFileSync } from "node:fs";
import { yahooFinance } from "@/lib/fetchStockData";
import { BENCHMARK_PROXY, BENCHMARK } from "@/lib/fondo";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"] as const;
  }),
);
const YEARS = Number(args.get("years") ?? 5);
const OUT = args.get("out") ?? "db/seeds/fondo-benchmark.sql";

type Serie = Map<string, number>;

/** Cierres AJUSTADOS por dividendos (total return) de un símbolo, por día. */
async function serieTotalReturn(symbol: string, desde: Date): Promise<Serie> {
  const r = await yahooFinance.chart(symbol, { period1: desde, interval: "1d" });
  const out: Serie = new Map();
  for (const q of r.quotes ?? []) {
    // adjclose = precio ajustado por dividendos y splits: la serie que replica
    // el retorno TOTAL del índice. El close pelado dejaría afuera el cupón (en
    // renta fija, la mayor parte del retorno).
    const v = q.adjclose;
    if (v == null || !Number.isFinite(v)) continue;
    out.set(q.date.toISOString().slice(0, 10), v);
  }
  if (out.size === 0) throw new Error(`${symbol}: sin datos`);
  return out;
}

async function main() {
  const hoy = new Date();
  // Un mes de margen: se recorta después a la ventana exacta, y así el primer
  // día pedido cae sí o sí en una rueda hábil.
  const desde = new Date(Date.UTC(hoy.getUTCFullYear() - YEARS, hoy.getUTCMonth() - 1, hoy.getUTCDate()));
  const corte = new Date(Date.UTC(hoy.getUTCFullYear() - YEARS, hoy.getUTCMonth(), hoy.getUTCDate()))
    .toISOString()
    .slice(0, 10);

  const simbolos = BENCHMARK_PROXY.componentes.map((c) => c.symbol);
  console.error(`Bajando ${simbolos.join(", ")} desde ${desde.toISOString().slice(0, 10)}…`);
  const series = await Promise.all(simbolos.map((s) => serieTotalReturn(s, desde)));

  // Sólo los días con dato en TODAS las patas: un retorno compuesto con una
  // pata faltante mezclaría un movimiento de dos días con uno de uno.
  const dias = [...series[0].keys()]
    .filter((d) => d >= corte && series.every((s) => s.has(d)))
    .sort();
  if (dias.length < 2) throw new Error("intersección de calendarios vacía");

  // Retorno diario del compuesto = Σ peso_i × retorno_i (rebalanceo diario), y
  // el nivel acumula desde 100.
  const pesos = BENCHMARK_PROXY.componentes.map((c) => c.peso);
  const filas: { dia: string; level: number }[] = [{ dia: dias[0], level: 100 }];
  for (let i = 1; i < dias.length; i++) {
    let ret = 0;
    for (let j = 0; j < series.length; j++) {
      const prev = series[j].get(dias[i - 1])!;
      const cur = series[j].get(dias[i])!;
      ret += pesos[j] * (cur / prev - 1);
    }
    filas.push({ dia: dias[i], level: filas[i - 1].level * (1 + ret) });
  }

  const primera = filas[0];
  const ultima = filas[filas.length - 1];
  const total = (ultima.level / primera.level - 1) * 100;
  const anos = (Date.parse(ultima.dia) - Date.parse(primera.dia)) / (365.25 * 86_400_000);
  const cagr = (Math.pow(ultima.level / primera.level, 1 / anos) - 1) * 100;
  console.error(
    `${filas.length} ruedas · ${primera.dia} → ${ultima.dia} · ` +
      `acumulado ${total.toFixed(2)}% · anualizado ${cagr.toFixed(2)}%`,
  );

  const sql = [
    `-- BNG Selección Global — serie del benchmark de referencia.`,
    `--   ${BENCHMARK.nombre}`,
    `--`,
    `-- GENERADO por scripts/fondo-benchmark-proxy.ts — no editar a mano.`,
    `-- Reconstruido con ETFs que replican esos índices (${BENCHMARK_PROXY.componentes
      .map((c) => `${c.symbol} ${(c.peso * 100).toFixed(0)}%`)
      .join(", ")}), a precios ajustados por dividendos (total return),`,
    `-- rebalanceo diario, niveles base 100 al ${primera.dia}.`,
    `--`,
    `-- Ventana: ${primera.dia} → ${ultima.dia} (${filas.length} ruedas).`,
    `-- Acumulado ${total.toFixed(2)}% · anualizado ${cagr.toFixed(2)}%.`,
    `--`,
    `-- ⚠️ Es una APROXIMACIÓN: reemplazar por los niveles reales de los índices`,
    `--    en cuanto el administrador pase el export (source='administrator').`,
    `--`,
    `-- Aplicar (home server):  sqlite3 data/bengochea.sqlite3 < db/seeds/fondo-benchmark.sql`,
    `-- Aplicar (D1):           npx wrangler d1 execute <base> --file=db/seeds/fondo-benchmark.sql`,
    `--`,
    `-- Sin BEGIN/COMMIT a propósito: D1 rechaza las transacciones explícitas`,
    `-- ("use the state.storage.transaction() APIs instead") y acá no hacen falta —`,
    `-- es UN solo INSERT con upsert, atómico por sí mismo, y re-aplicarlo es seguro.`,
    ``,
    `INSERT INTO fund_benchmark (dia, level, source, updated_at) VALUES`,
    filas
      .map((f) => `  ('${f.dia}', ${f.level.toFixed(6)}, 'etf_proxy', unixepoch()*1000)`)
      .join(",\n") + "",
    `ON CONFLICT(dia) DO UPDATE SET`,
    `  level = excluded.level, source = excluded.source, updated_at = excluded.updated_at;`,
    ``,
  ].join("\n");

  writeFileSync(OUT, sql);
  console.error(`→ ${OUT}`);
}

main().catch((e) => {
  console.error("FALLÓ:", e instanceof Error ? e.message : e);
  process.exit(1);
});
