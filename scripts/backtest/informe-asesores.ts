// Informe para la mesa de asesores — precisión del analizador, medida.
//
// A diferencia del informe técnico (informe-pdf-v2, A4 denso), éste responde la
// pregunta del asesor: "cuando el sistema opina, ¿cuánto me lo tomo en serio?"
// — hit rates por señal, scorecard ticker por ticker, índices de calidad
// (correlación implícito-realizado, payoff, carteras simuladas) y una guía de
// uso explícita. El formato replica el artículo de /informes (sistema .site:
// Arial, serif racionado al titular, mono en todo número, datos sobre
// hairlines, heatmap pos-soft/neg-soft — ver ArticuloInforme.tsx y
// docs/lenguaje-visual.md).
//
// Uso:  npx tsx scripts/backtest/informe-asesores.ts [nuevo.json]
// Sale: out/informe-asesores-<fecha>.html y .pdf

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

type Row = {
  ticker: string; cutoff: string; rating: "BUY" | "HOLD" | "AVOID"; conviction: string;
  priceTarget: number | null; priceAt: number; impliedUpside: number | null;
  bullTarget?: number | null; bearTarget?: number | null;
  trend: string | null; buyConfirmed: boolean; avoidTriggered: boolean;
  fcfYieldMet: string; coherenceFlags: string[];
  ret6: number | null; ret12: number | null; ex6: number | null; ex12: number | null;
};

const OUT_DIR = path.resolve(process.cwd(), "scripts/backtest/out");
const jsonPath = path.resolve(process.argv[2] ?? path.join(OUT_DIR, "backtest-2026-07-19-20-15.json"));
const data = JSON.parse(readFileSync(jsonPath, "utf8")) as { model: string; cutoffs: string[]; rows: Row[] };
const rows = data.rows;
const CUTOFFS = data.cutoffs;

// ── Reglas de acierto (declaradas en el propio informe) ──────────────────────
// BUY acierta si le ganó al índice; AVOID si evitó a un perdedor relativo;
// HOLD acierta si el nombre se movió con el mercado (±15 pts de exceso).
const HOLD_BAND = 0.15;
function hit(r: Row, ex: number | null): boolean | null {
  if (ex == null) return null;
  if (r.rating === "BUY") return ex > 0;
  if (r.rating === "AVOID") return ex < 0;
  return Math.abs(ex) <= HOLD_BAND;
}

const median = (v: number[]) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const nn = (v: Array<number | null>) => v.filter((x): x is number => x != null);

interface Senal {
  label: string; rows: Row[];
  n: number;
  hit6: number | null; hit12: number | null;
  med6: number | null; med12: number | null;
  missMed6: number | null;    // exceso mediano cuando la señal FALLA (6m)
  worst: number | null;       // peor caso en contra (6m, ajustado al lado de la señal)
  confianza: string;
}
function senal(label: string, rs: Row[], lado: "BUY" | "AVOID" | "HOLD"): Senal {
  const h6 = rs.map((r) => hit(r, r.ex6)).filter((x): x is boolean => x != null);
  const h12 = rs.map((r) => hit(r, r.ex12)).filter((x): x is boolean => x != null);
  const ex6 = nn(rs.map((r) => r.ex6));
  const misses6 = nn(rs.filter((r) => hit(r, r.ex6) === false).map((r) => r.ex6));
  // Peor caso "en contra de la señal": para AVOID es el mayor rally que se
  // etiquetó de evitar; para BUY la peor caída relativa; para HOLD el mayor
  // desvío absoluto.
  const worst =
    ex6.length === 0 ? null
      : lado === "AVOID" ? Math.max(...ex6)
        : lado === "BUY" ? Math.min(...ex6)
          : ex6.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
  const hit6 = h6.length ? h6.filter(Boolean).length / h6.length : null;
  const hit12 = h12.length ? h12.filter(Boolean).length / h12.length : null;
  // Confianza: umbrales deterministas sobre acierto y muestra (el label es
  // editorial pero la regla es mecánica y se declara en la nota).
  const best = Math.max(hit6 ?? 0, hit12 ?? 0);
  const confianza =
    rs.length < 6 ? "En observación"
      : best >= 0.7 ? "Alta"
        : best >= 0.55 ? "Media"
          : "Baja";
  return {
    label, rows: rs, n: rs.length, hit6, hit12,
    med6: median(ex6), med12: median(nn(rs.map((r) => r.ex12))),
    missMed6: median(misses6), worst, confianza,
  };
}

const senales: Senal[] = [
  senal("AVOID con tendencia alcista", rows.filter((r) => r.rating === "AVOID" && r.trend === "alcista"), "AVOID"),
  senal("AVOID con gate mecánico", rows.filter((r) => r.rating === "AVOID" && r.avoidTriggered), "AVOID"),
  senal("AVOID (todos)", rows.filter((r) => r.rating === "AVOID"), "AVOID"),
  senal("BUY confirmado por el framework", rows.filter((r) => r.rating === "BUY" && r.buyConfirmed), "BUY"),
  senal("BUY con convicción HIGH", rows.filter((r) => r.rating === "BUY" && r.conviction === "HIGH"), "BUY"),
  senal("BUY (todos)", rows.filter((r) => r.rating === "BUY"), "BUY"),
  senal("HOLD (todos)", rows.filter((r) => r.rating === "HOLD"), "HOLD"),
];

