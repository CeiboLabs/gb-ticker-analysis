/**
 * Parses the income statement table from a company's most recent earnings 8-K
 * (item 2.02) attachment on SEC EDGAR. The 8-K is filed the same day as the
 * press release, so this gives us the real headline numbers days before the
 * structured XBRL of the 10-Q lands.
 *
 * Approach:
 *   1. Find the latest 8-K with an item-2.02 reference (or fall back to the
 *      most recent 8-K filed after the latest 10-Q/10-K).
 *   2. Resolve Exhibit 99.1 URL from the filing's index page.
 *   3. Score every <table> in the exhibit's HTML by how many income-statement
 *      keywords it contains; pick the highest-scoring one.
 *   4. For each row in that table, extract the line label and the first
 *      numeric column (the most recent quarter).
 *   5. Validate: rev > 0; if cogs+gp ~ rev (within 2%) treat parse as solid.
 *
 * Fragile by nature — every issuer formats its press release differently.
 * Returns null on any parse failure so callers fall back to estimates.
 */
import { secFetch, resolveCIK } from "@/lib/fetchEdgarSegments";

const SEC = "https://www.sec.gov";
const DATA_SEC = "https://data.sec.gov";

export interface Edgar8KSegment {
  name: string;
  value: number; // already scaled to dollars
}

export interface Edgar8KIncomeStatement {
  endDate: string;
  // SEC form type the values came from — used to attribute the chart source
  // ("6-K" for foreign issuers, "8-K" for US press releases).
  form?: "8-K" | "6-K";
  // True when the parsed IS columns cover a full fiscal year ("year ended").
  // IFRS issuers (LATAM/LTM) file annual-only 6-Ks at fiscal year end with
  // no quarterly column — without this flag we'd mislabel the FY values as
  // Q4. Defaults to false (quarterly) for the typical 8-K case.
  isAnnual?: boolean;
  // True when the parsed IS columns cover a six-month interim ("six months
  // ended" / "half-year"). Foreign private issuers from jurisdictions that
  // require only semiannual reporting (Hong Kong: SKBL, ANPA; UK; many EU)
  // ship a single H1 6-K plus the 20-F annual — no Q1/Q3 quarterlies. The
  // label builder uses this to render "H1 FY{x}" instead of "Q3 FY{x}".
  isSemiAnnual?: boolean;
  // Last calendar month of the issuer's fiscal year (1-12). Read from
  // submissions JSON (`fiscalYearEnd: "MMDD"`). Used to translate a
  // calendar endDate into the issuer's fiscal year — without this, a
  // SKBL-style March-fiscal issuer reporting Sep 30 looks like Q3 FY{cal-yr}
  // when it's actually H1 FY{cal-yr+1}.
  fiscalYearEndMonth?: number;
  totalRevenue: number;
  costOfRevenue: number | null;
  grossProfit: number | null;
  researchDevelopment: number | null;
  sellingGeneralAdministrative: number | null;
  // Set when the issuer reports Sales & Marketing as its own IS line (BABA,
  // NIO, JD, PDD, BIDU, …) instead of a combined SG&A row. When both
  // salesMarketing and generalAdmin are populated, the Sankey emits two
  // separate opex buckets; falls back to sellingGeneralAdministrative for
  // US-style combined reporters.
  salesMarketing: number | null;
  // Set when the issuer reports General & Administrative as its own line
  // (Chinese ADRs, many foreign IFRS-by-function filers).
  generalAdmin: number | null;
  totalOperatingExpenses: number | null;
  operatingIncome: number | null;
  interestExpense: number | null;
  incomeBeforeTax: number | null;
  incomeTaxExpense: number | null;
  netIncome: number;
  // Airline-specific opex lines (US carriers report these instead of COGS/GP).
  // Null for non-airline issuers.
  aircraftFuel: number | null;
  salariesWages: number | null;
  aircraftMaintenance: number | null;
  aircraftRent: number | null;
  landingFees: number | null;
  depreciationAmortization: number | null;
  segments?: Edgar8KSegment[];
  // ISO 4217 currency code of the values above. USD when omitted (the typical
  // 8-K case); foreign issuers report in EUR/GBP/CHF/JPY etc. Caller is
  // responsible for FX conversion if it wants USD-denominated output.
  currency?: string;
  // Provenance — populated by fetchEdgar8KIncomeStatement so callers (the
  // monitor) can record where the parsed values came from. Lets Claude Code
  // re-fetch the filing and inspect the source table when a finding flags
  // imbalanced flows.
  cik?: string;
  accession?: string;
  sourceUrl?: string;
}

interface FilingMatch {
  form: string;
  accession: string;
  filingDate: string;
  reportDate?: string;
  primaryDocument?: string;
  // Total filing size in bytes (sum of all docs). Used to skip cover-only
  // 6-Ks (insider/AGM/dividend disclosures, typically <100KB) without
  // paying the cost of an index fetch.
  size?: number;
}

// Returns earnings-release filing candidates ordered by signal strength.
// Foreign private issuers file many 6-Ks per year (insider transactions,
// dividend declarations, board changes, ESG, ...) — only ~4 are earnings.
// Caller iterates candidates until one parses, so non-earnings 6-Ks get
// filtered out at the exhibit-resolution / parse step rather than here.
async function findEarnings8KCandidates(
  cik: string,
): Promise<{ candidates: FilingMatch[]; fiscalYearEndMonth?: number }> {
  // Submissions JSON is the discovery endpoint for newly filed 8-K/6-K. SEC
  // updates it within minutes of a filing. The default secFetch TTL of 6h
  // would delay earnings detection by hours after a press release — bad UX
  // when the user is checking back the morning after an after-hours release.
  // 30 min keeps SEC traffic in check while making the lag tolerable.
  const r = await secFetch(`${DATA_SEC}/submissions/CIK${cik.padStart(10, "0")}.json`, 1800);
  if (!r.ok) return { candidates: [] };
  const d = await r.json();
  const recent = d.filings?.recent;
  if (!recent) return { candidates: [] };

  // SEC submissions JSON exposes `fiscalYearEnd` as "MMDD" (e.g. "0331" for
  // SKBL, "0928" for AAPL). Parse the month so we can convert calendar
  // endDate → issuer's fiscal year + period number downstream.
  const fyeRaw = typeof d.fiscalYearEnd === "string" ? d.fiscalYearEnd : undefined;
  let fiscalYearEndMonth = fyeRaw && /^\d{4}$/.test(fyeRaw)
    ? Math.max(1, Math.min(12, parseInt(fyeRaw.slice(0, 2), 10)))
    : undefined;

  const forms        = (recent.form ?? []) as string[];
  const accessions   = (recent.accessionNumber ?? []) as string[];
  const filingDates  = (recent.filingDate ?? []) as string[];
  const reportDates  = (recent.reportDate ?? []) as string[];
  const items        = (recent.items ?? []) as string[];
  const primaryDocs  = (recent.primaryDocument ?? []) as string[];
  const sizes        = (recent.size ?? []) as number[];

  // Fallback: foreign private issuers that just IPO'd (SKBL, ANPA, ACCL, ...)
  // sometimes leave the top-level `fiscalYearEnd` blank in submissions JSON.
  // Their most recent annual report's reportDate IS the fiscal year-end —
  // 20-F (foreign) or 10-K (US). Use the month of that date to infer FYE so
  // semiannual interim labeling works correctly. Calendar-year (Dec) is the
  // last-resort default; downstream callers treat undefined as December.
  if (fiscalYearEndMonth === undefined) {
    for (let i = 0; i < forms.length; i++) {
      if (forms[i] !== "20-F" && forms[i] !== "10-K") continue;
      const rd = reportDates[i];
      if (!rd || !/^\d{4}-\d{2}-\d{2}$/.test(rd)) continue;
      fiscalYearEndMonth = parseInt(rd.slice(5, 7), 10);
      break;
    }
  }

  const out: FilingMatch[] = [];
  const seen = new Set<string>();
  const push = (i: number) => {
    if (seen.has(accessions[i])) return;
    seen.add(accessions[i]);
    out.push({
      form: forms[i],
      accession: accessions[i],
      filingDate: filingDates[i],
      reportDate: reportDates[i],
      primaryDocument: primaryDocs[i],
      size: sizes[i],
    });
  };

  // 1. 8-K with Item 2.02 — explicit "Results of Operations" disclosure
  for (let i = 0; i < forms.length; i++) {
    if (forms[i] === "8-K" && items[i] && /\b2\.02\b/.test(items[i])) {
      push(i);
      break;
    }
  }

  // 2. Most recent 8-K filed before the latest 10-Q/10-K — covers issuers
  //    that file the earnings 8-K without populating the items metadata
  let latest10QK = -1;
  for (let i = 0; i < forms.length; i++) {
    if (forms[i] === "10-Q" || forms[i] === "10-K") { latest10QK = i; break; }
  }
  if (latest10QK !== -1) {
    for (let i = 0; i < latest10QK; i++) {
      if (forms[i] === "8-K") { push(i); break; }
    }
  }

  // 3. Foreign private issuers (SPOT, BABA, NIO, ASML, TSM, NOK, RYAAY, ...)
  //    don't file 8-K / 10-Q / 10-K — they file 6-K (interim) and 20-F
  //    (annual). Earnings carry the press release as Exhibit 99.x (BABA,
  //    SPOT, ASML) OR embed the entire interim report inside the 6-K cover
  //    doc itself (NOK, RYAAY).
  //
  //    Skip cover-only-sized filings (<30KB — insider holdings, AGM
  //    notices, dividend updates, share-buyback announcements, board changes)
  //    at discovery time so the candidate cap counts only substantive
  //    disclosures. Without the size filter, chatty filers like RYAAY (~50
  //    routine insider 6-Ks per quarter) burn through the cap before reaching
  //    the earnings 6-K. The 30KB threshold (was 100KB) lets through compact
  //    H1 reports from small Japanese FPIs — RYOJ's H1 2025 6-K is ~62KB
  //    total, with the IS-bearing exhibit at ~44KB. Anything genuinely
  //    cover-only is <20KB; the parser rejects non-IS pages on its own so
  //    a slightly looser threshold just costs a few extra index fetches per
  //    ticker. Cap at 30 substantive 6-Ks ≈ many quarters for any filer.
  const COVER_ONLY_MAX_BYTES = 30_000;
  let sixKCount = 0;
  for (let i = 0; i < forms.length && sixKCount < 30; i++) {
    if (forms[i] !== "6-K") continue;
    const size = sizes[i];
    if (typeof size === "number" && size < COVER_ONLY_MAX_BYTES) continue;
    push(i);
    sixKCount++;
  }

  return { candidates: out, fiscalYearEndMonth };
}

async function findExhibit991Url(
  cik: string,
  accession: string,
  requireRealEx99 = false,
): Promise<string | null> {
  const cikInt = parseInt(cik, 10);
  const noDash = accession.replace(/-/g, "");
  const indexUrl = `${SEC}/Archives/edgar/data/${cikInt}/${noDash}/${accession}-index.htm`;
  // Filing index pages are immutable once an accession number is assigned;
  // cache aggressively (7 days). The exhibit doc itself uses the secFetch
  // default which is also long-lived.
  const r = await secFetch(indexUrl, 7 * 86400);
  if (!r.ok) return null;
  const html = await r.text();

  // Four priority tiers — issuer naming varies wildly:
  //   1. ex(hibit) + sep + 99 + sep + 1|2  — most common (AAPL, ABT, ABBV,
  //      ADBE, COST, GOOGL, META, MSFT, NFLX, etc.). Separator may be `.`,
  //      `-`, `_`, or `x` (some filers paste the marker mid-filename).
  //   2. ex(hibit) + sep + 99            — single-99 exhibits (ADP, TSLA).
  //   3. Earnings-content filenames (no `ex99`) — foreign issuers like ASML
  //      use descriptive names: `financialstatementsusgaa.htm`,
  //      `pressreleasequarterlyresul.htm`. We accept these for 6-Ks only,
  //      since within 8-Ks tier 4 covers ACN-style names already.
  //   4. Any other .htm file in the filing that isn't the iXBRL cover doc.
  //      Used by issuers (e.g. ACN's `q2fy26earnings8-kexhibit.htm`) that
  //      don't put `99` in the filename at all.
  // No trailing word boundary on the regex — issuers like AAPL chain quarter
  // info directly: `a8-kex991q1202612272025.htm`.
  const linkRe = /href="([^"]+)"/gi;
  const ixCoverPaths = new Set<string>();
  const primary: string[] = [];
  const secondary: string[] = [];
  const earningsContent: string[] = [];
  const otherHtm: string[] = [];
  // Filename suggests earnings content even without `ex99` in the name.
  const earningsRe = /financialstatement|quarterly\s*result|quarterlyresul|press\s*release\s*(?:financial|quarterly|earning|result|revenue)|pressrelease\s*(?:financial|quarterly|earning|result|revenue)|pressreleasefinancial|pressreleasequarterly|pressreleaseearning|earnings?[\s_-]*(?:release|result|guidance)|q[1-4][\s_x-]*(?:result|earning|fy|20\d{2})|[1-4]q\d{2}[a-z_]*(?:result|earning|guidance|final|press|fy|e\b|e[._\-x])|[1-4]q[\s_x-]*\d{2,4}|(?:first|second|third|fourth)[\s_-]*quarter[\s_-]*(?:result|earning)|interim[\s_-]*report|halfxyear|halfyear|revenue\s*\d{6,8}|revenue[\s_-]*20\d{2}|free[\s_-]*translation|englishtranslation/i;
  // Filename clearly NOT earnings — overrides earningsRe matches.
  const nonEarningsRe = /agm[\s_-]?disclos|agm[\s_-]?result|annual\s*general\s*meet|annualgeneralmeet|managers?[\s_-]?transact|managerstransact|notice[\s_-]?(?:of)?(?:annual|extra)|noticeannual|agenda|remunerat|governanc|esg[\s_-]?report|sustainabil|share[\s_-]?(?:buy|repurch)|prosi|insider/i;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1];
    if (href.startsWith("/ix?doc=")) {
      // Capture the underlying doc path so we can exclude it from `otherHtm`
      ixCoverPaths.add(href.slice("/ix?doc=".length));
      continue;
    }
    if (!/\.html?$/i.test(href)) continue;
    if (!href.startsWith("/Archives/edgar/")) continue; // skip search/help links
    const base = href.split("/").pop() ?? href;
    if (/ex(?:hibit)?[._\-x]?99[._\-]?[12]/i.test(href)) {
      primary.push(href);
    } else if (/ex(?:hibit)?[._\-x]?99(?![0-9])/i.test(href)) {
      secondary.push(href);
    } else if (earningsRe.test(base) && !nonEarningsRe.test(base)) {
      earningsContent.push(href);
    } else {
      otherHtm.push(href);
    }
  }

  let candidates: string[];
  if (primary.length > 0)              candidates = primary;
  else if (secondary.length > 0)       candidates = secondary;
  else if (earningsContent.length > 0) candidates = earningsContent;
  // Foreign-issuer 6-Ks: skip filings with no positive earnings signal.
  // Insider transactions, dividend declarations, AGM notices etc. all have
  // a single cover doc; without this guard the tier-4 fallback grabs the
  // cover and the parser wastes a fetch on a filing with no IS table.
  else if (requireRealEx99)            return null;
  else                                 candidates = otherHtm.filter((h) => !ixCoverPaths.has(h));
  if (candidates.length === 0) return null;

  // SEC's filing-index pages occasionally render hrefs with an empty CIK
  // segment ("/Archives/edgar/data//<accession-no-dash>/<file>") — most
  // visibly affecting recently filed deals where the index page hasn't
  // fully populated yet. Patch the empty segment using the CIK we have.
  // Without this, every fetch of the patched URL returns 404 from SEC.
  const repairedCik = parseInt(cik, 10);
  const repaired = candidates[0].replace(/\/Archives\/edgar\/data\/\/(\d+)\//, `/Archives/edgar/data/${repairedCik}/$1/`);
  return repaired.startsWith("http") ? repaired : `${SEC}${repaired.startsWith("/") ? "" : "/"}${repaired}`;
}

