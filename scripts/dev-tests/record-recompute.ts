// Recómputo del récord del analizador contra la base local, fuera del server.
//
// Uso:  npx tsx scripts/dev-tests/record-recompute.ts
//
// Sirve para dos cosas: sembrar verdict_return/record_agg en desarrollo, y
// comprobar que el cómputo de producción reproduce el orden que midió el
// backtest (BUY > HOLD > AVOID contra el S&P 500). Pega ~53 veces a Yahoo.

import { registerHomeBindings } from "@/lib/homeBindings";
import { getMetricsDb } from "@/lib/metrics";
import { recomputeRecord, readRecord, cell, type Horizon, type Rating } from "@/lib/recordStore";

const pct = (v: number | null) => (v == null ? "    —  " : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)} %`);

async function main() {
  registerHomeBindings();
  const db = getMetricsDb();
  if (!db) throw new Error("Sin binding de base: ¿existe data/bengochea.sqlite3?");

  const t0 = Date.now();
  const resumen = await recomputeRecord(db);
  console.log(
    `\n${resumen.veredictos} veredictos · ${resumen.tickers} tickers · ` +
    `${resumen.conRetorno} con exceso calculado · ${((Date.now() - t0) / 1000).toFixed(1)} s`,
  );
  if (resumen.errores.length > 0) console.log("errores:", resumen.errores.join(" · "));

  const snap = await readRecord(db);
  for (const h of ["6m", "12m"] as Horizon[]) {
    console.log(`\n── Exceso vs SPY · ${h} ──`);
    console.log("  rating   n  abiertos   mediana  promedio  acierto");
    for (const r of ["BUY", "HOLD", "AVOID"] as Rating[]) {
      const c = cell(snap, h, r);
      if (!c) continue;
      console.log(
        `  ${r.padEnd(6)} ${String(c.n).padStart(3)} ${String(c.nOpen).padStart(9)}` +
        `  ${pct(c.excessMed).padStart(8)}  ${pct(c.excessAvg).padStart(8)}` +
        `  ${c.winRate == null ? "—" : `${(c.winRate * 100).toFixed(0)} %`}`,
      );
    }
  }
  console.log(`\narchivo: ${snap.desde} → ${snap.hasta} · ${snap.tickers} tickers`);
}

main().catch((e) => { console.error(e); process.exit(1); });
