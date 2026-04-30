import { NextRequest, NextResponse } from "next/server";
import { AnalyzeRequestSchema } from "@/lib/validators";
import { fetchStockData, fetchPeerComparison } from "@/lib/fetchStockData";
import { fetchSegmentData } from "@/lib/fetchSegmentData";
import { fetchEdgar8KIncomeStatement, type Edgar8KIncomeStatement } from "@/lib/fetchEdgar8K";
import { buildPrompt } from "@/lib/buildPrompt";
import { getOpenAIClient } from "@/lib/openai";
import { cacheGet, cacheSet, cacheClear, SHORT_TTL } from "@/lib/cache";
import { recordTickerView } from "@/lib/tickerStats";
import { checkRateLimit } from "@/lib/rateLimiter";
import type { StructuredReport, SegmentSankeyData } from "@/types/Report";
import type { StockData } from "@/types/StockData";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// Build a minimal SegmentSankeyData from Yahoo Finance TTM margins
function buildFallbackSegmentData(sd: StockData): SegmentSankeyData | null {
  const rev = sd.totalRevenue;
  if (!rev || rev <= 0) return null;

  const gm = sd.grossMargins   ?? 0;
  const om = sd.operatingMargins ?? 0;
  const nm = sd.profitMargins  ?? 0;

  // No margin data at all — nothing meaningful to show
  if (gm <= 0 && om <= 0 && nm <= 0) return null;

  const unit    = rev >= 1e12 ? "T" : rev >= 1e9 ? "B" : "M";
  const divisor = rev >= 1e12 ? 1e12 : rev >= 1e9 ? 1e9 : 1e6;
  const sc = (v: number) => parseFloat((Math.max(0, v) / divisor).toFixed(2));

  const grossProfit      = rev * gm;
  const operatingProfit  = rev * om;   // may be negative — sc() clamps to 0
  const netProfit        = rev * nm;   // may be negative — sc() clamps to 0
  const costOfRevenue    = rev - grossProfit;
  const operatingExpenses = Math.max(0, grossProfit - Math.max(0, operatingProfit));

  return {
    currency: "USD",
    period: "TTM",
    unit,
    segments: [],
    totalRevenue: sc(rev),
    grossProfit: sc(grossProfit),
    grossMarginPct: parseFloat((gm * 100).toFixed(1)),
    costOfRevenue: sc(costOfRevenue),
    operatingProfit: sc(operatingProfit),
    operatingMarginPct: parseFloat((om * 100).toFixed(1)),
    netProfit: sc(netProfit),
    netMarginPct: parseFloat((nm * 100).toFixed(1)),
    operatingExpenses: sc(operatingExpenses),
  };
}

// Yahoo updates earnings within minutes of a press release; SEC EDGAR only
// reflects the quarter once the 10-Q is filed (typically 1–3 days later).
// When Yahoo's most recent quarter end is materially newer than EDGAR's
// period end, the Sankey/income-statement panel is showing a stale quarter.
function isEdgarStale(stockData: StockData, segmentData: SegmentSankeyData | null): boolean {
  if (!segmentData?.endDate) return false;
  const yahooEnd = stockData.latestQuarterIS?.endDate;
  if (!yahooEnd) return false;
  const yahooMs = Date.parse(yahooEnd);
  const edgarMs = Date.parse(segmentData.endDate);
  if (!isFinite(yahooMs) || !isFinite(edgarMs)) return false;
  // 45 days ≈ half a quarter — comfortably past any normal filing lag, so a
  // gap this large means EDGAR is missing the most recent reported quarter.
  return (yahooMs - edgarMs) / 86_400_000 >= 45;
}

