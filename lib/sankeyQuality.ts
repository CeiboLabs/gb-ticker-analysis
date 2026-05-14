// Sankey quality scoring — diagnostics-first, prompts for Claude Code.
//
// Each finding's `message` is written as a self-contained prompt: ticker
// mentioned, concrete numbers, hint at which file/function to inspect.
// The dashboard surfaces them with a copy button so you can paste them
// straight into Claude Code without rewriting context.

import type { SegmentSankeyData } from "@/types/Report";

export type FindingCode =
  | "no_segments"
  | "few_segments"
  | "segment_imbalance"
  | "cost_imbalance"
  | "opex_imbalance"
  | "op_chain_imbalance"
  | "no_opex_breakdown"
  | "missing_op_profit"
  | "missing_net_profit"
  | "no_revenue"
  | "using_yahoo_fallback"
  | "using_yahoo_ttm"
  | "period_is_annual"
  | "no_terminal_flow"
  | "loss_not_represented"
  | "truncated_segment_names"
  | "crowded_opex_breakdown"
  | "tiny_terminal_node"
  | "extreme_segment_disparity";

export type FindingSeverity = "info" | "warn" | "error";

export interface Finding {
  code: FindingCode;
  severity: FindingSeverity;
  message: string;                     // Spanish prompt, ready to paste into Claude Code
  values?: Record<string, number | string>;  // raw numbers preserved for SQL aggregates
}

export interface SankeyQuality {
  score: number;                       // 0–100, integer
  findings: Finding[];
  hasSegments: boolean;
  segmentCount: number;
  hasOpexBreakdown: boolean;
  segmentBalancePct: number | null;
  costBalancePct: number | null;
  opexBalancePct: number | null;
  opChainBalancePct: number | null;
}

function lacksCostLayer(d: SegmentSankeyData): boolean {
  if (d.grossProfit === 0 && d.costOfRevenue === 0) return true;
  if (d.industryProfile === "bank" || d.industryProfile === "insurance") return true;
  if (d.industryProfile === "reit" || d.industryProfile === "asset-manager") return true;
  return false;
}

function pctDiff(parent: number, childrenSum: number): number {
  if (parent <= 0) return 0;
  return Math.abs(childrenSum - parent) / parent * 100;
}

function fmt(v: number, unit: string): string {
  return `${v.toFixed(2)}${unit}`;
}

function sumOpexBreakdown(b: NonNullable<SegmentSankeyData["opexBreakdown"]>): number {
  let s = 0;
  for (const v of Object.values(b)) {
    if (typeof v === "number" && isFinite(v)) s += v;
  }
  return s;
}

function presentOpexBuckets(b: NonNullable<SegmentSankeyData["opexBreakdown"]>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(b)) {
    if (typeof v === "number" && v > 0) out.push(k);
  }
  return out;
}

