import { fetchEdgarAll } from '../../lib/fetchEdgarSegments';
import { fetchSegmentData } from '../../lib/fetchSegmentData';
const r = await fetchEdgarAll('AAPL');
console.log('=== fetchEdgarAll ===');
console.log('isAnnual:', r?.isAnnual, 'isForeign:', r?.isForeign);
console.log('IS revenue:', r?.incomeStatement?.revenue, 'period:', r?.incomeStatement?.period, 'endDate:', r?.incomeStatement?.endDate);
console.log('segmentResult.segmentPeriod:', r?.segmentResult?.segmentPeriod);
console.log('segmentResult.geographyOnly:', r?.segmentResult?.geographyOnly);
console.log('segments raw:', JSON.stringify(r?.segmentResult?.segments, null, 2));

console.log('\n=== fetchSegmentData ===');
const s = await fetchSegmentData('AAPL');
console.log('totalRevenue:', s?.totalRevenue, 'unit:', s?.unit, 'profile:', s?.industryProfile);
console.log('segments:', JSON.stringify(s?.segments, null, 2));
console.log('source:', s?.source, 'period:', s?.period, 'endDate:', s?.endDate);
console.log('segmentPeriod:', s?.segmentPeriod);
console.log('geographyOnly:', s?.geographyOnly);