// Priority-ordered patterns per line item. lineValue() iterates priorities in
// order — only falls back to a lower priority if no row matched the higher
// one. This is critical for issuers like ADP whose IS lists revenue
// sub-components ("PEO revenues", "Interest on funds...") BEFORE the total
// row ("Total revenues") — we'd grab the first sub-component otherwise.
const KEYWORDS: Record<string, RegExp[]> = {
  totalRevenue: [
    // Priority 1: standalone "Total/Net <revenue|sales>" — must be the whole
    // label, otherwise sub-component lines like "Net sales from products"
    // (AXON, XYL) would shadow the actual total. Allow optional "X and Y"
    // chain (CAT: "Total sales and revenues") and a trailing footnote
    // marker like "(1)" (AAPL). Also allow "Net revenues and financial
    // income/gains/services" — LATAM fintech-marketplaces (MELI) ship the
    // consolidated revenue line with a fintech-side suffix, with separate
    // "Net service revenues" and "Net product revenues" sub-rows above
    // that would otherwise win the priority-4 lossy fallback. And allow
    // "Total revenues and other income" — integrated oil & gas issuers
    // (XOM, CVX) bundle the equity-affiliates / non-op income line into
    // their consolidated revenue total at the top of the IS.
    /^(?:total\s+(?:net\s+)?(?:revenues?|sales)(?:\s+and\s+(?:revenues?|sales|other\s+income))?|net\s+(?:revenues?|sales)(?:\s+and\s+financial\s+(?:income|gains|services))?)\s*(?:\(\d+\))?\s*:?\s*$/i,
    // Priority 2: "Total operating revenue(s)" — IFRS airlines (CPA Copa
    // Holdings, ...) break revenue into Passenger / Cargo / Other and total
    // with this exact label. Without this the priority-3 lossy fallback
    // grabs the first sub-component (Passenger revenue) as the total.
    /^total\s+operating\s+(?:revenues?|sales)\s*:?\s*$/i,
    // Priority 3: just "Revenue(s)" or "Sales" alone (XYL labels its total
    // simply "Revenue" with sub-lines like "Revenue from products" above).
    /^(?:revenues?|sales)\s*:?\s*$/i,
    // Priority 4: lossy fallback — any row containing the keyword.
    /\b(net\s+(?:revenues?|sales)|total\s+(?:revenues?|sales)|revenues?)\b/i,
  ],
  costOfRevenue: [
    // Priority 1: explicit "Total cost(s) of revenue(s)" — preferred when
    // the issuer breaks COGS into products/services sub-totals.
    /^total\s+costs?\s+of\s+(?:revenues?|sales)\s*:?\s*$/i,
    /\btotal\s+costs?\s+of\s+revenues?\b/i,
    // Priority 2: standalone "Cost of X" with no trailing modifier (e.g.
    // XYL: "Cost of revenue" with "Cost of revenue from products" above;
    // AXON: "Cost of sales" with "Cost of product sales" above). Allow an
    // optional "net" qualifier and a "and financial expenses" suffix —
    // LATAM fintech-marketplaces (MELI) report "Cost of net revenues and
    // financial expenses" as their single COGS line.
    /^costs?\s+of\s+(?:net\s+)?(?:products?\s+sold|revenues?|sales|services|goods)(?:\s+and\s+financial\s+expenses?)?\s*:?\s*$/i,
    // Priority 3: any match (lossy fallback).
    /\bcosts?\s+of\s+(?:net\s+)?(products?\s+sold|revenues?|sales|services|goods)/i,
  ],
  grossProfit: [
    // Negative lookahead on `%` skips IFRS summary-table rows like
    // "Gross margin %" (NOK) which carry the percentage, not the dollar
    // amount. Apple's "Gross margin 54,781" still matches because the
    // following character is a space, not %.
    /\bgross\s+(?:profit|margin)\b(?!\s*%)/i,
  ],
  researchDevelopment: [
    /\bresearch\s+and\s+development\b/i,
    // Chinese ADRs (BABA, NIO, JD, PDD, BIDU) label R&D as "Product
    // development expenses". Anchored to start so a stray "product …" deeper
    // in the IS doesn't shadow it.
    /^product\s+development(?:\s+expenses?)?\s*:?\s*$/i,
    // LATAM marketplaces (MELI) merge product + tech under a single line
    // "Product and technology development" — same conceptual bucket as
    // R&D but the label doesn't contain the literal word "research".
    /^product\s+and\s+technology\s+development(?:\s+expenses?)?\s*:?\s*$/i,
    // Workiva-PDF synthesis sometimes emits "technology and product
    // development" / "product and technology" variants — keep the order
    // permissive but anchored.
    /^technology\s+and\s+product\s+development(?:\s+expenses?)?\s*:?\s*$/i,
  ],
  sellingGeneralAdministrative: [
    /\bselling[,\s]+general[,\s]+and\s+administrative|\bsg&a\b/i,
  ],
  // Sales & Marketing as its own IS line (BABA, NIO, JD, PDD, BIDU, etc.).
  // Anchored so "Selling expenses" / "Marketing expenses" / "Sales and
  // marketing expenses" all match but the combined SG&A regex above stays
  // independent.
  salesMarketing: [
    /^sales\s+and\s+marketing(?:\s+expenses?)?\s*:?\s*$/i,
    /^selling\s+(?:expenses?|and\s+marketing(?:\s+expenses?)?)\s*:?\s*$/i,
    /^marketing(?:\s+(?:expenses?|and\s+sales))?\s*:?\s*$/i,
  ],
  // General & Administrative as its own IS line (Chinese ADRs and many
  // IFRS-by-function filers split this from Sales & Marketing).
  generalAdmin: [
    /^general\s+and\s+administrative(?:\s+expenses?)?\s*:?\s*$/i,
    /^administrative(?:\s+expenses?)?\s*:?\s*$/i,
  ],
  operatingIncome: [
    // Priority 1: anchored — "Operating income/earnings/profit/loss" must
    // START the label. Prevents "Other operating income" (a non-op credit
    // line in VLRS Volaris and other LATAM IFRS issuers) from shadowing the
    // actual Operating income row that follows it in the same column. Also
    // accepts plain "Operating loss" (AAL, other airlines / cyclicals in a
    // loss quarter); downstream Sankey treats the signed magnitude correctly.
    /^operating\s+(?:income|earnings|profit|loss)(?:\s*\/\s*\(loss\))?\b/i,
    // Priority 1b: Chinese ADRs (NIO/BABA-style 6-Ks) and many IFRS issuers
    // label this row "(Loss)/profit from operations" or "Profit/(Loss) from
    // operations" or just "Loss from operations" / "Profit from operations".
    // Anchored so a stray "from operations" deeper in the IS doesn't match.
    /^(?:loss\s*\/\s*)?profit(?:\s*\/\s*\(loss\))?\s+from\s+operations\s*$/i,
    /^\(loss\)\s*\/\s*profit\s+from\s+operations\s*$/i,
    /^(?:loss|income)\s+from\s+operations\s*$/i,
    // Priority 2: any row containing "operating income" — but anchored to
    // word-boundary so "Other operating income" (a non-op CREDIT line in
    // foreign IFRS-by-function filers like NIO) doesn't shadow the real
    // operating result a few rows below.
    /^operating\s+(?:income|earnings|profit)\b/i,
    // Priority 3: ADP-style fallback — when there's no explicit op income,
    // EBT often serves the same purpose because interest is already in
    // total expenses. Allow optional "(Loss)" / "(Profit)" parenthetical
    // (CVX style).
    /\b(?:earnings|income|profit)\s+(?:\([^)]+\)\s+)?before\s+(?:income\s+|provision\s+(?:for\s+)?)?tax/i,
  ],
  totalOperatingExpenses: [
    /\btotal\s+(?:operating\s+)?(?:expenses|costs)\b/i,
    // Banks (JPM, BAC, WFC, ...) report total opex as "Noninterest expense"
    // — there's no separate "Total operating expenses" line because the
    // bank IS layout splits revenue into net interest income + noninterest
    // income, costs into noninterest expense + provision for credit losses,
    // and goes straight to pretax income / net income. Anchored so a prose
    // reference in body text doesn't shadow the IS row.
    /^(?:total\s+)?noninterest\s+expense(?:s)?(?:\s*\(.*\))?\s*$/i,
  ],
  interestExpense: [
    /\binterest\s+expense\b/i,
  ],
  incomeBeforeTax: [
    // Accepts:
    //   "Income before income taxes"
    //   "Income (Loss) before income taxes"
    //   "Income/(Loss) before income taxes"  ← XOM / many integrated oil & gas
    //   "Loss before income taxes"           ← AAL / loss quarters
    /\b(?:earnings|income|profit|loss)\s*\/?\s*(?:\([^)]+\)\s*)?before\s+(?:income\s+|provision\s+(?:for\s+)?)?tax/i,
  ],
  incomeTaxExpense: [
    // Priority 1: anchored — must START with the tax-expense phrase. Prevents
    // matching the substring "income tax expense" inside the IBT row label
    // (e.g. CVX: "Income (Loss) Before Income Tax Expense"). "Benefit" is
    // accepted alongside "expense" — issuers in a loss quarter (AAL Q1 2026
    // reported "Income tax benefit (94)") still expose the same conceptual
    // bottom-line tax row, just with the opposite sign. Also accept
    // slash/parens form "Income tax expense/(benefit)" — XOM / oil & gas
    // issuers carry both signs in the same row label.
    /^income\s+tax(?:es)?\s*\/?\s*\(?(?:expense|provision|benefit)/i,
    /^provision\s+(?:\([^)]+\)\s+)?for\s+(?:income\s+)?tax/i,
    // Priority 2: lossy — only used if no anchored match elsewhere.
    /\b(income\s+tax(?:es)?\s*\/?\s*\(?(?:expense|provision|benefit)|provision\s+(?:\([^)]+\)\s+)?for\s+(?:income\s+)?tax)/i,
    // Insurance/banking issuers often label this just "Income taxes"
    /^income\s+tax(?:es)?$/i,
  ],
  netIncome: [
    // Priority 1: anchored — "Net income/earnings/loss" must be the WHOLE
    // label. Issuers (MELI, BABA-style 6-Ks) put rows like "Net income
    // before income tax expense" / "Net income attributable to..." earlier
    // in the IS, which the priority-3 lossy `\bnet\s+(?:income|earnings)\b`
    // happily matches and locks the parser onto the wrong (pre-tax) bottom
    // line. Loss-period issuers (AAL, money-losing biotechs) report "Net
    // loss" instead — same conceptual bottom line; downstream sign handling
    // converts the parsed magnitude back to a signed value. Also accepts
    // slash/parens form "Net income/(loss)" — XOM and other oil & gas
    // issuers carry both signs in the same row label.
    /^net\s+(?:earnings|income|loss)(?:\s*\/?\s*\([^)]+\))?\s*(?:\(\d+\))?\s*:?\s*$/i,
    // Priority 2: consolidated NI for issuers with noncontrolling interests
    // (XOM, BABA, oil & gas / China ADRs). The row label expands to "Net
    // income/(loss) including noncontrolling interests" — anchored variant
    // catches it without falling through to priority 3 (which would also
    // accept the NCI-only row that comes right after, and bias the picked
    // value toward the small attributable-to-NCI value).
    /^net\s+(?:earnings|income|loss)(?:\s*\/?\s*\([^)]+\))?\s+including\s+noncontrolling\s+interests?\s*$/i,
    // Priority 3: lossy fallback — anywhere in label. Must skip rows that
    // are clearly NCI-only (e.g. "Net income attributable to noncontrolling
    // interests"); negative lookahead defends.
    /\bnet\s+(?:earnings|income|loss)\b(?![^.]*\battributable\s+to\s+noncontrolling)/i,
    // CAT-style: bottom line is just "Profit" or "Profit N" (footnote marker).
    // Anchored so "Operating profit" / "Profit of consolidated companies" /
    // "Profit per common share" don't shadow the real bottom line.
    /^profit(?:\s+\d+)?\s*:?\s*$/i,
    // IFRS issuers (NOK, ASML, RYAAY, ...) bottom line is "Profit for the
    // {period}" optionally followed by " – all attributable to equity
    // holders of parent" (RYAAY's full consolidated label). The suffix
    // requires a dash + "all" — distinguishes it from NOK's sub-line
    // "Profit for the period attributable to equity holders" (no dash,
    // no "all"), which is a partition of the consolidated total.
    // Periods covered: period / year / quarter (plain) plus half-year and
    // nine/six/three-months (RYAAY-style semi-annual + interim updates).
    /^profit\s+for\s+the\s+(?:half[\s\-]?year|nine[\s\-]months?|six[\s\-]months?|three[\s\-]months?|period|year|quarter)(?:\s*[—–-]\s*all\s+attributable\s+to\s+equity\s+holders.*)?$/i,
    // LATAM IFRS issuers (CPA Copa Holdings, ...) label the bottom line
    // "Net profit" or "Net Profit/(Loss)" (CPA's quarterly column header
    // accommodates loss periods). Anchored so "Net profit attributable
    // to..." sub-lines don't shadow the consolidated total.
    /^net\s+profit(?:\s*\/\s*\(loss\))?(?:\s+\d+)?\s*:?\s*$/i,
    // Chinese ADRs (NIO, BABA-style 6-Ks) label the bottom line
    // "Net (loss)/profit" — parenthesized loss BEFORE the profit/income
    // word, with the loss case as the indicator that the period might be
    // negative. Anchored so "Net (loss)/profit attributable to ordinary
    // shareholders" sub-lines don't shadow the consolidated total.
    /^net\s+\(loss\)\s*\/\s*(?:profit|income)(?:\s+\d+)?\s*:?\s*$/i,
    // BHP / Rio Tinto / EU IFRS issuers use "Attributable profit" or
    // "Profit attributable to (owners of parent / equity holders)" as
    // the bottom-line consolidated NI in their H1 / FY summary tables.
    /^(?:attributable\s+profit|profit\s+attributable\s+to)\b/i,
  ],
  // ── Score-only signals (not extracted as values) ────────────────────────────
  // Two categories that flag a real earnings-summary table without being IS
  // line items per se. Used to lift the score of compact "Highlights"
  // tables that mid-cap IFRS issuers (Cameco's Q1 6-K is the canonical
  // case) ship in lieu of a full Cost-of-Revenue / Operating-Income / Tax
  // breakdown. Without these, Cameco's table 12 ({Revenue, Gross profit,
  // Net earnings, EPS basic, EPS diluted, Adjusted EBITDA}) only counted
  // {totalRevenue, grossProfit, netIncome} = 3 against a threshold of 4
  // and the parser bailed.
  // The downstream lineValue extractor never looks these up, so adding
  // them here only affects scoring. EPS regex uses `\bper\s+(?:common|
  // ordinary\s+)?share\b` — distinct enough that it doesn't false-match
  // segment / debt / share-count tables. EBITDA covers both raw and
  // Adjusted EBITDA, which appear in highlights tables but rarely in
  // non-IS schedules.
  earningsPerShare: [
    /\bper\s+(?:common\s+|ordinary\s+)?share\b/i,
    /\bearnings\s+per\s+share\b/i,
    /\beps\b/i,
  ],
  ebitda: [
    /\b(?:adjusted\s+)?ebitda\b/i,
  ],
  // Bank-specific scoring signals. Pure money-center banks (JPM, BAC, WFC)
  // ship a compact IS shape: Net interest income + Noninterest income →
  // Net revenue → minus Noninterest expense + Provision for credit losses
  // → Net income. With no Cost of Revenue / Gross Profit / Op Income rows,
  // the standard score barely scrapes 2 hits and the table never qualifies.
  // These three signals lift the score on bank IS tables; they're not used
  // for line-item extraction (banks render via the existing bank Sankey
  // profile which reads from XBRL, not 8-K text).
  netInterestIncome: [
    /^net\s+interest\s+income\b/i,
  ],
  noninterestIncome: [
    /^noninterest\s+income\b/i,
  ],
  provisionForCreditLosses: [
    /\bprovision\s+(?:for\s+|\(.*\)\s+for\s+)?credit\s+losses\b/i,
  ],
  // Airline-specific opex lines. US carriers (AAL, DAL, UAL, LUV...) break out
  // fuel + labor as their two largest cost buckets in lieu of a Gross-Profit /
  // Cost-of-Revenue structure. Detection downstream uses fuel + labor both
  // present, so other airline matches without those two are harmless.
  aircraftFuel: [
    /^aircraft\s+fuel\b/i,
    /\baircraft\s+fuel\s+and\s+(?:related\s+taxes|oil)\b/i,
    // IFRS airlines (CPA Copa Holdings, ...) label this just "Fuel". The
    // airline-mode detector requires fuel ≥ 5% of revenue + 2 other airline
    // signals, so a stray non-airline "Fuel" row can't trigger false positives.
    /^fuel\s*$/i,
    // European IFRS carriers (RYAAY Ryanair, ...) label "Fuel and oil".
    /^fuel\s+and\s+oil\s*$/i,
    // LATAM IFRS by-nature (VLRS Volaris, ...) label "Fuel expense".
    /^fuel\s+expenses?\s*$/i,
  ],
  salariesWages: [
    /^salaries[,\s]+(?:wages|and)\b/i,
    /^labor\s+and\s+related\s+expense/i,
    /^(?:wages|salaries)\s+and\s+benefits\b/i,
    // CPA-style: "Wages, salaries, benefits and other employees' expenses".
    // Comma-separated list rather than the conjoined "and" forms above.
    /^wages,\s*salaries\b/i,
    // European IFRS carriers (RYAAY Ryanair, ...) label "Staff costs".
    /^staff\s+costs?\s*$/i,
  ],
  aircraftMaintenance: [
    /^maintenance[,\s]+materials\s+and\s+repairs/i,
    /^aircraft\s+maintenance/i,
    // ULCC-style label (ALGT, ...) — no "materials" word, no "aircraft" prefix.
    // Anchored to the whole label so generic "Maintenance" rows (e.g. SaaS
    // "maintenance and support" revenue) don't get pulled in as airline opex.
    /^maintenance\s+and\s+repairs\s*$/i,
    // LATAM IFRS by-nature (VLRS Volaris, ...) label "Maintenance expenses".
    /^maintenance\s+expenses?\s*$/i,
  ],
  aircraftRent: [
    /^aircraft\s+rent(?:als?)?\s*$/i,
  ],
  landingFees: [
    // "Other rent and landing fees" (US carriers) and "Other rentals and
    // landing fees" (LATAM IFRS-by-nature) both map to this bucket.
    /^(?:other\s+)?rent(?:als?)?\s+and\s+landing\s+fees\b/i,
    /^landing\s+fees\b/i,
    // VLRS Volaris-style: "Landing, take-off and navigation expenses" —
    // bundles all airport-cycle fees into a single line.
    /^landing[,\s]+take[\s\-]?off[,\s]+(?:and\s+)?navigation\b/i,
  ],
  depreciationAmortization: [
    // Anchored so "Regional depreciation and amortization" (an airline sub-line)
    // doesn't shadow the company-level D&A row.
    /^depreciation\s+and\s+amortization\s*$/i,
    // IFRS issuers (RYAAY Ryanair, ...) report just "Depreciation" as a
    // top-level expense line — they capitalize and amortize in separate notes.
    /^depreciation\s*$/i,
  ],
};

type LineKey = keyof typeof KEYWORDS;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", nbsp: " ", quot: '"', apos: "'",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => {
      // Hex numeric entities — used heavily by IFRS/foreign filers (RYAAY
      // Ryanair encodes –, €, and nbsp as &#x2013;, &#x20AC;, &#xA0;).
      // Without this branch labels keep the literal "&#x2013;" text and
      // every netIncome regex anchored on a clean dash fails to match.
      const code = parseInt(h, 16);
      // Out-of-range codepoint (malformed remote HTML, e.g. &#xFFFFFFFF;) makes
      // String.fromCodePoint throw RangeError, aborting the whole parse and
      // silently dropping EDGAR data for this ticker. Keep the literal instead.
      if (!Number.isFinite(code) || code > 0x10ffff) return m;
      return code === 0xA0 ? " " : String.fromCodePoint(code);
    })
    .replace(/&#(\d+);/g, (m, n) => {
      const code = parseInt(n, 10);
      if (!Number.isFinite(code) || code > 0x10ffff) return m;
      return code === 160 ? " " : String.fromCodePoint(code);
    })
    .replace(/&([a-z]+);/gi, (m, e) => NAMED_ENTITIES[e.toLowerCase()] ?? m);
}

// Some issuers (BABA / many TM-prepared 6-Ks) emit parenthesized negatives
// across two adjacent <td> cells: "(144,029" in one and ")" in the next, with
// any number of empty cells between for spacing. parseNumber expects a
// matched-pair token, so without stitching the whole numeric run gets rolled
// into the row label and firstValue comes back null — silently zeroing
// costOfRevenue / interestExpense / incomeTaxExpense for the entire IS.
// Walk forward from any cell with unmatched "(" and merge until the parens
// balance (capped at 8 lookahead cells so a stray "(" in a label doesn't
// swallow the row).
function stitchSplitParens(cells: string[]): string[] {
  const out = cells.slice();
  for (let i = 0; i < out.length; i++) {
    const cell = out[i];
    if (!cell) continue;
    let balance = 0;
    for (const ch of cell) {
      if (ch === "(") balance++;
      else if (ch === ")") balance--;
    }
    if (balance <= 0) continue;
    let merged = cell;
    let j = i + 1;
    const cap = Math.min(out.length, i + 9);
    while (j < cap && balance > 0) {
      const next = out[j];
      if (next) {
        merged += next;
        for (const ch of next) {
          if (ch === "(") balance++;
          else if (ch === ")") balance--;
        }
        out[j] = "";
      }
      j++;
    }
    if (balance === 0) out[i] = merged;
  }
  return out;
}

function tableToRows(tableHtml: string, allowMultilineFallback = false): string[][] {
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows: string[][] = [];
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(tableHtml)) !== null) {
    const rowHtml = m[1];
    const cellRe = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
    const cells: string[] = [];
    let c: RegExpExecArray | null;
    while ((c = cellRe.exec(rowHtml)) !== null) {
      const text = decodeEntities(c[1].replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
      cells.push(text);
    }
    if (cells.length > 0) rows.push(stitchSplitParens(cells));
  }

  // Image-with-text-fallback layout (Nokia interim reports): the IS is
  // rendered visually as a JPG, with the searchable text dumped into a
  // `<font color="white" size="1">` block inside one of the TDs. Newlines
  // separate the logical rows. Standard <tr>/<td> parsing produces just one
  // or two rows. Only used as a second-pass fallback — multi-line text
  // parsing is fundamentally ambiguous for adjacent 3-digit columns, so we
  // try it only when no structured table in the doc cleared the threshold.
  if (allowMultilineFallback && rows.length <= 2) {
    const cellRe2 = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
    let bestLines: string[] = [];
    let cm: RegExpExecArray | null;
    while ((cm = cellRe2.exec(tableHtml)) !== null) {
      // Preserve newlines this time; <br>/<p> become \n separators.
      const raw = cm[1]
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(?:p|div|li)>/gi, "\n")
        .replace(/<[^>]+>/g, " ");
      const text = decodeEntities(raw)
        .replace(/[ \t ]+/g, " ")
        .replace(/\n[ \t]*/g, "\n")
        .trim();
      const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length > bestLines.length) bestLines = lines;
    }
    if (bestLines.length >= 5) {
      const expanded = bestLines.map(splitTextLine).filter((r) => r.length > 0);
      if (expanded.length >= 5) return expanded;
    }
  }
  return rows;
}

// Tokenize a single text-row line from an image-with-text-fallback layout
// into [label, value1, value2, ...] cells. Numbers may use space-separated
// thousands ("6 125") and may be parenthesized for negatives. Anything
// before the first numeric token is the label.
function splitTextLine(line: string): string[] {
  const NUM_RE = /\(\s*-?\d+(?:[\s ]\d{3})*(?:\.\d+)?\s*\)|-?\d+(?:[\s ]\d{3})*(?:\.\d+)?(?=\s|$|%)|—|–/g;
  const matches: { val: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = NUM_RE.exec(line)) !== null) {
    matches.push({ val: m[0].replace(/[\s ]+/g, " ").trim(), start: m.index, end: m.index + m[0].length });
  }
  if (matches.length === 0) return [];
  const label = line.slice(0, matches[0].start).trim();
  if (!label) return [];
  return [label, ...matches.map((x) => x.val)];
}

