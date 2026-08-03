import { PriceChartInstitucional } from "@/components/analyze/PriceChartInstitucional";
export const dynamic = "force-static";
function serie() {
  const out: { time: string; value: number }[] = [];
  let v = 120; const start = Date.UTC(2023, 6, 3);
  for (let i = 0; i < 157; i++) {
    v = v * (1 + Math.sin(i / 9) * 0.012 + 0.0065);
    out.push({ time: new Date(start + i * 7 * 86400000).toISOString().slice(0, 10), value: Math.round(v * 100) / 100 });
  }
  return out;
}
export default function DevChartTmp() {
  const prices = serie();
  return (
    <main className="analyze-root site">
      <div className="site-wrap" style={{ padding: "32px 20px" }}>
        <PriceChartInstitucional ticker="AAPL" historicalPrices={prices}
          currency="USD" price={338.8} change1dPct={0.84} asOf="30 jul 2026" />
      </div>
    </main>
  );
}
