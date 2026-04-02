import { NextRequest, NextResponse } from "next/server";
import { AnalyzeRequestSchema } from "@/lib/validators";
import { fetchStockData, fetchPeerComparison } from "@/lib/fetchStockData";
import { fetchSegmentData } from "@/lib/fetchSegmentData";
import { buildPrompt } from "@/lib/buildPrompt";
import { getOpenAIClient } from "@/lib/openai";
import { cacheGet, cacheSet, cacheClear } from "@/lib/cache";
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
      return NextResponse.json({ report: cached.report, stockData: cached.stockData, cached: true });
    }
  } else {
    await cacheClear(ticker);
  }

  // 3. Fetch financial data
  let stockData;
  let segmentData;
  try {
    let peerComparison;
    [stockData, segmentData, peerComparison] = await Promise.all([
      fetchStockData(ticker),
      fetchSegmentData(ticker),
      fetchPeerComparison(ticker),
    ]);
    stockData.peerComparison = peerComparison;
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
    cacheSet(ticker, stub, stockData);
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

        await cacheSet(ticker, report, stockData);

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