function parseNumber(cell: string): number | null {
  let s = cell.trim();
  if (!s || /^[—–-]+$/.test(s)) return null;
  s = s.replace(/\([a-z]\)\s*$/i, "").replace(/\*+$/, "").trim();
  const negative = /^\(.+\)$/.test(s);
  s = s.replace(/[()]/g, "").replace(/\$/g, "").replace(/,/g, "").replace(/%/g, "").trim();
  // IFRS / European issuers (NOK, ASML, TSM) use space — including non-breaking
  // space U+00A0 — as thousands separator: "1 074", "19 220". Strip whitespace
  // only when the result is otherwise a clean numeric. Leaving alphanumeric
  // tokens like "Q4'25" or "1.5x" untouched so they continue to fail-parse.
  if (/^[+-]?\d[\d\s ]*(?:\.\d+)?$/.test(s)) {
    s = s.replace(/[\s ]/g, "");
  }
  if (s === "") return null;
  const n = Number(s);
  if (!isFinite(n)) return null;
  return negative ? -n : n;
}

function detectScale(tableHtml: string, rows: string[][], docHtml?: string, tableStart?: number): number {
  // Pick the unit phrase that appears FIRST in the text. Primary units are
  // always declared up front (e.g. "(In millions, except number of shares
  // which are reflected in thousands and per share amounts)" — millions is
  // the IS unit, thousands only modifies the share count). Earliest match
  // wins so the parenthetical "except" clause doesn't override.
  // Accepts: "in millions", "millions of dollars" (CVX), "EUR million" (NOK),
  // "USD millions" (TSM, sometimes), and standalone "millions" only when
  // adjacent to "of" or a currency token to avoid false positives like
  // "millions of barrels".
  const earliestUnit = (text: string): number | null => {
    const matches: Array<{ idx: number; scale: number }> = [];
    // Note: the symbol branch ($/€/£/¥) is separated out from the main
    // alternation because `\b` at the front of `\b[$€£¥]` fails to match
    // when the symbol is preceded by another non-word character — e.g.,
    // Cameco's table 12 header reads "($ MILLIONS EXCEPT WHERE INDICATED)"
    // where the `(` immediately before `$` means there's no word/non-word
    // transition for `\b` to anchor to. Keeping the `\b` for the
    // letter-token branch (USD, EUR, etc.) but using a separate
    // symbol-prefix branch avoids the silent miss.
    // The "X of Y" branch must accept regional dollar qualifiers — RY's
    // earnings press release uses "(Millions of Canadian dollars)" inside
    // its IS table, which the bare `dollars|usd|...` alternation didn't
    // match. Add optional `(?:canadian|us|u\.s\.|hong\s+kong|new\s+taiwan|
    // australian|singapore)\s+` before `dollars`.
    const re = /\b(?:(?:in\s+|^)(thousands|millions|billions)\b|(thousands|millions|billions)\s+of\s+(?:(?:canadian|us|u\.s\.|hong\s+kong|new\s+taiwan|australian|singapore)\s+)?(?:dollars|usd|us\s+dollars|euros?|eur|pounds?|gbp|swiss\s+francs?|chf|yen|jpy|yuan|rmb|cny)|(?:USD|EUR|GBP|CHF|JPY|CNY|RMB|HKD|TWD|NTD|euros?|dollars?|pounds?|francs?|yen|yuan|renminbi)\s+(thousands?|millions?|billions?))|[$€£¥]\s+(thousands?|millions?|billions?)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      // m[4] is the new symbol-prefix capture (`[$€£¥]\s+(thousands?|...)`).
      const word = (m[1] ?? m[2] ?? m[3] ?? m[4]).toLowerCase().replace(/s$/, "");
      const scale = word === "thousand" ? 1_000 : word === "million" ? 1_000_000 : 1_000_000_000;
      matches.push({ idx: m.index, scale });
    }
    // Compact IFRS / Latin-American shorthand: "ThUS$" / "MUS$" / "ThCh$" /
    // "MM$" for thousands/millions of USD/CLP. LATAM (NYSE: LTM) uses ThUS$.
    const compactRe = /\b(Th|MM?)\s*(?:US\$|Ch\$|EUR|\$)/gi;
    let cm: RegExpExecArray | null;
    while ((cm = compactRe.exec(text)) !== null) {
      const word = cm[1].toLowerCase();
      const scale = word === "th" ? 1_000 : word === "mm" ? 1_000_000 : 1_000_000;
      matches.push({ idx: cm.index, scale });
    }
    // European shorthand: "€M" / "£M" / "€Bn" — currency symbol followed
    // directly by a unit letter (RYAAY column headers). Decoded entity
    // (&#x20AC; → €) by the caller before reaching here.
    const symbolUnitRe = /([€£¥])\s*(MM|M|Bn?|Th|K)\b/gi;
    let su: RegExpExecArray | null;
    while ((su = symbolUnitRe.exec(text)) !== null) {
      const u = su[2].toLowerCase();
      const sc = u === "th" || u === "k" ? 1_000
        : u === "m" || u === "mm" ? 1_000_000
        : 1_000_000_000;
      matches.push({ idx: su.index, scale: sc });
    }
    if (matches.length === 0) return null;
    matches.sort((a, b) => a.idx - b.idx);
    return matches[0].scale;
  };

  // Decode entities first — RYAAY-style headers encode "€M" as "&#x20AC;M".
  // Lowercasing alone leaves the raw entity, so the symbol-unit regex above
  // would never see the actual € character without this step.
  const tableText = decodeEntities(tableHtml.replace(/<[^>]+>/g, " ")).toLowerCase();

  // Preceding-window scan FIRST. Most issuers (AAPL, AAL, MELI, ...) declare
  // the IS unit in a `<p>` tag immediately before the table:
  // "(In millions, except per share amounts)". Checking this first prevents
  // a "(in thousands)" mention deep inside the table — which almost always
  // qualifies share counts (e.g. AAL's "Weighted average shares outstanding
  // (in thousands)" in row 35) — from shadowing the real IS unit. Compact
  // "Highlights" tables that declare unit as their first row still hit the
  // in-table fallback below.
  if (docHtml) {
    const start = typeof tableStart === "number" ? Math.max(0, tableStart - 4000) : 0;
    const end   = typeof tableStart === "number" ? tableStart : docHtml.length;
    const preceding = decodeEntities(docHtml.slice(start, end).replace(/<[^>]+>/g, " ")).toLowerCase();
    const inPreceding = earliestUnit(preceding);
    if (inPreceding !== null) return inPreceding;
  }

  const inTable = earliestUnit(tableText);
  if (inTable !== null) return inTable;

  for (const row of rows.slice(0, 3)) {
    const joined = row.join(" ").toLowerCase();
    if (/millions/.test(joined)) return 1_000_000;
    if (/thousands/.test(joined)) return 1_000;
  }

  if (docHtml) {
    const fullText = decodeEntities(docHtml.replace(/<[^>]+>/g, " ")).toLowerCase();
    const inFull = earliestUnit(fullText);
    if (inFull !== null) return inFull;
  }
  return 1;
}

// Detect the reporting currency (ISO 4217) from a unit declaration like
// "EUR million", "in millions of euros", "USD thousands". Defaults to "USD"
// when no currency token appears (the typical 8-K case — "in millions" with
// no explicit currency is always USD on EDGAR). Used to flag IFRS / foreign
// issuer filings that need FX conversion before charting.
function detectCurrency(tableHtml: string, docHtml?: string, tableStart?: number): string {
  const sample = (text: string): string | null => {
    // Compound phrases first ("NT dollars" → TWD, not USD; "Hong Kong dollars"
    // → HKD; "Canadian dollars" → CAD). Plain "dollars" defaults to USD as the
    // last alternation branch. Symbols ($, €, £, ¥) don't disambiguate
    // regional dollar variants on their own, so only the compound symbol
    // forms ("NT$", "HK$", "C$") get region-specific codes.
    // €/£ are unambiguous (no regional variants), so RYAAY-style "€M"
    // table headers map directly to EUR/GBP without needing a unit word.
    // GBP detection requires "pounds sterling" or "£" / "GBP" — bare
    // "pounds" is too ambiguous because uranium / commodity issuers
    // (Cameco's Q1 6-K is the canonical case) use "million pounds of U3O8"
    // as a mass unit, not currency. Without this restriction Cameco's
    // press release matched "pounds" inside the preceding 4000-char
    // window before "Canadian dollars" reached the fallback fullText scan,
    // and the chart rendered Cameco's CAD numbers as if they were GBP.
    const re = /\b(USD|EUR|GBP|CHF|JPY|CNY|RMB|HKD|TWD|NTD|CAD|AUD|SGD|INR|KRW|BRL|MXN)\b|(?:\bnew\s+taiwan\s+dollars?|\bnt\s*dollars?|NT\$)|(?:\bhong\s+kong\s+dollars?|HK\$)|(?:\bcanadian\s+dollars?|CDN\$|C\$)|(?:\baustralian\s+dollars?|AU?\$)|(?:\bsingapore\s+dollars?|S\$)|(?:\bus\s+dollars?|\bu\.s\.\s+dollars?|US\$)|\b(dollars?|euros?|pounds?\s+sterling|swiss\s+francs?|francs?|yen|yuan|renminbi|rupees?|won|reais?)\b|(€|£)/gi;
    let first: { idx: number; code: string } | null = null;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const matched = m[0].toLowerCase().trim();
      let code: string | null = null;
      if (m[1]) {
        const up = m[1].toUpperCase();
        code = up === "RMB" ? "CNY" : up === "NTD" ? "TWD" : up;
      } else if (/^(?:new\s+taiwan|nt\s*dollar|nt\$)/.test(matched))    code = "TWD";
      else if (/^(?:hong\s+kong|hk\$)/.test(matched))                    code = "HKD";
      else if (/^(?:canadian|cdn\$|c\$)/.test(matched))                  code = "CAD";
      else if (/^(?:australian|au?\$)/.test(matched))                    code = "AUD";
      else if (/^(?:singapore|s\$)/.test(matched))                       code = "SGD";
      else if (/^(?:us\s+dollar|u\.s\.\s+dollar|us\$)/.test(matched))    code = "USD";
      else if (m[2]) {
        const raw = m[2].toLowerCase();
        if (raw.startsWith("dollar"))                code = "USD";
        else if (raw.startsWith("euro"))             code = "EUR";
        else if (raw.startsWith("pound"))            code = "GBP";
        else if (/franc/.test(raw))                  code = "CHF";
        else if (raw === "yen")                      code = "JPY";
        else if (raw === "yuan" || raw === "renminbi") code = "CNY";
        else if (raw.startsWith("rupee"))            code = "INR";
        else if (raw === "won")                      code = "KRW";
        else if (raw.startsWith("rea") || raw === "real") code = "BRL";
      }
      else if (m[3]) {
        // Standalone currency symbol (€ → EUR, £ → GBP). RYAAY-style
        // table headers compress the unit declaration to "€M" / "£M".
        if (m[3] === "€")      code = "EUR";
        else if (m[3] === "£") code = "GBP";
      }
      if (code && (!first || m.index < first.idx)) {
        first = { idx: m.index, code };
      }
    }
    return first?.code ?? null;
  };

  // ── Priority 0: declarative reporting-currency phrase anywhere in doc ───────
  // Most filings declare the reporting currency ONCE at the top with
  // phrases like "All amounts in Canadian dollars" (Cameco 40-F / 6-K),
  // "in millions of euros" (NOK), "expressed in U.S. dollars". These
  // declarations are unambiguous — when present, they trump any currency
  // token that happens to appear earlier within a 4000-char preceding
  // window. Cameco's press release contains "pounds of U3O8" and
  // "US$49 million from Westinghouse" both before the IS table, both of
  // which the position-based fallback would wrongly pick.
  if (docHtml) {
    const fullText = decodeEntities(docHtml.replace(/<[^>]+>/g, " "));
    const declRe = /(?:all\s+amounts?(?:\s+(?:are|in))?(?:\s+expressed)?(?:\s+in)?|amounts(?:\s+are)?\s+(?:expressed\s+)?in|in\s+(?:millions?|thousands?|billions?)\s+of|expressed\s+in|reporting\s+currency\s*(?:[:\-—–]|is)?)\s*(?:the\s+)?(US\s+|U\.S\.\s+|new\s+taiwan\s+|hong\s+kong\s+|canadian\s+|australian\s+|singapore\s+)?(dollars?|euros?|pounds?\s+sterling|swiss\s+francs?|yen|yuan|renminbi|rupees?|won|reais?)/i;
    const dm = fullText.match(declRe);
    if (dm) {
      const region = (dm[1] ?? "").toLowerCase().trim();
      const unit   = dm[2].toLowerCase();
      let declCode: string | null = null;
      if (unit.startsWith("dollar")) {
        if (region.startsWith("canadian"))                 declCode = "CAD";
        else if (region.startsWith("australian"))          declCode = "AUD";
        else if (region.startsWith("singapore"))           declCode = "SGD";
        else if (region.startsWith("hong"))                declCode = "HKD";
        else if (region.startsWith("new taiwan"))          declCode = "TWD";
        else                                                declCode = "USD";
      } else if (unit.startsWith("euro"))                  declCode = "EUR";
      else if (unit.startsWith("pound"))                   declCode = "GBP";
      else if (unit.startsWith("swiss") || /franc/.test(unit)) declCode = "CHF";
      else if (unit === "yen")                             declCode = "JPY";
      else if (unit === "yuan" || unit === "renminbi")     declCode = "CNY";
      else if (unit.startsWith("rupee"))                   declCode = "INR";
      else if (unit === "won")                             declCode = "KRW";
      else if (unit.startsWith("rea") || unit === "real")  declCode = "BRL";
      if (declCode) return declCode;
    }
  }

  // Decode HTML entities before sampling — RYAAY-style filings encode the
  // currency marker as &#x20AC; (€) or &#xA3; (£), which would slip past
  // the symbol regex if we sampled the raw HTML text.
  const tableText = decodeEntities(tableHtml.replace(/<[^>]+>/g, " "));
  const fromTable = sample(tableText);
  if (fromTable) return fromTable;

  if (docHtml) {
    const start = typeof tableStart === "number" ? Math.max(0, tableStart - 4000) : 0;
    const end   = typeof tableStart === "number" ? tableStart : docHtml.length;
    const preceding = decodeEntities(docHtml.slice(start, end).replace(/<[^>]+>/g, " "));
    const fromPre = sample(preceding);
    if (fromPre) return fromPre;
  }
  return "USD";
}

// Extract the label portion of a row (concatenates non-numeric leading cells)
// for both scoring and value lookup. Mirrors splitRow's label logic.
function rowLabel(row: string[]): string {
  let label = "";
  for (const cell of row) {
    const t = cell.trim();
    if (!t) continue;
    if (parseNumber(t) !== null) break;
    label = label ? `${label} ${t}` : t;
  }
  return label;
}

function scoreTable(rows: string[][]): number {
  const labels = rows.map(rowLabel).filter(Boolean).join("\n").toLowerCase();
  let score = 0;
  for (const patterns of Object.values(KEYWORDS)) {
    if (patterns.some((re) => re.test(labels))) score++;
  }
  return score;
}

// Section-header lifting: some issuers (notably Shopify) stack their IS as
//
//   Revenues                                ← section header, no values
//     Subscription solutions    750  620    ← sub-component
//     Merchant solutions      2,420 1,740   ← sub-component
//                             3,170 2,360   ← UNLABELED consolidated total
//   Cost of revenues                        ← next section header
//     ...
//
// The unlabeled total row has no label for `lineValue` to match against —
// the parser bails with `rev=null` and the issuer falls all the way to
// Yahoo. This pre-processor walks the rows and, when an unlabeled-but-
// numeric row follows N labeled sub-components under a recognized section
// header (Revenues / Cost of revenues / Operating expenses / …), copies a
// "Total {section}" label onto the unlabeled row so it surfaces to
// `lineValue` like a normal IS line. Section detection is anchored to a
// fixed allowlist so unrelated unlabeled rows (e.g. summed-and-rounded
// non-IS metrics) don't get mislabeled.
function liftUnlabeledSectionTotals(rows: string[][]): string[][] {
  const sectionRe = /^(?:revenues?|net\s+revenues?|net\s+sales|sales|cost(?:s)?\s+of\s+(?:revenues?|sales|services|goods|net\s+revenues?)|operating\s+expenses?|costs?\s+and\s+expenses?|expenses?)\s*:?\s*$/i;
  const sectionToTotal = (header: string): string => {
    const cleaned = header.trim().replace(/[:\s]+$/, "");
    if (/^revenues?$/i.test(cleaned))         return "Total revenues";
    if (/^net\s+revenues?$/i.test(cleaned))   return "Total net revenues";
    if (/^net\s+sales$/i.test(cleaned))       return "Total net sales";
    if (/^sales$/i.test(cleaned))             return "Total sales";
    if (/^cost(?:s)?\s+of/i.test(cleaned))    return "Total " + cleaned.toLowerCase();
    if (/^operating\s+expenses?$/i.test(cleaned)) return "Total operating expenses";
    if (/^costs?\s+and\s+expenses?$/i.test(cleaned)) return "Total costs and expenses";
    if (/^expenses?$/i.test(cleaned))         return "Total expenses";
    return `Total ${cleaned}`;
  };

  // Two-pass: first pass identifies the unlabeled-total row index for each
  // section-header; second pass emits the row matrix with a synthesized
  // labeled row INSERTED right after the unlabeled-total row. Inserting
  // (rather than replacing) preserves the original-position aware logic
  // downstream like valueColumnOffset detection that walks header rows.
  const totalRowLabelByIndex = new Map<number, string>();
  for (let i = 0; i < rows.length; i++) {
    const label = rowLabel(rows[i]).trim();
    if (!label || !sectionRe.test(label)) continue;
    for (let j = i + 1; j < Math.min(rows.length, i + 7); j++) {
      const next = rows[j];
      const nextLabel = rowLabel(next).trim();
      const numericCells = next.filter((c) => parseNumber(c.trim()) !== null);
      const hasNoLabel = !nextLabel;
      const hasValues = numericCells.length >= 2;
      if (hasNoLabel && hasValues) {
        totalRowLabelByIndex.set(j, sectionToTotal(label));
        break;
      }
      // Continue walking only over labeled sub-component rows.
      if (nextLabel && numericCells.length >= 1) continue;
      break;
    }
  }

  if (totalRowLabelByIndex.size === 0) return rows;

  const out: string[][] = [];
  for (let i = 0; i < rows.length; i++) {
    const lifted = totalRowLabelByIndex.get(i);
    if (lifted) {
      // Replace the unlabeled total with a labeled version. Don't keep both —
      // duplicating the values would double-count if a downstream consumer
      // sums or reconciles by row.
      out.push([lifted, ...rows[i]]);
    } else {
      out.push(rows[i]);
    }
  }
  return out;
}

// Standalone 4-digit year (1990–2100) — virtually always a column header,
// never a P&L value (which would have commas, decimals, or be much larger).
// Issuers like CVX merge the section header and year row: a single <tr> with
// "REVENUES AND OTHER INCOME" + "2026" + "2025" cells. Without this skip,
// splitRow would return firstValue=2026 and pollute totalRevenue lookups.
function isYearCell(t: string): boolean {
  if (!/^\d{4}$/.test(t)) return false;
  const n = parseInt(t, 10);
  return n >= 1990 && n <= 2100;
}

