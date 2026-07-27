// Analistas point-in-time para el backtest — acciones, consenso y (con key)
// beats/misses históricos.
//
// FUENTES (probadas 2026-07-19):
//   1. Yahoo upgradeDowngradeHistory: historial de upgrades/downgrades con
//      fecha exacta hasta ~2012 (JPM 440 acciones, DAL 346, ULCC 108). Es la
//      MISMA fuente de analystActions de producción → filtrar por fecha ≤
//      corte da las acciones as-of sin aproximación.
//   2. CONSENSO SINTÉTICO: el último grade POR FIRMA dentro de una ventana de
//      18 meses ≤ corte, mapeado a buy/hold/sell y contado. Aproximación
//      declarada (sólo firmas presentes en el feed; ratings viejos pesan igual
//      que frescos) pero con fechas exactas — desbloquea la condición (b) del
//      framework y por lo tanto buyConfirmed/BUY·HIGH en backtest.
//   3. Finnhub (opcional, FINNHUB_API_KEY en .env.local): consenso "oficial"
//      mensual con años de historia (/stock/recommendation) — cuando la key
//      está presente PISA al sintético; y earnings surprises (/stock/earnings)
//      para el HISTORIAL DE RESULTADOS as-of. Sin key, todo degrada limpio.

import { yahooFinance } from "@/lib/fetchStockData";
import type { AnalystAction, EarningsQuarter } from "@/types/StockData";

interface GradeEvent {
  date: string;      // YYYY-MM-DD
  firm: string;
  action: string;    // up | down | init | main | reit (valores de Yahoo)
  fromGrade: string;
  toGrade: string;
}

const CONSENSUS_WINDOW_DAYS = 548; // 18 meses: un rating más viejo ya no es "cobertura viva"

function toIso(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n < 1e12 ? n * 1000 : n).toISOString().slice(0, 10);
}

// Historial completo — se fetchea UNA vez por ticker y sirve a todos los cortes.
export async function fetchGradeHistory(ticker: string): Promise<GradeEvent[]> {
  try {
    const q = (await yahooFinance.quoteSummary(
      ticker,
      { modules: ["upgradeDowngradeHistory"] },
      { validateResult: false },
    )) as Record<string, unknown>;
    const raw = ((q.upgradeDowngradeHistory as { history?: Array<Record<string, unknown>> })?.history ?? []);
    const out: GradeEvent[] = [];
    for (const h of raw) {
      const date = toIso(h.epochGradeDate);
      if (!date) continue;
      out.push({
        date,
        firm: String(h.firm ?? "").trim() || "—",
        action: String(h.action ?? "").trim(),
        fromGrade: String(h.fromGrade ?? "").trim() || "—",
        toGrade: String(h.toGrade ?? "").trim(),
      });
    }
    out.sort((a, b) => b.date.localeCompare(a.date));
    return out;
  } catch {
    return [];
  }
}

export function analystActionsAsOf(history: GradeEvent[], cutoff: string): AnalystAction[] {
  return history
    .filter((h) => h.date <= cutoff)
    .slice(0, 5)
    .map((h) => ({ date: h.date, firm: h.firm, action: h.action, fromGrade: h.fromGrade, toGrade: h.toGrade }));
}

// Buckets de grades — la taxonomía usual del sell-side. Grades no reconocidos
// no cuentan (mejor perder un voto que clasificarlo mal).
function gradeBucket(grade: string): "buy" | "hold" | "sell" | null {
  const g = grade.toLowerCase();
  if (!g) return null;
  if (/(strong buy|conviction buy|top pick)/.test(g)) return "buy";
  if (/(buy|overweight|outperform|accumulate|add|positive|long-term buy|market outperform|sector outperform)/.test(g)) return "buy";
  if (/(underweight|underperform|sell|reduce|negative|sector underperform)/.test(g)) return "sell";
  if (/(hold|neutral|equal[- ]weight|market perform|in[- ]line|sector perform|peer perform|perform|mixed|fair value)/.test(g)) return "hold";
  return null;
}

export interface SyntheticConsensus {
  analystStrongBuy: number;
  analystBuy: number;
  analystHold: number;
  analystSell: number;
  analystStrongSell: number;
  firms: number;
}

