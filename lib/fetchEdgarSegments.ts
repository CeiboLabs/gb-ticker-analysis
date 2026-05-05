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
  // True when business-segment / product-axis are absent and the parser
  // fell back to StatementGeographicalAxis. The renderer can label "Revenue
  // by region" instead of "Revenue by segment".
  geographyOnly?: boolean;
}

// In-memory cache for SEC responses (Next.js data cache has a 2MB limit,
// XBRL filings regularly exceed that).
const memCache = new Map<string, { body: string; status: number; ts: number }>();

// Leaky-bucket rate limiter for SEC fetches. SEC's published cap is 10 req/s
// per IP; exceeding it triggers a 10-minute IP ban that extends on further
// hits during the timeout. Token-bucket would allow initial bursts that
// trip a strict per-second check, so we use the simpler leaky-bucket: each
// acquisition waits until ≥ MIN_INTERVAL_MS have passed since the previous
// one. Sustained 8 req/s, no bursts, leaves headroom for shared Worker IPs
// (production users may share Cloudflare egress IPs).
const RATE_LIMIT_PER_SECOND = 8;
const MIN_INTERVAL_MS = 1000 / RATE_LIMIT_PER_SECOND;
let lastRequestAt = 0;
let rlQueueTail: Promise<void> = Promise.resolve();

async function acquireSecToken(): Promise<void> {
  const job = rlQueueTail.then(async () => {
    const now = Date.now();
    const elapsed = now - lastRequestAt;
    if (elapsed < MIN_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
    }
    lastRequestAt = Date.now();
  });
  rlQueueTail = job.catch(() => {});
  return job;
}

export async function secFetch(url: string, ttl = 21600): Promise<Response> {
  const cached = memCache.get(url);
  if (cached && Date.now() - cached.ts < ttl * 1000) {
    return new Response(cached.body, { status: cached.status });
  }
  await acquireSecToken();
  // Cloudflare Workers / Pages: `cf.cacheEverything` makes the response
  // shareable across instances in the same colo via the edge cache. SEC
  // payloads (submissions JSON, archive HTML) change at most daily, so
  // sharing the response is safe and cuts SEC traffic dramatically when
  // multiple users analyze tickers around the same time. The local
  // `memCache` still wins inside a single hot instance.
  const r = await fetch(url, {
    headers: H,
    cf: { cacheTtl: ttl, cacheEverything: true },
  } as RequestInit & { cf?: { cacheTtl: number; cacheEverything: boolean } });
  if (r.ok) {
    const body = await r.text();
    // Detect SEC's HTML rate-limit page returned with 200 status. Don't cache
    // it — the next legitimate request would hit the cache and silently get
    // the error page. Surface as a 429 so callers fail fast.
    if (body.includes("Request Rate Threshold Exceeded")) {
      return new Response(body, { status: 429 });
    }
    memCache.set(url, { body, status: r.status, ts: Date.now() });
    return new Response(body, { status: r.status });
  }
  return r;
}

// Returns the 4-digit SIC industry code for a CIK, or null. The submissions
// JSON is already cached by secFetch, so calling this after resolveCIK()
// adds zero extra SEC traffic in practice.
export async function fetchSicCode(cik: string): Promise<string | null> {
  const r = await secFetch(`${DATA_SEC}/submissions/CIK${cik.padStart(10, "0")}.json`);
  if (!r.ok) return null;
  const d = await r.json() as { sic?: string | number };
  return d.sic ? String(d.sic) : null;
}

export async function resolveCIK(ticker: string): Promise<string | null> {
  const r = await secFetch(`${SEC}/files/company_tickers.json`, 86400);
  if (!r.ok) return null;
  const map: Record<string, { cik_str: number; ticker: string }> = await r.json();
  // SEC uses dashes as share-class separators (BRK-B, BF-B); Yahoo/exchanges
  // use dots (BRK.B, BF.B). Normalize to dashes for the lookup.
  const normalized = ticker.toUpperCase().replace(/\./g, "-");
  const entry = Object.values(map).find(
    (e) => e.ticker.toUpperCase() === normalized
  );
  return entry ? String(entry.cik_str) : null;
}