// Walk a row and produce { label, firstValue } where label concatenates the
// leading non-numeric cells and firstValue is the first numeric column.
// Mirrors the splitRow helper inside extractIncomeStatement. Standalone
// currency symbols ($, €, ¥…) get dropped — issuers like Apple put a "$"
// in its own cell before the first row of each section, which would
// otherwise be appended to the label as "iPhone $" / "Net income $".
function rowLabelValue(row: string[]): { label: string; value: number | null } {
  let label = "";
  let foundLabel = false;
  const values: number[] = [];
  for (const cell of row) {
    const t = cell.trim();
    if (!t) continue;
    if (/^[$€£¥₹]+$/.test(t)) continue;
    if (isYearCell(t)) continue;
    const n = parseNumber(t);
    if (!foundLabel) {
      if (n === null) {
        label = label ? `${label} ${t}` : t;
      } else {
        foundLabel = true;
        values.push(n);
      }
    } else if (n !== null) {
      values.push(n);
    }
  }
  let value: number | null = values[0] ?? null;
  // Same note-column heuristic as splitRow (see comment there). Skip when the
  // first value is negative — segment-table elimination/Group Common rows
  // (NOK: "Group Common and Other (5) 4 ...") legitimately start with a small
  // negative value and reassigning to the next column would mislabel the row.
  if (values.length >= 2 && value !== null && value > 0 && Number.isInteger(value) && Math.abs(value) <= 30) {
    const maxAbs = Math.max(...values.slice(1).map((v) => Math.abs(v)));
    if (maxAbs >= Math.abs(value) * 30) {
      value = values[1];
    }
  }
  return { label: label.replace(/[\s$€£¥₹]+$/u, "").trim(), value };
}

// Geographic segment labels we don't want to surface as a "product" breakdown
// when both kinds of tables are present in the press release.
const GEO_LABEL_RE = /\b(americas|europe|emea|apac|asia[- ]?pacific|greater\s+china|china|japan|india|north\s+america|latin\s+america|rest\s+of\s+\w+(?:\s+\w+)?|domestic|international|united\s+states|u\.s\.|canada|mexico|africa|middle\s+east)\b/i;

// Collapse parent-rows whose value equals the sum of immediately-following
// geo sub-rows (Americas/APAC/EMEA, etc.). NOK and other IFRS issuers report
// segment net sales with regional roll-ups inline:
//   "Network Infrastructure 2 407"
//     "Americas 1 177"
//     "APAC 412"
//     "EMEA 818"
// Without this collapse, the contiguous-run reconciliation below sees the
// parent + children run and overshoots total revenue, so no run matches.
function collapseGeoChildren(
  rows: Array<{ label: string; value: number | null }>,
): Array<{ label: string; value: number | null }> {
  const out: Array<{ label: string; value: number | null }> = [];
  let i = 0;
  while (i < rows.length) {
    const r = rows[i];
    let dropped = -1;
    if (r.label && r.value !== null && r.value > 0) {
      for (let k = 2; k <= 6 && i + k < rows.length; k++) {
        const children = rows.slice(i + 1, i + 1 + k);
        if (children.length < k) break;
        const allGeo = children.every(
          (c) => c.label && c.value !== null && c.value > 0 && GEO_LABEL_RE.test(c.label),
        );
        if (!allGeo) break;
        const sum = children.reduce((s, c) => s + (c.value ?? 0), 0);
        if (Math.abs(sum - r.value) / r.value <= 0.03) dropped = k;
      }
    }
    out.push(r);
    if (dropped > 0) i += 1 + dropped;
    else i++;
  }
  return out;
}

// Subtotal/total rows we exclude from segment sums so the breakdown reconciles
// to revenue without double-counting.
const TOTAL_LABEL_RE = /^(total|subtotal|net\s+sales|net\s+revenues?|total\s+(net\s+)?(sales|revenues?))\b/i;

// Income-statement line items that must never be treated as revenue segments,
// even when their values happen to sum to revenue (which is the rule for
// COGS + GP — they sum to Revenue by definition). Without this guard, IS
// tables embedded in interim 6-Ks (SKBL-style) yield bogus "Cost of revenue"
// and "Gross profit" segment ribbons feeding the Sankey's Revenue node.
const NON_SEGMENT_LABEL_RE = /^(cost\s+of\s+(revenue|sales|services|goods)|cost\s+of\s+products?\s+sold|gross\s+(profit|margin|loss)|operating\s+(income|loss|expenses?|profit)|income\s+(from|before)\s+(operations|income\s+taxes|tax)|loss\s+(from|before)\s+(operations|income\s+taxes|tax)|net\s+(income|loss|earnings)|profit\s+(before|for)\s+|comprehensive\s+(income|loss)|interest\s+(income|expense|expense?\s*\(income\))|tax\s+(expense|benefit|provision)|provision\s+for\s+(income\s+)?taxes?|income\s+tax\s+(expense|provision|benefit)|(general\s+and\s+administrative|selling\s+and\s+administrative|selling[,\s]+general|research\s+and\s+development|salaries\s+and\s+benefits|advertising)\s+expenses?|allowance\s+for\s+credit\s+losses|equity\s+in\s+net\s+(gains?|losses?)|income\s+before\s+equity|other\s+(income|expense)(?:[,\s]+net)?|foreign\s+currency\s+translation|earnings\s+per\s+share|basic\s+earnings|diluted\s+earnings|weighted\s+average\s+shares|depreciation\s+and\s+amortization)\b/i;

// Balance-sheet and cash-flow-statement line items. BABA's Q3 FY26 6-K
// contains a non-current liabilities block whose values happen to sum to
// within 2% of revenue (290B vs 285B RMB), so without this guard the
// segment scanner picks up "Deferred tax liabilities", "Non-current bank
// borrowings", "Non-current unsecured senior notes" etc. as if they were
// revenue segments and feeds them into the Sankey's left side. Same risk
// for any large issuer whose total liabilities or assets coincidentally
// land near a quarter of revenue.
const BALANCE_SHEET_LABEL_RE = /^(?:(?:non[\s-]*current|current|short[\s-]*term|long[\s-]*term)\b|(?:total\s+)?(?:assets|liabilities|equity|stockholders|shareholders)\b|deferred\s+(?:revenue|tax|income|charges?)|accrued\b|prepaid\b|accounts\s+(?:receivable|payable)|(?:bank\s+)?borrowings\b|(?:senior|convertible|exchangeable|unsecured|secured)\s+(?:notes|bonds|debt)|(?:notes|bonds)\s+payable|retained\s+earnings|noncontrolling\s+interest|treasury\s+(?:stock|shares)|goodwill\b|intangible\s+(?:assets|liabilities)|property,?\s+(?:plant|and)\s+(?:and\s+)?equipment|inventor(?:y|ies)\b|cash\s+and\s+(?:cash\s+)?equivalents|short[\s-]*term\s+investments|long[\s-]*term\s+(?:investments|debt)|additional\s+paid[\s-]*in\s+capital|accumulated\s+(?:other\s+)?(?:comprehensive|deficit|depreciation)|operating\s+lease\s+(?:right|liabilit)|right[\s-]*of[\s-]*use|net\s+cash\s+(?:provided|used)|(?:operating|investing|financing)\s+activities)\b/i;

interface SegmentCandidate {
  rows: Edgar8KSegment[];
  hasGeoKeywords: boolean;
}

// Find any contiguous run of rows whose values reconcile to the IS revenue.
// Searches within EVERY table (including the IS itself, since issuers like
// Apple embed the segment breakdown right inside the IS table as sub-rows
// under "Net sales:" before the totals line). Header rows (label only, no
// value) and total/subtotal rows break the run. When multiple runs match,
// we prefer non-geographic ones and, within that, more granular (more rows).
function extractRevenueSegments(
  html: string,
  totalRevenue: number,
  scale: number,
): Edgar8KSegment[] | null {
  if (totalRevenue <= 0) return null;
  const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  const candidates: SegmentCandidate[] = [];
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(html)) !== null) {
    const rawRows = tableToRows(m[0]);
    if (rawRows.length < 3) continue;
    const labeled = collapseGeoChildren(rawRows.map(rowLabelValue));

    let i = 0;
    while (i < labeled.length) {
      const r = labeled[i];
      const rowOk = !!r.label && r.value !== null && r.value > 0
        && !TOTAL_LABEL_RE.test(r.label)
        && !NON_SEGMENT_LABEL_RE.test(r.label)
        && !BALANCE_SHEET_LABEL_RE.test(r.label);
      if (!rowOk) { i++; continue; }

      let sum = 0;
      const run: Edgar8KSegment[] = [];
      let j = i;
      // Allow up to 2 consecutive blank/spacer rows (label="", value=null)
      // inside a run — VLRS-style hierarchical breakdowns often insert an
      // empty spacer between Passenger and Non-Passenger sections, which
      // would otherwise split one logical run into two unreconcilable
      // halves. Negative-value or labeled-but-zero rows still terminate
      // the run since those are meaningful structural breaks.
      let consecBlank = 0;
      while (j < labeled.length) {
        const rj = labeled[j];
        const isBlank = !rj.label && rj.value === null;
        if (isBlank) {
          consecBlank++;
          if (consecBlank > 2) break;
          j++;
          continue;
        }
        if (!rj.label || rj.value === null || rj.value <= 0) break;
        if (TOTAL_LABEL_RE.test(rj.label)) break;
        if (NON_SEGMENT_LABEL_RE.test(rj.label)) break;
        if (BALANCE_SHEET_LABEL_RE.test(rj.label)) break;
        consecBlank = 0;
        sum += rj.value;
        run.push({ name: rj.label, value: rj.value * scale });
        j++;
      }

      if (run.length >= 2) {
        const sumScaled = sum * scale;
        const ratio = sumScaled / totalRevenue;
        const accept = (rows: Edgar8KSegment[]) => {
          const geoHits = rows.filter((s) => GEO_LABEL_RE.test(s.name)).length;
          candidates.push({ rows, hasGeoKeywords: geoHits >= 2 });
        };
        if (ratio >= 0.98 && ratio <= 1.02) {
          accept(run);
        } else if (ratio > 1.02) {
          // Hierarchical breakdown (parent + children) — VLRS-style:
          //   Passenger revenues 838
          //     Fare revenues 389
          //     Other passenger revenues 449
          //   Non-passenger revenues 44
          //     Cargo 6
          //     Other non-passenger revenues 38
          // Run-sum = 2× revenue because parents and children both got
          // counted. Try two prunings: parents-only (children where prev
          // row's value = sum of next K rows) and leaves-only (drop the
          // parent rows). Either should reconcile to revenue.
          const parentsOnly: Edgar8KSegment[] = [];
          const leavesOnly: Edgar8KSegment[] = [];
          let k = 0;
          while (k < run.length) {
            let foundChildren = -1;
            for (let kk = 2; kk <= 6 && k + kk < run.length; kk++) {
              const childSum = run.slice(k + 1, k + 1 + kk)
                .reduce((s, c) => s + c.value, 0);
              const parentVal = run[k].value;
              if (parentVal > 0 && Math.abs(childSum - parentVal) / parentVal <= 0.02) {
                foundChildren = kk;
                break;
              }
            }
            if (foundChildren > 0) {
              parentsOnly.push(run[k]);
              for (let cc = 1; cc <= foundChildren; cc++) leavesOnly.push(run[k + cc]);
              k += 1 + foundChildren;
            } else {
              parentsOnly.push(run[k]);
              leavesOnly.push(run[k]);
              k++;
            }
          }
          for (const variant of [parentsOnly, leavesOnly]) {
            if (variant.length < 2) continue;
            const vSum = variant.reduce((s, x) => s + x.value, 0);
            const vRatio = vSum / totalRevenue;
            if (vRatio >= 0.98 && vRatio <= 1.02) {
              accept(variant);
              break;
            }
          }
        }
      }
      i = Math.max(j + 1, i + 1);
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    if (a.hasGeoKeywords !== b.hasGeoKeywords) return a.hasGeoKeywords ? 1 : -1;
    return b.rows.length - a.rows.length;
  });
  return candidates[0].rows;
}

// ── IFRS multi-line segment extractor ───────────────────────────────────────
// Foreign-issuer interim reports (NOK 6-K and similar) embed the segment
// table as plain text inside a single TD — no <tr>/<td> structure for the
// data rows. The regular contiguous-row scanner above can't reach them.
//
// This extractor reads the document as text, finds a column header that
// declares period markers ("EUR million Q4'25 Q4'24 ..."), then parses the
// following data rows. The header's period count determines how many value
// columns each row has, which lets us disambiguate the space-as-thousands /
// space-as-column-separator collision that's otherwise unsolvable: e.g. in
// "Cloud and Network Services 837 940 ..." the "837 940" is two adjacent
// values (837 and 940), not a single thousands-grouped 837940.

// Reads pure-digit groups from a row body, then assigns them to the expected
// number of value slots using greedy thousands absorption with an
// implausibility guard (no value may exceed 2× total revenue — single-segment
// values that large are virtually always two columns misjoined as thousands).
function splitDigitGroupsToValues(
  groups: string[],
  expectedCount: number,
  totalRevenueScaled: number,
  scale: number,
): number[] {
  const M = groups.length;
  if (M === 0) return [];
  if (M <= expectedCount) return groups.map((g) => parseInt(g, 10));
  const out: number[] = [];
  let i = 0;
  let extrasLeft = M - expectedCount;
  while (i < M && out.length < expectedCount) {
    let cur = parseInt(groups[i], 10);
    while (
      extrasLeft > 0 &&
      i + 1 < M &&
      groups[i + 1].length === 3
    ) {
      const next = parseInt(groups[i + 1], 10);
      const candidate = cur * 1000 + next;
      // Guard: the joined value would exceed 2× total revenue. Single segment
      // values that big are virtually never legitimate; "X YYY" is two
      // adjacent columns, not thousands.
      if (candidate * scale > totalRevenueScaled * 2) break;
      cur = candidate;
      i++;
      extrasLeft--;
    }
    out.push(cur);
    i++;
  }
  // Remaining tokens (if any) — shouldn't happen with correct counts but
  // include them as standalone values for robustness.
  while (i < M) {
    out.push(parseInt(groups[i], 10));
    i++;
  }
  return out;
}

interface IfrsValueRow { label: string; firstValue: number; allValues: number[]; isNegative: boolean; }

// Tokenize one text line into label + value tokens. Splits the body into
// "value sections" delimited by % markers (each section yields N value
// columns + 1 percent), then column-count-aware-splits the digit groups.
function parseIfrsValueLine(
  line: string,
  expectedSlotsPerSection: number,
  totalRevenueScaled: number,
  scale: number,
): IfrsValueRow | null {
  // Find where the label ends and numbers begin.
  const firstNumIdx = line.search(/[\d(]/);
  if (firstNumIdx <= 0) return null;
  const label = line.slice(0, firstNumIdx).trim();
  if (!label) return null;
  const body = line.slice(firstNumIdx);
  // Quick reject: rows with no actual digits.
  if (!/\d/.test(body)) return null;

  // Detect leading negative wrapper: "(5) 4 (225)% ..." — the first value is
  // wrapped in parens, indicating a negative magnitude.
  const isNegative = /^\(/.test(body);

  // Split body into sections at % terminators. Each section: "X X X%".
  const sectionRe = /\(?\s*-?\d[\d\s]*?(?:\.\d+)?\s*\)?\s*%/g;
  const pctEnds: number[] = [];
  let mp: RegExpExecArray | null;
  while ((mp = sectionRe.exec(body)) !== null) pctEnds.push(mp.index + mp[0].length);

  const sections: string[] = [];
  let prev = 0;
  for (const end of pctEnds) {
    sections.push(body.slice(prev, end));
    prev = end;
  }
  if (prev < body.length) sections.push(body.slice(prev));

  // For each section: strip the trailing % token, then split remaining
  // digit-groups into expectedSlotsPerSection values.
  const allValues: number[] = [];
  for (const sec of sections) {
    if (!sec.trim()) continue;
    // Drop the trailing percent value (X% / (X)% / X.X%) — it's a column
    // separator, not a segment value we care about for sums. The matched
    // number group must NOT contain whitespace, otherwise lazy expansion
    // would eat back to the start of the section and strip every value.
    const noPct = sec
      .replace(/\s*(?:\(\s*-?\d[\d.]*\s*\)|-?\d[\d.]*)\s*%\s*$/, "")
      .trim();
    if (!noPct) continue;
    // Pure digit groups (handle parens by absolute-valuing — sign tracked
    // separately by isNegative for the leading value).
    const groups: string[] = [];
    const digitRe = /\d+/g;
    let dm: RegExpExecArray | null;
    while ((dm = digitRe.exec(noPct)) !== null) groups.push(dm[0]);
    if (groups.length === 0) continue;
    const values = splitDigitGroupsToValues(
      groups,
      expectedSlotsPerSection,
      totalRevenueScaled,
      scale,
    );
    allValues.push(...values);
  }

  if (allValues.length === 0) return null;
  let firstValue = allValues[0];
  if (isNegative) firstValue = -firstValue;
  return { label, firstValue, allValues, isNegative };
}

function extractIfrsSegmentsFromText(
  html: string,
  totalRevenueScaled: number,
  scale: number,
): Edgar8KSegment[] | null {
  if (totalRevenueScaled <= 0) return null;

  // Plain-text view of the document — preserve newlines so each "row" is one
  // logical line. <p>/<div>/<li>/<tr>/<table>/<br> all map to newline.
  const text = decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|li|tr|table|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ");
  const lines = text.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  // Period markers that indicate a column header line.
  const PERIOD_RE = /Q[1-4]['′]\d{2}|Q[1-4]\s+(?:FY)?\d{2,4}|FY\d{2,4}|Q\d-Q\d['′]?\d{2}/gi;
  // The header must declare the unit AND multiple period markers.
  const UNIT_RE = /\b(?:EUR|USD|GBP|CHF|JPY|CNY|HKD|TWD|NTD)\s+(?:million|thousand|billion)\b|\bin\s+(?:millions|thousands|billions)\b/i;

  for (let h = 0; h < lines.length; h++) {
    if (!UNIT_RE.test(lines[h])) continue;
    const periodMatches = [...lines[h].matchAll(PERIOD_RE)];
    if (periodMatches.length < 2) continue;

    // Count the value-period vs "change/YoY" tokens. Periods come in pairs:
    // (current vs prior). A "YoY change" / "Constant currency..." token
    // separates pairs. Expected per-section value count = pair size = 2 in
    // the typical layout, but also support 1 (single-period rows) by detecting
    // distinct period strings.
    const periodTokens = periodMatches.map((m) => m[0].toLowerCase());
    // Simplification: if header has 4+ periods alternating, assume 2 per section.
    // If header has exactly 2 periods, assume 2 per section (single section).
    const slotsPerSection = periodTokens.length >= 2 ? 2 : 1;

    // Read data rows until a Total/Net sales row matching revenue, or we
    // hit a non-data line / new header.
    const segments: Edgar8KSegment[] = [];
    let totalConfirmed = false;

    for (let i = h + 1; i < Math.min(h + 30, lines.length); i++) {
      const ln = lines[i];
      // Stop at next header line (new section starts).
      if (UNIT_RE.test(ln) && [...ln.matchAll(PERIOD_RE)].length >= 2) break;

      const parsed = parseIfrsValueLine(ln, slotsPerSection, totalRevenueScaled, scale);
      if (!parsed) continue;

      // Total / Net sales row terminates the segment table — validate that
      // the first value matches total revenue (within 1%).
      if (/^(?:total|net\s+sales|net\s+revenues?|grand\s+total)\b/i.test(parsed.label)) {
        const ratio = (parsed.firstValue * scale) / totalRevenueScaled;
        if (ratio >= 0.99 && ratio <= 1.01) totalConfirmed = true;
        break;
      }

      // Skip subtotal/intermediate rows.
      if (/^(?:reported|comparable|constant|adjusted|of\s+which)\b/i.test(parsed.label)) continue;

      // Skip sub-region rows — geo-region children rolled up under a parent
      // segment (Network Infrastructure → Americas/APAC/EMEA). They'd
      // double-count if added to the segment list.
      if (GEO_LABEL_RE.test(parsed.label)) continue;

      // Skip non-positive (Group Common eliminations etc.). Their absolute
      // value is small enough that omitting them keeps the sum within 1%.
      if (parsed.firstValue <= 0) continue;

      // Trim footnote markers like "Group Common and Other(1)" → "Group Common and Other".
      const cleanLabel = parsed.label.replace(/\(\d+\)\s*$/, "").trim();
      if (cleanLabel.length < 2) continue;

      segments.push({ name: cleanLabel, value: parsed.firstValue * scale });
    }

    if (!totalConfirmed) continue;
    if (segments.length < 2) continue;

    // Final reconciliation: top-level segments should sum to ~revenue. We
    // dropped sub-regions and small eliminations, so allow ±3% slack.
    const sum = segments.reduce((s, x) => s + x.value, 0);
    const ratio = sum / totalRevenueScaled;
    if (ratio < 0.97 || ratio > 1.03) continue;

    return segments;
  }

  return null;
}

// Workiva-PDF format helpers — see synthesizeWorkivaPdfTable below for the
// full description. Some issuers (MELI, generally Workiva-prepared shareholder
// letters) ship their earnings 8-K Exhibit 99.1 as a slide deck of JPG images
// with the actual IS / segment tables baked in, plus a hidden OCR-style text
// dump alongside each image inside `<font color="white" size="1">`. There are
// zero `<table>` tags so the standard table-walk pipeline finds nothing. We
// synthesize a row matrix from the hidden text block that contains the IS,
// wrap it as a synthetic `<table>` for the rest of extractIncomeStatement to
// consume unchanged, and extract per-segment revenue from the matching
// reporting-segments block.

function readHiddenTextBlocks(html: string): string[] {
  const blocks: string[] = [];
  const re = /<(?:font|span|div)\b[^>]*\bcolor\s*:\s*(?:white|#fff(?:fff)?|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))[^>]*>([\s\S]*?)<\/(?:font|span|div)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const text = decodeEntities(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (text) blocks.push(text);
  }
  return blocks;
}

function isNumericToken(t: string): boolean {
  if (/^[—–\-]+$/.test(t)) return true;
  if (/^\$?\(?-?\d{1,3}(?:,\d{3})+(?:\.\d+)?\)?$/.test(t)) return true;
  if (/^\$?\(?-?\d+(?:\.\d+)?\)?$/.test(t)) return true;
  if (/^\(\$\d{1,3}(?:,\d{3})*(?:\.\d+)?\)$/.test(t)) return true;
  return false;
}

function parseTextBlockToRows(text: string): string[][] {
  // Skip past column-period header so the period markers ("2026 2025",
  // "Q1-2025 Q2-2025 ... Q1-2026") don't appear as phantom value-only rows.
  // Two header layouts seen in production:
  //   (a) Year-year: MELI / BABA / NIO / standard 2-period IS.
  //   (b) Quarter-year sequence: Tesla's "Q1 update" deck shows 5 trailing
  //       quarters per row ("Q1-2025 Q2-2025 Q3-2025 Q4-2025 Q1-2026") and
  //       the data rows have 5 numeric columns aligned to those quarters.
  const yearYearRe = /\b(?:19\d{2}|20\d{2})\s+(?:19\d{2}|20\d{2})\b/;
  const qSeqRe = /\bQ[1-4][\s\-]?(?:19\d{2}|20\d{2})(?:\s+Q[1-4][\s\-]?(?:19\d{2}|20\d{2})){2,}\b/i;
  const wqSeqRe = /(?:First|Second|Third|Fourth)\s+Quarter\s+(?:19\d{2}|20\d{2})(?:\s+(?:First|Second|Third|Fourth)\s+Quarter\s+(?:19\d{2}|20\d{2})){1,}/i;
  const yyMatch = text.match(yearYearRe);
  const qMatch  = text.match(qSeqRe);
  const wqMatch = text.match(wqSeqRe);
  // Pick whichever header pattern appears EARLIEST (deepest header is
  // the one closest to the data — for issuers like BAC the word-quarter
  // header appears mid-document; for MELI the year-year is at the top).
  const headerCandidates = [yyMatch, qMatch, wqMatch].filter((m): m is RegExpMatchArray => m !== null && typeof m.index === "number");
  headerCandidates.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const headerMatch = headerCandidates[0];
  let body = text;
  if (headerMatch && typeof headerMatch.index === "number") {
    body = text.slice(headerMatch.index + headerMatch[0].length);
  }
  // Pre-glue: `$ 7,715` → `$7,715`, `( 144 )` → `(144)`, `$ ( 1,234 )` → `$(1,234)`.
  body = body
    .replace(/\$\s*\(\s*/g, "$(")
    .replace(/\$\s+/g, "$")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")");

  const tokens = body.split(/\s+/).filter(Boolean);
  const rawRows: string[][] = [];
  let labelBuf: string[] = [];
  let valueBuf: string[] = [];

  for (const t of tokens) {
    if (isNumericToken(t)) {
      valueBuf.push(t);
    } else {
      if (valueBuf.length > 0) {
        if (labelBuf.length > 0) rawRows.push([labelBuf.join(" "), ...valueBuf]);
        labelBuf = [];
        valueBuf = [];
      }
      labelBuf.push(t);
    }
  }
  if (valueBuf.length > 0 && labelBuf.length > 0) {
    rawRows.push([labelBuf.join(" "), ...valueBuf]);
  }

  // Strip section-header prefixes like "Operating expenses: " and "Other
  // income (expenses): " that get glued onto the first row of a section
  // when the source HTML uses paragraph breaks instead of table rows. Without
  // this, rows like "Operating expenses: Product and technology development"
  // never match the R&D / S&M keyword anchors which require the bucket name
  // at the start of the label. Detect ": " followed by another capitalized
  // word; split everything before the colon into a standalone label-only row.
  const SECTION_HEADERS = /^(?:operating\s+expenses?|other\s+(?:income|expense)s?(?:\s*\([^)]*\))?|other\s+income\s*\(expenses?\)|costs?\s+and\s+expenses?|expenses?|income\s+\([^)]*\)|nonoperating\s+(?:income|expenses?)|non\s*-?\s*operating\s+(?:income|expenses?))(?::|$)/i;
  const rows: string[][] = [];
  for (const row of rawRows) {
    const label = row[0];
    const colonIdx = label.indexOf(": ");
    if (colonIdx > 0) {
      const prefix = label.slice(0, colonIdx);
      if (SECTION_HEADERS.test(prefix + ":")) {
        const rest = label.slice(colonIdx + 2).trim();
        // Emit the section header as a standalone label-only row (preserves
        // structure without affecting scoring; rows with no values get
        // filtered by the consumers that need values).
        rows.push([prefix]);
        if (rest) rows.push([rest, ...row.slice(1)]);
        else if (row.length > 1) rows.push(row.slice(1));
        continue;
      }
    }
    rows.push(row);
  }
  return rows;
}

