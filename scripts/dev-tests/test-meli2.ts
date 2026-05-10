import { fetchEdgar8KIncomeStatement } from '../../lib/fetchEdgar8K';
async function main() {
  const r = await fetchEdgar8KIncomeStatement('MELI');
  console.log(r ? JSON.stringify({form: r.form, endDate: r.endDate, totalRevenue: r.totalRevenue, netIncome: r.netIncome, segments: r.segments?.length ?? 0}, null, 2) : 'NULL');
}
main().catch(e => { console.error(e); process.exit(1); });
