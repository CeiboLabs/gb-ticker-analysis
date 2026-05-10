import { fetchEdgar8KIncomeStatement, debugEdgar8K } from '../../lib/fetchEdgar8K';
async function main() {
  const dbg = await debugEdgar8K('MELI');
  console.log('debug reason:', dbg.reason);
  console.log('attempts:', JSON.stringify(dbg.attempts));
  console.log('candidate0:', dbg.candidates[0]?.accession, dbg.candidates[0]?.filingDate);
}
main().catch(e => { console.error(e); process.exit(1); });
