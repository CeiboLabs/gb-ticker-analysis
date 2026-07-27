// Informe PDF del backtest v2 — paridad total + A/B contra la primera corrida.
//
// Lee el JSON de la corrida nueva (3 cortes, paridad completa) Y el baseline
// (2 cortes, jul-2026), computa el A/B en los cortes compartidos y la cohorte
// ene-2026, y emite el informe editorial con el mismo sistema visual del
// informe original (tinta azul-negra, hairlines, Newsreader display, Plex Mono
// números; verde/oxblood sólo como refuerzo de signo).
//
// Uso:  npx tsx scripts/backtest/informe-pdf-v2.ts [nuevo.json] [baseline.json]
// Sale: out/informe-backtest-paridad-<fecha>.html y .pdf

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

type Row = {
  ticker: string; cutoff: string; rating: "BUY" | "HOLD" | "AVOID"; conviction: string;
  priceTarget: number | null; priceAt: number; impliedUpside: number | null;
  bullTarget?: number | null; bearTarget?: number | null;
  trend: string | null; buyConfirmed: boolean; avoidTriggered: boolean;
  fcfYieldMet: string; balanceMet: string; valuationBasis?: string | null;
  granularity: string; coherenceFlags: string[];
  ret6: number | null; ret12: number | null; ex6: number | null; ex12: number | null;
};
type Data = { model: string; cutoffs: string[]; rows: Row[]; skips: Array<{ ticker: string; cutoff: string; reason: string }> };

const OUT_DIR = path.resolve(process.cwd(), "scripts/backtest/out");
const nuevaPath = path.resolve(process.argv[2] ?? path.join(OUT_DIR, "backtest-2026-07-19-20-15.json"));
const basePath = path.resolve(process.argv[3] ?? path.join(OUT_DIR, "backtest-2026-07-19-13-31.json"));
const nueva = JSON.parse(readFileSync(nuevaPath, "utf8")) as Data;
const base = JSON.parse(readFileSync(basePath, "utf8")) as Data;

const SHARED = base.cutoffs;                       // 2025-01-17, 2025-07-18
const C2026 = nueva.cutoffs.find((c) => !SHARED.includes(c))!; // 2026-01-16
const rows = nueva.rows;
const rShared = rows.filter((r) => SHARED.includes(r.cutoff));
const r2026 = rows.filter((r) => r.cutoff === C2026);

// ── Agregados ─────────────────────────────────────────────────────────────────
const median = (v: number[]) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const nn = (v: Array<number | null>) => v.filter((x): x is number => x != null);
const exOf = (rs: Row[], k: "ex6" | "ex12") => nn(rs.map((r) => r[k]));

interface Cohort { label: string; n: number; med6: number | null; avg6: number | null; med12: number | null; avg12: number | null }
function cohort(label: string, rs: Row[]): Cohort {
  return { label, n: rs.length, med6: median(exOf(rs, "ex6")), avg6: mean(exOf(rs, "ex6")), med12: median(exOf(rs, "ex12")), avg12: mean(exOf(rs, "ex12")) };
}

const byRating = (["BUY", "HOLD", "AVOID"] as const).map((r) => cohort(r, rows.filter((x) => x.rating === r)));
const byConv = ["HIGH", "MEDIUM", "LOW"].map((c) => cohort(`BUY · ${c}`, rows.filter((x) => x.rating === "BUY" && x.conviction === c))).filter((c) => c.n > 0);
const byTrend = ["alcista", "mixta", "bajista"].map((t) => cohort(t, rows.filter((x) => x.trend === t)));
const interact = [
  cohort("BUY + alcista", rows.filter((x) => x.rating === "BUY" && x.trend === "alcista")),
  cohort("BUY + bajista", rows.filter((x) => x.rating === "BUY" && x.trend === "bajista")),
  cohort("AVOID + alcista", rows.filter((x) => x.rating === "AVOID" && x.trend === "alcista")),
  cohort("AVOID + bajista", rows.filter((x) => x.rating === "AVOID" && x.trend === "bajista")),
];
const byCond = [
  cohort("Valuación CUMPLE", rows.filter((x) => x.fcfYieldMet === "met")),
  cohort("Valuación NO CUMPLE", rows.filter((x) => x.fcfYieldMet === "not_met")),
  cohort("AVOID mecánico disparado", rows.filter((x) => x.avoidTriggered)),
];
const nBuy = byRating[0].n, nHold = byRating[1].n, nAvoid = byRating[2].n;

// A/B en cortes compartidos.
const abBase = (["BUY", "HOLD", "AVOID"] as const).map((r) => cohort(r, base.rows.filter((x) => x.rating === r)));
const abNueva = (["BUY", "HOLD", "AVOID"] as const).map((r) => cohort(r, rShared.filter((x) => x.rating === r)));

