/**
 * Google News RSS fetcher with publisher whitelist (Tier 1 / Tier 2 only).
 *
 * Yahoo Finance's news feed for mid/small-cap tickers is dominated by retail
 * blog content (Motley Fool, Seeking Alpha, StockStory) because Yahoo's
 * algorithm prioritizes recency and engagement. Wire coverage (Reuters,
 * Bloomberg, WSJ) gets buried even when it exists.
 *
 * This fetcher uses Google News's RSS endpoint with `site:` operators to
 * filter results to a curated whitelist of institutional and mainstream
 * business press. For tickers with sparse wire coverage, you'll get 1-3
 * items instead of 7 — that's intentional: fewer good items > more noise.
 *
 * Edge-runtime compatible (no XML parser dep — regex-based parsing of RSS).
 * No API key required. Google News RSS is a stable public endpoint that
 * has worked unchanged for 10+ years.
 */

export interface GNewsItem {
  title: string;
  publisher: string;
  link: string;
  publishedAt: string; // YYYY-MM-DD
  /**
   * Article snippet (1-3 sentences). Pulled from Google News RSS's
   * <description> element when present. For some sources Google leaves
   * this empty (just the title link); when that happens we omit it.
   * Used in the prompt and UI as secondary context — title alone is
   * often too thin to judge materiality.
   */
  description?: string;
}

// Publisher whitelist — same domains as Tier 1 + Tier 2 from publisherTiers.ts.
// Keep the list small enough that the query string stays under ~500 chars
// (Google News RSS sometimes rejects very long queries).
const PUBLISHER_WHITELIST = [
  "reuters.com",
  "bloomberg.com",
  "wsj.com",
  "ft.com",
  "cnbc.com",
  "marketwatch.com",
  "barrons.com",
  "apnews.com",
  "businesswire.com",
  "prnewswire.com",
  "globenewswire.com",
  "investing.com",
  "fortune.com",
  "forbes.com",
];

const GOOGLE_NEWS_BASE = "https://news.google.com/rss/search";

