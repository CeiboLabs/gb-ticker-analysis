import { ANALYSIS_SYSTEM_PROMPT, ANALYSIS_DATA_TEMPLATE } from "@/prompts/analysis";
import type { StockData, InsiderTransaction } from "@/types/StockData";
import type { SegmentSankeyData, IndustryProfile } from "@/types/Report";
import { classifyPublisher, tierLabel, tierDescriptor } from "@/lib/publisherTiers";

// ── Scalar formatters ────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  return n != null ? n.toFixed(2) : "N/A";
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "N/A";
  return `${(n * 100).toFixed(1)}%`;
}

function fmtPctRaw(n: number | null | undefined): string {
  if (n == null) return "N/A";
  return `${n.toFixed(1)}%`;
}

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return "N/A";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtLargeNum(n: number | null | undefined): string {
  if (n == null) return "N/A";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString("en-US")}`;
}

// ── Block formatters ─────────────────────────────────────────────────────────

function fmtEarningsHistory(d: StockData): string {
  if (!d.earningsHistory.length) return "N/A";
  const rows = d.earningsHistory.map((e) => {
    const surprise = e.surprisePct != null ? `${e.surprisePct > 0 ? "+" : ""}${e.surprisePct.toFixed(1)}%` : "N/A";
    return `  ${e.quarter} | EPS Real: ${fmt(e.epsActual)} | EPS Est: ${fmt(e.epsEstimate)} | Sorpresa: ${surprise}`;
  });
  return rows.join("\n");
}

function fmtForwardEstimates(d: StockData): string {
  if (!d.forwardEstimates.length) return "N/A";
  const periodLabel: Record<string, string> = {
    "0q": "Trimestre actual",
    "+1q": "Próximo trimestre",
    "0y": "Año fiscal actual",
    "+1y": "Próximo año fiscal",
  };
  const rows = d.forwardEstimates.map((e) => {
    const label = periodLabel[e.period] ?? e.period;
    const growth = e.growth != null ? `(crec. ${(e.growth * 100).toFixed(1)}%)` : "";
    return `  ${label}: EPS Est. ${fmt(e.epsEstimate)} | Rev. Est. ${fmtLargeNum(e.revenueEstimate)} ${growth}`;
  });
  return rows.join("\n");
}

function fmtAnalystActions(d: StockData): string {
  if (!d.analystActions.length) return "N/A";
  return d.analystActions.map((a) => {
    const actionLabel = { up: "Upgrade", down: "Downgrade", init: "Inicio cobertura", main: "Mantiene", reit: "Reitera" }[a.action] ?? a.action;
    const change = a.fromGrade && a.fromGrade !== "—" ? `${a.fromGrade} → ${a.toGrade}` : a.toGrade;
    return `  ${a.date} | ${a.firm} | ${actionLabel}: ${change}`;
  }).join("\n");
}

function fmtInsiderTransactions(d: StockData): string {
  if (!d.insiderTransactions.length) return "N/A";
  return d.insiderTransactions.map((t) => {
    const val = t.value != null ? ` | Valor: ${fmtLargeNum(t.value)}` : "";
    return `  ${t.date} | ${t.name} (${t.relation}) | ${t.transactionText}${val}`;
  }).join("\n");
}

function fmtQuarterlyRevenueTrend(d: StockData): string {
  const data = d.quarterlyRevenue;
  if (!data || data.length === 0) return "N/A";
  const sorted = [...data].sort((a, b) => a.time.localeCompare(b.time));
  const recent = sorted.slice(-10);
  return recent.map((q, i) => {
    const prev = recent[i - 4];
    const yoy = prev && prev.value > 0
      ? `${(((q.value - prev.value) / prev.value) * 100).toFixed(1)}%`
      : "N/A";
    const dt = new Date(q.time);
    const qNum = Math.ceil((dt.getMonth() + 1) / 3);
    return `  Q${qNum} ${dt.getFullYear()}: ${fmtLargeNum(q.value)} (YoY: ${yoy})`;
  }).join("\n");
}

function fmtPeerComparison(d: StockData): string {
  const pc = d.peerComparison;
  if (!pc || pc.peers.length === 0) return "N/A — datos de peers no disponibles.";

  const lines: string[] = [];
  for (const p of pc.peers) {
    const tpe = p.trailingPE != null ? `${p.trailingPE.toFixed(2)}x` : "N/A";
    const fpe = p.forwardPE != null ? `${p.forwardPE.toFixed(2)}x` : "N/A";
    lines.push(`  ${p.symbol} (${p.name}): P/E Trailing ${tpe} | P/E Forward ${fpe}`);
  }
  const avgT = pc.avgTrailingPE != null ? `${pc.avgTrailingPE.toFixed(2)}x` : "N/A";
  const avgF = pc.avgForwardPE != null ? `${pc.avgForwardPE.toFixed(2)}x` : "N/A";
  lines.push(`  --- Promedio peers: P/E Trailing ${avgT} | P/E Forward ${avgF}`);
  return lines.join("\n");
}

function fmtRecentNews(d: StockData): string {
  const news = d.recentNews;
  if (!news || news.length === 0) return "N/A — no hay noticias recientes disponibles.";
  return news.slice(0, 7).map((n) => {
    const tier = classifyPublisher(n.publisher);
    const head = `  [${n.publishedAt}] (${tierLabel(tier)} · ${tierDescriptor(tier)} · ${n.publisher}) ${n.title}`;
    // When we have a snippet, indent it below the headline so the model gets
    // 1-2 lines of context instead of just a headline (vital for judging
    // materiality on ambiguous headlines like "Apple sued over App Store").
    if (n.description) {
      return `${head}\n      → ${n.description}`;
    }
    return head;
  }).join("\n");
}

function fmtAnnualCashFlow(d: StockData): string {
  const cf = d.annualCashFlow;
  if (!cf || cf.length === 0) return "N/A — historial de cash flow no disponible.";
  return cf.map((y) => {
    const capex = y.capitalExpenditure != null ? fmtLargeNum(Math.abs(y.capitalExpenditure)) : "N/A";
    const capexPctRev = y.capitalExpenditure != null && d.totalRevenue
      ? `${((Math.abs(y.capitalExpenditure) / d.totalRevenue) * 100).toFixed(1)}%`
      : null;
    const capexLabel = capexPctRev ? `${capex} (${capexPctRev} de rev.)` : capex;
    return `  FY${y.year}: CAPEX ${capexLabel} | OCF ${fmtLargeNum(y.operatingCashFlow)} | FCF ${fmtLargeNum(y.freeCashFlow)}`;
  }).join("\n");
}

function fmtSegmentData(
  sd: SegmentSankeyData | null | undefined,
  latestReportedQuarter: string | null | undefined,
): string {
  if (!sd) return "N/A — datos de segmentos SEC no disponibles para este ticker.";

  const u = sd.unit;
  const cur = sd.currency ?? "USD";
  const v = (n: number | undefined) => n != null ? `${n}${u} ${cur}` : "N/A";
  const pct = (n: number | undefined) => n != null ? ` (margen: ${n}%)` : "";

  const lines: string[] = [];

  // Freshness caveat: Yahoo's earningsHistory updates within hours of a press
  // release; SEC EDGAR's 10-Q lags 1–3 days and the 8-K parser may miss the
  // filing window. When the Sankey period is meaningfully behind the issuer's
  // most recently reported quarter, tell GPT-4o explicitly so the
  // recentEarnings narrative doesn't claim the older quarter is the latest
  // reported. 14-day buffer absorbs 52/53-week fiscal drift.
  if (sd.endDate && latestReportedQuarter) {
    const segMs = Date.parse(sd.endDate);
    const repMs = Date.parse(latestReportedQuarter);
    if (isFinite(segMs) && isFinite(repMs) && (repMs - segMs) / 86_400_000 >= 14) {
      lines.push(
        `AVISO DE FRESCURA: La empresa ya reportó resultados para el trimestre que terminó ${latestReportedQuarter}, ` +
        `pero el filing de SEC EDGAR con el desglose completo aún no está procesado. Las cifras del estado de ` +
        `resultados a continuación corresponden al trimestre anterior (${sd.endDate}). ` +
        `IMPORTANTE: en la sección "recentEarnings" referite al reporte de ${latestReportedQuarter} como el ` +
        `MÁS RECIENTE (usando el HISTORIAL DE RESULTADOS / EPS para esa fecha) y trata el desglose del Sankey ` +
        `como contexto del trimestre previo. NO escribas frases como "el próximo reporte será clave" si los ` +
        `resultados ya fueron publicados.`,
      );
      lines.push("");
    }
  }

  const period = sd.segmentPeriod && sd.segmentPeriod !== sd.period
    ? `${sd.period} (segmentos: ${sd.segmentPeriod})`
    : sd.period;
  lines.push(`Período: ${period}`);

  if (sd.segments.length > 0) {
    lines.push("");
    lines.push("Segmentos de ingresos:");
    for (const s of sd.segments) {
      const yoy = s.yoy ? ` (YoY: ${s.yoy})` : "";
      lines.push(`  ${s.name}: ${v(s.value)}${yoy}`);
    }
  }

  lines.push("");
  lines.push("Estado de resultados (SEC EDGAR):");
  const revYoy = sd.totalRevenueYoy ? ` (YoY: ${sd.totalRevenueYoy})` : "";
  lines.push(`  Ingresos totales:     ${v(sd.totalRevenue)}${revYoy}`);
  lines.push(`  Costo de ingresos:    ${v(sd.costOfRevenue)}`);
  lines.push(`  Utilidad bruta:       ${v(sd.grossProfit)}${pct(sd.grossMarginPct)}`);
  lines.push(`  Gastos operativos:    ${v(sd.operatingExpenses)}`);

  if (sd.opexBreakdown) {
    const ob = sd.opexBreakdown;
    if (ob.rd != null)             lines.push(`    I+D:                ${v(ob.rd)}`);
    if (ob.salesMarketing != null) lines.push(`    Ventas y marketing: ${v(ob.salesMarketing)}`);
    if (ob.generalAdmin != null)   lines.push(`    G&A:                ${v(ob.generalAdmin)}`);
    if (ob.other != null)          lines.push(`    Otros:              ${v(ob.other)}`);
  }

  lines.push(`  Utilidad operativa:   ${v(sd.operatingProfit)}${pct(sd.operatingMarginPct)}`);
  if (sd.nonOperatingIncome != null) {
    lines.push(`  Ingreso no operativo: ${v(sd.nonOperatingIncome)}`);
  }
  if (sd.tax != null) lines.push(`  Impuestos:            ${v(sd.tax)}`);
  lines.push(`  Utilidad neta:        ${v(sd.netProfit)}${pct(sd.netMarginPct)}`);

  return lines.join("\n");
}

// ── Placeholder map ──────────────────────────────────────────────────────────

type Formatter = (d: StockData) => string;

const PLACEHOLDER_MAP: Record<string, Formatter> = {
  TICKER:        (d) => d.ticker,
  COMPANY_NAME:  (d) => d.companyName,
  SECTOR:        (d) => d.sector ?? "N/A",
  INDUSTRY:      (d) => d.industry ?? "N/A",
  DESCRIPTION:   (d) => {
    const desc = d.description ?? "No description available.";
    return desc.length > 600 ? desc.slice(0, 597) + "..." : desc;
  },
  TODAY_DATE:    () => new Date().toISOString().split("T")[0],

  // Price
  CURRENT_PRICE:    (d) => fmtCurrency(d.currentPrice),
  PRICE_CHANGE_PCT: (d) => fmtPct(d.priceChangePercent),
  WEEK52_HIGH:      (d) => fmtCurrency(d.fiftyTwoWeekHigh),
  WEEK52_LOW:       (d) => fmtCurrency(d.fiftyTwoWeekLow),

  // Valuation
  MARKET_CAP:       (d) => fmtLargeNum(d.marketCap),
  TRAILING_PE:      (d) => fmt(d.trailingPE),
  FORWARD_PE:       (d) => fmt(d.forwardPE),
  TRAILING_EPS:     (d) => fmt(d.trailingEps),
  PRICE_TO_BOOK:    (d) => fmt(d.priceToBook),
  PRICE_TO_SALES:   (d) => fmt(d.priceToSales),
  EV_TO_EBITDA:     (d) => fmt(d.enterpriseToEbitda),
  BETA:             (d) => fmt(d.beta),
  CAPE_RATIO:       (d) => d.capeRatio != null ? `${d.capeRatio.toFixed(1)}x (${d.capeYears ?? "?"}yr avg EPS)` : "N/A",

  // Financials
  TOTAL_REVENUE:       (d) => fmtLargeNum(d.totalRevenue),
  REVENUE_GROWTH:      (d) => fmtPct(d.revenueGrowth),
  EARNINGS_GROWTH:     (d) => fmtPct(d.earningsGrowth),
  GROSS_MARGIN:        (d) => fmtPct(d.grossMargins),
  OPERATING_MARGIN:    (d) => fmtPct(d.operatingMargins),
  NET_MARGIN:          (d) => fmtPct(d.profitMargins),
  EBITDA_MARGIN:       (d) => fmtPct(d.ebitdaMargins),
  EBITDA:              (d) => fmtLargeNum(d.ebitda),
  ROE:                 (d) => fmtPct(d.returnOnEquity),
  ROA:                 (d) => fmtPct(d.returnOnAssets),
  TOTAL_DEBT:          (d) => fmtLargeNum(d.totalDebt),
  TOTAL_CASH:          (d) => fmtLargeNum(d.totalCash),
  DEBT_TO_EQUITY:      (d) => fmt(d.debtToEquity),
  CURRENT_RATIO:       (d) => fmt(d.currentRatio),
  QUICK_RATIO:         (d) => fmt(d.quickRatio),
  FREE_CASHFLOW:       (d) => fmtLargeNum(d.freeCashflow),
  OPERATING_CASHFLOW:  (d) => fmtLargeNum(d.operatingCashflow),
  SHORT_PERCENT_FLOAT: (d) => fmtPct(d.shortPercentOfFloat),
  SHARES_OUTSTANDING:  (d) => fmtLargeNum(d.sharesOutstanding),
  ANNUAL_CASHFLOW_HISTORY: fmtAnnualCashFlow,

  // Ownership
  INSIDER_OWNERSHIP:       (d) => fmtPct(d.heldPercentInsiders),
  INSTITUTIONAL_OWNERSHIP: (d) => fmtPct(d.institutionalOwnership),

  // Dividend
  DIVIDEND_YIELD:   (d) => fmtPct(d.dividendYield),
  PAYOUT_RATIO:     (d) => fmtPct(d.payoutRatio),
  EX_DIVIDEND_DATE: (d) => d.exDividendDate ?? "N/A",

  // Last quarter (legacy — kept for compatibility)
  LAST_EPS_ACTUAL:   (d) => fmt(d.earningsHistory.at(-1)?.epsActual),
  LAST_EPS_ESTIMATE: (d) => fmt(d.earningsHistory.at(-1)?.epsEstimate),
  EPS_SURPRISE_PCT:  (d) => fmtPctRaw(d.earningsHistory.at(-1)?.surprisePct),

  // Block placeholders
  QUARTERLY_REVENUE_TREND: fmtQuarterlyRevenueTrend,
  RECENT_NEWS:             fmtRecentNews,
  EARNINGS_HISTORY:      fmtEarningsHistory,
  // Forward estimates with explicit growth-trend signal (single-call enrichment)
  FORWARD_ESTIMATES:     fmtForwardEstimatesRich,
  // Yahoo's calendar.earnings.earningsDate often keeps the just-passed date
  // for hours/days after a release. Feeding GPT-4o a literal past date as
  // "PRÓXIMOS RESULTADOS" makes it write boilerplate like "el próximo
  // reporte será clave para confirmar..." referring to a phantom future event.
  // Mark past dates explicitly so the model knows the report already
  // happened and the next one's date is pending.
  NEXT_EARNINGS_DATE:    (d) => {
    const next = d.nextEarningsDate;
    if (!next) return "N/A";
    const nextMs = Date.parse(next);
    if (!isFinite(nextMs)) return next;
    // 1-day grace — an "earnings today" at 4:30pm ET is still "today" in UY.
    if (nextMs <= Date.now() - 86_400_000) {
      return `${next} (ya reportado — la próxima fecha aún no fue publicada por Yahoo)`;
    }
    return next;
  },
  ANALYST_ACTIONS:       fmtAnalystActions,
  // Classified insider transactions (mechanical vs discretionary) — single-call enrichment
  INSIDER_TRANSACTIONS:  fmtInsiderTransactionsClassified,

  // Analyst consensus
  RECOMMENDATION:      (d) => d.recommendationKey?.toUpperCase() ?? "N/A",
  TARGET_PRICE_MEAN:   (d) => fmtCurrency(d.targetMeanPrice),
  TARGET_PRICE_HIGH:   (d) => fmtCurrency(d.targetHighPrice),
  TARGET_PRICE_LOW:    (d) => fmtCurrency(d.targetLowPrice),
  ANALYST_COUNT:       (d) => {
    const total = d.analystStrongBuy + d.analystBuy + d.analystHold + d.analystSell + d.analystStrongSell;
    return total > 0 ? total.toString() : "N/A";
  },
  ANALYST_STRONG_BUY:  (d) => d.analystStrongBuy.toString(),
  ANALYST_BUY:         (d) => d.analystBuy.toString(),
  ANALYST_HOLD:        (d) => d.analystHold.toString(),
  ANALYST_SELL:        (d) => d.analystSell.toString(),
  ANALYST_STRONG_SELL: (d) => d.analystStrongSell.toString(),

  // Peer comparison with percentile ranking (single-call enrichment)
  PEER_PE_COMPARISON:    fmtPeerComparisonRich,
  PEER_AVG_TRAILING_PE:  (d) => fmt(d.peerComparison?.avgTrailingPE),
  PEER_AVG_FORWARD_PE:   (d) => fmt(d.peerComparison?.avgForwardPE),
};

// ── Public API ───────────────────────────────────────────────────────────────

export interface PromptPayload {
  systemPrompt: string;
  userPrompt: string;
}

export function buildPrompt(data: StockData, segmentData?: SegmentSankeyData | null): PromptPayload {
  // Only the data template gets interpolated. The system prompt is a fixed string,
  // which lets OpenAI cache it across requests (~90% off on cached input tokens).

  // Industry-aware hints (Sprint 3.1) — both market and financial framework
  // reminders combined so the single-call model picks the right metrics for
  // bank / REIT / airline / etc.
  const indFin = industryHint(segmentData, "financial").trim();
  const indMkt = industryHint(segmentData, "market").trim();
  const industryBlock = [indFin, indMkt].filter(Boolean).join("\n");

  const sankeyQ = fmtSankeyQuality(segmentData);

  const userPrompt = ANALYSIS_DATA_TEMPLATE
    .replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      const fn = PLACEHOLDER_MAP[key];
      return fn ? fn(data) : match;
    })
    // Replacer como función: con replacement string, JS interpreta patrones $
    // ($', $&...) y cualquier valor que los contenga (un nombre de segmento SEC,
    // texto de hint) corrompería el template. La función los inserta literales.
    .replace("{{SEGMENT_DATA}}", () => fmtSegmentData(segmentData, data.earningsHistory.at(-1)?.quarter ?? null))
    .replace("{{INDUSTRY_HINT}}", () => industryBlock || "(framework estándar — sin hint específico de industria)")
    .replace("{{SANKEY_QUALITY}}", () => sankeyQ || "(segmentos cubren ≥95% del revenue — sin caveat de cobertura)");

  return {
    systemPrompt: ANALYSIS_SYSTEM_PROMPT,
    userPrompt,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   Insider classification (Sprint 2). Yahoo's transactionText is ambiguous —
   the same word "Sale" can mean a discretionary open-market sell OR a
   programmatic exercise+sell under a 10b5-1 plan. We classify locally before
   handing to the model so the prompt sees structured signal, not noise.
   ────────────────────────────────────────────────────────────────────────── */

export type InsiderClass = "discretionary_buy" | "discretionary_sell" | "mechanical" | "grant" | "other";

export function classifyInsiderTransaction(t: InsiderTransaction): InsiderClass {
  const txt = (t.transactionText ?? "").toLowerCase();
  if (/purchase|acquisition.*open|acquired in the open|acquisition at price/.test(txt)) {
    return "discretionary_buy";
  }
  if (/award|grant|stock award|deferred|inheritance|gift/.test(txt)) {
    return "grant";
  }
  // Programmatic / non-open-market: option exercises, vesting, 10b5-1 sales
  if (/non[- ]open[- ]market|10b5-1|vesting|exercise|conversion|exempt|stock option/.test(txt)) {
    return "mechanical";
  }
  if (/sale|disposed|disposition/.test(txt)) {
    return "discretionary_sell";
  }
  return "other";
}

export function summarizeInsiderPattern(txs: InsiderTransaction[]): {
  pattern: string;
  buyValue: number;
  sellValue: number;
  mechanicalValue: number;
} {
  let buyValue = 0;
  let sellValue = 0;
  let mechanicalValue = 0;
  for (const t of txs) {
    const v = Math.abs(t.value ?? 0);
    const c = classifyInsiderTransaction(t);
    if (c === "discretionary_buy") buyValue += v;
    else if (c === "discretionary_sell") sellValue += v;
    else if (c === "mechanical") mechanicalValue += v;
  }
  let pattern: string;
  if (buyValue > 0 && buyValue > sellValue * 2) pattern = "comprador neto discrecional";
  else if (sellValue > 0 && sellValue > buyValue * 3 && sellValue > mechanicalValue) pattern = "vendedor neto discrecional";
  else if (mechanicalValue > 0 && mechanicalValue > buyValue && mechanicalValue > sellValue) pattern = "predominantemente mecánico (RSU/opciones), no señal";
  else pattern = "mixto / neutral";
  return { pattern, buyValue, sellValue, mechanicalValue };
}

function fmtInsiderTransactionsClassified(d: StockData): string {
  if (!d.insiderTransactions.length) return "N/A — sin transacciones reportadas.";
  const lines: string[] = [];
  for (const t of d.insiderTransactions) {
    const c = classifyInsiderTransaction(t);
    const tag = {
      discretionary_buy: "[COMPRA DISCRECIONAL · señal positiva]",
      discretionary_sell: "[VENTA DISCRECIONAL · señal de cautela]",
      mechanical: "[MECÁNICA · RSU/opciones, no señal]",
      grant: "[GRANT · compensación, no señal]",
      other: "[OTRO]",
    }[c];
    const val = t.value != null ? ` | Valor: ${fmtLargeNum(t.value)}` : "";
    lines.push(`  ${t.date} | ${t.name} (${t.relation}) | ${t.transactionText} ${tag}${val}`);
  }
  const sum = summarizeInsiderPattern(d.insiderTransactions);
  lines.push("");
  lines.push(`  Patrón neto: ${sum.pattern}`);
  lines.push(`  Total compras discrecionales: ${fmtLargeNum(sum.buyValue)} | Ventas discrecionales: ${fmtLargeNum(sum.sellValue)} | Mecánicas: ${fmtLargeNum(sum.mechanicalValue)}`);
  return lines.join("\n");
}

/* ──────────────────────────────────────────────────────────────────────────
   Peer percentile rankings (Sprint 3.3). Rather than a flat "peers average
   P/E forward = 28.4x", compute where this ticker sits among peers as a
   percentile. Much more useful: "AAPL forward P/E está en p65 entre peers".
   ────────────────────────────────────────────────────────────────────────── */

function percentile(values: number[], target: number): number {
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return 50;
  const below = valid.filter((v) => v < target).length;
  return Math.round((below / valid.length) * 100);
}

function fmtPeerComparisonRich(d: StockData): string {
  const pc = d.peerComparison;
  if (!pc || pc.peers.length === 0) return "N/A — datos de peers no disponibles.";

  const lines: string[] = [];
  for (const p of pc.peers) {
    const tpe = p.trailingPE != null ? `${p.trailingPE.toFixed(2)}x` : "N/A";
    const fpe = p.forwardPE != null ? `${p.forwardPE.toFixed(2)}x` : "N/A";
    lines.push(`  ${p.symbol} (${p.name}): P/E Trailing ${tpe} | P/E Forward ${fpe}`);
  }
  const avgT = pc.avgTrailingPE != null ? `${pc.avgTrailingPE.toFixed(2)}x` : "N/A";
  const avgF = pc.avgForwardPE != null ? `${pc.avgForwardPE.toFixed(2)}x` : "N/A";
  lines.push(`  --- Promedio peers: P/E Trailing ${avgT} | P/E Forward ${avgF}`);

  // Percentile ranking of the current ticker vs peer cohort.
  if (d.trailingPE != null) {
    const peerValues = pc.peers.map((p) => p.trailingPE).filter((v): v is number => v != null);
    if (peerValues.length >= 2) {
      const pct = percentile(peerValues, d.trailingPE);
      lines.push(`  ${d.ticker} en P/E Trailing: percentil p${pct} entre peers (p0 = más barato, p100 = más caro).`);
    }
  }
  if (d.forwardPE != null) {
    const peerValues = pc.peers.map((p) => p.forwardPE).filter((v): v is number => v != null);
    if (peerValues.length >= 2) {
      const pct = percentile(peerValues, d.forwardPE);
      lines.push(`  ${d.ticker} en P/E Forward: percentil p${pct} entre peers.`);
    }
  }
  return lines.join("\n");
}

/* ──────────────────────────────────────────────────────────────────────────
   Forward estimate divergence (Sprint 2). Yahoo gives mean estimate; we also
   compute the range and growth rate sequence as a divergence signal.
   ────────────────────────────────────────────────────────────────────────── */

function fmtForwardEstimatesRich(d: StockData): string {
  if (!d.forwardEstimates.length) return "N/A";
  const periodLabel: Record<string, string> = {
    "0q": "Trimestre actual",
    "+1q": "Próximo trimestre",
    "0y": "Año fiscal actual",
    "+1y": "Próximo año fiscal",
  };
  const lines = d.forwardEstimates.map((e) => {
    const label = periodLabel[e.period] ?? e.period;
    const growth = e.growth != null ? `(crec. ${(e.growth * 100).toFixed(1)}%)` : "";
    return `  ${label}: EPS Est. ${fmt(e.epsEstimate)} | Rev. Est. ${fmtLargeNum(e.revenueEstimate)} ${growth}`;
  });

  // Sequence: is growth accelerating across periods?
  const growths = d.forwardEstimates
    .filter((e) => e.growth != null)
    .map((e) => ({ period: e.period, growth: e.growth as number }));
  if (growths.length >= 2) {
    const trend = growths[growths.length - 1].growth - growths[0].growth;
    const direction = trend > 0.01 ? "acelerando" : trend < -0.01 ? "desacelerando" : "estable";
    lines.push(`  → Crecimiento esperado ${direction} a lo largo del horizonte forward.`);
  }
  return lines.join("\n");
}

/* ──────────────────────────────────────────────────────────────────────────
   Sankey quality feedback (Sprint 2). If segments don't sum to 100% of
   revenue, tell the model so it can mention the residual instead of pretending
   the breakdown is complete.
   ────────────────────────────────────────────────────────────────────────── */

function fmtSankeyQuality(sd: SegmentSankeyData | null | undefined): string {
  if (!sd || sd.segments.length === 0) return "";
  const sum = sd.segments.reduce((s, x) => s + x.value, 0);
  if (sd.totalRevenue === 0) return "";
  const coverage = (sum / sd.totalRevenue) * 100;
  if (coverage >= 95) return ""; // close enough to 100, no caveat needed
  return `AVISO: los segmentos reportados suman ${coverage.toFixed(1)}% del revenue total. El residual ${(100 - coverage).toFixed(1)}% no está desagregado en el filing — mencionalo si corresponde en revenueStreams.`;
}

/* ──────────────────────────────────────────────────────────────────────────
   Per-specialist user prompt builders. Each specialist gets ONLY the data
   it needs — keeps prompts focused and reduces cost.
   ────────────────────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────────────────────
   Industry-aware hints (Sprint 3.1). The XBRL parser detects industryProfile
   (bank, REIT, airline, etc.); we use that to feed specialized framework
   reminders into the user prompt so the model emphasizes the right metrics.
   ────────────────────────────────────────────────────────────────────────── */

const INDUSTRY_HINTS: Record<IndustryProfile, { financial: string; market: string }> = {
  bank: {
    financial: `INDUSTRY HINT — BANCO: priorizá Net Interest Margin (NIM), eficiencia (efficiency ratio), provisiones para préstamos perdidos (provision for loan losses) y ratio CET1 si están disponibles. Los márgenes brutos/operativos típicos de manufactura no aplican; usá ROE/ROA y NIM como métricas de rentabilidad.`,
    market: `INDUSTRY HINT — BANCO: la valuación se mide en P/Book más que P/E para bancos (P/B 1.0× es paridad con valor contable). ROE >12% suele justificar P/B premium. Mencioná price/tangible book si los datos permiten.`,
  },
  reit: {
    financial: `INDUSTRY HINT — REIT: usá FFO (Funds from Operations) y AFFO (Adjusted FFO) como métricas de cash generation, NOI (Net Operating Income) en lugar de operating income tradicional. Cap rate, LTV (Loan-to-Value) y dividend coverage son críticos.`,
    market: `INDUSTRY HINT — REIT: P/FFO es el múltiplo estándar (no P/E). Dividend yield es central — REITs deben distribuir >=90% de income. Comparar dividend coverage AFFO vs distribución actual.`,
  },
  airline: {
    financial: `INDUSTRY HINT — AEROLÍNEA: priorizá load factor, RASM (Revenue per Available Seat Mile), CASM (Cost per ASM), fuel hedging, y capacity adds. Combustible suele ser 25-30% del costo; cualquier hedge o spike afecta margen directamente.`,
    market: `INDUSTRY HINT — AEROLÍNEA: ciclo muy sensible a combustible y demanda business travel. EV/EBITDAR es relevante (R por leases). Margen operativo del 10%+ es bueno; >15% excepcional.`,
  },
  "oil-gas": {
    financial: `INDUSTRY HINT — PETRÓLEO/GAS: priorizá Free Cash Flow yield, breakeven price (WTI/Brent), reserve replacement ratio, operating netback. Capex elevado es normal en upstream; lo crítico es FCF a precios actuales del crudo.`,
    market: `INDUSTRY HINT — PETRÓLEO/GAS: cyclical play. Múltiplos comprimidos en cima del ciclo (P/E 6-10×) pueden ser trampas de valor; múltiplos expandidos en fondo del ciclo (P/E 20×+) son señal de inflexión. EV/DACF y P/NAV son relevantes.`,
  },
  insurance: {
    financial: `INDUSTRY HINT — SEGUROS: priorizá combined ratio (<100 = underwriting profit), loss ratio, expense ratio, ROE. Reserve development es el riesgo principal. Float (premiums earned no aún pagados como claims) es el motor de retorno.`,
    market: `INDUSTRY HINT — SEGUROS: P/Book es el múltiplo estándar. Berkshire-style ROE >15% justifica premium sobre book.`,
  },
  "asset-manager": {
    financial: `INDUSTRY HINT — GESTOR DE ACTIVOS: priorizá AUM (assets under management), management fee rate (% de AUM), performance fees, compensation ratio (comp/revenue, debería ser <50% para alfa duradero).`,
    market: `INDUSTRY HINT — GESTOR DE ACTIVOS: el revenue depende del AUM, que depende del market beta + flujos netos. Premium a P/E si los flows son consistentemente positivos.`,
  },
  biotech: {
    financial: `INDUSTRY HINT — BIOTECH: pre-revenue común; foco en cash burn rate, runway (cash / quarterly burn), pipeline value. R&D >100% de revenue es esperable en clinical stage.`,
    market: `INDUSTRY HINT — BIOTECH: valuación dirigida por probabilidad ajustada de aprobación regulatoria (PoS-weighted NPV), no múltiplos. Catalizadores son data readouts y FDA decisions con fechas específicas.`,
  },
  "pre-revenue": {
    financial: `INDUSTRY HINT — PRE-REVENUE: no analices márgenes ni FCF yield positivos. Foco: cash position, burn rate, runway, capital plan declarado.`,
    market: `INDUSTRY HINT — PRE-REVENUE: valuación es option value sobre el plan de negocio. P/E no aplica. Comparar contra peers en development stage similar.`,
  },
  holding: {
    financial: `INDUSTRY HINT — HOLDING: el income statement consolidado puede ocultar la calidad de cada subsidiaria. Buscar disclosure por segmento de operating income por subsidiaria.`,
    market: `INDUSTRY HINT — HOLDING: typically trades at conglomerate discount (10-20% under sum-of-parts NAV). El catalizador puede ser disposición de assets o spin-offs.`,
  },
  services: {
    financial: ``,
    market: ``,
  },
  standard: {
    financial: ``,
    market: ``,
  },
};

function industryHint(segmentData: SegmentSankeyData | null | undefined, kind: "financial" | "market"): string {
  const profile = segmentData?.industryProfile;
  if (!profile) return "";
  const hint = INDUSTRY_HINTS[profile]?.[kind];
  return hint ? `\n${hint}\n` : "";
}

function header(d: StockData): string {
  return `Empresa: ${d.companyName} (${d.ticker})
