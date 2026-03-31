/**
 * Fetches quarterly product-segment revenue directly from SEC EDGAR XBRL 10-Q filings.
 * Free, official data. Works for any US company that files 10-Q with the SEC.
 */
import type { RevenueQuarter } from "@/types/StockData";

const SEC      = "https://www.sec.gov";
const DATA_SEC = "https://data.sec.gov";
const H        = { "User-Agent": "ticker-app contact@bengochea.com" };

const REV_CONCEPTS = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "RevenueFromContractWithCustomerIncludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
  "RevenueFromContractWithCustomer",
];

export interface EdgarSegmentRaw {
  name: string;
  valueUSD: number;
  yoy?: string;
}

export interface EdgarSegmentResult {
  segments: EdgarSegmentRaw[];
  segmentPeriod: string;
}

async function secFetch(url: string, revalidate = 3600): Promise<Response> {
  return fetch(url, { headers: H, next: { revalidate } } as RequestInit);
}

async function resolveCIK(ticker: string): Promise<string | null> {
  const r = await secFetch(`${SEC}/files/company_tickers.json`, 86400);
  if (!r.ok) return null;
  const map: Record<string, { cik_str: number; ticker: string }> = await r.json();
  const entry = Object.values(map).find(
    (e) => e.ticker.toUpperCase() === ticker.toUpperCase()
  );
  return entry ? String(entry.cik_str) : null;
}

async function latestFilingAccession(
  cik: string
): Promise<{ accession: string; isAnnual: boolean; priorQuarterlyAccession?: string } | null> {
  const r = await secFetch(`${DATA_SEC}/submissions/CIK${cik.padStart(10, "0")}.json`);
  if (!r.ok) return null;
  const d = await r.json();
  const recent = d.filings?.recent;
  if (!recent) return null;
  const forms = recent.form as string[];
  const accessions = recent.accessionNumber as string[];
  // filings are in reverse-chronological order — first match wins
  let qIdx = -1, kIdx = -1;
  for (let i = 0; i < forms.length; i++) {
    if (forms[i] === "10-Q" && qIdx === -1) qIdx = i;
    if (forms[i] === "10-K" && kIdx === -1) kIdx = i;
    if (qIdx !== -1 && kIdx !== -1) break;
  }
  if (qIdx === -1 && kIdx === -1) return null;
  // pick whichever is more recent (lower index = filed later)
  if (kIdx === -1 || (qIdx !== -1 && qIdx < kIdx)) {
    return { accession: accessions[qIdx], isAnnual: false };
  }
  // 10-K is most recent; keep prior quarterly accession so we can derive Q4 = annual − YTD
  return {
    accession: accessions[kIdx],
    isAnnual: true,
    priorQuarterlyAccession: qIdx !== -1 ? accessions[qIdx] : undefined,
  };
}

async function xbrlDocUrl(cik: string, accession: string): Promise<string | null> {
  const cikInt = parseInt(cik, 10);
  const noDash = accession.replace(/-/g, "");
  const r = await secFetch(
    `${SEC}/Archives/edgar/data/${cikInt}/${noDash}/${accession}-index.htm`
  );
  if (!r.ok) return null;
  const html = await r.text();
  const m = html.match(/href="(\/Archives\/edgar\/data\/[^"]+_htm\.xml)"/);
  return m ? `${SEC}${m[1]}` : null;
}

async function loadLabels(xbrlUrl: string): Promise<Record<string, string>> {
  const labUrl = xbrlUrl.replace(/_htm\.xml$/, "_lab.xml");
  const r = await fetch(labUrl, { headers: H });
  if (!r.ok) return {};
  const xml = await r.text();
  const out: Record<string, string> = {};
  const re = /xlink:label="lab_[^_"]+_([^"]+)"[^>]*>([^<]+)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const key  = m[1];
    const text = m[2].trim();
    if (!out[key] && !text.includes("[Member]")) {
      out[key] = text;
    }
  }
  return out;
}

