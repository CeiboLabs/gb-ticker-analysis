export const runtime = "edge";

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
    return {
      buf,
      contentType: res.headers.get("content-type") ?? "image/x-icon",
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
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");
  const domain = searchParams.get("domain");
  if (!ticker && !domain) {
    return new Response("Missing ticker or domain", { status: 400 });
  }

  if (ticker) {
    const fmp = await tryFetch(FMP(ticker.toUpperCase()), 500);
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