async function latestFilingAccession(
  cik: string
): Promise<{ accession: string; isAnnual: boolean; isForeign: boolean; priorQuarterlyAccession?: string } | null> {
  const r = await secFetch(`${DATA_SEC}/submissions/CIK${cik.padStart(10, "0")}.json`);
  if (!r.ok) return null;
  const d = await r.json();
  const recent = d.filings?.recent;
  if (!recent) return null;
  const forms = recent.form as string[];
  const accessions = recent.accessionNumber as string[];
  // filings are in reverse-chronological order — first match wins
  let qIdx = -1, kIdx = -1, fIdx = -1;
  for (let i = 0; i < forms.length; i++) {
    if (forms[i] === "10-Q" && qIdx === -1) qIdx = i;
    if (forms[i] === "10-K" && kIdx === -1) kIdx = i;
    // 20-F is the foreign-private-issuer annual analog of the 10-K. SKBL,
    // BABA, ASML, RYAAY etc. only file 20-F + 6-K — without this the XBRL
    // path returns null and we lose the annual XBRL stream entirely.
    // F-style XBRL is less consistently tagged than US issuers' but still
    // beats falling all the way through to a stale 6-K text parse.
    if (forms[i] === "20-F" && fIdx === -1) fIdx = i;
    if (qIdx !== -1 && kIdx !== -1 && fIdx !== -1) break;
  }
  // pick the most recent annual (lower index wins) between 10-K and 20-F
  let aIdx = -1;
  let aIsForeign = false;
  if (kIdx !== -1 && fIdx !== -1) {
    if (kIdx <= fIdx) { aIdx = kIdx; aIsForeign = false; }
    else              { aIdx = fIdx; aIsForeign = true;  }
  } else if (kIdx !== -1) {
    aIdx = kIdx; aIsForeign = false;
  } else if (fIdx !== -1) {
    aIdx = fIdx; aIsForeign = true;
  }
  if (qIdx === -1 && aIdx === -1) return null;
  // pick whichever is more recent (lower index = filed later)
  if (aIdx === -1 || (qIdx !== -1 && qIdx < aIdx)) {
    return { accession: accessions[qIdx], isAnnual: false, isForeign: false };
  }
  // Annual is most recent; keep prior quarterly accession so we can derive
  // Q4 = annual − YTD. Foreign 20-F filers don't file 10-Q (they file 6-K
  // interim), so priorQuarterlyAccession is always undefined for them.
  return {
    accession: accessions[aIdx],
    isAnnual: true,
    isForeign: aIsForeign,
    priorQuarterlyAccession: !aIsForeign && qIdx !== -1 ? accessions[qIdx] : undefined,
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
  const r = await secFetch(labUrl);
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
// SubsegmentsAxis = sub-segment breakdown (e.g. SKBL: Public vs Private sector
//   construction). Smaller filers (especially foreign-private issuers) tag the
//   ONLY revenue split here when no parent business-segments axis is present.
// StatementGeographicalAxis = revenue by region — used only when none of the
//   above is tagged. Better than no breakdown at all (e.g. asset managers like
//   BLK that report only by region).
const SEGMENT_AXES = ["StatementBusinessSegmentsAxis", "ProductOrServiceAxis", "SubsegmentsAxis", "StatementGeographicalAxis"];

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
  expectedEndDate?: string,
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

    // Identify which dimension (if any) names this segment. Accept:
    //   (a) exactly one dimension that is a supported segment axis, OR
    //   (b) two dimensions: a segment axis paired with
    //       ConsolidationItemsAxis=OperatingSegmentsMember — the standard
    //       "operating segments rollup" pattern. Some issuers (e.g. AON) put
    //       only metadata (goodwill, headcount) in the 1-dim segment context
    //       and tag revenue exclusively against this 2-dim rollup.
    // Reject everything else (3+ dims, Geography × Segment, IntersegmentElimination, etc.)
    // to avoid sub-segment double-counting.
    let segDim: { axis: string; member: string } | null = null;
    if (allDims.length === 1) {
      segDim = allDims[0];
    } else if (allDims.length === 2) {
      const seg  = allDims.find((d) => SEGMENT_AXES.includes(d.axis.split(":").pop() ?? ""));
      const cons = allDims.find((d) =>
        (d.axis.split(":").pop() ?? "") === "ConsolidationItemsAxis" &&
        (d.member.split(":").pop() ?? "") === "OperatingSegmentsMember"
      );
      if (seg && cons) segDim = seg;
    }
    if (!segDim) continue;
    const axisLocal = segDim.axis.split(":").pop() ?? "";
    if (!SEGMENT_AXES.includes(axisLocal)) continue;
    const memberFull = segDim.member;

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
  // Optional "Adjusted" suffix matches non-GAAP segment-revenue concepts that
  // some issuers (e.g. EL: el:RevenueFromContractWithCustomerExcludingAssessedTaxAdjusted)
  // tag instead of the standard us-gaap variant for product/business segments.
  const revPatternPre = REV_CONCEPTS.map((t) => `(?:[^:>\\s]+:)?${t}(?:Adjusted)?`).join("|");
  const preRevRe = new RegExp(
    `<(?:${revPatternPre})\\b[^>]*contextRef="([^"]+)"[^>]*>([0-9]+)<`, "g"
  );
  const ctxsWithRevData = new Set<string>();
  let prm: RegExpExecArray | null;
  while ((prm = preRevRe.exec(xml)) !== null) {
    if (parseInt(prm[2], 10) > 0) ctxsWithRevData.add(prm[1]);
  }

  // Pick the highest-priority axis that has qualifying contexts WITH revenue data.
  let chosenAxis = SEGMENT_AXES.find(a =>
    allQuarterCtxs.some(([id, c]) => c.axis === a && ctxsWithRevData.has(id))
  );
  if (!chosenAxis) return null;

  // Geographic-business-segment override: AAPL (and similar issuers whose
  // operating segments are defined geographically) tag region members on
  // StatementBusinessSegmentsAxis. The chart prefers product/service splits
  // ("iPhone, Mac, iPad, Wearables, Services") over regions ("Americas,
  // Europe, ...") because product mix is more informative for the income
  // statement. If ≥60% of the chosen axis's members look like regions AND a
  // ProductOrServiceAxis with revenue data is also available, switch to it.
  // Strip naming suffixes (Segment, Region, Geographic*) before matching so
  // "AmericasSegment", "EuropeRegion", "GreaterChinaGeographicSegment" all
  // surface their region root for the geo-test below.
  const stripSegSuffix = (s: string) =>
    s.replace(/(?:Segment|Region|Geographic(?:al)?(?:Segment)?|Reportable(?:Segment)?)+$/i, "");
  const GEO_RE = /\b(?:america|americas|north[ -]?america|south[ -]?america|latin[ -]?america|latam|europe|emea|asia|asia[ -]?pacific|apac|pacific|china|japan|korea|india|africa|middle[ -]?east|domestic|international|foreign|united[ -]?states|u\.?s\.?|usa|germany|united[ -]?kingdom|u\.?k\.?|france|italy|spain|brazil|mexico|canada|australia|greater[ -]?china|rest[ -]?of[ -]?world|row|rest[ -]?of[ -]?asia[ -]?pacific|other[ -]?countries|geograph)\b/i;
  const isGeoLabel = (name: string) => GEO_RE.test(stripSegSuffix(name));
  if (chosenAxis !== "ProductOrServiceAxis") {
    const chosenMembers = allQuarterCtxs
      .filter(([id, c]) => c.axis === chosenAxis && ctxsWithRevData.has(id))
      .map(([, c]) => c.memberLocal.replace(/Member$/, ""));
    if (chosenMembers.length > 0) {
      const geoCount = chosenMembers.filter(isGeoLabel).length;
      const geoFrac  = geoCount / chosenMembers.length;
      const productAvailable = allQuarterCtxs.some(
        ([id, c]) => c.axis === "ProductOrServiceAxis" && ctxsWithRevData.has(id),
      );
      // Threshold 0.8: AAPL (5/5 = 1.0) flips to products, AMZN (2/3 = 0.67,
      // North America + International + AWS) keeps business segments since
      // AWS is a meaningful business unit and the product/service axis there
      // collapses to a useless "Product vs Service" two-way split.
      if (geoFrac >= 0.8 && productAvailable) {
        chosenAxis = "ProductOrServiceAxis";
      }
    }
  }

  const quarterCtxs = allQuarterCtxs.filter(([, c]) => c.axis === chosenAxis);

  // When the caller knows the IS period end date, anchor segment selection to it.
  // Without this guard, a 10-K with derived Q4 IS can pick up stale dimensional
  // contexts left for narrative reasons (e.g. PFE's 2024 Paxlovid EUA/NDA disclosures)
  // that happen to fall in the quarterly day-range, mislabeling them as the
  // current period and bypassing the proper Q4 = annual − YTD derivation.
  const candidateEnds = expectedEndDate
    ? quarterCtxs.map(([, c]) => c.end).filter((e) =>
        Math.abs((Date.parse(e) - Date.parse(expectedEndDate)) / 86_400_000) <= 15)
    : quarterCtxs.map(([, c]) => c.end);
  if (candidateEnds.length === 0) return null;
  const latestEnd = candidateEnds.sort().at(-1)!;

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

  const revPattern = REV_CONCEPTS.map((t) => `(?:[^:>\\s]+:)?${t}(?:Adjusted)?`).join("|");
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

  // Drop self-aggregator: a segment whose value ≈ sum of the others (±2%) is a
  // total/parent line, not a peer. RIOT tags `riot:ReportableSegmentsMember`
  // alongside the three sub-segments — it's custom so the customValSum filter
  // above doesn't catch it. Without this, segment inflows double-count the
  // total and overflow the Revenue node.
  for (let i = 0; i < segments2.length; i++) {
    const others = segments2.reduce((s, seg, j) => (j === i ? s : s + seg.valueUSD), 0);
    if (others <= 0) continue;
    const diff = Math.abs(segments2[i].valueUSD - others) / Math.max(segments2[i].valueUSD, others);
    if (diff <= 0.02) {
      segments2.splice(i, 1);
      break;
    }
  }

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

  // Reconcile residual to consolidated revenue: if segments still overshoot
  // (intersegment eliminations the issuer doesn't tag separately, e.g. RIOT
  // ~$17M of inter-segment service fees), scale proportionally so the Sankey
  // balances at Revenue. Preserves relative composition; absolute revenue
  // total is shown on the Revenue node directly.
  if (totalRevenue > 0) {
    const allSum = segments2.reduce((s, seg) => s + seg.valueUSD, 0);
    if (allSum > totalRevenue * 1.02) {
      const k = totalRevenue / allSum;
      for (const seg of segments2) seg.valueUSD = seg.valueUSD * k;
    }
  }

  const d  = new Date(latestEnd);
  const q  = Math.floor(d.getUTCMonth() / 3) + 1;
  const yr = d.getUTCFullYear();
  const periodLabel = isAnnual ? `FY${yr}` : `Q${q} FY${yr}`;

  return {
    segments: segments2,
    segmentPeriod: periodLabel,
    geographyOnly: chosenAxis === "StatementGeographicalAxis",
  };
}

// Minimal HTML entity decoder for the text-block parser. Mirrors the
// fetchEdgar8K decodeEntities logic but inlined here to avoid a cross-module
// dependency for a single-file helper.
function decodeTextBlockEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = parseInt(h, 16);
      return code === 0xA0 ? " " : String.fromCodePoint(code);
    })
    .replace(/&#(\d+);/g, (_, n) => {
      const code = parseInt(n, 10);
      return code === 160 ? " " : String.fromCodePoint(code);
    })
    .replace(/&(amp|lt|gt|nbsp|quot|apos);/gi, (m, e) => {
      const map: Record<string, string> = { amp: "&", lt: "<", gt: ">", nbsp: " ", quot: '"', apos: "'" };
      return map[e.toLowerCase()] ?? m;
    });
}

