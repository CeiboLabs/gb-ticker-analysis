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
  totalRevenue: number;
  costOfRevenue: number | null;
  grossProfit: number | null;
  researchDevelopment: number | null;
  sellingGeneralAdministrative: number | null;
  totalOperatingExpenses: number | null;
  operatingIncome: number | null;
  interestExpense: number | null;
  incomeBeforeTax: number | null;
  incomeTaxExpense: number | null;
  netIncome: number;
  segments?: Edgar8KSegment[];
}

interface FilingMatch {
  accession: string;
  filingDate: string;
  reportDate?: string;
}

async function findLatestEarnings8K(cik: string): Promise<FilingMatch | null> {
  const r = await secFetch(`${DATA_SEC}/submissions/CIK${cik.padStart(10, "0")}.json`);
  if (!r.ok) return null;
  const d = await r.json();
  const recent = d.filings?.recent;
  if (!recent) return null;

  const forms       = (recent.form ?? []) as string[];
  const accessions  = (recent.accessionNumber ?? []) as string[];
  const filingDates = (recent.filingDate ?? []) as string[];
  const reportDates = (recent.reportDate ?? []) as string[];
  const items       = (recent.items ?? []) as string[];

  for (let i = 0; i < forms.length; i++) {
    if (forms[i] !== "8-K") continue;
    if (items[i] && /\b2\.02\b/.test(items[i])) {
      return { accession: accessions[i], filingDate: filingDates[i], reportDate: reportDates[i] };
    }
  }

  let latest10QK = -1;
  for (let i = 0; i < forms.length; i++) {
    if (forms[i] === "10-Q" || forms[i] === "10-K") { latest10QK = i; break; }
  }
  if (latest10QK === -1) return null;

  for (let i = 0; i < latest10QK; i++) {
    if (forms[i] === "8-K") {
      return { accession: accessions[i], filingDate: filingDates[i], reportDate: reportDates[i] };
    }
  }
  return null;
}