interface CtxInfo {
  start: string;
  end:   string;
  days:  number;
  memberFull:  string;
  memberLocal: string;
  isCustom:    boolean;
  axis:        string;
}

// Axes accepted for segment revenue, in priority order.
// StatementBusinessSegmentsAxis = operating segments (e.g. Studios/Networks/Streaming, Google Services/Cloud).
// ProductOrServiceAxis = revenue disaggregated by product/service type — fallback when business segments absent.
const SEGMENT_AXES = ["StatementBusinessSegmentsAxis", "ProductOrServiceAxis"];

// ── Minimal-cover helper ──────────────────────────────────────────────────────
// Returns the smallest subset of `segs` whose values sum to `target` ± tolerance.
// `segs` must be sorted descending. Uses backtracking with sum-pruning.
function minimalCover(
  segs: EdgarSegmentRaw[],
  target: number,
  tol: number,
  maxSize = 10,
): EdgarSegmentRaw[] | null {
  const n = segs.length;
  function bt(
    idx: number, remaining: number, acc: EdgarSegmentRaw[], sum: number,
  ): EdgarSegmentRaw[] | null {
    if (remaining === 0) {
      return Math.abs(sum - target) / Math.max(sum, target) <= tol ? [...acc] : null;
    }
    for (let i = idx; i <= n - remaining; i++) {
      const next = sum + segs[i].valueUSD;
      if (next > target * (1 + tol)) continue; // prune: already overshooting
      acc.push(segs[i]);
      const r = bt(i + 1, remaining - 1, acc, next);
      if (r) return r;
      acc.pop();
    }
    return null;
  }
  for (let size = 1; size <= Math.min(n, maxSize); size++) {
    const result = bt(0, size, [], 0);
    if (result) return result;
  }
  return null;
}