// Convert "1,234" / "(123)" / "$1,556,856" / " - " / "—" → number | null.
// Mirrors fetchEdgar8K's parseNumber but with a tighter scope (no IFRS
// space-thousands handling, no per-share footnote markers).
function parseTextBlockNumber(cell: string): number | null {
  let s = cell.trim();
  if (!s || /^[—–-]+$/.test(s)) return null;
  const negative = /^\(.+\)$/.test(s);
  s = s.replace(/[()]/g, "").replace(/\$/g, "").replace(/,/g, "").replace(/%/g, "").trim();
  if (s === "" || s === "-") return null;
  const n = Number(s);
  if (!isFinite(n)) return null;
  return negative ? -n : n;
}

// Extract rows from an HTML table as [cell, cell, ...] arrays. Empty cells
// are dropped so adjacent currency-symbol cells ("$" sitting alone in a TD)
// don't shift the value indices.
function extractTableRows(tableHtml: string): string[][] {
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  const out: string[][] = [];
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(tableHtml)) !== null) {
    const cellRe = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
    const cells: string[] = [];
    let c: RegExpExecArray | null;
    while ((c = cellRe.exec(m[1])) !== null) {
      const text = decodeTextBlockEntities(c[1].replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ").trim();
      if (text) cells.push(text);
    }
    if (cells.length > 0) out.push(cells);
  }
  return out;
}

// Find the column-header row whose tokens look like segment names — text-only
// cells (no numbers, no $/% markers) that aren't "December 31" / year-only /
// section title headers. Returns the row's text cells (segment-name
// candidates), excluding any "Consolidated" / "Total" terminal column which
// holds the consolidated total rather than a segment value.
function findHeaderCells(rows: string[][], near: number): string[] | null {
  // Walk backward from the row preceding `near` (the Revenue row) up to 8
  // rows. The header is the last text-only row before Revenue.
  for (let i = near - 1; i >= Math.max(0, near - 8); i--) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    // All cells are text (no parseable numbers)?
    const allText = row.every((c) =>
      parseTextBlockNumber(c) === null
      && !/^\d{4}$/.test(c)              // year-only column
      && !/^December\s+31\b/i.test(c)    // RYOJ "December 31," section subheader
      && !/^Fiscal\s+year/i.test(c)
      && !/^Year(s)?\s+ended/i.test(c)
    );
    if (!allText) continue;
    // Heuristic: at least 2 cells, at least one looks like a segment name
    // (length ≥ 4, contains a letter).
    const looksLikeSegments = row.filter((c) => /[A-Za-z]{3,}/.test(c) && c.length >= 4);
    if (looksLikeSegments.length >= 2) return row;
  }
  return null;
}

// Walk a row and produce one value per column. Position-aware: currency-
// symbol / whitespace cells get skipped (they're separators), dash cells map
// to 0 (RYOJ tags "Corporate and support" revenue as "$ -" → a real $0 column,
// not a missing one). Numeric cells get parsed as-is. Unrecognized cells are
// skipped without consuming a column slot.
function parseRowValues(row: string[]): number[] {
  const values: number[] = [];
  for (let i = 1; i < row.length; i++) {
    const cell = row[i];
    if (/^[$€£¥\s]+$/.test(cell)) continue;       // separator
    if (/^[—–\-]+$/.test(cell)) { values.push(0); continue; }  // explicit zero column
    const n = parseTextBlockNumber(cell);
    if (n !== null) values.push(n);
  }
  return values;
}

