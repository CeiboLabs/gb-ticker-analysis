// Eval de calidad + costo por modelo sobre el golden set (P6).
//
// Corre cada ticker por /api/test-model-cost (un fetch de datos por ticker,
// N modelos en paralelo sobre el MISMO prompt de producción — derived +
// guidance + contexto técnico) y agrega por modelo:
//   schema_ok   — output valida el StructuredReportSchema completo
//   coherent    — rating no contradice el framework pre-evaluado en código
//   cites_*     — cita las cifras autoritativas (PEG / FCF yield / target base)
//   anchored    — priceTarget dentro de ±20% del target base
//   acuerdo     — % de ratings iguales al modelo baseline (el primero de MODELS)
//   costo/latencia
//
// Uso:
//   1. Dev server arriba (npm run dev — https://localhost:3000)
//   2. node scripts/eval-models.mjs
//
// Env:
//   BASE_URL=https://localhost:3000
//   MODELS=gpt-4o-2024-11-20,gpt-5,gpt-5-mini   # el primero = baseline
//   TICKERS=KO,JPM        # override; default = golden set completo (41)
//   SAMPLE=8              # primeros N del golden set
//   DELAY_MS=3000         # espaciado entre tickers (SEC EDGAR: ~30 reqs/ticker)
//   OUT=eval.json         # además del resumen, volcar el detalle completo
//   ADMIN_TOKEN=...       # si no está, se lee de .env
//
// Costo: ~US$0.02-0.05 por ticker×modelo (gpt-4o/gpt-5); el resumen final
// imprime el gasto real acumulado.

import { readFileSync, writeFileSync } from "node:fs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0"; // cert self-signed del dev server

const BASE = process.env.BASE_URL ?? "https://localhost:3000";
const DELAY_MS = Number(process.env.DELAY_MS ?? 3000);
const MODELS = (process.env.MODELS ?? "gpt-4o-2024-11-20,gpt-5,gpt-5-mini")
  .split(",").map((s) => s.trim()).filter(Boolean);
const BASELINE = MODELS[0];

// Golden set — mantener en sincronía con scripts/smoke-sankey.mjs (MATRIX).
const GOLDEN = [
  "AAL", "DAL", "UAL", "LUV", "ULCC", "ALK", "LTM",
  "AAPL", "MSFT",
  "JPM", "BAC", "WFC",
  "PGR", "MET",
  "AMT", "PLD", "O",
  "BLK", "MRNA", "CVX", "XOM", "V", "MA",
  "CCJ", "NTR", "SU", "TD", "RY", "BNS",
  "TM", "MUFG", "SMFG", "HDB", "ITUB", "PBR",
  "ASML", "NOK", "TSM", "BABA", "NIO", "NVO",
];

const TICKERS = process.env.TICKERS
  ? process.env.TICKERS.split(",").map((s) => s.trim()).filter(Boolean)
  : GOLDEN.slice(0, Number(process.env.SAMPLE ?? GOLDEN.length));

