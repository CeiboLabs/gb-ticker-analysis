"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

const LEDGER = [
  { cap: "Fundada", value: "1967" },
  { cap: "Trayectoria", value: "57+ años" },
  { cap: "Regulada por", value: "BCU" },
  { cap: "Plaza", value: "Montevideo · BVM" },
];

const EASE = [0.16, 1, 0.3, 1] as const;

export function HeroInstitucional() {
  const reduce = useReducedMotion();
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 28 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.9, ease: EASE, delay },
        };

  return (
    <header className="site">
      <div className="hero-media" style={{ minHeight: "min(92vh, 880px)" }}>
        {/* Fondo navy de base: se ve mientras carga el video o si falla / reduce-motion */}
        <div className="media-ph" aria-hidden />

        {/* Video de fondo: WTC Montevideo + temáticas de inversión.
            Se omite si el usuario pidió menos movimiento (accesibilidad). */}
        {!reduce && (
          <video
            className="media-fill"
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
          </video>
        )}

        <div className="scrim" aria-hidden />

        <div className="site-wrap hero-content" style={{ paddingBottom: "clamp(60px, 8vw, 128px)" }}>
          <motion.div className="kicker" style={{ color: "var(--gold-soft)" }} {...rise(0.05)}>
            Sociedad de Bolsa · Montevideo · Est. 1967
          </motion.div>

          <motion.h1 className="t-display" style={{ marginTop: 32, maxWidth: "16ch", color: "#fff" }} {...rise(0.18)}>
            Acceso a los mercados del mundo, desde Uruguay.
          </motion.h1>

          <motion.p
            className="t-lead"
            style={{ maxWidth: "30ch", marginTop: 30, color: "rgba(255,255,255,0.82)" }}
            {...rise(0.32)}
          >
            Una casa de bolsa uruguaya, leyendo los mercados desde 1967.
          </motion.p>

          <motion.div style={{ display: "flex", gap: 14, marginTop: 48, flexWrap: "wrap" }} {...rise(0.46)}>
            <Link href="/contacto" className="ui-btn ui-btn-on-navy">Agendá una reunión</Link>
            <Link href="/analisis" className="ui-btn ui-btn-on-navy-ghost">Analizar una acción</Link>
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