function parseXbrl(
  xml: string,
  labels: Record<string, string>,
  isAnnual = false,
  totalRevenue = 0,
  dayRange?: { min: number; max: number },
): EdgarSegmentResult | null {
  const MIN_DAYS = dayRange?.min ?? (isAnnual ? 350 : 80);
  const MAX_DAYS = dayRange?.max ?? (isAnnual ? 380 : 100);
  const contexts = new Map<string, CtxInfo>();
  const ctxRe = /<context\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/context>/g;
  let m: RegExpExecArray | null;

  while ((m = ctxRe.exec(xml)) !== null) {
    const id   = m[1];
    const body = m[2];

    const startM = body.match(/<startDate>([^<]+)/);
    const endM   = body.match(/<endDate>([^<]+)/);
    if (!startM || !endM) continue;

    const start = startM[1].trim();
    const end   = endM[1].trim();
    const days  = (Date.parse(end) - Date.parse(start)) / 86_400_000;

    // Collect ALL dimensions in this context
    const dimRe = /dimension="([^"]+)">([^<]+)</g;
    let dim: RegExpExecArray | null;
    const allDims: Array<{ axis: string; member: string }> = [];

    while ((dim = dimRe.exec(body)) !== null) {
      allDims.push({ axis: dim[1], member: dim[2].trim() });
    }

    // Only accept contexts with exactly ONE dimension that is a supported segment axis.
    // Multi-dimensional contexts (e.g. ProductOrService × Geography) are sub-segments
    // that would cause duplicate/overlapping flows in the Sankey.
    if (allDims.length !== 1) continue;
    const axisLocal = allDims[0].axis.split(":").pop() ?? "";
    if (!SEGMENT_AXES.includes(axisLocal)) continue;
    const memberFull = allDims[0].member;

    const memberLocal = memberFull.split(":").pop() ?? memberFull;
    const ns          = memberFull.includes(":") ? memberFull.split(":")[0] : "us-gaap";

    contexts.set(id, { start, end, days, memberFull, memberLocal, isCustom: ns !== "us-gaap", axis: axisLocal });
  }

  if (contexts.size === 0) return null;

  const allQuarterCtxs = [...contexts.entries()].filter(
    ([, c]) => c.days >= MIN_DAYS && c.days <= MAX_DAYS
  );
  if (allQuarterCtxs.length === 0) return null;

  // Pre-scan which context IDs actually carry revenue data (any REV_CONCEPT value > 0).
  // Lets us pick the first axis with both qualifying contexts AND actual revenue values —
  // avoids choosing an axis whose contexts have no matching revenue facts.
  const revPatternPre = REV_CONCEPTS.map((t) => `(?:[^:>\\s]+:)?${t}`).join("|");
  const preRevRe = new RegExp(
    `<(?:${revPatternPre})\\b[^>]*contextRef="([^"]+)"[^>]*>([0-9]+)<`, "g"
  );
  const ctxsWithRevData = new Set<string>();
  let prm: RegExpExecArray | null;
  while ((prm = preRevRe.exec(xml)) !== null) {
    if (parseInt(prm[2], 10) > 0) ctxsWithRevData.add(prm[1]);
  }

  // Pick the highest-priority axis that has qualifying contexts WITH revenue data.
  const chosenAxis = SEGMENT_AXES.find(a =>
    allQuarterCtxs.some(([id, c]) => c.axis === a && ctxsWithRevData.has(id))
  );
  if (!chosenAxis) return null;

  const quarterCtxs = allQuarterCtxs.filter(([, c]) => c.axis === chosenAxis);

  const latestEnd = quarterCtxs.map(([, c]) => c.end).sort().at(-1)!;

  const currentCtxIds = new Set(
    quarterCtxs.filter(([, c]) => c.end === latestEnd).map(([id]) => id)
  );

  const prevEndMs = Date.parse(latestEnd);
  const priorCtxByMember = new Map<string, string>();
  for (const [id, c] of quarterCtxs) {
    if (currentCtxIds.has(id)) continue;
    const diffDays = Math.abs((prevEndMs - Date.parse(c.end)) / 86_400_000- 365);
    if (diffDays <= 12) priorCtxByMember.set(c.memberFull, id);
  }

  const revPattern = REV_CONCEPTS.map((t) => `(?:[^:>\\s]+:)?${t}`).join("|");
  const factRe = new RegExp(
    `<(?:${revPattern})\\b[^>]*contextRef="([^"]+)"[^>]*>([0-9]+)</`,
    "g"
  );

  const currentVals = new Map<string, number>();
  const priorVals   = new Map<string, number>();
  const allPriorIds = new Set(priorCtxByMember.values());

  while ((m = factRe.exec(xml)) !== null) {
    const ctxRef = m[1];
    const val    = parseInt(m[2], 10);
    if (isNaN(val) || val <= 0) continue;

    if (currentCtxIds.has(ctxRef)) {
      if (!currentVals.has(ctxRef) || val > currentVals.get(ctxRef)!) {
        currentVals.set(ctxRef, val);
      }
    } else if (allPriorIds.has(ctxRef)) {
      if (!priorVals.has(ctxRef) || val > priorVals.get(ctxRef)!) {
        priorVals.set(ctxRef, val);
      }
    }
  }

  // Sum of custom-member values to detect generic aggregates.
  // e.g. AAPL: us-gaap:ProductMember ≈ iPhone+Mac+iPad+Wearables → remove it.
  // But us-gaap:ServiceMember (no custom counterpart) → keep.
  const customValSum = [...currentCtxIds].reduce((sum, id) => {
    const ctx = contexts.get(id);
    if (!ctx?.isCustom) return sum;
    return sum + (currentVals.get(id) ?? 0);
  }, 0);

  const segments: EdgarSegmentRaw[] = [];

  for (const ctxId of currentCtxIds) {
    const ctx = contexts.get(ctxId);
    if (!ctx) continue;

    const val = currentVals.get(ctxId);
    if (!val || val <= 0) continue;

    // Skip a generic member if its value duplicates the custom members' sum (±5%)
    if (!ctx.isCustom && customValSum > 0) {
      const diff = Math.abs(val - customValSum) / Math.max(val, customValSum);
      if (diff <= 0.05) continue;
    }

    const displayName =
      labels[ctx.memberLocal] ??
      labels[ctx.memberLocal.replace(/Member$/, "")] ??
      ctx.memberLocal
        .replace(/Member$/, "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .trim();

    const priorId  = priorCtxByMember.get(ctx.memberFull);
    const priorVal = priorId ? priorVals.get(priorId) : undefined;
    const yoy = priorVal
      ? `${(val - priorVal) / priorVal >= 0 ? "+" : ""}${(((val - priorVal) / priorVal) * 100).toFixed(0)}% Y/Y`
      : undefined;

    segments.push({ name: displayName, valueUSD: val, yoy });
  }

  if (segments.length === 0) return null;

  // Deduplicate by display name: two members can share the same terseLabel
  // (e.g. RIVN: SoftwareAndServicesMember vs SoftwareAndServicesExcludingRegulatoryCreditsMember).
  // Keep the one with the larger value — it's the inclusive/broader aggregate.
  const seen = new Map<string, EdgarSegmentRaw>();
  for (const seg of segments) {
    const prev = seen.get(seg.name);
    if (!prev || seg.valueUSD > prev.valueUSD) seen.set(seg.name, seg);
  }
  const segments2 = [...seen.values()];
  segments2.sort((a, b) => b.valueUSD - a.valueUSD);

  // Resolve multi-level overlap: XBRL often encodes revenue at multiple granularities
  // (e.g. MSFT: business segments + product lines, RIVN: Automotive + sub-items).
  // If the sum of all segments significantly exceeds total revenue, pick the smallest
  // subset that sums to total revenue — that's the highest (most meaningful) level.
  if (totalRevenue > 0) {
    const allSum = segments2.reduce((s, seg) => s + seg.valueUSD, 0);
    if (allSum > totalRevenue * 1.05) {
      const cover = minimalCover(segments2, totalRevenue, 0.05);
      if (cover) segments2.splice(0, segments2.length, ...cover);
    }
  }

  const d  = new Date(latestEnd);
  const q  = Math.floor(d.getUTCMonth() / 3) + 1;
  const yr = d.getUTCFullYear();
  const periodLabel = isAnnual ? `FY${yr}` : `Q${q} FY${yr}`;

  return { segments: segments2, segmentPeriod: periodLabel };
}

