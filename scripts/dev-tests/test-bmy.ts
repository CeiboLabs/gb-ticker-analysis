import { fetchSegmentData } from '../../lib/fetchSegmentData';
import { fetchEdgarQuarterlyRevenue } from '../../lib/fetchEdgarSegments';

async function main() {
  const threeYearsAgo = new Date(Date.now() - 3 * 365 * 86_400_000);
  for (const t of ['UGRO']) {
    const qr = await fetchEdgarQuarterlyRevenue(t, threeYearsAgo);
    console.log(`${t}: chart (${qr?.length ?? 0} qrs):`);
    qr?.forEach(q => console.log(`  ${q.time}: $${(q.value/1e6).toFixed(2)}M`));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
