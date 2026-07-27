import type { StockData } from "@/types/StockData";
import type { SegmentSankeyData, IndustryProfile, VerdictRating, VerdictConviction } from "@/types/Report";
import type { TechnicalContext } from "@/lib/technicalContext";
import { summarizeInsiderPattern } from "@/lib/insiders";

/* ──────────────────────────────────────────────────────────────────────────
   Derived valuation metrics + rating framework, computed in code.

   WHY: the system prompt used to ask GPT-4o to compute PEG, FCF yield, net
   debt/EBITDA and the house price target *itself*, and to self-apply the
   BUY/HOLD/AVOID framework. That put the load-bearing arithmetic of the whole
   report inside an LLM with no verification — a hallucinated FCF yield or a
   slipped multiplication flowed straight into the verdict, and the only
   backstop was clampReportPriceTargets snapping the *number* to the right side
   of the price (masking the symptom, not fixing the cause).

   This module computes those figures deterministically and pre-evaluates every
   condition of the rating framework to met / not_met / na. The result is:
   - injected into the prompt as an AUTHORITATIVE block (fmtDerivedMetrics), so
     the model reads the numbers instead of recomputing them, and
   - used post-response (checkVerdictCoherence) to catch a rating that
     contradicts the numbers it was handed.

   Every metric is null-safe: when an input is missing the condition is `na`
   (indeterminate) and never blocks a rating — sparse data is legitimate.
   ────────────────────────────────────────────────────────────────────────── */

export type Cond = "met" | "not_met" | "na";

// Industries where the "net debt / EBITDA" leverage gate does not apply:
// banks/insurers have no meaningful EBITDA, REITs carry structurally high
// debt/EBITDA by design (property leverage), asset managers are capital-light.
const LEVERAGE_EXEMPT: ReadonlyArray<IndustryProfile> = ["bank", "insurance", "asset-manager", "reit"];
const FINANCIAL_PROFILES: ReadonlyArray<IndustryProfile> = ["bank", "insurance", "asset-manager"];

// Perfil inferido de los strings sector/industria de Yahoo cuando EDGAR no
// trajo industryProfile (segmentos caídos, ticker extranjero sin filings
// procesables). Sin este fallback, un banco sin EDGAR se evaluaba como empresa
// estándar: gate de valuación por FCF yield (ruido de balance) y leverage por
// deuda/EBITDA (sin sentido para bancos) — el backtest 2026-07-19 mostró 20/82
// veredictos ciegos por esta vía. Matching por substring conservador sobre la
// taxonomía de Yahoo ("Banks - Diversified", "Insurance - Life", "REIT -
// Specialty", ...). "Credit Services" (V/MA) no matchea a propósito: son
// procesadores de pagos, no bancos.
export function inferProfileFromYahoo(industry: string | null): IndustryProfile | null {
  const ind = (industry ?? "").toLowerCase();
  if (ind.includes("bank")) return "bank";
  if (ind.includes("insurance")) return "insurance";
  if (ind.includes("asset management")) return "asset-manager";
  if (ind.includes("reit")) return "reit";
  if (ind.includes("airline")) return "airline";
  if (ind.includes("oil & gas")) return "oil-gas";
  if (ind.includes("biotechnology")) return "biotech";
  return null;
}

export interface RatingConditions {
  // BUY requires (a) AND (b) AND (c)
  buyValuation: Cond;      // (a) valuación atractiva — fórmula según perfil (ver buyValuationBasis)
  buyConsensus: Cond;      // (b) analyst consensus buy / strong buy
  buyBalance: Cond;        // (c) no critical balance risk (net debt ≤3x EBITDA)
  // AVOID triggers if ANY of (a) (b) (c)
  avoidValuation: Cond;    // (a) fwd P/E >40x without projected EPS growth >30%
  avoidBalance: Cond;      // (b) net debt >3x EBITDA (non-financials)
  avoidInsiderShort: Cond; // (c) net discretionary insider selling AND short >10%
  // Rollups (only true when determinate — `na` never counts toward either)
  buyConfirmed: boolean;   // all three BUY conditions met
  avoidTriggered: boolean; // at least one AVOID condition met
  // Valuación barata + balance sano/exento pero consenso AUSENTE por falta de
  // cobertura (no por rating negativo): tesis BUY·MEDIUM, no HOLD. Rollup propio
  // porque no es buyConfirmed (le falta el consenso) y el modelo trataba el "no
  // confirmado" como HOLD, dejando +40% en ADRs bancarios poco cubiertos.
  buyConfirmedNoCoverage: boolean;
}

