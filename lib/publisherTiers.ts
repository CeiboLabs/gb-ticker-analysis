/**
 * Publisher tier classification for news items.
 *
 * The model sees each headline tagged with its source tier so it can weight
 * coverage appropriately. Tier 1 = institutional wire / regulated; Tier 3-4 =
 * blog / retail / SEO. Used in lib/buildPrompt.ts (fmtRecentNews) and in the
 * UI panel that lists news items.
 *
 * Matching is case-insensitive substring on the publisher name from Yahoo
 * Finance — "Reuters Business News" matches "reuters", "Bloomberg.com"
 * matches "bloomberg", etc.
 */

export type PublisherTier = 1 | 2 | 3 | 4;

// Tier 1 — Wire services and institutional financial press. Regulated
// disclosure, primary-source reporting, used by buy-side institutions.
const TIER_1 = [
  "reuters",
  "bloomberg",
  "wall street journal",
  "wsj",
  "financial times",
  "dow jones",
  "associated press",
  // "ap " requires word boundary handling — see classifyPublisher
  "business wire",
  "pr newswire",
  "prnewswire",
  "globenewswire",
  "globe newswire",
  "nikkei",
  "the economist",
  "businesswire",
];

// Tier 2 — Mainstream business press with curated editorial. Reliable but
// less time-critical than Tier 1; opinion pieces mixed with reporting.
const TIER_2 = [
  "cnbc",
  "yahoo finance",
  "marketwatch",
  "market watch",
  "barron",
  "forbes",
  "fortune",
  "new york times",
  "nytimes",
  "washington post",
  "thestreet",
  "the street",
  "investor's business daily",
  "investors business daily",
  "ibd",
  "axios",
  "morningstar",
  "kiplinger",
  "quartz",
  "bbc",
];

// Tier 3 — Retail-oriented blogs, SEO content, opinion-heavy. Some genuine
// research mixed with click-bait. Useful as supplementary context but not
// as primary evidence for an institutional thesis.
const TIER_3 = [
  "seeking alpha",
  "motley fool",
  "the motley fool",
  "fool.com",
  "24/7 wall st",
  "247 wall st",
  "zacks",
  "investopedia",
  "benzinga",
  "investorplace",
  "investor place",
  "money morning",
  "trefis",
  "simply wall st",
  "simplywall.st",
  "stocknews",
  "stock news",
  "etf daily news",
  "tipranks",
  "gurufocus",
  "guru focus",
  "smartasset",
  "smart asset",
  "fast company",
  "business insider",
  // Sector-specific blogs go here too — some have scoops but mostly speculation
  "9to5mac",
  "appleinsider",
  "macrumors",
  "patently apple",
  "android police",
  "android authority",
  "the verge",
  "engadget",
  "techcrunch",
  "ars technica",
  "wccftech",
  "tom's hardware",
  "semiwiki",
  "biopharma dive",
  "fiercepharma",
  "fierce biotech",
  "endpoints news",
  "stat news",
  "oilprice",
  "rigzone",
];

/**
 * Classify a publisher name into a tier 1-4. Tier 4 is "unknown / unclassified".
 * Case-insensitive substring match. Order matters — Tier 1 checked first.
 */
export function classifyPublisher(name: string | null | undefined): PublisherTier {
  if (!name) return 4;
  const n = name.toLowerCase().trim();
  if (!n) return 4;

  // Special-case "AP" (Associated Press) — needs word boundary to avoid
  // matching things like "rapid" or "ap-news-from-some-blog".
  if (/(^|\s)ap(\s|$)|^associated press/.test(n)) return 1;
  if (/(^|\s)ft(\s|$)/.test(n)) return 1; // Financial Times shorthand

  for (const m of TIER_1) if (n.includes(m)) return 1;
  for (const m of TIER_2) if (n.includes(m)) return 2;
  for (const m of TIER_3) if (n.includes(m)) return 3;
  return 4;
}

/** Short tag for UI rendering and prompt injection. */
export function tierLabel(t: PublisherTier): string {
  return `T${t}`;
}

/** Tier descriptor for system-prompt instructions. */
export function tierDescriptor(t: PublisherTier): string {
  switch (t) {
    case 1: return "wire institucional";
    case 2: return "mainstream business";
    case 3: return "blog / opinión retail";
    case 4: return "no clasificado";
  }
}