// Build a Sankey from a parsed 8-K Exhibit 99.1 income statement. These are
// the actual numbers from the press release table, days before the 10-Q's
// XBRL lands. No segment breakdowns (the table is the consolidated IS), but
// every line item is real data — no TTM-margin estimates.
function buildSankeyFrom8K(s: Edgar8KIncomeStatement, currency: string): SegmentSankeyData | null {
  const rev = s.totalRevenue;
  if (rev <= 0) return null;

  const gp    = s.grossProfit ?? Math.max(0, rev - (s.costOfRevenue ?? 0));
  const opInc = s.operatingIncome ?? 0;
  const ni    = s.netIncome;
  // Always derive opex from gp − op. Some issuers (e.g. ABBV) report
  // "Total operating costs and expenses" that includes COGS, which would
  // double-count if we used it directly for the GP→OpEx Sankey edge.
  const opex  = Math.max(0, gp - Math.max(0, opInc));
  // The op→ni gap is taxes + interest + other non-operating items. Charge
  // it all to the "tax" bucket so the Sankey balances; the label "Taxes"
  // is imperfect when interest/non-op dominate (e.g. ABBV) but the alternative
  // is a dangling op-side height with no outflow.
  const tax   = opInc > 0 && opInc > ni ? Math.max(0, opInc - Math.max(0, ni)) : (s.incomeTaxExpense ?? 0);
  const ibt   = s.incomeBeforeTax ?? Math.max(0, ni + (s.incomeTaxExpense ?? 0));

  const unit    = rev >= 1e12 ? "T" : rev >= 1e9 ? "B" : "M";
  const divisor = rev >= 1e12 ? 1e12 : rev >= 1e9 ? 1e9 : 1e6;
  const sc = (v: number) => parseFloat((Math.max(0, v) / divisor).toFixed(2));
  const pct = (n: number) => parseFloat(((n / rev) * 100).toFixed(1));

  const d  = new Date(s.endDate);
  const qN = Math.floor(d.getUTCMonth() / 3) + 1;
  const yr = d.getUTCFullYear();
  const period = `Q${qN} FY${yr}`;

  const rd  = s.researchDevelopment ?? 0;
  const sga = s.sellingGeneralAdministrative ?? 0;
  const knownOpex = (rd > 0 ? rd : 0) + (sga > 0 ? sga : 0);
  const otherOpex = knownOpex > 0 ? Math.max(0, opex - knownOpex) : 0;
  // Single-step IS issuers (e.g. ADP) include R&D inside Cost of Revenue, not
  // in OpEx — so attributing R&D to the OpEx node would overflow the flow.
  // Only emit the breakdown when the components reconcile to ≤105 % of opex.
  const hasBreakdown = (rd > 0 || sga > 0) && knownOpex <= opex * 1.05;

  const segments = (s.segments ?? [])
    .map((seg) => ({ name: seg.name, value: sc(seg.value) }))
    .filter((seg) => seg.value > 0);

  return {
    currency,
    period,
    endDate: s.endDate,
    unit,
    segments,
    totalRevenue:        sc(rev),
    grossProfit:         sc(gp),
    grossMarginPct:      gp > 0 ? pct(gp) : undefined,
    costOfRevenue:       sc(Math.max(0, rev - gp)),
    operatingProfit:     sc(Math.max(0, opInc)),
    operatingMarginPct:  opInc > 0 ? pct(opInc) : undefined,
    netProfit:           sc(Math.max(0, ni)),
    netMarginPct:        ni > 0 ? pct(ni) : undefined,
    operatingExpenses:   sc(opex),
    opexBreakdown: hasBreakdown ? {
      rd:             rd > 0  ? sc(rd) : undefined,
      salesMarketing: sga > 0 ? sc(sga) : undefined,
      other:          otherOpex > 0 ? sc(otherOpex) : undefined,
    } : undefined,
    tax: sc(Math.max(0, tax)),
    nonOperatingIncome: (() => {
      const nonOp = ibt - Math.max(0, opInc);
      return nonOp > Math.max(0, opInc) * 0.01 ? sc(nonOp) : undefined;
    })(),
  };
}