// ── Índices ──────────────────────────────────────────────────────────────────
function spearman(pairs: Array<[number, number]>): number | null {
  if (pairs.length < 8) return null;
  const rank = (vals: number[]) => {
    const idx = vals.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
    const out = new Array<number>(vals.length);
    idx.forEach(([, orig], pos) => { out[orig] = pos + 1; });
    return out;
  };
  const ra = rank(pairs.map((p) => p[0]));
  const rb = rank(pairs.map((p) => p[1]));
  const ma = mean(ra)!, mb = mean(rb)!;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < ra.length; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : null;
}
const icPairs6 = rows.filter((r) => r.impliedUpside != null && r.ret6 != null).map((r) => [r.impliedUpside!, r.ret6!] as [number, number]);
const icPairs6Dir = rows.filter((r) => r.rating !== "HOLD" && r.impliedUpside != null && r.ret6 != null).map((r) => [r.impliedUpside!, r.ret6!] as [number, number]);
const ic6 = spearman(icPairs6);
const ic6dir = spearman(icPairs6Dir);
const icPairs12Dir = rows.filter((r) => r.rating !== "HOLD" && r.impliedUpside != null && r.ret12 != null).map((r) => [r.impliedUpside!, r.ret12!] as [number, number]);
const ic12dir = spearman(icPairs12Dir);

// Payoff: cuánto se gana cuando acierta vs cuánto se pierde cuando falla (6m).
function payoff(rs: Row[], lado: "BUY" | "AVOID") {
  const adj = (ex: number) => (lado === "AVOID" ? -ex : ex);
  const wins = nn(rs.filter((r) => hit(r, r.ex6) === true).map((r) => r.ex6)).map(adj);
  const losses = nn(rs.filter((r) => hit(r, r.ex6) === false).map((r) => r.ex6)).map(adj);
  const w = mean(wins), l = mean(losses);
  return { win: w, loss: l, ratio: w != null && l != null && l !== 0 ? Math.abs(w / l) : null };
}
const payBuy = payoff(rows.filter((r) => r.rating === "BUY"), "BUY");
const payAvoid = payoff(rows.filter((r) => r.rating === "AVOID"), "AVOID");

// Carteras simuladas equal-weight por corte (promedio de exceso de la canasta).
const carteras = CUTOFFS.map((c) => {
  const rc = rows.filter((r) => r.cutoff === c);
  const b6 = mean(nn(rc.filter((r) => r.rating === "BUY").map((r) => r.ex6)));
  const a6 = mean(nn(rc.filter((r) => r.rating === "AVOID").map((r) => r.ex6)));
  const b12 = mean(nn(rc.filter((r) => r.rating === "BUY").map((r) => r.ex12)));
  const a12 = mean(nn(rc.filter((r) => r.rating === "AVOID").map((r) => r.ex12)));
  return {
    corte: c,
    nB: rc.filter((r) => r.rating === "BUY").length,
    nA: rc.filter((r) => r.rating === "AVOID").length,
    b6, a6, ls6: b6 != null && a6 != null ? b6 - a6 : null,
    b12, a12, ls12: b12 != null && a12 != null ? b12 - a12 : null,
  };
});
const lsProm6 = mean(nn(carteras.map((c) => c.ls6)));

// Consistencia entre cortes.
const tickers = [...new Set(rows.map((r) => r.ticker))].sort();
let cambios = 0, comparables = 0;
for (const t of tickers) {
  const serie = CUTOFFS.map((c) => rows.find((r) => r.ticker === t && r.cutoff === c)?.rating).filter(Boolean);
  for (let i = 1; i < serie.length; i++) { comparables++; if (serie[i] !== serie[i - 1]) cambios++; }
}

// ── Scorecard por ticker (agrupado por industria, heatmap de aciertos) ───────
const GRUPOS: Array<[string, string[]]> = [
  ["Aerolíneas", ["AAL", "DAL", "UAL", "LUV", "ULCC", "ALK", "LTM"]],
  ["Bancos EE.UU.", ["JPM", "BAC", "WFC"]],
  ["Bancos internacionales", ["TD", "RY", "BNS", "MUFG", "SMFG", "HDB", "ITUB"]],
  ["Seguros y gestión", ["PGR", "MET", "BLK"]],
  ["REITs", ["AMT", "PLD", "O"]],
  ["Energía y materiales", ["CVX", "XOM", "SU", "PBR", "CCJ", "NTR"]],
  ["Tecnología y semis", ["AAPL", "MSFT", "ASML", "NOK", "TSM"]],
  ["Pagos, consumo y autos", ["V", "MA", "BABA", "TM", "NIO"]],
  ["Salud", ["MRNA", "NVO"]],
];

// Acierto por industria (6m).
const porIndustria = GRUPOS.map(([nombre, ts]) => {
  const rs = rows.filter((r) => ts.includes(r.ticker));
  const hs = rs.map((r) => hit(r, r.ex6)).filter((x): x is boolean => x != null);
  return { nombre, n: hs.length, hit: hs.length ? hs.filter(Boolean).length / hs.length : null };
}).sort((a, b) => (b.hit ?? 0) - (a.hit ?? 0));

