"use client";

import Link from "next/link";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { PinnedSection, scrollWindow } from "@/components/scroll";
import { Glass } from "@/components/institucional/LiquidGlass";

/**
 * S2 — "Nuestra casa". Escena pinned estilo Barber Hauler:
 *  1. Un panel navy letterboxed (cinta) con arcos dorados queda al centro.
 *  2. Dos palabras serif blancas gigantes ("Trayectoria" / "Confianza")
 *     entran apiladas desbordando la cinta.
 *  3. Al seguir scrolleando las palabras salen hacia arriba mientras el
 *     panel se EXPANDE a casi fullscreen.
 *  4. Sobre el panel expandido aparece la declaración editorial de la casa
 *     (con énfasis en cursiva) y un CTA pill.
 * Todos los textos son copy real de la casa.
 */
export function TrayectoriaScene() {
  return (
    <PinnedSection height={380} className="band">
      {(p) => <Inner p={p} />}
    </PinnedSection>
  );
}

/* Fases del progress:
   0.00–0.42  palabras entran (la cinta ya está presente)
   0.42–0.56  palabras salen hacia arriba
   0.46–0.74  panel se expande de cinta a casi fullscreen
   0.66–0.86  párrafo + CTA aparecen                                   */
function Inner({ p }: { p: MotionValue<number> }) {
  // Panel: full-size con clip-path animado (sin layout thrash; los arcos
  // 1px no se estiran como pasaría con scale).
  const clip = useTransform(
    p,
    [0, 0.46, 0.74, 1],
    [
      "inset(26% 17% 26% 17%)",
      "inset(26% 17% 26% 17%)",
      "inset(0% 0% 0% 0%)",
      "inset(0% 0% 0% 0%)",
    ],
  );

  // Palabra 1 — entra desde abajo, sale hacia arriba
  const w1Opacity = useTransform(p, [0, 0.06, 0.22, 0.44, 0.56, 1], [0, 0, 1, 1, 0, 0]);
  const w1Y = useTransform(p, [0, 0.06, 0.22, 0.44, 0.56, 1], [70, 70, 0, 0, -130, -130]);
  // Palabra 2 — igual, con delay
  const w2Opacity = useTransform(p, [0, 0.18, 0.34, 0.46, 0.58, 1], [0, 0, 1, 1, 0, 0]);
  const w2Y = useTransform(p, [0, 0.18, 0.34, 0.46, 0.58, 1], [70, 70, 0, 0, -130, -130]);

  // Párrafo + CTA sobre el panel expandido
  const tw = scrollWindow(0.66, 0.84, 0, 1);
  const textOpacity = useTransform(p, tw.times, tw.values);
  const tyw = scrollWindow(0.66, 0.84, 36, 0);
  const textY = useTransform(p, tyw.times, tyw.values);

  // Los arcos respiran apenas con el progreso
  const arcShift = useTransform(p, [0, 1], [30, -30]);

  return (
    <div className="tray-scene">
      {/* Panel navy con arcos dorados */}
      <motion.div className="tray-panel" style={{ clipPath: clip }} aria-hidden>
        <motion.span className="tray-arc tray-arc-a" style={{ x: arcShift }} />
        <motion.span className="tray-arc tray-arc-b" style={{ x: arcShift }} />
        <motion.span className="tray-arc tray-arc-c" />
      </motion.div>

      {/* Palabras gigantes desbordando la cinta */}
      <motion.h2
        className="t-display-xl t-serif-display tray-word tray-word-1"
        style={{ opacity: w1Opacity, y: w1Y }}
      >
        Trayectoria
      </motion.h2>
      <motion.h2
        className="t-display-xl t-serif-display tray-word tray-word-2"
        style={{ opacity: w2Opacity, y: w2Y }}
      >
        Confianza
      </motion.h2>

      {/* Declaración editorial sobre el panel expandido */}
      <motion.div className="tray-copy" style={{ opacity: textOpacity, y: textY }}>
        <p className="tray-lede">
          Desde 1967 monitoreamos el mercado en búsqueda de las{" "}
          <em>mejores oportunidades de inversión</em>. La confianza de nuestros
          clientes siempre fue <em>nuestro norte</em>.
        </p>
        <Glass interactive>
          <Link href="/equipo" className="lqg-btn">
            Conocé al equipo <span aria-hidden>→</span>
          </Link>
        </Glass>
      </motion.div>

      <style>{`
        .tray-scene {
          position: relative;
          width: 100%;
          height: 100%;
          /* En reduce-motion no hay pin: el panel necesita su alto propio */
          min-height: 88vh;
          display: grid;
          place-items: center;
        }
        .tray-panel {
          position: absolute;
          inset: 0;
          margin: auto;
          width: min(96vw, 1480px);
          height: 88vh;
          background:
            radial-gradient(120% 100% at 78% 10%, rgba(201,168,76,0.10), transparent 55%),
            linear-gradient(118deg, #0a1838 0%, var(--navy) 48%, #16294f 100%);
          overflow: hidden;
        }
        .tray-arc {
          position: absolute;
          border: 1px solid rgba(235, 210, 136, 0.55);
          border-radius: 50%;
          pointer-events: none;
        }
        .tray-arc-a { width: 90vh; height: 140vh; left: 16%; top: -22vh; }
        .tray-arc-b { width: 110vh; height: 170vh; left: 38%; top: -36vh; border-color: rgba(235,210,136,0.35); }
        .tray-arc-c { width: 70vh; height: 70vh; right: -18vh; bottom: -28vh; border-color: rgba(235,210,136,0.25); }
        /* .site h2 define color con especificidad (0,1,1): hace falta
           (0,2,0) para que el blanco gane */
        .site .tray-word {
          position: absolute;
          left: 50%;
          translate: -50% 0;
          margin: 0;
          color: #fff;
          white-space: nowrap;
          z-index: 2;
          text-shadow: 0 2px 28px rgba(2, 4, 40, 0.35);
        }
        /* Dentro de la cinta navy (±21vh del centro): blancas sobre navy,
           una arriba y otra abajo, como la referencia */
        .tray-word-1 { top: calc(50% - 20vh); }
        .tray-word-2 { top: calc(50% + 4vh); }
        .tray-copy {
          position: relative;
          z-index: 2;
          max-width: 46em;
          padding: 0 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 36px;
        }
        .tray-lede {
          margin: 0;
          font-family: var(--font-serif), "Newsreader", Georgia, serif;
          font-weight: 300;
          font-size: clamp(24px, 2.9vw, 40px);
          line-height: 1.35;
          letter-spacing: -0.01em;
          color: #fff;
        }
        .tray-lede em {
          font-style: italic;
          font-weight: 300;
          color: var(--gold-soft);
        }
        @media (max-width: 760px) {
          .site .tray-word { white-space: normal; text-align: center; width: 100%; }
          /* Cinta mobile: panel 80vh con inset 26% → visible ±19.2vh */
          .tray-word-1 { top: calc(50% - 16vh); }
          .tray-word-2 { top: calc(50% + 5vh); }
          .tray-panel { height: 80vh; }
        }
      `}</style>
    </div>
  );
}