function buildQuery(ticker: string, companyName: string): string {
  // Clean company name — strip common corporate suffixes for better recall.
  const cleanName = companyName
    .replace(/\b(Inc\.?|Corp\.?|Corporation|Co\.?|Ltd\.?|LLC|N\.V\.?|S\.A\.?|PLC|Plc|Group|Holdings?|Limited|USA|Company)\b/gi, "")
    .replace(/[,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Build site: clauses for whitelist
  const sites = PUBLISHER_WHITELIST.map((d) => `site:${d}`).join(" OR ");

  // Ticker + (cleaned) company name as alternatives
  const subject = cleanName && cleanName !== ticker
    ? `${ticker} OR "${cleanName}"`
    : ticker;

  // Final query: subject AND whitelist
  return `(${subject}) (${sites})`;
}

/**
 * Parse the publishedAt RFC 2822 date from Google's RSS into YYYY-MM-DD.
 * RSS format: "Mon, 18 May 2026 12:34:56 GMT"
 */
function parsePubDate(s: string | null | undefined): string {
  if (!s) return "";
  const ms = Date.parse(s);
  if (!isFinite(ms)) return "";
  return new Date(ms).toISOString().split("T")[0];
}

/**
 * Strip CDATA wrappers and decode common HTML entities.
 */
function clean(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/**
 * Decode Google News redirect URLs. Items come back as
 * https://news.google.com/rss/articles/CBM... — we leave them as-is because
 * Google handles the redirect and tracking works. If the URL contains a
 * direct `&url=...` param we extract that for cleaner display, but most
 * modern Google News items don't expose it. Falling back to the Google URL
 * is fine — they redirect transparently in the browser.
 */
function extractFinalUrl(rawLink: string): string {
  try {
    const u = new URL(rawLink);
    const direct = u.searchParams.get("url");
    if (direct && direct.startsWith("http")) return direct;
    return rawLink;
  } catch {
    return rawLink;
  }
}

/**
 * Parse a Google News RSS feed and return up to `max` items.
 * Regex-based to stay edge-runtime compatible without an XML parser dep.
 * Uses matchAll() over regex literals to avoid stateful patterns.
 */
/**
 * Strip HTML markup from a Google News description block.
 *
 * The raw <description> can come in several shapes:
 *   - Raw HTML:           <a href="...">Title</a>&nbsp;&nbsp;<font>Pub</font>
 *   - Entity-encoded:     &lt;a href="..."&gt;Title&lt;/a&gt;&amp;nbsp;...
 *   - Double-encoded:     &amp;lt;a&amp;gt;...   (rare but happens)
 *   - List of articles:   <ol><li><a>T1</a>&nbsp;<font>P1</font></li>...</ol>
 *   - Orphan closing tag: </a>&nbsp;<font>Pub</font>   (no opening <a>)
 *
 * Strategy:
 *   1. Strip CDATA wrapper
 *   2. Decode HTML entities (two passes for double encoding)
 *   3. Strip HTML tags with permissive patterns that catch orphans
 *   4. Final whitespace cleanup
 *
 * The decode-before-strip order is critical: if entities are encoded,
 * stripping tags first leaves the entity-encoded "tags" as text.
 */
function stripDescriptionHtml(html: string): string {
  let text = html;

  // 1. Strip CDATA wrapper
  text = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");

  // 2. Decode HTML entities — TWO passes to handle &amp;nbsp; → &nbsp; → " "
  const decode = (s: string): string =>
    s
      .replace(/&nbsp;/g, " ")
      .replace(/&#160;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, d: string) => {
        const n = parseInt(d, 10);
        return n > 31 && n < 65536 ? String.fromCharCode(n) : " ";
      })
      .replace(/&amp;/g, "&");
  text = decode(text);
  text = decode(text); // second pass catches double-encoded cases

  // 3. Strip HTML tags. Permissive patterns (no \b) to handle <a:b>, <aBc>, etc.
  // Remove <a>...</a> blocks entirely (these are duplicated titles).
  text = text.replace(/<a[^>]*>[\s\S]*?<\/a\s*>/gi, " ");
  // Remove <font>...</font> blocks (these are publisher tags).
  text = text.replace(/<font[^>]*>[\s\S]*?<\/font\s*>/gi, " ");
  // Catch-all: any remaining tag, opening OR closing (handles orphans).
  text = text.replace(/<\/?[a-z][^>]*>/gi, " ");
  // Strip any leftover orphan brackets (extra defensive).
  text = text.replace(/<[^>]*>/g, " ");

  // 4. Final whitespace cleanup
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

function parseRss(xml: string, max: number): GNewsItem[] {
  const items: GNewsItem[] = [];

  const blocks = Array.from(xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g));
  for (const block of blocks) {
    if (items.length >= max) break;
    const body = block[1];

    const titleMatch = body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/);
    const linkMatch = body.match(/<link\b[^>]*>([\s\S]*?)<\/link>/);
    const dateMatch = body.match(/<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/);
    // <source url="...">Reuters</source>
    const sourceMatch = body.match(/<source\b[^>]*>([\s\S]*?)<\/source>/);
    // <description><![CDATA[...]]></description>
    const descMatch = body.match(/<description\b[^>]*>([\s\S]*?)<\/description>/);

    if (!titleMatch || !linkMatch) continue;

    const title = clean(titleMatch[1]);
    const link = extractFinalUrl(clean(linkMatch[1]));
    const publishedAt = parsePubDate(dateMatch ? clean(dateMatch[1]) : "");
    let publisher = sourceMatch ? clean(sourceMatch[1]) : "";

    // If <source> is missing, try to infer publisher from the title's suffix
    // ("Title here - Reuters"). Google News usually appends source like this.
    if (!publisher) {
      const dashIdx = title.lastIndexOf(" - ");
      if (dashIdx > 0 && dashIdx > title.length - 40) {
        publisher = title.slice(dashIdx + 3).trim();
      }
    }

    // Strip the " - Publisher" suffix from the title if present so the
    // display title isn't redundant with the publisher line beneath it.
    let displayTitle = title;
    if (publisher) {
      const suffix = ` - ${publisher}`;
      if (displayTitle.endsWith(suffix)) {
        displayTitle = displayTitle.slice(0, -suffix.length).trim();
      }
    }

    if (!displayTitle) continue;

    // Extract article snippet from <description> if present.
    let description: string | undefined;
    if (descMatch) {
      const raw = descMatch[1];
      const stripped = stripDescriptionHtml(raw);
      // Sanity gate: if the stripped text still contains HTML brackets or
      // unrecognized entities, the strip failed and the content is garbage.
      // Skip rather than show broken markup to the user.
      const looksLikeGarbage = /<|>|&[a-z]+;|&#\d+;/i.test(stripped);
      // Filter empty / too-short / mostly-publisher / title-repeat cases.
      if (
        !looksLikeGarbage &&
        stripped &&
        stripped.length > 30 &&
        stripped.length > displayTitle.length * 0.5
      ) {
        const titleLower = displayTitle.toLowerCase();
        const strippedLower = stripped.toLowerCase();
        const overlapStart = strippedLower.indexOf(titleLower);
        const meaningfulRest = overlapStart >= 0
          ? stripped.slice(overlapStart + displayTitle.length).trim()
          : stripped;
        if (meaningfulRest.length > 30) {
          description = meaningfulRest.length < stripped.length ? meaningfulRest : stripped;
          if (description.length > 400) description = description.slice(0, 397) + "…";
        }
      }
    }

    items.push({
      title: displayTitle,
      publisher: publisher || "Unknown",
      link,
      publishedAt,
      description,
    });
  }

  return items;
}

/**
 * Fetch up to `max` news items from Google News RSS, filtered to a
 * whitelist of institutional/mainstream publishers. Returns [] on any
 * failure (network, parse, empty feed) — caller should fall back to
 * another source.
 *
 * Caching: relies on the outer cache for the full report (24h TTL via
 * lib/cache.ts). No per-news caching needed.
 *
 * Timeout: 5s — Google News RSS usually returns in <1s; bigger timeout
 * isn't worth blocking the analysis pipeline.
 */
export async function fetchGoogleNewsWhitelist(
  ticker: string,
  companyName: string,
  max = 7,
): Promise<GNewsItem[]> {
  const query = buildQuery(ticker, companyName);
  const url = `${GOOGLE_NEWS_BASE}?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BengocheaResearch/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml",
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) return [];
    const xml = await res.text();
    if (!xml || xml.length < 200) return [];

    return parseRss(xml, max);
  } catch {
    return [];
  }
}