export function scoreSankey(
  d: SegmentSankeyData | null | undefined,
  ticker: string,
): SankeyQuality {
  const T = ticker.toUpperCase();

  if (!d) {
    return {
      score: 0,
      findings: [{
        code: "no_revenue",
        severity: "error",
        message:
          `[${T}] No se pudo construir el Sankey: no hay revenue. ` +
          `Investigá por qué fetchStockData / fetchSegmentData / fetchEdgar8KIncomeStatement ` +
          `devolvieron datos vacíos para ${T}. Empezá por correr cada una manualmente con el ticker ` +
          `y ver dónde se rompe la cadena. Probable: ticker recién listado, ADR no soportado, o redirect.`,
      }],
      hasSegments: false,
      segmentCount: 0,
      hasOpexBreakdown: false,
      segmentBalancePct: null,
      costBalancePct: null,
      opexBalancePct: null,
      opChainBalancePct: null,
    };
  }

  const findings: Finding[] = [];
  let score = 100;
  const unit = d.unit ?? "";
  const rev = d.totalRevenue;

  if (rev <= 0) {
    return {
      score: 0,
      findings: [{
        code: "no_revenue",
        severity: "error",
        message:
          `[${T}] Revenue ≤ 0 (${rev}) en el SegmentSankeyData final. ` +
          `Reproducí pegándole POST /api/analyze con el ticker ${T} y revisá si fetchEdgar8KIncomeStatement ` +
          `o buildSankeyFromYahooQuarter le pasan totalRevenue 0/negativo a buildSankeyFrom8K. ` +
          `Probable causa: parser asignando un valor mal extraído de la tabla del Exhibit 99.1.`,
        values: { totalRevenue: rev },
      }],
      hasSegments: false,
      segmentCount: 0,
      hasOpexBreakdown: false,
      segmentBalancePct: null,
      costBalancePct: null,
      opexBalancePct: null,
      opChainBalancePct: null,
    };
  }

  // — Source-level diagnostics —
  // The TTM-margin synthesis path was retired (it fabricated a Sankey from
  // average-of-averages with no real reporting period behind it). Any Yahoo
  // source now means buildSankeyFromYahooQuarter — strict-real mode, all
  // critical fields directly from Yahoo's quarterly feed.
  if (d.source === "Yahoo") {
    findings.push({
      code: "using_yahoo_fallback",
      severity: "warn",
      message:
        `[${T}] El Sankey se construyó desde el último trimestre de Yahoo, no desde EDGAR. ` +
        `Esto solo dispara cuando el 8-K parser no devolvió datos válidos para ${T}. ` +
        `Investigá fetchEdgar8KIncomeStatement (lib/fetchEdgar8K.ts): ` +
        `1) abrí el filing index del snapshot (campo filingIndexUrl), ` +
        `2) verificá si el Exhibit 99.1 existe y qué estructura tiene la tabla del IS, ` +
        `3) chequeá si los regex/selectors del parser matchean los headers de ese filing.`,
    });
    score -= 10;
  }

  // — Period granularity —
  // The Sankey should normally show a quarterly view (Q1–Q4) or, for foreign
  // semi-annual filers, H1/H2. When the label is bare "FY{year}" it means we
  // ended up rendering full-year data — useful as last resort but suggests
  // the parser couldn't get to (or derive) the latest quarter. Skip TTM
  // (handled separately) and skip when the period is missing entirely.
  const period = d.period ?? "";
  const isAnnualOnly = /^FY\d{4}$/i.test(period.trim());
  if (isAnnualOnly) {
    const src = d.source;
    // Choose the most relevant code path based on the actual source — no guessing.
    let pathHint: string;
    switch (src) {
      case "20-F":
      case "40-F":
      case "6-K":
        pathHint =
          `El parser cargó un ${src} (foreign issuer). Revisá tryDeriveQ4From6K en lib/fetchEdgar8K.ts: ` +
          `verificá que esté encontrando el 9M YTD anterior para derivar Q4 = FY − 9M. ` +
          `Si ${T} solo publica reportes anuales (típico para algunos foreign privates — Canadian MJDS 40-F filers ` +
          `entre ellos), no hay nada que derivar — pero validá que sea el caso real revisando los últimos filings de ${T} en sec.gov.`;
        break;
      case "10-K":
        pathHint =
          `El parser cargó un 10-K (annual report US). ` +
          `Esto solo debería pasar si para ${T} no hay un 10-Q reciente. ` +
          `Revisá lib/fetchEdgarSegments.ts: la lógica que prioriza 10-Q sobre 10-K probablemente no está encontrando el último trimestre. ` +
          `Verificá si el issuer tiene un 10-Q posterior al 10-K que no estamos pickeando.`;
        break;
      case "8-K":
        pathHint =
          `El 8-K parseado para ${T} reportó FY completo (annual press release). ` +
          `El press release no era trimestral — verificá si hay otro 8-K posterior con resultados Q4 ` +
          `que findEarnings8KCandidates en lib/fetchEdgar8K.ts no priorizó.`;
        break;
      case "10-Q":
        pathHint =
          `El source es 10-Q pero el período figura como anual — esto es contradictorio y posiblemente un bug en el parser. ` +
          `Revisá lib/fetchEdgarSegments.ts: el período (campo period) se está computando mal a partir del endDate del 10-Q.`;
        break;
      case "Yahoo":
        pathHint =
          `El source es Yahoo pero el período es anual — el fallback eligió un agregado FY en lugar de un quarter. ` +
          `Revisá buildSankeyFromYahooQuarter en app/api/analyze/route.ts.`;
        break;
      default:
        pathHint =
          `Source no informado en el SegmentSankeyData — investigá qué filing se cargó para ${T} ` +
          `revisando el snapshot (edgar8kRaw / xbrlSegmentsRaw).`;
    }
    findings.push({
      code: "period_is_annual",
      severity: "warn",
      message:
        `[${T}] El Sankey muestra "${period}" (año fiscal completo) en lugar de un trimestre. ` +
        `Source registrado: ${src ?? "(sin source)"}. ${pathHint}`,
      values: { period, source: src ?? "unknown" },
    });
    score -= 15;
  }

  // — Segments (revenue inflow) —
  const segs = d.segments ?? [];
  const segCount = segs.length;
  const hasSegments = segCount > 0;
  let segmentBalancePct: number | null = null;

  if (!hasSegments) {
    findings.push({
      code: "no_segments",
      severity: "warn",
      message:
        `[${T}] Revenue total ${fmt(rev, unit)} sin desglose por segmento — el lado izquierdo del Sankey ` +
        `va a mostrar una sola fuente plana. Investigá fetchSegmentData (lib/fetchEdgarSegments.ts) y ` +
        `fetchEdgar8KIncomeStatement: para ${T} ningún parser devolvió segments[]. ` +
        `Mirá si el 10-K/10-Q tiene un segment footnote (XBRL tag SegmentInformation) o si el 8-K ` +
        `incluye una tabla "Segment Results" — el parser puede estar saltándola por estructura distinta.`,
      values: { totalRevenue: rev },
    });
    score -= 25;
  } else {
    if (segCount < 2) {
      findings.push({
        code: "few_segments",
        severity: "info",
        message:
          `[${T}] Solo 1 segmento reportado: "${segs[0]?.name ?? "?"}". ` +
          `Verificá si el issuer realmente opera un solo segmento (típico para small-caps focalizadas) ` +
          `o si el parser está colapsando múltiples segmentos en uno. Mirá el último 10-K en SEC para ${T}.`,
        values: { segmentCount: segCount },
      });
      score -= 5;
    }
    const segSum = segs.reduce((s, x) => s + (x.value > 0 ? x.value : 0), 0);
    segmentBalancePct = pctDiff(rev, segSum);
    if (segmentBalancePct > 3) {
      const gap = rev - segSum;
      findings.push({
        code: "segment_imbalance",
        severity: segmentBalancePct > 10 ? "error" : "warn",
        message:
          `[${T}] Los segmentos no suman al revenue total: ${segs.map((s) => `${s.name}=${fmt(s.value, unit)}`).join(" + ")} = ${fmt(segSum, unit)}, ` +
          `pero totalRevenue es ${fmt(rev, unit)} (gap ${fmt(gap, unit)} = ${segmentBalancePct.toFixed(1)}%). ` +
          `Para ${T} probablemente falta un segmento "Other / Corporate / Eliminations" que el parser no capturó. ` +
          `Revisá lib/fetchEdgarSegments.ts (XBRL) o la sección de segments en lib/fetchEdgar8K.ts (text-parse). ` +
          `Mirá el segment table del último filing y chequeá si hay una fila residual que el parser está descartando.`,
        values: {
          segmentSum: segSum,
          totalRevenue: rev,
          gap,
          gapPct: segmentBalancePct,
          segments: segs.map((s) => `${s.name}=${s.value.toFixed(2)}`).join(" | "),
        },
      });
      score -= Math.min(20, Math.round(segmentBalancePct));
    }
  }

  // — Cost-of-revenue layer —
  // Skip when issuer is in gross loss: cogs ≥ rev means GP would be negative,
  // which the chart clamps to 0 (no negative flow rendering). That clamp
  // breaks reconciliation by design, not a parser bug.
  let costBalancePct: number | null = null;
  const grossLossLikely = d.costOfRevenue >= rev * 0.97;
  if (!lacksCostLayer(d) && !grossLossLikely) {
    const sum = d.costOfRevenue + d.grossProfit;
    costBalancePct = pctDiff(rev, sum);
    if (costBalancePct > 1) {
      const gap = rev - sum;
      findings.push({
        code: "cost_imbalance",
        severity: costBalancePct > 5 ? "error" : "warn",
        message:
          `[${T}] La capa de costos no reconcilia: costOfRevenue ${fmt(d.costOfRevenue, unit)} + grossProfit ${fmt(d.grossProfit, unit)} = ${fmt(sum, unit)}, ` +
          `pero totalRevenue es ${fmt(rev, unit)} (gap ${fmt(gap, unit)} = ${costBalancePct.toFixed(1)}%). ` +
          `Para ${T} esto suele indicar que el parser asignó la línea "Cost of revenue" o "Gross profit" a un campo equivocado. ` +
          `Revisá buildSankeyFrom8K en app/api/analyze/route.ts o el extractor en lib/fetchEdgar8K.ts. ` +
          `Compará costOfRevenue/grossProfit del Edgar 8-K raw output contra la tabla del Exhibit 99.1 (filingIndexUrl en el snapshot).`,
        values: {
          costOfRevenue: d.costOfRevenue,
          grossProfit: d.grossProfit,
          totalRevenue: rev,
          gap,
          gapPct: costBalancePct,
        },
      });
      score -= Math.min(20, Math.round(costBalancePct));
    }
  }

  // — Operating expenses breakdown —
  const hasOpexBreakdown = !!d.opexBreakdown && sumOpexBreakdown(d.opexBreakdown) > 0;
  let opexBalancePct: number | null = null;
  if (!hasOpexBreakdown) {
    if (d.operatingExpenses > 0) {
      findings.push({
        code: "no_opex_breakdown",
        severity: "warn",
        message:
          `[${T}] OpEx total ${fmt(d.operatingExpenses, unit)} sin desglose (R&D, S&M, G&A, etc.) — ` +
          `aparece como un único bloque opaco en el Sankey. ` +
          `Investigá fetchSegmentData / fetchEdgar8KIncomeStatement para ${T}: probablemente el parser no está capturando ` +
          `los XBRL tags us-gaap:ResearchAndDevelopmentExpense / SellingGeneralAndAdministrativeExpense, ` +
          `o el press release los reporta bajo un label distinto. Chequeá la tabla de Operating Expenses en el último filing.`,
        values: { operatingExpenses: d.operatingExpenses },
      });
      score -= 10;
    }
  } else if (d.opexBreakdown && d.operatingExpenses > 0) {
    const sum = sumOpexBreakdown(d.opexBreakdown);
    opexBalancePct = pctDiff(d.operatingExpenses, sum);
    if (opexBalancePct > 5) {
      const gap = d.operatingExpenses - sum;
      const buckets = presentOpexBuckets(d.opexBreakdown);
      findings.push({
        code: "opex_imbalance",
        severity: opexBalancePct > 15 ? "error" : "warn",
        message:
          `[${T}] El desglose de OpEx no cierra: buckets [${buckets.join(", ")}] suman ${fmt(sum, unit)} ` +
          `pero operatingExpenses total es ${fmt(d.operatingExpenses, unit)} (gap ${fmt(gap, unit)} = ${opexBalancePct.toFixed(1)}%). ` +
          `Para ${T} significa que falta un bucket en el breakdown (probable: stock-based comp, restructuring, impairment, o un "Other OpEx" residual). ` +
          `Mirá lib/fetchEdgar8K.ts y app/api/analyze/route.ts → buildSankeyFrom8K, sección "knownOpex / otherOpex". ` +
          `Compará contra la tabla de OpEx del último 10-Q/10-K o press release.`,
        values: {
          opexSum: sum,
          operatingExpenses: d.operatingExpenses,
          gap,
          gapPct: opexBalancePct,
          buckets: buckets.join(", "),
        },
      });
      score -= Math.min(15, Math.round(opexBalancePct / 2));
    }
  }

  // — Operating profit chain —
  // Reporting strategy: solo alertamos por "missing" cuando los OTROS niveles
  // confirman que la empresa es rentable y aun así esa línea quedó en 0.
  // Esto elimina los falsos positivos para empresas en pérdida — donde
  // operatingProfit / netProfit clampean a 0 por diseño del chart, no por bug
  // del parser.
  let opChainBalancePct: number | null = null;
  if (d.operatingProfit > 0) {
    const tax = (d as { tax?: number }).tax ?? 0;
    const nonOp = (d as { nonOperatingIncome?: number }).nonOperatingIncome ?? 0;
    // Net interest expense from nonOpBreakdown closes part of the gap when
    // pretax < op (issuer pays more interest than it earns). The renderer
    // surfaces this as an "Interest Exp." child of op (SankeyChart.tsx ~870),
    // so for the chain reconciliation we credit the same magnitude.
    const nob = (d as { nonOpBreakdown?: { interestExpense?: number; interestIncome?: number } }).nonOpBreakdown;
    const netIntExp = Math.max(0, (nob?.interestExpense ?? 0) - (nob?.interestIncome ?? 0));
    const reconstructed = d.netProfit + tax + nonOp + netIntExp;
    opChainBalancePct = pctDiff(d.operatingProfit, reconstructed);
    if (opChainBalancePct > 10) {
      const gap = d.operatingProfit - reconstructed;
      findings.push({
        code: "op_chain_imbalance",
        severity: opChainBalancePct > 25 ? "error" : "warn",
        message:
          `[${T}] La cadena Op Income → NI + Tax + Net Interest no reconcilia: operatingProfit ${fmt(d.operatingProfit, unit)} ` +
          `≠ netProfit ${fmt(d.netProfit, unit)} + tax ${fmt(tax, unit)} + nonOp ${fmt(nonOp, unit)} + netIntExp ${fmt(netIntExp, unit)} ` +
          `(suma ${fmt(reconstructed, unit)}, gap ${fmt(gap, unit)} = ${opChainBalancePct.toFixed(1)}%). ` +
          `Para ${T} probablemente falta una línea below-the-line no capturada (FX loss, equity-method, impairment), ` +
          `el parser leyó mal incomeTaxExpense, o nonOpBreakdown está incompleto. ` +
          `Revisá la lógica de tax en buildSankeyFrom8K (app/api/analyze/route.ts) y los campos interestExpense/incomeBeforeTax del Edgar 8-K raw.`,
        values: {
          operatingProfit: d.operatingProfit,
          netProfit: d.netProfit,
          tax,
          nonOperatingIncome: nonOp,
          netInterestExpense: netIntExp,
          reconstructed,
          gap,
          gapPct: opChainBalancePct,
        },
      });
      score -= Math.min(15, Math.round(opChainBalancePct / 3));
    }
  } else if (d.netProfit > 0) {
    // Net positivo pero op = 0 → el parser perdió la línea de op income.
    // Imposible tener net profit sin op profit (o non-operating gain enorme,
    // pero esa rama también deja huellas en otros campos).
    findings.push({
      code: "missing_op_profit",
      severity: "warn",
      message:
        `[${T}] Operating profit reportado en 0 pero netProfit es ${fmt(d.netProfit, unit)} (positivo) — el parser perdió la línea Op Income. ` +
        `Investigá lib/fetchEdgar8K.ts: probablemente extractIncomeStatement no encontró "Operating income" para ${T}. ` +
        `Puede estar etiquetada como "Income from operations", "Operating profit" o un equivalente IFRS. ` +
        `Chequeá los regex de match en el parser y si el snapshot del Edgar 8-K raw tiene operatingIncome=null.`,
      values: { operatingProfit: d.operatingProfit, netProfit: d.netProfit },
    });
    score -= 10;
  }

  // missing_net_profit solo cuando operatingProfit > 0 pero net quedó en 0.
  // Una empresa con op profit positivo y net = 0/null indica que el parser
  // no encontró la línea final, no que la empresa esté en pérdida real
  // (la pérdida real implicaría op profit negativo / clampeado a 0).
  if (d.netProfit <= 0 && d.operatingProfit > 0) {
    findings.push({
      code: "missing_net_profit",
      severity: "warn",
      message:
        `[${T}] Operating profit ${fmt(d.operatingProfit, unit)} (positivo) pero netProfit en 0 — el parser perdió la línea Net Income. ` +
        `Investigá lib/fetchEdgar8K.ts: revisá los matchers para "Net income", "Net earnings", "Profit for the period" (IFRS), ` +
        `y mirá si el snapshot tiene netIncome=null o 0 en el Edgar 8-K raw.`,
      values: { netProfit: d.netProfit, operatingProfit: d.operatingProfit },
    });
    score -= 10;
  }

  // — Visual integrity checks —
  // The Sankey requires a terminal node on the right side (Net Profit or
  // Net Loss). When a loss-making company comes through a path that doesn't
  // populate netLoss (Yahoo quarter, some XBRL paths), the chart has no
  // sink for the cost flows and renders flying ribbons that die at OpEx.
  // This is the worst kind of failure because the user sees something but
  // it's incomplete — the score has to reflect that.
  const netLoss = (d as { netLoss?: number }).netLoss;
  const operatingLoss = (d as { operatingLoss?: number }).operatingLoss;
  const noTerminal =
    d.netProfit <= 0 &&
    d.operatingProfit <= 0 &&
    (netLoss === undefined || netLoss <= 0) &&
    (operatingLoss === undefined || operatingLoss <= 0);
  if (noTerminal) {
    findings.push({
      code: "no_terminal_flow",
      severity: "error",
      message:
        `[${T}] El Sankey no tiene nodo terminal de utilidad (ni Net Profit ni Net Loss): ` +
        `operatingProfit=${fmt(d.operatingProfit, unit)}, netProfit=${fmt(d.netProfit, unit)}, ` +
        `netLoss=${netLoss ?? "undefined"}. Visualmente el chart no cierra — los flujos de OpEx mueren sin destino. ` +
        `Para ${T} el path que armó el SegmentSankeyData no setea netLoss cuando la empresa está en pérdida. ` +
        `Si vino de Yahoo (source="Yahoo"), buildSankeyFromYahooQuarter en app/api/analyze/route.ts no maneja losses. ` +
        `Si vino de XBRL (source = "10-K"/"10-Q"), revisá lib/fetchEdgarSegments.ts: el cálculo de netIncome ` +
        `clampeada a 0 con Math.max(0, ni) tiene que extraer el valor original como netLoss cuando ni < 0.`,
      values: {
        operatingProfit: d.operatingProfit,
        netProfit: d.netProfit,
        netLoss: netLoss ?? "undefined",
        operatingLoss: operatingLoss ?? "undefined",
      },
    });
    score -= 30;
  }

  // Loss-making company but neither netLoss nor operatingLoss are set.
  // Same root cause as above but caught by a different signal — when costs
  // exceed revenue (gross loss) the chart should annotate the loss.
  if (grossLossLikely && netLoss === undefined && operatingLoss === undefined && !noTerminal) {
    findings.push({
      code: "loss_not_represented",
      severity: "warn",
      message:
        `[${T}] La empresa parece estar en pérdida bruta (costOfRevenue ${fmt(d.costOfRevenue, unit)} ≥ revenue ${fmt(rev, unit)}) ` +
        `pero el SegmentSankeyData no expone netLoss/operatingLoss. ` +
        `El chart va a mostrar un GP=0 sin contexto en lugar de un nodo Loss explícito. ` +
        `Para ${T} verificá que el parser que produjo este Sankey calcule ambos campos cuando los valores sean negativos. ` +
        `Está bien implementado en buildSankeyFrom8K (app/api/analyze/route.ts, línea con "netLoss: ni < 0 ? sc(-ni) : undefined"); ` +
        `replicá el patrón en buildSankeyFromYahooQuarter y en fetchEdgarSegments.`,
      values: { costOfRevenue: d.costOfRevenue, totalRevenue: rev },
    });
    score -= 15;
  }

  // — Layout density heuristics (proxies para overlap de labels) —
  // No corremos el layout de d3-sankey acá (sería duplicar el chart entero),
  // pero estas señales correlacionan fuerte con overlapping de nodos:
  //
  // 1. Más de 4 buckets en OpEx breakdown → la columna OpEx tiene muchas
  //    sub-flechas pequeñas y los labels colisionan.
  const opex = d.opexBreakdown ?? {};
  const opexBucketCount = Object.values(opex).filter(
    (v) => typeof v === "number" && v > 0,
  ).length;
  if (opexBucketCount > 4) {
    findings.push({
      code: "crowded_opex_breakdown",
      severity: "warn",
      message:
        `[${T}] El breakdown de OpEx tiene ${opexBucketCount} buckets — el chart tiene espacio para ~4 antes de que los labels colisionen. ` +
        `Los buckets pequeños van a quedar con texto encimado al de buckets vecinos. ` +
        `Considerá agrupar buckets chicos en un "Other" en buildSankeyFrom8K (app/api/analyze/route.ts). ` +
        `O reducí los nombres a 1-2 palabras en el rendering.`,
      values: { opexBucketCount },
    });
    score -= 8;
  }

  // 2. Margen muy chico pero positivo → el nodo final (Op Profit / Net Profit)
  //    queda con altura sub-píxel, el label flota en el aire o se monta sobre
  //    el flujo adyacente. Usamos 3% como umbral porque a esa altura el chart
  //    deja menos de 15px verticales en el viewBox típico de 550–700px.
  const opMargin  = rev > 0 ? (d.operatingProfit / rev) * 100 : 0;
  const netMargin = rev > 0 ? (d.netProfit       / rev) * 100 : 0;
  if (opMargin > 0 && opMargin < 3) {
    findings.push({
      code: "tiny_terminal_node",
      severity: "warn",
      message:
        `[${T}] Operating margin ${opMargin.toFixed(2)}% — el nodo Op Profit va a renderizar como una franja sub-píxel ` +
        `y su label "Op. Profit ${fmt(d.operatingProfit, unit)}" probablemente se monta sobre el flujo de OpEx. ` +
        `No es un bug del parser, pero es información para el equipo de chart: ajustar SankeyChart para promover labels ` +
        `de nodos con altura < N% del viewBox a etiquetas externas con líneas guía.`,
      values: { operatingProfit: d.operatingProfit, opMargin },
    });
    score -= 5;
  }
  if (netMargin > 0 && netMargin < 3) {
    findings.push({
      code: "tiny_terminal_node",
      severity: "warn",
      message:
        `[${T}] Net margin ${netMargin.toFixed(2)}% — el nodo Net Profit queda con altura mínima y el label se monta ` +
        `sobre los flujos de Tax/Non-Op. Idem fix: SankeyChart debería detectar nodos con height < threshold y ` +
        `mover sus labels afuera con leader lines.`,
      values: { netProfit: d.netProfit, netMargin },
    });
    score -= 5;
  }

  // 3. Disparidad extrema entre segmentos: el segmento más grande es > 25x
  //    el más chico → el chico aparece como una raya finita y su label se
  //    encima al del vecino mayor.
  const positiveSegs = (d.segments ?? []).filter((s) => s.value > 0);
  if (positiveSegs.length >= 2) {
    const max = Math.max(...positiveSegs.map((s) => s.value));
    const min = Math.min(...positiveSegs.map((s) => s.value));
    if (min > 0 && max / min > 25) {
      const tinyOnes = positiveSegs.filter((s) => s.value < max / 25);
      findings.push({
        code: "extreme_segment_disparity",
        severity: "warn",
        message:
          `[${T}] Disparidad extrema entre segmentos (max=${fmt(max, unit)}, min=${fmt(min, unit)}, ratio ${(max / min).toFixed(0)}x). ` +
          `Segmentos chicos: ${tinyOnes.map((s) => `${s.name}=${fmt(s.value, unit)}`).join(", ")} — sus labels van a quedar encimados al segmento dominante. ` +
          `Considerá agrupar segmentos < N% del revenue en un "Other" desde el parser que produjo este Sankey.`,
        values: { max, min, ratio: max / min, tinyCount: tinyOnes.length },
      });
      score -= 6;
    }
  }

  // Long segment names get truncated by the chart (visible as "Foo bar baz...").
  // Both makes the chart less informative AND signals the parser captured an
  // overly verbose label that probably has a more concise alias.
  const longSegments = (d.segments ?? []).filter((s) => s.name.length > 25);
  if (longSegments.length > 0) {
    findings.push({
      code: "truncated_segment_names",
      severity: "warn",
      message:
        `[${T}] ${longSegments.length} segmento(s) con nombre > 25 chars — el chart los va a truncar como "${longSegments[0]?.name.slice(0, 22)}...". ` +
        `Nombres completos: ${longSegments.map((s) => `"${s.name}"`).join(", ")}. ` +
        `En lib/fetchEdgarSegments.ts (donde el parser de XBRL extrae los nombres de segmento), ` +
        `agregá un alias map para acortar estos labels a algo legible (ej. "Health Services" → "Health"). ` +
        `Mirá si los XBRL elements tienen un dei:LegalEntityIdentifier o un alias más corto en custom taxonomy.`,
      values: { count: longSegments.length, names: longSegments.map((s) => s.name).join(" | ") },
    });
    score -= 8;
  }

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return {
    score,
    findings,
    hasSegments,
    segmentCount: segCount,
    hasOpexBreakdown,
    segmentBalancePct,
    costBalancePct,
    opexBalancePct,
    opChainBalancePct,
  };
}

