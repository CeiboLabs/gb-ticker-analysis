"use client";

import { useRef, useEffect, useState } from "react";
import { PriceChart } from "@/components/PriceChart";

/* ─── real AAPL snapshot: 2026-04-01 (Yahoo Finance + SEC EDGAR) ─── */
const DATA = {
  ticker: "AAPL",
  companyName: "Apple Inc.",
  domain: "apple.com",
  sector: "Technology",
  industry: "Consumer Electronics",
  currentPrice: 255.63,
  priceChangePercent: 0.73,
  marketCap: 3757230784512,
  forwardPE: 27.44,
  totalRevenue: 435617005568,
  profitMargins: 0.2704,
  freeCashflow: 106312753152,
  revenueGrowth: 0.157,
  targetMeanPrice: 295.07,
  analystStrongBuy: 6,
  analystBuy: 25,
  analystHold: 15,
  analystSell: 1,
  analystStrongSell: 1,
  historicalPrices: [
    {time:"2023-04-03",value:162.31},{time:"2023-04-10",value:162.85},{time:"2023-04-17",value:162.66},
    {time:"2023-04-24",value:167.26},{time:"2023-05-01",value:171.09},{time:"2023-05-08",value:170.11},
    {time:"2023-05-15",value:172.90},{time:"2023-05-22",value:173.16},{time:"2023-05-29",value:178.61},
    {time:"2023-06-05",value:178.62},{time:"2023-06-12",value:182.53},{time:"2023-06-19",value:184.27},
    {time:"2023-06-26",value:191.46},{time:"2023-07-03",value:188.22},{time:"2023-07-10",value:188.23},
    {time:"2023-07-17",value:189.46},{time:"2023-07-24",value:193.30},{time:"2023-07-31",value:179.64},
    {time:"2023-08-07",value:175.49},{time:"2023-08-14",value:172.47},{time:"2023-08-21",value:176.54},
    {time:"2023-08-28",value:187.27},{time:"2023-09-04",value:176.12},{time:"2023-09-11",value:172.98},
    {time:"2023-09-18",value:172.77},{time:"2023-09-25",value:169.23},{time:"2023-10-02",value:175.43},
    {time:"2023-10-09",value:176.78},{time:"2023-10-16",value:170.88},{time:"2023-10-23",value:166.27},
    {time:"2023-10-30",value:174.60},{time:"2023-11-06",value:184.24},{time:"2023-11-13",value:187.74},
    {time:"2023-11-20",value:188.02},{time:"2023-11-27",value:189.27},{time:"2023-12-04",value:193.70},
    {time:"2023-12-11",value:195.54},{time:"2023-12-18",value:191.61},{time:"2023-12-25",value:190.55},
    {time:"2024-01-01",value:179.32},{time:"2024-01-08",value:184.01},{time:"2024-01-15",value:189.59},
    {time:"2024-01-22",value:190.44},{time:"2024-01-29",value:183.94},{time:"2024-02-05",value:186.91},
    {time:"2024-02-12",value:180.67},{time:"2024-02-19",value:180.87},{time:"2024-02-26",value:178.04},
    {time:"2024-03-04",value:169.19},{time:"2024-03-11",value:171.06},{time:"2024-03-18",value:170.73},
    {time:"2024-03-25",value:169.93},{time:"2024-04-01",value:168.05},{time:"2024-04-08",value:174.96},
    {time:"2024-04-15",value:163.51},{time:"2024-04-22",value:167.77},{time:"2024-04-29",value:181.73},
    {time:"2024-05-06",value:181.40},{time:"2024-05-13",value:188.41},{time:"2024-05-20",value:188.52},
    {time:"2024-05-27",value:190.77},{time:"2024-06-03",value:195.38},{time:"2024-06-10",value:210.86},
    {time:"2024-06-17",value:205.90},{time:"2024-06-24",value:209.00},{time:"2024-07-01",value:224.60},
    {time:"2024-07-08",value:228.77},{time:"2024-07-15",value:222.59},{time:"2024-07-22",value:216.29},
    {time:"2024-07-29",value:218.17},{time:"2024-08-05",value:214.58},{time:"2024-08-12",value:224.32},
    {time:"2024-08-19",value:225.36},{time:"2024-08-26",value:227.51},{time:"2024-09-02",value:219.38},
    {time:"2024-09-09",value:221.05},{time:"2024-09-16",value:226.71},{time:"2024-09-23",value:226.30},
    {time:"2024-09-30",value:225.32},{time:"2024-10-07",value:226.06},{time:"2024-10-14",value:233.47},
    {time:"2024-10-21",value:229.90},{time:"2024-10-28",value:221.46},{time:"2024-11-04",value:225.48},
    {time:"2024-11-11",value:223.78},{time:"2024-11-18",value:228.62},{time:"2024-11-25",value:236.04},
    {time:"2024-12-02",value:241.52},{time:"2024-12-09",value:246.78},{time:"2024-12-16",value:253.11},
    {time:"2024-12-23",value:254.20},{time:"2024-12-30",value:242.04},{time:"2025-01-06",value:235.56},
    {time:"2025-01-13",value:228.73},{time:"2025-01-20",value:221.57},{time:"2025-01-27",value:234.72},
    {time:"2025-02-03",value:226.39},{time:"2025-02-10",value:243.27},{time:"2025-02-17",value:244.48},
    {time:"2025-02-24",value:240.79},{time:"2025-03-03",value:238.03},{time:"2025-03-10",value:212.56},
    {time:"2025-03-17",value:217.32},{time:"2025-03-24",value:216.95},{time:"2025-03-31",value:187.56},
    {time:"2025-04-07",value:197.29},{time:"2025-04-14",value:196.13},{time:"2025-04-21",value:208.37},
    {time:"2025-04-28",value:204.46},{time:"2025-05-05",value:197.67},{time:"2025-05-12",value:210.34},
    {time:"2025-05-19",value:194.68},{time:"2025-05-26",value:200.24},{time:"2025-06-02",value:203.30},
    {time:"2025-06-09",value:195.85},{time:"2025-06-16",value:200.39},{time:"2025-06-23",value:200.47},
    {time:"2025-06-30",value:212.90},{time:"2025-07-07",value:210.52},{time:"2025-07-14",value:210.54},
    {time:"2025-07-21",value:213.23},{time:"2025-07-28",value:201.77},{time:"2025-08-04",value:228.65},
    {time:"2025-08-11",value:230.89},{time:"2025-08-18",value:227.33},{time:"2025-08-25",value:231.70},
    {time:"2025-09-01",value:239.23},{time:"2025-09-08",value:233.62},{time:"2025-09-15",value:245.03},
    {time:"2025-09-22",value:254.97},{time:"2025-09-29",value:257.53},{time:"2025-10-06",value:244.80},
    {time:"2025-10-13",value:251.81},{time:"2025-10-20",value:262.32},{time:"2025-10-27",value:269.86},
    {time:"2025-11-03",value:267.96},{time:"2025-11-10",value:271.89},{time:"2025-11-17",value:271.24},
    {time:"2025-11-24",value:278.59},{time:"2025-12-01",value:278.52},{time:"2025-12-08",value:278.02},
    {time:"2025-12-15",value:273.41},{time:"2025-12-22",value:273.14},{time:"2025-12-29",value:270.76},
    {time:"2026-01-05",value:259.13},{time:"2026-01-12",value:255.29},{time:"2026-01-19",value:247.81},
    {time:"2026-01-26",value:259.24},{time:"2026-02-02",value:277.86},{time:"2026-02-09",value:255.54},
    {time:"2026-02-16",value:264.58},{time:"2026-02-23",value:264.18},{time:"2026-03-02",value:257.46},
    {time:"2026-03-09",value:250.12},{time:"2026-03-16",value:247.99},{time:"2026-03-23",value:248.80},
    {time:"2026-03-30",value:255.63},{time:"2026-04-01",value:255.63},
  ],
  quarterlyRevenue: [
    {time:"2023-07-01",value:81797000000},{time:"2023-09-30",value:89498000000},
    {time:"2023-12-30",value:119575000000},{time:"2024-03-30",value:90753000000},
    {time:"2024-06-29",value:85777000000},{time:"2024-09-28",value:94930000000},
    {time:"2024-12-28",value:124300000000},{time:"2025-03-29",value:95359000000},
    {time:"2025-06-28",value:94036000000},{time:"2025-09-27",value:102466000000},
    {time:"2025-12-27",value:143756000000},
  ],
};

