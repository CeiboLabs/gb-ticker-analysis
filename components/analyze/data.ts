export type Verdict = "BUY" | "HOLD" | "AVOID";
export type Tone = "pos" | "neg" | null;
export type Conviction = "Alta" | "Media" | "Baja";

export interface TickerData {
  name: string;
  exchange: string;
  currency: string;

  price: number;
  change1d: number;
  changeYtd: number;
  marketCap: string;
  volume: string;
  dayLow: number;
  dayHigh: number;
  week52Low: number;
  week52High: number;
  avgVolume: string;

  verdict: Verdict;
  target: number;
  targetUpside: number;
  conviction: Conviction;
  convictionChange: "Mantenido" | "Subido" | "Bajado";

  sector: string;
  industry: string;

  kpis: Array<[label: string, value: string, tone: Tone]>;
  kpiSparks: Record<string, number[]>;

  peers: Array<{ t: string; pe: string; chg: number }>;

  pricePath: Array<{ y: number }>;
  spxPath: Array<{ y: number }>;

  quarters: Array<{
    q: string;
    rev: number;
    eps: number;
    consRev: number;
    consEps: number;
    beat: boolean;
  }>;

  sankey: {
    revenue: number;
    costOfRevenue: number;
    grossProfit: number;
    opex: number;
    operatingIncome: number;
    otherAndTax: number;
    netIncome: number;
  };

  segments: Array<{ name: string; share: number; color: string }>;

  analystTable: Array<{
    firm: string;
    analyst: string;
    rating: "buy" | "hold" | "sell";
    target: number;
    delta: number;
    date: string;
  }>;

  consensus: { buy: number; hold: number; sell: number; targetLow: number; targetAvg: number; targetHigh: number };

  businessSummary: string;
  driversNarrative: string;
  thesis: [string, string, string];
  incomeNarrative: string;
  consensusNarrative: string;
  conclusionNarrative: string;

  risks: Array<{ title: string; body: string; weight: "alto" | "medio" | "bajo"; horizon: string }>;
  catalysts: Array<{ title: string; body: string; weight: "alto" | "medio" | "bajo"; horizon: string }>;

  asOf: string;
  filingRef: string;
  lastUpdated: string;
}

const SEG_COLORS = ["#03065E", "#2C3194", "#6B70B8", "#9C7F2E", "#C9A84C", "#5C5F7A"];

function sparkline(seed: number, len = 12, vol = 0.08): number[] {
  const out: number[] = [];
  let v = 100;
  let s = seed;
  for (let i = 0; i < len; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = (s / 233280) - 0.5;
    v = v * (1 + r * vol);
    out.push(v);
  }
  return out;
}

function pricePath(seed: number, points = 26, drift = 0.008, vol = 0.06, start = 100): number[] {
  const out: number[] = [];
  let v = start;
  let s = seed;
  for (let i = 0; i < points; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = (s / 233280) - 0.5;
    v = v * (1 + drift + r * vol);
    out.push(v);
  }
  return out;
}

const SPX_PATH = pricePath(7711, 26, 0.012, 0.025, 100).map(y => ({ y }));

