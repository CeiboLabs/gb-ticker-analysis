"use client";

import { useEffect, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

/**
 * Smooth scroll global (Lenis) para el sitio institucional.
 * - Scrollea window/documentElement: no rompe position:sticky.
 * - Con prefers-reduced-motion no se instancia: scroll nativo.
 * - lenis.css setea html.lenis { scroll-behavior: auto } y evita
 *   pelear con data-scroll-behavior="smooth" del root layout.
 */
export function LenisProvider({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;

    const lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      syncTouch: false, // touch nativo en mobile: más fiable y barato
      anchors: true, // links #hash siguen funcionando suaves
    });

    let raf = requestAnimationFrame(function loop(time) {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    });

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [reduce]);

  return <>{children}</>;
}