export async function fetchEdgarSegments(
  ticker: string
): Promise<EdgarSegmentResult | null> {
  try {
    const cik = await resolveCIK(ticker);
    if (!cik) return null;

    const filing = await latestFilingAccession(cik);
    if (!filing) return null;

    const docUrl = await xbrlDocUrl(cik, filing.accession);
    if (!docUrl) return null;

    const [xbrlRes, labelsData] = await Promise.all([
      fetch(docUrl, { headers: H }),
      loadLabels(docUrl),
    ]);
    if (!xbrlRes.ok) return null;

    const xml = await xbrlRes.text();
    return parseXbrl(xml, labelsData, filing.isAnnual);
  } catch {
    return null;
  }
}

// ── EDGAR Income Statement ────────────────────────────────────────────────────
// Extracts a full quarterly income statement from EDGAR XBRL.

const IS_CONCEPTS: Record<string, string[]> = {
  revenue:         ["RevenueFromContractWithCustomerExcludingAssessedTax", "RevenueFromContractWithCustomerIncludingAssessedTax", "Revenues", "SalesRevenueNet"],
  grossProfit:     ["GrossProfit"],
  costOfRevenue:   ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSoldAndServicesSold"],
  operatingIncome: ["OperatingIncomeLoss"],
  netIncome:       ["NetIncomeLoss"],
  rd:              ["ResearchAndDevelopmentExpense"],
  salesMarketing:  ["SellingAndMarketingExpense", "SellingExpense"],
  generalAdmin:    ["GeneralAndAdministrativeExpense"],
  sga:             ["SellingGeneralAndAdministrativeExpense"],  // combined fallback
  tax:             ["IncomeTaxExpenseBenefit", "IncomeTaxExpense"],
  incomeBeforeTax: [
    "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
    "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
    "IncomeLossBeforeIncomeTaxes",
  ],
};

