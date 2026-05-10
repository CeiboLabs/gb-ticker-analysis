import { fetchSegmentData } from '../../lib/fetchSegmentData';
import { fetchEdgarQuarterlyRevenue } from '../../lib/fetchEdgarSegments';

async function main() {
  const threeYearsAgo = new Date(Date.now() - 3 * 365 * 86_400_000);
  for (const t of ['AXP', 'JPM', 'BAC', 'BMY']) {
    const [sd, qr] = await Promise.all([
      fetchSegmentData(t),
      fetchEdgarQuarterlyRevenue(t, threeYearsAgo),
    ]);
    console.log(`${t}: sankey=${sd?.totalRevenue} (${sd?.industryProfile}); chart (${qr?.length ?? 0} qrs):`);
    qr?.forEach(q => console.log(`  ${q.time}: $${(q.value/1e9).toFixed(2)}B`));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
