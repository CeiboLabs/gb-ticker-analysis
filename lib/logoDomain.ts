// Per-ticker domain overrides for logo lookup.
// Some Yahoo profile websites (e.g. alibabagroup.com) don't expose a usable
// favicon at 128px and Google's s2 service falls back to a generic globe.
// Mapping the ticker to a sibling domain that *does* serve a clean favicon
// gives us the real brand mark without needing a separate logo CDN.
const DOMAIN_OVERRIDES: Record<string, string> = {
  BABA: "alibaba.com",
};

export function resolveLogoDomain(
  ticker: string,
  fallbackDomain: string | null,
): string | null {
  const override = DOMAIN_OVERRIDES[ticker.toUpperCase()];
  if (override) return override;
  return fallbackDomain;
}
