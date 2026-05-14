// Compara costo real (incluyendo reasoning tokens) y latencia entre modelos
// para el prompt de análisis de Bengochea.
//
// Uso:
//   1. Levantar el dev server: npm run dev (asume puerto 3000 o setear PORT)
//   2. node scripts/compare-models.mjs
//
// Variables de entorno opcionales:
//   PORT=3002              # puerto del dev server
//   TICKERS=AAPL,JPM,XOM   # override de la lista por defecto
//   MODELS=gpt-5,gpt-4o-2024-11-20,gpt-5-mini
//   DELAY_MS=1500          # delay entre tickers (proteger SEC EDGAR)
//
// Importante: el endpoint hace 1 fetch a Yahoo+EDGAR por ticker (no por modelo)
// y corre los N modelos en paralelo sobre los mismos datos. El delay entre
// tickers protege el rate limit de SEC EDGAR (10 req/s, fanout ~30/call).

const PORT = process.env.PORT ?? "3000";
const ENDPOINT = `http://localhost:${PORT}/api/test-model-cost`;
const DELAY_MS = Number(process.env.DELAY_MS ?? 1500);

const TICKERS = (process.env.TICKERS ?? "AAPL,JPM,XOM,NVDA,KO").split(",").map((s) => s.trim());
const MODELS = (process.env.MODELS ?? "gpt-4o-2024-11-20,gpt-5,gpt-5-mini").split(",").map((s) => s.trim());

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runTicker(ticker) {
  const url = `${ENDPOINT}?ticker=${encodeURIComponent(ticker)}&models=${encodeURIComponent(MODELS.join(","))}`;
  const res = await fetch(url);
  return { httpOk: res.ok, ...(await res.json()) };
}

function fmtUsd(n) {
  return n == null ? "—" : `$${n.toFixed(4)}`;
}
function fmtTok(n) {
  return n == null ? "—" : n.toLocaleString("en-US");
}
function fmtMs(n) {
  if (n == null) return "—";
  return n < 1000 ? `${n}ms` : `${(n / 1000).toFixed(1)}s`;
}

const results = [];

for (const ticker of TICKERS) {
  process.stdout.write(`▶ ${ticker} (${MODELS.length} modelos en paralelo) ... `);
  const t0 = Date.now();
  try {
    const r = await runTicker(ticker);
    const dt = Date.now() - t0;
    if (!r.httpOk) {
      console.log(`HTTP ERROR (${r.error ?? "?"})`);
      continue;
    }
    console.log(`OK (data=${fmtMs(r.data_fetch_ms)}, total=${fmtMs(dt)}, segments=${r.has_segment_data})`);
    for (const m of r.results) {
      if (m.error) {
        console.log(`    ${m.model.padEnd(22)} ERROR: ${m.msg ?? m.error}`);
        results.push({ ticker, model: m.model, error: m.msg ?? m.error });
      } else {
        const verdict = m.verdict_rating ?? "?";
        const conviction = m.verdict_conviction ?? "?";
        console.log(
          `    ${m.model.padEnd(22)} VERDICT=${verdict.padEnd(6)} conv=${conviction.padEnd(6)} bull=${m.bull_target ?? "—"} bear=${m.bear_target ?? "—"}  cost=${fmtUsd(m.cost_usd)}  api=${fmtMs(m.api_ms)}`
        );
        results.push({
          ticker,
          model: m.model,
          verdict,
          conviction,
          bull: m.bull_target,
          bear: m.bear_target,
          input: m.usage.input_tokens,
          output: m.usage.output_tokens,
          reasoning: m.usage.reasoning_tokens,
          cost: m.cost_usd,
          api_ms: m.api_ms,
          parse_ok: m.parse_ok,
          finish: m.finish_reason,
          rationale: m.verdict_rationale,
        });
      }
    }
  } catch (e) {
    console.log(`EXC ${e.message}`);
  }

  // Throttle to protect SEC EDGAR rate limit
  if (ticker !== TICKERS[TICKERS.length - 1]) await sleep(DELAY_MS);
}

console.log("\n──────────── RESUMEN POR MODELO ────────────\n");

const byModel = {};
for (const r of results) {
  if (r.error) continue;
  byModel[r.model] ??= { runs: 0, in: 0, out: 0, reasoning: 0, cost: 0, api_ms: 0, parse_fail: 0 };
  const m = byModel[r.model];
  m.runs++;
  m.in += r.input;
  m.out += r.output;
  m.reasoning += r.reasoning;
  m.cost += r.cost;
  m.api_ms += r.api_ms;
  if (!r.parse_ok) m.parse_fail++;
}

console.log(["modelo", "runs", "avg in", "avg out", "avg reason", "avg cost", "avg api", "parse fails"].join("\t"));
for (const [model, m] of Object.entries(byModel)) {
  console.log(
    [
      model,
      m.runs,
      fmtTok(Math.round(m.in / m.runs)),
      fmtTok(Math.round(m.out / m.runs)),
      fmtTok(Math.round(m.reasoning / m.runs)),
      fmtUsd(m.cost / m.runs),
      fmtMs(Math.round(m.api_ms / m.runs)),
      `${m.parse_fail}/${m.runs}`,
    ].join("\t")
  );
}

console.log("\n──────────── VEREDICTOS POR TICKER ────────────\n");
const byTicker = {};
for (const r of results) {
  if (r.error) continue;
  byTicker[r.ticker] ??= [];
  byTicker[r.ticker].push(r);
}
for (const [ticker, rows] of Object.entries(byTicker)) {
  console.log(`\n${ticker}:`);
  const verdicts = new Set(rows.map((r) => r.verdict));
  const agree = verdicts.size === 1 ? "✓ todos coinciden" : "✗ discrepan";
  console.log(`  ${agree} (${[...verdicts].join(", ")})`);
  for (const r of rows) {
    console.log(`    ${r.model.padEnd(22)} ${String(r.verdict).padEnd(7)} conv=${String(r.conviction).padEnd(7)} bull=${r.bull ?? "—"}  bear=${r.bear ?? "—"}`);
    if (r.rationale) console.log(`      "${r.rationale.slice(0, 180)}${r.rationale.length > 180 ? "…" : ""}"`);
  }
}

console.log("\n──────────── DETALLE ────────────\n");
console.table(
  results.map((r) =>
    r.error
      ? { ticker: r.ticker, model: r.model, error: r.error }
      : {
          ticker: r.ticker,
          model: r.model,
          input: r.input,
          output: r.output,
          reasoning: r.reasoning,
          cost_usd: r.cost,
          api_ms: r.api_ms,
          parse: r.parse_ok ? "ok" : "FAIL",
          finish: r.finish,
        }
  )
);

const baseline = "gpt-4o-2024-11-20";
if (byModel[baseline]) {
  const base = byModel[baseline].cost / byModel[baseline].runs;
  console.log(`\nComparación vs ${baseline} (avg $${base.toFixed(4)}/análisis):\n`);
  for (const [model, m] of Object.entries(byModel)) {
    if (model === baseline) continue;
    const avg = m.cost / m.runs;
    const delta = ((avg - base) / base) * 100;
    const sign = delta >= 0 ? "+" : "";
    console.log(`  ${model.padEnd(25)} ${fmtUsd(avg)}  (${sign}${delta.toFixed(1)}%)`);
  }
}
