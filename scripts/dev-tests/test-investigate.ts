import { resolveCIK, secFetch } from '../../lib/fetchEdgarSegments';
import { debugEdgar8K } from '../../lib/fetchEdgar8K';

const TICKERS = ['META', 'TSLA', 'JPM', 'BAC', 'TME', 'TD', 'SHOP', 'AAL', 'XOM', 'NEM'];

async function main() {
  for (const t of TICKERS) {
    console.log(`\n══════ ${t} ══════`);
    const dbg = await debugEdgar8K(t);
    console.log(`  candidates: ${dbg.candidates.length}, reason: ${dbg.reason}`);
    if (dbg.candidates[0]) {
      const f = dbg.candidates[0];
      console.log(`  filing: ${f.form} ${f.filingDate} acc=${f.accession} primary=${f.primaryDocument} size=${f.size}`);
    }
    console.log(`  attempts: ${JSON.stringify(dbg.attempts).slice(0, 200)}`);
    if (dbg.exhibitUrl) {
      console.log(`  exhibitUrl: ${dbg.exhibitUrl}`);
      console.log(`  htmlLength: ${dbg.htmlLength}, bestScore: ${dbg.bestScore}`);
    } else if (dbg.candidates[0]) {
      // Check the index page directly to see what exhibits are present.
      const cik = await resolveCIK(t);
      if (cik) {
        const cikInt = parseInt(cik, 10);
        const noDash = dbg.candidates[0].accession.replace(/-/g, '');
        const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cikInt}/${noDash}/${dbg.candidates[0].accession}-index.htm`;
        const r = await secFetch(indexUrl);
        if (r.ok) {
          const html = await r.text();
          const links = [...html.matchAll(/href="([^"]+\.html?)"/gi)].map(m => m[1]);
          console.log(`  index links (.htm/.html): ${JSON.stringify(links.slice(0, 6))}`);
        }
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