export interface EdgarIncomeStatement {
  period: string;       // e.g. "Q2 FY2026"
  currency: string;
  revenue: number;
  grossProfit: number;
  costOfRevenue: number;
  operatingIncome: number;
  netIncome: number;
  rd: number;
  salesMarketing: number;  // SellingAndMarketingExpense (separate from G&A when available)
  generalAdmin: number;    // GeneralAndAdministrativeExpense
  sga: number;             // SellingGeneralAndAdministrativeExpense (combined fallback)
  tax: number;
  incomeBeforeTax: number; // pre-tax income (operating + non-operating)
  revenueYoy?: string;
}

function extractISFromXbrl(
  xml: string,
  isAnnual = false,
  dayOverride?: { min: number; max: number },
): EdgarIncomeStatement | null {
  const MIN_DAYS = dayOverride?.min ?? (isAnnual ? 350 : 80);
  const MAX_DAYS = dayOverride?.max ?? (isAnnual ? 380 : 100);

  // ── Parse plain (non-dimensional) contexts for the target period length ───
  const ctxRe = /<context\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/context>/g;
  const plainCtxQ = new Map<string, { start: string; end: string }>();
  let m: RegExpExecArray | null;

  while ((m = ctxRe.exec(xml)) !== null) {
    const id   = m[1];
    const body = m[2];
    if (body.includes("explicitMember")) continue; // dimensional — skip

    const startM = body.match(/<startDate>([^<]+)/);
    const endM   = body.match(/<endDate>([^<]+)/);
    if (!startM || !endM) continue;

    const start = startM[1].trim();
    const end   = endM[1].trim();
    const days  = (Date.parse(end) - Date.parse(start)) / 86_400_000;
    if (days >= MIN_DAYS && days <= MAX_DAYS) plainCtxQ.set(id, { start, end });
  }

  if (plainCtxQ.size === 0) return null;

  // Latest quarterly end date
  const latestEnd = [...plainCtxQ.values()].map(c => c.end).sort().at(-1)!;
  const currentIds = new Set([...plainCtxQ.entries()].filter(([, c]) => c.end === latestEnd).map(([id]) => id));

  // Prior year same quarter
  const prevEndMs = Date.parse(latestEnd);
  const priorIds  = new Set([...plainCtxQ.entries()]
    .filter(([id, c]) => !currentIds.has(id) && Math.abs((prevEndMs - Date.parse(c.end)) / 86_400_000 - 365) <= 12)
    .map(([id]) => id));

  // ── Extract concept values ─────────────────────────────────────────────────
  function firstVal(concepts: string[], ctxSet: Set<string>): number {
    for (const concept of concepts) {
      const re = new RegExp(`<[^:>\\s]+:?${concept}\\b[^>]*contextRef="([^"]+)"[^>]*>(-?[0-9]+)<`, "g");
      let hit: RegExpExecArray | null;
      while ((hit = re.exec(xml)) !== null) {
        if (ctxSet.has(hit[1])) return parseInt(hit[2], 10);
      }
    }
    return 0;
  }

  const rev = firstVal(IS_CONCEPTS.revenue, currentIds);
  if (rev <= 0) return null;

  const gp   = firstVal(IS_CONCEPTS.grossProfit,     currentIds);
  const cogs = firstVal(IS_CONCEPTS.costOfRevenue,   currentIds) || Math.max(0, rev - gp);
  const op   = firstVal(IS_CONCEPTS.operatingIncome, currentIds);
  const ni   = firstVal(IS_CONCEPTS.netIncome,       currentIds);
  const rd   = firstVal(IS_CONCEPTS.rd,              currentIds);
  const sm   = firstVal(IS_CONCEPTS.salesMarketing,  currentIds);
  const ga   = firstVal(IS_CONCEPTS.generalAdmin,    currentIds);
  const sga  = firstVal(IS_CONCEPTS.sga,             currentIds);
  const tax  = firstVal(IS_CONCEPTS.tax,             currentIds);
  const ibt  = firstVal(IS_CONCEPTS.incomeBeforeTax, currentIds) || Math.max(0, ni + tax);

  // Y/Y revenue
  const prevRev = firstVal(IS_CONCEPTS.revenue, priorIds);
  const revenueYoy = prevRev > 0
    ? `${(rev - prevRev) / prevRev >= 0 ? "+" : ""}${(((rev - prevRev) / prevRev) * 100).toFixed(0)}% Y/Y`
    : undefined;

  // Period label
  const d  = new Date(latestEnd);
  const q  = Math.floor(d.getUTCMonth() / 3) + 1;
  const yr = d.getUTCFullYear();
  const period = isAnnual ? `FY${yr}` : `Q${q} FY${yr}`;

  return {
    period,
    currency: "USD",
    revenue: rev, grossProfit: gp, costOfRevenue: cogs,
    operatingIncome: op, netIncome: ni,
    rd, salesMarketing: sm, generalAdmin: ga, sga, tax,
    incomeBeforeTax: ibt,
    revenueYoy,
  };
}