// Mirror the SegmentSankeyData shape used by SankeyChart so the snapshot
// renders byte-identical to what the user saw. Includes industry-specific
// fields (insurance, banks, REITs, asset-managers) — without them the chart
// falls back to the generic Cost-of-Revenue layout, producing a misleading
// preview in the monitor. Each field is small (one number) so storage stays
// well under 5KB per event.
function slimSankey(d: SegmentSankeyData) {
  // Cast once so we can read optional fields not in the public type.
  const x = d as unknown as Record<string, unknown>;
  return {
    // — Common header —
    currency: d.currency,
    period: d.period,
    endDate: d.endDate,
    source: d.source,
    unit: d.unit,
    industryProfile: d.industryProfile,
    segmentPeriod: d.segmentPeriod,
    geographyOnly: x.geographyOnly,
    // — Core IS waterfall —
    totalRevenue: d.totalRevenue,
    totalRevenueYoy: d.totalRevenueYoy,
    grossProfit: d.grossProfit,
    grossMarginPct: d.grossMarginPct,
    grossMarginYoy: d.grossMarginYoy,
    costOfRevenue: d.costOfRevenue,
    operatingExpenses: d.operatingExpenses,
    opexBreakdown: d.opexBreakdown,
    operatingProfit: d.operatingProfit,
    operatingMarginPct: d.operatingMarginPct,
    operatingLoss: x.operatingLoss,
    netProfit: d.netProfit,
    netMarginPct: d.netMarginPct,
    netLoss: x.netLoss,
    tax: x.tax,
    nonOperatingIncome: x.nonOperatingIncome,
    nonOpBreakdown: x.nonOpBreakdown,
    investments: x.investments,
    // — Revenue side —
    segments: d.segments,
    // — Bank profile —
    interestIncome: x.interestIncome,
    interestExpense: x.interestExpense,
    netInterestIncome: x.netInterestIncome,
    provisionForLoanLosses: x.provisionForLoanLosses,
    noninterestIncome: x.noninterestIncome,
    noninterestExpense: x.noninterestExpense,
    // — Insurance profile —
    premiumsEarned: x.premiumsEarned,
    policyholderBenefits: x.policyholderBenefits,
    underwritingExpense: x.underwritingExpense,
    // — REIT profile —
    rentalIncome: x.rentalIncome,
    propertyOpex: x.propertyOpex,
    noi: x.noi,
    ffo: x.ffo,
    // — Asset manager profile —
    managementFees: x.managementFees,
    performanceFees: x.performanceFees,
    compensationExpense: x.compensationExpense,
    compensationRatioPct: x.compensationRatioPct,
  };
}