Sector: ${d.sector ?? "N/A"} | Industria: ${d.industry ?? "N/A"}
Fecha: ${new Date().toISOString().split("T")[0]}
`;
}

export function buildBusinessUserPrompt(
  d: StockData,
  segmentData: SegmentSankeyData | null | undefined,
  mdnaSummary?: string | null,
): string {
  const desc = d.description ?? "No description available.";
  const descTrunc = desc.length > 1200 ? desc.slice(0, 1197) + "..." : desc;
  const segmentBlock = fmtSegmentData(segmentData, d.earningsHistory.at(-1)?.quarter ?? null);
  const sankeyQuality = fmtSankeyQuality(segmentData);
  const peersBrief = d.peerComparison?.peers.length
    ? d.peerComparison.peers.map((p) => `${p.symbol} (${p.name})`).join(", ")
    : "N/A";

  const mdnaBlock = mdnaSummary
    ? `\n---\nMD&A DEL ÚLTIMO FILING (resumen del management — fuente narrativa primaria)\n${mdnaSummary}\n`
    : "";

  return `${header(d)}
---
DESCRIPCIÓN DE LA EMPRESA
${descTrunc}
${mdnaBlock}
---
DATOS DE SEGMENTOS Y ESTADO DE RESULTADOS (SEC EDGAR — fuente primaria)
${segmentBlock}
${sankeyQuality ? `\n${sankeyQuality}` : ""}

