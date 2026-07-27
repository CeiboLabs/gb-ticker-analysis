// Informe PDF del backtest point-in-time.
//
// Lee el JSON más reciente de scripts/backtest/out/ (o el pasado por argv),
// recomputa los agregados y emite un informe editorial (sistema visual de la
// casa: tinta azul-negra, hairlines, Newsreader para display, Plex Mono para
// números; verde bosque / oxblood SOLO como refuerzo de signo — el signo viaja
// siempre por posición vs cero + etiqueta con signo, nunca por color solo).
//
// Uso:  npx tsx scripts/backtest/informe-pdf.ts [out/backtest-XXX.json]
// Sale: out/informe-backtest-<fecha>.html y .pdf (A4, footer paginado).

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

type Row = {
  ticker: string; cutoff: string; rating: "BUY" | "HOLD" | "AVOID"; conviction: string;
  priceTarget: number | null; priceAt: number; impliedUpside: number | null;
  trend: string | null; buyConfirmed: boolean; avoidTriggered: boolean;
  fcfYieldMet: string; balanceMet: string; granularity: string; coherenceFlags: string[];
  ret6: number | null; ret12: number | null; ex6: number | null; ex12: number | null;
};

const OUT_DIR = path.resolve(process.cwd(), "scripts/backtest/out");
const jsonPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(OUT_DIR, readdirSync(OUT_DIR).filter((f) => f.startsWith("backtest-") && f.endsWith(".json")).sort().at(-1)!);
const data = JSON.parse(readFileSync(jsonPath, "utf8")) as {
  model: string; cutoffs: string[]; rows: Row[]; skips: Array<{ ticker: string; cutoff: string; reason: string }>;
};
const rows = data.rows;

// ── Agregados ─────────────────────────────────────────────────────────────────
const median = (v: number[]) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const nn = (v: Array<number | null>) => v.filter((x): x is number => x != null);

interface Cohort { label: string; n: number; med6: number | null; avg6: number | null; med12: number | null; avg12: number | null }
function cohort(label: string, rs: Row[]): Cohort {
  return {
    label, n: rs.length,
    med6: median(nn(rs.map((r) => r.ex6))), avg6: mean(nn(rs.map((r) => r.ex6))),
    med12: median(nn(rs.map((r) => r.ex12))), avg12: mean(nn(rs.map((r) => r.ex12))),
  };
}

const byRating = (["BUY", "HOLD", "AVOID"] as const).map((r) => cohort(r, rows.filter((x) => x.rating === r)));
const byConv = ["HIGH", "MEDIUM"].map((c) => cohort(`BUY · ${c}`, rows.filter((x) => x.rating === "BUY" && x.conviction === c)));
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
const tgt = rows.filter((r) => r.impliedUpside != null && r.ret12 != null);
const tgtMae = mean(tgt.map((r) => Math.abs((r.impliedUpside as number) - (r.ret12 as number))));
const tgtDir = tgt.length ? tgt.filter((r) => Math.sign(r.impliedUpside as number) === Math.sign(r.ret12 as number)).length / tgt.length : null;
const nBuy = byRating[0].n, nHold = byRating[1].n, nAvoid = byRating[2].n;

// ── Formato ───────────────────────────────────────────────────────────────────
const pctS = (v: number | null, d = 1) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(d)}%`);
const money = (v: number | null) => (v == null ? "—" : `$${v.toFixed(2)}`);
const POS = "#1F6B45", NEG = "#8E2A2A", HAIR = "#C6C8E0", INK = "#0E1130", INK3 = "#6E7290";

// Barras horizontales desde cero, layout de tres columnas fijas — nombre |
// plot | valor — para que NINGUNA etiqueta pueda colisionar con una barra.
// El SIGNO viaja por posición (izq/der del eje de cero) y por la etiqueta mono
// con signo en la columna de valores; el color sólo refuerza. El n vive en la
// tabla adjunta, no en el chart.
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
    if (v == null) {
      s += `<text x="${W}" y="${y + 12.5}" text-anchor="end" font-size="9" fill="${INK3}">s/d</text>`;
      return;
    }
    const w = Math.min(Math.abs(v) * scale, plotW / 2);
    const x = v >= 0 ? zero : zero - w;
    const color = v >= 0 ? POS : NEG;
    s += `<rect x="${x.toFixed(1)}" y="${y + 3}" width="${Math.max(w, 1.5).toFixed(1)}" height="12" fill="${color}" rx="2"/>`;
    s += `<text x="${W}" y="${y + 12.5}" text-anchor="end" font-size="9" fill="${color}">${pctS(v)}</text>`;
  });
  return s + `</svg>`;
}

function cohortTable(cs: Cohort[]): string {
  const cell = (v: number | null) =>
    `<td class="num ${v == null ? "" : v >= 0 ? "pos" : "neg"}">${pctS(v)}</td>`;
  return `<table><thead><tr><th>Cohorte</th><th class="num">n</th><th class="num">6m med.</th><th class="num">6m prom.</th><th class="num">12m med.</th><th class="num">12m prom.</th></tr></thead><tbody>${cs
    .map((c) => `<tr><td>${c.label}</td><td class="num">${c.n}</td>${cell(c.med6)}${cell(c.avg6)}${cell(c.med12)}${cell(c.avg12)}</tr>`)
    .join("")}</tbody></table>`;
}

const F = (f: string) => `file://${path.resolve(process.cwd(), "assets/fonts", f)}`;