// Parse a single HTML table and return segments if a Revenue/Sales row whose
// total matches `totalRevenue` is present. Returns null otherwise.
function parseSegmentTableHtml(
  tableHtml: string,
  totalRevenue: number,
): EdgarSegmentRaw[] | null {
  const rows = extractTableRows(tableHtml);
  if (rows.length < 2) return null;
  const TOL = 0.02;  // 2 % tolerance vs consolidated revenue
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;
    const label = row[0];
    if (!/^(net\s+)?(revenues?|sales|net\s+sales)\b/i.test(label)) continue;
    const nums = parseRowValues(row);
    if (nums.length < 2) continue;
    // Find which column holds the consolidated total (must match totalRevenue).
    const totalIdx = nums.findIndex((v) =>
      v > 0 && Math.abs(v - totalRevenue) / totalRevenue <= TOL,
    );
    if (totalIdx === -1) continue;
    const headers = findHeaderCells(rows, i);
    if (!headers) continue;
    // Header count ≥ value count is the typical layout. Trim from the LEFT
    // when unequal (subheader rows can pad), so the right-most "Consolidated"
    // column aligns with totalIdx.
    const startIdx = Math.max(0, headers.length - nums.length);
    const segNames = headers.slice(startIdx);
    const segments: EdgarSegmentRaw[] = [];
    for (let j = 0; j < nums.length && j < segNames.length; j++) {
      if (j === totalIdx) continue;
      const v = nums[j];
      const name = segNames[j];
      if (v <= 0) continue;
      if (/^(consolidated|total)$/i.test(name)) continue;
      segments.push({ name, valueUSD: v });
    }
    if (segments.length >= 1) return segments.sort((a, b) => b.valueUSD - a.valueUSD);
  }
  return null;
}

// Extract product-segment revenue from XBRL text-block tags when the standard
// dimensional parse failed. Foreign-private issuers (RYOJ, ...) commonly tag
// segment data only in narrative text blocks because the SRT/US-GAAP segment
// axes are inconsistently applied to revenue facts. We scan a priority list
// of text-block concepts, parse embedded HTML tables, and accept a table
// whose Revenue row's "Consolidated" value matches the issuer's known
// totalRevenue (avoids misreading a balance-sheet AR-by-segment table or a
// prior-year disaggregation).
function parseSegmentsFromTextBlock(
  xml: string,
  totalRevenue: number,
  isAnnual: boolean,
  expectedEndDate?: string,
): EdgarSegmentResult | null {
  if (!totalRevenue || totalRevenue <= 0) return null;
  const blockNames = [
    "ScheduleOfSegmentReportingInformationBySegmentTextBlock",
    "DisaggregationOfRevenueTableTextBlock",
    "ScheduleOfRevenuesFromExternalCustomersAndLongLivedAssetsTextBlock",
    "RevenueFromContractWithCustomerTextBlock",
  ];
  for (const blockName of blockNames) {
    const blockRe = new RegExp(
      `<[a-zA-Z][a-zA-Z0-9_-]*:${blockName}\\b[^>]*>([\\s\\S]*?)</[a-zA-Z][a-zA-Z0-9_-]*:${blockName}>`,
      "g",
    );
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(xml)) !== null) {
      const decoded = decodeTextBlockEntities(m[1]);
      const tableRe = /<table\b[^>]*>[\s\S]*?<\/table>/gi;
      let tm: RegExpExecArray | null;
      while ((tm = tableRe.exec(decoded)) !== null) {
        const result = parseSegmentTableHtml(tm[0], totalRevenue);
        if (result && result.length > 0) {
          // Period label from expectedEndDate (matches the IS period).
          let periodLabel = isAnnual ? "FY" : "Q";
          if (expectedEndDate) {
            const d = new Date(expectedEndDate);
            const q = Math.floor(d.getUTCMonth() / 3) + 1;
            const yr = d.getUTCFullYear();
            periodLabel = isAnnual ? `FY${yr}` : `Q${q} FY${yr}`;
          }
          return { segments: result, segmentPeriod: periodLabel };
        }
      }
    }
  }
  return null;
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
      secFetch(docUrl),
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
  // Airline-specific opex concepts. Reported by US carriers (AAL, DAL, UAL,
  // LUV...) instead of a Cost-of-Revenue / Gross-Profit structure. Detection
  // uses `fuel > 0 && salariesWages > 0` since only airlines break those out
  // as top-level expense lines.
  // FuelCostsGrossOfHedging FIRST: ALK tags FuelCosts only in 10-K but
  // FuelCostsGrossOfHedging consistently across 10-K and 10-Q, so preferring
  // it gives a usable YTD value for the Q4 derivation. Both report the same
  // dollar amount when both are present.
  fuel:            ["FuelCostsGrossOfHedging", "FuelCosts", "AirlineRelatedFuelCosts"],
  salariesWages:   ["LaborAndRelatedExpense"],
  maintenance:     ["AircraftMaintenanceMaterialsAndRepairs"],
  aircraftRental:  ["AircraftRental"],
  landingFees:     ["LandingFeesAndOtherRentals"],
  daExpense:       ["DepreciationAndAmortization", "DepreciationDepletionAndAmortization"],
  // Total opex line — used as the airline opex denominator since GP/COGS
  // aren't reported. Falls back to gp − op when this isn't tagged.
  costsAndExpenses: ["CostsAndExpenses", "OperatingCostsAndExpenses", "OperatingExpenses"],

  // Bank-specific concepts (JPM, BAC, WFC, C). Banks report Interest Income
  // and Interest Expense as the primary revenue/cost block; the difference is
  // Net Interest Income. Provision for credit losses is the bank-specific
  // analog of COGS.
  interestIncome:        ["InterestAndDividendIncomeOperating", "InterestIncomeOperating", "InterestAndFeeIncomeLoansCommercial", "InvestmentIncomeInterest"],
  interestExpense:       ["InterestExpense", "InterestExpenseOperating", "InterestExpenseDebt", "InterestExpenseBorrowings"],
  provisionForLoanLosses:["ProvisionForLoanLeaseAndOtherLosses", "ProvisionForCreditLosses", "ProvisionForLoanAndLeaseLosses"],
  noninterestIncome:     ["NoninterestIncome"],
  noninterestExpense:    ["NoninterestExpense"],

  // Insurance concepts (MET, PGR, AIG, BRK.B). Premiums earned is the
  // top-line; benefits and underwriting expense are the cost side.
  premiumsEarned:        ["PremiumsEarnedNet", "PremiumsEarnedNetPropertyAndCasualty", "PremiumsEarnedNetLifeInsurance", "InsurancePremiumsEarnedNet"],
  policyholderBenefits:  ["PolicyholderBenefitsAndClaimsIncurredNet", "BenefitsLossesAndExpenses", "LiabilityForFuturePolicyBenefitsPeriodIncreaseDecrease"],
  underwritingExpense:   ["UnderwritingExpenses", "InsuranceCommissions", "DeferredPolicyAcquisitionCostAmortizationExpense"],

  // REIT concepts (AMT, PLD, EQIX, O). Rental income dominates revenue;
  // OperatingExpenses on the IS captures property opex when grossProfit is
  // zero.
  rentalIncome:          ["OperatingLeaseLeaseIncome", "OperatingLeasesIncomeStatementLeaseRevenue", "RentalIncomeNonoperating", "OperatingLeaseLeaseIncomeLeasePayments"],

  // Asset manager concepts (BLK, KKR, APO). Management + performance fees
  // are the revenue split; compensation is the dominant cost.
  managementFees:        ["InvestmentAdvisoryFees", "InvestmentAdvisoryManagementAndAdministrativeFees", "AssetManagementFees1", "InvestmentAdvisoryFeeAmount"],
  performanceFees:       ["PerformanceAllocationsRevenue", "InvestmentBankingFeesPerformanceFees"],
  compensationExpense:   ["LaborAndRelatedExpense", "EmployeeBenefitsAndShareBasedCompensation", "SalariesAndWages"],

  // Cross-industry opex sub-buckets (rendered as optional nodes when present).
  stockBasedComp:        ["ShareBasedCompensation", "AllocatedShareBasedCompensationExpense", "StockBasedCompensation"],
  impairment:            ["AssetImpairmentCharges", "GoodwillImpairmentLoss", "ImpairmentOfIntangibleAssetsExcludingGoodwill", "ImpairmentOfIntangibleAssetsIndefinitelivedExcludingGoodwill"],
  restructuring:         ["RestructuringCharges", "SeveranceCosts1", "BusinessExitCosts1"],
  gainLossOnSale:        ["GainLossOnSaleOfPropertiesNetOfApplicableIncomeTaxes", "GainLossOnDispositionOfAssets", "GainLossOnSaleOfPropertyPlantEquipment"],
  // Standard-profile opex sub-buckets. Surfaced when the issuer breaks OpEx
  // into payroll / rent / advertising / D&A as separate lines (RYOJ rYojbaba
  // and other foreign-private issuers commonly do; some US small-caps too).
  // The fetchSegmentData consumer guards against double-counting by only
  // emitting these when (G&A + payroll + rent + adv + D&A) reconciles to the
  // tagged OperatingExpenses total — i.e. the issuer has *separated* payroll
  // from G&A. For typical SaaS/tech where payroll sits *inside* G&A, the
  // reconciliation fails and the buckets stay hidden.
  payroll:               ["PayrollExpenses", "PayrollExpense"],
  rentExpense:           ["RentAndLease", "OperatingLeaseExpense", "OperatingLeaseRentExpense"],
  advertising:           ["AdvertisingExpense"],
  // Tagged separately from `daExpense` (which is reserved for the airline /
  // oil-gas / pre-revenue paths). Same concept list — surfaced only when the
  // issuer breaks D&A out as its own opex line.
  daExpenseStandard:     ["DepreciationAndAmortization", "DepreciationDepletionAndAmortization"],

  // Oil & gas-specific opex lines. Integrated majors (XOM, CVX) and E&Ps
  // tag these alongside the generic CostsAndExpenses total — surfacing them
  // splits the otherwise-monolithic "Op. Costs" node into D&A / Other Taxes
  // / Exploration / SG&A / Purchases (residual = crude + refined product
  // purchases + production & manufacturing, which aren't tagged separately).
  taxesOther:            ["TaxesOther", "ExciseAndSalesTaxes"],
  explorationExpense:    ["ExplorationExpense", "ExplorationAbandonmentAndDryHoleCosts"],
};