---
TENDENCIA DE INGRESOS TRIMESTRALES
${fmtQuarterlyRevenueTrend(d)}

---
CRECIMIENTO Y RENTABILIDAD (TTM)
Revenue: ${fmtLargeNum(d.totalRevenue)} | Crec. YoY: ${fmtPct(d.revenueGrowth)} | Margen bruto: ${fmtPct(d.grossMargins)} | Margen operativo: ${fmtPct(d.operatingMargins)}

---
COMPANY UNIVERSE — peers identificados por Yahoo
${peersBrief}

---
Generá las cuatro secciones (businessModel, revenueStreams, competitiveAdvantages, industryContext) siguiendo el esquema JSON definido en las instrucciones del sistema. Si hay MD&A disponible, incorporá esa narrativa del management — es fuente primaria.`;
}

export function buildFinancialsUserPrompt(d: StockData, segmentData: SegmentSankeyData | null | undefined): string {
  const segmentBlock = fmtSegmentData(segmentData, d.earningsHistory.at(-1)?.quarter ?? null);
  const hint = industryHint(segmentData, "financial");
  return `${header(d)}${hint}
---
ESTADO DE RESULTADOS (SEC EDGAR — fuente primaria)
${segmentBlock}

---
FINANCIEROS TTM (Yahoo Finance)
Revenue: ${fmtLargeNum(d.totalRevenue)} | Crec. YoY: ${fmtPct(d.revenueGrowth)} | Earnings growth YoY: ${fmtPct(d.earningsGrowth)}
Márgenes: bruto ${fmtPct(d.grossMargins)} | operativo ${fmtPct(d.operatingMargins)} | neto ${fmtPct(d.profitMargins)} | EBITDA ${fmtPct(d.ebitdaMargins)}
EBITDA: ${fmtLargeNum(d.ebitda)} | FCF: ${fmtLargeNum(d.freeCashflow)} | FCF Operativo: ${fmtLargeNum(d.operatingCashflow)}
ROE: ${fmtPct(d.returnOnEquity)} | ROA: ${fmtPct(d.returnOnAssets)}

