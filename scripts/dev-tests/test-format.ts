import { secFetch } from '../../lib/fetchEdgarSegments';

const URLS: Record<string, string> = {
  META: 'https://www.sec.gov/Archives/edgar/data/1326801/000162828026028364/meta-03312026xexhibit991.htm',
  TSLA: 'https://www.sec.gov/Archives/edgar/data/1318605/000162828026026551/exhibit991.htm',
  JPM:  'https://www.sec.gov/Archives/edgar/data/19617/000162828026024990/a1q26erfexhibit991narrative.htm',
  BAC:  'https://www.sec.gov/Archives/edgar/data/70858/000007085826000222/bac03312026ex991.htm',
  TD:   'https://www.sec.gov/Archives/edgar/data/947263/000119312526173703/d67848d6k.htm',
  SHOP: 'https://www.sec.gov/Archives/edgar/data/1594805/000159480526000018/exhibit991pressreleaseq120.htm',
  AAL:  'https://www.sec.gov/Archives/edgar/data/4515/000000620126000031/a8kerexhibit991q1-26.htm',
  XOM:  'https://www.sec.gov/Archives/edgar/data/34088/000003408826000065/livef8k1q26991.htm',
  NEM:  'https://www.sec.gov/Archives/edgar/data/1164727/000116472726000017/newmontq12026earningsrelea.htm',
};

async function main() {
  for (const [t, url] of Object.entries(URLS)) {
    const r = await secFetch(url);
    if (!r.ok) { console.log(`${t}: fetch failed ${r.status}`); continue; }
    const html = await r.text();
    const tables = (html.match(/<table\b/gi) ?? []).length;
    const hidden = (html.match(/<(?:font|span|div)\b[^>]*color\s*:\s*(?:white|#fff)/gi) ?? []).length;
    const isFonts = (html.match(/<font\b/gi) ?? []).length;
    const sizeKB = Math.round(html.length / 1024);
    console.log(`${t.padEnd(6)} | ${sizeKB}KB | tables=${tables} | hidden-color:white=${hidden} | <font>=${isFonts}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