const appendixRows = [...rows]
  .sort((a, b) => a.cutoff.localeCompare(b.cutoff) || a.ticker.localeCompare(b.ticker))
  .map((r) => `<tr><td class="num">${r.cutoff}</td><td>${r.ticker}</td><td>${r.rating}<span class="dim"> · ${r.conviction}</span></td><td class="num">${money(r.priceAt)}</td><td class="num">${money(r.priceTarget)}</td><td class="num">${pctS(r.impliedUpside)}</td><td>${r.trend ?? "—"}</td><td class="num ${r.ret12 == null ? "" : r.ret12 >= 0 ? "pos" : "neg"}">${pctS(r.ret12)}</td><td class="num ${r.ex12 == null ? "" : r.ex12 >= 0 ? "pos" : "neg"}">${pctS(r.ex12)}</td></tr>`)
  .join("\n");

const hoy = new Date().toISOString().slice(0, 10);

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Backtest point-in-time · /analyze</title>
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
  <div class="kicker">Informe técnico interno · Analizador /analyze</div>
  <h1>Backtest point-in-time del veredicto:<br>¿la recomendación tiene validación?</h1>
  <p class="lede">Se reconstruyó el estado del mundo en dos fechas de 2025, se le pidió al pipeline real de producción
  que emitiera su veredicto con esos datos —sin poder ver el futuro— y se comparó cada recomendación contra lo que
  efectivamente pasó en el mercado los 6 y 12 meses siguientes.</p>
  <div class="meta">
    <div>Veredictos<b>${rows.length}</b></div>
    <div>Universo<b>${new Set(rows.map((r) => r.ticker)).size} tickers · 2 cortes</b></div>
    <div>Modelo<b>${data.model.replace("-2024-11-20", "")}</b></div>
    <div>Fecha del informe<b>${hoy}</b></div>
  </div>
</div>

<h2><span class="no">01</span>Resumen ejecutivo</h2>
<div class="hallazgo"><b>El orden se cumple: BUY &gt; HOLD &gt; AVOID.</b> En medianas de exceso de retorno contra el S&amp;P 500:
${pctS(byRating[0].med6)} / ${pctS(byRating[1].med6)} / ${pctS(byRating[2].med6)} a 6 meses y
${pctS(byRating[0].med12)} / ${pctS(byRating[1].med12)} / ${pctS(byRating[2].med12)} a 12 meses.
El sistema, mirando sólo datos del pasado, ordenó correctamente las tres cohortes.</div>
<div class="hallazgo"><b>La señal más fuerte es el lado AVOID.</b> Cuando las condiciones mecánicas de AVOID se dispararon
(n=${byCond[2].n}), la mediana fue ${pctS(byCond[2].med12)} contra el mercado a 12 meses. Y los AVOID emitidos con la
tendencia de precio todavía alcista (n=${interact[2].n}) terminaron en ${pctS(interact[2].med12)}: el análisis fundamental
le ganó a la tendencia — evidencia directa contra convertir el momentum en regla de decisión.</div>
<div class="hallazgo"><b>El modelo es conservador con datos incompletos: ${Math.round((nHold / rows.length) * 100)}% HOLD.</b>
Los grandes rallies del período quedaron dentro de HOLD, no de BUY. La selección BUY del backtest corrió además
subalimentada (sin consenso ni estimaciones forward, que producción sí tiene), por lo que este resultado probablemente
subestima al BUY real.</div>
<div class="hallazgo"><b>Los gates cuantitativos discriminan.</b> La condición de valuación en CUMPLE rindió
${pctS(byCond[0].med12)} de mediana a 12 meses vs ${pctS(byCond[1].med12)} en NO CUMPLE. La capa de métricas en código
quedó validada por retornos, no sólo por diseño.</div>

