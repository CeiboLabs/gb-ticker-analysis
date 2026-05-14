import { secFetch } from '../../lib/fetchEdgarSegments';
async function main() {
  const url = 'https://www.sec.gov/Archives/edgar/data/1099590/000109959026000014/meli-20260507xex991.htm';
  const r = await secFetch(url);
  console.log('status:', r.status);
  console.log('ok:', r.ok);
  if (r.ok) {
    const text = await r.text();
    console.log('length:', text.length);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