// Build a Sankey from Yahoo's latest quarterly income statement. Used when
// EDGAR's most recent 10-Q lags behind a reported quarter — segments are
// empty (Yahoo doesn't break revenue down by business line) but headline
// totals match what the chart's bars are showing.
function buildSankeyFromYahooQuarter(sd: StockData): SegmentSankeyData | null {
  const q = sd.latestQuarterIS;
  if (!q || q.totalRevenue <= 0) return null;

  // Need at least one of GP/OpInc/NetInc to render a meaningful Sankey
  // beyond a single revenue node — without that, the chart component drops
  // it for having too few nodes/links and the user sees nothing.
  const hasMeaningfulData =
    (q.grossProfit ?? 0) > 0 ||
    (q.operatingIncome ?? 0) > 0 ||
    (q.netIncome ?? 0) > 0 ||
    (q.costOfRevenue ?? 0) > 0;
  if (!hasMeaningfulData) return null;

  const rev = q.totalRevenue;
  const ni  = q.netIncome ?? 0;

  // Yahoo zeroes out (not nullifies) IS items it doesn't have for a given
  // ticker — e.g. ABBV's Q1 2026 only has rev + ni populated, gp/op/cogs/opex
  // all return 0. Treat 0 as "missing" so we can fall back to TTM-margin
  // estimates applied to the actual quarter revenue. Net income is taken
  // as-is since it's the most consequential headline number.
  const yahooField = (v: number | null | undefined): number | null =>
    typeof v === "number" && v > 0 ? v : null;

  const yahooGp   = yahooField(q.grossProfit);
  const yahooCogs = yahooField(q.costOfRevenue);
  const yahooOp   = yahooField(q.operatingIncome);
  const yahooOpex = yahooField(q.totalOperatingExpenses);
  const yahooTax  = yahooField(q.incomeTaxExpense);

  const tmGm = sd.grossMargins ?? 0;
  const tmOm = sd.operatingMargins ?? 0;

  // Hybrid: actual where Yahoo has it, TTM-margin estimate where Yahoo zeroes
  const gp    = yahooGp ?? (tmGm > 0 ? rev * tmGm : Math.max(0, rev - (yahooCogs ?? 0)));
  const opInc = yahooOp ?? (tmOm > 0 ? rev * tmOm : 0);
  const opex  = yahooOpex ?? Math.max(0, gp - Math.max(0, opInc));

  // The gap between op and ni is taxes + interest + other below-the-line.
  // If Yahoo gave us tax explicitly, use it. Otherwise charge the entire
  // gap to a "Tax & Other" bucket so the Sankey balances visually instead
  // of leaving a dangling op-side height with no outflow.
  const opNiGap = Math.max(0, Math.max(0, opInc) - Math.max(0, ni));
  const tax     = yahooTax ?? opNiGap;
  const ibt     = q.incomeBeforeTax ?? Math.max(0, ni + tax);

  const unit    = rev >= 1e12 ? "T" : rev >= 1e9 ? "B" : "M";
  const divisor = rev >= 1e12 ? 1e12 : rev >= 1e9 ? 1e9 : 1e6;
  const sc = (v: number) => parseFloat((Math.max(0, v) / divisor).toFixed(2));
  const pct = (n: number) => parseFloat(((n / rev) * 100).toFixed(1));

  // Period label — assumes calendar quarter end (Mar/Jun/Sep/Dec). Fiscal-year
  // tagging here may not match the company's fiscal calendar but at least the
  // numbers are correct and the endDate matches the chart's latest bar.
  const d  = new Date(q.endDate);
  const qN = Math.floor(d.getUTCMonth() / 3) + 1;
  const yr = d.getUTCFullYear();
  // Annotate when any of the breakdown items came from TTM-margin estimates
  // rather than direct Yahoo fields, so the label reflects the data quality.
  const usedEstimates = !yahooGp || !yahooOp || !yahooTax;
  const period = `Q${qN} FY${yr}${usedEstimates ? " · pendiente 10-Q" : ""}`;

  const rd = q.researchDevelopment ?? 0;
  const sga = q.sellingGeneralAdministrative ?? 0;
  const knownOpex = (rd > 0 ? rd : 0) + (sga > 0 ? sga : 0);
  const otherOpex = knownOpex > 0 ? Math.max(0, opex - knownOpex) : 0;
  const hasBreakdown = rd > 0 || sga > 0;

  return {
    currency: sd.currency ?? "USD",
    period,
    endDate: q.endDate,
    unit,
    segments: [],
    totalRevenue: sc(rev),
    grossProfit: sc(gp),
    grossMarginPct: gp > 0 ? pct(gp) : undefined,
    costOfRevenue: sc(Math.max(0, rev - gp)),
    operatingProfit: sc(Math.max(0, opInc)),
    operatingMarginPct: opInc > 0 ? pct(opInc) : undefined,
    netProfit: sc(Math.max(0, ni)),
    netMarginPct: ni > 0 ? pct(ni) : undefined,
    operatingExpenses: sc(opex),
    opexBreakdown: hasBreakdown ? {
      rd:             rd > 0  ? sc(rd) : undefined,
      salesMarketing: sga > 0 ? sc(sga) : undefined,
      other:          otherOpex > 0 ? sc(otherOpex) : undefined,
    } : undefined,
    tax: sc(Math.max(0, tax)),
    nonOperatingIncome: (() => {
      const nonOp = ibt - Math.max(0, opInc);
      return nonOp > Math.max(0, opInc) * 0.01 ? sc(nonOp) : undefined;
    })(),
  };
}