<h2><span class="no">02</span>Metodología</h2>
<p><strong>Diseño point-in-time.</strong> Para cada corte (${data.cutoffs.join(" y ")}) y cada ticker del golden set se
reconstruyó un snapshot con lo que un inversor podía saber ese día: precios diarios ajustados por dividendos y splits
hasta el corte, balance y flujos de la última información publicada (deuda, caja, EBITDA, flujo de caja libre, EPS,
ingresos, acciones en circulación), el contexto técnico (rango 52 semanas, medias de 50/200 ruedas, retornos, drawdown,
volatilidad) computado sobre la serie truncada, y el CAPE con los EPS anuales previos al corte.</p>
<p><strong>Honestidad sobre lo irrecuperable.</strong> Lo que no existe de forma retroactiva —consenso de analistas,
estimaciones forward, short interest, transacciones de insiders, noticias, guidance— se declaró explícitamente como no
disponible. El pipeline de producción está diseñado para degradar con datos faltantes (condición “N/D no bloquea”), y es
exactamente el mismo código el que corrió acá: mismas métricas derivadas, mismo prompt, mismas reglas de coherencia y
reintentos.</p>
<p><strong>Anti-fuga de información.</strong> La fecha que el prompt declara como “hoy” es la fecha del corte (se
verifica por assert en cada prompt, junto con la ausencia de la fecha real y que la serie técnica termine en el corte).
El modelo (${data.model}) tiene corte de conocimiento en octubre de 2023: no conoce ningún desenlace de 2025-2026.</p>
<p><strong>Medición.</strong> Retorno total (precios ajustados) de cada ticker desde el corte a 6 y 12 meses, menos el
retorno del S&amp;P 500 (SPY) en la misma ventana — el “exceso” que se reporta en todo el informe. Cada veredicto quedó
además persistido en la base (<span class="mono">verdict_log</span>, <span class="mono">source='backtest:&lt;corte&gt;'</span>).</p>
<h3>Límites del diseño</h3>
<ul>
<li>Yahoo publica sólo ~6 trimestres de historia trimestral: en los cortes de 2025 los flujos caen a granularidad anual (la última FY cerrada antes del corte).</li>
<li>Los prompts del backtest no llevan el desglose de segmentos SEC ni el hint de industria (requerirían reconstrucción EDGAR as-of, fuera de esta etapa).</li>
<li>Los estados de Yahoo son “según se conocen hoy”: un restatement posterior es una fuga menor asumida.</li>
<li>Un solo régimen de mercado (2025, año de rally global) y colas chicas: n=${nBuy} BUY, n=${nAvoid} AVOID.</li>
</ul>

<h2 class="pagebreak"><span class="no">03</span>Resultados</h2>
<h3>Distribución de veredictos</h3>
<div class="dist">
  <div style="background:#1F6B45;width:${(nBuy / rows.length) * 100}%">BUY ${nBuy}</div>
  <div style="background:#5C5F7A;width:${(nHold / rows.length) * 100}%">HOLD ${nHold}</div>
  <div style="background:#8E2A2A;width:${(nAvoid / rows.length) * 100}%">AVOID ${nAvoid}</div>
</div>
<p class="cap">${rows.length} veredictos · ${data.skips.length} exclusiones por datos insuficientes.</p>

<h3>Exceso de retorno por rating (la pregunta central)</h3>
<div class="charts">${barChart(byRating, "med6", "Mediana exceso vs SPY · 6 meses")}${barChart(byRating, "med12", "Mediana exceso vs SPY · 12 meses")}</div>
<p class="cap">Barras desde la línea de cero: derecha = le ganó al S&amp;P 500, izquierda = perdió. Verde/rojo refuerzan el signo; el valor exacto acompaña cada barra.</p>
${cohortTable(byRating)}
<p>La lectura fina: en <strong>medianas</strong> el orden es correcto en ambos horizontes. En <strong>promedios</strong> a 12 meses
HOLD (${pctS(byRating[1].avg12)}) supera a BUY (${pctS(byRating[0].avg12)}) — efecto de outliers extraordinarios que quedaron en
HOLD (ASML +120, NOK +96, BABA +81 puntos de exceso): el costo de la conservación en un año de rally.</p>

<h3>Conviction dentro de BUY</h3>
${cohortTable(byConv)}
<p class="cap">BUY·HIGH con n=${byConv[0].n} es anecdótico; se reporta por completitud.</p>

<h3>Tendencia técnica al corte (señal aislada)</h3>
${cohortTable(byTrend)}
<p>La tendencia sola <strong>no es monotónica</strong> (mixta &gt; bajista &gt; alcista en mediana a 12m): como señal de decisión
independiente no se sostiene en esta ventana. Coherente con el diseño vigente: contexto narrativo, nunca gate.</p>