---
BALANCE
Deuda total: ${fmtLargeNum(d.totalDebt)} | Caja total: ${fmtLargeNum(d.totalCash)}
Deuda/Patrimonio: ${fmt(d.debtToEquity)} | Ratio corriente: ${fmt(d.currentRatio)} | Quick ratio: ${fmt(d.quickRatio)}

---
DIVIDENDO Y CAPITAL
Dividend yield: ${fmtPct(d.dividendYield)} | Payout ratio: ${fmtPct(d.payoutRatio)} | Ex-dividend: ${d.exDividendDate ?? "N/A"}
Market cap: ${fmtLargeNum(d.marketCap)} | Acciones en circulación: ${fmtLargeNum(d.sharesOutstanding)}

---
HISTORIAL ANUAL DE CASH FLOW (últimos 5 años fiscales)
${fmtAnnualCashFlow(d)}

---
TENDENCIA DE INGRESOS TRIMESTRALES
${fmtQuarterlyRevenueTrend(d)}

---
Generá las cuatro secciones (profitabilityAnalysis, balanceSheetHealth, freeCashFlow, capitalExpenditure) siguiendo el esquema JSON definido en las instrucciones del sistema. NO inventes cifras. Si annualCashFlow está vacío, decilo explícitamente en capitalExpenditure.`;
}

export function buildMarketUserPrompt(d: StockData, segmentData?: SegmentSankeyData | null): string {
  const insidersBlock = fmtInsiderTransactionsClassified(d);
  const hint = industryHint(segmentData, "market");
  return `${header(d)}${hint}