// Convert a field value to a readable string if GPT-4o returns an object instead of prose
function serializeField(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);

  // Format known moat object shape: { poderDeFijacionDePrecios, fuerzaDeMarca, costosDeCambio, efectosDeRed, conclusion }
  const obj = value as Record<string, unknown>;
  const labelMap: Record<string, string> = {
    poderDeFijacionDePrecios: "Poder de fijación de precios",
    fuerzaDeMarca: "Fuerza de marca",
    costosDeCambio: "Costos de cambio",
    efectosDeRed: "Efectos de red",
    pricingPower: "Poder de fijación de precios",
    brandStrength: "Fuerza de marca",
    switchingCosts: "Costos de cambio",
    networkEffects: "Efectos de red",
  };

  const parts: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key === "conclusion" || key === "overall" || key === "compositeScore") continue;
    const label = labelMap[key] ?? key;
    parts.push(`${label}: ${val}/10`);
  }

  const conclusion = obj.conclusion ?? obj.overall ?? obj.compositeScore;
  if (conclusion) parts.push(String(conclusion));

  return parts.join(". ") || JSON.stringify(obj);
}

export async function POST(req: NextRequest) {
  // 0. Rate limiting
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    return new Response("Demasiadas solicitudes. Intente nuevamente más tarde.", {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    });
  }

  // 1. Parse + validate
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AnalyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { ticker, refresh } = parsed.data;

  // 2. Cache check
  if (!refresh) {
    const cached = await cacheGet(ticker);
    if (cached) {
      // If EDGAR data was already stale relative to Yahoo when this was
      // cached, treat as a miss so we re-fetch — the 10-Q may now be filed.
      if (isEdgarStale(cached.stockData, cached.report.segmentData ?? null)) {
        await cacheClear(ticker);
      } else {
        void recordTickerView(ticker).catch(() => {});
        return NextResponse.json({ report: cached.report, stockData: cached.stockData, cached: true });
      }
    }
  } else {
    await cacheClear(ticker);
  }

  // 3. Fetch financial data
  let stockData;
  let segmentData;
  try {
    let peerComparison;
    let edgar8K: Edgar8KIncomeStatement | null;
    [stockData, segmentData, peerComparison, edgar8K] = await Promise.all([
      fetchStockData(ticker),
      fetchSegmentData(ticker),
      fetchPeerComparison(ticker),
      fetchEdgar8KIncomeStatement(ticker),
    ]);
    stockData.peerComparison = peerComparison;

    // If EDGAR's latest 10-Q lags behind the press-released quarter, override
    // the Sankey so it matches the chart's latest bar. Source priority:
    //   1. 8-K Exhibit 99.1 parse — actual press-release numbers, no estimates
    //   2. Yahoo + TTM-margin estimates — partial actuals + interpolation
    //   3. Leave EDGAR Sankey as-is — older period but real and complete
    if (isEdgarStale(stockData, segmentData)) {
      let override: SegmentSankeyData | null = null;
      if (edgar8K) {
        const segEnd = segmentData?.endDate ?? "";
        if (!segEnd || edgar8K.endDate > segEnd) {
          override = buildSankeyFrom8K(edgar8K, stockData.currency ?? "USD");
        }
      }
      if (!override) override = buildSankeyFromYahooQuarter(stockData);
      if (override) segmentData = override;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("no está listado")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message.toLowerCase().includes("not found") || message.toLowerCase().includes("no data")) {
      return NextResponse.json({ error: `Ticker "${ticker}" not found.` }, { status: 404 });
    }
    return NextResponse.json(
      { error: `Failed to fetch data for ${ticker}. Yahoo Finance may be temporarily unavailable.` },
      { status: 502 }
    );
  }

  // 4. Mock mode — skip OpenAI, return stub report with real segment data
  if (process.env.MOCK_REPORT === "true") {
    const stub: StructuredReport = {
      businessModel: "Mock mode activo — análisis de OpenAI deshabilitado.",
      revenueStreams: "", profitabilityAnalysis: "", balanceSheetHealth: "",
      freeCashFlow: "", capitalExpenditure: "", competitiveAdvantages: "", managementQuality: "",
      valuationSnapshot: "", recentEarnings: "", riskFactors: "",
      catalysts: "", industryContext: "",
      verdict: { rating: "HOLD", conviction: "LOW", rationale: "Mock mode — sin análisis real." },
      bullCase: { narrative: "", priceTarget: "—" },
      bearCase: { narrative: "", priceTarget: "—" },
      segmentData: segmentData ?? buildFallbackSegmentData(stockData),
    };
    const stubTtl = isEdgarStale(stockData, stub.segmentData ?? null) ? SHORT_TTL : undefined;
    cacheSet(ticker, stub, stockData, stubTtl);
    void recordTickerView(ticker).catch(() => {});
    return NextResponse.json({ report: stub, stockData, cached: false });
  }

  // 5. Build prompt
  const { systemPrompt, userPrompt } = buildPrompt(stockData, segmentData);

  // 5. Call GPT-4o with streaming
  let fullText = "";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send stock data immediately — lets the UI render the header and metrics
        // while GPT-4o is still generating the analysis narrative.
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ stockData })}\n\n`)
        );

        const completion = await getOpenAIClient().chat.completions.create({
          model: "gpt-4o-2024-11-20",
          response_format: { type: "json_object" },
          stream: true,
          temperature: 0,
          max_tokens: 4500,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            fullText += delta;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
          }
        }

        // 6. Parse + sanitize + cache after stream ends
        let report: StructuredReport;
        try {
          const raw = JSON.parse(fullText) as Record<string, unknown>;
          // Ensure all narrative fields are strings — GPT-4o occasionally returns nested objects
          const stringFields: (keyof StructuredReport)[] = [
            "businessModel", "revenueStreams", "profitabilityAnalysis",
            "balanceSheetHealth", "freeCashFlow", "capitalExpenditure",
            "competitiveAdvantages", "managementQuality", "valuationSnapshot",
            "recentEarnings", "riskFactors", "catalysts", "industryContext",
          ];
          // segmentData is a structured object — leave it as-is
          for (const field of stringFields) {
            if (typeof raw[field] !== "string") {
              raw[field] = serializeField(raw[field]);
            }
          }
          report = raw as unknown as StructuredReport;
          // Use EDGAR segment data; fall back to Yahoo Finance TTM margins
          report.segmentData = segmentData ?? buildFallbackSegmentData(stockData);
        } catch {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "Failed to parse analysis output." })}\n\n`)
          );
          controller.close();
          return;
        }

        const ttl = isEdgarStale(stockData, report.segmentData ?? null) ? SHORT_TTL : undefined;
        await cacheSet(ticker, report, stockData, ttl);
        void recordTickerView(ticker).catch(() => {});

        // Send final payload: full structured report + stockData for UI components
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, report, stockData })}\n\n`
          )
        );
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
