// Bulk-test the 8-K Exhibit 99.1 parser against the full S&P 500.
// Hits the local /api/test-8k-parser endpoint and writes results.

import fs from "node:fs";

const PORT = 3002;
const ENDPOINT = `http://localhost:${PORT}/api/test-8k-parser`;
const RESULT_FILE = "scripts/sp500-8k-results.json";
const SUMMARY_FILE = "scripts/sp500-8k-summary.txt";
const DELAY_MS = 200;

async function fetchSP500Tickers() {
  const res = await fetch("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies", {
    headers: { "User-Agent": "ticker-app contact@bengochea.com" },
  });
  if (!res.ok) throw new Error(`Wikipedia fetch failed: ${res.status}`);
  const html = await res.text();

  const tableMatch = html.match(/<table[^>]*id="constituents"[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) throw new Error("constituents table not found");
  const tableHtml = tableMatch[1];

  const rowRe = /<tr>([\s\S]*?)<\/tr>/g;
  const tickers = [];
  let m;
  while ((m = rowRe.exec(tableHtml)) !== null) {
    const firstCell = m[1].match(/<td[^>]*>([\s\S]*?)<\/td>/);
    if (!firstCell) continue;
    const tickerMatch = firstCell[1].match(/>([A-Z][A-Z.]{0,6})</);
    if (tickerMatch) tickers.push(tickerMatch[1]);
  }
  return [...new Set(tickers)].sort();
}

async function testTicker(ticker) {
  try {
    const res = await fetch(`${ENDPOINT}?ticker=${encodeURIComponent(ticker)}`);
    if (!res.ok) {
      return { ticker, ok: false, reason: `http-${res.status}`, parsed: null, bestScore: 0, exhibitUrl: null };
    }
    const data = await res.json();
    return {
      ticker,
      ok: data.parsed !== null,
      reason: data.debug?.reason ?? "unknown",
      parsed: data.parsed,
      bestScore: data.debug?.bestScore ?? 0,
      exhibitUrl: data.debug?.exhibitUrl ?? null,
    };
  } catch (e) {
    return {
      ticker,
      ok: false,
      reason: `exception: ${e instanceof Error ? e.message : String(e)}`,
      parsed: null,
      bestScore: 0,
      exhibitUrl: null,
    };
  }
}

async function main() {
  console.log("Fetching S&P 500 ticker list from Wikipedia...");
  const tickers = await fetchSP500Tickers();
  console.log(`Got ${tickers.length} tickers`);

  const results = [];
  const start = Date.now();
  for (let i = 0; i < tickers.length; i++) {
    const t = tickers[i];
    const r = await testTicker(t);
    results.push(r);
    const elapsed = ((Date.now() - start) / 1000).toFixed(0);
    const status = r.ok ? "OK " : "FAIL";
    process.stdout.write(`\r[${i + 1}/${tickers.length}] ${status} ${t.padEnd(8)} ${r.reason.padEnd(25)} ${elapsed}s`);
    if (r.ok) process.stdout.write("\n");
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }
  process.stdout.write("\n");

  fs.writeFileSync(RESULT_FILE, JSON.stringify(results, null, 2));

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;
  const reasonCounts = {};
  for (const r of results) {
    if (!r.ok) reasonCounts[r.reason] = (reasonCounts[r.reason] ?? 0) + 1;
  }
  const lines = [];
  lines.push(`Total tickers:  ${results.length}`);
  lines.push(`Parsed OK:      ${okCount} (${((okCount / results.length) * 100).toFixed(1)} %)`);
  lines.push(`Failed:         ${failCount} (${((failCount / results.length) * 100).toFixed(1)} %)`);
  lines.push("");
  lines.push("Failure reasons:");
  for (const [reason, count] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${count.toString().padStart(4)}  ${reason}`);
  }
  lines.push("");
  lines.push("Sample failures by reason:");
  for (const reason of Object.keys(reasonCounts)) {
    const examples = results.filter((r) => r.reason === reason).slice(0, 5);
    lines.push(`  ${reason}:`);
    for (const e of examples) {
      lines.push(`    ${e.ticker.padEnd(8)} score=${e.bestScore} url=${e.exhibitUrl ?? "(none)"}`);
    }
  }
  const summary = lines.join("\n");
  fs.writeFileSync(SUMMARY_FILE, summary);
  console.log("\n" + summary);
  console.log(`\nFull results: ${RESULT_FILE}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