---
PRECIO Y MARKET CAP
Precio actual: ${fmtCurrency(d.currentPrice)} (${fmtPct(d.priceChangePercent)} hoy)
Rango 52 semanas: ${fmtCurrency(d.fiftyTwoWeekLow)} – ${fmtCurrency(d.fiftyTwoWeekHigh)}
Market cap: ${fmtLargeNum(d.marketCap)} | Beta: ${fmt(d.beta)} | Short interest (% float): ${fmtPct(d.shortPercentOfFloat)}

---
MÚLTIPLOS DE VALORACIÓN
P/E Trailing: ${fmt(d.trailingPE)}x | P/E Forward: ${fmt(d.forwardPE)}x | CAPE: ${d.capeRatio != null ? `${d.capeRatio.toFixed(1)}x (${d.capeYears ?? "?"}yr avg EPS)` : "N/A"}
P/S: ${fmt(d.priceToSales)}x | P/B: ${fmt(d.priceToBook)}x | EV/EBITDA: ${fmt(d.enterpriseToEbitda)}x
EPS TTM: ${fmt(d.trailingEps)}

---
CONSENSO Y TARGETS DE ANALISTAS
Recomendación: ${d.recommendationKey?.toUpperCase() ?? "N/A"} | Target medio: ${fmtCurrency(d.targetMeanPrice)} (rango ${fmtCurrency(d.targetLowPrice)} – ${fmtCurrency(d.targetHighPrice)})
Desglose: Strong Buy ${d.analystStrongBuy} | Buy ${d.analystBuy} | Hold ${d.analystHold} | Sell ${d.analystSell} | Strong Sell ${d.analystStrongSell}