export async function fetchEdgarIncomeStatement(
  ticker: string
): Promise<EdgarIncomeStatement | null> {
  try {
    const cik = await resolveCIK(ticker);
    if (!cik) return null;

    const filing = await latestFilingAccession(cik);
    if (!filing) return null;

    const docUrl = await xbrlDocUrl(cik, filing.accession);
    if (!docUrl) return null;

    const xbrlRes = await fetch(docUrl, { headers: H });
    if (!xbrlRes.ok) return null;

    return extractISFromXbrl(await xbrlRes.text(), filing.isAnnual);
  } catch {
    return null;
  }
}

// ── Combined fetch: income statement + segments in one XBRL download ──────────

export interface EdgarAllData {
  incomeStatement: EdgarIncomeStatement;
  segmentResult:   EdgarSegmentResult | null;
}

// ── Quarterly revenue history from EDGAR companyconcept ───────────────────────
// Uses the per-concept API (much smaller than companyfacts) to get 3+ years of
// quarterly revenue without rate limits or API keys.

export async function fetchEdgarQuarterlyRevenue(
  ticker: string,
  period1: Date,
): Promise<RevenueQuarter[] | null> {
  // EDGAR only covers US-listed companies
  const suffix = ticker.split(".").pop() ?? "";
  if (ticker.includes(".") && suffix.length >= 2) return null;

  try {
    const cik = await resolveCIK(ticker);
    if (!cik) return null;

    const cikPadded = cik.padStart(10, "0");

    for (const concept of REV_CONCEPTS) {
      const url = `${DATA_SEC}/api/xbrl/companyconcept/CIK${cikPadded}/us-gaap/${concept}.json`;
      const r = await secFetch(url, 3600);
      if (!r.ok) continue;

      const data = await r.json() as {
        units?: { USD?: Array<{ start?: string; end: string; val: number; filed?: string }> };
      };

      const facts = data.units?.USD;
      if (!Array.isArray(facts)) continue;

      // Collect quarterly (~90 days) and annual (~365 days) facts separately
      const quarterly = new Map<string, { val: number; filed: string; start: string }>();
      const annual    = new Map<string, { val: number; start: string; filed: string }>();

      for (const f of facts) {
        if (!f.start || !f.end || f.val <= 0) continue;
        const days = (Date.parse(f.end) - Date.parse(f.start)) / 86_400_000;
        if (days >= 75 && days <= 110) {
          const prev = quarterly.get(f.end);
          if (!prev || (f.filed ?? "") > prev.filed) {
            quarterly.set(f.end, { val: f.val, filed: f.filed ?? "", start: f.start });
          }
        } else if (days >= 340 && days <= 380) {
          const prev = annual.get(f.end);
          if (!prev || (f.filed ?? "") > prev.filed) {
            annual.set(f.end, { val: f.val, start: f.start, filed: f.filed ?? "" });
          }
        }
      }

      if (quarterly.size === 0) continue;

      // Derive missing Q4 = annual − (Q1 + Q2 + Q3) for each fiscal year
      for (const [annualEnd, ann] of annual) {
        if (quarterly.has(annualEnd)) continue; // Q4 already present
        const annStartMs = Date.parse(ann.start);
        const annEndMs   = Date.parse(annualEnd);
        let qtdSum = 0, qtdCount = 0;
        for (const [qEnd, q] of quarterly) {
          const qStartMs = Date.parse(q.start);
          const qEndMs   = Date.parse(qEnd);
          if (qStartMs >= annStartMs && qEndMs < annEndMs) { qtdSum += q.val; qtdCount++; }
        }
        if (qtdCount === 3) {
          const q4Val = ann.val - qtdSum;
          if (q4Val > 0) quarterly.set(annualEnd, { val: q4Val, filed: "", start: "" });
        }
      }

      const result = [...quarterly.entries()]
        .filter(([time]) => new Date(time) >= period1)
        .map(([time, { val }]) => ({ time, value: val }))
        .sort((a, b) => a.time.localeCompare(b.time));

      if (result.length > 0) return result;
    }

    return null;
  } catch {
    return null;
  }
}