// Pick the IS-bearing hidden-text block. Two acceptance paths:
//   (1) Contains an explicit IS-phrase ("Statements of Income/Operations",
//       "Income Statement", "Summary Income Statement", or
//       "Consolidated Statements of ..."). MELI / Chinese ADRs / European
//       FPIs all use one of these.
//   (2) No explicit phrase but the block has very high keyword density
//       (≥6 hits). Catches issuers like Tesla whose "Q1 update" deck splits
//       the IS across "REVENUES" / "COST OF REVENUES" / "OPERATING
//       EXPENSES" section headers without a formal title; the high-bar
//       fallback keeps non-IS sections (balance sheet, cash flow, MD&A)
//       from sneaking in.
// Threshold of 5 in the phrase path / 6 in the density path balances
// recall vs precision: cash flow tables often hit 4 keywords (net income +
// depreciation + interest + tax), so 5 phrase-path / 6 density-path keeps
// them out while accepting any genuine IS layout.
function findIncomeStatementBlock(blocks: string[]): string | null {
  const PHRASE_RE = /statements?\s+of\s+(?:income|operations|profit\s+(?:and|or)\s+loss)|(?:summary|condensed|consolidated|interim)\s+(?:condensed\s+)?(?:consolidated\s+)?(?:statements?\s+of\s+)?(?:income|operations)|(?:^|\b)income\s+statements?\b/i;
  let best: string | null = null;
  let bestScore = 0;
  let bestHasPhrase = false;
  for (const block of blocks) {
    let score = 0;
    for (const patterns of Object.values(KEYWORDS)) {
      if (patterns.some((re) => re.test(block))) score++;
    }
    const hasPhrase = PHRASE_RE.test(block);
    // Block qualifies if (phrase + ≥5 keywords) OR (no phrase + ≥6 keywords).
    const qualifies = hasPhrase ? score >= 5 : score >= 6;
    if (!qualifies) continue;
    // Tie-break: phrase-bearing blocks beat density-only blocks at equal score.
    if (score > bestScore || (score === bestScore && hasPhrase && !bestHasPhrase)) {
      bestScore = score;
      bestHasPhrase = hasPhrase;
      best = block;
    }
  }
  return best;
}

// Heuristic to split a header-line into N segment names. Common patterns:
//   - 1-word names: "Brazil Mexico Argentina"
//   - Modifier + name: "Other Countries", "All Other"
//   - Multi-word region: "Latin America", "North America", "Asia Pacific"
// Strategy: take tokens between the year header and the first numeric value;
// strip "Total" + parentheticals; greedy-merge consecutive tokens until we
// reach the expected count.
function pickSegmentNames(block: string, expectedCount: number): string[] {
  const yearMatch = block.match(/\b(?:19\d{2}|20\d{2})\b/);
  if (!yearMatch || typeof yearMatch.index !== "number") {
    return Array.from({ length: expectedCount }, (_, i) => `Segment ${i + 1}`);
  }
  const after = block.slice(yearMatch.index + yearMatch[0].length);
  const numStart = after.search(/\$|\(\s*\d|\s\d/);
  const headerText = numStart >= 0 ? after.slice(0, numStart) : after;

  const cleaned = headerText
    .replace(/\bTotal\b.*$/i, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return Array.from({ length: expectedCount }, (_, i) => `Segment ${i + 1}`);
  }
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === expectedCount) return tokens;

  // Greedy merge: when we have more tokens than expected segments, walk
  // forward and merge tokens whose left side is a known modifier ("Other",
  // "Rest of", "North", "Latin", ...). This handles "Other Countries" (2
  // tokens, 1 name) and "Latin America" (2 tokens, 1 name) without merging
  // the wrong pairs.
  const MODIFIERS = /^(?:other|rest|all|north|south|east|west|central|latin|asia|europe|americas?)$/i;
  const FILLERS = /^(?:of|the|and)$/i;

  if (tokens.length > expectedCount) {
    const merged: string[] = [];
    let i = 0;
    while (i < tokens.length) {
      // Greedy lookahead: if the current token is a modifier, glue it to
      // the next non-filler token (and consume any fillers in between).
      let name = tokens[i];
      let j = i + 1;
      const surplus = tokens.length - i - (expectedCount - merged.length);
      if (surplus > 0 && MODIFIERS.test(tokens[i])) {
        // Pull fillers and one continuation word.
        while (j < tokens.length && FILLERS.test(tokens[j])) {
          name += " " + tokens[j];
          j++;
        }
        if (j < tokens.length) {
          name += " " + tokens[j];
          j++;
        }
      }
      merged.push(name);
      i = j;
      if (merged.length === expectedCount) {
        // Append leftovers to the last name (handles tail "Total" if not stripped).
        if (i < tokens.length) merged[merged.length - 1] += " " + tokens.slice(i).join(" ");
        break;
      }
    }
    if (merged.length === expectedCount) return merged;
  }

  // Last-resort: trim or pad.
  if (tokens.length >= expectedCount) return tokens.slice(0, expectedCount);
  const padded = [...tokens];
  while (padded.length < expectedCount) padded.push(`Segment ${padded.length + 1}`);
  return padded;
}

// Extract per-segment revenue from a hidden-text segment block. Block layout:
//   <Issuer>, Inc. Financial results of reporting segments (Unaudited)
//   Three Months Ended March 31, 2026
//   Brazil Mexico Argentina Other Countries Total (In millions)
//   Net service revenues and financial income $ 3,987 $ 1,774 $ 1,607 $ 347 $ 7,715
//   Net product revenues 787 202 91 50 1,130
//   Net revenues and financial income 4,774 1,976 1,698 397 8,845
//
// Why we don't just `parseTextBlockToRows`: the segment-name header line
// ("Brazil Mexico Argentina Other Countries Total (In millions)") has no
// numeric values associated with it, so the row-builder concatenates those
// names onto the FIRST data row's label — corrupting the row's label and
// leaving us unable to find the consolidated-revenue row by anchored regex.
// Instead, we slice the block by anchoring on the consolidated-revenue
// label phrase: read N+1 numeric tokens forward (the segment values plus
// total) and extract the segment names from the header area before it.
function extractSegmentsFromHiddenText(blocks: string[]): { name: string; value: number }[] {
  const segBlock = blocks.find((b) =>
    /\b(?:reporting|operating)\s+segments?\b|\bresults?\s+of\s+(?:reporting|operating|the)\s+segments?\b|\bsegment\s+results?\b/i.test(b),
  );
  if (!segBlock) return [];

  // Restrict to the CURRENT-period section. Issuers like MELI ship the
  // segment table twice in the same block: once for the current quarter
  // (e.g. "Three Months Ended March 31, 2026") and once for the prior-year
  // comparable (e.g. "Three Months Ended March 31, 2025"). Without this
  // slice, the first-match logic would pick the prior-period consolidated
  // row of one of the periods — depending on which appears physically
  // first — and silently anchor the segment chart on the wrong year. Slice
  // up to (not including) the second period header so the regex search
  // below operates on the current-period segment table only.
  const periodHeaderRe = /\b(?:three|six|nine|twelve)[\s\-]months?\s+ended\s+(?:[A-Za-z]+)\.?\s+\d{1,2},?\s+\d{4}\b|\byear\s+ended\s+(?:[A-Za-z]+)\.?\s+\d{1,2},?\s+\d{4}\b/gi;
  const headerMatches: number[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = periodHeaderRe.exec(segBlock)) !== null) headerMatches.push(hm.index);
  const sliceStart = headerMatches[0] ?? 0;
  const sliceEnd   = headerMatches[1] ?? segBlock.length;
  const currentPeriodBlock = segBlock.slice(sliceStart, sliceEnd);

  // Pre-glue $/paren so numeric tokens are atomic.
  const glued = currentPeriodBlock
    .replace(/\$\s*\(\s*/g, "$(")
    .replace(/\$\s+/g, "$")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")");

  // Find the consolidated-revenue label. Take the FIRST match within the
  // current-period slice — within a single period, sub-revenue rows like
  // "Net service revenues" / "Net product revenues" don't match this regex
  // (they have "service"/"product" between "net" and "revenues"), so the
  // first hit is always the consolidated total row.
  const revRe = /\bnet\s+revenues?\s+and\s+financial\s+(?:income|gains|services)\b|\bnet\s+revenues?\s+(?=\d|\$)|\btotal\s+(?:net\s+)?revenues?\s+(?=\d|\$)/i;
  const firstMatch = glued.match(revRe);
  if (!firstMatch || typeof firstMatch.index !== "number") return [];
  const lastMatch = firstMatch;

  // Read all consecutive numeric tokens after the label (up to ~12 to cover
  // anything reasonable; mid-phrase tokens like "and" or "income" stop the
  // run). The last value is the total; the rest are per-segment.
  const after = glued.slice((lastMatch.index ?? 0) + lastMatch[0].length).trimStart();
  const tokens = after.split(/\s+/).filter(Boolean);
  const values: number[] = [];
  for (const t of tokens) {
    if (!isNumericToken(t)) break;
    const n = parseNumber(t);
    if (n === null) break;
    values.push(Math.abs(n));
    if (values.length > 15) break;
  }
  // Need ≥ 3 values: ≥2 segments + 1 total.
  if (values.length < 3) return [];

  const segValues = values.slice(0, -1);
  const total = values[values.length - 1];
  const sum = segValues.reduce((s, v) => s + v, 0);
  if (sum <= 0 || Math.abs(sum - total) / total > 0.02) return [];

  const segNames = pickSegmentNames(segBlock, segValues.length);
  return segNames.map((name, i) => ({ name, value: segValues[i] }));
}

function rowsToSyntheticTableHtml(rows: string[][]): string {
  const trs = rows.map((row) => {
    const tds = row.map((cell) => `<td>${cell}</td>`).join("");
    return `<tr>${tds}</tr>`;
  }).join("");
  return `<table>${trs}</table>`;
}

function synthesizeWorkivaPdfTable(html: string): {
  syntheticHtml: string;
  rows: string[][];
  segments: { name: string; value: number }[];
} | null {
  // If the HTML has any real <table> tags, the standard pipeline already
  // handles it — don't risk shadowing real data with synthesized rows.
  if (/<table\b/i.test(html)) return null;
  const blocks = readHiddenTextBlocks(html);
  if (blocks.length === 0) return null;
  const isBlock = findIncomeStatementBlock(blocks);
  if (!isBlock) return null;
  const dataRows = parseTextBlockToRows(isBlock);
  if (dataRows.length < 5) return null;

  // Inject header rows so detectScale / detectCurrency / endDate scanners
  // (which all read the synthesized table's HTML and the surrounding text
  // window) find the period and unit declarations from the original block.
  // Without these, the date detector returns "" and extractIncomeStatement
  // bails at `if (!endDate) return null`.
  const headerRows: string[][] = [];
  // Period phrase: "Three Months Ended March 31, 2026" / "Six months ended
  // June 30, 2025" / "Year ended December 31, 2025". Take the LAST match
  // (block typically restates it once at the top and once just above the
  // column header — last is closest to the data).
  const periodRe = /(?:three|six|nine|twelve)[\s\-]months?\s+ended\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4}|year\s+ended\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4}/gi;
  let lastPeriod: RegExpExecArray | null = null;
  let pm: RegExpExecArray | null;
  while ((pm = periodRe.exec(isBlock)) !== null) lastPeriod = pm;
  if (lastPeriod) {
    headerRows.push([lastPeriod[0]]);
  } else {
    // Some decks omit the "Three Months Ended..." phrase and only expose
    // period as compact column tokens. Three layouts to handle:
    //   (1) Tesla-style: "Q1-2026" / "Q1 2026"
    //   (2) BAC-style:   "First Quarter 2026" / "Fourth Quarter 2025"
    //   (3) Generic:     "1Q26" / "1Q 2026" (some specialty issuers)
    // Find the LATEST token across all three patterns and synthesize a
    // standard period phrase so the date scanner can lock onto it.
    const QWORDS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4 };
    const candidates: { q: number; y: number }[] = [];
    for (const m of isBlock.matchAll(/Q([1-4])[\s\-]?(\d{4})\b/gi)) {
      candidates.push({ q: parseInt(m[1], 10), y: parseInt(m[2], 10) });
    }
    for (const m of isBlock.matchAll(/\b([1-4])Q\s?(\d{2,4})\b/gi)) {
      const yRaw = m[2];
      const y = yRaw.length === 2 ? 2000 + parseInt(yRaw, 10) : parseInt(yRaw, 10);
      candidates.push({ q: parseInt(m[1], 10), y });
    }
    for (const m of isBlock.matchAll(/\b(First|Second|Third|Fourth)\s+Quarter\s+(\d{4})\b/gi)) {
      candidates.push({ q: QWORDS[m[1].toLowerCase()], y: parseInt(m[2], 10) });
    }
    if (candidates.length > 0) {
      let latest = { q: 0, y: 0 };
      for (const c of candidates) {
        if (c.y > latest.y || (c.y === latest.y && c.q > latest.q)) latest = c;
      }
      if (latest.y > 0 && latest.q >= 1 && latest.q <= 4) {
        const monthDay = ["March 31", "June 30", "September 30", "December 31"][latest.q - 1];
        headerRows.push([`Three Months Ended ${monthDay}, ${latest.y}`]);
      }
    }
  }
  // Unit phrase: "(In millions of U.S. dollars)" / "(in thousands)".
  const unitMatch = isBlock.match(/\((?:in\s+)?(thousands|millions|billions)(?:\s+of\s+(?:[uU]\.?[sS]\.?\s+)?(?:dollars|euros?|pounds?|yen|yuan|reais?|francs?))?[^)]*\)/i);
  if (unitMatch) headerRows.push([unitMatch[0]]);
  // Column header — inject so the value-column-offset heuristic in
  // extractIncomeStatement can find the "current period" column.
  // Three layouts handled:
  //   (A) Bare year-year ("2026 2025") for standard 2-period IS.
  //   (B) Quarter-year sequence ("Q1-2025 Q2-2025 ... Q1-2026") — Tesla.
  //   (C) Word-quarter sequence ("First Quarter 2026 Fourth Quarter 2025
  //       First Quarter 2025") — Bank of America / specialty issuers.
  // Emit each year as its own cell so the existing "leftmost-of-max bare
  // 4-digit year" detector finds the latest-period column index.
  const yearYearMatch = isBlock.match(/\b(19\d{2}|20\d{2})\s+(19\d{2}|20\d{2})\b/);
  const quarterSeqMatch = isBlock.match(/\bQ[1-4][\s\-]?(?:19\d{2}|20\d{2})(?:\s+Q[1-4][\s\-]?(?:19\d{2}|20\d{2})){2,}\b/i);
  const wordQuarterSeqMatch = isBlock.match(/(?:First|Second|Third|Fourth)\s+Quarter\s+(?:19\d{2}|20\d{2})(?:\s+(?:First|Second|Third|Fourth)\s+Quarter\s+(?:19\d{2}|20\d{2})){1,}/i);
  if (quarterSeqMatch) {
    const years = [...quarterSeqMatch[0].matchAll(/Q[1-4][\s\-]?(\d{4})/gi)].map((mm) => mm[1]);
    if (years.length >= 3) headerRows.push(years);
  } else if (wordQuarterSeqMatch) {
    const years = [...wordQuarterSeqMatch[0].matchAll(/(?:First|Second|Third|Fourth)\s+Quarter\s+(\d{4})/gi)].map((mm) => mm[1]);
    if (years.length >= 2) headerRows.push(years);
  } else if (yearYearMatch) {
    headerRows.push([yearYearMatch[1], yearYearMatch[2]]);
  }

  const rows = [...headerRows, ...dataRows];
  const segments = extractSegmentsFromHiddenText(blocks);
  return { syntheticHtml: rowsToSyntheticTableHtml(rows), rows, segments };
}

