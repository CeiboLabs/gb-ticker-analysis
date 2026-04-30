// Builds a `@font-face` CSS block with the page's Montserrat woff2 files
// inlined as base64 data URIs, so an SVG that references font-family:Montserrat
// can be rasterized to canvas (and from there to PNG for the PDF) without the
// rasterizer falling back to a system sans.

let cached: Promise<string> | null = null;

export function getMontserratFontFaceCss(): Promise<string> {
  if (cached) return cached;
  cached = (async () => {
    if (typeof document === "undefined") return "";
    await document.fonts.ready;
    const out: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try { rules = sheet.cssRules; } catch { continue; }
      const base = sheet.href ?? location.href;
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSFontFaceRule)) continue;
        const family = rule.style.getPropertyValue("font-family").replace(/['"]/g, "").trim();
        if (family !== "Montserrat") continue;
        const srcRaw = rule.style.getPropertyValue("src");
        const urlMatch = srcRaw.match(/url\(\s*["']?([^"')]+)["']?\s*\)/);
        if (!urlMatch) continue;
        try {
          const resolved = new URL(urlMatch[1], base).href;
          const buf = await fetch(resolved).then((r) => {
            if (!r.ok) throw new Error(`font ${r.status}`);
            return r.arrayBuffer();
          });
          const bytes = new Uint8Array(buf);
          let bin = "";
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          const b64 = btoa(bin);
          const fmt = srcRaw.match(/format\(\s*["']?([^"')]+)["']?\s*\)/)?.[1] ?? "woff2";
          const mime = fmt === "woff2" ? "font/woff2" : fmt === "woff" ? "font/woff" : "font/ttf";
          const weight = rule.style.getPropertyValue("font-weight") || "400";
          const style = rule.style.getPropertyValue("font-style") || "normal";
          out.push(
            `@font-face{font-family:'Montserrat';font-weight:${weight};font-style:${style};src:url(data:${mime};base64,${b64}) format('${fmt}')}`
          );
        } catch {}
      }
    }
    return out.join("\n");
  })();
  return cached;
}