interface YahooQuarterMinimal {
  endDate?: string;
  totalRevenue?: number | null;
  grossProfit?: number | null;
  costOfRevenue?: number | null;
  operatingIncome?: number | null;
  netIncome?: number | null;
  totalOperatingExpenses?: number | null;
  researchDevelopment?: number | null;
  sellingGeneralAdministrative?: number | null;
}

type Edgar8KMinimal = Partial<Record<
  | "endDate" | "form" | "currency"
  | "totalRevenue" | "costOfRevenue" | "grossProfit"
  | "researchDevelopment" | "sellingGeneralAdministrative"
  | "totalOperatingExpenses" | "operatingIncome" | "interestExpense"
  | "incomeBeforeTax" | "incomeTaxExpense" | "netIncome"
  | "aircraftFuel" | "salariesWages" | "aircraftMaintenance"
  | "aircraftRent" | "landingFees" | "depreciationAmortization"
  | "isAnnual" | "isSemiAnnual" | "fiscalYearEndMonth"
  | "cik" | "accession" | "sourceUrl",
  number | string | boolean | null | undefined
>> & {
  segments?: Array<{ name: string; value: number }>;
};

export interface SnapshotContext {
  finalSankey: SegmentSankeyData | null;
  overridePath?:
    | "8k_override"
    | "yahoo_fallback"
    | "segments_kept"
    | "stub"
    | "cache";
  edgar8kRaw?: Edgar8KMinimal;
  xbrlSegmentsRaw?: SegmentSankeyData | null;
  yahooQuarter?: YahooQuarterMinimal | null;
  yahooCurrency?: string | null;
  filingIndexUrl?: string | null;
}

export function snapshotSankey(ctx: SnapshotContext): string | null {
  const payload: Record<string, unknown> = {};
  if (ctx.finalSankey)        payload.finalSankey      = slimSankey(ctx.finalSankey);
  if (ctx.overridePath)       payload.overridePath     = ctx.overridePath;
  if (ctx.edgar8kRaw)         payload.edgar8kRaw       = ctx.edgar8kRaw;
  if (ctx.xbrlSegmentsRaw)    payload.xbrlSegmentsRaw  = slimSankey(ctx.xbrlSegmentsRaw);
  if (ctx.yahooQuarter)       payload.yahooQuarter     = ctx.yahooQuarter;
  if (ctx.yahooCurrency)      payload.yahooCurrency    = ctx.yahooCurrency;
  if (ctx.filingIndexUrl)     payload.filingIndexUrl   = ctx.filingIndexUrl;
  if (Object.keys(payload).length === 0) return null;
  try {
    return JSON.stringify(payload);
  } catch {
    return null;
  }
}
