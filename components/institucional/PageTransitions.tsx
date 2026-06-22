"use client";

/**
 * Transición premium entre páginas del sitio institucional: PERSIANAS / board.
 * Barras verticales en el navy un escalón más claro (var(--navy-700) = #1a3163,
 * mismo tono que el principal, apenas más luminoso) que
 * entran escalonadas (stagger) cubriendo la
 * pantalla, se ejecuta la navegación por detrás, y salen escalonadas hacia
 * arriba revelando la página nueva. Las costuras finas entre slats dan la
 * lectura de "tablero bursátil que voltea". El stagger es el efecto.
 *
 * Por qué así y no la View Transitions API de React:
 * - React 19.2 estable NO exporta <ViewTransition> (es experimental-only).
 * - Las barras animan SOLO `transform` sobre un overlay fixed propio: no tocan
 *   el transform/filter del contenido, así que no rompen los `position: sticky`
 *   de las PinnedSections ni el navbar `fixed`.
 *
 * Vive en el LAYOUT (persiste). Intercepta en capture los clicks a links
 * internos → "cover" → router.push → cuando el pathname llega al destino,
 * "reveal". prefers-reduced-motion ⇒ no monta nada (navegación nativa).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion, type Variants } from "framer-motion";

const BARS = 3;

type Phase = "idle" | "cover" | "reveal";

const container: Variants = {
  idle: { transition: { staggerChildren: 0 } },
  cover: { transition: { staggerChildren: 0.1 } },
  reveal: { transition: { staggerChildren: 0.09 } },
};

// Spring sin rebote (bounce: 0 ⇒ críticamente amortiguado): arranque y frenado
// suaves, sin overshoot. visualDuration mantiene el movimiento corto, no lento.
const bar: Variants = {
  idle: { y: "100%", transition: { duration: 0 } },
  cover: { y: "0%", transition: { type: "spring", visualDuration: 0.5, bounce: 0 } },
  reveal: { y: "-100%", transition: { type: "spring", visualDuration: 0.55, bounce: 0 } },
};

export function PageTransitions() {
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();

  const [phase, setPhase] = useState<Phase>("idle");
  const pendingHref = useRef<string | null>(null);
  const targetPath = useRef<string | null>(null);

  // Intercepta clicks a links internos y arranca el cierre de persianas.
  useEffect(() => {
    if (reduce) return;

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.getAttribute("rel")?.includes("external")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      // Solo http(s) del mismo origin (descarta mailto:, tel:, externos, _blank).
      if (url.origin !== window.location.origin) return;
      // Misma ruta (solo cambia el hash) → lo maneja Lenis/nativo, sin transición.
      if (url.pathname === window.location.pathname) return;

      e.preventDefault();
      pendingHref.current = url.pathname + url.search + url.hash;
      targetPath.current = url.pathname;
      setPhase("cover");
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [reduce]);

  // Persianas cerradas → ejecutar la navegación real.
  const onCovered = useCallback(() => {
    const href = pendingHref.current;
    if (!href) return;
    if (!href.includes("#")) window.scrollTo(0, 0);
    router.push(href);
  }, [router]);

  // El destino ya montó → abrir las persianas.
  useEffect(() => {
    if (phase === "cover" && targetPath.current && pathname === targetPath.current) {
      setPhase("reveal");
    }
  }, [pathname, phase]);

  // Red de seguridad: si la navegación no resuelve, revelar igual.
  useEffect(() => {
    if (phase !== "cover") return;
    const t = setTimeout(() => setPhase("reveal"), 1800);
    return () => clearTimeout(t);
  }, [phase]);

  if (reduce) return null;

  return (
    <motion.div
      aria-hidden
      className="page-blinds"
      initial={false}
      variants={container}
      animate={phase}
      onAnimationComplete={(def) => {
        if (def === "cover") onCovered();
        else if (def === "reveal") setPhase("idle");
      }}
      style={{ pointerEvents: phase === "idle" ? "none" : "auto" }}
    >
      {Array.from({ length: BARS }).map((_, i) => (
        <motion.div key={i} className="page-blinds-bar" variants={bar} />
      ))}

      <style>{`
        .page-blinds {
          position: fixed;
          inset: 0;
          z-index: 200; /* por encima del navbar (z-50) */
          display: flex;
          overflow: hidden;
        }
        .page-blinds-bar {
          position: relative;
          flex: 1 1 0;
          height: 100%;
          /* Color propio de la transición: el navy un escalón más claro
             (--navy-700, mismo tono, apenas más luminoso). */
          background: var(--navy-700);
          will-change: transform;
          /* Costuras finas entre slats → lectura de "tablero" */
          box-shadow:
            inset 1px 0 0 rgba(255, 255, 255, 0.05),
            inset -1px 0 0 rgba(0, 0, 0, 0.22);
        }
        /* El reparto flex 1/3 redondea a sub-píxel y deja una costura hueca
           entre slats (donde el error de redondeo cae se ve el fondo). Cada
           slat solapa 1px sobre el siguiente para que nunca asome la página. */
        .page-blinds-bar:not(:last-child) {
          margin-right: -1px;
        }
      `}</style>
    </motion.div>
  );
}