// Transiciones + grupos de flips.
const nBy = new Map(rShared.map((r) => [`${r.ticker}|${r.cutoff}`, r]));
const flipGroup = (from: string, to: string): Row[] =>
  base.rows
    .map((b) => ({ b, n: nBy.get(`${b.ticker}|${b.cutoff}`) }))
    .filter((x): x is { b: Row; n: Row } => x.n != null && x.b.rating === from && x.n.rating === to)
    .map((x) => x.n);
const upgrades = flipGroup("HOLD", "BUY");
const downgrades = flipGroup("BUY", "HOLD");
const newAvoid = flipGroup("HOLD", "AVOID");
const exAvoid = flipGroup("AVOID", "HOLD");
const flipRows = base.rows
  .map((b) => ({ b, n: nBy.get(`${b.ticker}|${b.cutoff}`) }))
  .filter((x): x is { b: Row; n: Row } => x.n != null && x.b.rating !== x.n.rating);

// Cohorte 2026 + targets/rango.
const r2026ByRating = (["BUY", "HOLD", "AVOID"] as const).map((r) => cohort(r, r2026.filter((x) => x.rating === r)));
const spread = (rs: Row[], k: "ex6" | "ex12") => {
  const b = median(exOf(rs.filter((r) => r.rating === "BUY"), k));
  const a = median(exOf(rs.filter((r) => r.rating === "AVOID"), k));
  return b != null && a != null ? b - a : null;
};
function targetStats(k: "ret6" | "ret12") {
  const t = rows.filter((r) => r.impliedUpside != null && r[k] != null);
  const mae = mean(t.map((r) => Math.abs((r.impliedUpside as number) - (r[k] as number))));
  const dir = t.length ? t.filter((r) => Math.sign(r.impliedUpside as number) === Math.sign(r[k] as number)).length / t.length : null;
  const up = t.length ? t.filter((r) => (r[k] as number) > 0).length / t.length : null;
  const rng = rows.filter((r) => r.bullTarget != null && r.bearTarget != null && r[k] != null && r.priceAt > 0);
  const inside = rng.length
    ? rng.filter((r) => {
        const ret = r[k] as number;
        return ret >= (r.bearTarget as number) / r.priceAt - 1 && ret <= (r.bullTarget as number) / r.priceAt - 1;
      }).length / rng.length
    : null;
  return { n: t.length, mae, dir, up, inside };
}
const t6 = targetStats("ret6");
const t12 = targetStats("ret12");

const buyConfShared = rShared.filter((r) => r.buyConfirmed);
const buyConfBuy = buyConfShared.filter((r) => r.rating === "BUY");

// ── Formato / charts (sistema visual del informe original) ────────────────────
const pctS = (v: number | null, d = 1) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(d)}%`);
const money = (v: number | null) => (v == null ? "—" : `$${v.toFixed(2)}`);
const POS = "#1F6B45", NEG = "#8E2A2A", HAIR = "#C6C8E0", INK = "#0E1130", INK3 = "#6E7290";

function barChart(cohorts: Cohort[], field: "med6" | "med12", title: string): string {
  const vals = cohorts.map((c) => c[field]);
  const maxAbs = Math.max(0.05, ...vals.map((v) => Math.abs(v ?? 0)));
  const W = 380, LBL = 150, VAL = 48, ROW = 26, H = cohorts.length * ROW + 18;
  const plotW = W - LBL - VAL - 10;
  const zero = LBL + plotW / 2;
  const scale = plotW / 2 / maxAbs;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" style="font-family:'Plex Mono',monospace">`;
  s += `<text x="0" y="10" font-size="8.5" fill="${INK3}" letter-spacing=".08em">${title.toUpperCase()}</text>`;
  s += `<line x1="${zero}" y1="16" x2="${zero}" y2="${H - 2}" stroke="${HAIR}" stroke-width="1"/>`;
  cohorts.forEach((c, i) => {
    const y = 20 + i * ROW;
    const v = c[field];
    s += `<text x="0" y="${y + 12}" font-size="9" fill="${INK}">${c.label}</text>`;
    if (v == null) { s += `<text x="${W}" y="${y + 12.5}" text-anchor="end" font-size="9" fill="${INK3}">s/d</text>`; return; }
    const w = Math.min(Math.abs(v) * scale, plotW / 2);
    const x = v >= 0 ? zero : zero - w;
    const color = v >= 0 ? POS : NEG;
    s += `<rect x="${x.toFixed(1)}" y="${y + 3}" width="${Math.max(w, 1.5).toFixed(1)}" height="12" fill="${color}" rx="2"/>`;
    s += `<text x="${W}" y="${y + 12.5}" text-anchor="end" font-size="9" fill="${color}">${pctS(v)}</text>`;
  });
  return s + `</svg>`;
}

