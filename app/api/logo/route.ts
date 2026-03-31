export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");
  if (!domain) return new Response("Missing domain", { status: 400 });

  const res = await fetch(`https://logo.clearbit.com/${domain}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
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