async function findExhibit991Url(cik: string, accession: string): Promise<string | null> {
  const cikInt = parseInt(cik, 10);
  const noDash = accession.replace(/-/g, "");
  const indexUrl = `${SEC}/Archives/edgar/data/${cikInt}/${noDash}/${accession}-index.htm`;
  const r = await secFetch(indexUrl);
  if (!r.ok) return null;
  const html = await r.text();

  // Three priority tiers — issuer naming varies wildly:
  //   1. ex(hibit) + sep + 99 + sep + 1|2  — most common (AAPL, ABT, ABBV,
  //      ADBE, COST, GOOGL, META, MSFT, NFLX, etc.). Separator may be `.`,
  //      `-`, `_`, or `x` (some filers paste the marker mid-filename).
  //   2. ex(hibit) + sep + 99            — single-99 exhibits (ADP, TSLA).
  //   3. Any other .htm file in the filing that isn't the iXBRL cover doc.
  //      Used by issuers (e.g. ACN's `q2fy26earnings8-kexhibit.htm`) that
  //      don't put `99` in the filename at all.
  // No trailing word boundary on the regex — issuers like AAPL chain quarter
  // info directly: `a8-kex991q1202612272025.htm`.
  const linkRe = /href="([^"]+)"/gi;
  const ixCoverPaths = new Set<string>();
  const primary: string[] = [];
  const secondary: string[] = [];
  const otherHtm: string[] = [];
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
    if (/ex(?:hibit)?[._\-x]?99[._\-]?[12]/i.test(href)) {
      primary.push(href);
    } else if (/ex(?:hibit)?[._\-x]?99(?![0-9])/i.test(href)) {
      secondary.push(href);
    } else {
      otherHtm.push(href);
    }
  }

  let candidates: string[];
  if (primary.length > 0)         candidates = primary;
  else if (secondary.length > 0)  candidates = secondary;
  else                            candidates = otherHtm.filter((h) => !ixCoverPaths.has(h));
  if (candidates.length === 0) return null;

  const href = candidates[0];
  return href.startsWith("http") ? href : `${SEC}${href.startsWith("/") ? "" : "/"}${href}`;
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
    // (AXON, XYL) would shadow the actual total.
    /^(?:total\s+(?:revenues?|net\s+sales|sales)|net\s+(?:revenues?|sales))\s*:?\s*$/i,
    // Priority 2: just "Revenue(s)" or "Sales" alone (XYL labels its total
    // simply "Revenue" with sub-lines like "Revenue from products" above).
    /^(?:revenues?|sales)\s*:?\s*$/i,
    // Priority 3: lossy fallback — any row containing the keyword.
    /\b(net\s+(?:revenues?|sales)|total\s+(?:revenues?|sales)|revenues?)\b/i,
  ],
  costOfRevenue: [
    // Priority 1: explicit "Total cost(s) of revenue(s)" — preferred when
    // the issuer breaks COGS into products/services sub-totals.
    /^total\s+costs?\s+of\s+(?:revenues?|sales)\s*:?\s*$/i,
    /\btotal\s+costs?\s+of\s+revenues?\b/i,
    // Priority 2: standalone "Cost of X" with no trailing modifier (e.g.
    // XYL: "Cost of revenue" with "Cost of revenue from products" above;
    // AXON: "Cost of sales" with "Cost of product sales" above).
    /^costs?\s+of\s+(?:products?\s+sold|revenues?|sales|services|goods)\s*:?\s*$/i,
    // Priority 3: any match (lossy fallback).
    /\bcosts?\s+of\s+(products?\s+sold|revenues?|sales|services|goods)/i,
  ],
  grossProfit: [
    /\bgross\s+(?:profit|margin)\b/i,
  ],
  researchDevelopment: [
    /\bresearch\s+and\s+development\b/i,
  ],
  sellingGeneralAdministrative: [
    /\bselling[,\s]+general[,\s]+and\s+administrative|\bsg&a\b/i,
  ],
  operatingIncome: [
    /\b(operating\s+(?:income|earnings|profit))\b/i,
    // ADP-style fallback: when there's no explicit op income, EBT often
    // serves the same purpose because interest is already in total expenses.
    /\bearnings\s+before\s+(?:income|provision)\s+tax|\bincome\s+before\s+(?:income\s+)?tax/i,
  ],
  totalOperatingExpenses: [
    /\btotal\s+(?:operating\s+)?(?:expenses|costs)\b/i,
  ],
  interestExpense: [
    /\binterest\s+expense\b/i,
  ],
  incomeBeforeTax: [
    /\bearnings\s+before\s+(?:income|provision)|income\s+before\s+(?:income\s+)?tax/i,
  ],
  incomeTaxExpense: [
    /\b(income\s+tax(?:es)?\s+(?:expense|provision)|provision\s+for\s+(?:income\s+)?tax)/i,
    // Insurance/banking issuers often label this just "Income taxes"
    /^income\s+tax(?:es)?$/i,
  ],
  netIncome: [
    /\bnet\s+(?:earnings|income)\b/i,
  ],
};

type LineKey = keyof typeof KEYWORDS;