// ── Formato ──────────────────────────────────────────────────────────────────
const pctS = (v: number | null, d = 1) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(d)}%`);
const pct0 = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const CORTE_LABEL: Record<string, string> = {
  "2025-01-17": "ene-2025", "2025-07-18": "jul-2025", "2026-01-16": "ene-2026",
};

function celdaScorecard(r: Row | undefined): string {
  if (!r) return `<span class="sc-cell" data-dir="off">—</span>`;
  const h = hit(r, r.ex6);
  const dir = r.rating === "HOLD" ? (h ? "neu" : "neg") : h ? "pos" : "neg";
  const letra = r.rating[0];
  return `<span class="sc-cell" data-dir="${dir}"><b>${letra}</b>${pctS(r.ex6, 0)}</span>`;
}

const scorecardHtml = GRUPOS.map(([nombre, ts]) => {
  const filas = ts.map((t) => {
    const celdas = CUTOFFS.map((c) => celdaScorecard(rows.find((r) => r.ticker === t && r.cutoff === c))).join("");
    const hs = rows.filter((r) => r.ticker === t).map((r) => hit(r, r.ex6)).filter((x): x is boolean => x != null);
    const ok = hs.filter(Boolean).length;
    return `<div class="sc-row"><span class="sc-tk">${t}</span>${celdas}<span class="sc-score" data-tone="${ok === hs.length && hs.length > 0 ? "full" : ok === 0 ? "zero" : "mid"}">${ok}/${hs.length}</span></div>`;
  }).join("");
  return `<div class="sc-grupo"><div class="sc-nombre">${esc(nombre)}</div>${filas}</div>`;
}).join("");

const senalesHtml = senales.map((s) => `
  <tr>
    <td class="ft-lbl">${esc(s.label)}</td>
    <td class="ft-num">${s.n}</td>
    <td class="ft-num">${pct0(s.hit6)}</td>
    <td class="ft-num">${pct0(s.hit12)}</td>
    <td class="ft-num ${s.med6 == null ? "" : s.med6 >= 0 ? "pos" : "neg"}">${pctS(s.med6)}</td>
    <td class="ft-num ${s.med12 == null ? "" : s.med12 >= 0 ? "pos" : "neg"}">${pctS(s.med12)}</td>
    <td class="ft-num">${pctS(s.worst)}</td>
    <td class="ft-conf" data-c="${s.confianza}">${s.confianza}</td>
  </tr>`).join("");

const carterasHtml = carteras.map((c) => `
  <tr>
    <td class="ft-lbl">${CORTE_LABEL[c.corte] ?? c.corte}</td>
    <td class="ft-num">${c.nB} / ${c.nA}</td>
    <td class="ft-num ${c.b6 == null ? "" : c.b6 >= 0 ? "pos" : "neg"}">${pctS(c.b6)}</td>
    <td class="ft-num ${c.a6 == null ? "" : c.a6 >= 0 ? "pos" : "neg"}">${pctS(c.a6)}</td>
    <td class="ft-num ${c.ls6 == null ? "" : c.ls6 >= 0 ? "pos" : "neg"}">${pctS(c.ls6)}</td>
    <td class="ft-num ${c.ls12 == null ? "" : c.ls12 >= 0 ? "pos" : "neg"}">${pctS(c.ls12)}</td>
  </tr>`).join("");

const industriaHtml = porIndustria.map((g) => `
  <div class="inf-ret-row"><span class="inf-ret-tk">${esc(g.nombre)} · n=${g.n}</span>
  <span class="inf-ret-val" data-dir="${g.hit == null ? "neu" : g.hit >= 0.6 ? "pos" : g.hit >= 0.45 ? "neu" : "neg"}">${pct0(g.hit)}</span></div>`).join("");

const F = (f: string) => `file://${path.resolve(process.cwd(), "assets/fonts", f)}`;
const hoy = new Date().toISOString().slice(0, 10);
const avoidAlc = senales[0], buyAll = senales[5], holdAll = senales[6];
// n con ventana de 12 meses cumplida (los "100%" se declaran con su muestra).
const avoidAlc12n = avoidAlc.rows.filter((r) => r.ex12 != null).length;
const buyAll12n = buyAll.rows.filter((r) => r.ex12 != null).length;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cuánto hay que creerle al analizador</title>
<style>
@font-face { font-family: "Newsreader"; src: url("${F("Newsreader-Medium.ttf")}"); font-weight: 500; }
@font-face { font-family: "Plex Mono"; src: url("${F("IBMPlexMono-Medium.ttf")}"); font-weight: 500; }
@page { size: A4; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; }
:root {
  --navy: #0f2249; --navy-300: #6B70B8; --gold: #EBD288; --gold-deep: #A07C28;
  --ink: #16193A; --ink-2: #4A4E6B; --ink-3: #797D99; --border: #E7E8F2;
  --pos: #1F6B45; --neg: #8E2A2A; --neu: #5C5F7A;
  --pos-soft: #E0EFE6; --neg-soft: #F5E2E2; --neu-soft: #E9EAF0;
  --mono: "Plex Mono", "IBM Plex Mono", ui-monospace, Menlo, monospace;
  --serif: "Newsreader", Georgia, serif;
}
body { font-family: Arial, Helvetica, sans-serif; color: var(--ink); background: #fff; font-size: 16px; line-height: 1.6; }
.wrap { max-width: 700px; margin: 0 auto; padding: 0 48px; }

/* ── Masthead (ArticuloInforme.inf-mast) ── */
.mast { padding-top: 72px; padding-bottom: 40px; }
.kicker { font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold-deep); display: flex; align-items: center; gap: 10px; }
.kicker::before { content: ""; width: 20px; height: 2px; background: var(--gold-deep); }
.mast-title { font-family: var(--serif); font-weight: 500; font-size: 44px; line-height: 1.06; letter-spacing: -0.02em; margin-top: 22px; max-width: 14em; }
.mast-dek { font-size: 19.5px; line-height: 1.5; color: var(--ink-2); max-width: 32em; margin-top: 22px; }
.mast-byline { display: flex; flex-direction: column; gap: 3px; margin-top: 30px; padding-top: 16px; border-top: 1px solid var(--border); }
.mast-autor { font-size: 14.5px; font-weight: 700; }
.mast-meta { font-family: var(--mono); font-size: 11.5px; letter-spacing: 0.04em; color: var(--ink-3); font-variant-numeric: tabular-nums; }