export interface DerivedMetrics {
  // Valuation
  fcfYield: number | null;          // fraction (FCF / market cap)
  // Con qué métricas se evaluó la condición (a) de BUY — perfil financiero
  // (P/B+ROE / P/E / PEG), estándar (FCF/PEG) o fallback (P/E / EV/EBITDA).
  // Se muestra en el prompt y se persiste en verdict_log para calibración.
  buyValuationBasis: string | null;
  // true = el CUMPLE de valuación descansa sólo en el PEG (promesa de
  // crecimiento) sin caja real ni libro barato — cap de conviction en BUY.
  buyValuationSpeculative: boolean;
  peg: number | null;               // fwd P/E ÷ growth%
  pegGrowthPct: number | null;      // growth used for PEG, in percent points
  pegGrowthSource: string | null;
  growthIsForward: boolean;         // true when growth came from forward estimates (not TTM fallback)
  netDebt: number | null;           // total debt − total cash
  netDebtToEbitda: number | null;   // null when leverage gate doesn't apply or EBITDA missing
  leverageApplies: boolean;
  isFinancial: boolean;
  epsFwd0: number | null;           // consensus EPS estimate for current fiscal year (0y)
  epsFwd1: number | null;           // consensus EPS estimate for next fiscal year (+1y)
  baseTargetForwardPE: number | null; // ancla del price target (ver baseTargetMethod)
  // 'constant_multiple' = precio × (EPS FY+1 ÷ EPS FY0): proyección a múltiplo
  // constante, transparente y nunca circular. 'fwdpe_x_eps' = fwd P/E Yahoo ×
  // EPS FY+1 (fallback sin FY0): colapsa a ≡ precio actual cuando el
  // denominador del fwd P/E de Yahoo ES la estimación +1y (caso KO 81.56).
  baseTargetMethod: "constant_multiple" | "fwdpe_x_eps" | null;
  baseTargetUpsidePct: number | null; // vs current price
  forwardPE: number | null;
  fwdEpsGrowthPct: number | null;   // forward-sourced projected growth (null if only TTM), for avoidValuation
  // Sentiment inputs to the framework
  consensus: "buy" | "hold" | "sell" | null;
  insiderPattern: string;
  insiderNetSeller: boolean;
  shortPct: number | null;          // in percent points
  // Momentum de revisiones del consenso (FY0+FY1, 30d): true cuando las bajas
  // superan 1.5× a las subas. Señal adelantada de misses; un BUY especulativo
  // (PEG) con revisiones a la baja es la trampa de valor clásica (NVO).
  revisionsNetDown: boolean;
  // Framework
  conditions: RatingConditions;
  industryProfile: IndustryProfile | null;
}

function classifyConsensus(d: StockData): "buy" | "hold" | "sell" | null {
  const key = d.recommendationKey?.toLowerCase();
  if (key) {
    if (key === "strong_buy" || key === "buy") return "buy";
    if (key === "hold" || key === "neutral") return "hold";
    if (key === "underperform" || key === "sell" || key === "strong_sell" || key === "underweight") return "sell";
  }
  // Fall back to the analyst count breakdown when recommendationKey is absent.
  const buy = d.analystStrongBuy + d.analystBuy;
  const hold = d.analystHold;
  const sell = d.analystSell + d.analystStrongSell;
  const total = buy + hold + sell;
  if (total === 0) return null;
  if (buy > hold && buy > sell) return "buy";
  if (sell > buy && sell > hold) return "sell";
  return "hold";
}

export interface DerivedMetricsOpts {
  // false = la serie de precios cubre MENOS de un año (post-IPO o relisting
  // post-reestructuración). El gate de deuda/EBITDA no opina: un balance
  // recién recapitalizado dispara el trigger como si fuera deterioro en curso
  // (LTM@ene-2025: AVOID mecánico a +107% vs SPY — la única fila del backtest
  // con serie corta; el MISMO trigger acertó un año después, ya sazonado).
  seasonedListing?: boolean;
}

