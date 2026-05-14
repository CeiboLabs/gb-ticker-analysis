import { fetchEdgar8KIncomeStatement } from '../../lib/fetchEdgar8K';
async function main() {
  const r = await fetchEdgar8KIncomeStatement('BAC');
  if (!r) { console.log('null'); return; }
  const fmt = (v: number | null | undefined) => v == null ? 'null' : `$${(v / 1e6).toFixed(0)}M`;
  console.log('  form:                ', r.form);
  console.log('  endDate:             ', r.endDate);
  console.log('  totalRevenue:        ', fmt(r.totalRevenue));
  console.log('  costOfRevenue:       ', fmt(r.costOfRevenue));
  console.log('  grossProfit:         ', fmt(r.grossProfit));
  console.log('  totalOperatingExp:   ', fmt(r.totalOperatingExpenses));
  console.log('  operatingIncome:     ', fmt(r.operatingIncome));
  console.log('  incomeBeforeTax:     ', fmt(r.incomeBeforeTax));
  console.log('  incomeTaxExpense:    ', fmt(r.incomeTaxExpense));
  console.log('  netIncome:           ', fmt(r.netIncome));
  console.log('  segments:            ', r.segments?.length ?? 0);
}
main().catch(e => { console.error(e); process.exit(1); });