---
P/E vs PEERS (con percentile ranking)
${fmtPeerComparisonRich(d)}

---
HISTORIAL DE RESULTADOS (últimos 4 trimestres — más reciente primero)
${fmtEarningsHistory(d)}

---
ESTIMACIONES FORWARD (con tendencia)
${fmtForwardEstimatesRich(d)}

---
PRÓXIMOS RESULTADOS
${PLACEHOLDER_MAP.NEXT_EARNINGS_DATE(d)}

---
ACCIONES RECIENTES DE ANALISTAS (últimas 5)
${fmtAnalystActions(d)}

---
OWNERSHIP
Insiders: ${fmtPct(d.heldPercentInsiders)} | Institucional: ${fmtPct(d.institutionalOwnership)}

---
TRANSACCIONES DE INSIDERS — clasificadas (mecánicas vs discrecionales)
${insidersBlock}

---
NOTICIAS RECIENTES (últimas 7)
${fmtRecentNews(d)}

---
Generá las tres secciones (valuationSnapshot, recentEarnings, managementQuality) siguiendo el esquema JSON definido en las instrucciones del sistema. Para managementQuality, basate en la clasificación de transacciones (mecánicas no son señal; discrecionales sí).`;
}

export function buildForwardUserPrompt(d: StockData, mdnaSummary?: string | null): string {
  const mdnaBlock = mdnaSummary
    ? `\n---\nMD&A DEL ÚLTIMO FILING (riesgos reconocidos y guidance del management)\n${mdnaSummary}\n`
    : "";
  return `${header(d)}${mdnaBlock}
