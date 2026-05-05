// Smoke-test the Sankey parser against a fixed ticker matrix.
// Validates that:
//   - The /api/analyze endpoint returns segmentData
//   - opexBreakdown sums match operatingExpenses (within tolerance)
//   - Airline tickers are detected as airline-mode
//   - Non-airline tickers are NOT in airline-mode
//   - Segments sum to revenue (within tolerance)
//
// Run: `node scripts/smoke-sankey.mjs`
// Requires the dev server running at PORT (default 3000).
// Note: the analyze endpoint applies a per-IP rate limit (10 req/hour by
// default — see lib/rateLimiter.ts). For local smoke testing, restart the
// dev server with `RATE_LIMIT_MAX=100 npm run dev` to allow the full matrix.

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ENDPOINT = `http://localhost:${PORT}/api/analyze`;

// Tolerance: 5% of opex OR 0.05 (in scaled units), whichever is larger.
const tolerance = (opex) => Math.max(0.05, opex * 0.05);

const MATRIX = [
  // Airlines — should match airline mode and have full breakdown
  { ticker: "AAL", expectedAirline: true,  expectedSource: "10-Q", expectedProfile: "airline" },
  { ticker: "DAL", expectedAirline: true,  expectedSource: "10-Q", expectedProfile: "airline" },
  { ticker: "UAL", expectedAirline: true,  expectedSource: "10-Q", expectedProfile: "airline" },
  { ticker: "LUV", expectedAirline: true,  expectedSource: "10-Q", expectedProfile: "airline" },
  { ticker: "ULCC", expectedAirline: true, expectedSource: "10-K", expectedProfile: "airline" },
  { ticker: "ALK", expectedAirline: true,  expectedSource: "10-K", expectedProfile: "airline" },
  { ticker: "LTM", expectedAirline: true,  expectedSource: "6-K"  },  // 8-K path; profile not detected
  // Standard tech / consumer
  { ticker: "AAPL", expectedAirline: false, expectedSource: "10-Q", expectedProfile: "standard" },
  { ticker: "MSFT", expectedAirline: false, expectedSource: "10-Q", expectedProfile: "standard" },
  // Banks — Interest Income + Provision for Loan Losses
  { ticker: "JPM",  expectedAirline: false, expectedProfile: "bank" },
  { ticker: "BAC",  expectedAirline: false, expectedProfile: "bank" },
  { ticker: "WFC",  expectedAirline: false, expectedProfile: "bank" },
  // Insurance
  { ticker: "PGR",  expectedAirline: false, expectedProfile: "insurance" },
  { ticker: "MET",  expectedAirline: false, expectedProfile: "insurance" },
  // REITs
  { ticker: "AMT",  expectedAirline: false, expectedProfile: "reit" },
  { ticker: "PLD",  expectedAirline: false, expectedProfile: "reit" },
  { ticker: "O",    expectedAirline: false, expectedProfile: "reit" },
  // Asset managers
  { ticker: "BLK",  expectedAirline: false, expectedProfile: "asset-manager" },
  // Biotech
  { ticker: "MRNA", expectedAirline: false, expectedProfile: "biotech" },
  // Oil/gas
  { ticker: "CVX",  expectedAirline: false, expectedProfile: "oil-gas" },
  { ticker: "XOM",  expectedAirline: false, expectedProfile: "oil-gas" },
  // Services (V, MA, ADP)
  { ticker: "V",    expectedAirline: false, expectedProfile: "services" },
  { ticker: "MA",   expectedAirline: false, expectedProfile: "services" },
];

const AIRLINE_KEYS = ["fuel", "salariesWages", "maintenance", "rentAndLanding", "depreciation"];

async function fetchTicker(ticker) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, refresh: true }),
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function main() {
  console.log(`Smoke-testing ${MATRIX.length} tickers against ${ENDPOINT}\n`);

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const { ticker, expectedAirline, expectedSource, expectedProfile } of MATRIX) {
    process.stdout.write(`${ticker.padEnd(6)} `);
    let result;
    try {
      result = await fetchTicker(ticker);
    } catch (err) {
      console.log(`FETCH FAILED: ${err.message}`);
      failed++;
      failures.push({ ticker, reason: `fetch failed: ${err.message}` });
      continue;
    }
    const { status, json } = result;
    if (status !== 200) {
      console.log(`HTTP ${status}: ${json.error ?? "no error message"}`);
      failed++;
      failures.push({ ticker, reason: `HTTP ${status}` });
      continue;
    }
    const sd = json.report?.segmentData;
    if (!sd) {
      console.log("no segmentData");
      failed++;
      failures.push({ ticker, reason: "no segmentData" });
      continue;
    }

    const ob = sd.opexBreakdown ?? {};
    const obSum = Object.values(ob).reduce(
      (s, v) => s + (typeof v === "number" ? v : 0),
      0,
    );
    const segSum = (sd.segments ?? []).reduce((s, x) => s + (x.value ?? 0), 0);
    const isAirlineDetected = AIRLINE_KEYS.some((k) => (ob[k] ?? 0) > 0);

    const errors = [];
    if (expectedAirline !== isAirlineDetected) {
      errors.push(`airline mode mismatch: expected ${expectedAirline}, got ${isAirlineDetected}`);
    }
    if (expectedSource && sd.source !== expectedSource) {
      errors.push(`source mismatch: expected ${expectedSource}, got ${sd.source}`);
    }
    if (expectedProfile && sd.industryProfile && sd.industryProfile !== expectedProfile) {
      errors.push(`profile mismatch: expected ${expectedProfile}, got ${sd.industryProfile}`);
    }
    const tol = tolerance(sd.operatingExpenses ?? 0);
    if (obSum > 0 && Math.abs(obSum - sd.operatingExpenses) > tol) {
      errors.push(`breakdown sum ${obSum.toFixed(2)} vs opex ${sd.operatingExpenses} (tol ${tol.toFixed(2)})`);
    }
    if (sd.segments?.length > 0) {
      const segTol = tolerance(sd.totalRevenue ?? 0);
      if (Math.abs(segSum - sd.totalRevenue) > segTol) {
        errors.push(`segments sum ${segSum.toFixed(2)} vs rev ${sd.totalRevenue} (tol ${segTol.toFixed(2)})`);
      }
    }

    if (errors.length === 0) {
      const summary = `src=${sd.source}, period=${sd.period}, rev=${sd.totalRevenue}${sd.unit}, opex=${sd.operatingExpenses}, airline=${isAirlineDetected}`;
      console.log(`✓ ${summary}`);
      passed++;
    } else {
      console.log(`✗ ${errors.join("; ")}`);
      failed++;
      failures.push({ ticker, reason: errors.join("; ") });
    }
  }

  console.log(`\n--- ${passed}/${MATRIX.length} passed ---`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  ${f.ticker}: ${f.reason}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