// Último grade por firma dentro de la ventana ≤ corte → counts. strongBuy/
// strongSell se separan sólo cuando el texto lo dice; el resto va a buy/sell
// planos (classifyConsensus suma strong+plain, así que la partición no pesa).
export function syntheticConsensusAsOf(history: GradeEvent[], cutoff: string): SyntheticConsensus | null {
  const from = new Date(Date.parse(cutoff) - CONSENSUS_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  const latestByFirm = new Map<string, GradeEvent>();
  for (const h of history) {
    if (h.date > cutoff || h.date < from) continue;
    const key = h.firm.toLowerCase();
    const prev = latestByFirm.get(key);
    if (!prev || h.date > prev.date) latestByFirm.set(key, h);
  }
  let strongBuy = 0, buy = 0, hold = 0, sell = 0, strongSell = 0;
  for (const h of latestByFirm.values()) {
    const b = gradeBucket(h.toGrade);
    if (b === "buy") {
      if (/strong buy|conviction buy/i.test(h.toGrade)) strongBuy++;
      else buy++;
    } else if (b === "hold") hold++;
    else if (b === "sell") {
      if (/strong sell/i.test(h.toGrade)) strongSell++;
      else sell++;
    }
  }
  const firms = strongBuy + buy + hold + sell + strongSell;
  // Con menos de 3 firmas el "consenso" es ruido — N/D honesto.
  if (firms < 3) return null;
  return { analystStrongBuy: strongBuy, analystBuy: buy, analystHold: hold, analystSell: sell, analystStrongSell: strongSell, firms };
}

/* ── Finnhub (opcional, gated por FINNHUB_API_KEY) ────────────────────────── */

const FINNHUB = "https://finnhub.io/api/v1";

function finnhubKey(): string | null {
  const k = process.env.FINNHUB_API_KEY?.trim();
  return k ? k : null;
}

// Consenso oficial mensual ≤ corte. La fila de período "YYYY-MM-01" refleja el
// consenso vigente durante ese mes → usable en cualquier corte de ese mes o
// posterior. Null sin key, sin datos o ante cualquier error (cae al sintético).
export async function finnhubConsensusAsOf(symbol: string, cutoff: string): Promise<SyntheticConsensus | null> {
  const key = finnhubKey();
  if (!key) return null;
  try {
    const r = await fetch(`${FINNHUB}/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${key}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return null;
    const rows = (await r.json()) as Array<{
      period?: string; strongBuy?: number; buy?: number; hold?: number; sell?: number; strongSell?: number;
    }>;
    if (!Array.isArray(rows)) return null;
    const eligible = rows
      .filter((x) => typeof x.period === "string" && x.period <= cutoff)
      .sort((a, b) => (b.period as string).localeCompare(a.period as string));
    const top = eligible[0];
    if (!top) return null;
    const n = (v: number | undefined) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
    const c: SyntheticConsensus = {
      analystStrongBuy: n(top.strongBuy),
      analystBuy: n(top.buy),
      analystHold: n(top.hold),
      analystSell: n(top.sell),
      analystStrongSell: n(top.strongSell),
      firms: n(top.strongBuy) + n(top.buy) + n(top.hold) + n(top.sell) + n(top.strongSell),
    };
    return c.firms >= 3 ? c : null;
  } catch {
    return null;
  }
}

// Historial de beats/misses: trimestres con fecha de REPORTE ≤ corte (anti-
// fuga por publicación). Finnhub free devuelve varios años con limit.
export async function finnhubEarningsAsOf(symbol: string, cutoff: string): Promise<EarningsQuarter[]> {
  const key = finnhubKey();
  if (!key) return [];
  try {
    const r = await fetch(`${FINNHUB}/stock/earnings?symbol=${encodeURIComponent(symbol)}&limit=20&token=${key}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return [];
    const rows = (await r.json()) as Array<{
      period?: string; actual?: number | null; estimate?: number | null; surprisePercent?: number | null;
    }>;
    if (!Array.isArray(rows)) return [];
    // Finnhub trae period = cierre del trimestre, sin fecha de reporte: se
    // asume publicado ~45 días después del cierre (frontera conservadora,
    // misma regla que los fundamentals sin filing matcheado).
    const out: EarningsQuarter[] = [];
    for (const x of rows) {
      if (typeof x.period !== "string") continue;
      const publishedBy = new Date(Date.parse(x.period) + 45 * 86400000).toISOString().slice(0, 10);
      if (publishedBy > cutoff) continue;
      out.push({
        quarter: x.period,
        epsActual: typeof x.actual === "number" ? x.actual : null,
        epsEstimate: typeof x.estimate === "number" ? x.estimate : null,
        surprisePct: typeof x.surprisePercent === "number" ? x.surprisePercent : null,
      });
    }
    // Orden ascendente (el más reciente AL FINAL): buildPrompt usa
    // earningsHistory.at(-1) como "último trimestre reportado" para el aviso
    // de frescura del Sankey — invertirlo dispararía avisos falsos.
    out.sort((a, b) => a.quarter.localeCompare(b.quarter));
    return out.slice(-4);
  } catch {
    return [];
  }
}
