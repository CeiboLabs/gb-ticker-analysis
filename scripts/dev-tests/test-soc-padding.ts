// Dry-run of the effectiveRevenue padding logic from PriceChart.tsx
// to verify SOC's 1-quarter dataset gets expanded with $0 fillers.

const quarterlyRevenue = [{ time: "2026-03-31", value: 1270000 }];

const sorted = [...quarterlyRevenue].sort((a, b) => a.time.localeCompare(b.time));
const gaps: number[] = [];
for (let i = 1; i < sorted.length; i++) {
  gaps.push((Date.parse(sorted[i].time) - Date.parse(sorted[i - 1].time)) / 86_400_000);
}
gaps.sort((a, b) => a - b);
const cadenceDays = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : 91;

const earliestMs = Date.parse(sorted[0].time);
const latestMs = Date.parse(sorted[sorted.length - 1].time);
const minMs = latestMs - 3 * 365 * 86_400_000;
const existingTimes = new Set(sorted.map((q) => q.time));
const fillers: typeof sorted = [];
const stepMs = cadenceDays * 86_400_000;
for (let t = earliestMs - stepMs; t >= minMs; t -= stepMs) {
  const date = new Date(t).toISOString().slice(0, 10);
  if (!existingTimes.has(date)) {
    fillers.push({ time: date, value: 0 });
  }
}

const expanded = [...sorted, ...fillers].sort((a, b) => a.time.localeCompare(b.time));
console.log(`SOC: input=${quarterlyRevenue.length}, output=${expanded.length}`);
expanded.forEach((q) => console.log(`  ${q.time}: $${q.value}`));

// Test multi-quarter (regression check — expansion shouldn't add for already-full series)
const axpQrs = [
  "2023-06-30","2023-09-30","2023-12-31","2024-03-31","2024-06-30","2024-09-30",
  "2024-12-31","2025-03-31","2025-06-30","2025-09-30","2025-12-31","2026-03-31",
].map((t) => ({ time: t, value: 18e9 }));

const sorted2 = [...axpQrs].sort((a, b) => a.time.localeCompare(b.time));
const gaps2: number[] = [];
for (let i = 1; i < sorted2.length; i++) {
  gaps2.push((Date.parse(sorted2[i].time) - Date.parse(sorted2[i - 1].time)) / 86_400_000);
}
gaps2.sort((a, b) => a - b);
const cadence2 = gaps2.length > 0 ? gaps2[Math.floor(gaps2.length / 2)] : 91;
const earliest2 = Date.parse(sorted2[0].time);
const latest2 = Date.parse(sorted2[sorted2.length - 1].time);
const min2 = latest2 - 3 * 365 * 86_400_000;
const existing2 = new Set(sorted2.map((q) => q.time));
const fillers2: typeof sorted2 = [];
const step2 = cadence2 * 86_400_000;
for (let t = earliest2 - step2; t >= min2; t -= step2) {
  const date = new Date(t).toISOString().slice(0, 10);
  if (!existing2.has(date)) fillers2.push({ time: date, value: 0 });
}
console.log(`AXP: input=${axpQrs.length}, fillers=${fillers2.length} (cadence=${cadence2}d)`);