function adminToken() {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN;
  // Mismos archivos que carga Next, en orden de precedencia local-primero.
  for (const f of [".env.local", ".env.development.local", ".env"]) {
    try {
      const line = readFileSync(new URL(`../${f}`, import.meta.url), "utf8")
        .split("\n").find((l) => l.startsWith("ADMIN_TOKEN="));
      if (line) return line.slice("ADMIN_TOKEN=".length).trim().replace(/^["']|["']$/g, "");
    } catch { /* probar el siguiente */ }
  }
  console.error("Falta ADMIN_TOKEN (env, .env.local o .env)");
  process.exit(1);
}
const TOKEN = adminToken();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (num, den) => (den > 0 ? `${((num / den) * 100).toFixed(0)}%` : "—");

const perModel = new Map(MODELS.map((m) => [m, {
  n: 0, errors: 0, schemaOk: 0,
  cohN: 0, cohOk: 0,
  pegN: 0, pegOk: 0, fcfN: 0, fcfOk: 0, tgtN: 0, tgtOk: 0,
  anchN: 0, anchOk: 0,
  agreeN: 0, agree: 0,
  ratings: { BUY: 0, HOLD: 0, AVOID: 0 },
  cost: 0, ms: 0,
}]));
const failures = [];
const detail = [];

for (const ticker of TICKERS) {
  process.stdout.write(`▶ ${ticker} (${MODELS.length} modelos) ... `);
  let payload;
  try {
    const res = await fetch(
      `${BASE}/api/test-model-cost?ticker=${encodeURIComponent(ticker)}&models=${encodeURIComponent(MODELS.join(","))}`,
      { headers: { "x-admin-token": TOKEN } },
    );
    if (!res.ok) {
      console.log(`HTTP ${res.status}`);
      failures.push({ ticker, error: `HTTP ${res.status}` });
      await sleep(DELAY_MS);
      continue;
    }
    payload = await res.json();
  } catch (e) {
    console.log(`ERROR ${e?.message ?? e}`);
    failures.push({ ticker, error: String(e?.message ?? e) });
    await sleep(DELAY_MS);
    continue;
  }
  detail.push(payload);

  const baseline = payload.results.find((r) => r.model === BASELINE);
  const bits = [];
  for (const r of payload.results) {
    const s = perModel.get(r.model);
    if (!s) continue;
    s.n++;
    if (r.error) { s.errors++; failures.push({ ticker, model: r.model, error: r.msg }); continue; }
    s.cost += r.cost_usd ?? 0;
    s.ms += r.api_ms ?? 0;
    if (r.schema_ok) s.schemaOk++;
    else failures.push({ ticker, model: r.model, error: `schema: ${r.schema_err ?? r.parse_err}` });
    if (r.coherent != null) { s.cohN++; if (r.coherent) s.cohOk++; else failures.push({ ticker, model: r.model, error: `incoherente: ${r.coherence_code}` }); }
    if (r.cites_peg != null) { s.pegN++; if (r.cites_peg) s.pegOk++; }
    if (r.cites_fcf_yield != null) { s.fcfN++; if (r.cites_fcf_yield) s.fcfOk++; }
    if (r.cites_base_target != null) { s.tgtN++; if (r.cites_base_target) s.tgtOk++; }
    if (r.target_anchored != null) { s.anchN++; if (r.target_anchored) s.anchOk++; }
    if (r.verdict_rating && s.ratings[r.verdict_rating] != null) s.ratings[r.verdict_rating]++;
    if (r.model !== BASELINE && baseline?.verdict_rating && r.verdict_rating) {
      s.agreeN++;
      if (r.verdict_rating === baseline.verdict_rating) s.agree++;
    }
    bits.push(`${r.model.replace("gpt-", "").replace("-2024-11-20", "")}=${r.verdict_rating ?? "?"}`);
  }
  console.log(`OK data=${payload.data_fetch_ms}ms guid=${payload.has_guidance ? "sí" : "no"} tech=${payload.has_technical ? "sí" : "no"} | ${bits.join(" ")}`);
  await sleep(DELAY_MS);
}

// ── Scoreboard ────────────────────────────────────────────────────────────────
console.log(`\n═══ Scoreboard (${TICKERS.length} tickers · baseline: ${BASELINE}) ═══`);
const cols = ["modelo", "n", "err", "schema", "coher.", "citaPEG", "citaFCF", "citaTgt", "ancla", "acuerdo", "BUY/HOLD/AVOID", "costo", "avg ms"];
const rows = [cols];
for (const [m, s] of perModel) {
  const ok = s.n - s.errors;
  rows.push([
    m, String(s.n), String(s.errors),
    pct(s.schemaOk, ok), pct(s.cohOk, s.cohN),
    pct(s.pegOk, s.pegN), pct(s.fcfOk, s.fcfN), pct(s.tgtOk, s.tgtN),
    pct(s.anchOk, s.anchN),
    m === BASELINE ? "(base)" : pct(s.agree, s.agreeN),
    `${s.ratings.BUY}/${s.ratings.HOLD}/${s.ratings.AVOID}`,
    `$${s.cost.toFixed(3)}`,
    ok > 0 ? `${Math.round(s.ms / ok)}` : "—",
  ]);
}
const widths = cols.map((_, i) => Math.max(...rows.map((r) => r[i].length)));
for (const r of rows) console.log("  " + r.map((c, i) => c.padEnd(widths[i] + 2)).join(""));

const totalCost = [...perModel.values()].reduce((a, s) => a + s.cost, 0);
console.log(`\nGasto total OpenAI de esta corrida: $${totalCost.toFixed(3)}`);

if (failures.length) {
  console.log(`\n─── Fallas / incoherencias (${failures.length}) ───`);
  for (const f of failures.slice(0, 30)) {
    console.log(`  ${f.ticker}${f.model ? ` · ${f.model}` : ""}: ${f.error}`);
  }
  if (failures.length > 30) console.log(`  … y ${failures.length - 30} más (ver OUT=)`);
}

if (process.env.OUT) {
  writeFileSync(process.env.OUT, JSON.stringify({ tickers: TICKERS, models: MODELS, detail, failures }, null, 2));
  console.log(`\nDetalle completo → ${process.env.OUT}`);
}