export async function fetchEdgarAll(ticker: string): Promise<EdgarAllData | null> {
  try {
    const cik = await resolveCIK(ticker);
    if (!cik) return null;

    const filing = await latestFilingAccession(cik);
    if (!filing) return null;

    const docUrl = await xbrlDocUrl(cik, filing.accession);
    if (!docUrl) return null;

    // Fetch XBRL and labels in parallel — single download
    const [xbrlRes, labelsData] = await Promise.all([
      fetch(docUrl, { headers: H }),
      loadLabels(docUrl),
    ]);
    if (!xbrlRes.ok) return null;

    const xml = await xbrlRes.text();

    // For 10-K filings: prefer Q4 data in this order:
    //   1. Q4 quarterly contexts already in 10-K XBRL (80-100 days) — some filers include them
    //   2. Derived: Q4 = Annual(10-K) − 9M YTD(Q3 10-Q)         — most 10-K filers (e.g. GOOG)
    //   3. Fallback: full-year annual data
    let incomeStatement = filing.isAnnual ? extractISFromXbrl(xml, false) : null;
    let usedAnnual = false;
    let annualIS: EdgarIncomeStatement | null = null;
    let priorXmlForSegments: string | null = null;

    if (!incomeStatement && filing.isAnnual && filing.priorQuarterlyAccession) {
      // Attempt Q4 = Annual − YTD(Q3)
      annualIS = extractISFromXbrl(xml, true);
      const priorDocUrl = await xbrlDocUrl(cik, filing.priorQuarterlyAccession);
      if (annualIS && priorDocUrl) {
        const priorRes = await fetch(priorDocUrl, { headers: H });
        if (priorRes.ok) {
          const priorXml = await priorRes.text();
          priorXmlForSegments = priorXml; // keep for segment derivation below
          // Q3 10-Q contains a 9M YTD context (≈265-285 days from fiscal year start)
          const ytd = extractISFromXbrl(priorXml, false, { min: 250, max: 290 });
          if (ytd && ytd.revenue > 0 && annualIS.revenue > ytd.revenue) {
            const yr     = annualIS.period.replace("FY", "");
            const q4Rev  = annualIS.revenue      - ytd.revenue;
            let   q4Gp   = annualIS.grossProfit  - ytd.grossProfit;
            let   q4Cogs = annualIS.costOfRevenue - ytd.costOfRevenue;

            // Cross-derivation guard: COGS can't exceed revenue. When YTD subtraction
            // fails for one field (returns 0 in the Q3 10-Q), derive it from the other.
            if (q4Cogs > q4Rev || q4Cogs < 0) {
              // COGS derivation unreliable — recover from GP if it is a positive value
              if (q4Gp > 0 && q4Gp <= q4Rev) {
                q4Cogs = q4Rev - q4Gp;
              } else {
                q4Cogs = 0;
                q4Gp   = 0;
              }
            } else if (q4Gp < 0 && q4Cogs >= 0) {
              // GP negative (subtraction artifact) — derive from valid COGS
              q4Gp = Math.max(0, q4Rev - q4Cogs);
            }

            incomeStatement = {
              period:           `Q4 FY${yr}`,
              currency:         annualIS.currency,
              revenue:          q4Rev,
              grossProfit:      q4Gp,
              costOfRevenue:    q4Cogs,
              operatingIncome:  annualIS.operatingIncome  - ytd.operatingIncome,
              netIncome:        annualIS.netIncome        - ytd.netIncome,
              rd:               annualIS.rd               - ytd.rd,
              salesMarketing:   annualIS.salesMarketing   - ytd.salesMarketing,
              generalAdmin:     annualIS.generalAdmin     - ytd.generalAdmin,
              sga:              annualIS.sga              - ytd.sga,
              tax:              annualIS.tax              - ytd.tax,
              incomeBeforeTax:  annualIS.incomeBeforeTax  - ytd.incomeBeforeTax,
            };
          }
        }
      }
    }

    if (!incomeStatement) {
      incomeStatement = extractISFromXbrl(xml, filing.isAnnual);
      usedAnnual = filing.isAnnual;
    }
    if (!incomeStatement) return null;

    // ── Segment extraction ──────────────────────────────────────────────────────
    // For segments: try quarterly contexts first (Q4 in 10-K); fall back to annual only
    // when the income statement itself is annual (ensures consistent scale in the Sankey).
    let segmentResult = usedAnnual
      ? parseXbrl(xml, labelsData, true,  incomeStatement.revenue)
      : parseXbrl(xml, labelsData, false, incomeStatement.revenue);

    // For derived Q4: 10-K rarely embeds standalone Q4 segment contexts.
    // Strategy: annual segments (10-K) − 9M YTD segments (Q3 10-Q) = Q4 segments.
    // If YTD segments are unavailable, scale annual segments to Q4 revenue.
    if (!segmentResult && !usedAnnual && filing.isAnnual && annualIS) {
      const annualSegs = parseXbrl(xml, labelsData, true, annualIS.revenue);
      if (annualSegs && annualSegs.segments.length > 0) {
        let q4Segs = annualSegs.segments;

        if (priorXmlForSegments) {
          const ytdSegs = parseXbrl(
            priorXmlForSegments, labelsData, false, annualIS.revenue,
            { min: 250, max: 290 },
          );
          if (ytdSegs && ytdSegs.segments.length > 0) {
            // Subtract YTD from annual to get Q4 segment values
            const ytdMap = new Map(ytdSegs.segments.map(s => [s.name, s.valueUSD]));
            const derived = annualSegs.segments
              .map(s => ({ ...s, valueUSD: Math.max(0, s.valueUSD - (ytdMap.get(s.name) ?? 0)), yoy: undefined }))
              .filter(s => s.valueUSD > 0);
            if (derived.length > 0) q4Segs = derived;
          }
        }

        // Scale to Q4 revenue if direct derivation wasn't possible
        const srcRevenue = q4Segs === annualSegs.segments ? annualIS.revenue : 0;
        if (srcRevenue > 0 && incomeStatement.revenue > 0) {
          const scale = incomeStatement.revenue / srcRevenue;
          q4Segs = q4Segs.map(s => ({ ...s, valueUSD: Math.round(s.valueUSD * scale), yoy: undefined }));
        }

        if (q4Segs.length > 0) {
          // Normalize so segments sum to Q4 revenue (handles inter-segment eliminations)
          const segSum = q4Segs.reduce((s, seg) => s + seg.valueUSD, 0);
          if (segSum > incomeStatement.revenue * 1.01) {
            const norm = incomeStatement.revenue / segSum;
            q4Segs = q4Segs.map(s => ({ ...s, valueUSD: Math.round(s.valueUSD * norm) }));
          }
          segmentResult = { segments: q4Segs, segmentPeriod: incomeStatement.period };
        }
      }
    }

    return { incomeStatement, segmentResult };
  } catch {
    return null;
  }
}