/* ─── static mock data (AI-generated content) ─── */
const MOCK_VERDICT =
  "Recomendamos BUY con convicción alta, fundamentado en un crecimiento sostenible de ingresos del **14% YoY**, márgenes líderes y un ecosistema altamente defensivo. El próximo reporte de resultados **(30/04/2026)** será clave para corroborar el momentum positivo. La tesis está orientada a 12-18 meses, respaldada por catalizadores operativos claros como **AI y nuevas gamas de productos**. Apple sigue siendo una apuesta diferenciada en el sector Technology con balance sólido y perspectivas robustas.";
const MOCK_ANALYSIS =
  "Según los datos financieros de SEC EDGAR para Q4 FY2025, Apple generó **143.76B USD** en ingresos totales (+16% YoY). Los segmentos clave son: iPhone (**85.27B USD**; 59.3% del total, +23% YoY), impulsado por la adopción de modelos de gama alta y la expansión en mercados emergentes; Servicios (**30.01B USD**; 20.9%, +14% YoY), sostenidos por crecimientos sólidos en la App Store y Apple Music; y Wearables, Home y Accesorios (11.49B USD; 8%, -2% YoY).";

/* ─── helpers ─── */
function fmtCompact(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString("en-US")}`;
}

const METRICS = [
  { label: "Cap. Bursátil", value: fmtCompact(DATA.marketCap) },
  { label: "P/E Forward", value: `${DATA.forwardPE.toFixed(1)}x` },
  { label: "Ingresos (TTM)", value: fmtCompact(DATA.totalRevenue) },
  { label: "Margen Neto", value: `${(DATA.profitMargins * 100).toFixed(1)}%` },
  { label: "Flujo Caja Libre", value: fmtCompact(DATA.freeCashflow) },
  { label: "Crec. Ingresos", value: `+${(DATA.revenueGrowth * 100).toFixed(1)}%` },
];

const TOTAL_ANALYSTS = DATA.analystStrongBuy + DATA.analystBuy + DATA.analystHold + DATA.analystSell + DATA.analystStrongSell;
const pct = (v: number) => Math.round((v / TOTAL_ANALYSTS) * 100);
const CONSENSUS = [
  { label: "Strong Buy", pct: pct(DATA.analystStrongBuy), color: "bg-emerald-500" },
  { label: "Buy", pct: pct(DATA.analystBuy), color: "bg-emerald-400" },
  { label: "Hold", pct: pct(DATA.analystHold), color: "bg-yellow-400" },
  { label: "Sell", pct: pct(DATA.analystSell), color: "bg-red-400" },
  { label: "Strong Sell", pct: pct(DATA.analystStrongSell), color: "bg-red-600" },
];

const UPSIDE = ((DATA.targetMeanPrice / DATA.currentPrice - 1) * 100).toFixed(1);

/* ─── animated counter hook ─── */
function useCounter(end: number, duration: number, trigger: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    const startTime = performance.now();
    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(end * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [end, duration, trigger]);
  return value;
}

/* ─── typewriter hook ─── */
function useTypewriter(text: string, speed: number, trigger: boolean) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    if (!trigger) { setDisplayed(""); return; }
    let i = 0;
    setDisplayed("");
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, trigger]);
  return displayed;
}

/* ─── bold markdown renderer (minimal) ─── */
function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-[#03065E] font-semibold">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

/* ─── main component ─── */
export function ReportDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState(0); // 0=hidden, 1=header, 2=metrics, 3=chart, 4=consensus, 5=verdict, 6=text

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase(1);
          setTimeout(() => setPhase(2), 400);
          setTimeout(() => setPhase(3), 900);
          setTimeout(() => setPhase(4), 1400);
          setTimeout(() => setPhase(5), 1900);
          setTimeout(() => setPhase(6), 2400);
          observer.unobserve(el);
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const price = useCounter(DATA.currentPrice, 1200, phase >= 1);
  const change = useCounter(DATA.priceChangePercent, 1200, phase >= 1);
  const analysisTyped = useTypewriter(MOCK_ANALYSIS, 12, phase >= 6);

  return (
    <section className="bg-[#F8F9FF] py-20 sm:py-28 px-6 overflow-hidden">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-[#03065E]/40 text-center mb-3">
          Preview
        </h2>
        <p className="text-2xl sm:text-3xl font-bold text-[#03065E] text-center mb-4">
          Así Se Ve un Reporte
        </p>
        <p className="text-sm text-[#03065E]/50 text-center mb-14 max-w-md mx-auto">
          Cada análisis se genera en tiempo real con datos financieros actualizados.
        </p>

        {/* Report card */}
        <div
          ref={ref}
          className="bg-white border border-[#03065E]/10 rounded-2xl shadow-lg overflow-hidden"
        >
          {/* ── Header ── */}
          <div
            className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-[#03065E]/6"
            style={{
              opacity: phase >= 1 ? 1 : 0,
              transform: phase >= 1 ? "translateY(0)" : "translateY(12px)",
              transition: "all 0.6s ease-out",
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/demo-aapl.png"
                alt={DATA.companyName}
                className="w-12 h-12 rounded-xl object-contain bg-white p-1 shadow-sm border border-[#03065E]/10 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-[#03065E] truncate sm:text-2xl">
                    {DATA.companyName}
                  </span>
                  <span className="text-sm font-mono text-white bg-[#03065E] px-2 py-0.5 rounded shrink-0">
                    {DATA.ticker}
                  </span>
                </div>
                <p className="text-sm text-[#707070] mt-0.5">{DATA.sector} · {DATA.industry}</p>
              </div>
              <div className="text-left shrink-0 sm:text-right sm:ml-auto">
                <div className="text-2xl font-mono font-bold text-[#03065E]">
                  ${price.toFixed(2)}
                </div>
                <div className="text-sm font-mono font-medium text-emerald-600 mt-0.5">
                  +{change.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

          {/* ── Metrics grid ── */}
          <div
            className="px-5 sm:px-6 py-4 border-b border-[#03065E]/6"
            style={{
              opacity: phase >= 2 ? 1 : 0,
              transform: phase >= 2 ? "translateY(0)" : "translateY(12px)",
              transition: "all 0.6s ease-out",
            }}
          >
            <div className="text-xs font-semibold uppercase tracking-widest text-[#03065E]/50 mb-3">
              Métricas Clave
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {METRICS.map((m, i) => (
                <div
                  key={m.label}
                  className="bg-[#F8F9FF] border border-[#03065E]/6 rounded-xl p-3"
                  style={{
                    opacity: phase >= 2 ? 1 : 0,
                    transform: phase >= 2 ? "translateY(0)" : "translateY(8px)",
                    transition: `all 0.4s ease-out ${i * 80}ms`,
                  }}
                >
                  <div className="text-xs text-[#707070] uppercase tracking-wide mb-1">{m.label}</div>
                  <div className="font-mono font-semibold text-[#03065E] text-sm">{m.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Price chart (real) ── */}
          <div
            className="px-5 sm:px-6 py-4 border-b border-[#03065E]/6"
            style={{
              opacity: phase >= 3 ? 1 : 0,
              transition: "opacity 0.6s ease-out",
            }}
          >
            <PriceChart
              historicalPrices={DATA.historicalPrices}
              ticker={DATA.ticker}
              quarterlyRevenue={DATA.quarterlyRevenue}
            />
          </div>

          {/* ── Analyst consensus ── */}
          <div
            className="px-5 sm:px-6 py-4 border-b border-[#03065E]/6"
            style={{
              opacity: phase >= 4 ? 1 : 0,
              transform: phase >= 4 ? "translateY(0)" : "translateY(12px)",
              transition: "all 0.6s ease-out",
            }}
          >
            <div className="text-xs font-semibold uppercase tracking-widest text-[#03065E]/50 mb-4">
              Consenso de Analistas
            </div>
            <div className="flex gap-4 sm:gap-6 flex-wrap">
              <div className="flex-1 min-w-[120px]">
                <div className="text-xs text-[#707070] mb-1">Precio Objetivo</div>
                <div className="font-mono font-bold text-[#03065E] text-xl">${DATA.targetMeanPrice}</div>
                <div className="text-sm font-mono font-medium text-emerald-600 mt-0.5">
                  +{UPSIDE}% upside
                </div>
              </div>
              <div className="flex-[2] min-w-[160px] sm:min-w-[200px]">
                <div className="flex h-3 rounded-full overflow-hidden gap-px mb-3">
                  {CONSENSUS.map((c) => (
                    <div
                      key={c.label}
                      className={`${c.color}`}
                      style={{
                        width: phase >= 4 ? `${c.pct}%` : "0%",
                        transition: "width 1s ease-out 0.2s",
                      }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {CONSENSUS.map((c) => (
                    <span key={c.label} className="flex items-center gap-1 text-xs text-[#707070]">
                      <span className={`w-2 h-2 rounded-sm ${c.color}`} />
                      {c.label} ({c.pct})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Investment Verdict ── */}
          <div
            className="px-5 sm:px-6 py-4 border-b border-[#03065E]/6"
            style={{
              opacity: phase >= 5 ? 1 : 0,
              transform: phase >= 5 ? "scale(0.97)" : "scale(0.95)",
              transition: "all 0.6s ease-out",
            }}
          >
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-3 py-1 rounded-full text-sm font-bold tracking-wide bg-emerald-600 text-white">
                  COMPRAR
                </span>
                <span className="text-xs font-semibold uppercase tracking-widest text-emerald-800/60">
                  Convicción: ALTA
                </span>
              </div>
              <p className="text-sm leading-relaxed text-emerald-800/80">
                {renderBold(MOCK_VERDICT)}
              </p>
            </div>
          </div>

          {/* ── Analysis text (typewriter) ── */}
          <div
            className="px-5 sm:px-6 py-5"
            style={{
              opacity: phase >= 6 ? 1 : 0,
              transition: "opacity 0.5s ease-out",
            }}
          >
            <div className="text-xs font-semibold uppercase tracking-widest text-[#03065E]/50 mb-3">
              Fuentes de Ingresos
            </div>
            <p className="text-sm leading-relaxed text-[#2A2A2A]">
              {renderBold(analysisTyped)}
              {phase >= 6 && analysisTyped.length < MOCK_ANALYSIS.length && (
                <span className="inline-block w-0.5 h-4 bg-[#03065E] ml-0.5 animate-pulse align-text-bottom" />
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