export function computeDerivedMetrics(
  d: StockData,
  seg?: SegmentSankeyData | null,
  opts?: DerivedMetricsOpts,
): DerivedMetrics {
  const seasoned = opts?.seasonedListing !== false;
  // Perfil efectivo: EDGAR manda; sin EDGAR, se infiere de la industria Yahoo.
  // Así el framework sectorial (gate de valuación financiera, exención de
  // leverage, industry hint) no depende de que los segmentos SEC funcionen.
  const profile = seg?.industryProfile ?? inferProfileFromYahoo(d.industry);
  const isFinancial = profile != null && FINANCIAL_PROFILES.includes(profile);
  const leverageApplies = !(profile != null && LEVERAGE_EXEMPT.includes(profile));

  // FCF yield = FCF / market cap
  const fcfYield =
    d.freeCashflow != null && d.marketCap != null && d.marketCap > 0
      ? d.freeCashflow / d.marketCap
      : null;

  // Forward EPS growth for PEG. Preference order:
  //   1. forwardEstimates "+1y".growth  (Yahoo's projected next-FY growth)
  //   2. derived from the 0y → +1y EPS estimates
  //   3. TTM earningsGrowth  (backward-looking fallback — flagged not-forward)
  const fy1 = d.forwardEstimates.find((e) => e.period === "+1y");
  const fy0 = d.forwardEstimates.find((e) => e.period === "0y");
  let pegGrowthPct: number | null = null;
  let pegGrowthSource: string | null = null;
  let growthIsForward = false;
  if (fy1?.growth != null && Number.isFinite(fy1.growth)) {
    pegGrowthPct = fy1.growth * 100;
    pegGrowthSource = "estimación forward +1y";
    growthIsForward = true;
  } else if (
    fy1?.epsEstimate != null &&
    fy0?.epsEstimate != null &&
    fy0.epsEstimate > 0 &&
    fy1.epsEstimate > 0
  ) {
    pegGrowthPct = ((fy1.epsEstimate - fy0.epsEstimate) / fy0.epsEstimate) * 100;
    pegGrowthSource = "derivado de EPS FY0→FY+1";
    growthIsForward = true;
  } else if (d.earningsGrowth != null && Number.isFinite(d.earningsGrowth)) {
    pegGrowthPct = d.earningsGrowth * 100;
    pegGrowthSource = "crecimiento TTM (fallback, no forward)";
    growthIsForward = false;
  }

  // PEG only meaningful with a positive forward P/E and positive growth — and
  // growth ≤100%: un crecimiento de triple dígito es rebote desde base
  // deprimida (aerolínea saliendo de pérdidas), no crecimiento sostenible, y
  // produce PEGs absurdos (ULCC 0.02x en el backtest) que marcan "valuación
  // atractiva" en nombres quebrados. Textbook: PEG no aplica a turnarounds.
  const peg =
    d.forwardPE != null && d.forwardPE > 0 && pegGrowthPct != null && pegGrowthPct > 0 && pegGrowthPct <= 100
      ? d.forwardPE / pegGrowthPct
      : null;

  // Projected growth used for the AVOID "excessive valuation" gate — only trust
  // a forward-sourced number here; a TTM proxy must not force an AVOID trigger.
  const fwdEpsGrowthPct = growthIsForward ? pegGrowthPct : null;

  const netDebt = d.totalDebt != null && d.totalCash != null ? d.totalDebt - d.totalCash : null;
  const netDebtToEbitda =
    leverageApplies && netDebt != null && d.ebitda != null && d.ebitda > 0
      ? netDebt / d.ebitda
      : null;

  const epsFwd1 = fy1?.epsEstimate ?? null;
  const epsFwd0 = fy0?.epsEstimate ?? null;
  // Target base. Preferencia: precio × (EPS FY+1 ÷ EPS FY0) — proyección a
  // múltiplo constante sobre el crecimiento de EPS del consenso. La forma
  // anterior (fwd P/E de Yahoo × EPS FY+1) es circular cuando el denominador
  // del fwd P/E de Yahoo ES la estimación +1y: target ≡ precio actual al
  // centavo (detectado con KO 81.56 → 81.56). Queda como fallback sin FY0.
  let baseTargetForwardPE: number | null = null;
  let baseTargetMethod: DerivedMetrics["baseTargetMethod"] = null;
  if (
    d.currentPrice != null && d.currentPrice > 0 &&
    epsFwd0 != null && epsFwd0 > 0 &&
    epsFwd1 != null && epsFwd1 > 0
  ) {
    baseTargetForwardPE = d.currentPrice * (epsFwd1 / epsFwd0);
    baseTargetMethod = "constant_multiple";
  } else if (d.forwardPE != null && d.forwardPE > 0 && epsFwd1 != null && epsFwd1 > 0) {
    baseTargetForwardPE = d.forwardPE * epsFwd1;
    baseTargetMethod = "fwdpe_x_eps";
  }
  const baseTargetUpsidePct =
    baseTargetForwardPE != null && d.currentPrice != null && d.currentPrice > 0
      ? (baseTargetForwardPE / d.currentPrice - 1) * 100
      : null;

  const consensus = classifyConsensus(d);
  const insiderSum = summarizeInsiderPattern(d.insiderTransactions);
  const insiderNetSeller = insiderSum.pattern === "vendedor neto discrecional";
  const shortPct = d.shortPercentOfFloat != null ? d.shortPercentOfFloat * 100 : null;

  // Momentum de revisiones (FY0+FY1, últimos 30d): net a la baja cuando las
  // bajas superan 1.5× a las subas (mismo umbral que fmtForwardEstimatesRich en
  // el prompt). Alimenta el cap de conviction para BUY especulativos.
  const fyRev = d.forwardEstimates.filter((e) => e.period === "0y" || e.period === "+1y");
  const revUp = fyRev.reduce((a, e) => a + (e.revisionsUp30d ?? 0), 0);
  const revDown = fyRev.reduce((a, e) => a + (e.revisionsDown30d ?? 0), 0);
  const revisionsNetDown = revDown > 0 && revDown > revUp * 1.5;

  // ── Framework conditions ────────────────────────────────────────────────
  // BUY (a): valuación atractiva — SECTORIAL. Backtest 2026-07-19: este gate
  // gobierna el BUY de facto (12/12 BUYs con la condición en CUMPLE; 1 vs 11
  // BUYs entre cortes según pura disponibilidad del dato). Dos fixes:
  //   1. FINANCIERAS: el FCF de un banco/aseguradora es ruido de balance
  //      (préstamos, depósitos, trading) — JPM FY2024 FCF −$42B producía un
  //      "NO CUMPLE" espurio, y el único BUY bancario del backtest (HDB, met
  //      por ese ruido) fue el peor del estudio (−48.8% vs SPY). El gate
  //      financiero se evalúa con P/B+ROE, P/E trailing o PEG — nunca FCF.
  //   2. FALLBACKS: sin FCF ni PEG el modelo trataba el N/D como bloqueo
  //      (starving del BUY). Antes de rendirse a `na` se intenta earnings
  //      yield (P/E trailing) y EV/EBITDA; la zona intermedia sin dato de
  //      crecimiento queda `na` honestamente.
  let buyValuation: Cond;
  let buyValuationBasis: string | null = null;
  // "Especulativa" = el CUMPLE de valuación descansa SÓLO en estimaciones de
  // crecimiento (PEG), sin caja real (FCF ≥4%) ni libro/earnings baratos.
  // Backtest 2026-07-19: los BUY con FCF real ≥4% acertaron 88% a 12 meses;
  // los "baratos sólo por PEG", 40% — ahí viven NVO, MET, AMT, UAL.
  let buyValuationSpeculative = false;
  if (isFinancial) {
    const pb = d.priceToBook != null && d.priceToBook > 0 ? d.priceToBook : null;
    const roe = d.returnOnEquity; // fraction
    const pe = d.trailingPE != null && d.trailingPE > 0 ? d.trailingPE : null;
    const pbCheap = pb != null && (pb < 1.0 || (pb < 1.5 && roe != null && roe > 0.10));
    const peCheap = pe != null && pe < 12;
    // PEG de financieras exige ROE sano (≥8%): con ROE deprimido el "barato
    // por crecimiento" es recuperación de earnings pisados — la trampa de
    // valor MET@ene-2025 (P/E trailing 35x, ROE 5.3%, PEG 0.52 → BUY −26% vs
    // SPY). ROE desconocido no castiga (na-no-bloquea de siempre).
    const pegCheap = peg != null && peg < 1.5 && !(roe != null && roe < 0.08);
    if (pb == null && pe == null && peg == null) {
      buyValuation = "na";
      buyValuationBasis = "perfil financiero — sin P/B, P/E ni PEG disponibles";
    } else {
      buyValuation = pbCheap || peCheap || pegCheap ? "met" : "not_met";
      const parts: string[] = [];
      if (pb != null) parts.push(`P/B ${pb.toFixed(2)}x${roe != null ? ` con ROE ${(roe * 100).toFixed(1)}%` : ""}`);
      if (pe != null) parts.push(`P/E trailing ${pe.toFixed(1)}x`);
      if (peg != null) parts.push(`PEG ${peg.toFixed(2)}x`);
      // Base especulativa: el CUMPLE vino sólo del PEG (promesa de
      // crecimiento), sin respaldo de P/B ni P/E.
      buyValuationSpeculative = buyValuation === "met" && !pbCheap && !peCheap;
      buyValuationBasis = `perfil financiero — ${parts.join(", ")}${buyValuationSpeculative ? " [sólo PEG — base especulativa]" : ""}`;
    }
  } else {
    const fcfKnown = fcfYield != null;
    const pegKnown = peg != null;
    if (fcfKnown || pegKnown) {
      const fcfCheap = fcfKnown && fcfYield! > 0.04;
      buyValuation = fcfCheap || (pegKnown && peg! < 1.5) ? "met" : "not_met";
      buyValuationSpeculative = buyValuation === "met" && !fcfCheap;
      const parts: string[] = [];
      if (fcfKnown) parts.push(`FCF yield ${(fcfYield! * 100).toFixed(1)}%`);
      if (pegKnown) parts.push(`PEG ${peg!.toFixed(2)}x`);
      buyValuationBasis = parts.join(", ") + (buyValuationSpeculative ? " [sólo PEG — base especulativa]" : "");
    } else {
      const pe = d.trailingPE != null && d.trailingPE > 0 ? d.trailingPE : null;
      const evEbitda = d.enterpriseToEbitda != null && d.enterpriseToEbitda > 0 ? d.enterpriseToEbitda : null;
      if (pe == null && evEbitda == null) {
        buyValuation = "na";
        buyValuationBasis = null;
      } else if ((pe != null && pe < 15) || (evEbitda != null && evEbitda < 8)) {
        buyValuation = "met";
        buyValuationBasis = `fallback sin FCF/PEG — ${[pe != null ? `P/E trailing ${pe.toFixed(1)}x` : null, evEbitda != null ? `EV/EBITDA ${evEbitda.toFixed(1)}x` : null].filter(Boolean).join(", ")}`;
      } else if ((pe != null && pe > 25) || (evEbitda != null && evEbitda > 15)) {
        buyValuation = "not_met";
        buyValuationBasis = `fallback sin FCF/PEG — ${[pe != null ? `P/E trailing ${pe.toFixed(1)}x` : null, evEbitda != null ? `EV/EBITDA ${evEbitda.toFixed(1)}x` : null].filter(Boolean).join(", ")}`;
      } else {
        buyValuation = "na"; // múltiplo intermedio sin dato de crecimiento: indeterminado de verdad
        buyValuationBasis = `fallback sin FCF/PEG — múltiplos en zona intermedia, sin crecimiento para juzgarlos`;
      }
    }
  }

  // BUY (b): consensus
  const buyConsensus: Cond = consensus == null ? "na" : consensus === "buy" ? "met" : "not_met";

  // BUY (c) / AVOID (b): leverage. Shared metric, mirrored conditions.
  // En listings jóvenes (<1 año de serie) el gate no opina: la estructura de
  // capital todavía no es señal (ver DerivedMetricsOpts.seasonedListing).
  let buyBalance: Cond;
  let avoidBalance: Cond;
  if (netDebtToEbitda == null || !seasoned) {
    buyBalance = "na";
    avoidBalance = "na";
  } else {
    buyBalance = netDebtToEbitda <= 3 ? "met" : "not_met";
    avoidBalance = netDebtToEbitda > 3 ? "met" : "not_met";
  }

  // AVOID (a): excessive valuation. Only "met" when fwd P/E >40 AND growth is
  // known and ≤30%. Unknown growth → `na` (don't punish missing data).
  let avoidValuation: Cond;
  if (d.forwardPE == null) {
    avoidValuation = "na";
  } else if (d.forwardPE > 40) {
    if (fwdEpsGrowthPct == null) avoidValuation = "na";
    else avoidValuation = fwdEpsGrowthPct > 30 ? "not_met" : "met";
  } else {
    avoidValuation = "not_met";
  }

  // AVOID (c): net discretionary selling + high short interest
  let avoidInsiderShort: Cond;
  if (shortPct == null) avoidInsiderShort = "na";
  else avoidInsiderShort = insiderNetSeller && shortPct > 10 ? "met" : "not_met";

  // Confirmación mecánica del BUY. La condición (c) de balance no puede
  // medirse en perfiles exentos de leverage (bancos/aseguradoras/gestores/
  // REITs: deuda/EBITDA no aplica) — eso es "no aplica al perfil", no "dato
  // faltante", y no debe bloquear la confirmación para siempre (sin esto,
  // buyConfirmed era estructuralmente imposible para financieras y BUY·HIGH
  // quedaba vetado de raíz por la disciplina de conviction). La ausencia de
  // consenso, en cambio, SÍ bloquea: es un dato faltante con valor informativo.
  const balanceOkForConfirm = buyBalance === "met" || !leverageApplies;
  const buyConfirmed = buyValuation === "met" && buyConsensus === "met" && balanceOkForConfirm;
  const avoidTriggered =
    avoidValuation === "met" || avoidBalance === "met" || avoidInsiderShort === "met";
  // BUY respaldado SIN cobertura: barato REAL (no sólo PEG) + balance sano/exento,
  // consenso N/D por ausencia de cobertura (no por rating negativo) y ningún
  // AVOID disparado. Habilita BUY·MEDIUM (buyConfirmed es false porque falta el
  // consenso, así que la disciplina de conviction ya lo capea a MEDIUM).
  //   El filtro NO-especulativo es CRÍTICO: el contrafactual sobre el backtest
  //   mostró que "barato + sin cobertura" a secas es heterogéneo — mezcla los ADR
  //   bancarios reales (TD/BNS por P/B+ROE, +40-50%) con trampas de valor que
  //   cumplen sólo por PEG (HDB −49%, NVO −38%, BABA −23%, PGR −30%). Empujar a
  //   BUY sólo la caja/libro barato de verdad (mismo principio que el cap
  //   especulativo: FCF real ≥4% acertó 88%, sólo-PEG 40%) evita meter los
  //   value traps. Su efecto neto igual se valida en el re-run del backtest.
  const buyConfirmedNoCoverage =
    buyValuation === "met" && !buyValuationSpeculative && balanceOkForConfirm &&
    buyConsensus === "na" && !avoidTriggered;

  return {
    fcfYield,
    buyValuationBasis,
    buyValuationSpeculative,
    peg,
    pegGrowthPct,
    pegGrowthSource,
    growthIsForward,
    netDebt,
    netDebtToEbitda,
    leverageApplies,
    isFinancial,
    epsFwd0,
    epsFwd1,
    baseTargetForwardPE,
    baseTargetMethod,
    baseTargetUpsidePct,
    forwardPE: d.forwardPE,
    fwdEpsGrowthPct,
    consensus,
    insiderPattern: insiderSum.pattern,
    insiderNetSeller,
    shortPct,
    revisionsNetDown,
    conditions: {
      buyValuation,
      buyConsensus,
      buyBalance,
      avoidValuation,
      avoidBalance,
      avoidInsiderShort,
      buyConfirmed,
      avoidTriggered,
      buyConfirmedNoCoverage,
    },
    industryProfile: profile,
  };
}

