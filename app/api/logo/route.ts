export const runtime = "edge";

// Google s2 favicons — replaces Clearbit (decommissioned 2024).
// Returns a high-res favicon (typically 128px PNG) for any public domain.
const FAVICON_URL = (domain: string, size = 128) =>
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");
  if (!domain) return new Response("Missing domain", { status: 400 });

  const res = await fetch(FAVICON_URL(domain), {
    headers: { "User-Agent": "Mozilla/5.0" },
    redirect: "follow",
  });
  if (!res.ok) return new Response("Not found", { status: 404 });

  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "image/png";

  return new Response(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
