"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { SplitText } from "@/components/scroll";
import { Glass } from "@/components/institucional/LiquidGlass";

const LEDGER = [
  { cap: "Miembros BVM", value: "Desde 1967" },
  { cap: "Trayectoria", value: "6 décadas" },
  { cap: "Regulada por", value: "BCU" },
  { cap: "Mercados", value: "Local e internacional" },
];

const EASE = [0.16, 1, 0.3, 1] as const;

export function HeroInstitucional() {
  const reduce = useReducedMotion();
  const heroRef = useRef<HTMLDivElement>(null);

  // Progreso de salida del hero: 0 = arriba de todo, 1 = hero fuera de vista.
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const titleY = useTransform(scrollYProgress, [0, 1], [0, 110]);
  // El rango cubre [0, 1] completo: un rango parcial se rompe al acelerarse
  // a WAAPI (ver scrollWindow en components/scroll.tsx).
  const titleOpacity = useTransform(scrollYProgress, [0, 0.75, 1], [1, 0.25, 0.25]);
  const videoScale = useTransform(scrollYProgress, [0, 1], [1, 1.09]);

  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.9, ease: EASE, delay },
        };

  return (
    <header className="site">
      <div ref={heroRef} className="hero-media" style={{ minHeight: "min(94vh, 940px)" }}>
        {/* Fondo navy de base: se ve mientras carga el video o si falla / reduce-motion */}
        <div className="media-ph" aria-hidden />

        {/* Video de fondo: WTC Montevideo + temáticas de inversión.
            Se omite si el usuario pidió menos movimiento (accesibilidad). */}
        {!reduce && (
          <motion.video
            className="media-fill"
            style={{ scale: videoScale }}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/video/hero-home-poster.jpg"
            aria-hidden
          >
            <source src="/video/hero-home.webm" type="video/webm" />
            <source src="/video/hero-home.mp4" type="video/mp4" />
          </motion.video>
        )}

        <div className="scrim" aria-hidden />

        <div
          className="site-wrap hero-content"
          style={{ paddingBottom: "clamp(56px, 7vw, 110px)" }}
        >
          <motion.div style={reduce ? undefined : { y: titleY, opacity: titleOpacity }}>
            <h1 className="t-display-xl t-serif-display" style={{ color: "#fff", maxWidth: "13ch" }}>
              <SplitText text="Una puerta local al mercado internacional." mode="enter" delay={0.1} stagger={0.09} as="span" />
            </h1>

            <motion.p
              className="t-lead"
              style={{ color: "rgba(255,255,255,0.78)", marginTop: 28, maxWidth: "38em" }}
              {...rise(0.7)}
            >
              Sociedad de bolsa uruguaya · Miembros de la Bolsa de Valores de Montevideo desde 1967.
            </motion.p>

            <motion.div style={{ display: "flex", gap: 14, marginTop: 36, flexWrap: "wrap", alignItems: "center" }} {...rise(0.85)}>
              <Link href="/contacto" className="ui-btn ui-btn-on-navy" style={{ borderRadius: 999 }}>
                Agendá una reunión
              </Link>
              {/* Secundario en liquid glass sobre el video */}
              <Glass interactive>
                <Link href="/analisis" className="lqg-btn">Analizar una acción</Link>
              </Glass>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Ledger en banda blanca */}
      <div className="band">
        <div className="site-wrap" style={{ paddingTop: 0 }}>
          <div className="hero-ledger">
            {LEDGER.map((cell, i) => (
              <motion.div
                key={cell.cap}
                className="hero-ledger-cell"
                data-first={i === 0 ? "1" : "0"}
                initial={reduce ? false : { opacity: 0, y: 18 }}
                whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: EASE, delay: i * 0.08 }}
              >
                <div className="eyebrow-sm">{cell.cap}</div>
                <div style={{ fontSize: 28, fontWeight: 400, marginTop: 6, color: "var(--site-ink)", letterSpacing: "-0.015em" }}>
                  {cell.value}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .hero-ledger {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-top: 1px solid var(--site-border);
          border-bottom: 1px solid var(--site-border);
        }
        .hero-ledger-cell {
          padding: 28px 28px 28px 0;
          border-left: 1px solid var(--site-border);
          padding-left: 28px;
        }
        .hero-ledger-cell[data-first="1"] { border-left: 0; padding-left: 0; }
        @media (max-width: 760px) {
          .hero-ledger { grid-template-columns: 1fr 1fr; }
          .hero-ledger-cell { padding: 22px 18px; border-left: 1px solid var(--site-border); }
          .hero-ledger-cell:nth-child(2n+1) { border-left: 0; padding-left: 0; }
        }
      `}</style>
    </header>
  );
}