function cohortTable(cs: Cohort[], only6 = false): string {
  const cell = (v: number | null) => `<td class="num ${v == null ? "" : v >= 0 ? "pos" : "neg"}">${pctS(v)}</td>`;
  const head = only6
    ? `<tr><th>Cohorte</th><th class="num">n</th><th class="num">6m med.</th><th class="num">6m prom.</th></tr>`
    : `<tr><th>Cohorte</th><th class="num">n</th><th class="num">6m med.</th><th class="num">6m prom.</th><th class="num">12m med.</th><th class="num">12m prom.</th></tr>`;
  return `<table><thead>${head}</thead><tbody>${cs
    .map((c) => `<tr><td>${c.label}</td><td class="num">${c.n}</td>${cell(c.med6)}${cell(c.avg6)}${only6 ? "" : cell(c.med12) + cell(c.avg12)}</tr>`)
    .join("")}</tbody></table>`;
}

// Tabla A/B: baseline vs nueva por rating, sólo cortes compartidos.
function abTable(): string {
  const cell = (v: number | null) => `<td class="num ${v == null ? "" : v >= 0 ? "pos" : "neg"}">${pctS(v)}</td>`;
  const rowsHtml = (["BUY", "HOLD", "AVOID"] as const).map((rt, i) => {
    const b = abBase[i], n = abNueva[i];
    return `<tr><td>${rt}</td><td class="num">${b.n}</td>${cell(b.med12)}${cell(b.avg12)}<td class="num dim">→</td><td class="num">${n.n}</td>${cell(n.med12)}${cell(n.avg12)}</tr>`;
  }).join("");
  return `<table><thead><tr><th>Rating</th><th class="num">n</th><th class="num">12m med.</th><th class="num">12m prom.</th><th></th><th class="num">n</th><th class="num">12m med.</th><th class="num">12m prom.</th></tr>
  <tr><th></th><th colspan="3" style="text-align:center;border-bottom:none;">— primera corrida —</th><th style="border-bottom:none;"></th><th colspan="3" style="text-align:center;border-bottom:none;">— paridad total —</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
}

const F = (f: string) => `file://${path.resolve(process.cwd(), "assets/fonts", f)}`;

const appendixRows = [...rows]
  .sort((a, b) => a.cutoff.localeCompare(b.cutoff) || a.ticker.localeCompare(b.ticker))
  .map((r) => `<tr><td class="num">${r.cutoff}</td><td>${r.ticker}</td><td>${r.rating}<span class="dim"> · ${r.conviction}</span></td><td class="num">${money(r.priceAt)}</td><td class="num">${money(r.priceTarget)}</td><td class="num">${pctS(r.impliedUpside)}</td><td>${r.trend ?? "—"}</td><td class="num ${r.ex6 == null ? "" : r.ex6 >= 0 ? "pos" : "neg"}">${pctS(r.ex6)}</td><td class="num ${r.ex12 == null ? "" : r.ex12 >= 0 ? "pos" : "neg"}">${pctS(r.ex12)}</td></tr>`)
  .join("\n");

const flipTable = flipRows
  .sort((a, b) => (a.n.ex12 ?? a.n.ex6 ?? 0) - (b.n.ex12 ?? b.n.ex6 ?? 0))
  .map(({ b, n }) => `<tr><td class="num">${b.cutoff}</td><td>${b.ticker}</td><td>${b.rating}<span class="dim"> · ${b.conviction}</span></td><td>${n.rating}<span class="dim"> · ${n.conviction}</span></td><td class="num ${n.ex6 == null ? "" : n.ex6 >= 0 ? "pos" : "neg"}">${pctS(n.ex6)}</td><td class="num ${n.ex12 == null ? "" : n.ex12 >= 0 ? "pos" : "neg"}">${pctS(n.ex12)}</td></tr>`)
  .join("\n");

const avoid2026 = r2026.filter((r) => r.rating === "AVOID")
  .sort((a, b) => (a.ex6 ?? 0) - (b.ex6 ?? 0))
  .map((r) => `<tr><td>${r.ticker}</td><td>${r.conviction}</td><td class="num">${pctS(r.impliedUpside)}</td><td>${r.trend ?? "—"}</td><td class="num ${r.ex6 == null ? "" : r.ex6 >= 0 ? "pos" : "neg"}">${pctS(r.ex6)}</td></tr>`)
  .join("\n");

const hoy = new Date().toISOString().slice(0, 10);
const tk = new Set(rows.map((r) => r.ticker)).size;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Backtest con paridad total · /analyze</title>
<style>
@font-face { font-family: "Newsreader"; src: url("${F("Newsreader-Medium.ttf")}"); font-weight: 500; }
@font-face { font-family: "Plex Mono"; src: url("${F("IBMPlexMono-Medium.ttf")}"); font-weight: 500; }
@font-face { font-family: "Plex Sans SB"; src: url("${F("IBMPlexSans-SemiBold.ttf")}"); font-weight: 600; }
@page { size: A4; margin: 12mm 12mm 16mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; }
body { font-family: "Helvetica Neue", Arial, sans-serif; color: #0E1130; font-size: 10.5px; line-height: 1.55; background: #FBFBFE; }
.serif { font-family: "Newsreader", Georgia, serif; font-weight: 500; }
.mono, .num { font-family: "Plex Mono", ui-monospace, monospace; font-variant-numeric: tabular-nums; }
h1 { font-family: "Newsreader", Georgia, serif; font-weight: 500; font-size: 30px; line-height: 1.15; letter-spacing: -0.01em; }
h2 { font-family: "Newsreader", Georgia, serif; font-weight: 500; font-size: 17px; margin: 26px 0 4px; padding-top: 10px; border-top: 1px solid #0E1130; break-after: avoid; }
h2 .no { font-family: "Plex Mono", monospace; font-size: 10px; color: #A07C28; margin-right: 8px; letter-spacing: .1em; }
h3 { font-family: "Plex Sans SB", Arial, sans-serif; font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: #3A3E5C; margin: 14px 0 4px; break-after: avoid; }
p { margin: 5px 0; color: #3A3E5C; }
p strong { color: #0E1130; font-weight: 600; font-family: "Plex Sans SB", Arial, sans-serif; }
ul { margin: 4px 0 8px 16px; color: #3A3E5C; }
li { margin: 3px 0; }
table { border-collapse: collapse; width: 100%; margin: 8px 0 12px; font-size: 9.5px; }
thead { display: table-header-group; }
th { font-family: "Plex Sans SB", Arial, sans-serif; font-size: 8px; letter-spacing: .07em; text-transform: uppercase; color: #6E7290; text-align: left; padding: 4px 8px 4px 0; border-bottom: 1px solid #0E1130; }
td { padding: 3.5px 8px 3.5px 0; border-bottom: 1px solid #ECEDF6; vertical-align: top; }
tr { break-inside: avoid; }
.num { text-align: right; font-size: 9px; }
th.num { text-align: right; }
.pos { color: #1F6B45; } .neg { color: #8E2A2A; } .dim { color: #9FA2C0; }
.hero { border-top: 3px solid #0E1130; padding-top: 14px; margin-bottom: 8px; }
.kicker { font-family: "Plex Mono", monospace; font-size: 9px; letter-spacing: .18em; color: #A07C28; text-transform: uppercase; margin-bottom: 10px; }
.lede { font-size: 12.5px; color: #3A3E5C; margin-top: 10px; max-width: 60ch; }
.meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0 18px; margin: 16px 0 4px; border-top: 1px solid #C6C8E0; border-bottom: 1px solid #C6C8E0; padding: 8px 0; }
.meta div { font-size: 9px; color: #6E7290; }
.meta b { display: block; font-family: "Plex Mono", monospace; font-size: 11px; color: #0E1130; font-weight: 500; margin-top: 1px; }
.charts { display: flex; gap: 26px; margin: 10px 0 2px; break-inside: avoid; }
.cap { font-size: 8.5px; color: #9FA2C0; margin: 2px 0 10px; }
.hallazgo { border-left: 2px solid #A07C28; padding: 2px 0 2px 10px; margin: 10px 0; break-inside: avoid; }
.hallazgo b { font-family: "Plex Sans SB", Arial, sans-serif; color: #0E1130; }
.appendix table { font-size: 8.3px; }
.appendix td { padding: 2.5px 6px 2.5px 0; }
.pagebreak { break-before: page; }
.dist { display: flex; height: 16px; margin: 10px 0 2px; gap: 2px; }
.dist div { color: #fff; font-family: "Plex Mono", monospace; font-size: 8.5px; display: flex; align-items: center; padding-left: 6px; border-radius: 2px; }
.ficha td:first-child { white-space: nowrap; color: #6E7290; padding-right: 16px; }
</style></head><body>

<div class="hero">
  <div class="kicker">Informe técnico interno · Analizador /analyze · segunda corrida</div>
  <h1>Backtest con paridad total:<br>¿las mejoras mejoraron?</h1>
  <p class="lede">Tras la primera corrida se aplicaron las mejoras que sus resultados sugirieron —gate de valuación
  sectorial, disciplina de conviction, y una reconstrucción as-of que le da al modelo casi toda la información de un
  informe vivo—. Esta segunda corrida repite los mismos cortes con los mismos seeds (A/B limpio contra la línea de
  base), agrega un corte de enero de 2026 en un régimen de mercado distinto, y mide si el sistema mejoró.</p>
  <div class="meta">
    <div>Veredictos<b>${rows.length}</b></div>
    <div>Universo<b>${tk} tickers · 3 cortes</b></div>
    <div>Modelo<b>${nueva.model.replace("-2024-11-20", "")}</b></div>
    <div>Fecha del informe<b>${hoy}</b></div>
  </div>
</div>

<h2><span class="no">01</span>Resumen ejecutivo</h2>
<div class="hallazgo"><b>El lado BUY dejó de estar muerto — y mejoró.</b> En los cortes compartidos con la primera
corrida, el BUY pasó de ${abBase[0].n} a ${abNueva[0].n} veredictos y su mediana de exceso a 12 meses subió de
${pctS(abBase[0].med12)} a ${pctS(abNueva[0].med12)}. La anomalía más incómoda del estudio anterior —el promedio de
HOLD (${pctS(abBase[1].avg12)}) le ganaba al de BUY (${pctS(abBase[0].avg12)})— se invirtió: ahora BUY promedia
${pctS(abNueva[0].avg12)} contra ${pctS(abNueva[1].avg12)} de HOLD. Los grandes ganadores que dormían en HOLD
(BABA, ASML, NOK, ITUB) ahora son BUY. Los ${upgrades.length} upgrades a BUY rindieron ${pctS(median(exOf(upgrades, "ex12")))}
de mediana a 12 meses.</div>
<div class="hallazgo"><b>Los downgrades fueron quirúrgicos.</b> Los ${downgrades.length} BUY de la primera corrida que la
nueva bajó a HOLD terminaron en ${pctS(median(exOf(downgrades, "ex12")))} de mediana — el sistema sacó de BUY exactamente
a los tóxicos (HDB −48.8, PGR −29.9, BABA de julio −23.2) al costo de un solo acierto perdido (LTM +8.0).</div>
<div class="hallazgo"><b>AVOID + tendencia alcista se confirma como la celda estrella.</b> Con ${interact[2].n} casos
(la primera corrida tenía 3), los AVOID emitidos contra una tendencia todavía positiva rindieron
${pctS(interact[2].med12)} de mediana a 12 meses. Y en el corte de enero 2026 —un régimen que el estudio original no
vio— el orden BUY &gt; HOLD &gt; AVOID se sostuvo a 6 meses (${pctS(r2026ByRating[0].med6)} /
${pctS(r2026ByRating[1].med6)} / ${pctS(r2026ByRating[2].med6)}).</div>
<div class="hallazgo"><b>La disciplina de conviction no necesitó intervenir.</b> El enforcement en código (HIGH exige
respaldo mecánico; AVOID sobre nombres desplomados se capea) corrió las ${rows.length} veces y no capeó ninguna: el
modelo cumplió las reglas leyéndolas en el prompt. Los AVOID·HIGH discrecionales de la primera corrida —MRNA, que costó
+78 puntos en contra— ahora salen HOLD·LOW por sí solos.</div>
<div class="hallazgo"><b>Los costos, sin maquillar.</b> (1) El spread BUY−AVOID a 6 meses se comprimió
(${pctS(spread(base.rows, "ex6"))} → ${pctS(spread(rShared, "ex6"))} en los cortes compartidos): el BUY nuevo es más
value/contrarian y paga a 12 meses, no a 6. (2) El AVOID mecánico se diluyó (${pctS(byCond[2].med12)} de mediana) por un
falso positivo doloroso: LTM en enero 2025 (+107 de exceso), leverage post-reestructuración que disparó el gate — el
mismo trigger sobre LTM <b>acertó</b> en enero 2026 (−18.8). (3) El rango bull–bear contiene el retorno realizado sólo
el ${t6.inside == null ? "—" : Math.round(t6.inside * 100)}% de las veces a 6 meses: es demasiado angosto para leerse
como intervalo.</div>

<h2><span class="no">02</span>Qué cambió desde la primera corrida</h2>
<h3>Mejoras al pipeline (aplicadas también en producción)</h3>
<ul>
<li><strong>Gate de valuación sectorial:</strong> las financieras se evalúan con P/B + ROE, P/E o PEG — nunca FCF yield (el flujo de caja de un banco es ruido de balance; el FCF de JPM en 2024 fue −$42B). Con fallbacks por P/E y EV/EBITDA cuando faltan FCF y PEG.</li>
<li><strong>Disciplina de conviction:</strong> HIGH exige respaldo mecánico del framework; un AVOID con el precio ≥35% debajo del máximo de 52 semanas lleva tope MEDIUM (tesis consumada, riesgo de rebote).</li>
<li><strong>PEG con guard de turnaround:</strong> crecimiento proyectado &gt;100% (rebote desde base deprimida) invalida el PEG — sin esto, aerolíneas quebradas marcaban "valuación atractiva" con PEG 0.02x.</li>
<li><strong>Perfil de industria sin EDGAR</strong> (inferido de Yahoo) y confirmación de BUY que no queda bloqueada de por vida en perfiles exentos de leverage.</li>
</ul>
<h3>Paridad de datos: lo que el modelo ahora SÍ ve al corte</h3>
<table>
<thead><tr><th>Pieza</th><th>Fuente as-of</th><th>Frontera anti-fuga</th><th class="num">Cobertura</th></tr></thead>
<tbody>
<tr><td>Segmentos + estado de resultados (Sankey)</td><td>EDGAR 10-Q/K/20-F/40-F, pipeline XBRL de producción</td><td>Fecha real de filing ≤ corte</td><td class="num">80/82</td></tr>
<tr><td>Guidance de la dirección</td><td>Ex-99.1 del último 8-K Item 2.02 ≤ corte</td><td>Fecha de filing</td><td class="num">19/82</td></tr>
<tr><td>Consenso de analistas</td><td>Finnhub (mensual histórico) + sintético por firma (historial de grades)</td><td>Período/fecha del rating ≤ corte</td><td class="num">69/82</td></tr>
<tr><td>Acciones de analistas (últimas 5)</td><td>Historial de upgrades/downgrades de Yahoo (llega a 2012)</td><td>Fecha exacta de la acción</td><td class="num">82/82</td></tr>
<tr><td>EPS forward + P/E forward + target medio</td><td>Snapshot de finviz vía Wayback Machine</td><td>Snapshot ESTRICTAMENTE ≤ corte; antigüedad declarada (mediana 26–63 días)</td><td class="num">~69/82</td></tr>
<tr><td>Short interest</td><td>FINRA consolidated short interest (bi-mensual)</td><td>Settlement ≤ corte − 12 días (lag de publicación)</td><td class="num">82/82</td></tr>
<tr><td>Insiders (Form 4)</td><td>EDGAR, XML de ownership, texto desde transaction codes</td><td>Fecha de filing; flag 10b5-1 del propio form</td><td class="num">45/82</td></tr>
<tr><td>Peers con múltiplos</td><td>Cohorte del screener, métricas reconstruidas al corte</td><td>Misma maquinaria as-of por peer</td><td class="num">82/82</td></tr>
<tr><td>Beta · dividendos · P/B · ROE · EV/EBITDA</td><td>Series propias + equity/FX por período</td><td>Al corte</td><td class="num">~80/82</td></tr>
</tbody></table>
<p class="cap">Cobertura medida sobre los cortes de 2025 (82 filas). Insiders: los emisores extranjeros no presentan Form 4 — N/D honesto, igual que producción. Lo único irrecuperable sin data institucional paga: la dinámica de revisiones del consenso (deriva 30/90 días) y las estimaciones por trimestre.</p>
<h3>Fugas de la primera corrida, encontradas y eliminadas</h3>
<ul>
<li><strong>Fuga de publicación:</strong> el estudio original filtraba estados contables por fecha de CIERRE del período, no de publicación — un año fiscal cerrado el 31-dic entraba a un corte del 17-ene aunque la empresa reportara el 23. Ahora cada estado entra sólo si su release/filing real (EDGAR) fue ≤ corte, con fallback conservador de 45 días.</li>
<li><strong>Moneda y ratio ADR:</strong> los estados de Yahoo vienen en moneda local y acciones locales; sin conversión, HDB mostraba P/B 0.03 (real: ~3) y el gate de valuación bancario operaba sobre basura — que también contaminó a la primera corrida donde el dato existía.</li>
<li>Parte del delta A/B proviene de estas correcciones de datos además de las mejoras de diseño; ambas van en la misma dirección: el sistema que se midió acá es el honesto.</li>
</ul>

<h2 class="pagebreak"><span class="no">03</span>Resultados</h2>
<h3>Distribución de veredictos (3 cortes)</h3>
<div class="dist">
  <div style="background:#1F6B45;width:${(nBuy / rows.length) * 100}%">BUY ${nBuy}</div>
  <div style="background:#5C5F7A;width:${(nHold / rows.length) * 100}%">HOLD ${nHold}</div>
  <div style="background:#8E2A2A;width:${(nAvoid / rows.length) * 100}%">AVOID ${nAvoid}</div>
</div>
<p class="cap">${rows.length} veredictos · ${nueva.skips.length} exclusión (CVX @ ene-2025: el modelo devolvió un JSON degenerado dos veces — anomalía puntual). HOLD bajó del 74% al ${Math.round((nHold / rows.length) * 100)}%: el sistema toma posición.</p>

<h3>Exceso de retorno por rating</h3>
<div class="charts">${barChart(byRating, "med6", "Mediana exceso vs SPY · 6 meses · 3 cortes")}${barChart(byRating, "med12", "Mediana exceso vs SPY · 12 meses · cortes 2025")}</div>
<p class="cap">Barras desde la línea de cero: derecha = le ganó al S&amp;P 500, izquierda = perdió. El 12m sólo existe para los cortes de 2025.</p>
${cohortTable(byRating)}

<h3>El A/B contra la primera corrida (cortes compartidos, mismos seeds)</h3>
${abTable()}
<p>La mejora del BUY viene de los dos lados: <strong>entraron los ganadores</strong> (upgrades a BUY, n=${upgrades.length}:
${pctS(median(exOf(upgrades, "ex12")))} de mediana) y <strong>salieron los tóxicos</strong> (downgrades, n=${downgrades.length}:
${pctS(median(exOf(downgrades, "ex12")))}). El costo del giro value: a 6 meses los BUY nuevos apenas empatan
(${pctS(abNueva[0].med6)}) porque compran antes de que la tesis pague — ASML entró −8.0% abajo a 6 meses y +64 arriba a 12.</p>

<h3>Conviction dentro de BUY</h3>
${cohortTable(byConv)}
<p class="cap">BUY·HIGH ahora existe a escala (n=${byConv[0].n}) porque el consenso as-of permite la confirmación mecánica del framework: ${buyConfShared.length} veredictos confirmados en los cortes 2025, ${buyConfBuy.length} salieron BUY (${pctS(median(exOf(buyConfBuy, "ex12")))} de mediana a 12m).</p>

<h3>Interacción rating × tendencia</h3>
${cohortTable(interact)}
<p>La celda decisiva sigue siendo <strong>AVOID + alcista</strong> (${pctS(interact[2].med12)} a 12m, ahora con n=${interact[2].n}):
el fundamental pisando a la tendencia es donde el sistema genera más valor. La tendencia sola sigue sin ser monotónica
— contexto narrativo, jamás gate.</p>

<h3>Condiciones del framework</h3>
<div class="charts">${barChart(byCond, "med12", "Mediana exceso vs SPY · 12 meses")}</div>
${cohortTable(byCond)}
<p><strong>La lectura del AVOID mecánico exige honestidad:</strong> su mediana (${pctS(byCond[2].med12)}) esconde dos
poblaciones. Los disparos <strong>antes</strong> del deterioro del precio siguieron funcionando (AAL enero −33, ULCC enero −56,
ALK julio −34). El falso positivo fue LTM en enero 2025 (+107): deuda post-reestructuración que el gate leyó como deterioro.
El mismo trigger sobre LTM acertó en enero 2026 (−18.8) — el problema es de contexto (reestructuración reciente), no del gate.</p>

<h3>Targets de precio: el puntual y el rango</h3>
<p>El target puntual sigue siendo la pieza más débil, ahora medido contra el baseline que corresponde: dirección correcta
${t6.dir == null ? "—" : Math.round(t6.dir * 100)}% a 6 meses contra un ${t6.up == null ? "—" : Math.round(t6.up * 100)}% de
la regla trivial "siempre sube" (a 12m: ${t12.dir == null ? "—" : Math.round(t12.dir * 100)}% vs ${t12.up == null ? "—" : Math.round(t12.up * 100)}%).
<strong>Hallazgo nuevo:</strong> el rango bull–bear contiene el retorno realizado sólo el
<strong>${t6.inside == null ? "—" : Math.round(t6.inside * 100)}%</strong> de las veces a 6 meses y el
<strong>${t12.inside == null ? "—" : Math.round(t12.inside * 100)}%</strong> a 12 — un rango calibrado debería contener ~70-80%.
Los escenarios del modelo son demasiado angostos: sirven como escenarios centrales, no como intervalo de confianza.</p>

<h3>El corte de enero 2026: primer test fuera del régimen original</h3>
${cohortTable(r2026ByRating, true)}
<p>Spread BUY−AVOID a 6 meses: <strong>${pctS(spread(r2026, "ex6"))}</strong> — en un mercado distinto del rally de 2025 y con
el sistema ya mejorado. Los AVOID de ese corte, con desenlace:</p>
<table><thead><tr><th>Ticker</th><th>Conv.</th><th class="num">Upside impl.</th><th>Tendencia</th><th class="num">Exceso 6m</th></tr></thead><tbody>
${avoid2026}
</tbody></table>
<p class="cap">Seis de diez del lado correcto — incluido LTM (−18.8), el mismo nombre que fue falso positivo un año antes. Las
excepciones: ASML (+21.0, el modelo fue contra el rally de semis y perdió) y los rebotes de ULCC/SMFG.</p>

<h2 class="pagebreak"><span class="no">04</span>Las ${flipRows.length} transiciones de rating</h2>
<p>Cada fila es un ticker×corte donde la corrida nueva cambió el veredicto de la primera. Ordenadas de peor a mejor desenlace —
la mitad superior son los AVOID/HOLD que protegieron capital; la inferior, los BUY que capturaron upside.</p>
<table>
<thead><tr><th>Corte</th><th>Ticker</th><th>Antes</th><th>Ahora</th><th class="num">Exceso 6m</th><th class="num">Exceso 12m</th></tr></thead>
<tbody>
${flipTable}
</tbody></table>
<p class="cap">Los flips malos concentran una lección cada uno: NVO y MET a BUY (value traps vía PEG con earnings deprimidos),
LTM a AVOID (leverage post-reestructuración). Los flips buenos: HDB/PGR/BABA fuera de BUY, y los ganadores de 2025 adentro.</p>

<h2><span class="no">05</span>Recomendaciones</h2>
<ul>
<li><strong>Adoptar el pipeline nuevo como vigente.</strong> El A/B valida las mejoras: BUY con selección real (+${((abNueva[0].med12 ?? 0) * 100 - (abBase[0].med12 ?? 0) * 100).toFixed(1)} puntos de mediana a 12m), downgrades que protegen, AVOID+alcista robustecida, y orden sostenido en un régimen nuevo.</li>
<li><strong>Refinar el gate de leverage con contexto de reestructuración</strong> (el caso LTM): deuda post-chapter-11 con equity recién emitido no es lo mismo que deuda deteriorándose. Candidato: exigir también deterioro secuencial o dejar que el modelo vete el trigger con justificación explícita registrada.</li>
<li><strong>Ensanchar o re-etiquetar el rango bull–bear.</strong> Con ${t6.inside == null ? "—" : Math.round(t6.inside * 100)}% de cobertura real, hoy comunica una certeza que no tiene. O se calibra (±1σ de la vol realizada como piso) o se presenta como "escenarios centrales".</li>
<li><strong>Horizontes por señal:</strong> el rating rinde a 6-12 meses según el estilo (los AVOID pagan rápido, el BUY value paga a 12); la vigencia práctica del veredicto sigue siendo hasta los próximos resultados.</li>
<li><strong>Dejar madurar el <span class="mono">verdict_log</span> vivo</strong> (registra con información completa desde julio 2026, versión v34 distinguible) — es el test definitivo sin reconstrucción, y el dashboard de calibración en /admin/monitor se justifica cuando haya masa.</li>
</ul>

<h2><span class="no">06</span>Ficha técnica</h2>
<table class="ficha">
<tbody>
<tr><td>Universo</td><td>Golden set de ${tk} tickers por industria (aerolíneas, bancos, seguros, REITs, biotech, oil&amp;gas, servicios, ADRs internacionales)</td></tr>
<tr><td>Cortes</td><td class="mono">${nueva.cutoffs.join(" · ")}</td></tr>
<tr><td>Modelo</td><td class="mono">${nueva.model} (cutoff de conocimiento: oct-2023) · temperatura 0 · seed determinístico por ticker+corte — idéntico a la primera corrida</td></tr>
<tr><td>Benchmark</td><td>SPY (retorno total, precios ajustados)</td></tr>
<tr><td>Pipeline</td><td>Producción v34: gate sectorial + disciplina de conviction + coherencia + guard PEG-turnaround; mismos prompts y reintentos que /analyze</td></tr>
<tr><td>Datos as-of</td><td>Yahoo (FX por período, ADR-equivalente) · EDGAR (segmentos, guidance, Form 4, fechas de release) · FINRA (short) · Finnhub (consenso, key propia) · Wayback/finviz (forward, staleness declarada)</td></tr>
<tr><td>Costo de la corrida</td><td class="mono">≈ US$6,71 (OpenAI)</td></tr>
<tr><td>Archivos fuente</td><td class="mono">${path.basename(nuevaPath)} · ${path.basename(basePath)} (baseline) · verdict_log (v34 vs v33)</td></tr>
</tbody></table>
<p class="cap">Informe generado el ${hoy} por el harness de scripts/backtest/. Uso interno — no es material para clientes ni constituye recomendación de inversión.</p>

<div class="appendix pagebreak">
<h2><span class="no">07</span>Apéndice · Los ${rows.length} veredictos</h2>
<table>
<thead><tr><th>Corte</th><th>Ticker</th><th>Veredicto</th><th class="num">Precio</th><th class="num">Target</th><th class="num">Upside impl.</th><th>Tendencia</th><th class="num">Exceso 6m</th><th class="num">Exceso 12m</th></tr></thead>
<tbody>
${appendixRows}
</tbody></table>
<p class="cap">El corte 2026-01-16 no tiene todavía horizonte de 12 meses (madura en enero de 2027).</p>
</div>

</body></html>`;

const htmlPath = path.join(OUT_DIR, `informe-backtest-paridad-${hoy}.html`);
const pdfPath = path.join(OUT_DIR, `informe-backtest-paridad-${hoy}.pdf`);
writeFileSync(htmlPath, html);

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--disable-gpu", "--allow-file-access-from-files"],
  });
  const page = await browser.newPage();
  await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0", timeout: 30000 });
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate:
      `<div style="width:100%;font-family:Helvetica,Arial;font-size:7px;color:#9FA2C0;padding:0 12mm;display:flex;justify-content:space-between;">` +
      `<span>Backtest /analyze · paridad total · ${hoy}</span><span class="pageNumber"></span></div>`,
    margin: { top: "12mm", bottom: "16mm", left: "12mm", right: "12mm" },
  });
  await browser.close();
  console.log("ok →", pdfPath);
}
void main();
