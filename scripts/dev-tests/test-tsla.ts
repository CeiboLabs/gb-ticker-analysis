import { fetchEdgar8KIncomeStatement } from '../../lib/fetchEdgar8K';

async function main() {
  const r = await fetchEdgar8KIncomeStatement('TSLA');
  if (!r) { console.log('null'); return; }
  const fmt = (v: number | null | undefined) => v == null ? 'null' : `$${(v / 1e6).toFixed(0)}M`;
  console.log('  form:        ', r.form);
  console.log('  endDate:     ', r.endDate);
  console.log('  totalRevenue:', fmt(r.totalRevenue));
  console.log('  costOfRevenue:', fmt(r.costOfRevenue));
  console.log('  grossProfit: ', fmt(r.grossProfit));
  console.log('  rd:          ', fmt(r.researchDevelopment));
  console.log('  sga:         ', fmt(r.sellingGeneralAdministrative));
  console.log('  sm:          ', fmt(r.salesMarketing));
  console.log('  ga:          ', fmt(r.generalAdmin));
  console.log('  opex:        ', fmt(r.totalOperatingExpenses));
  console.log('  opIncome:    ', fmt(r.operatingIncome));
  console.log('  tax:         ', fmt(r.incomeTaxExpense));
  console.log('  netIncome:   ', fmt(r.netIncome));
  console.log('  segments:    ', r.segments?.length ?? 0);
}
main().catch(e => { console.error(e); process.exit(1); });
