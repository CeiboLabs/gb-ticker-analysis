import { debugEdgar8K } from '../../lib/fetchEdgar8K';

const TICKERS = ['META', 'SHOP', 'NEM', 'AAL', 'XOM'];

async function main() {
  for (const t of TICKERS) {
    console.log(`\n══════ ${t} ══════`);
    const dbg = await debugEdgar8K(t);
    console.log(`  reason: ${dbg.reason}`);
    console.log(`  exhibitUrl: ${dbg.exhibitUrl}`);
    console.log(`  htmlLength: ${dbg.htmlLength}`);
    console.log(`  bestScore: ${dbg.bestScore}`);
    console.log(`  attempts: ${JSON.stringify(dbg.attempts)}`);
    if (dbg.topRowsPreview) {
      console.log(`  top rows preview:`);
      for (const r of dbg.topRowsPreview.slice(0, 12)) {
        console.log(`    ${JSON.stringify(r)}`);
      }
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