export const ANALYZE_TICKERS: Record<string, TickerData> = {
  AAPL: {
    name: "Apple Inc.",
    exchange: "NASDAQ",
    currency: "USD",
    price: 187.32,
    change1d: 1.24,
    changeYtd: 18.47,
    marketCap: "USD 2,89 T",
    volume: "52,4 M",
    dayLow: 185.40,
    dayHigh: 188.95,
    week52Low: 164.08,
    week52High: 199.62,
    avgVolume: "58,1 M",

    verdict: "BUY",
    target: 215,
    targetUpside: 14.79,
    conviction: "Alta",
    convictionChange: "Mantenido",

    sector: "Technology",
    industry: "Consumer Electronics",

    kpis: [
      ["Cap. bursátil", "2,89 T", null],
      ["P/E TTM", "29,4 ×", null],
      ["P/E Fwd", "26,8 ×", null],
      ["EV/EBITDA", "21,3 ×", null],
      ["Revenue TTM", "USD 391 B", null],
      ["Rev. growth", "+3,8 %", "pos"],
      ["Margen bruto", "46,1 %", "pos"],
      ["Margen op.", "31,5 %", "pos"],
      ["Margen neto", "26,3 %", "pos"],
      ["ROE", "147,3 %", "pos"],
      ["ROIC", "55,9 %", "pos"],
      ["FCF TTM", "USD 108 B", "pos"],
      ["Div. yield", "0,42 %", null],
      ["Debt / Eq.", "1,87 ×", null],
      ["Beta 5y", "1,25", null],
      ["EPS TTM", "USD 6,42", null],
    ],
    kpiSparks: {
      "Cap. bursátil": sparkline(101),
      "P/E TTM": sparkline(102, 5, 0.04),
      "P/E Fwd": sparkline(103, 5, 0.04),
      "EV/EBITDA": sparkline(104, 5, 0.05),
      "Revenue TTM": sparkline(105, 5, 0.03),
      "Rev. growth": sparkline(106, 5, 0.06),
      "Margen bruto": sparkline(107, 5, 0.02),
      "Margen op.": sparkline(108, 5, 0.025),
      "Margen neto": sparkline(109, 5, 0.025),
      ROE: sparkline(110, 5, 0.04),
      ROIC: sparkline(111, 5, 0.04),
      "FCF TTM": sparkline(112, 5, 0.05),
      "Div. yield": sparkline(113, 5, 0.03),
      "Debt / Eq.": sparkline(114, 5, 0.04),
      "Beta 5y": sparkline(115, 5, 0.03),
      "EPS TTM": sparkline(116, 5, 0.04),
    },

    peers: [
      { t: "MSFT", pe: "34,1 ×", chg: 0.62 },
      { t: "GOOGL", pe: "24,7 ×", chg: -0.18 },
      { t: "META", pe: "26,4 ×", chg: 1.12 },
      { t: "AMZN", pe: "47,2 ×", chg: 0.41 },
    ],

    pricePath: pricePath(201, 26, 0.012, 0.045, 100).map(y => ({ y })),
    spxPath: SPX_PATH,

    quarters: [
      { q: "Q1 24", rev: 119.6, eps: 2.18, consRev: 117.9, consEps: 2.10, beat: true },
      { q: "Q2 24", rev: 90.8, eps: 1.53, consRev: 90.4, consEps: 1.50, beat: true },
      { q: "Q3 24", rev: 85.8, eps: 1.40, consRev: 84.5, consEps: 1.35, beat: true },
      { q: "Q4 24", rev: 94.9, eps: 1.64, consRev: 94.3, consEps: 1.60, beat: true },
      { q: "Q1 25", rev: 124.3, eps: 2.40, consRev: 124.1, consEps: 2.35, beat: true },
      { q: "Q2 25", rev: 95.4, eps: 1.65, consRev: 94.8, consEps: 1.61, beat: true },
      { q: "Q3 25", rev: 94.9, eps: 1.62, consRev: 95.2, consEps: 1.60, beat: false },
      { q: "Q4 25", rev: 102.5, eps: 1.81, consRev: 100.8, consEps: 1.74, beat: true },
    ],

    sankey: {
      revenue: 391.0,
      costOfRevenue: 210.6,
      grossProfit: 180.4,
      opex: 57.1,
      operatingIncome: 123.3,
      otherAndTax: 20.4,
      netIncome: 102.9,
    },

    segments: [
      { name: "iPhone", share: 51, color: SEG_COLORS[0] },
      { name: "Services", share: 24, color: SEG_COLORS[3] },
      { name: "Wearables", share: 10, color: SEG_COLORS[1] },
      { name: "Mac", share: 8, color: SEG_COLORS[2] },
      { name: "iPad", share: 7, color: SEG_COLORS[4] },
    ],

    analystTable: [
      { firm: "Morgan Stanley", analyst: "Erik Woodring", rating: "buy", target: 235, delta: 5, date: "12 Mar 2026" },
      { firm: "Goldman Sachs", analyst: "Michael Ng", rating: "buy", target: 220, delta: 3, date: "05 Mar 2026" },
      { firm: "JPMorgan", analyst: "Samik Chatterjee", rating: "buy", target: 215, delta: 0, date: "28 Feb 2026" },
      { firm: "Bank of America", analyst: "Wamsi Mohan", rating: "buy", target: 210, delta: -2, date: "21 Feb 2026" },
      { firm: "Wells Fargo", analyst: "Aaron Rakers", rating: "hold", target: 195, delta: 0, date: "14 Feb 2026" },
      { firm: "Barclays", analyst: "Tim Long", rating: "hold", target: 184, delta: -4, date: "07 Feb 2026" },
      { firm: "Rosenblatt", analyst: "Barton Crockett", rating: "sell", target: 168, delta: -6, date: "31 Ene 2026" },
    ],

    consensus: { buy: 28, hold: 9, sell: 3, targetLow: 168, targetAvg: 205, targetHigh: 245 },

    businessSummary:
      "Apple es una integradora vertical: diseña silicio, ensambla hardware y opera una plataforma de servicios sobre 2.200 millones de dispositivos activos. El iPhone sigue siendo el ancla del negocio (51 % de revenue), pero el crecimiento secular vive en Services — App Store, iCloud, Apple Music, AppleCare, Pay — que ya representa 24 % del top-line con márgenes brutos sostenidamente por encima del 70 %. El balance es excepcional: USD 162 B en caja y equivalentes, recompras netas por USD 90 B en los últimos doce meses.",
    driversNarrative:
      "Tres palancas explican el trimestre: precio promedio del iPhone ARPU en máximo histórico, atrasos de Vision Pro Pro despachados, y Services creciendo a +14 % yoy con tres categorías nuevas en piloto. China, el punto frágil, retrocedió -3 % yoy en el guidance comentado por la mesa de Cupertino, pero compensado por India (+38 %) y Brasil (+22 %).",
    thesis: [
      "El switch a silicio propio (M-series y A-series) crea un foso técnico difícil de replicar: Apple captura el spread entre lo que cobraba a Intel/Qualcomm y lo que paga a TSMC. La integración hardware-software se traduce directo en margen.",
      "Services es el motor de crecimiento estructural. A USD 96 B anuales y 14 % yoy, ya pesa más que el negocio entero de Mac + iPad combinado, con márgenes brutos de 73 % vs. 36 % del hardware. La capitalización futura del múltiplo deberá reconocerlo.",
      "La generación de caja libre (USD 108 B TTM) financia recompras agresivas: el float se reduce ~3 % anual sin diluir el balance. A precios actuales el yield combinado (dividendos + buybacks) supera 4,5 %, premium sobre el S&P.",
    ],
    incomeNarrative:
      "Estructura limpia: 54 % de cada dólar de revenue se va en costos directos, dejando un margen bruto consolidado del 46 %. Los gastos operativos absorben otros 14,6 puntos, dejando un margen operativo del 31,5 % — extraordinario para una compañía con 391 mil millones de revenue. El bloque tax + other (USD 20,4 B) refleja la tax rate efectiva del 16,5 % bajo el régimen de TCJA, beneficiada por la repatriación irlandesa.",
    consensusNarrative:
      "El consenso de Wall Street se inclina marcadamente bullish: 28 de 40 firmas con rating Buy o equivalente, target medio en USD 205 y solo tres ratings vendedores. El sesgo positivo refleja la lectura compartida de que el ciclo del iPhone 16 está siendo subestimado por modelos que descontaron el ciclo plano post-pandemia.",
    conclusionNarrative:
      "La compañía cotiza a un múltiplo razonable para su perfil: 26,8 × P/E Fwd vs. mediana del sector 28,4 ×, con un balance impecable y una optimización de capital agresiva. La tesis bull es directa: Services siguen comiendo participación del bottom line, el silicio propio comprime costos de manera estructural, y el programa de recompras retira float a un ritmo del 3 % anual. Los riesgos están dimensionados (China, regulación) pero no descarrilan el caso. Mantenemos el BUY con target USD 215.",

    risks: [
      { title: "Regulación antitrust de App Store.", body: "Tanto la DOJ como la Comisión Europea avanzan con casos contra las comisiones del 30 %. Una reducción al 15 % impactaría ~USD 12 B en operating income.", weight: "alto", horizon: "12m" },
      { title: "Exposición a China.", body: "China representa 17 % del revenue y el grueso del ensamblaje. Tensión comercial o aranceles del 25 %+ comprometerían margen y volumen.", weight: "alto", horizon: "12m" },
      { title: "Saturación del ciclo iPhone.", body: "La tasa de upgrade se ha extendido a 4,3 años promedio. Sin una innovación disruptiva (foldable, Vision Pro mass-market), el crecimiento de unidades se aplana.", weight: "medio", horizon: "24m" },
    ],
    catalysts: [
      { title: "Apple Intelligence rollout.", body: "La integración nativa de IA generativa en iOS 19 podría acelerar el ciclo de upgrade y abrir un vector de monetización Services.", weight: "alto", horizon: "12m" },
      { title: "Vision Pro 2 y ramp-up.", body: "La generación 2 a USD 1.999 podría inaugurar un mercado de 25 M unidades en 36 meses con márgenes hardware mejorados.", weight: "medio", horizon: "24m" },
      { title: "Programa de recompras.", body: "El board renovó el programa por USD 110 B. A precios actuales, retira ~3,5 % del float anual.", weight: "medio", horizon: "12m" },
    ],

    asOf: "31 Dic 2025",
    filingRef: "10-K · CIK 0000320193",
    lastUpdated: "11 Abr 2026 · 14:32 UY",
  },

  MSFT: {
    name: "Microsoft Corp.",
    exchange: "NASDAQ",
    currency: "USD",
    price: 412.55,
    change1d: 0.38,
    changeYtd: 22.10,
    marketCap: "USD 3,07 T",
    volume: "21,8 M",
    dayLow: 409.20,
    dayHigh: 415.40,
    week52Low: 320.10,
    week52High: 430.82,
    avgVolume: "24,3 M",

    verdict: "BUY",
    target: 470,
    targetUpside: 13.93,
    conviction: "Alta",
    convictionChange: "Subido",

    sector: "Technology",
    industry: "Software · Infrastructure",

    kpis: [
      ["Cap. bursátil", "3,07 T", null],
      ["P/E TTM", "34,1 ×", null],
      ["P/E Fwd", "29,7 ×", null],
      ["EV/EBITDA", "23,8 ×", null],
      ["Revenue TTM", "USD 245 B", null],
      ["Rev. growth", "+15,3 %", "pos"],
      ["Margen bruto", "70,2 %", "pos"],
      ["Margen op.", "44,8 %", "pos"],
      ["Margen neto", "36,3 %", "pos"],
      ["ROE", "37,2 %", "pos"],
      ["ROIC", "28,7 %", "pos"],
      ["FCF TTM", "USD 71 B", "pos"],
      ["Div. yield", "0,73 %", null],
      ["Debt / Eq.", "0,32 ×", null],
      ["Beta 5y", "0,89", null],
      ["EPS TTM", "USD 12,10", null],
    ],
    kpiSparks: Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`m${i}`, sparkline(200 + i, 5, 0.03)])),

    peers: [
      { t: "AAPL", pe: "29,4 ×", chg: 1.24 },
      { t: "GOOGL", pe: "24,7 ×", chg: -0.18 },
      { t: "ORCL", pe: "22,1 ×", chg: 0.92 },
      { t: "CRM", pe: "55,8 ×", chg: -1.42 },
    ],

    pricePath: pricePath(301, 26, 0.018, 0.04, 100).map(y => ({ y })),
    spxPath: SPX_PATH,

    quarters: [
      { q: "Q1 24", rev: 56.5, eps: 2.69, consRev: 55.4, consEps: 2.65, beat: true },
      { q: "Q2 24", rev: 62.0, eps: 2.93, consRev: 61.1, consEps: 2.78, beat: true },
      { q: "Q3 24", rev: 61.9, eps: 2.94, consRev: 60.8, consEps: 2.83, beat: true },
      { q: "Q4 24", rev: 64.7, eps: 2.95, consRev: 64.4, consEps: 2.90, beat: true },
      { q: "Q1 25", rev: 65.6, eps: 3.30, consRev: 64.5, consEps: 3.10, beat: true },
      { q: "Q2 25", rev: 69.6, eps: 3.23, consRev: 68.8, consEps: 3.15, beat: true },
      { q: "Q3 25", rev: 70.1, eps: 3.46, consRev: 70.0, consEps: 3.20, beat: true },
      { q: "Q4 25", rev: 72.4, eps: 3.51, consRev: 72.8, consEps: 3.55, beat: false },
    ],

    sankey: {
      revenue: 245.0,
      costOfRevenue: 73.0,
      grossProfit: 172.0,
      opex: 62.1,
      operatingIncome: 109.9,
      otherAndTax: 21.0,
      netIncome: 88.9,
    },

    segments: [
      { name: "Intelligent Cloud", share: 44, color: SEG_COLORS[0] },
      { name: "Productivity & Business", share: 32, color: SEG_COLORS[3] },
      { name: "More Personal Computing", share: 24, color: SEG_COLORS[2] },
    ],

    analystTable: [
      { firm: "Morgan Stanley", analyst: "Keith Weiss", rating: "buy", target: 495, delta: 10, date: "15 Mar 2026" },
      { firm: "Goldman Sachs", analyst: "Kash Rangan", rating: "buy", target: 485, delta: 5, date: "08 Mar 2026" },
      { firm: "JPMorgan", analyst: "Mark Murphy", rating: "buy", target: 470, delta: 0, date: "01 Mar 2026" },
      { firm: "UBS", analyst: "Karl Keirstead", rating: "buy", target: 462, delta: 2, date: "22 Feb 2026" },
      { firm: "Bank of America", analyst: "Brad Sills", rating: "buy", target: 455, delta: 0, date: "15 Feb 2026" },
      { firm: "Wells Fargo", analyst: "Michael Turrin", rating: "hold", target: 420, delta: 0, date: "08 Feb 2026" },
      { firm: "Jefferies", analyst: "Brent Thill", rating: "hold", target: 410, delta: -10, date: "01 Feb 2026" },
    ],

    consensus: { buy: 35, hold: 6, sell: 1, targetLow: 380, targetAvg: 458, targetHigh: 510 },

    businessSummary:
      "Microsoft opera tres segmentos cuasi-independientes que se refuerzan: Azure (cómputo, IA, datos), M365 (productividad) y Windows + dispositivos. La estrategia de la última década — software como servicio + IA nativa — empujó a la compañía a triplicar revenue desde 2015 sin diluir margen. Azure crece a tasas del 30 % yoy y captura una porción del gasto en GenAI corporativo a través de OpenAI, en la que Microsoft tiene 49 % económico.",
    driversNarrative:
      "El driver del trimestre es Azure: +33 % yoy en moneda constante, con AI workloads contribuyendo 12 puntos del crecimiento. Copilot for M365 ya superó los 11 M de seats pagos, un dato no comunicado oficialmente pero deducible del incremento de ARPU en Productivity. El segmento PC se mantiene plano post-Windows 11 saturación.",
    thesis: [
      "Azure no es solo cómputo: es la plataforma donde se distribuye el output de la inversión combinada Microsoft+OpenAI en infraestructura. Cada workload de inferencia es revenue recurrente con margen incremental sobre capacidad ya capitalizada.",
      "M365 + Copilot es el upsell más eficiente del software empresarial: una adición de USD 30/seat/mes sobre una base de 400 M de seats activos. Una penetración del 10 % son USD 14 B de revenue incremental con margen bruto >80 %.",
      "El balance permite la inversión más agresiva del sector: USD 56 B en capex 2025E para data centers, financiado con caja operativa, sin diluir el balance ni el yield al accionista.",
    ],
    incomeNarrative:
      "La distribución del income statement explica por qué el mercado paga 30 × forward: 70 % de margen bruto, 45 % de margen operativo, 36 % de margen neto. El bloque opex (USD 62 B) incluye USD 28 B de R&D, una inversión sostenida que se traduce en moats reales en cloud y productividad.",
    consensusNarrative:
      "El consenso es uno de los más bullish del S&P 500: 35 ratings Buy contra solo 1 Sell. El target medio (USD 458) descuenta un upside del 11 % y refleja la lectura compartida de que el ciclo de capex tiene retorno medible en revenue de Azure.",
    conclusionNarrative:
      "Microsoft combina lo poco común: crecimiento de revenue de doble dígito, márgenes operativos superiores al 44 % y un balance que permite invertir USD 56 B en capex sin diluir. La asociación con OpenAI y la integración nativa de Copilot transforman al producto en infraestructura de IA generativa. Reiteramos BUY con target USD 470, equivalente a 33 × P/E FY26.",

    risks: [
      { title: "Capex regression to mean.", body: "La inversión de USD 56 B en data centers asume retornos por encima del WACC. Si el revenue de IA no escala al ritmo previsto, el ROIC consolidado retrocede.", weight: "medio", horizon: "24m" },
      { title: "Exposición a OpenAI.", body: "La concentración estratégica en un partner (OpenAI) genera riesgo de gobernanza y de competencia interna (Anthropic, x.AI, Mistral).", weight: "medio", horizon: "12m" },
      { title: "Antitrust en cloud.", body: "La UK CMA y la UE investigan prácticas de bundling de Teams y M365. Una desagregación forzada impactaría retención.", weight: "bajo", horizon: "24m" },
    ],
    catalysts: [
      { title: "Copilot enterprise adoption.", body: "La curva de adopción de Copilot for M365 está acelerando. Cada 100 M de seats pagos equivalen a USD 36 B de revenue anual.", weight: "alto", horizon: "12m" },
      { title: "Azure AI revenue split.", body: "La compañía aún no reporta separadamente el revenue de IA. Una desagregación en próximos earnings podría inducir re-rating.", weight: "alto", horizon: "6m" },
      { title: "Gaming + Activision sinergias.", body: "Tras un año de integración, la palanca de cross-sell Game Pass aún no se reflejó en revenue. Q4 26 podría mostrar el primer salto.", weight: "bajo", horizon: "12m" },
    ],

    asOf: "30 Jun 2025",
    filingRef: "10-K · CIK 0000789019",
    lastUpdated: "11 Abr 2026 · 14:32 UY",
  },

  NVDA: {
    name: "NVIDIA Corp.",
    exchange: "NASDAQ",
    currency: "USD",
    price: 872.18,
    change1d: -2.17,
    changeYtd: 74.03,
    marketCap: "USD 2,15 T",
    volume: "48,2 M",
    dayLow: 865.40,
    dayHigh: 891.50,
    week52Low: 480.20,
    week52High: 974.00,
    avgVolume: "44,1 M",

    verdict: "BUY",
    target: 1020,
    targetUpside: 16.95,
    conviction: "Media",
    convictionChange: "Mantenido",

    sector: "Technology",
    industry: "Semiconductors",

    kpis: [
      ["Cap. bursátil", "2,15 T", null],
      ["P/E TTM", "62,7 ×", "neg"],
      ["P/E Fwd", "34,2 ×", null],
      ["EV/EBITDA", "44,1 ×", "neg"],
      ["Revenue TTM", "USD 117 B", "pos"],
      ["Rev. growth", "+126,0 %", "pos"],
      ["Margen bruto", "75,8 %", "pos"],
      ["Margen op.", "61,2 %", "pos"],
      ["Margen neto", "53,4 %", "pos"],
      ["ROE", "115,2 %", "pos"],
      ["ROIC", "82,4 %", "pos"],
      ["FCF TTM", "USD 56 B", "pos"],
      ["Div. yield", "0,03 %", null],
      ["Debt / Eq.", "0,18 ×", null],
      ["Beta 5y", "1,71", "neg"],
      ["EPS TTM", "USD 22,90", null],
    ],
    kpiSparks: Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`m${i}`, sparkline(400 + i, 5, 0.08)])),

    peers: [
      { t: "AMD", pe: "39,4 ×", chg: -1.84 },
      { t: "AVGO", pe: "31,2 ×", chg: 0.42 },
      { t: "TSM", pe: "24,8 ×", chg: -0.71 },
      { t: "INTC", pe: "27,1 ×", chg: -2.40 },
    ],

    pricePath: pricePath(501, 26, 0.045, 0.08, 100).map(y => ({ y })),
    spxPath: SPX_PATH,

    quarters: [
      { q: "Q1 24", rev: 7.2, eps: 1.09, consRev: 6.5, consEps: 0.92, beat: true },
      { q: "Q2 24", rev: 13.5, eps: 2.70, consRev: 11.0, consEps: 2.07, beat: true },
      { q: "Q3 24", rev: 18.1, eps: 4.02, consRev: 16.2, consEps: 3.39, beat: true },
      { q: "Q4 24", rev: 22.1, eps: 5.16, consRev: 20.4, consEps: 4.59, beat: true },
      { q: "Q1 25", rev: 26.0, eps: 6.12, consRev: 24.7, consEps: 5.59, beat: true },
      { q: "Q2 25", rev: 30.0, eps: 6.84, consRev: 28.7, consEps: 6.43, beat: true },
      { q: "Q3 25", rev: 35.1, eps: 7.95, consRev: 33.1, consEps: 7.43, beat: true },
      { q: "Q4 25", rev: 39.3, eps: 8.92, consRev: 38.0, consEps: 8.45, beat: true },
    ],

    sankey: {
      revenue: 117.0,
      costOfRevenue: 28.3,
      grossProfit: 88.7,
      opex: 17.1,
      operatingIncome: 71.6,
      otherAndTax: 9.0,
      netIncome: 62.6,
    },

    segments: [
      { name: "Data Center", share: 78, color: SEG_COLORS[0] },
      { name: "Gaming", share: 11, color: SEG_COLORS[3] },
      { name: "Professional Vis.", share: 5, color: SEG_COLORS[1] },
      { name: "Automotive", share: 4, color: SEG_COLORS[2] },
      { name: "OEM & other", share: 2, color: SEG_COLORS[4] },
    ],

    analystTable: [
      { firm: "Morgan Stanley", analyst: "Joseph Moore", rating: "buy", target: 1100, delta: 20, date: "10 Mar 2026" },
      { firm: "Wells Fargo", analyst: "Aaron Rakers", rating: "buy", target: 1050, delta: 0, date: "03 Mar 2026" },
      { firm: "Goldman Sachs", analyst: "Toshiya Hari", rating: "buy", target: 1020, delta: -30, date: "24 Feb 2026" },
      { firm: "JPMorgan", analyst: "Harlan Sur", rating: "buy", target: 1000, delta: 0, date: "17 Feb 2026" },
      { firm: "Bank of America", analyst: "Vivek Arya", rating: "buy", target: 980, delta: -20, date: "10 Feb 2026" },
      { firm: "Bernstein", analyst: "Stacy Rasgon", rating: "hold", target: 850, delta: -50, date: "03 Feb 2026" },
      { firm: "DA Davidson", analyst: "Gil Luria", rating: "sell", target: 620, delta: -80, date: "27 Ene 2026" },
    ],

    consensus: { buy: 47, hold: 7, sell: 2, targetLow: 620, targetAvg: 1018, targetHigh: 1200 },

    businessSummary:
      "NVIDIA es el proveedor dominante de cómputo para IA: GPUs Hopper (H100, H200) y Blackwell (B100, B200, GB200) capturan +90 % del mercado de aceleradores de entrenamiento e inferencia generativa. La compañía vendió GPUs por valor de USD 92 B en el último año fiscal, contra USD 18 B dos años atrás. El ecosistema CUDA — 15 años de inversión en software — es el moat real.",
    driversNarrative:
      "El último trimestre rompió récord: USD 39,3 B en revenue, 12 % por encima del consenso, con Blackwell rampeando volumen y demanda excediendo capacidad de TSMC. La guidance de Q1 26 (USD 43 B) implicaría +89 % yoy en pleno escenario de comparables exigentes.",
    thesis: [
      "El gasto en infraestructura de IA por parte de los hyperscalers (Microsoft, Google, Amazon, Meta) se proyecta en USD 280 B para 2026. NVIDIA captura el 35-40 % de ese pool en hardware, con margen bruto del 76 %.",
      "CUDA es el sistema operativo de facto del cómputo paralelo. Migrar workloads a alternativas (AMD ROCm, Intel oneAPI, custom ASICs) requiere reescritura de stack — un costo de switching que sostiene precios premium.",
      "El roadmap Blackwell → Rubin → Feynman traza ciclo de upgrade anual con capex hyperscaler garantizado por contratos plurianuales. La compañía no compite con sus clientes: los habilita.",
    ],
    incomeNarrative:
      "El income statement es atípico: 76 % de margen bruto, 61 % de margen operativo, 53 % de margen neto. La estructura de costos es bajísima porque NVIDIA es fabless — TSMC produce la oblea, Foxconn y AMD fabrican el módulo final. El 14 % de opex (USD 17 B) se concentra en R&D (USD 12 B), una inversión justificada por el ritmo competitivo.",
    consensusNarrative:
      "El consenso es asimétricamente bullish: 47 firmas con rating Buy contra 7 Hold y 2 Sell. El target medio (USD 1018) descuenta +17 % de upside. Los bears (Bernstein, DA Davidson) argumentan compresión de margen por entrada de AMD MI300X y custom silicon de AWS/Google.",
    conclusionNarrative:
      "NVIDIA combina margen extraordinario con crecimiento triple dígito sobre una base ya gigante. La pregunta no es si el revenue crece, sino a qué múltiplo se descuenta el outlook. A 34 × P/E forward, el premium contra el sector se justifica por la dominancia de mercado y el moat CUDA. Mantenemos BUY con target USD 1020, reconociendo que la conviction es Media por la volatilidad inherente y el riesgo de digestión hyperscaler.",

    risks: [
      { title: "Digestión hyperscaler.", body: "Una pausa de 2-3 trimestres en el capex de Microsoft, Google o Meta comprimiría el revenue forward 15-20 %. El stock es muy sensible al guidance.", weight: "alto", horizon: "6m" },
      { title: "Entrada de custom silicon.", body: "Google TPUv5, Amazon Trainium 2 y Microsoft Maia están en producción. Pueden capturar hasta 20 % del workload de inferencia interna en 24 meses.", weight: "alto", horizon: "24m" },
      { title: "Controles de exportación.", body: "Restricciones US adicionales sobre China impactarían el revenue del segmento Data Center en 12-15 %.", weight: "medio", horizon: "12m" },
    ],
    catalysts: [
      { title: "Ramp de Blackwell.", body: "GB200 NVL72 entró en producción Q4 25. Cada unidad equivale a USD 3 M de revenue. Demanda de hyperscalers excede 800.000 unidades para 2026.", weight: "alto", horizon: "6m" },
      { title: "NIM y software stack.", body: "El nuevo segmento NVIDIA Enterprise + NIM podría llegar a USD 10 B de revenue recurrente en 24 meses, mejorando el mix.", weight: "medio", horizon: "12m" },
      { title: "Robotics e industrial.", body: "Plataforma Jetson Thor y Isaac empiezan a penetrar segmento robotic. Sin contribución material hoy, pero óptica de re-rating en 2027.", weight: "bajo", horizon: "24m" },
    ],

    asOf: "26 Ene 2025",
    filingRef: "10-K · CIK 0001045810",
    lastUpdated: "11 Abr 2026 · 14:32 UY",
  },

  GOOGL: {
    name: "Alphabet Inc.",
    exchange: "NASDAQ",
    currency: "USD",
    price: 156.42,
    change1d: -0.18,
    changeYtd: 9.84,
    marketCap: "USD 1,94 T",
    volume: "28,1 M",
    dayLow: 155.30,
    dayHigh: 158.20,
    week52Low: 121.46,
    week52High: 168.95,
    avgVolume: "31,2 M",

    verdict: "BUY",
    target: 185,
    targetUpside: 18.27,
    conviction: "Alta",
    convictionChange: "Subido",

    sector: "Communication Services",
    industry: "Internet · Content & Information",

    kpis: [
      ["Cap. bursátil", "1,94 T", null],
      ["P/E TTM", "24,7 ×", "pos"],
      ["P/E Fwd", "22,1 ×", "pos"],
      ["EV/EBITDA", "16,2 ×", "pos"],
      ["Revenue TTM", "USD 339 B", null],
      ["Rev. growth", "+13,5 %", "pos"],
      ["Margen bruto", "57,1 %", "pos"],
      ["Margen op.", "30,2 %", "pos"],
      ["Margen neto", "25,1 %", "pos"],
      ["ROE", "28,4 %", "pos"],
      ["ROIC", "22,1 %", "pos"],
      ["FCF TTM", "USD 78 B", "pos"],
      ["Div. yield", "0,52 %", null],
      ["Debt / Eq.", "0,11 ×", null],
      ["Beta 5y", "1,03", null],
      ["EPS TTM", "USD 6,35", null],
    ],
    kpiSparks: Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`m${i}`, sparkline(600 + i, 5, 0.04)])),

    peers: [
      { t: "META", pe: "26,4 ×", chg: 1.12 },
      { t: "MSFT", pe: "34,1 ×", chg: 0.38 },
      { t: "AMZN", pe: "47,2 ×", chg: 0.41 },
      { t: "AAPL", pe: "29,4 ×", chg: 1.24 },
    ],

    pricePath: pricePath(701, 26, 0.010, 0.045, 100).map(y => ({ y })),
    spxPath: SPX_PATH,

    quarters: [
      { q: "Q1 24", rev: 80.5, eps: 1.89, consRev: 78.6, consEps: 1.51, beat: true },
      { q: "Q2 24", rev: 84.7, eps: 1.89, consRev: 84.2, consEps: 1.85, beat: true },
      { q: "Q3 24", rev: 88.3, eps: 2.12, consRev: 86.3, consEps: 1.83, beat: true },
      { q: "Q4 24", rev: 96.5, eps: 2.15, consRev: 96.6, consEps: 2.13, beat: false },
      { q: "Q1 25", rev: 90.2, eps: 2.81, consRev: 89.1, consEps: 2.01, beat: true },
      { q: "Q2 25", rev: 96.4, eps: 2.31, consRev: 94.0, consEps: 2.18, beat: true },
      { q: "Q3 25", rev: 102.4, eps: 2.39, consRev: 99.1, consEps: 2.23, beat: true },
      { q: "Q4 25", rev: 96.5, eps: 2.15, consRev: 96.6, consEps: 2.13, beat: false },
    ],

    sankey: {
      revenue: 339.0,
      costOfRevenue: 145.5,
      grossProfit: 193.5,
      opex: 91.2,
      operatingIncome: 102.3,
      otherAndTax: 17.2,
      netIncome: 85.1,
    },

    segments: [
      { name: "Google Search", share: 56, color: SEG_COLORS[0] },
      { name: "YouTube ads", share: 11, color: SEG_COLORS[3] },
      { name: "Google Cloud", share: 13, color: SEG_COLORS[1] },
      { name: "Google Network", share: 9, color: SEG_COLORS[2] },
      { name: "Subscriptions & other", share: 11, color: SEG_COLORS[4] },
    ],

    analystTable: [
      { firm: "Morgan Stanley", analyst: "Brian Nowak", rating: "buy", target: 200, delta: 10, date: "11 Mar 2026" },
      { firm: "Goldman Sachs", analyst: "Eric Sheridan", rating: "buy", target: 192, delta: 5, date: "04 Mar 2026" },
      { firm: "JPMorgan", analyst: "Doug Anmuth", rating: "buy", target: 185, delta: 0, date: "26 Feb 2026" },
      { firm: "Wells Fargo", analyst: "Ken Gawrelski", rating: "buy", target: 180, delta: 2, date: "19 Feb 2026" },
      { firm: "Bank of America", analyst: "Justin Post", rating: "hold", target: 170, delta: 0, date: "12 Feb 2026" },
      { firm: "Barclays", analyst: "Ross Sandler", rating: "hold", target: 165, delta: -5, date: "05 Feb 2026" },
      { firm: "Needham", analyst: "Laura Martin", rating: "hold", target: 155, delta: 0, date: "29 Ene 2026" },
    ],

    consensus: { buy: 31, hold: 11, sell: 1, targetLow: 145, targetAvg: 178, targetHigh: 220 },

    businessSummary:
      "Alphabet es Google: el motor de búsqueda dominante (90 %+ market share global), YouTube como segunda plataforma de video del mundo, y Google Cloud como tercer hyperscaler. La compañía monetiza la atención a través de Search (USD 191 B anuales) y YouTube ads (USD 38 B), y construye un negocio de infraestructura cloud creciente (USD 44 B con margen operativo recién positivo).",
    driversNarrative:
      "El último trimestre confirmó la tesis de re-aceleración: Search +12 %, YouTube +14 %, Cloud +30 %. Gemini 2.0 integrado en producto está protegiendo share contra ChatGPT y empezando a generar revenue propio vía API. La compañía elevó el dividendo y autorizó USD 70 B en recompras.",
    thesis: [
      "Search no está siendo canibalizado por ChatGPT — está incorporando IA. AI Overviews ya cubre el 60 % de queries comerciales sin degradar CPC. El moat de la infraestructura de crawling + intent indexing sigue intacto.",
      "YouTube es el activo de medios más infravalorado del S&P. A USD 38 B de revenue ads + USD 12 B de subscripciones (Premium + TV), capitalizado discretamente como segmento Google Services.",
      "Google Cloud alcanzó break-even operativo en 2024 y crece a +30 %. Gemini API + Vertex AI lo posicionan como la única alternativa real a Azure OpenAI para enterprise GenAI.",
    ],
    incomeNarrative:
      "Estructura más balanceada que Microsoft o Apple: 57 % margen bruto, 30 % margen operativo. El opex (USD 91 B) está dominado por R&D (USD 49 B) y sales & marketing (USD 27 B). La capacidad de inversión en TPU + data centers + research (DeepMind) explica el premium en margin defensiva contra Big Tech.",
    consensusNarrative:
      "El consenso pasó de cauteloso a constructivo en 2025: 31 ratings Buy, target medio USD 178. Los upgrades recientes (Morgan Stanley, Goldman) reflejan que el mercado finalmente descontó la integración de Gemini en Search sin destrucción de CPC.",
    conclusionNarrative:
      "Alphabet cotiza a 22 × P/E forward, el descuento más grande dentro del Magnificent 7. La compañía monetiza la atención mejor que nadie (USD 230 B en ads), construye cloud rentable y lidera research en IA con Gemini. El riesgo antitrust está dimensionado pero no transforma la estructura del negocio. Reiteramos BUY con target USD 185.",

    risks: [
      { title: "Caso DOJ Search.", body: "El juicio antitrust podría forzar separación de Search del browser default en Android. Un fallo adverso impactaría USD 18-24 B anuales de Search revenue.", weight: "alto", horizon: "12m" },
      { title: "Caso DOJ Ad Tech.", body: "Separación forzada de ad-tech tools (Ad Manager, Network) podría comprometer USD 30 B de revenue de Network.", weight: "alto", horizon: "12m" },
      { title: "Disrupción IA en Search.", body: "ChatGPT, Perplexity y Claude están capturando queries informacionales. El impacto en CPC promedio es real pero compensado por AI Overviews.", weight: "medio", horizon: "12m" },
    ],
    catalysts: [
      { title: "Gemini 2.0 monetización.", body: "API revenue + Gemini Workspace integración pueden contribuir USD 8-12 B en 2026, no descontados por el consenso.", weight: "alto", horizon: "12m" },
      { title: "Margen operativo Cloud.", body: "Cloud operating margin pasó de -16 % a +13 % en 24 meses. Cada 100 bps adicional son USD 440 M de operating income.", weight: "alto", horizon: "12m" },
      { title: "Waymo & Other Bets.", body: "Waymo opera 250.000 rides semanales, monetizándose. Una salida pública o spin-off podría unlock $40-80 B de valor.", weight: "bajo", horizon: "24m" },
    ],

    asOf: "31 Dic 2025",
    filingRef: "10-K · CIK 0001652044",
    lastUpdated: "11 Abr 2026 · 14:32 UY",
  },

  META: {
    name: "Meta Platforms Inc.",
    exchange: "NASDAQ",
    currency: "USD",
    price: 524.18,
    change1d: 1.12,
    changeYtd: 38.92,
    marketCap: "USD 1,33 T",
    volume: "14,3 M",
    dayLow: 519.40,
    dayHigh: 528.10,
    week52Low: 391.20,
    week52High: 562.85,
    avgVolume: "16,8 M",

    verdict: "BUY",
    target: 615,
    targetUpside: 17.32,
    conviction: "Alta",
    convictionChange: "Mantenido",

    sector: "Communication Services",
    industry: "Internet · Content & Information",

    kpis: [
      ["Cap. bursátil", "1,33 T", null],
      ["P/E TTM", "26,4 ×", "pos"],
      ["P/E Fwd", "22,9 ×", "pos"],
      ["EV/EBITDA", "15,8 ×", "pos"],
      ["Revenue TTM", "USD 165 B", null],
      ["Rev. growth", "+22,1 %", "pos"],
      ["Margen bruto", "81,9 %", "pos"],
      ["Margen op.", "41,5 %", "pos"],
      ["Margen neto", "33,8 %", "pos"],
      ["ROE", "33,2 %", "pos"],
      ["ROIC", "31,0 %", "pos"],
      ["FCF TTM", "USD 49 B", "pos"],
      ["Div. yield", "0,38 %", null],
      ["Debt / Eq.", "0,15 ×", null],
      ["Beta 5y", "1,18", null],
      ["EPS TTM", "USD 19,82", null],
    ],
    kpiSparks: Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`m${i}`, sparkline(800 + i, 5, 0.05)])),

    peers: [
      { t: "GOOGL", pe: "24,7 ×", chg: -0.18 },
      { t: "SNAP", pe: "—", chg: -3.42 },
      { t: "PINS", pe: "41,8 ×", chg: 0.61 },
      { t: "MSFT", pe: "34,1 ×", chg: 0.38 },
    ],

    pricePath: pricePath(901, 26, 0.025, 0.06, 100).map(y => ({ y })),
    spxPath: SPX_PATH,

    quarters: [
      { q: "Q1 24", rev: 36.5, eps: 4.71, consRev: 36.1, consEps: 4.32, beat: true },
      { q: "Q2 24", rev: 39.1, eps: 5.16, consRev: 38.3, consEps: 4.73, beat: true },
      { q: "Q3 24", rev: 40.6, eps: 6.03, consRev: 40.2, consEps: 5.25, beat: true },
      { q: "Q4 24", rev: 48.4, eps: 8.02, consRev: 47.0, consEps: 6.77, beat: true },
      { q: "Q1 25", rev: 42.3, eps: 6.43, consRev: 41.4, consEps: 5.25, beat: true },
      { q: "Q2 25", rev: 44.0, eps: 5.78, consRev: 44.0, consEps: 5.83, beat: false },
      { q: "Q3 25", rev: 45.5, eps: 6.10, consRev: 44.8, consEps: 5.94, beat: true },
      { q: "Q4 25", rev: 53.1, eps: 8.50, consRev: 51.2, consEps: 7.45, beat: true },
    ],

    sankey: {
      revenue: 165.0,
      costOfRevenue: 29.9,
      grossProfit: 135.1,
      opex: 66.6,
      operatingIncome: 68.5,
      otherAndTax: 12.7,
      netIncome: 55.8,
    },

    segments: [
      { name: "Facebook ads", share: 49, color: SEG_COLORS[0] },
      { name: "Instagram ads", share: 38, color: SEG_COLORS[3] },
      { name: "WhatsApp & Threads", share: 6, color: SEG_COLORS[1] },
      { name: "Reality Labs", share: 5, color: SEG_COLORS[4] },
      { name: "Other", share: 2, color: SEG_COLORS[2] },
    ],

    analystTable: [
      { firm: "Morgan Stanley", analyst: "Brian Nowak", rating: "buy", target: 660, delta: 30, date: "12 Mar 2026" },
      { firm: "Goldman Sachs", analyst: "Eric Sheridan", rating: "buy", target: 635, delta: 15, date: "05 Mar 2026" },
      { firm: "JPMorgan", analyst: "Doug Anmuth", rating: "buy", target: 615, delta: 0, date: "27 Feb 2026" },
      { firm: "Bank of America", analyst: "Justin Post", rating: "buy", target: 595, delta: 5, date: "20 Feb 2026" },
      { firm: "Wells Fargo", analyst: "Ken Gawrelski", rating: "buy", target: 580, delta: 0, date: "13 Feb 2026" },
      { firm: "Barclays", analyst: "Ross Sandler", rating: "hold", target: 535, delta: -10, date: "06 Feb 2026" },
      { firm: "MoffettNathanson", analyst: "Michael Nathanson", rating: "sell", target: 420, delta: -30, date: "30 Ene 2026" },
    ],

    consensus: { buy: 38, hold: 6, sell: 2, targetLow: 420, targetAvg: 605, targetHigh: 720 },

    businessSummary:
      "Meta opera la red social más grande del mundo: 3.290 millones de usuarios activos diarios across Facebook, Instagram, WhatsApp y Threads. El motor de monetización es advertising (97 % del revenue), con CPMs sostenidos por algoritmos de ranking que mejoran continuamente con IA. Reality Labs (segmento metaverse) sigue siendo costo (USD -16 B operating loss anual) pero el core ads compensa con holgura.",
    driversNarrative:
      "El trimestre rompió expectativas: revenue +25 % yoy, EPS +33 %, impressions +20 %, price-per-ad +9 %. La Llama 3 + Llama 4 funcionan como atractor de developers (5 millones de descargas) y como motor interno de Reels, donde el tiempo de consumo creció 38 % yoy. El año de eficiencia (2023) ya quedó atrás: vuelve la inversión, pero con margen disciplinado.",
    thesis: [
      "Reels recuperó a TikTok en engagement entre 18-25. El mix de Reels en feed Instagram ya monetiza al mismo CPM que feed estático — un cambio estructural que el mercado aún no descontó completamente.",
      "WhatsApp Business + Click-to-Message ads están en transición de feature a línea de revenue: USD 7-9 B anuales potenciales en 24 meses, especialmente en mercados emergentes.",
      "Reality Labs sigue siendo opcionalidad gratuita: los smart glasses Ray-Ban superaron 1 M de unidades, validando el form factor. Quest sigue costoso pero el roadmap de AR es serio.",
    ],
    incomeNarrative:
      "Estructura excepcional: 82 % de margen bruto (digital ads puro), 42 % de margen operativo. El opex (USD 67 B) incluye USD 38 B de R&D — el 23 % del revenue — del cual una porción importante financia Reality Labs. El P&L sin RL tendría margen operativo cercano al 50 %.",
    consensusNarrative:
      "El consenso pivoteó decisivamente bullish post-Llama 3: 38 ratings Buy, target medio USD 605. Los pocos detractores (MoffettNathanson) argumentan que el spend en IA + RL es estructuralmente alto y comprime margin trayectoria.",
    conclusionNarrative:
      "Meta combina el mayor reach digital del mundo con la mejor ejecución algoritmica del mercado de ads. La integración de Llama en producto está acelerando engagement sin destruir CPC, y el capex en IA tiene retorno medible. A 22,9 × P/E forward, cotiza con descuento contra Microsoft y Google a pesar de tener mejor crecimiento. Reiteramos BUY con target USD 615.",

    risks: [
      { title: "Capex Reality Labs.", body: "USD 16 B de operating loss anual en RL. Sin path claro a break-even, mercado puede penalizar la asignación de capital.", weight: "medio", horizon: "24m" },
      { title: "Regulación EU DMA.", body: "El DMA impuso pago obligatorio o ads basados en consentimiento en EU. Impacto estimado: -4-6 % de ad revenue en región.", weight: "medio", horizon: "12m" },
      { title: "Competencia TikTok.", body: "Si el ban TikTok US se revierte o tarda, TikTok recupera engagement entre 13-25 y Reels regresa en share.", weight: "medio", horizon: "12m" },
    ],
    catalysts: [
      { title: "Click-to-Message ads.", body: "Monetización de WhatsApp Business pasando de USD 1 B a potencial USD 8 B en 24 meses, vector de upside no descontado.", weight: "alto", horizon: "12m" },
      { title: "Llama enterprise.", body: "Llama 4 enterprise edition + Meta Cloud podría inaugurar línea de SaaS con margen 70 %+.", weight: "medio", horizon: "12m" },
      { title: "AI agents en plataforma.", body: "Creator agents y business agents en Messenger/WhatsApp pueden capturar revenue share del comercio conversacional.", weight: "alto", horizon: "12m" },
    ],

    asOf: "31 Dic 2025",
    filingRef: "10-K · CIK 0001326801",
    lastUpdated: "11 Abr 2026 · 14:32 UY",
  },

  AMZN: {
    name: "Amazon.com Inc.",
    exchange: "NASDAQ",
    currency: "USD",
    price: 189.74,
    change1d: 0.41,
    changeYtd: 11.32,
    marketCap: "USD 1,98 T",
    volume: "34,7 M",
    dayLow: 187.20,
    dayHigh: 191.30,
    week52Low: 146.92,
    week52High: 215.40,
    avgVolume: "38,4 M",

    verdict: "HOLD",
    target: 205,
    targetUpside: 8.04,
    conviction: "Media",
    convictionChange: "Bajado",

    sector: "Consumer Discretionary",
    industry: "Internet Retail",

    kpis: [
      ["Cap. bursátil", "1,98 T", null],
      ["P/E TTM", "47,2 ×", "neg"],
      ["P/E Fwd", "32,1 ×", null],
      ["EV/EBITDA", "17,4 ×", null],
      ["Revenue TTM", "USD 619 B", "pos"],
      ["Rev. growth", "+11,2 %", "pos"],
      ["Margen bruto", "48,1 %", "pos"],
      ["Margen op.", "10,8 %", null],
      ["Margen neto", "6,8 %", null],
      ["ROE", "21,4 %", "pos"],
      ["ROIC", "13,2 %", null],
      ["FCF TTM", "USD 39 B", "pos"],
      ["Div. yield", "0,00 %", null],
      ["Debt / Eq.", "0,53 ×", null],
      ["Beta 5y", "1,28", null],
      ["EPS TTM", "USD 4,02", null],
    ],
    kpiSparks: Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`m${i}`, sparkline(1000 + i, 5, 0.04)])),

    peers: [
      { t: "WMT", pe: "33,2 ×", chg: 0.21 },
      { t: "MELI", pe: "55,4 ×", chg: -1.14 },
      { t: "EBAY", pe: "16,1 ×", chg: 0.42 },
      { t: "SHOP", pe: "82,3 ×", chg: -2.18 },
    ],

    pricePath: pricePath(1101, 26, 0.011, 0.05, 100).map(y => ({ y })),
    spxPath: SPX_PATH,

    quarters: [
      { q: "Q1 24", rev: 143.3, eps: 0.98, consRev: 142.6, consEps: 0.83, beat: true },
      { q: "Q2 24", rev: 148.0, eps: 1.26, consRev: 148.6, consEps: 1.03, beat: false },
      { q: "Q3 24", rev: 158.9, eps: 1.43, consRev: 157.3, consEps: 1.14, beat: true },
      { q: "Q4 24", rev: 187.8, eps: 1.86, consRev: 187.3, consEps: 1.48, beat: true },
      { q: "Q1 25", rev: 155.7, eps: 1.59, consRev: 155.0, consEps: 1.37, beat: true },
      { q: "Q2 25", rev: 167.7, eps: 1.68, consRev: 162.0, consEps: 1.32, beat: true },
      { q: "Q3 25", rev: 169.0, eps: 1.86, consRev: 173.1, consEps: 1.58, beat: false },
      { q: "Q4 25", rev: 192.4, eps: 1.96, consRev: 195.0, consEps: 1.94, beat: false },
    ],

    sankey: {
      revenue: 619.0,
      costOfRevenue: 321.2,
      grossProfit: 297.8,
      opex: 230.9,
      operatingIncome: 66.9,
      otherAndTax: 24.8,
      netIncome: 42.1,
    },

    segments: [
      { name: "Online stores", share: 39, color: SEG_COLORS[0] },
      { name: "AWS", share: 17, color: SEG_COLORS[3] },
      { name: "3P seller services", share: 24, color: SEG_COLORS[1] },
      { name: "Advertising", share: 9, color: SEG_COLORS[4] },
      { name: "Physical stores", share: 4, color: SEG_COLORS[2] },
      { name: "Subscriptions", share: 7, color: SEG_COLORS[5] },
    ],

    analystTable: [
      { firm: "Morgan Stanley", analyst: "Brian Nowak", rating: "buy", target: 235, delta: 10, date: "13 Mar 2026" },
      { firm: "Goldman Sachs", analyst: "Eric Sheridan", rating: "buy", target: 225, delta: 5, date: "06 Mar 2026" },
      { firm: "JPMorgan", analyst: "Doug Anmuth", rating: "buy", target: 215, delta: 0, date: "28 Feb 2026" },
      { firm: "Bank of America", analyst: "Justin Post", rating: "hold", target: 200, delta: -10, date: "21 Feb 2026" },
      { firm: "Wells Fargo", analyst: "Ken Gawrelski", rating: "hold", target: 195, delta: 0, date: "14 Feb 2026" },
      { firm: "Barclays", analyst: "Ross Sandler", rating: "hold", target: 185, delta: -5, date: "07 Feb 2026" },
      { firm: "DA Davidson", analyst: "Gil Luria", rating: "sell", target: 158, delta: -22, date: "31 Ene 2026" },
    ],

    consensus: { buy: 24, hold: 12, sell: 3, targetLow: 158, targetAvg: 203, targetHigh: 250 },

    businessSummary:
      "Amazon es tres compañías en una: marketplace de retail (USD 240 B), AWS (USD 105 B), y advertising (USD 56 B). Cada una tiene perfil de margen distinto: retail margen operativo 3 %, AWS 36 %, advertising +50 %. El mercado siempre intentó descomponer el sum-of-the-parts pero la dirección mantiene la estructura por sinergias logísticas y operativas.",
    driversNarrative:
      "El trimestre fue mixto: AWS aceleró a +20 %, advertising +24 %, pero retail subió solo +6 % bajo el comparativo de un Q4 fuerte. La guidance de Q1 26 fue más conservadora de lo esperado, especialmente en operating income, generando la caída del 6 % post-earnings. Capex en AI infrastructure (USD 100 B+) reduce FCF y comprime ROIC en el corto plazo.",
    thesis: [
      "AWS es el motor real de valor: a 36 % margen operativo y +20 % crecimiento, descontado separadamente vale USD 1,5-1,8 T. El mercado lo valora en USD 1 T implícito.",
      "Advertising es la sorpresa: USD 56 B con margen 50 %+ y creciendo 24 %. En 24 meses superará a YouTube Search en revenue por segmento.",
      "Retail es bajo de margen pero genera el flow de pedidos que alimenta Prime, Ads y Logistics. No es el motor de valor, pero sostiene la rueda.",
    ],
    incomeNarrative:
      "Estructura compleja: 48 % margen bruto consolidado, pero la dispersión por segmento es extrema. Retail tiene 28 % margen bruto y 3 % operativo. AWS tiene 65 % margen bruto y 36 % operativo. La consolidación oculta la calidad del cloud business.",
    consensusNarrative:
      "El consenso se enfrió en 2026: 24 Buy vs. 12 Hold (era 30 vs. 6 hace 6 meses). Los downgrades reflejan dudas sobre el ROIC del capex en IA y la desaceleración del retail core. El target medio cayó USD 12 en 90 días.",
    conclusionNarrative:
      "Amazon es el caso más complejo del Magnificent 7: tres negocios con perfiles muy distintos, capex récord (USD 100 B+ anuales en infra de IA), y un retail que ya no acelera. AWS y Advertising compensan, pero el múltiplo (47 × P/E TTM) descuenta una ejecución sin pasos en falso. Bajamos a HOLD con target USD 205 hasta ver si el capex se traduce en revenue medible de IA y si retail recupera momentum en H2.",

    risks: [
      { title: "Capex sin retorno medible.", body: "USD 100 B+ anuales en data centers AWS. Si Bedrock + Anthropic no generan revenue suficiente, el ROIC consolidado cae 3-5 pp.", weight: "alto", horizon: "12m" },
      { title: "Desaceleración retail.", body: "Online stores creció solo +6 % en Q4 25 vs +12 % YoY. El consumer está más cauto con el ticket promedio.", weight: "alto", horizon: "12m" },
      { title: "Caso FTC antitrust.", body: "El caso FTC sobre Prime y prácticas marketplace está en curso. Un fallo adverso podría forzar cambios estructurales.", weight: "medio", horizon: "24m" },
    ],
    catalysts: [
      { title: "AWS revenue de IA.", body: "Bedrock + Anthropic Claude están integrados a oferta. Si AWS reporta breakdown de AI revenue, el múltiplo se podría re-ratear.", weight: "alto", horizon: "12m" },
      { title: "Margen retail.", body: "Iniciativas de same-day delivery + automatización fulfillment buscan llevar margen retail de 3 % a 5 %. Cada 100 bps = USD 2,4 B operating income.", weight: "medio", horizon: "12m" },
      { title: "Project Kuiper revenue.", body: "Despliegue de constelación satelital Kuiper en producción 2026. Vector de revenue infra-network sin descontar.", weight: "bajo", horizon: "24m" },
    ],

    asOf: "31 Dic 2025",
    filingRef: "10-K · CIK 0001018724",
    lastUpdated: "11 Abr 2026 · 14:32 UY",
  },
};

export const TICKER_LIST = Object.keys(ANALYZE_TICKERS);

export function getTicker(symbol: string): TickerData {
  return ANALYZE_TICKERS[symbol] ?? ANALYZE_TICKERS.AAPL;
}
