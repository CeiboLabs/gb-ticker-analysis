import { useEffect, useState } from "react";

// Logo brightness probe: many corporate logos (AMZN, NKE, …) are white
// wordmarks on transparent backgrounds, which disappear on a white card.
// Sample the rendered image, compute mean luminance of opaque pixels, and
// surface "light" so the caller can swap to a dark backdrop.
//
// State carries the src it was computed for, so when `src` prop changes we
// derive `null` until the new computation lands — no need to setState inside
// the effect just to reset.
//
// Module-level cache: the result is deterministic per src, so re-mounts
// (landing ↔ report navigation, the 8 popular logos) skip the Image load +
// canvas probe entirely after the first computation.
const brightnessCache = new Map<string, "light" | "dark">();

export function useLogoBrightness(src: string | null): "light" | "dark" | null {
  const [resolved, setResolved] = useState<{ src: string; brightness: "light" | "dark" } | null>(null);

  useEffect(() => {
    if (!src || brightnessCache.has(src)) return;
    let cancelled = false;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const size = 32;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        // Logos with a baked-in white background (FMP returns these for many
        // tickers, e.g. AAPL) render fine on a white card — only flag as
        // "light" when the image has real transparency AND its visible pixels
        // are bright. Pure white wordmarks on transparent bgs (AMZN, NKE …)
        // hit both conditions and need a dark backdrop.
        let opaqueLumSum = 0;
        let opaqueCount = 0;
        let transparentCount = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 50) {
            transparentCount++;
            continue;
          }
          opaqueLumSum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          opaqueCount++;
        }
        if (opaqueCount === 0) return;
        const total = opaqueCount + transparentCount;
        const transparentRatio = transparentCount / total;
        const meanLum = opaqueLumSum / opaqueCount;
        const isLight = transparentRatio > 0.3 && meanLum > 200;
        const brightness = isLight ? "light" : "dark";
        brightnessCache.set(src, brightness);
        setResolved({ src, brightness });
      } catch {
        // Tainted canvas or other read failure — leave neutral.
      }
    };
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);

  // Cache hit resolves during render — no effect round-trip, no extra render.
  const cached = src ? brightnessCache.get(src) : undefined;
  if (cached) return cached;
  return resolved?.src === src ? resolved.brightness : null;
}
