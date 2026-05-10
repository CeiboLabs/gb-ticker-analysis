import { fetchEdgar8KIncomeStatement } from '../../lib/fetchEdgar8K';

// Mix: US large-cap (10-K/10-Q + 8-K), LATAM fintech (likely Workiva-PDF),
// Chinese ADRs (6-K), foreign (20-F + 6-K), specialty sectors.
const TICKERS = [
  // US large-cap tech / consumer
  'AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN', 'NVDA', 'TSLA', 'NFLX',
  // US financial / industrial
  'JPM', 'BAC', 'V', 'MA', 'WMT', 'COST', 'HD', 'KO',
  // LATAM (Workiva-PDF candidates)
  'MELI', 'NU', 'STNE', 'PAGS', 'DLO', 'GLOB', 'VIST',
  // Chinese ADRs
  'BABA', 'JD', 'PDD', 'NIO', 'BIDU', 'TME',
  // Other foreign (FPI)
  'ASML', 'TSM', 'TM', 'NOK', 'RY', 'TD', 'SHOP',
  // Specialty
  'AAL', 'DAL', 'CVX', 'XOM', 'CCJ', 'NEM', 'O',
];

async function main() {
  const results: { ticker: string; status: string; detail: string }[] = [];
  for (const t of TICKERS) {
    try {
      const r = await fetchEdgar8KIncomeStatement(t);
      const fmt = (v: number | null | undefined) => v == null ? '·' : `$${(v / 1e6).toFixed(0)}M`;
      if (!r) {
        results.push({ ticker: t, status: 'NULL', detail: 'parser returned null' });
      } else {
        const segs = r.segments?.length ?? 0;
        const fields = [
          r.totalRevenue > 0 ? 'rev' : null,
          r.costOfRevenue ? 'cogs' : null,
          r.grossProfit ? 'gp' : null,
          r.researchDevelopment ? 'rd' : null,
          (r.salesMarketing || r.sellingGeneralAdministrative) ? 'sm' : null,
          r.generalAdmin ? 'ga' : null,
          r.totalOperatingExpenses ? 'opex' : null,
          r.operatingIncome ? 'op' : null,
          r.netIncome > 0 ? 'ni' : null,
          segs >= 2 ? `segs(${segs})` : null,
        ].filter(Boolean).join(',');
        results.push({
          ticker: t,
          status: 'OK',
          detail: `${r.form} ${r.endDate} rev=${fmt(r.totalRevenue)} fields=[${fields}]`,
        });
      }
    } catch (e) {
      results.push({ ticker: t, status: 'ERROR', detail: e instanceof Error ? e.message : String(e) });
    }
  }
  // Print sorted: ERRORs first, then NULLs, then OK
  const order = { ERROR: 0, NULL: 1, OK: 2 } as const;
  results.sort((a, b) => order[a.status as keyof typeof order] - order[b.status as keyof typeof order]);
  for (const r of results) {
    console.log(`${r.ticker.padEnd(7)} | ${r.status.padEnd(5)} | ${r.detail}`);
  }
  // Summary
  const counts = results.reduce<Record<string, number>>((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {});
  console.log(`\nSummary: ${counts.OK ?? 0} OK, ${counts.NULL ?? 0} NULL, ${counts.ERROR ?? 0} ERROR (total ${results.length})`);
}

main().catch(e => { console.error(e); process.exit(1); });
