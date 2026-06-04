import { checkPublicGetLimit, clientIpFrom, PUBLIC_LIMIT_LOGO } from "@/lib/rateLimiter";
import { normalizeTicker } from "@/lib/validators";

export const runtime = "edge";

// FQDN-ish regex: labels of [a-zA-Z0-9-], length 1–63, separated by dots,
// total length ≤253. Rejects schemes, paths, IPs in URL form, and anything
// that could turn the upstream URL into an open-redirect-ish probe.
const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

// Logo lookup with fallback chain so every ticker resolves to a real brand mark
// (or a clean 404 that lets the client render its initial-letter avatar).
//
//  1. Financial Modeling Prep — keyed by ticker symbol, no auth required,
//     real corporate logos for thousands of public companies including ones
//     whose websites serve unusable favicons (GGB, ITUB, NU, …). Returns a
//     clean 404 for unknown tickers.
//  2. logo.dev — domain-keyed, requires LOGO_DEV_TOKEN. 202 = placeholder.
//  3. Google s2 favicons sz=128 — fallback by domain. Returns a generic globe
//     when the domain has no favicon; we detect that by hashing a probe.
//  4. DuckDuckGo ip3 — last-ditch low-res favicon by domain.
//  5. 404 → client falls back to the colored initial avatar.

const FMP = (t: string) =>
  `https://financialmodelingprep.com/image-stock/${encodeURIComponent(t)}.png`;
const LOGO_DEV = (d: string) =>
  `https://img.logo.dev/${encodeURIComponent(d)}?token=${process.env.LOGO_DEV_TOKEN}&size=200&retina=true&format=png`;
const GOOGLE = (d: string, sz = 128) =>
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=${sz}`;
const DDG = (d: string) =>
  `https://icons.duckduckgo.com/ip3/${encodeURIComponent(d)}.ico`;

// A domain that is guaranteed never to have a favicon — used to fingerprint
// Google's generic globe so we can recognize it on real lookups.
const GLOBE_PROBE_DOMAIN = "favicon-probe-nonexistent-823abf.invalid";
let globeHashPromise: Promise<string | null> | null = null;

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getGlobeHash(): Promise<string | null> {
  if (!globeHashPromise) {
    globeHashPromise = (async () => {
      try {
        const res = await fetch(GOOGLE(GLOBE_PROBE_DOMAIN), {
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        return await sha256Hex(buf);
      } catch {
        return null;
      }
    })();
  }
  return globeHashPromise;
}

async function tryFetch(
  url: string,
  minBytes: number,
): Promise<{ buf: ArrayBuffer; contentType: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      redirect: "follow",
    });
    if (res.status !== 200) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < minBytes) return null;
    // Only ever reflect image/* upstream content types into our response —
    // anything else (text/html, application/*) gets coerced to a safe default.
    const upstreamType = res.headers.get("content-type") ?? "";
    return {
      buf,
      contentType: upstreamType.startsWith("image/") ? upstreamType : "image/x-icon",
    };
  } catch {
    return null;
  }
}

function ok(
  result: { buf: ArrayBuffer; contentType: string },
): Response {
  return new Response(result.buf, {
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}

export async function GET(request: Request) {
  const gate = checkPublicGetLimit("logo", clientIpFrom(request), PUBLIC_LIMIT_LOGO);
  if (!gate.allowed) {
    return new Response("rate_limited", { status: 429, headers: { "Retry-After": String(gate.retryAfter) } });
  }

  const { searchParams } = new URL(request.url);
  // Only accept inputs that look like real tickers/domains so the upstream
  // logo providers never receive arbitrary user-controlled strings as part
  // of an outbound request URL.
  const ticker = normalizeTicker(searchParams.get("ticker"));
  const rawDomain = searchParams.get("domain")?.trim().toLowerCase() ?? null;
  const domain = rawDomain && DOMAIN_RE.test(rawDomain) ? rawDomain : null;
  if (!ticker && !domain) {
    return new Response("Missing or invalid ticker/domain", { status: 400 });
  }

  if (ticker) {
    const fmp = await tryFetch(FMP(ticker), 500);
    if (fmp) return ok(fmp);
  }

  if (domain && process.env.LOGO_DEV_TOKEN) {
    const logoDev = await tryFetch(LOGO_DEV(domain), 500);
    if (logoDev) return ok(logoDev);
  }

  if (domain) {
    const google = await tryFetch(GOOGLE(domain), 100);
    if (google) {
      const [hash, globeHash] = await Promise.all([
        sha256Hex(google.buf),
        getGlobeHash(),
      ]);
      if (!globeHash || hash !== globeHash) return ok(google);
    }

    const ddg = await tryFetch(DDG(domain), 200);
    if (ddg) return ok(ddg);
  }

  return new Response("Not found", { status: 404 });
}