function tableToRows(tableHtml: string): string[][] {
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows: string[][] = [];
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(tableHtml)) !== null) {
    const rowHtml = m[1];
    const cellRe = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
    const cells: string[] = [];
    let c: RegExpExecArray | null;
    while ((c = cellRe.exec(rowHtml)) !== null) {
      const text = c[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&#160;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      cells.push(text);
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

function parseNumber(cell: string): number | null {
  let s = cell.trim();
  if (!s || /^[—–-]+$/.test(s)) return null;
  s = s.replace(/\([a-z]\)\s*$/i, "").replace(/\*+$/, "").trim();
  const negative = /^\(.+\)$/.test(s);
  s = s.replace(/[()]/g, "").replace(/\$/g, "").replace(/,/g, "").replace(/%/g, "").trim();
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
  const earliestUnit = (text: string): number | null => {
    const matches: Array<{ idx: number; scale: number }> = [];
    const m1 = text.match(/in\s+thousands/);
    if (m1) matches.push({ idx: m1.index ?? Infinity, scale: 1_000 });
    const m2 = text.match(/in\s+millions/);
    if (m2) matches.push({ idx: m2.index ?? Infinity, scale: 1_000_000 });
    const m3 = text.match(/in\s+billions/);
    if (m3) matches.push({ idx: m3.index ?? Infinity, scale: 1_000_000_000 });
    if (matches.length === 0) return null;
    matches.sort((a, b) => a.idx - b.idx);
    return matches[0].scale;
  };

  const tableText = tableHtml.replace(/<[^>]+>/g, " ").toLowerCase();
  const inTable = earliestUnit(tableText);
  if (inTable !== null) return inTable;

  for (const row of rows.slice(0, 3)) {
    const joined = row.join(" ").toLowerCase();
    if (/millions/.test(joined)) return 1_000_000;
    if (/thousands/.test(joined)) return 1_000;
  }

  // Issuers like Apple put "(In millions, except number of shares...)" in a
  // <p> ABOVE the table, not inside it. Look at a window of preceding HTML
  // (and as a last resort the whole document — most filings declare units
  // exactly once at the top of the statements section).
  if (docHtml) {
    const start = typeof tableStart === "number" ? Math.max(0, tableStart - 4000) : 0;
    const end   = typeof tableStart === "number" ? tableStart : docHtml.length;
    const preceding = docHtml.slice(start, end).replace(/<[^>]+>/g, " ").toLowerCase();
    const inPreceding = earliestUnit(preceding);
    if (inPreceding !== null) return inPreceding;

    const fullText = docHtml.replace(/<[^>]+>/g, " ").toLowerCase();
    const inFull = earliestUnit(fullText);
    if (inFull !== null) return inFull;
  }
  return 1;
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

// Walk a row and produce { label, firstValue } where label concatenates the
// leading non-numeric cells and firstValue is the first numeric column.
// Mirrors the splitRow helper inside extractIncomeStatement. Standalone
// currency symbols ($, €, ¥…) get dropped — issuers like Apple put a "$"
// in its own cell before the first row of each section, which would
// otherwise be appended to the label as "iPhone $" / "Net income $".
function rowLabelValue(row: string[]): { label: string; value: number | null } {
  let label = "";
  let value: number | null = null;
  let foundLabel = false;
  for (const cell of row) {
    const t = cell.trim();
    if (!t) continue;
    if (/^[$€£¥₹]+$/.test(t)) continue;
    const n = parseNumber(t);
    if (!foundLabel) {
      if (n === null) {
        label = label ? `${label} ${t}` : t;
      } else {
        foundLabel = true;
        value = n;
      }
    } else if (value === null && n !== null) {
      value = n;
    }
  }
  return { label: label.replace(/[\s$€£¥₹]+$/u, "").trim(), value };
}

// Geographic segment labels we don't want to surface as a "product" breakdown
// when both kinds of tables are present in the press release.
const GEO_LABEL_RE = /\b(americas|europe|emea|apac|asia[- ]?pacific|greater\s+china|china|japan|north\s+america|latin\s+america|rest\s+of\s+(world|asia)|domestic|international|united\s+states|u\.s\.|canada|mexico|africa|middle\s+east)\b/i;

// Subtotal/total rows we exclude from segment sums so the breakdown reconciles
// to revenue without double-counting.
const TOTAL_LABEL_RE = /^(total|subtotal|net\s+sales|net\s+revenues?|total\s+(net\s+)?(sales|revenues?))\b/i;

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
    const labeled = rawRows.map(rowLabelValue);

    let i = 0;
    while (i < labeled.length) {
      const r = labeled[i];
      const rowOk = !!r.label && r.value !== null && r.value > 0 && !TOTAL_LABEL_RE.test(r.label);
      if (!rowOk) { i++; continue; }

      let sum = 0;
      const run: Edgar8KSegment[] = [];
      let j = i;
      while (j < labeled.length) {
        const rj = labeled[j];
        if (!rj.label || rj.value === null || rj.value <= 0) break;
        if (TOTAL_LABEL_RE.test(rj.label)) break;
        sum += rj.value;
        run.push({ name: rj.label, value: rj.value * scale });
        j++;
      }

      if (run.length >= 2) {
        const sumScaled = sum * scale;
        const ratio = sumScaled / totalRevenue;
        if (ratio >= 0.98 && ratio <= 1.02) {
          const geoHits = run.filter((s) => GEO_LABEL_RE.test(s.name)).length;
          candidates.push({ rows: run, hasGeoKeywords: geoHits >= 2 });
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

function extractIncomeStatement(html: string): Edgar8KIncomeStatement | null {
  const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let bestRows: string[][] | null = null;
  let bestScore = 0;
  let bestHtml = "";
  let bestStart = 0;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(html)) !== null) {
    const tableHtml = m[0];
    const rows = tableToRows(tableHtml);
    if (rows.length < 5) continue;
    const score = scoreTable(rows);
    if (score > bestScore) {
      bestScore = score;
      bestRows  = rows;
      bestHtml  = tableHtml;
      bestStart = m.index;
    }
  }

  // Threshold of 4 unique line items: enough to identify a real IS table
  // while still permitting condensed formats (insurance, banking) that lack
  // cost-of-revenue / gross-profit lines.
  if (!bestRows || bestScore < 4) return null;

  const scale = detectScale(bestHtml, bestRows, html, bestStart);
  const rowsRef = bestRows;

  // Some issuers (e.g. ADP) indent line items with leading empty cells, so
  // the label sits in column 2/3/4. Walk the row to find the first non-empty
  // non-numeric cell as the label, then continue scanning for the first
  // numeric value (which is the most-recent quarter).
  const splitRow = (row: string[]): { label: string; firstValue: number | null } => {
    let label = "";
    let firstValue: number | null = null;
    let foundLabel = false;
    for (const cell of row) {
      const t = cell.trim();
      if (!t) continue;
      const n = parseNumber(t);
      if (!foundLabel) {
        if (n === null) {
          // Concatenate consecutive non-numeric cells (e.g. multi-cell labels)
          label = label ? `${label} ${t}` : t;
        } else {
          // First numeric cell — label section is done
          foundLabel = true;
          firstValue = n;
        }
      } else if (firstValue === null && n !== null) {
        firstValue = n;
      }
    }
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

  const rev = lineValue("totalRevenue");
  const ni  = lineValue("netIncome");
  if (rev === null || rev <= 0 || ni === null) return null;

  let endDate = "";
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
  // Also accept DD MMM YYYY (European/military style — AXON, some others
  // use "31 DEC 2025"). Try both orderings on each header row.
  const dayMonthYearRe = new RegExp(`\\b(\\d{1,2})\\s+(${monthAlt})\\.?,?\\s+(\\d{4})\\b`, "i");
  for (const row of headerRows) {
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
    const qReA = /\b([1-4])Q\s?(\d{2})\b/i;        // "1Q26" or "1Q 26"
    const qReB = /\bQ\s?([1-4])\s+(?:FY)?\s?(\d{2,4})\b/i; // "Q1 2026" / "Q1 26" / "Q1 FY2026"
    const qEnd = ["03-31","06-30","09-30","12-31"];
    for (const row of headerRows) {
      const joined = row.join(" ");
      const qm = joined.match(qReA) ?? joined.match(qReB);
      if (qm) {
        const qNum = parseInt(qm[1], 10);
        let yearStr = qm[2];
        if (yearStr.length === 2) yearStr = "20" + yearStr;
        endDate = `${yearStr}-${qEnd[qNum - 1]}`;
        break;
      }
    }
  }
  if (!endDate) return null;

  const totalRevenueScaled = rev * scale;
  const segments = extractRevenueSegments(html, totalRevenueScaled, scale) ?? undefined;

  return {
    endDate,
    totalRevenue:                  totalRevenueScaled,
    costOfRevenue:                 nullableMul(lineValue("costOfRevenue"), scale),
    grossProfit:                   nullableMul(lineValue("grossProfit"), scale),
    researchDevelopment:           nullableMul(lineValue("researchDevelopment"), scale),
    sellingGeneralAdministrative:  nullableMul(lineValue("sellingGeneralAdministrative"), scale),
    totalOperatingExpenses:        nullableMul(lineValue("totalOperatingExpenses"), scale),
    operatingIncome:               nullableMul(lineValue("operatingIncome"), scale),
    interestExpense:               nullableMul(lineValue("interestExpense"), scale),
    incomeBeforeTax:               nullableMul(lineValue("incomeBeforeTax"), scale),
    incomeTaxExpense:              nullableMul(lineValue("incomeTaxExpense"), scale),
    netIncome:                     ni * scale,
    segments,
  };
}

function nullableMul(v: number | null, scale: number): number | null {
  return v === null ? null : v * scale;
}

function isReconciled(s: Edgar8KIncomeStatement): boolean {
  if (s.totalRevenue <= 0) return false;
  if (s.costOfRevenue !== null && s.grossProfit !== null) {
    const sum = s.costOfRevenue + s.grossProfit;
    if (Math.abs(sum - s.totalRevenue) / s.totalRevenue > 0.02) return false;
  }
  return true;
}

export async function fetchEdgar8KIncomeStatement(
  ticker: string,
): Promise<Edgar8KIncomeStatement | null> {
  const suffix = ticker.split(".").pop() ?? "";
  if (ticker.includes(".") && suffix.length >= 2) return null;

  try {
    const cik = await resolveCIK(ticker);
    if (!cik) return null;

    const filing = await findLatestEarnings8K(cik);
    if (!filing) return null;

    const exhibitUrl = await findExhibit991Url(cik, filing.accession);
    if (!exhibitUrl) return null;

    const r = await secFetch(exhibitUrl);
    if (!r.ok) return null;

    const parsed = extractIncomeStatement(await r.text());
    if (!parsed) return null;
    if (!isReconciled(parsed)) return null;

    return parsed;
  } catch {
    return null;
  }
}

// Debug-only: returns each intermediate step so we can see where the parse
// failed for a specific ticker. Not used in the main analyze flow.
export async function debugEdgar8K(ticker: string): Promise<{
  cik: string | null;
  filing: FilingMatch | null;
  exhibitUrl: string | null;
  exhibitFetched: boolean;
  htmlLength: number | null;
  tableScores: number[];
  bestScore: number;
  topRowsPreview: string[][] | null;
  parsed: Edgar8KIncomeStatement | null;
  reconciled: boolean;
  reason: string;
}> {
  const out = {
    cik: null as string | null,
    filing: null as FilingMatch | null,
    exhibitUrl: null as string | null,
    exhibitFetched: false,
    htmlLength: null as number | null,
    tableScores: [] as number[],
    bestScore: 0,
    topRowsPreview: null as string[][] | null,
    parsed: null as Edgar8KIncomeStatement | null,
    reconciled: false,
    reason: "ok",
  };

  try {
    out.cik = await resolveCIK(ticker);
    if (!out.cik) { out.reason = "cik-lookup-failed"; return out; }

    out.filing = await findLatestEarnings8K(out.cik);
    if (!out.filing) { out.reason = "no-earnings-8k"; return out; }

    out.exhibitUrl = await findExhibit991Url(out.cik, out.filing.accession);
    if (!out.exhibitUrl) { out.reason = "no-exhibit-991"; return out; }

    const r = await secFetch(out.exhibitUrl);
    if (!r.ok) { out.reason = `exhibit-fetch-${r.status}`; return out; }
    out.exhibitFetched = true;

    const html = await r.text();
    out.htmlLength = html.length;

    // Score all tables for visibility
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
    if (bestRows) {
      out.topRowsPreview = bestRows.slice(0, 20).map((r) => r.slice(0, 6));
    }

    out.parsed = extractIncomeStatement(html);
    if (!out.parsed) { out.reason = "parse-failed"; return out; }
    out.reconciled = isReconciled(out.parsed);
    if (!out.reconciled) { out.reason = "reconcile-failed"; return out; }
  } catch (e) {
    out.reason = `exception: ${e instanceof Error ? e.message : String(e)}`;
  }
  return out;
}

// Re-exports of internal helpers for the debug helper above
function tableToRowsExport(tableHtml: string): string[][] { return tableToRows(tableHtml); }
function scoreTableExport(rows: string[][]): number { return scoreTable(rows); }