export interface EdgarIncomeStatement {
  period: string;       // e.g. "Q2 FY2026"
  endDate: string;      // YYYY-MM-DD — period end date from XBRL
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
  // Airline-specific opex lines. Zero for non-airline issuers.
  fuel: number;
  salariesWages: number;
  maintenance: number;
  aircraftRental: number;
  landingFees: number;
  daExpense: number;
  costsAndExpenses: number; // total opex for issuers without a GP/COGS layer
  // Bank-specific lines. Zero for non-bank issuers.
  interestIncome: number;
  interestExpense: number;
  provisionForLoanLosses: number;
  noninterestIncome: number;
  noninterestExpense: number;
  // Insurance-specific lines. Zero for non-insurance issuers.
  premiumsEarned: number;
  policyholderBenefits: number;
  underwritingExpense: number;
  // REIT-specific.
  rentalIncome: number;
  // Asset-manager-specific.
  managementFees: number;
  performanceFees: number;
  compensationExpense: number;
  // Cross-industry opex sub-buckets (optional, populated when XBRL-tagged).
  stockBasedComp: number;
  impairment: number;
  restructuring: number;
  gainLossOnSale: number;
  // Oil & gas-specific opex lines. Zero for non-oil-gas issuers.
  taxesOther: number;
  explorationExpense: number;
  // Standard-profile opex sub-buckets (surfaced when reconciling to OpEx total).
  payroll: number;
  rentExpense: number;
  advertising: number;
  daExpenseStandard: number;
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
  // Filters by unitRef to USD-only. Multi-currency disclosures occur even on
  // USD-reporting issuers — RYOJ for example tags ImpairmentOfIntangibles with
  // both unitRef="USD" and unitRef="CNY" in the same FY context. Without this
  // filter, document order alone decides which value wins; if the CNY fact
  // happened to come first, the parser would treat 54.6M CNY as $54.6M USD.
  function firstVal(concepts: string[], ctxSet: Set<string>): number {
    for (const concept of concepts) {
      const re = new RegExp(`<[^:>\\s]+:?${concept}\\b([^>]*?)>(-?[0-9]+)<`, "g");
      let hit: RegExpExecArray | null;
      while ((hit = re.exec(xml)) !== null) {
        const attrs = hit[1];
        const ctxM = attrs.match(/contextRef="([^"]+)"/);
        if (!ctxM || !ctxSet.has(ctxM[1])) continue;
        const unitM = attrs.match(/unitRef="([^"]+)"/);
        if (unitM && !/USD/i.test(unitM[1])) continue;
        return parseInt(hit[2], 10);
      }
    }
    return 0;
  }

  // Bank / insurance / REIT concepts extracted up-front so we can derive a
  // synthetic revenue when the standard `Revenue` concepts aren't tagged in
  // plain (non-dimensional) context. JPM, BAC etc. tag `Revenues` only in
  // segment rollups; their plain context exposes interest/noninterest income
  // separately. Without this fallback the IS extractor returns null and the
  // pipeline falls all the way through to Yahoo TTM.
  const interestIncomeEarly    = firstVal(IS_CONCEPTS.interestIncome,    currentIds);
  const interestExpenseEarly   = firstVal(IS_CONCEPTS.interestExpense,   currentIds);
  const noninterestIncomeEarly = firstVal(IS_CONCEPTS.noninterestIncome, currentIds);
  const premiumsEarnedEarly    = firstVal(IS_CONCEPTS.premiumsEarned,    currentIds);
  const rentalIncomeEarly      = firstVal(IS_CONCEPTS.rentalIncome,      currentIds);

  let rev = firstVal(IS_CONCEPTS.revenue, currentIds);
  if (rev <= 0) {
    // Bank: Total Net Revenue = (Interest Income − Interest Expense) + Noninterest Income
    if (interestIncomeEarly > 0 && noninterestIncomeEarly > 0) {
      rev = Math.max(0, interestIncomeEarly - interestExpenseEarly) + noninterestIncomeEarly;
    } else if (premiumsEarnedEarly > 0) {
      // Insurance: Premiums Earned alone is a usable revenue proxy. Investment
      // income, when tagged, would push the total higher — but Premiums-only
      // is preferable to the null/Yahoo fallback.
      rev = premiumsEarnedEarly;
    } else if (rentalIncomeEarly > 0) {
      // REIT: Rental Income is the dominant top-line. Use it as revenue.
      rev = rentalIncomeEarly;
    }
  } else {
    // REIT split-revenue case: AMT, PLD and similar REITs tag part of their
    // revenue as RevenueFromContractWithCustomer (services / management fees
    // — typically a small slice) and the bulk as OperatingLeaseLeaseIncome
    // (the rental stream). Without this adjustment the parser picks up only
    // the small services slice and the Sankey shows revenue ≪ rental income,
    // producing a >100 % "margin" on Net Income. Sum the two when rental
    // dominates the standard revenue tag by 2× or more.
    if (rentalIncomeEarly > rev * 2) {
      rev = rev + rentalIncomeEarly;
    }
    // Insurance split-revenue: similar pattern when only investment-income is
    // tagged as Revenues but premiums are the bulk of the top-line.
    if (premiumsEarnedEarly > rev * 2) {
      rev = rev + premiumsEarnedEarly;
    }
  }
  // Pre-revenue issuers (NextDecade-style LNG developers, clinical-stage
  // biotech before first sale, dev-stage SPACs) tag Revenues=0 but still
  // have meaningful G&A / R&D / D&A / Net Loss data. Allow rev=0 to flow
  // through if any loss-side signal is present so the Sankey can render a
  // "burn" view (Net Loss → cost buckets). Otherwise bail — a filing with
  // zero everything is unrenderable.
  if (rev <= 0) {
    const niPeek = firstVal(IS_CONCEPTS.netIncome, currentIds);
    const opPeek = firstVal(IS_CONCEPTS.operatingIncome, currentIds);
    const opexPeek = firstVal(["OperatingExpenses"], currentIds);
    const gaPeek = firstVal(IS_CONCEPTS.generalAdmin, currentIds);
    if (niPeek === 0 && opPeek === 0 && opexPeek === 0 && gaPeek === 0) return null;
  }

  const gp        = firstVal(IS_CONCEPTS.grossProfit,     currentIds);
  const directCogs = firstVal(IS_CONCEPTS.costOfRevenue,  currentIds);
  // Only derive cogs from (rev − gp) when GP is explicitly tagged. For
  // service issuers (e.g. MA, V) that report neither GP nor COGS, leaving
  // cogs at 0 lets the Sankey render the "Op Income / Total Costs" branch
  // instead of falsely showing a 100 %-of-revenue cost line.
  const cogs = directCogs > 0 ? directCogs : (gp > 0 ? Math.max(0, rev - gp) : 0);
  const op   = firstVal(IS_CONCEPTS.operatingIncome, currentIds);
  // Net income: prefer NetIncomeLoss (already net of noncontrolling interest).
  // Fall back to ProfitLoss − NCI for issuers (Mastercard) that only tag the
  // consolidated profit and NCI separately, expecting subtraction.
  let ni = firstVal(IS_CONCEPTS.netIncome, currentIds);
  if (ni === 0) {
    const profitLoss = firstVal(["ProfitLoss"], currentIds);
    if (profitLoss !== 0) {
      const nci = firstVal(["NetIncomeLossAttributableToNoncontrollingInterest"], currentIds);
      ni = profitLoss - nci;
    }
  }
  if (ni === 0) {
    // BKNG (and similar) tag NetIncomeLoss only in dimensional contexts
    // (RetainedEarnings rollforward) and leave the plain consolidated context
    // with only NetIncomeLossAvailableToCommonStockholdersBasic. Recover NI by
    // adding back preferred dividends if separately reported.
    const niCommon = firstVal(["NetIncomeLossAvailableToCommonStockholdersBasic"], currentIds);
    if (niCommon !== 0) {
      const prefDiv = firstVal(
        ["PreferredStockDividendsAndOtherAdjustments", "PreferredStockDividends"],
        currentIds,
      );
      ni = niCommon + prefDiv;
    }
  }
  const rd   = firstVal(IS_CONCEPTS.rd,              currentIds);
  const sm   = firstVal(IS_CONCEPTS.salesMarketing,  currentIds);
  const ga   = firstVal(IS_CONCEPTS.generalAdmin,    currentIds);
  const sga  = firstVal(IS_CONCEPTS.sga,             currentIds);
  const tax  = firstVal(IS_CONCEPTS.tax,             currentIds);
  const ibt  = firstVal(IS_CONCEPTS.incomeBeforeTax, currentIds) || Math.max(0, ni + tax);
  const fuel             = firstVal(IS_CONCEPTS.fuel,             currentIds);
  const salariesWages    = firstVal(IS_CONCEPTS.salariesWages,    currentIds);
  const maintenance      = firstVal(IS_CONCEPTS.maintenance,      currentIds);
  const aircraftRental   = firstVal(IS_CONCEPTS.aircraftRental,   currentIds);
  const landingFees      = firstVal(IS_CONCEPTS.landingFees,      currentIds);
  const daExpense        = firstVal(IS_CONCEPTS.daExpense,        currentIds);
  const costsAndExpenses = firstVal(IS_CONCEPTS.costsAndExpenses, currentIds);
  // Bank — interestIncome/Expense and noninterestIncome already extracted at
  // the top of the function (used to derive synthetic revenue when the
  // standard `Revenue` concepts aren't tagged in plain context).
  const interestIncome         = interestIncomeEarly;
  const interestExpense        = interestExpenseEarly;
  const provisionForLoanLosses = firstVal(IS_CONCEPTS.provisionForLoanLosses, currentIds);
  const noninterestIncome      = noninterestIncomeEarly;
  const noninterestExpense     = firstVal(IS_CONCEPTS.noninterestExpense,     currentIds);
  // Insurance
  const premiumsEarned       = premiumsEarnedEarly;
  const policyholderBenefits = firstVal(IS_CONCEPTS.policyholderBenefits, currentIds);
  const underwritingExpense  = firstVal(IS_CONCEPTS.underwritingExpense,  currentIds);
  // REIT — rentalIncome already extracted at top of function for split-revenue
  // detection; reuse the early value here.
  const rentalIncome = rentalIncomeEarly;
  // Asset manager
  const managementFees      = firstVal(IS_CONCEPTS.managementFees,      currentIds);
  const performanceFees     = firstVal(IS_CONCEPTS.performanceFees,     currentIds);
  const compensationExpense = firstVal(IS_CONCEPTS.compensationExpense, currentIds);
  // Cross-industry opex
  const stockBasedComp = firstVal(IS_CONCEPTS.stockBasedComp, currentIds);
  const impairment     = firstVal(IS_CONCEPTS.impairment,     currentIds);
  const restructuring  = firstVal(IS_CONCEPTS.restructuring,  currentIds);
  const gainLossOnSale = firstVal(IS_CONCEPTS.gainLossOnSale, currentIds);
  // Oil & gas opex
  const taxesOther         = firstVal(IS_CONCEPTS.taxesOther,         currentIds);
  const explorationExpense = firstVal(IS_CONCEPTS.explorationExpense, currentIds);
  // Standard-profile opex sub-buckets
  const payroll           = firstVal(IS_CONCEPTS.payroll,           currentIds);
  const rentExpense       = firstVal(IS_CONCEPTS.rentExpense,       currentIds);
  const advertising       = firstVal(IS_CONCEPTS.advertising,       currentIds);
  const daExpenseStandard = firstVal(IS_CONCEPTS.daExpenseStandard, currentIds);

  // Y/Y revenue. Mirrors the same split-revenue / synthetic-bank derivation
  // applied to the current period so both numerator and denominator come
  // from the same definition of "revenue" — without this an AMT-style REIT
  // would compare current (rental + services) against prior (services-only)
  // and report a fake +1000% Y/Y.
  let prevRev = firstVal(IS_CONCEPTS.revenue, priorIds);
  const prevRental = firstVal(IS_CONCEPTS.rentalIncome, priorIds);
  const prevPrem   = firstVal(IS_CONCEPTS.premiumsEarned, priorIds);
  const prevII     = firstVal(IS_CONCEPTS.interestIncome, priorIds);
  const prevIE     = firstVal(IS_CONCEPTS.interestExpense, priorIds);
  const prevNonII  = firstVal(IS_CONCEPTS.noninterestIncome, priorIds);
  if (prevRev <= 0) {
    if (prevII > 0 && prevNonII > 0) {
      prevRev = Math.max(0, prevII - prevIE) + prevNonII;
    } else if (prevPrem > 0) {
      prevRev = prevPrem;
    } else if (prevRental > 0) {
      prevRev = prevRental;
    }
  } else {
    if (prevRental > prevRev * 2) prevRev = prevRev + prevRental;
    if (prevPrem   > prevRev * 2) prevRev = prevRev + prevPrem;
  }
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
    endDate: latestEnd,
    currency: "USD",
    revenue: rev, grossProfit: gp, costOfRevenue: cogs,
    operatingIncome: op, netIncome: ni,
    rd, salesMarketing: sm, generalAdmin: ga, sga, tax,
    incomeBeforeTax: ibt,
    revenueYoy,
    fuel, salariesWages, maintenance, aircraftRental, landingFees, daExpense,
    costsAndExpenses,
    interestIncome, interestExpense, provisionForLoanLosses,
    noninterestIncome, noninterestExpense,
    premiumsEarned, policyholderBenefits, underwritingExpense,
    rentalIncome,
    managementFees, performanceFees, compensationExpense,
    stockBasedComp, impairment, restructuring, gainLossOnSale,
    taxesOther, explorationExpense,
    payroll, rentExpense, advertising, daExpenseStandard,
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

    const xbrlRes = await secFetch(docUrl);
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
  isAnnual:        boolean;
  // True when the latest annual filing is a 20-F (foreign-private issuer)
  // rather than a 10-K. Used to label the source as "20-F" instead of "10-K"
  // and to set user expectations: 20-F filers don't file quarterly statements,
  // so the most recent IS data is always the annual filing (no Q1/Q2/Q3 to
  // show until the next 6-K with interim financials lands).
  isForeign:       boolean;
  sicCode?:        string;  // 4-digit SIC industry code, used as profile tiebreaker
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

    // Merge facts from ALL revenue concepts before deriving Q4 — companies
    // (especially industrials like 3M) sometimes switch concepts between
    // filings, so any single concept can have gaps that another fills.
    const quarterly = new Map<string, { val: number; filed: string; start: string }>();
    const annual    = new Map<string, { val: number; start: string; filed: string }>();

    // Iterate concepts sequentially with early termination: most US issuers
    // populate the first concept (RevenueFromContractWithCustomerExcludingAssessedTax)
    // with a complete history, in which case the remaining 4 fetches add
    // nothing. Only fall through to additional concepts when the running
    // dataset is missing recent quarters — covers concept-switching issuers
    // (3M, CAT) without burning 5 SEC requests on every analysis.
    const conceptResponses: Array<{
      units?: { USD?: Array<{ start?: string; end: string; val: number; filed?: string }> };
    } | null> = [];
    const haveRecentEnough = (): boolean => {
      // Stop fetching once we have at least 4 quarters in the last 18 months
      // — enough to render the chart and back-fill via Q4 = annual − Q1+Q2+Q3.
      const cutoff = Date.now() - 18 * 30 * 86_400_000;
      let recent = 0;
      for (const end of quarterly.keys()) {
        if (Date.parse(end) >= cutoff) recent++;
      }
      return recent >= 4;
    };
    for (const concept of REV_CONCEPTS) {
      const url = `${DATA_SEC}/api/xbrl/companyconcept/CIK${cikPadded}/us-gaap/${concept}.json`;
      // companyconcept returns append-only XBRL facts (each filed quarter
      // is immutable once reported); a long cache TTL is safe and slashes
      // SEC traffic when multiple tickers reuse cached responses.
      const r = await secFetch(url, 86400);
      if (!r.ok) {
        conceptResponses.push(null);
        continue;
      }
      const data = (await r.json()) as {
        units?: { USD?: Array<{ start?: string; end: string; val: number; filed?: string }> };
      };
      conceptResponses.push(data);
      // Merge this concept's facts into the running maps so haveRecentEnough()
      // reflects the full state before deciding to fetch the next concept.
      const facts = data?.units?.USD;
      if (Array.isArray(facts)) {
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
      }
      if (haveRecentEnough()) break;
    }

    // The merge above already populated quarterly/annual; the legacy loop is
    // a no-op when conceptResponses is freshly built, but kept as a safety
    // net in case future refactors add other producers of conceptResponses.
    for (const data of conceptResponses) {
      const facts = data?.units?.USD;
      if (!Array.isArray(facts)) continue;

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
    }

    if (quarterly.size === 0) return null;

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

    return result.length > 0 ? result : null;
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
      secFetch(docUrl),
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
        const priorRes = await secFetch(priorDocUrl);
        if (priorRes.ok) {
          const priorXml = await priorRes.text();
          priorXmlForSegments = priorXml; // keep for segment derivation below
          // Q3 10-Q contains a 9M YTD context (≈265-285 days from fiscal year start)
          const ytd = extractISFromXbrl(priorXml, false, { min: 250, max: 290 });
          // Trigger Q4 derivation when annual exceeds YTD on EITHER revenue
          // (normal issuer) OR opex (pre-revenue: rev=0 on both sides; the only
          // non-zero monotonically-increasing line is costsAndExpenses).
          // Without the opex path, INDP-style biotech 10-Ks fall through to
          // showing the full FY annual instead of the Q4 quarter.
          const revSignal  = ytd && ytd.revenue > 0 && annualIS.revenue > ytd.revenue;
          const opexSignal = ytd && ytd.costsAndExpenses > 0
            && annualIS.costsAndExpenses > ytd.costsAndExpenses;
          if (ytd && (revSignal || opexSignal)) {
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

            // Sanity guard against concept-tag inconsistencies between the
            // 10-K and prior 10-Q. If the issuer tags a concept in the annual
            // filing but uses a different concept (or omits it) in the YTD
            // filing, the firstVal lookup returns 0 for YTD and the
            // subtraction yields the FULL annual as Q4 — wildly wrong.
            // Zero suspicious values (annual significant, ytd 0, derived ≈ annual)
            // and let the Other-Op residual in the Sankey absorb them.
            const safeQ4 = (annual: number, ytd: number): number => {
              const derived = annual - ytd;
              if (annual > 0 && ytd === 0 && derived > annual * 0.6) return 0;
              if (derived < 0) return 0;
              return derived;
            };

            incomeStatement = {
              period:           `Q4 FY${yr}`,
              endDate:          annualIS.endDate,
              currency:         annualIS.currency,
              revenue:          q4Rev,
              grossProfit:      q4Gp,
              costOfRevenue:    q4Cogs,
              operatingIncome:  annualIS.operatingIncome  - ytd.operatingIncome,
              netIncome:        annualIS.netIncome        - ytd.netIncome,
              rd:               safeQ4(annualIS.rd,               ytd.rd),
              salesMarketing:   safeQ4(annualIS.salesMarketing,   ytd.salesMarketing),
              generalAdmin:     safeQ4(annualIS.generalAdmin,     ytd.generalAdmin),
              sga:              safeQ4(annualIS.sga,              ytd.sga),
              tax:              annualIS.tax              - ytd.tax,
              incomeBeforeTax:  annualIS.incomeBeforeTax  - ytd.incomeBeforeTax,
              fuel:             safeQ4(annualIS.fuel,             ytd.fuel),
              salariesWages:    safeQ4(annualIS.salariesWages,    ytd.salariesWages),
              maintenance:      safeQ4(annualIS.maintenance,      ytd.maintenance),
              aircraftRental:   safeQ4(annualIS.aircraftRental,   ytd.aircraftRental),
              landingFees:      safeQ4(annualIS.landingFees,      ytd.landingFees),
              daExpense:        safeQ4(annualIS.daExpense,        ytd.daExpense),
              costsAndExpenses: safeQ4(annualIS.costsAndExpenses, ytd.costsAndExpenses),
              interestIncome:         safeQ4(annualIS.interestIncome,         ytd.interestIncome),
              interestExpense:        safeQ4(annualIS.interestExpense,        ytd.interestExpense),
              provisionForLoanLosses: safeQ4(annualIS.provisionForLoanLosses, ytd.provisionForLoanLosses),
              noninterestIncome:      safeQ4(annualIS.noninterestIncome,      ytd.noninterestIncome),
              noninterestExpense:     safeQ4(annualIS.noninterestExpense,     ytd.noninterestExpense),
              premiumsEarned:         safeQ4(annualIS.premiumsEarned,         ytd.premiumsEarned),
              policyholderBenefits:   safeQ4(annualIS.policyholderBenefits,   ytd.policyholderBenefits),
              underwritingExpense:    safeQ4(annualIS.underwritingExpense,    ytd.underwritingExpense),
              rentalIncome:           safeQ4(annualIS.rentalIncome,           ytd.rentalIncome),
              managementFees:         safeQ4(annualIS.managementFees,         ytd.managementFees),
              performanceFees:        safeQ4(annualIS.performanceFees,        ytd.performanceFees),
              compensationExpense:    safeQ4(annualIS.compensationExpense,    ytd.compensationExpense),
              stockBasedComp:         safeQ4(annualIS.stockBasedComp,         ytd.stockBasedComp),
              impairment:             safeQ4(annualIS.impairment,             ytd.impairment),
              restructuring:          safeQ4(annualIS.restructuring,          ytd.restructuring),
              gainLossOnSale:         safeQ4(annualIS.gainLossOnSale,         ytd.gainLossOnSale),
              taxesOther:             safeQ4(annualIS.taxesOther,             ytd.taxesOther),
              explorationExpense:     safeQ4(annualIS.explorationExpense,     ytd.explorationExpense),
              payroll:                safeQ4(annualIS.payroll,                ytd.payroll),
              rentExpense:            safeQ4(annualIS.rentExpense,            ytd.rentExpense),
              advertising:            safeQ4(annualIS.advertising,            ytd.advertising),
              daExpenseStandard:      safeQ4(annualIS.daExpenseStandard,      ytd.daExpenseStandard),
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
      ? parseXbrl(xml, labelsData, true,  incomeStatement.revenue, undefined, incomeStatement.endDate)
      : parseXbrl(xml, labelsData, false, incomeStatement.revenue, undefined, incomeStatement.endDate);

    // Text-block fallback for foreign-private issuers (RYOJ ...) whose XBRL
    // tags ProductOrServiceAxis only on balance-sheet items (AR by segment),
    // leaving revenue undimensional. Their disaggregation lives in narrative
    // text blocks instead — `ScheduleOfSegmentReportingInformationBySegmentTextBlock`
    // is the most common host. The parser anchors on the Revenue row whose
    // "Consolidated" total matches `incomeStatement.revenue` so we don't pick
    // up a stale prior-period table by accident.
    if (!segmentResult && incomeStatement.revenue > 0) {
      segmentResult = parseSegmentsFromTextBlock(
        xml, incomeStatement.revenue, usedAnnual, incomeStatement.endDate,
      );
    }

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
          // Under-sum (e.g. ULCC tags only Passenger but not the smaller
          // ancillary stream) is handled by an "Other" backfill in the
          // fetchSegmentData consumer.
          segmentResult = { segments: q4Segs, segmentPeriod: incomeStatement.period };
        }
      }
    }

    const sicCode = await fetchSicCode(cik) ?? undefined;
    return {
      incomeStatement, segmentResult,
      isAnnual: filing.isAnnual,
      isForeign: filing.isForeign,
      sicCode,
    };
  } catch {
    return null;
  }
}