function extractIncomeStatement(html: string): Edgar8KIncomeStatement | null {
  // Capture the best table AND the top supplementary tables for cross-table
  // value lookup. Some IFRS issuers (Cameco's Q1 6-K is the canonical case)
  // ship a compact "Highlights" table with Revenue / GP / NI plus a
  // separate segment-reconciliation table elsewhere that carries the
  // detailed tax / D&A / SBC numbers. The best-table-only walk would miss
  // those and force the chart to fall back to scaled annual proxies.
  const findBestTable = (allowMultiline: boolean) => {
    const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
    let bestRows: string[][] | null = null;
    let bestScore = 0;
    let bestHtml = "";
    let bestStart = 0;
    const supplementary: Array<{ rows: string[][]; score: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = tableRe.exec(html)) !== null) {
      const tableHtml = m[0];
      const rows = tableToRows(tableHtml, allowMultiline);
      if (rows.length < 5) continue;
      const score = scoreTable(rows);
      if (score > bestScore) {
        // Demote previous best to supplementary if it scored well enough.
        if (bestRows && bestScore >= 3) supplementary.push({ rows: bestRows, score: bestScore });
        bestScore = score;
        bestRows  = rows;
        bestHtml  = tableHtml;
        bestStart = m.index;
      } else if (score >= 3) {
        supplementary.push({ rows, score });
      }
    }
    // Sort supplementary tables by descending score so cross-table lookup
    // tries the most-IS-like ones first.
    supplementary.sort((a, b) => b.score - a.score);
    return { bestRows, bestScore, bestHtml, bestStart, supplementary };
  };

  // First pass: only standard <tr>/<td> tables. The multi-line text-table
  // fallback is too lossy when adjacent 3-digit columns get merged as one
  // value (e.g., "Profit before tax 599 948 915" → 599948915). Run it only
  // if no structured table cleared the threshold of 4 unique line items.
  let { bestRows, bestScore, bestHtml, bestStart, supplementary } = findBestTable(false);
  if (!bestRows || bestScore < 4) {
    ({ bestRows, bestScore, bestHtml, bestStart, supplementary } = findBestTable(true));
  }

  // Workiva-PDF format: zero <table> tags, IS table baked into a JPG image
  // with OCR-extracted text shipped in a hidden `<font color:white>` block.
  // Synthesize a row matrix from that hidden text and feed it into the same
  // pipeline. See synthesizeWorkivaPdfTable above for the full layout.
  // Segments come from a sibling block ("Financial results of reporting
  // segments") and are attached at the final return below.
  let workivaSynthSegments: Edgar8KSegment[] | undefined;
  if (!bestRows || bestScore < 4) {
    const synth = synthesizeWorkivaPdfTable(html);
    if (synth) {
      const synthScore = scoreTable(synth.rows);
      if (synthScore >= 4) {
        bestRows  = synth.rows;
        bestScore = synthScore;
        bestHtml  = synth.syntheticHtml;
        bestStart = 0;
        if (synth.segments.length >= 2) {
          // detectScale will pick up the unit declaration from the document
          // body ("In millions of U.S. dollars"). Apply the same scale to
          // segment values so they're stored as raw dollar amounts like the
          // table-based path produces.
          workivaSynthSegments = synth.segments.map((s) => ({ name: s.name, value: s.value }));
        }
      }
    }
  }
  if (!bestRows || bestScore < 4) return null;

  bestRows = liftUnlabeledSectionTotals(bestRows);

  const scale = detectScale(bestHtml, bestRows, html, bestStart);
  const currency = detectCurrency(bestHtml, html, bestStart);
  // Apply the document-detected scale to Workiva-synthesized segments now
  // that we know it. Segment numbers parsed from the hidden text are in the
  // same unit as the IS table (almost always "in millions"), so multiplying
  // by the unit scale lifts them to raw dollars to match what
  // extractRevenueSegments returns.
  if (workivaSynthSegments) {
    workivaSynthSegments = workivaSynthSegments.map((s) => ({ name: s.name, value: s.value * scale }));
  }
  const rowsRef = bestRows;

  // Some foreign issuers (BABA, NIO, many TM-prepared 6-Ks) put the prior
  // year column to the LEFT of the current year — header reads "2024 2025
  // 2024 2025" with the IS values in the same order. Picking the leftmost
  // numeric column would lock the parse to the prior year, which then trips
  // isEdgarStale and silently falls back to Yahoo. Detect the layout in two
  // passes:
  //   1. Per-column FULL DATE headers ("December 31, 2024 | September 30,
  //      2025 | December 31, 2025 | December 31, 2025") — pick the LEFTMOST
  //      column whose date is the maximum across all columns. NIO's Q4 6-K
  //      stacks Q4-prior | Q3 | Q4-current RMB | Q4-current USD; the latest
  //      RMB column wins (offset=2) and the USD translation column is
  //      ignored.
  //   2. Bare 4-digit years ("2024 2025") — legacy fallback used by issuers
  //      whose column headers compress to year-only. Same leftmost-of-max
  //      rule. US issuers (AAPL, MSFT) report current-then-prior so col[0]
  //      is the max and offset stays 0.
  // Returns both the offset AND the resolved endDate so the date scan below
  // can use the picked column directly instead of latching onto a leading
  // prior-period date in the same header row.
  const { valueColumnOffset, pickedColumnEndDate } = (() => {
    const monthAlt = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";
    const dateRe = new RegExp(`^\\s*(${monthAlt})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\s*$`, "i");
    const months: Record<string, number> = {
      january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
      july: 7, august: 8, september: 9, sept: 9, october: 10, november: 11, december: 12,
      jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    };
    // Filter empty/whitespace cells before indexing — TR rows in SEC filings
    // are heavily padded with empty <td>s for spacing, which would otherwise
    // shift the date column index out of sync with the value-column index in
    // the data rows (splitRow drops empties before pushing to values[]).
    const colDates = new Map<number, string>();
    for (const row of rowsRef.slice(0, 6)) {
      const filtered = row.map((c) => c.trim()).filter(Boolean);
      for (let i = 0; i < filtered.length; i++) {
        const t = filtered[i];
        const dm = t.match(dateRe);
        if (dm) {
          const mn = months[dm[1].toLowerCase().replace(/\.$/, "")];
          if (mn) {
            const ds = `${dm[3]}-${String(mn).padStart(2, "0")}-${String(parseInt(dm[2], 10)).padStart(2, "0")}`;
            if (!colDates.has(i)) colDates.set(i, ds);
          }
        }
      }
    }
    if (colDates.size >= 2) {
      let maxDate = "";
      for (const d of colDates.values()) if (d > maxDate) maxDate = d;
      let earliestCol = Number.POSITIVE_INFINITY;
      for (const [col, d] of colDates) if (d === maxDate && col < earliestCol) earliestCol = col;
      return { valueColumnOffset: earliestCol, pickedColumnEndDate: maxDate };
    }
    // Build year-per-column mapping. Walk header rows column-by-column;
    // first 4-digit year that appears at column index `i` wins. This
    // generalizes the legacy 2-column "current vs prior" check to N-column
    // layouts (Tesla's deck shows 5 trailing quarters with header
    // "Q1-2025 Q2-2025 Q3-2025 Q4-2025 Q1-2026" — synthesized into a header
    // row with five year cells).
    const yearByCol = new Map<number, number>();
    for (const row of rowsRef.slice(0, 6)) {
      const filtered = row.map((c) => c.trim()).filter(Boolean);
      for (let i = 0; i < filtered.length; i++) {
        if (/^\d{4}$/.test(filtered[i])) {
          const n = parseInt(filtered[i], 10);
          if (n >= 1990 && n <= 2100 && !yearByCol.has(i)) {
            yearByCol.set(i, n);
          }
        }
      }
    }
    if (yearByCol.size < 2) return { valueColumnOffset: 0, pickedColumnEndDate: "" };
    let maxYear = -1;
    for (const y of yearByCol.values()) if (y > maxYear) maxYear = y;
    // Leftmost column whose year equals max — covers both standard
    // current-first layouts (offset=0) and prior-first / N-column layouts.
    let leftmostMax = -1;
    for (const [col, y] of yearByCol) {
      if (y === maxYear && (leftmostMax < 0 || col < leftmostMax)) leftmostMax = col;
    }
    return { valueColumnOffset: leftmostMax < 0 ? 0 : leftmostMax, pickedColumnEndDate: "" };
  })();

  // Some issuers (e.g. ADP) indent line items with leading empty cells, so
  // the label sits in column 2/3/4. Walk the row to find the first non-empty
  // non-numeric cell as the label, then continue scanning for the first
  // numeric value (which is the most-recent quarter).
  const splitRow = (row: string[]): { label: string; firstValue: number | null } => {
    let label = "";
    let foundLabel = false;
    const values: number[] = [];
    for (const cell of row) {
      const t = cell.trim();
      if (!t) continue;
      // Drop standalone currency-symbol cells — issuers like CAT/AAPL render
      // a lone "$" before the first numeric column, which would otherwise be
      // concatenated to the label as "Profit 1 $" / "iPhone $" and break
      // anchored regex matches.
      if (/^[$€£¥₹]+$/.test(t)) continue;
      // Drop YoY/period-change cells — RYAAY-style filings put a "Change %"
      // column ("+10%", "-44%", "-7%") between the label and the actual
      // monetary values. parseNumber strips the % sign, so without this
      // guard the % value gets adopted as the row's first numeric and the
      // chart shows -44M instead of the real €18.2M operating profit.
      if (/^[+\-(]?\s*\d+(?:[.,]\d+)?\s*\)?\s*%\s*$/.test(t)) continue;
      // Drop standalone year cells (e.g. CVX merges section header + year
      // headers into a single <tr>: "REVENUES AND OTHER INCOME" + "2026" +
      // "2025"). Otherwise totalRevenue would resolve to the year (2026).
      if (isYearCell(t)) continue;
      const n = parseNumber(t);
      if (!foundLabel) {
        if (n === null) {
          label = label ? `${label} ${t}` : t;
        } else {
          foundLabel = true;
          values.push(n);
        }
      } else if (n !== null) {
        values.push(n);
      }
    }
    label = label.replace(/[\s$€£¥₹]+$/u, "").trim();

    // Foreign-filer 6-K layouts (SPOT, etc.) put a small "Note" column
    // between the label and the actual values: "revenue | 20 | 4,533 | 4,190"
    // where 20 is a footnote reference. Nokia-style multi-note rows can have
    // two consecutive footnotes ("Net sales 2, 5 6 125 ..."). Skip leading
    // small integers as long as a subsequent value is ≥ 30× larger.
    let firstIdx = 0;
    while (
      firstIdx < values.length - 1 &&
      Number.isInteger(values[firstIdx]) &&
      Math.abs(values[firstIdx]) <= 30
    ) {
      const tail = values.slice(firstIdx + 1).map((v) => Math.abs(v));
      const maxAbs = tail.length ? Math.max(...tail) : 0;
      if (maxAbs >= Math.abs(values[firstIdx]) * 30) {
        firstIdx++;
      } else break;
    }
    // valueColumnOffset shifts past a leading prior-year column for issuers
    // that report prior-then-current (BABA-style). When the row has fewer
    // values than expected (single-column summary) fall back to the first
    // available so we don't lose the row entirely.
    const firstValue: number | null =
      values[firstIdx + valueColumnOffset] ?? values[firstIdx] ?? null;

    if (label && firstValue !== null) return { label, firstValue };
    if (label) return { label, firstValue: null };
    return { label: "", firstValue: null };
  };

  const labeledRows = rowsRef.map(splitRow);

  const lineValue = (label: string): number | null => {
    const patterns = KEYWORDS[label as LineKey];
    if (!patterns) return null;
    for (const re of patterns) {
      for (const lr of labeledRows) {
        if (!lr.label || lr.firstValue === null) continue;
        if (re.test(lr.label)) return lr.firstValue;
      }
    }
    return null;
  };

  // ── Column-anchored multi-table fallback ────────────────────────────────────
  // For specific high-value missing line items (Tax / Op Income / Income
  // Before Tax), scan supplementary tables for a row matching the
  // KEYWORDS regex AND extract the value from the column whose header
  // matches /total|consolidated|combined/. Cameco's Q1 6-K is the
  // canonical case: the Highlights table exposes only Revenue / GP / NI,
  // but Tabla 21 (segment-level reconciliation: Uranium / Fuel Services
  // / Westinghouse / Other / TOTAL) carries the consolidated tax + op
  // income in the rightmost column. The earlier naïve `splitRow`-based
  // fallback returned per-segment values from the leftmost column —
  // hence the column-anchor here.
  const lineValueFromSupplementary = (
    label: LineKey,
  ): number | null => {
    const patterns = KEYWORDS[label as LineKey];
    if (!patterns) return null;
    for (const supp of supplementary) {
      // Compact each row: drop empty cells and standalone $/year markers.
      // Counting non-empty cells, identify the column index `valueCol` of
      // the header cell whose text matches /total|consolidated/. Then for
      // each data row, the value at that same compacted-index is the
      // consolidated total. Cameco's Tabla 21 header is `[($ MILLIONS),
      // URANIUM 1, FUEL SERVICES, WESTINGHOUSE, OTHER, TOTAL]` — 5 value
      // columns; "TOTAL" is at compacted-index 5 (the 6th cell counting
      // from 0). Data row [Income taxes, —, —, —, 32, 32] has the same
      // structure, so values[5] = 32.
      const compact = (row: string[]) =>
        row.map(c => c?.trim() ?? "").filter(c => {
          if (!c) return false;
          if (/^[$€£¥₹]+$/.test(c)) return false;
          if (/^\d{4}$/.test(c) && parseInt(c, 10) >= 1990 && parseInt(c, 10) <= 2100) return false;
          return true;
        });
      let valueCol = -1;
      for (let r = 0; r < Math.min(6, supp.rows.length); r++) {
        const hdr = compact(supp.rows[r]);
        for (let c = 0; c < hdr.length; c++) {
          if (/^(total|consolidated|combined|grand\s*total)$/i.test(hdr[c])) {
            valueCol = c;
            break;
          }
        }
        if (valueCol >= 0) break;
      }
      if (valueCol < 0) continue;
      for (const row of supp.rows) {
        const cells = compact(row);
        // Build label from leading non-numeric, non-dash cells. "—" / "-"
        // cells parse as null and would otherwise inflate the label
        // ("Income taxes — — —"), breaking anchored regex matches that
        // expect "Income taxes" at end of string.
        const isDash = (s: string) => /^[—–\-]+$/.test(s.trim());
        let lab = "";
        let firstNumIdx = -1;
        for (let i = 0; i < cells.length; i++) {
          if (isDash(cells[i])) {
            // Marks a value column with no value for this row — treat as
            // numeric (we've left the label region). Set firstNumIdx so
            // the loop exits and the rest of cells[] is treated as data.
            firstNumIdx = i;
            break;
          }
          const n = parseNumber(cells[i]);
          if (n !== null) { firstNumIdx = i; break; }
          lab = lab ? `${lab} ${cells[i]}` : cells[i];
        }
        if (!lab || firstNumIdx < 0) continue;
        if (!patterns.some((re) => re.test(lab))) continue;
        // valueCol is in the *same* compacted index space; just read it.
        const cell = cells[valueCol];
        if (!cell || isDash(cell)) continue;
        const n = parseNumber(cell);
        if (n !== null) return Math.abs(n);
      }
    }
    return null;
  };
  const lineValueWithFallback = (label: LineKey): number | null => {
    const v = lineValue(label);
    if (v !== null) return v;
    // Only use the cross-table fallback for `incomeTaxExpense` — the
    // single line-item with an unambiguous label across reconciliation
    // tables. operatingIncome / incomeBeforeTax KEYWORDS regexes also
    // match Cameco-style "Net earnings (loss) before income taxes" rows
    // in segment-reconciliation tables, but those rows are non-IFRS
    // segment metrics that bridge to consolidated NI (not standard IBT
    // / OpIncome) — so the totalCol value gives the wrong number.
    if (label !== "incomeTaxExpense") return null;
    return lineValueFromSupplementary(label);
  };

  const rev = lineValue("totalRevenue");
  const ni  = lineValue("netIncome");
  if (rev === null || rev <= 0 || ni === null) return null;

  // When valueColumnOffset detection already resolved a column-anchored
  // endDate (BABA / NIO / TM-style 6-Ks with full dates per column), use it
  // directly. The fullDateRe scan below latches onto the FIRST date in the
  // header row, which under the prior-on-left layout is the comparison
  // period — three months OLDER than the column we actually parsed.
  let endDate = pickedColumnEndDate;
  const months = [
    "january","february","march","april","may","june",
    "july","august","september","october","november","december",
  ];
  // Match full or abbreviated month names. ADI uses "Jan. 31, 2026"; many
  // issuers abbreviate (Jan, Feb, Mar, ..., Sept). Capture the prefix and
  // resolve to a month index after the match.
  const monthAlt = "January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
  const fullDateRe = new RegExp(`\\b(${monthAlt})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, "i");
  const resolveMonth = (raw: string): number => {
    const lc = raw.toLowerCase();
    // Match against full names first; if none match, take the 3-letter prefix.
    for (let i = 0; i < months.length; i++) {
      if (months[i].startsWith(lc)) return i + 1;
    }
    return 0;
  };
  // Some issuers (e.g. ABBV) split the column header across rows: "March 31"
  // on one line, "2026 / 2025" on the next. Try the full-date regex first;
  // if it fails, find Month+Day in any of the first few rows and pair with
  // the first 4-digit year ≤ 2 rows below.
  // Some issuers stack header rows ("Three Months Ended" / "March 31," /
  // "2026" each on its own row). Scan deeper than the first 6 rows.
  const headerRows = rowsRef.slice(0, 15);
  // Detect annual-only IS — IFRS issuers (e.g. LATAM/LTM) file annual 6-Ks
  // at fiscal year end with columns labeled "For the year ended Dec 31, ...".
  // Without this flag we'd mislabel the FY values as Q4. Quarterly columns
  // ("three months ended", "Q1 2026", "1Q26", "Q1 FY2026") take priority.
  const headerJoined = headerRows.map((r) => r.join(" ").toLowerCase()).join(" ");
  const isQuarterlyHeader = /three\s+months\s+ended|three[-\s]month|quarter\s+ended|\b[1-4]q\s?\d{2}\b|\bq[1-4]\b/.test(headerJoined);
  // Semiannual interim: "Six Months Ended September 30, 2025" / "Half-year"
  // / "Interim Period of 6 months". Foreign issuers from Hong Kong (SKBL),
  // the UK, and several EU jurisdictions only file H1 6-K + 20-F annual —
  // there is no Q1 / Q3. Detected from header rows AND the 4KB window before
  // the table (SKBL puts the period heading in a paragraph, not the table).
  const preTableWindow = bestStart > 0
    ? html.slice(Math.max(0, bestStart - 4000), bestStart)
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .toLowerCase()
    : "";
  const semiAnnualRe = /\bsix\s+months?\s+ended|\bhalf[\s-]?year(?:ly)?\s+(?:report|results|ended)|\b(?:1h|h1|2h|h2)\b\s*(?:fy)?\s*\d{2,4}|\binterim\s+(?:period|results)\s+(?:for|of)\s+six\s+months/i;
  const isSemiAnnualHeader = !isQuarterlyHeader && (
    semiAnnualRe.test(headerJoined) || semiAnnualRe.test(preTableWindow)
  );
  const isAnnualHeader = !isQuarterlyHeader && !isSemiAnnualHeader && /\b(?:year|twelve\s+months|fiscal\s+year)\s+(?:then\s+)?ended\b|\bfor\s+the\s+(?:fiscal\s+)?year\b/.test(headerJoined);
  // Also accept DD MMM YYYY (European/military style — AXON, some others
  // use "31 DEC 2025"). Try both orderings on each header row.
  const dayMonthYearRe = new RegExp(`\\b(\\d{1,2})\\s+(${monthAlt})\\.?,?\\s+(\\d{4})\\b`, "i");
  // Skip the row-scan fallbacks when valueColumnOffset already resolved a
  // column-anchored endDate (NIO/BABA full-date headers). The greedy "first
  // match wins" loops below would otherwise overwrite it with the leading
  // prior-period date in the same header row.
  for (const row of endDate ? [] : headerRows) {
    const joined = row.join(" ");
    const dm = joined.match(fullDateRe);
    if (dm) {
      const monthNum = resolveMonth(dm[1]);
      if (monthNum > 0) {
        endDate = `${dm[3]}-${String(monthNum).padStart(2, "0")}-${String(parseInt(dm[2], 10)).padStart(2, "0")}`;
        break;
      }
    }
    const dmy = joined.match(dayMonthYearRe);
    if (dmy) {
      const monthNum = resolveMonth(dmy[2]);
      if (monthNum > 0) {
        endDate = `${dmy[3]}-${String(monthNum).padStart(2, "0")}-${String(parseInt(dmy[1], 10)).padStart(2, "0")}`;
        break;
      }
    }
  }
  if (!endDate) {
    const monthDayRe = new RegExp(`\\b(${monthAlt})\\.?\\s+(\\d{1,2})\\b`, "i");
    const yearRe = /\b(20\d{2})\b/;
    for (let i = 0; i < headerRows.length; i++) {
      const md = headerRows[i].join(" ").match(monthDayRe);
      if (!md) continue;
      const monthNum = resolveMonth(md[1]);
      if (monthNum <= 0) continue;
      for (let j = i; j < Math.min(i + 3, headerRows.length); j++) {
        const ym = headerRows[j].join(" ").match(yearRe);
        if (ym) {
          endDate = `${ym[1]}-${String(monthNum).padStart(2, "0")}-${String(parseInt(md[2], 10)).padStart(2, "0")}`;
          break;
        }
      }
      if (endDate) break;
    }
  }
  if (!endDate) {
    // Issuers like ABT use compact column labels: "1Q26", "Q1 2026", "1Q 26".
    // Map quarter-year to the standard calendar quarter end (Mar 31, Jun 30,
    // Sep 30, Dec 31). Won't match the company's fiscal calendar exactly when
    // they don't align (e.g. AAPL), but is close enough for staleness checks
    // and for labeling against Yahoo's calendar-quarter chart bars.
    //
    // Pick the LATEST quarter-year across all header rows. Bank earnings
    // releases (JPM) often start row 1 with a comparison-period reminder
    // ("Results for JPM | 4Q25 | 1Q25") and only put the current period
    // (1Q26) in row 2 — taking the first match would lock onto the
    // comparison quarter and silently rotate the parsed Sankey 3 months
    // back. Same logic applies when multiple "Q1 2026 / Q4 2025 / Q1 2025"
    // sequences appear across headers.
    const qReA = /\b([1-4])Q\s?(\d{2,4})\b/gi;       // "1Q26" / "1Q 2026"
    const qReB = /\bQ\s?([1-4])\s+(?:FY)?\s?(\d{2,4})\b/gi;
    const qReC = /\bQ([1-4])['′]\s?(\d{2})\b/gi;
    const qEnd = ["03-31","06-30","09-30","12-31"];
    let latest = { q: 0, y: 0 };
    for (const row of headerRows) {
      const joined = row.join(" ");
      for (const re of [qReA, qReB, qReC]) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(joined)) !== null) {
          const qNum = parseInt(m[1], 10);
          let yRaw = m[2];
          if (yRaw.length === 2) yRaw = "20" + yRaw;
          const yNum = parseInt(yRaw, 10);
          if (yNum < 1990 || yNum > 2100) continue;
          if (yNum > latest.y || (yNum === latest.y && qNum > latest.q)) {
            latest = { q: qNum, y: yNum };
          }
        }
      }
    }
    if (latest.y > 0 && latest.q >= 1 && latest.q <= 4) {
      endDate = `${latest.y}-${qEnd[latest.q - 1]}`;
    }
  }
  if (!endDate && preTableWindow) {
    // Fallback: SKBL-style 6-Ks place the period marker
    // ("Six Months Ended September 30, 2025") in a heading PARAGRAPH right
    // before the IS table — the table's column header has only year markers
    // ("2025 / 2024 / variance / variance"). Without this scan the parser
    // bails at the endDate check and we fall through to a much older filing.
    // Reuses the 4KB pre-table window already extracted for semiannual
    // detection (above), so we don't re-fetch the slice.
    const window = preTableWindow;
    // Prefer the LAST date match in the window (closest to the table) — it
    // anchors the table's reporting period rather than an earlier comparative.
    let lastMatch: RegExpExecArray | null = null;
    const dateScanRe = new RegExp(`(${monthAlt})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})`, "gi");
    let m2: RegExpExecArray | null;
    while ((m2 = dateScanRe.exec(window)) !== null) lastMatch = m2;
    if (lastMatch) {
      const monthNum = resolveMonth(lastMatch[1]);
      if (monthNum > 0) {
        endDate = `${lastMatch[3]}-${String(monthNum).padStart(2, "0")}-${String(parseInt(lastMatch[2], 10)).padStart(2, "0")}`;
      }
    }
    // Also flip isAnnualHeader / isQuarterlyHeader-equivalent based on the
    // surrounding text. "Six months ended" is interim (not annual). "Year
    // ended"/"Twelve months" → annual.
  }
  // When the value-column offset detected a "prior year on the left" layout
  // (BABA / NIO / TM-style 6-Ks), the date detectors above may have latched
  // onto the prior year — fullDateRe.match() and the monthDayRe + first-year
  // fallback both return the FIRST hit they find, which under this layout is
  // the prior period. Bump the year to the latest year present in the header
  // rows so the endDate matches the column we actually parsed. Capped at
  // current calendar year + 1 so a stray future-year token can't drift the
  // date forward.
  if (valueColumnOffset === 1 && endDate) {
    const dm = endDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dm) {
      const headerYears: number[] = [];
      const yearCap = new Date().getUTCFullYear() + 1;
      for (const row of rowsRef.slice(0, 6)) {
        for (const cell of row) {
          const t = cell.trim();
          if (/^\d{4}$/.test(t)) {
            const n = parseInt(t, 10);
            if (n >= 1990 && n <= yearCap) headerYears.push(n);
          }
        }
      }
      if (headerYears.length > 0) {
        const maxYear = Math.max(...headerYears);
        if (parseInt(dm[1], 10) < maxYear) {
          endDate = `${maxYear}-${dm[2]}-${dm[3]}`;
        }
      }
    }
  }

  // Last resort: scan the full document for "(Three|Six|Nine|Twelve) Months
  // Ended Month DD, YYYY". Wide-trend issuers (NEM, others with multi-quarter
  // history tables) place the period anchor in narrative text far from the
  // IS table — outside the 4KB preceding window scan above. Pick the LATEST
  // (max-year, then max-month) match so an earlier comparison-period
  // mention doesn't lock onto the prior quarter.
  if (!endDate) {
    const monthAlt2 = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";
    const fullDocText = decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
    const periodRe = new RegExp(
      `(?:three|six|nine|twelve)[\\s\\-]months?\\s+ended\\s+(${monthAlt2})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})`,
      "gi",
    );
    let bestY = 0, bestM = 0, bestD = 0;
    let pm: RegExpExecArray | null;
    while ((pm = periodRe.exec(fullDocText)) !== null) {
      const y = parseInt(pm[3], 10);
      const m = resolveMonth(pm[1]);
      const d = parseInt(pm[2], 10);
      if (m <= 0 || y < 1990 || y > 2100) continue;
      if (y > bestY || (y === bestY && (m > bestM || (m === bestM && d > bestD)))) {
        bestY = y; bestM = m; bestD = d;
      }
    }
    if (bestY > 0) {
      endDate = `${bestY}-${String(bestM).padStart(2, "0")}-${String(bestD).padStart(2, "0")}`;
    }
  }
  if (!endDate) return null;

  const totalRevenueScaled = rev * scale;
  const segments =
    extractRevenueSegments(html, totalRevenueScaled, scale) ??
    extractIfrsSegmentsFromText(html, totalRevenueScaled, scale) ??
    // Workiva-PDF: segments came from a hidden-text "reporting segments"
    // block, already raw-dollar scaled above. Validate they reconcile to
    // ~totalRevenueScaled (±3%) before accepting; the IS-block parse and
    // segment-block parse are independent so a mismatch indicates one of
    // them captured a different period or unit.
    (() => {
      if (!workivaSynthSegments) return undefined;
      const sum = workivaSynthSegments.reduce((s, x) => s + x.value, 0);
      if (sum <= 0) return undefined;
      const ratio = sum / totalRevenueScaled;
      return ratio >= 0.97 && ratio <= 1.03 ? workivaSynthSegments : undefined;
    })() ??
    undefined;

  // IFRS issuers (NOK, ASML, ...) wrap expense lines in parens to denote
  // "deduction from revenue", e.g. "Cost of sales (3 371)". parseNumber
  // reads those as -3371. Cost-of-revenue / R&D / SG&A / opex / interest /
  // tax expenses are conceptually non-negative magnitudes, so flip sign
  // when the parser returned a negative. Safe across US issuers too —
  // they already report these as positive numbers.
  const absExp = (v: number | null): number | null =>
    v === null ? null : Math.abs(v) * scale;

  // Derive gross profit from "Gross margin %" when no explicit absolute
  // line is present. Nokia's summary table reports the percentage but not
  // the dollar amount, so without this the Sankey would render with no
  // GP/COGS flow. Anchor to standalone margin rows and bound the value to
  // sane percentage range so we don't pick up bps deltas or YoY change %.
  const grossMarginPctRe = /\bgross\s+margin\s*%/i;
  const marginPctValue = (() => {
    for (const lr of labeledRows) {
      if (!lr.label || lr.firstValue === null) continue;
      if (grossMarginPctRe.test(lr.label) && lr.firstValue > 0 && lr.firstValue < 100) {
        return lr.firstValue;
      }
    }
    return null;
  })();
  const gpExplicit = lineValue("grossProfit");
  const gpDerived = (gpExplicit === null && marginPctValue !== null && rev > 0)
    ? (rev * marginPctValue) / 100
    : null;
  const gpResolved = gpExplicit ?? gpDerived;
  // Mirror the derivation for COGS — when only the margin is available we
  // can still render the flow as rev → (gp + cogs).
  const corExplicit = lineValue("costOfRevenue");
  const corResolved = corExplicit !== null
    ? Math.abs(corExplicit)
    : (gpDerived !== null ? Math.max(0, rev - gpDerived) : null);

  // Primary airline buckets from the main IS table (US single-step format).
  let aircraftFuel             = absExp(lineValue("aircraftFuel"));
  let salariesWages            = absExp(lineValue("salariesWages"));
  let aircraftMaintenance      = absExp(lineValue("aircraftMaintenance"));
  let aircraftRent             = absExp(lineValue("aircraftRent"));
  let landingFees              = absExp(lineValue("landingFees"));
  let depreciationAmortization = absExp(lineValue("depreciationAmortization"));

  // IFRS-by-function fallback: if the main IS exposed a Cost-of-Sales line
  // but no airline buckets, the breakdown is likely in a "Costs and expenses
  // by nature" / "Employment expenses" note elsewhere in the same document.
  // Run a document-wide scan as a fallback only.
  const hasIfrsCogsLayer = (corResolved ?? 0) > 0;
  const hasNoAirlineBuckets = aircraftFuel === null && salariesWages === null
    && aircraftMaintenance === null && landingFees === null;
  if (hasIfrsCogsLayer && hasNoAirlineBuckets) {
    const notes = scanAirlineNotes(html, scale);
    aircraftFuel             = aircraftFuel             ?? notes.aircraftFuel;
    salariesWages            = salariesWages            ?? notes.salariesWages;
    aircraftMaintenance      = aircraftMaintenance      ?? notes.aircraftMaintenance;
    aircraftRent             = aircraftRent             ?? notes.aircraftRent;
    landingFees              = landingFees              ?? notes.landingFees;
    depreciationAmortization = depreciationAmortization ?? notes.depreciationAmortization;
  }

  return {
    endDate,
    isAnnual: isAnnualHeader,
    isSemiAnnual: isSemiAnnualHeader,
    totalRevenue:                  totalRevenueScaled,
    costOfRevenue:                 corResolved !== null ? corResolved * scale : null,
    grossProfit:                   nullableMul(gpResolved, scale),
    researchDevelopment:           absExp(lineValue("researchDevelopment")),
    sellingGeneralAdministrative:  absExp(lineValue("sellingGeneralAdministrative")),
    salesMarketing:                absExp(lineValue("salesMarketing")),
    generalAdmin:                  absExp(lineValue("generalAdmin")),
    totalOperatingExpenses:        absExp(lineValue("totalOperatingExpenses")),
    operatingIncome:               nullableMul(lineValue("operatingIncome"), scale),
    interestExpense:               absExp(lineValue("interestExpense")),
    incomeBeforeTax:               nullableMul(lineValue("incomeBeforeTax"), scale),
    incomeTaxExpense:              absExp(lineValueWithFallback("incomeTaxExpense")),
    netIncome:                     ni * scale,
    aircraftFuel,
    salariesWages,
    aircraftMaintenance,
    aircraftRent,
    landingFees,
    depreciationAmortization,
    segments,
    currency,
  };
}

function nullableMul(v: number | null, scale: number): number | null {
  return v === null ? null : v * scale;
}

// IFRS by-function issuers (e.g. LATAM/LTM) report a single "Cost of sales"
// line on their main income statement and break it down into fuel / labor /
// maintenance / rentals only in a separate "Costs and expenses by nature"
// note. Without scanning that note we'd render a giant "Cost of Rev." block
// with no breakdown. This walks every <table> in the document, applies the
// airline KEYWORDS regexes to each row, and returns the first match per
// keyword. Run only as a fallback when the main IS didn't yield airline
// buckets — keeps us from accidentally pulling notes data into a US filing.
function scanAirlineNotes(
  html: string,
  scale: number,
): {
  aircraftFuel: number | null;
  salariesWages: number | null;
  aircraftMaintenance: number | null;
  aircraftRent: number | null;
  landingFees: number | null;
  depreciationAmortization: number | null;
} {
  const airlineKeys: LineKey[] = [
    "aircraftFuel", "salariesWages", "aircraftMaintenance",
    "aircraftRent", "landingFees", "depreciationAmortization",
  ];
  // Take the MAX absolute value across the document for each keyword. The
  // same label can appear on a balance-sheet trade-payables table (small)
  // AND on the IS by-nature note (large annual expense). Picking the max
  // reliably grabs the IS line — annual airline expenses dwarf payable
  // balances at year-end.
  const found: Partial<Record<LineKey, number>> = {};
  // Standalone "Depreciation" / "Amortization" patterns — IFRS issuers
  // (LATAM) split these into two rows in their D&A sub-note. Sum them as a
  // fallback when no combined "Depreciation and amortization" row exists.
  const depAlonePatterns = [/^depreciation(?:\s*\([^)]*\))?\s*$/i];
  const amortAlonePatterns = [/^amortization(?:\s*\([^)]*\))?\s*$/i];
  let depAlone = 0;
  let amortAlone = 0;

  const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(html)) !== null) {
    const rows = tableToRows(m[0], false);
    if (rows.length < 2) continue;

    for (const row of rows) {
      let label = "";
      let foundLabel = false;
      let firstValue: number | null = null;
      for (const cell of row) {
        const t = cell.trim();
        if (!t) continue;
        if (/^[$€£¥₹]+$/.test(t)) continue;
        if (isYearCell(t)) continue;
        const n = parseNumber(t);
        if (!foundLabel) {
          if (n === null) {
            label = label ? `${label} ${t}` : t;
          } else {
            foundLabel = true;
            firstValue = n;
            break;
          }
        }
      }
      label = label.replace(/[\s$€£¥₹]+$/u, "").trim();
      if (!label || firstValue === null) continue;
      const v = Math.abs(firstValue) * scale;

      for (const key of airlineKeys) {
        const patterns = KEYWORDS[key];
        if (!patterns) continue;
        for (const re of patterns) {
          if (re.test(label)) {
            if (found[key] === undefined || v > (found[key] as number)) {
              found[key] = v;
            }
            break;
          }
        }
      }
      // Also accumulate standalone Depreciation / Amortization for the D&A
      // fallback (kept separately because the regexes overlap with combined).
      for (const re of depAlonePatterns) {
        if (re.test(label) && v > depAlone) depAlone = v;
      }
      for (const re of amortAlonePatterns) {
        if (re.test(label) && v > amortAlone) amortAlone = v;
      }
    }
  }

  // If no combined D&A row was found, fall back to summing the standalone
  // Depreciation + Amortization rows (LATAM-style).
  if (found.depreciationAmortization === undefined && (depAlone > 0 || amortAlone > 0)) {
    found.depreciationAmortization = depAlone + amortAlone;
  }

  return {
    aircraftFuel:             found.aircraftFuel             ?? null,
    salariesWages:            found.salariesWages            ?? null,
    aircraftMaintenance:      found.aircraftMaintenance      ?? null,
    aircraftRent:             found.aircraftRent             ?? null,
    landingFees:              found.landingFees              ?? null,
    depreciationAmortization: found.depreciationAmortization ?? null,
  };
}

function isReconciled(s: Edgar8KIncomeStatement): boolean {
  if (s.totalRevenue <= 0) return false;

  // Sanity: net income shouldn't exceed revenue (would mean we mis-parsed
  // either rev or ni, swapping rows or scales).
  if (Math.abs(s.netIncome) > s.totalRevenue * 1.5) return false;

  // Reject "zombie" parses where every operating-side line came back null.
  // BABA-style filings emit "(144,029" + ")" across two adjacent <td>s; if
  // the paren-stitch fails, parseNumber treats every expense row as text and
  // they all silently null out. The shape that survives — rev + ni only,
  // nothing in between — looks reconciled but carries no actual IS data, so
  // downstream gets a one-period-older endDate-mismatched parse and falls
  // back to Yahoo. Real ISes always expose at least one of these.
  // Banks (JPM, BAC, WFC) skip cogs/gp/op/ibt entirely — they go from net
  // revenue → noninterest expense → net income. totalOperatingExpenses
  // carries the bank's noninterest expense and is enough proof of an
  // operating side without forcing the row identity check.
  const hasOperatingSide =
    s.costOfRevenue !== null ||
    s.grossProfit !== null ||
    s.operatingIncome !== null ||
    s.incomeBeforeTax !== null ||
    s.totalOperatingExpenses !== null;
  if (!hasOperatingSide) return false;

  // GP + CoGS ≈ Revenue (within 2%). Catches scale/row mismatches.
  if (s.costOfRevenue !== null && s.grossProfit !== null) {
    const sum = s.costOfRevenue + s.grossProfit;
    if (Math.abs(sum - s.totalRevenue) / s.totalRevenue > 0.02) return false;
  }

  // Operating-side identity: when GP + Op Income are both present, OpEx
  // implied = GP − Op Income should be non-negative within 2% tolerance.
  // A negative OpEx implies the GP and Op-Income rows came from different
  // tables / period scales — reject.
  if (s.grossProfit !== null && s.operatingIncome !== null) {
    if (s.operatingIncome > s.grossProfit * 1.02) return false;
  }

  // Income-Before-Tax sanity: IBT ≈ NI + Tax (ignoring equity-method results
  // and noncontrolling-interest reallocations, which can legitimately sit
  // between IBT and NI). BABA's Q2 FY26 carries a +2,241M RMB equity-method
  // line — small versus revenue (≈0.9%) but ~9% of |NI+Tax|, which would
  // wrongly trip a tight expected-magnitude threshold. Allow either 10% of
  // the expected magnitude OR 2% of revenue, whichever is larger; mis-parses
  // (wrong row, scale off, currency confusion) overshoot both.
  //
  // Tax-benefit issuers (META Q1 2026 reported a -$5,021M provision because
  // of one-off deferred-tax credits): the lineValue extractor wraps tax in
  // absExp (most issuers report "(1,234)" parens to denote expense, not
  // negative), which flips a true tax benefit's sign. Accept EITHER
  // identity — IBT = NI + tax (expense convention) OR IBT = NI − tax
  // (benefit convention) — since after absExp we can no longer tell which
  // sign the issuer originally wrote. Whichever side is closer wins; both
  // overshoot for genuine mis-parses.
  if (s.incomeBeforeTax !== null && s.incomeTaxExpense !== null) {
    const expectedExpense = s.netIncome + s.incomeTaxExpense;
    const expectedBenefit = s.netIncome - s.incomeTaxExpense;
    const denom = Math.max(
      Math.abs(s.incomeBeforeTax),
      Math.abs(expectedExpense),
      Math.abs(expectedBenefit),
      s.totalRevenue * 0.01,
    );
    const tolerance = Math.max(denom * 0.10, s.totalRevenue * 0.02);
    const diff = Math.min(
      Math.abs(s.incomeBeforeTax - expectedExpense),
      Math.abs(s.incomeBeforeTax - expectedBenefit),
    );
    if (diff > tolerance) return false;
  }

  return true;
}

// Returns the ordered list of URLs to attempt for a given filing. Most
// issuers ship a separate Exhibit 99.x file, but some foreign issuers
// (notably Nokia) embed the entire interim report in the 6-K cover doc
// itself — so for sufficiently large 6-Ks we also probe the primary doc
// directly. The size threshold filters out the smallest cover-only
// disclosures (typically <30KB).
async function resolveCandidateUrls(cik: string, filing: FilingMatch): Promise<string[]> {
  // Total filing size in bytes is a strong signal for foreign-issuer 6-Ks:
  // cover-only disclosures (insider trading, AGM notices, dividend updates,
  // share-buyback reports, board changes) sit at 10–25KB. Anything
  // substantive — separate earnings exhibit, or an interim report embedded
  // in the cover — exceeds 30KB. Tightened from 100KB so RYOJ-style small
  // Japanese FPIs whose H1 reports come in at ~60KB don't get skipped.
  // The parser rejects non-IS pages downstream, so a looser threshold just
  // costs a few extra index fetches for chatty filers — bounded by the
  // 30-candidate cap upstream.
  const COVER_ONLY_MAX_BYTES = 30_000;
  const EMBEDDED_REPORT_MIN_BYTES = 150_000;
  if (
    filing.form === "6-K" &&
    typeof filing.size === "number" &&
    filing.size < COVER_ONLY_MAX_BYTES
  ) {
    return [];
  }

  const urls: string[] = [];
  const requireRealEx99 = filing.form === "6-K";
  const exhibitUrl = await findExhibit991Url(cik, filing.accession, requireRealEx99);
  if (exhibitUrl) urls.push(exhibitUrl);

  if (
    filing.form === "6-K" &&
    filing.primaryDocument &&
    typeof filing.size === "number" &&
    filing.size >= EMBEDDED_REPORT_MIN_BYTES
  ) {
    const cikInt = parseInt(cik, 10);
    const noDash = filing.accession.replace(/-/g, "");
    const primaryUrl = `${SEC}/Archives/edgar/data/${cikInt}/${noDash}/${filing.primaryDocument}`;
    if (!urls.includes(primaryUrl)) urls.push(primaryUrl);
  }

  return urls;
}

// Lightweight probe: the FILING DATE of the issuer's most recent earnings
// release (8-K Item 2.02), without parsing the income statement. The full
// parser above returns null when a release carries no machine-readable IS
// table — the canonical case is IBM's 2026-07-14 "selected preliminary second-
// quarter results" letter, which ships prose revenue ("$17.2 billion") plus a
// GAAP↔non-GAAP margin reconciliation (gross profit / pre-tax income / EPS) and
// NO consolidated income statement with a Revenue or Net Income row. When that
// happens the analyze route silently falls back to the last 10-Q's quarter with
// no signal that a newer earnings event occurred, so the whole report (Sankey,
// valuation, verdict) reflects a pre-release period while the market has already
// repriced. This probe recovers the one fact we still need — "an earnings
// release for a later period exists" — so the route can flag the report as
// preliminary/pending. Reuses the submissions JSON (secFetch-cached, 30 min),
// so when it races the full parser for the same ticker the second read is a
// cache hit. Best-effort: returns null on any failure. US 8-K Item 2.02 only —
// FPI 6-K semiannual cadence is noisier and handled separately (deferred).
export async function fetchLatestEarningsFilingDate(
  ticker: string,
): Promise<{ form: "8-K"; filingDate: string; reportDate?: string } | null> {
  const suffix = ticker.split(".").pop() ?? "";
  if (ticker.includes(".") && suffix.length >= 2) return null;
  try {
    const cik = await resolveCIK(ticker);
    if (!cik) return null;
    const r = await secFetch(`${DATA_SEC}/submissions/CIK${cik.padStart(10, "0")}.json`, 1800);
    if (!r.ok) return null;
    const d = await r.json();
    const recent = d.filings?.recent;
    if (!recent) return null;
    const forms       = (recent.form ?? []) as string[];
    const items       = (recent.items ?? []) as string[];
    const filingDates = (recent.filingDate ?? []) as string[];
    const reportDates = (recent.reportDate ?? []) as string[];
    // `recent` is newest-first, so the first Item-2.02 8-K is the latest.
    for (let i = 0; i < forms.length; i++) {
      if (forms[i] === "8-K" && items[i] && /\b2\.02\b/.test(items[i]) && filingDates[i]) {
        return { form: "8-K", filingDate: filingDates[i], reportDate: reportDates[i] || undefined };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Strip an EDGAR HTML exhibit down to clean, readable plain text for the model.
function cleanReleaseText(html: string): string {
  const stripped = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped).replace(/\s+/g, " ").trim();
}

// Cleaned, bounded plain-text excerpt of the issuer's most recent earnings
// release (8-K/6-K Exhibit 99.1) — the text the MODEL reads to explain a move
// when the release can't be parsed into a Sankey-grade income statement.
// fetchEdgar8KIncomeStatement discards this on parse failure, which left the
// analysis blind to WHY a stock just moved: IBM's 2026-07-14 preliminary letter
// literally explains a "Software and Infrastructure performance shortfall" tied
// to the z17 cycle — the exact answer the report needs but never saw. Resolves
// the same Ex-99.1 the parser targets (findExhibit991Url), so the index/exhibit
// fetches are secFetch cache hits when this runs after the parser for the same
// ticker. Best-effort: returns null on any failure.
export async function fetchEarningsReleaseExcerpt(
  ticker: string,
  maxChars = 8000,
): Promise<{ text: string; filingDate?: string; form: "8-K" | "6-K"; sourceUrl: string } | null> {
  const suffix = ticker.split(".").pop() ?? "";
  if (ticker.includes(".") && suffix.length >= 2) return null;
  try {
    const cik = await resolveCIK(ticker);
    if (!cik) return null;
    const { candidates } = await findEarnings8KCandidates(cik);
    for (const filing of candidates) {
      const exUrl = await findExhibit991Url(cik, filing.accession, filing.form === "6-K");
      if (!exUrl) continue;
      const r = await secFetch(exUrl, 7 * 86400);
      if (!r.ok) continue;
      const text = cleanReleaseText(await r.text());
      // Require enough prose to be a real release, not a cover page / stub.
      if (text.length < 400) continue;
      return {
        text: text.length > maxChars ? `${text.slice(0, maxChars)}…` : text,
        filingDate: filing.filingDate,
        form: filing.form === "6-K" ? "6-K" : "8-K",
        sourceUrl: exUrl,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchEdgar8KIncomeStatement(
  ticker: string,
): Promise<Edgar8KIncomeStatement | null> {
  const suffix = ticker.split(".").pop() ?? "";
  if (ticker.includes(".") && suffix.length >= 2) return null;

  try {
    const cik = await resolveCIK(ticker);
    if (!cik) return null;

    const { candidates, fiscalYearEndMonth } = await findEarnings8KCandidates(cik);
    let firstParsed: Edgar8KIncomeStatement | null = null;
    let firstAccession: string | null = null;
    let firstSourceUrl: string | null = null;
    for (const filing of candidates) {
      const urls = await resolveCandidateUrls(cik, filing);
      for (const url of urls) {
        const r = await secFetch(url, 7 * 86400);
        if (!r.ok) continue;

        const parsed = extractIncomeStatement(await r.text());
        if (!parsed) continue;
        if (!isReconciled(parsed)) continue;

        firstParsed = {
          ...parsed,
          form: filing.form === "6-K" ? "6-K" : "8-K",
          fiscalYearEndMonth,
          cik,
          accession: filing.accession,
          sourceUrl: url,
        };
        firstAccession = filing.accession;
        firstSourceUrl = url;
        break;
      }
      if (firstParsed) break;
    }
    if (!firstParsed) return null;

    // Q4 derivation for foreign 6-K issuers: if the most recent earnings
    // filing reports full-year results (e.g. LATAM/LTM files an annual-only
    // 6-K at fiscal year end with no Q4-specific column), look for the prior
    // 9M YTD 6-K and subtract to derive Q4 values. US issuers with proper
    // 10-K/10-Q XBRL get this in fetchEdgarSegments; this is the text-parse
    // fallback for foreign filers.
    if (firstParsed.isAnnual && firstAccession) {
      const q4 = await tryDeriveQ4From6K(cik, candidates, firstParsed, firstAccession);
      if (q4) return { ...q4, fiscalYearEndMonth, cik, accession: firstAccession, sourceUrl: firstSourceUrl ?? undefined };
    }
    return firstParsed;
  } catch {
    return null;
  }
}

async function tryDeriveQ4From6K(
  cik: string,
  candidates: FilingMatch[],
  annual: Edgar8KIncomeStatement,
  annualAccession: string,
): Promise<Edgar8KIncomeStatement | null> {
  // Two derivation patterns, tried in order:
  //   A. Q4 = annual − Q3 9M YTD (target endDate ≈ 92 days before annual).
  //      Used by issuers from jurisdictions with quarterly disclosure (US-listed
  //      foreign filers that align with Q3 reporting).
  //   B. H2 = annual − H1 (target endDate ≈ 184 days before annual). Used by
  //      Japanese / Hong Kong / UK / EU FPIs that file a single H1 6-K plus
  //      the annual — RYOJ-style. Falls back to this when no Q3 candidate
  //      reconciles.
  // ±15-day window absorbs non-calendar fiscal years and 52/53-week drift.
  const annualEnd = new Date(annual.endDate);
  const TOLERANCE_MS = 15 * 24 * 60 * 60 * 1000;
  const Q3_TARGET_MS = annualEnd.getTime() - 92  * 24 * 60 * 60 * 1000;
  const H1_TARGET_MS = annualEnd.getTime() - 184 * 24 * 60 * 60 * 1000;

  // Two passes: Q3-style first (matches more US-aligned FPIs), then H1 fallback.
  // Each pass scans the same candidate list with its own date / ratio gates so
  // a Q3 candidate never gets misread as H1 (or vice versa).
  for (const pattern of ["q3", "h1"] as const) {
    const targetMs   = pattern === "q3" ? Q3_TARGET_MS : H1_TARGET_MS;
    const minRatio   = pattern === "q3" ? 0.5 : 0.4;
    const maxRatio   = pattern === "q3" ? 0.95 : 0.6;
    const isSemiAnnualResult = pattern === "h1";

    for (const filing of candidates) {
      if (filing.accession === annualAccession) continue;
      if (filing.form !== "6-K") continue;
      if (filing.filingDate >= annual.endDate) continue;
      const urls = await resolveCandidateUrls(cik, filing);
      for (const url of urls) {
        const r = await secFetch(url, 7 * 86400);
        if (!r.ok) continue;
        const ytd = extractIncomeStatement(await r.text());
        if (!ytd) continue;
        if (!isReconciled(ytd)) continue;
        if (ytd.isAnnual) continue;
        const ytdMs = new Date(ytd.endDate).getTime();
        if (Math.abs(ytdMs - targetMs) > TOLERANCE_MS) continue;
        const ratio = annual.totalRevenue > 0
          ? ytd.totalRevenue / annual.totalRevenue
          : 0;
        if (ratio < minRatio || ratio > maxRatio) continue;
        const derived = deriveQ4FromAnnualAndYtd(annual, ytd);
        // H1 → H2 case: the derived complement is itself a six-month period,
        // not a quarter. Mark it so buildSankeyFrom8K's period label picks
        // "H2 FY{x}" instead of the default "Q4 FY{x}".
        if (isSemiAnnualResult) derived.isSemiAnnual = true;
        return derived;
      }
    }
  }
  return null;
}

function deriveQ4FromAnnualAndYtd(
  annual: Edgar8KIncomeStatement,
  ytd: Edgar8KIncomeStatement,
): Edgar8KIncomeStatement {
  // Non-negative subtraction for expense buckets — a Q4 below zero means
  // the YTD subtraction is unreliable for that field, so zero it and let
  // the residual catch it downstream.
  const sub = (a: number | null, b: number | null): number | null => {
    if (a === null) return null;
    return Math.max(0, a - (b ?? 0));
  };
  // Signed subtraction for income/profit fields where negative is meaningful.
  const subSigned = (a: number | null, b: number | null): number | null => {
    if (a === null) return null;
    return a - (b ?? 0);
  };
  const q4Segments = annual.segments?.map((seg) => {
    const ytdSeg = ytd.segments?.find((s) => s.name === seg.name);
    return { ...seg, value: Math.max(0, seg.value - (ytdSeg?.value ?? 0)) };
  }).filter((s) => s.value > 0);

  return {
    endDate:                       annual.endDate,
    form:                          annual.form,
    isAnnual:                      false,
    totalRevenue:                  Math.max(0, annual.totalRevenue - ytd.totalRevenue),
    costOfRevenue:                 sub(annual.costOfRevenue, ytd.costOfRevenue),
    grossProfit:                   subSigned(annual.grossProfit, ytd.grossProfit),
    researchDevelopment:           sub(annual.researchDevelopment, ytd.researchDevelopment),
    sellingGeneralAdministrative:  sub(annual.sellingGeneralAdministrative, ytd.sellingGeneralAdministrative),
    salesMarketing:                sub(annual.salesMarketing, ytd.salesMarketing),
    generalAdmin:                  sub(annual.generalAdmin, ytd.generalAdmin),
    totalOperatingExpenses:        sub(annual.totalOperatingExpenses, ytd.totalOperatingExpenses),
    operatingIncome:               subSigned(annual.operatingIncome, ytd.operatingIncome),
    interestExpense:               sub(annual.interestExpense, ytd.interestExpense),
    incomeBeforeTax:               subSigned(annual.incomeBeforeTax, ytd.incomeBeforeTax),
    incomeTaxExpense:              sub(annual.incomeTaxExpense, ytd.incomeTaxExpense),
    netIncome:                     annual.netIncome - ytd.netIncome,
    aircraftFuel:                  sub(annual.aircraftFuel, ytd.aircraftFuel),
    salariesWages:                 sub(annual.salariesWages, ytd.salariesWages),
    aircraftMaintenance:           sub(annual.aircraftMaintenance, ytd.aircraftMaintenance),
    aircraftRent:                  sub(annual.aircraftRent, ytd.aircraftRent),
    landingFees:                   sub(annual.landingFees, ytd.landingFees),
    depreciationAmortization:      sub(annual.depreciationAmortization, ytd.depreciationAmortization),
    segments:                      q4Segments,
    currency:                      annual.currency,
  };
}

// Debug-only: returns each intermediate step so we can see where the parse
// failed for a specific ticker. Not used in the main analyze flow.
export async function debugEdgar8K(ticker: string): Promise<{
  cik: string | null;
  candidates: FilingMatch[];
  filing: FilingMatch | null;
  exhibitUrl: string | null;
  exhibitFetched: boolean;
  htmlLength: number | null;
  tableScores: number[];
  bestScore: number;
  topRowsPreview: string[][] | null;
  parsed: Edgar8KIncomeStatement | null;
  reconciled: boolean;
  attempts: { form: string; accession: string; reason: string }[];
  reason: string;
}> {
  const out = {
    cik: null as string | null,
    candidates: [] as FilingMatch[],
    filing: null as FilingMatch | null,
    exhibitUrl: null as string | null,
    exhibitFetched: false,
    htmlLength: null as number | null,
    tableScores: [] as number[],
    bestScore: 0,
    topRowsPreview: null as string[][] | null,
    parsed: null as Edgar8KIncomeStatement | null,
    reconciled: false,
    attempts: [] as { form: string; accession: string; reason: string }[],
    reason: "ok",
  };

  try {
    out.cik = await resolveCIK(ticker);
    if (!out.cik) { out.reason = "cik-lookup-failed"; return out; }

    const { candidates: cands } = await findEarnings8KCandidates(out.cik);
    out.candidates = cands;
    if (out.candidates.length === 0) { out.reason = "no-earnings-8k"; return out; }

    for (const filing of out.candidates) {
      const urls = await resolveCandidateUrls(out.cik, filing);
      if (urls.length === 0) {
        out.attempts.push({ form: filing.form, accession: filing.accession, reason: "no-exhibit-991" });
        continue;
      }

      let chosenUrl: string | null = null;
      let chosenHtml: string | null = null;
      let chosenParsed: Edgar8KIncomeStatement | null = null;
      let lastReason = "no-exhibit-991";

      for (const url of urls) {
        const r = await secFetch(url, 7 * 86400);
        if (!r.ok) { lastReason = `exhibit-fetch-${r.status}`; continue; }
        const html = await r.text();
        const parsed = extractIncomeStatement(html);
        if (!parsed) { lastReason = "parse-failed"; continue; }
        if (!isReconciled(parsed)) { lastReason = "reconcile-failed"; continue; }
        chosenUrl = url;
        chosenHtml = html;
        chosenParsed = parsed;
        break;
      }

      if (!chosenParsed || !chosenHtml || !chosenUrl) {
        out.attempts.push({ form: filing.form, accession: filing.accession, reason: lastReason });
        continue;
      }

      const html = chosenHtml;

      out.filing = filing;
      out.exhibitUrl = chosenUrl;
      out.exhibitFetched = true;
      out.htmlLength = html.length;

      const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
      let bestRows: string[][] | null = null;
      let m: RegExpExecArray | null;
      while ((m = tableRe.exec(html)) !== null) {
        const rows = tableToRowsExport(m[0]);
        if (rows.length < 5) continue;
        const score = scoreTableExport(rows);
        out.tableScores.push(score);
        if (score > out.bestScore) {
          out.bestScore = score;
          bestRows = rows;
        }
      }
      if (bestRows) out.topRowsPreview = bestRows.slice(0, 20).map((row) => row.slice(0, 6));
      out.parsed = chosenParsed;
      out.reconciled = true;
      out.attempts.push({ form: filing.form, accession: filing.accession, reason: "ok" });
      return out;
    }
    out.reason = "all-candidates-failed";
  } catch (e) {
    out.reason = `exception: ${e instanceof Error ? e.message : String(e)}`;
  }
  return out;
}

// Re-exports of internal helpers for the debug helper above
function tableToRowsExport(tableHtml: string): string[][] { return tableToRows(tableHtml); }
function scoreTableExport(rows: string[][]): number { return scoreTable(rows); }