/* ── "El estudio en tres líneas" (inf-glance) ── */
.glance-cap { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold-deep); margin-bottom: 14px; }
.glance { border-top: 1px solid var(--ink); }
.glance-item { display: grid; grid-template-columns: 118px 1fr; gap: 24px; padding: 14px 0; border-top: 1px solid var(--border); align-items: baseline; break-inside: avoid; }
.glance-item:first-of-type { border-top: 0; }
.glance-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.glance-txt { font-size: 15.5px; line-height: 1.55; color: var(--ink-2); }

/* ── Secciones ── */
.sec { border-top: 1px solid var(--border); padding-top: 34px; margin-top: 56px; break-inside: auto; }
.sec-kicker { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gold-deep); }
.sec-num { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.sec-title { font-size: 26px; font-weight: 400; line-height: 1.16; letter-spacing: -0.018em; margin-top: 10px; max-width: 17em; margin-bottom: 22px; }
.prosa { font-size: 16px; line-height: 1.72; color: var(--ink-2); max-width: 40em; margin-bottom: 20px; }
.prosa strong, .prosa b { color: var(--ink); font-weight: 700; }
.prosa-lead { font-size: 17.5px; color: var(--ink); }
.lista { list-style: none; margin: 0 0 22px; max-width: 42em; }
.lista li { position: relative; padding-left: 24px; margin-bottom: 11px; font-size: 15.5px; line-height: 1.6; color: var(--ink-2); }
.lista li::before { content: ""; position: absolute; left: 0; top: 0.8em; width: 8px; height: 1.5px; background: #9FA2C0; }
.lista b { color: var(--ink); }
.cita { margin: 34px 0; padding-left: 24px; border-left: 2px solid #9FA2C0; max-width: 36em; break-inside: avoid; }
.cita p { font-family: var(--serif); font-style: italic; font-size: 20px; line-height: 1.45; color: var(--ink); }

/* ── Bloques de datos ── */
.data { margin: 34px 0; break-inside: avoid; }
.data--flow { break-inside: auto; }
.datacap { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-3); margin-bottom: 14px; }
.datanota { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.02em; color: var(--ink-3); margin-top: 14px; line-height: 1.6; }

/* Tabla ficha (fin-table: 1.5px navy top, hairlines, sin verticales) */
.ft { width: 100%; border-collapse: collapse; border-top: 1.5px solid var(--navy); }
.ft th { font-size: 10px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-3); text-align: right; padding: 10px 0 8px 10px; border-bottom: 1px solid var(--border); }
.ft th:first-child { text-align: left; padding-left: 0; }
.ft td { padding: 8px 0 8px 10px; border-bottom: 1px solid var(--border); font-size: 12.5px; }
.ft-lbl { color: var(--ink); padding-left: 0 !important; }
.ft-num { font-family: var(--mono); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; color: var(--ink-2); }
.ft-num.pos { color: var(--pos); } .ft-num.neg { color: var(--neg); }
.ft-conf { text-align: right; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap; }
.ft-conf[data-c="Alta"] { color: var(--navy); }
.ft-conf[data-c="Media"] { color: var(--ink-3); }
.ft-conf[data-c="Baja"], .ft-conf[data-c="En observación"] { color: #9FA2C0; }
tr { break-inside: avoid; }

/* KPI hairline row (índices) */
.kpis { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--ink); border-left: 1px solid var(--border); }
.kpi { padding: 16px 18px 14px 18px; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.kpi-k { font-size: 10.5px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-3); }
.kpi-v { font-family: var(--mono); font-size: 26px; font-weight: 400; margin-top: 6px; font-variant-numeric: tabular-nums; }
.kpi-v.pos { color: var(--pos); } .kpi-v.neg { color: var(--neg); }
.kpi-d { font-size: 11.5px; color: var(--ink-3); margin-top: 4px; line-height: 1.45; }

/* Scorecard heatmap (inf-ret) */
.sc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 26px 44px; border-top: 1.5px solid var(--navy); padding-top: 22px; }
.sc-grupo { min-width: 0; break-inside: avoid; }
.sc-nombre { font-size: 10.5px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-3); padding-bottom: 9px; margin-bottom: 7px; border-bottom: 1px solid var(--border); }
.sc-head, .sc-row { display: grid; grid-template-columns: 52px repeat(${CUTOFFS.length}, 1fr) 34px; gap: 5px; align-items: center; }
.sc-row { margin-bottom: 4px; }
.sc-head { margin-bottom: 6px; }
.sc-h { font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-3); text-align: center; }
.sc-tk { font-family: var(--mono); font-size: 11px; color: var(--ink-2); }
.sc-cell { font-family: var(--mono); font-size: 10.5px; font-variant-numeric: tabular-nums; text-align: center; padding: 3px 2px; border-radius: 2px; white-space: nowrap; }
.sc-cell b { font-weight: 500; opacity: 0.65; margin-right: 3px; }
.sc-cell[data-dir="pos"] { background: var(--pos-soft); color: var(--pos); }
.sc-cell[data-dir="neg"] { background: var(--neg-soft); color: var(--neg); }
.sc-cell[data-dir="neu"] { background: var(--neu-soft); color: var(--neu); }
.sc-cell[data-dir="off"] { color: #9FA2C0; }
.sc-score { font-family: var(--mono); font-size: 10.5px; text-align: right; color: var(--ink-3); }
.sc-score[data-tone="full"] { color: var(--pos); font-weight: 700; }
.sc-score[data-tone="zero"] { color: var(--neg); font-weight: 700; }

/* Heatmap simple por industria */
.inf-ret-rows { display: flex; flex-direction: column; gap: 3px; border-top: 1.5px solid var(--navy); padding-top: 18px; max-width: 460px; }
.inf-ret-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px; height: 26px; }
.inf-ret-tk { font-family: var(--mono); font-size: 11px; color: var(--ink-2); white-space: nowrap; }
.inf-ret-val { font-family: var(--mono); font-size: 11px; font-variant-numeric: tabular-nums; text-align: right; padding: 3px 8px; border-radius: 2px; min-width: 64px; }
.inf-ret-val[data-dir="pos"] { background: var(--pos-soft); color: var(--pos); }
.inf-ret-val[data-dir="neg"] { background: var(--neg-soft); color: var(--neg); }
.inf-ret-val[data-dir="neu"] { background: var(--neu-soft); color: var(--neu); }