---
NOTICIAS RECIENTES (últimas 7 — categorizá cada una como catalizador/+/riesgo/-/neutral al analizar)
${fmtRecentNews(d)}

---
ACCIONES RECIENTES DE ANALISTAS
${fmtAnalystActions(d)}

---
PRÓXIMOS RESULTADOS
${PLACEHOLDER_MAP.NEXT_EARNINGS_DATE(d)}

---
SHORT INTEREST Y BALANCE (señales de riesgo)
Short interest (% float): ${fmtPct(d.shortPercentOfFloat)}
Deuda total: ${fmtLargeNum(d.totalDebt)} | Caja: ${fmtLargeNum(d.totalCash)} | Deuda/EBITDA aprox: ${d.ebitda && d.ebitda > 0 && d.totalDebt != null ? `${(d.totalDebt / d.ebitda).toFixed(1)}x` : "N/A"}

---
ESTIMACIONES FORWARD (para anclar catalizadores de earnings)
${fmtForwardEstimatesRich(d)}

---
CONTEXTO SECTORIAL
Sector: ${d.sector ?? "N/A"} | Industria: ${d.industry ?? "N/A"}
Crec. Revenue YoY: ${fmtPct(d.revenueGrowth)} | Crec. Earnings YoY: ${fmtPct(d.earningsGrowth)}