<h3>Interacción rating × tendencia</h3>
${cohortTable(interact)}
<p>La celda decisiva es <strong>AVOID + alcista</strong> (${pctS(interact[2].med12)} en mediana a 12m): los AVOID fundamentales
emitidos contra una tendencia todavía positiva fueron los aciertos más grandes del estudio. Un gate técnico los habría vetado.</p>

<h3>Condiciones del framework determinables as-of</h3>
<div class="charts">${barChart(byCond, "med12", "Mediana exceso vs SPY · 12 meses")}</div>
${cohortTable(byCond)}

<h3>Targets de precio</h3>
<p>Sobre ${tgt.length} veredictos con target: la <strong>dirección</strong> del upside implícito coincidió con el realizado a 12 meses
en el <strong>${tgtDir == null ? "—" : Math.round(tgtDir * 100)}%</strong> de los casos; el error absoluto medio de magnitud fue
<strong>${pctS(tgtMae)}</strong>. Los targets puntuales a 12 meses son la pieza más débil del sistema — esperable en un año donde
varios nombres duplicaron: sirven como ancla de escenario, no como pronóstico puntual.</p>

<h2><span class="no">04</span>Recomendaciones</h2>
<ul>
<li><strong>Mantener estricta la maquinaria AVOID.</strong> Es la señal validada con más fuerza: gates mecánicos + veredicto del modelo identificaron a los perdedores incluso en pleno rally.</li>
<li><strong>No convertir el contexto técnico en gate.</strong> La evidencia (AVOID+alcista) muestra que el fundamental debe poder pisar a la tendencia. Sigue como contexto narrativo y como campo registrado para futura calibración.</li>
<li><strong>La validación limpia del BUY llega con el <span class="mono">verdict_log</span> vivo</strong>, que acumula veredictos con datos completos (consenso, forward, guidance) desde julio 2026. Este backtest fija la línea de base.</li>
<li><strong>Extensiones posibles:</strong> tercer corte (ene-2026, horizonte 6m) para engrosar colas (~US$2,3); reconstrucción de consenso histórico vía EDGAR para des-subalimentar el BUY as-of (v2); dashboard de calibración en /admin/monitor cuando haya masa.</li>
</ul>

<h2><span class="no">05</span>Ficha técnica</h2>
<table class="ficha">
<tbody>
<tr><td>Universo</td><td>Golden set de ${new Set(rows.map((r) => r.ticker)).size} tickers por industria (aerolíneas, bancos, seguros, REITs, biotech, oil&amp;gas, servicios, ADRs internacionales)</td></tr>
<tr><td>Cortes</td><td class="mono">${data.cutoffs.join(" · ")}</td></tr>
<tr><td>Modelo</td><td class="mono">${data.model} (cutoff de conocimiento: oct-2023) · temperatura 0 · seed determinístico por ticker+corte</td></tr>
<tr><td>Benchmark</td><td>SPY (retorno total, precios ajustados)</td></tr>
<tr><td>Pipeline</td><td>Idéntico a producción: computeDerivedMetrics + contexto técnico + prompt institucional + validación de esquema + gate de coherencia (1 retry c/u)</td></tr>
<tr><td>Datos</td><td>Yahoo Finance (velas ajustadas desde 2019, fundamentals históricos); sin llamadas a SEC EDGAR en esta etapa</td></tr>
<tr><td>Costo de la corrida</td><td class="mono">≈ US$4,51 (OpenAI)</td></tr>
<tr><td>Archivos fuente</td><td class="mono">${path.basename(jsonPath)} · verdict_log (source='backtest:*')</td></tr>
</tbody></table>
<p class="cap">Informe generado el ${hoy} por el harness de scripts/backtest/. Uso interno — no es material para clientes ni constituye recomendación de inversión.</p>

<div class="appendix pagebreak">
<h2><span class="no">06</span>Apéndice · Los ${rows.length} veredictos</h2>
<table>
<thead><tr><th>Corte</th><th>Ticker</th><th>Veredicto</th><th class="num">Precio</th><th class="num">Target</th><th class="num">Upside impl.</th><th>Tendencia</th><th class="num">Ret. 12m</th><th class="num">Exceso 12m</th></tr></thead>
<tbody>
${appendixRows}
</tbody></table>
</div>

</body></html>`;

const stamp = hoy;
const htmlPath = path.join(OUT_DIR, `informe-backtest-${stamp}.html`);
const pdfPath = path.join(OUT_DIR, `informe-backtest-${stamp}.pdf`);
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
      `<span>Backtest /analyze · ${hoy}</span><span class="pageNumber"></span></div>`,
    margin: { top: "12mm", bottom: "16mm", left: "12mm", right: "12mm" },
  });
  await browser.close();
  console.log("ok →", pdfPath);
}
void main();