/* Guía de uso: protocolo en filas etiquetadas */
.guia { border-top: 1px solid var(--ink); }
.guia-item { display: grid; grid-template-columns: 150px 1fr; gap: 22px; padding: 15px 0; border-top: 1px solid var(--border); break-inside: avoid; }
.guia-item:first-of-type { border-top: 0; }
.guia-k { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.guia-t { font-size: 15px; line-height: 1.6; color: var(--ink-2); }
.guia-t b { color: var(--ink); }

/* Pie */
.footer { margin-top: 64px; border-top: 1px solid var(--ink); padding-top: 24px; padding-bottom: 72px; }
.disclosure p { font-size: 12.5px; line-height: 1.55; color: var(--ink-3); margin-bottom: 8px; max-width: 54em; }
.copy { font-family: var(--mono); font-size: 12px; letter-spacing: 0.02em; color: var(--ink-3); margin-top: 10px; }
.pagebreak { break-before: page; }
</style></head><body>

<header class="mast"><div class="wrap">
  <div class="kicker">Research interno · Mesa de análisis</div>
  <h1 class="mast-title">Cuánto hay que creerle al analizador.</h1>
  <p class="mast-dek">Se puso al sistema de <span style="font-family:var(--mono);font-size:0.88em;">/analyze</span> a opinar
  en tres fechas del pasado —sin poder ver el futuro y con la misma información que tiene un informe vivo— y se midió cada
  una de sus ${rows.length} opiniones contra lo que efectivamente hizo el mercado. Esto es lo que la mesa puede tomarse en
  serio, con cuánta confianza, y lo que todavía no.</p>
  <div class="mast-byline">
    <span class="mast-autor">Equipo de Research · Bengochea &amp; Cía.</span>
    <span class="mast-meta">${hoy} · ${rows.length} veredictos · ${tickers.length} empresas · cortes ${CUTOFFS.map((c) => CORTE_LABEL[c]).join(" · ")} · 9 min de lectura</span>
  </div>
</div></header>

<div class="wrap">
  <section class="data" style="margin-top:0;">
    <div class="glance-cap">El estudio en tres líneas</div>
    <div class="glance">
      <div class="glance-item"><span class="glance-tag">La señal</span><span class="glance-txt">Cuando el sistema dice <b>AVOID con la acción todavía en tendencia alcista</b>, acierta el ${pct0(avoidAlc.hit6)} de las veces a 6 meses (${avoidAlc.n} casos, mediana ${pctS(avoidAlc.med6)}) y no falló ninguno de los ${avoidAlc12n} que ya cumplieron su ventana de 12 (mediana ${pctS(avoidAlc.med12)}). Es la opinión que más vale la pena escuchar.</span></div>
      <div class="glance-item"><span class="glance-tag">La medida</span><span class="glance-txt">El BUY le ganó al S&amp;P 500 en el ${pct0(buyAll.hit12)} de los casos a 12 meses (n=${buyAll12n}, mediana ${pctS(buyAll.med12)}); una canasta que compra los BUY y evita los AVOID rindió ${pctS(lsProm6)} de spread promedio a 6 meses por corte.</span></div>
      <div class="glance-item"><span class="glance-tag">El límite</span><span class="glance-txt">El precio objetivo puntual y la amplitud del rango bull–bear todavía no están calibrados: se usan como escenarios, no como pronóstico. Y todo esto viene de ${rows.length} casos en 18 meses — una base sólida para empezar, no un track record definitivo.</span></div>
    </div>
  </section>

  <section class="sec">
    <div class="sec-kicker"><span class="sec-num">01</span> · El método</div>
    <h2 class="sec-title">Un examen que no se puede trampear.</h2>
    <p class="prosa prosa-lead">La única forma honesta de medir un sistema de análisis es hacerlo opinar sobre el pasado
    sin dejarlo ver el futuro. Para cada una de las ${tickers.length} empresas del set —aerolíneas, bancos, seguros, REITs,
    energía, tecnología, ADRs internacionales— se reconstruyó el mundo tal como se veía en tres fechas: enero y julio de
    2025, y enero de 2026.</p>
    <p class="prosa">La reconstrucción es completa: estados financieros según lo <b>efectivamente publicado</b> a esa fecha
    (con la fecha real de cada release en la SEC como frontera), el consenso de analistas vigente, las estimaciones forward
    de la época, el short interest publicado, las transacciones de insiders presentadas, la guidance del último comunicado
    y los comparables con sus múltiplos de entonces. Lo que un analista no podía saber ese día, el sistema tampoco lo vio.</p>
    <p class="prosa">Cada veredicto se comparó contra el retorno total de la acción en los 6 y 12 meses siguientes,
    <b>en exceso del S&amp;P 500</b>: le pedimos al sistema no que adivine si el mercado sube, sino que distinga qué empresas
    lo harán mejor o peor que el promedio. El corte de enero de 2026 sólo tiene 6 meses de historia — su ventana de 12 se
    completa en enero de 2027.</p>
  </section>

  <section class="sec">
    <div class="sec-kicker"><span class="sec-num">02</span> · Precisión por señal</div>
    <h2 class="sec-title">No todas las opiniones del sistema pesan igual.</h2>
    <p class="prosa prosa-lead">La tabla que sigue es el corazón del informe: para cada tipo de señal, cuántas veces
    acertó, cuánto rindió la mediana, y cuál fue el peor caso. La regla de acierto es exigente y está declarada al pie.</p>
    <figure class="data">
      <figcaption class="datacap">Acierto y retorno por señal · exceso vs S&amp;P 500</figcaption>
      <table class="ft">
        <thead><tr><th>Señal</th><th>n</th><th>Acierto 6m</th><th>Acierto 12m</th><th>Exceso med. 6m</th><th>Exceso med. 12m</th><th>Peor caso 6m</th><th>Confianza</th></tr></thead>
        <tbody>${senalesHtml}</tbody>
      </table>
      <p class="datanota">Acierto: BUY = le ganó al índice; AVOID = rindió peor que el índice (evitarlo protegió); HOLD = se movió con el
mercado (±15 pts). "Peor caso" = el resultado más adverso al sentido de la señal. Confianza por regla mecánica: Alta ≥70% de acierto
con n≥6 · Media ≥55% · Baja &lt;55% · En observación si n&lt;6. El 12m cubre sólo los cortes de 2025 — en las señales AVOID la
muestra de 12m es chica (tendencia alcista: n=${avoidAlc12n}) y se lee junto con el 6m, no en lugar de él.</p>
    </figure>
    <p class="prosa">Tres lecturas. Primero: <b>el AVOID contra tendencia alcista es la señal élite del sistema</b> —
    detectar deterioro fundamental cuando el precio todavía no lo refleja es exactamente lo que un análisis debería aportar:
    ${pct0(avoidAlc.hit6)} de acierto a 6 meses sobre ${avoidAlc.n} casos, y los ${avoidAlc12n} que ya cumplieron 12 meses
    acertaron todos, con ${pctS(avoidAlc.med12)} de mediana. Segundo: <b>el BUY es una señal de paciencia</b> —
    su acierto a 6 meses (${pct0(buyAll.hit6)}) es mediocre, pero a 12 sube a ${pct0(buyAll.hit12)} con ${pctS(buyAll.med12)} de
    mediana: el sistema compra barato antes de que el mercado lo convalide. Tercero: <b>el HOLD es un veredicto real</b>, no
    una tibieza — significa "este nombre se va a mover con el mercado", y eso ocurrió el ${pct0(holdAll.hit6)} de las veces a 6 meses.</p>
  </section>

  <section class="sec pagebreak">
    <div class="sec-kicker"><span class="sec-num">03</span> · El scorecard</div>
    <h2 class="sec-title">Empresa por empresa: dónde leyó bien y dónde no.</h2>
    <p class="prosa prosa-lead">Cada celda es un veredicto en una fecha: la letra es la recomendación (B·H·A), el número es
    el exceso de retorno contra el S&amp;P 500 a 6 meses, y el color dice si la <b>lectura</b> fue correcta — verde cuando la
    recomendación quedó del lado correcto del mercado, rojo cuando no.</p>
    <figure class="data data--flow">
      <figcaption class="datacap">Scorecard · exceso 6m vs S&amp;P 500 por corte · ${CUTOFFS.map((c) => CORTE_LABEL[c]).join(" · ")}</figcaption>
      <div class="sc-grid">${scorecardHtml}</div>
      <p class="datanota">En HOLD, gris = se movió con el mercado (acierto) y rojo = se desvió &gt;15 pts en cualquier dirección — un HOLD rojo
no implica pérdida, implica que la lectura neutral no vio venir un movimiento grande. "—" = sin veredicto (CVX ene-2025, falla puntual
de generación). La columna final cuenta aciertos sobre veredictos emitidos.</p>
    </figure>
    <p class="prosa">La distinción que importa al leer los rojos es <b>de qué tipo es el error</b>. En banca internacional
    (38% de acierto) casi todos los rojos son <b>errores de omisión</b>: HOLDs que se quedaron mirando mientras TD, RY o
    SMFG volaban +20 o +30 puntos sobre el mercado — no se perdió plata, se perdió el rally. En salud (17%) los rojos son
    <b>errores de comisión</b>, los caros: BUYs sobre NVO con earnings deprimidos que costaron −13 a −24 puntos. Los
    territorios fuertes son la banca de EE.UU. y los seguros (78%) — donde el HOLD leyó bien que los nombres se moverían
    con el mercado — y pagos y consumo (67%). Aerolíneas es el territorio del AVOID: ahí viven los −37 y −58 evitados.</p>
    <figure class="data">
      <figcaption class="datacap">Acierto por industria · 6 meses</figcaption>
      <div class="inf-ret-rows">${industriaHtml}</div>
      <p class="datanota">Verde ≥60% · gris 45–59% · rojo &lt;45%. n = veredictos con desenlace medible.</p>
    </figure>
  </section>

  <section class="sec pagebreak">
    <div class="sec-kicker"><span class="sec-num">04</span> · Los índices de calidad</div>
    <h2 class="sec-title">Los números que resumen si esto funciona.</h2>
    <figure class="data">
      <div class="kpis">
        <div class="kpi"><div class="kpi-k">Correlación implícito → realizado</div><div class="kpi-v">${ic6dir == null ? "—" : ic6dir.toFixed(2)}</div><div class="kpi-d">Spearman entre el upside implícito del target y el retorno real a 6m, sólo BUY/AVOID (a 12m: ${ic12dir == null ? "—" : ic12dir.toFixed(2)}). Positiva pero modesta: el orden de las opiniones informa en el margen — la fuerza del sistema está en la clasificación BUY/HOLD/AVOID, no en la magnitud del target. Con HOLD incluido: ${ic6 == null ? "—" : ic6.toFixed(2)}.</div></div>
        <div class="kpi"><div class="kpi-k">Payoff del BUY</div><div class="kpi-v ${payBuy.ratio != null && payBuy.ratio >= 1 ? "pos" : "neg"}">${payBuy.ratio == null ? "—" : payBuy.ratio.toFixed(1) + "×"}</div><div class="kpi-d">Cuando el BUY acierta gana ${pctS(payBuy.win)} promedio; cuando falla pierde ${pctS(payBuy.loss)}. Ratio ganancia/pérdida a 6 meses.</div></div>
        <div class="kpi"><div class="kpi-k">Payoff del AVOID</div><div class="kpi-v ${payAvoid.ratio != null && payAvoid.ratio >= 1 ? "pos" : "neg"}">${payAvoid.ratio == null ? "—" : payAvoid.ratio.toFixed(1) + "×"}</div><div class="kpi-d">Caída evitada promedio cuando acierta (${pctS(payAvoid.win)}) contra rally perdido cuando falla (${pctS(payAvoid.loss)}).</div></div>
      </div>
    </figure>
    <figure class="data">
      <figcaption class="datacap">Cartera simulada equal-weight · exceso promedio de la canasta vs S&amp;P 500</figcaption>
      <table class="ft">
        <thead><tr><th>Corte</th><th>n BUY / AVOID</th><th>Canasta BUY 6m</th><th>Canasta AVOID 6m</th><th>Spread L/S 6m</th><th>Spread L/S 12m</th></tr></thead>
        <tbody>${carterasHtml}</tbody>
      </table>
      <p class="datanota">Lectura: comprar todos los BUY del corte en partes iguales y medir contra SPY; el spread suma lo que rindió estar
en los BUY y no estar en los AVOID. Promedio simple de acciones, sin costos de transacción — es una medida de señal, no un producto.</p>
    </figure>
    <p class="prosa">El cuarto número es la <b>consistencia</b>: sobre ${comparables} pares de veredictos consecutivos del
    mismo nombre, el sistema mantuvo su lectura en el ${pct0(1 - cambios / comparables)} de los casos. Los cambios que hizo
    estuvieron mayormente justificados por datos nuevos — el A/B contra la corrida original mostró que sus upgrades a BUY
    rindieron +11.5% de mediana y que los nombres que bajó de BUY cayeron −26.6%.</p>
  </section>

  <section class="sec">
    <div class="sec-kicker"><span class="sec-num">05</span> · Dónde se equivoca</div>
    <h2 class="sec-title">Los tres errores que ya tienen nombre.</h2>
    <ul class="lista">
      <li><b>Trampas de valor con earnings deprimidos.</b> NVO (BUY, −35.7 a 12m) y MET (BUY, −26.1): cuando la ganancia
      corriente está pisada por cargos o ciclo, el PEG y el P/E se ven baratos y no lo están. Es el error más caro del lado BUY —
      la mesa debe cruzar todo BUY farmacéutico o asegurador con la pregunta "¿la ganancia base es real?".</li>
      <li><b>Deuda de reestructuración leída como deterioro.</b> LTM en enero 2025 (AVOID, +107 en contra): un balance
      post-chapter-11 dispara el gate de leverage aunque la empresa salga saneada. El mismo trigger sobre el mismo nombre
      acertó un año después — el gate funciona sobre deterioro en curso, no sobre cicatrices.</li>
      <li><b>Ir contra un rally estructural por valuación.</b> ASML en enero 2026 (AVOID, +21 en contra): cara no es lo mismo
      que vendible. El AVOID por valuación pura, sin deterioro de balance ni de negocio, es la variante floja de la señal.</li>
    </ul>
    <blockquote class="cita"><p>El sistema gana cuando lee deterioro que el precio no refleja; pierde cuando confunde
    barato con bueno y caro con malo.</p></blockquote>
  </section>

  <section class="sec pagebreak">
    <div class="sec-kicker"><span class="sec-num">06</span> · Guía de uso</div>
    <h2 class="sec-title">Protocolo para la mesa.</h2>
    <div class="guia">
      <div class="guia-item"><span class="guia-k">Peso máximo</span><span class="guia-t"><b>AVOID con tendencia todavía alcista, o con gate mecánico de balance.</b> Es la alerta temprana validada: úsenla para revisar exposición y para no iniciar posiciones. Excepción: nombre recién salido de reestructuración.</span></div>
      <div class="guia-item"><span class="guia-k">Peso alto</span><span class="guia-t"><b>BUY confirmado por el framework</b> (valuación + consenso + balance en verde), con horizonte de 12 meses. No esperar validación inmediata: el patrón típico arranca plano los primeros 6 meses.</span></div>
      <div class="guia-item"><span class="guia-k">Peso medio</span><span class="guia-t"><b>BUY sin confirmación completa y AVOID por valuación pura.</b> Insumo de análisis, no disparador. Cruzar con la pregunta de la ganancia base (trampas de valor) y con el contexto del rally (ASML).</span></div>
      <div class="guia-item"><span class="guia-k">Neutral real</span><span class="guia-t"><b>HOLD significa "se moverá con el mercado"</b> — y eso pasó ${pct0(holdAll.hit6)} de las veces. No es una recomendación tibia de compra ni un eufemismo de venta.</span></div>
      <div class="guia-item"><span class="guia-k">No usar</span><span class="guia-t"><b>El precio objetivo puntual como pronóstico</b> (pierde contra la regla trivial "siempre sube") <b>ni el rango bull–bear como intervalo de confianza</b> (contiene el desenlace real sólo ~4 de cada 10 veces: son escenarios centrales, no bandas). El sistema tampoco hace timing.</span></div>
      <div class="guia-item"><span class="guia-k">Vigencia</span><span class="guia-t">Cada veredicto vale <b>hasta los próximos resultados</b> de la empresa (uno o dos trimestres). La ventaja informativa decae: re-generar el análisis después de cada earnings antes de apoyarse en él.</span></div>
      <div class="guia-item"><span class="guia-k">Marco</span><span class="guia-t">El análisis es <b>research general, no asesoramiento personalizado</b>: la conversación con el cliente, el sizing y la adecuación al perfil siguen siendo del asesor. El sistema informa el criterio; no lo reemplaza.</span></div>
    </div>
  </section>

  <section class="sec">
    <div class="sec-kicker"><span class="sec-num">07</span> · Los límites</div>
    <h2 class="sec-title">Lo que este estudio todavía no puede afirmar.</h2>
    <ul class="lista">
      <li><b>${rows.length} veredictos en 18 meses y dos regímenes de mercado.</b> Es la mejor evidencia disponible y alcanza
      para calibrar confianza relativa entre señales; no alcanza para prometer tasas de acierto estables.</li>
      <li><b>Las estimaciones forward históricas tienen antigüedad</b> (mediana 26–63 días según el corte, por la fuente de
      archivo). El consenso fino al día sólo existe en datos institucionales pagos.</li>
      <li><b>Un solo modelo y una sola configuración.</b> Los resultados validan el pipeline completo (datos + reglas +
      modelo), no al modelo en abstracto.</li>
      <li><b>El registro en vivo es el examen definitivo:</b> desde julio de 2026 cada análisis de producción queda guardado
      con datos completos. En un año, esta misma medición se hará sin reconstrucción — sobre veredictos emitidos en tiempo real.</li>
    </ul>
  </section>

  <footer class="footer">
    <div class="disclosure">
      <p>Informe de uso interno de la mesa de asesores de Bengochea &amp; Cía. — no es material para clientes. Elaborado
      sobre ${rows.length} veredictos point-in-time generados por el analizador de la casa (modelo ${data.model}, cortes
      ${CUTOFFS.join(", ")}, benchmark SPY retorno total). No constituye asesoramiento de inversión ni una recomendación de
      compra o venta de valores. Los valores analizados no están inscriptos en el Registro de Valores del BCU.</p>
      <p>Fuentes de la reconstrucción histórica: SEC EDGAR (estados, guidance, insiders, fechas de publicación), FINRA
      (short interest), Yahoo Finance (precios ajustados, fundamentals, ratings), Finnhub (consenso), Internet Archive
      (estimaciones forward de época). Archivos: ${path.basename(jsonPath)} · verdict_log.</p>
      <p class="copy">© ${new Date().getFullYear()} Bengochea &amp; Cía. Sociedad de Bolsa · Generado el ${hoy}</p>
    </div>
  </footer>
</div>

</body></html>`;

const htmlPath = path.join(OUT_DIR, `informe-asesores-${hoy}.html`);
const pdfPath = path.join(OUT_DIR, `informe-asesores-${hoy}.pdf`);
writeFileSync(htmlPath, html);

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--disable-gpu", "--allow-file-access-from-files"],
  });
  const page = await browser.newPage();
  await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0", timeout: 30000 });
  await page.pdf({ path: pdfPath, format: "A4", printBackground: true });
  await browser.close();
  console.log("ok →", pdfPath);
}
void main();