/* ── Formatting for the prompt ─────────────────────────────────────────────── */

function fmtUsd(n: number | null): string {
  if (n == null) return "N/D";
  const a = Math.abs(n);
  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(2)}`;
}

function fmtPct1(n: number | null): string {
  return n == null ? "N/D" : `${n >= 0 ? "" : ""}${n.toFixed(1)}%`;
}

function fmtX(n: number | null): string {
  return n == null ? "N/D" : `${n.toFixed(2)}x`;
}

function condLabel(c: Cond): string {
  return c === "met" ? "CUMPLE" : c === "not_met" ? "NO CUMPLE" : "N/D (sin dato concluyente — no bloquea)";
}

export function fmtDerivedMetrics(d: StockData, m: DerivedMetrics): string {
  const L: string[] = [];
  const price = d.currentPrice;

  L.push("Estas cifras y evaluaciones están calculadas en código sobre los mismos datos de abajo.");
  L.push("Son AUTORITATIVAS: usalas tal cual, NO las recalcules ni las contradigas.");
  L.push("");

  // Valuation figures
  L.push("Valuación:");
  if (m.isFinancial) {
    // El FCF de una financiera es ruido de balance; mostrarlo como métrica de
    // valuación invitaba red flags espurios ("FCF negativo", "devuelve 116%
    // del FCF"). Se declara no significativo y se muestran las métricas que
    // sí evalúan al perfil.
    L.push(
      `  FCF yield: NO SIGNIFICATIVO para este perfil (${m.industryProfile}) — el flujo de caja de una ` +
        `financiera está dominado por movimientos de balance (préstamos, depósitos, trading). ` +
        `NO lo uses como métrica de valuación ni como base de "capital devuelto vs FCF".`,
    );
    L.push(
      `  Valuación del perfil financiero: P/Libro ${fmtX(d.priceToBook)} | ` +
        `ROE ${d.returnOnEquity != null ? fmtPct1(d.returnOnEquity * 100) : "N/D"} | ` +
        `P/E trailing ${fmtX(d.trailingPE)}`,
    );
  } else {
    L.push(
      `  FCF yield (FCF ${fmtUsd(d.freeCashflow)} / Market Cap ${fmtUsd(d.marketCap)}): ` +
        `${m.fcfYield != null ? fmtPct1(m.fcfYield * 100) : "N/D"}`,
    );
  }
  if (m.peg != null) {
    L.push(
      `  PEG (P/E fwd ${fmtX(m.forwardPE)} ÷ crec. EPS ${fmtPct1(m.pegGrowthPct)}): ` +
        `${m.peg.toFixed(2)}x  [${m.pegGrowthSource}]`,
    );
  } else {
    const reason =
      m.pegGrowthPct != null && m.pegGrowthPct <= 0
        ? "crecimiento nulo/negativo — PEG no aplicable"
        : m.pegGrowthPct != null && m.pegGrowthPct > 100
          ? `crecimiento de recuperación ${m.pegGrowthPct.toFixed(0)}% — PEG no aplicable a turnarounds`
          : "falta P/E fwd o crecimiento";
    L.push(`  PEG: N/D  [${reason}]`);
  }
  L.push(`  Deuda neta (Deuda ${fmtUsd(d.totalDebt)} − Caja ${fmtUsd(d.totalCash)}): ${fmtUsd(m.netDebt)}`);
  if (m.leverageApplies) {
    L.push(`  Deuda neta / EBITDA (EBITDA ${fmtUsd(d.ebitda)}): ${fmtX(m.netDebtToEbitda)}`);
  } else {
    L.push(`  Deuda neta / EBITDA: no aplica a este perfil (${m.industryProfile}) — evaluá apalancamiento con métricas del sector`);
  }
  if (m.baseTargetForwardPE != null) {
    const up = m.baseTargetUpsidePct;
    const upTxt = up != null ? ` (${up >= 0 ? "+" : ""}${up.toFixed(1)}% vs precio actual ${fmtUsd(price)})` : "";
    const formula =
      m.baseTargetMethod === "constant_multiple"
        ? `precio ${fmtUsd(price)} × crec. EPS consenso (EPS FY+1 ${m.epsFwd1!.toFixed(2)} ÷ EPS FY0 ${m.epsFwd0!.toFixed(2)}) — múltiplo constante`
        : `P/E fwd ${fmtX(m.forwardPE)} × EPS FY+1 ${m.epsFwd1!.toFixed(2)}`;
    L.push(`  Target base (${formula}): ${fmtUsd(m.baseTargetForwardPE)}${upTxt}`);
    L.push(`    → Anclá tu priceTarget en este valor y ajustá ±10-15% según tu lectura; no lo recalcules mal.`);
  } else {
    L.push(`  Target base: N/D — faltan estimaciones de EPS forward; derivá el target con otro método y explicitalo.`);
  }
  L.push("");

  // Framework
  const c = m.conditions;
  const valFormula = m.isFinancial
    ? "P/B <1x, P/B <1.5x con ROE >10%, P/E <12x o PEG <1.5x"
    : "FCF yield >4% O PEG <1.5x; sin ambos: P/E <15x o EV/EBITDA <8x";
  L.push("Framework de rating — condiciones YA EVALUADAS en código:");
  L.push("  BUY requiere las TRES:");
  L.push(
    `    (a) Valuación atractiva (${valFormula}): ${condLabel(c.buyValuation)}` +
      (m.buyValuationBasis ? `  [evaluada con: ${m.buyValuationBasis}]` : ""),
  );
  L.push(`    (b) Consenso analistas = buy / strong buy: ${condLabel(c.buyConsensus)}  [consenso: ${m.consensus ?? "N/D"}]`);
  L.push(
    `    (c) Balance sin riesgo crítico (deuda neta ≤3x EBITDA): ` +
      (m.leverageApplies
        ? condLabel(c.buyBalance)
        : `NO APLICA al perfil (${m.industryProfile}) — no bloquea la confirmación; evaluá solvencia con métricas del sector`),
  );
  L.push(`    → BUY plenamente confirmado por el framework: ${c.buyConfirmed ? "SÍ" : "NO"}`);
  if (c.buyConfirmedNoCoverage) {
    L.push(
      `    → BUY RESPALDADO SIN COBERTURA: SÍ — barato REAL (caja/libro/earnings, no sólo PEG) + balance sano/exento, pero el consenso está N/D por FALTA DE COBERTURA de analistas (no por rating negativo). ` +
        `Esto HABILITA rating BUY con conviction MEDIUM: barato + sólido + ignorado (típico ADR) es una tesis, NO una duda. NO lo dejes en HOLD sólo porque falta el consenso.`,
    );
  }
  L.push("  AVOID se dispara con CUALQUIERA:");
  L.push(`    (a) Valuación excesiva (P/E fwd >40x sin crec. EPS proyectado >30%): ${condLabel(c.avoidValuation)}`);
  L.push(`    (b) Balance deteriorado (deuda neta >3x EBITDA, no-financieras): ${condLabel(c.avoidBalance)}`);
  L.push(`    (c) Insiders vendedores netos discrecionales + short >10% float: ${condLabel(c.avoidInsiderShort)}  [patrón: ${m.insiderPattern}; short: ${fmtPct1(m.shortPct)}]`);
  L.push(`    → AVOID disparado: ${c.avoidTriggered ? "SÍ" : "NO"}`);
  L.push("");
  L.push("  REGLA: si AVOID está disparado → rating AVOID. Si no, y BUY está confirmado → rating BUY.");
  L.push("  Si ninguno se cumple de forma limpia (condiciones N/D o señales mixtas) → usá tu juicio entre HOLD y el lado que sostengan los datos, pero tu rating NO puede contradecir una condición marcada CUMPLE/NO CUMPLE.");
  L.push("  DISCIPLINA DE N/D: una condición N/D significa 'sin dato concluyente' — NO bloquea el rating ni te empuja a HOLD.");
  L.push("    Decidí con la evidencia que SÍ está disponible; si tu HOLD refleja sobre todo falta de datos (y no una tesis equilibrada), decilo en keyDebate y usá conviction LOW.");
  L.push("  COBERTURA AUSENTE ≠ SEÑAL NEGATIVA: si la valuación está en CUMPLE, el balance sano (o exento por perfil) y el consenso es N/D");
  L.push("    porque el nombre casi no tiene cobertura de analistas (típico ADR), esa combinación RESPALDA un BUY con conviction MEDIUM.");
  L.push("    No lo dejes en HOLD sólo por falta de cobertura: barato + sólido + ignorado es una tesis, no una duda.");
  L.push("  BASE DE LA VALUACIÓN: caja real (FCF yield ≥4%) o libro/earnings baratos = base FUERTE. Un CUMPLE que descansa SÓLO en el PEG");
  L.push("    es una promesa de crecimiento del consenso: base ESPECULATIVA — BUY posible pero conviction máxima MEDIUM, y en el rationale");
  L.push("    tenés que decir explícitamente que la tesis depende de que las estimaciones se cumplan.");
  L.push("  DISCIPLINA DE CONVICTION (también se aplica en código después de tu respuesta):");
  L.push("    conviction HIGH exige respaldo mecánico del framework — BUY·HIGH sólo si 'BUY plenamente confirmado: SÍ'; AVOID·HIGH sólo si 'AVOID disparado: SÍ'. Sin ese respaldo, el máximo es MEDIUM.");
  L.push("  TESIS CONSUMADA: si tu rating es AVOID y el CONTEXTO TÉCNICO muestra el precio ≥35% debajo del máximo de 52 semanas, gran parte del daño ya está en el precio.");
  L.push("    Conviction máxima MEDIUM en ese caso, y mencioná explícitamente el riesgo de rebote en bearCase/riskFactors.");
  L.push("  CUCHILLO CAYENDO: si tu rating es BUY y el CONTEXTO TÉCNICO muestra tendencia BAJISTA (precio < MM50 < MM200) con caída ≥20% en 6 meses, es la trampa de valor / momentum crash clásica: barato contra una tendencia que el mercado sigue castigando.");
  L.push("    Conviction máxima LOW en ese caso; y salvo que las revisiones de EPS estén AL ALZA (ver ESTIMACIONES FORWARD), preferí HOLD hasta que el precio estabilice — comprar barato contra un número que se recorta es cómo se pierde 35% (backtest: este cohorte rindió −37% a 12m).");

  return L.join("\n");
}

/* ── Post-response coherence check ─────────────────────────────────────────── */

export interface CoherenceResult {
  coherent: boolean;
  code: string | null;     // short flag for telemetry
  reason: string | null;   // human-readable, fed back to the model on retry
}

// Flags the two *strong* contradictions — a rating that fights numbers the model
// was explicitly handed — PLUS two soft nudges toward the higher-precision call,
// each giving the model an explicit OUT (so it pushes, never forces):
//   1. HOLD on a barato+sólido+sin-cobertura name (buyConfirmedNoCoverage) →
//      nudge to BUY·MEDIUM (dejaba ~+40% en ADRs).
//   2. AVOID discrecional (sin gate mecánico) → nudge a HOLD (abstención: es la
//      llamada de peor precisión, 33% vs 75% del AVOID mecánico).
// `na` conditions never trigger a flag on their own.
export function checkVerdictCoherence(rating: VerdictRating, c: RatingConditions): CoherenceResult {
  if (rating === "BUY" && c.avoidTriggered) {
    return {
      coherent: false,
      code: "verdict_buy_vs_avoid",
      reason:
        "El rating fue BUY, pero al menos una condición AVOID del framework está DISPARADA (ver MÉTRICAS DERIVADAS Y FRAMEWORK). " +
        "Un BUY es incoherente con una condición AVOID cumplida. Elegí AVOID (si la condición domina la tesis) o HOLD (si es matizable), " +
        "y ajustá rationale, priceTarget y las probabilidades bull/bear en consecuencia.",
    };
  }
  if (rating === "AVOID" && c.buyConfirmed && !c.avoidTriggered) {
    return {
      coherent: false,
      code: "verdict_avoid_vs_buy",
      reason:
        "El rating fue AVOID, pero las TRES condiciones BUY del framework están CUMPLIDAS y NINGUNA condición AVOID está disparada " +
        "(ver MÉTRICAS DERIVADAS Y FRAMEWORK). Un AVOID es incoherente con eso. Elegí BUY (si sostenés la tesis) o HOLD, " +
        "y ajustá rationale, priceTarget y las probabilidades bull/bear en consecuencia.",
    };
  }
  // Nudge acotado (no contradicción dura): HOLD sobre un nombre barato + sólido
  // + sin cobertura. Le da al modelo una salida explícita (nombrar el deterioro)
  // para no forzar el rating, pero empuja contra el HOLD por default que dejó
  // +40% en ADRs bancarios (backtest 2026-07-19).
  if (rating === "HOLD" && c.buyConfirmedNoCoverage) {
    return {
      coherent: false,
      code: "verdict_hold_vs_nocoverage_buy",
      reason:
        "El rating fue HOLD, pero el framework marca BUY RESPALDADO SIN COBERTURA: SÍ (valuación barata + balance sano/exento + " +
        "consenso N/D SÓLO por falta de cobertura de analistas, sin ninguna condición AVOID disparada). Un HOLD acá deja pasar una " +
        "tesis BUY con conviction MEDIUM: barato + sólido + ignorado (típico ADR) es una tesis, no una duda. Cambiá a BUY·MEDIUM y " +
        "ajustá rationale, priceTarget y probabilidades — SALVO que puedas nombrar un catalizador CONCRETO de deterioro del negocio " +
        "que justifique la cautela (en ese caso mantené HOLD y explicitalo en el rationale; 'sin cobertura' o 'caro' no son catalizadores).",
    };
  }
  // Abstención: un AVOID DISCRECIONAL (ninguna condición AVOID del framework
  // disparada — es puro juicio del modelo) es la llamada de PEOR precisión del
  // sistema. Backtest 2026-07-19: los AVOID discrecionales acertaron 33% (2/6)
  // vs 75% de los mecánicos; 4 de 6 fueron errores caros (ASML +21%, SMFG +9%,
  // MRNA +6%, ULCC +10% — el nombre subió). Nudge hacia HOLD con una salida
  // explícita: sólo se sostiene un AVOID sin gate mecánico si hay una tesis
  // DURA (deterioro concreto O sobrevaluación clara tras una corrida extrema que
  // el framework no capturó). "Caro" o "podría corregir" no alcanzan. Llega acá
  // sólo con buyConfirmed=false (el caso avoid_vs_buy ya retornó arriba).
  if (rating === "AVOID" && !c.avoidTriggered) {
    return {
      coherent: false,
      code: "verdict_avoid_discretionary_weak",
      reason:
        "El rating fue AVOID, pero NINGUNA condición AVOID del framework está disparada (valuación excesiva, balance deteriorado, " +
        "insiders+short): es un AVOID DISCRECIONAL, la llamada de peor precisión del sistema (backtest: acierta 33% vs 75% del AVOID " +
        "mecánico). El default acá es HOLD. Sólo sostené el AVOID si podés nombrar una tesis bajista DURA y concreta — deterioro real " +
        "del negocio (márgenes/ingresos cayendo, guía recortada, evento regulatorio) O sobrevaluación clara tras una corrida extrema — " +
        "y explicitá el catalizador y su ventana en rationale/bearCase. Si tu único argumento es 'caro' o 'podría corregir', cambiá a " +
        "HOLD y ajustá rationale, priceTarget y probabilidades.",
    };
  }
  return { coherent: true, code: null, reason: null };
}

/* ── Post-response conviction discipline ───────────────────────────────────── */

// Umbral de "tesis consumada": AVOID con el precio ya ≥35% debajo del máximo de
// 52 semanas. Backtest 2026-07-19: los AVOID emitidos ANTES de la caída (corte
// enero, precio cerca de máximos) rindieron −33/−42/−56% vs SPY; los emitidos
// tras un desplome ≥30% en los 6 meses previos (AAL, ULCC julio) terminaron
// 0.0%/+31.5% — el nombre rebotó. El fundamental puede seguir siendo correcto;
// lo que no se sostiene es la convicción alta con el daño ya en el precio.
const EXHAUSTED_SELLOFF_PCT_FROM_HIGH = -35;

// Umbral de "cuchillo cayendo": un BUY sobre un nombre en tendencia bajista
// confirmada (precio < MM50 < MM200) que además cayó ≥20% en los últimos 6
// meses. Backtest 2026-07-19: BUY + bajista + ret6M ≤ −20% rindió −36.7% med a
// 12m (n=2, NVO ene y jul — los DOS peores BUY del estudio), mientras el resto
// de los BUY dieron +13.7%. Es la trampa de valor / momentum crash clásica:
// barato contra una tendencia que el mercado sigue castigando. No amerita
// conviction alta — capea a LOW y el prompt empuja a HOLD salvo revisiones al
// alza. (El momentum sigue siendo CONTEXTO para el rating; esto es sólo un cap
// de honestidad sobre la CONVICCIÓN, nunca toca el rating.)
const FALLING_KNIFE_RET6M = -0.20;

// Short interest (% float) por encima del cual un BUY no amerita conviction HIGH.
const HIGH_SHORT_PCT = 15;

export interface ConvictionDiscipline {
  conviction: VerdictConviction;
  flags: string[]; // conviction_capped_unbacked | conviction_capped_speculative | conviction_capped_selloff | conviction_capped_falling_knife
}

// Espejo en código de la regla de conviction del prompt (el modelo suele
// cumplirla solo; esto la garantiza). Backtest 2026-07-19: HIGH sin respaldo
// mecánico del framework acertó 2/5 — los tres AVOID discrecionales·HIGH
// fallaron todos (mediana +5.7% vs SPY) mientras los mecánicos dieron −33.5%.
// Sólo BAJA conviction (nunca la sube) y jamás toca el rating: es un cap de
// honestidad sobre cuánta confianza declarar, no un veto a la tesis.
export function enforceConvictionDiscipline(
  rating: VerdictRating,
  conviction: VerdictConviction,
  c: RatingConditions,
  technical: Pick<TechnicalContext, "pctFromHigh" | "trend" | "ret6M"> | null | undefined,
  // true = la valuación del framework CUMPLE sólo vía PEG (base especulativa)
  // — un BUY así no amerita HIGH aunque esté mecánicamente confirmado
  // (backtest: FCF real ≥4% acertó 88% a 12m; sólo-PEG, 40%).
  speculativeValuation?: boolean,
  // Short interest (% del float, en puntos). Un BUY sobre un nombre con short
  // elevado (>15%) está comprando lo que dinero sofisticado apuesta en contra:
  // no amerita HIGH. Raro en large caps (backtest: 0 BUY con short≥10%), pero es
  // una red de seguridad para nombres más especulativos en producción.
  shortPct?: number | null,
  // true = revisiones de EPS del consenso netas A LA BAJA (FY0+FY1, 30d). Un BUY
  // especulativo (PEG) + revisiones a la baja = comprar barato contra un número
  // que se recorta = la trampa de valor (NVO). No backtesteable con datos gratis
  // (revisiones = IBES), pero en producción el dato está y el mecanismo tiene
  // respaldo (revisions momentum es un factor top; Zacks Rank).
  revisionsNetDown?: boolean,
): ConvictionDiscipline {
  const flags: string[] = [];
  let out = conviction;
  if (out === "HIGH") {
    const backed =
      rating === "BUY" ? c.buyConfirmed : rating === "AVOID" ? c.avoidTriggered : true;
    if (!backed) {
      out = "MEDIUM";
      flags.push("conviction_capped_unbacked");
    }
  }
  if (out === "HIGH" && rating === "BUY" && speculativeValuation === true) {
    out = "MEDIUM";
    flags.push("conviction_capped_speculative");
  }
  if (out === "HIGH" && rating === "BUY" && shortPct != null && shortPct > HIGH_SHORT_PCT) {
    out = "MEDIUM";
    flags.push("conviction_capped_high_short");
  }
  // BUY especulativo (barato sólo por PEG) + revisiones a la baja = la trampa de
  // valor confirmada: capea directo a LOW (comprar barato contra un número que
  // se recorta). Requiere ambas señales para no castigar un BUY con caja real.
  if (
    rating === "BUY" &&
    out !== "LOW" &&
    speculativeValuation === true &&
    revisionsNetDown === true
  ) {
    out = "LOW";
    flags.push("conviction_capped_revisions_down");
  }
  if (
    out === "HIGH" &&
    rating === "AVOID" &&
    technical?.pctFromHigh != null &&
    technical.pctFromHigh <= EXHAUSTED_SELLOFF_PCT_FROM_HIGH
  ) {
    out = "MEDIUM";
    flags.push("conviction_capped_selloff");
  }
  // Cuchillo cayendo (BUY en tendencia bajista + caída ≥20% a 6m): capea directo
  // a LOW — es el cohorte más tóxico del backtest. Va al final para que gane
  // sobre los caps a MEDIUM de arriba (LOW < MEDIUM; sólo baja, nunca sube).
  if (
    rating === "BUY" &&
    out !== "LOW" &&
    technical?.trend === "bajista" &&
    technical?.ret6M != null &&
    technical.ret6M <= FALLING_KNIFE_RET6M
  ) {
    out = "LOW";
    flags.push("conviction_capped_falling_knife");
  }
  return { conviction: out, flags };
}