---
Generá las dos secciones (riskFactors, catalysts) siguiendo el esquema JSON definido en las instrucciones del sistema. Sé específico a ESTA empresa — no riesgos boilerplate.`;
}

/* ──────────────────────────────────────────────────────────────────────────
   Synthesis user prompt: snapshot cuantitativo + outputs de A-D como contexto.
   ────────────────────────────────────────────────────────────────────────── */

export interface SpecialistContext {
  businessModel: string;
  competitiveAdvantages: string;
  valuationSnapshot: string;
  recentEarnings: string;
  managementQuality: string;
  riskFactors: string;
  catalysts: string;
}

export function buildSynthesisUserPrompt(d: StockData, ctx: SpecialistContext): string {
  // Compute key derived metrics so the model doesn't have to (and can't err on basic math).
  const fcfYield = d.freeCashflow != null && d.marketCap && d.marketCap > 0
    ? (d.freeCashflow / d.marketCap) * 100
    : null;
  const epsGrowthFwd = d.forwardEstimates.find((e) => e.period === "+1y")?.growth ?? null;
  const peg = d.forwardPE != null && epsGrowthFwd != null && epsGrowthFwd > 0
    ? d.forwardPE / (epsGrowthFwd * 100)
    : null;
  const netDebt = d.totalDebt != null && d.totalCash != null ? d.totalDebt - d.totalCash : null;
  const netDebtEbitda = netDebt != null && d.ebitda != null && d.ebitda > 0 ? netDebt / d.ebitda : null;
  const totalAnalysts = d.analystStrongBuy + d.analystBuy + d.analystHold + d.analystSell + d.analystStrongSell;
  const buyCount = d.analystStrongBuy + d.analystBuy;
  const sellCount = d.analystSell + d.analystStrongSell;
  const insiderSum = summarizeInsiderPattern(d.insiderTransactions);

  return `${header(d)}
---
SNAPSHOT CUANTITATIVO (cifras pre-calculadas — usá éstas, no recalculés)

Precio: ${fmtCurrency(d.currentPrice)} | Market cap: ${fmtLargeNum(d.marketCap)}
Forward P/E: ${fmt(d.forwardPE)}x | Trailing P/E: ${fmt(d.trailingPE)}x
FCF TTM: ${fmtLargeNum(d.freeCashflow)} | FCF yield: ${fcfYield != null ? `${fcfYield.toFixed(2)}%` : "N/A"}
EPS growth FY+1: ${epsGrowthFwd != null ? `${(epsGrowthFwd * 100).toFixed(1)}%` : "N/A"} | PEG (fwd P/E ÷ growth FY+1): ${peg != null ? `${peg.toFixed(2)}` : "N/A"}
Deuda total: ${fmtLargeNum(d.totalDebt)} | Caja: ${fmtLargeNum(d.totalCash)} | Deuda neta: ${netDebt != null ? fmtLargeNum(netDebt) : "N/A"}
Deuda neta / EBITDA: ${netDebtEbitda != null ? `${netDebtEbitda.toFixed(2)}x` : "N/A"} | EBITDA: ${fmtLargeNum(d.ebitda)}
Consenso analistas: ${buyCount} buy / ${d.analystHold} hold / ${sellCount} sell (${totalAnalysts} total) — target medio ${fmtCurrency(d.targetMeanPrice)} (rango ${fmtCurrency(d.targetLowPrice)} – ${fmtCurrency(d.targetHighPrice)})
Insider pattern: ${insiderSum.pattern} | Short interest: ${fmtPct(d.shortPercentOfFloat)}

---
CONTEXTO DE ESPECIALISTAS (resúmenes de los análisis previos — usalos para fundamentar el veredicto)

[NEGOCIO · businessModel]
${truncate(ctx.businessModel, 800)}

[NEGOCIO · competitiveAdvantages]
${truncate(ctx.competitiveAdvantages, 600)}

[MERCADO · valuationSnapshot]
${truncate(ctx.valuationSnapshot, 1000)}

[MERCADO · recentEarnings]
${truncate(ctx.recentEarnings, 700)}

[MERCADO · managementQuality]
${truncate(ctx.managementQuality, 600)}

[FORWARD · riskFactors]
${truncate(ctx.riskFactors, 700)}

[FORWARD · catalysts]
${truncate(ctx.catalysts, 700)}

---
Aplicá el framework de decisión y emití scratchpad + verdict + bullCase + bearCase. El scratchpad es OBLIGATORIO y debe evaluar cada cláusula del framework con la cifra concreta del snapshot. El verdict.rating debe ser CONSISTENTE con scratchpad.verdictReasoning.`;
}

function truncate(s: string, max: number): string {
  if (!s) return "(no disponible)";
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}
