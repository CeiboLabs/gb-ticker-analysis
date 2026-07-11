"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { FONDO } from "@/lib/fondo";
import { Fachada } from "@/components/institucional/Fachada";

// Hero del fondo — versión FACHADA full-bleed. El header entero es el mosaico de
// paneles embutidos <Fachada /> (extraído a su propio componente, reusado como
// miniatura en el destacado "Invertir" del navbar). Acá va a tamaño completo: un
// scrim oscurece la izquierda para que el claim se lea; y la firma BNG a la
// derecha, sobre el horizonte, como remate. SIN animación de entrada: todo
// renderiza en su estado final; sólo queda un push-out sutil al scroll (atenuado
// en reduce-motion).

export function FondoHero() {
  const reduce = useReducedMotion();

  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.65, 1], [1, 1, 0.4]);
  const stageScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  const signOpacity = useTransform(scrollYProgress, [0, 0.45], [1, 0]);

  return (
    <header className="ffac-hero" ref={heroRef}>
      {/* ── Fachada (mosaico + horizonte) ── */}
      <motion.div className="ffac-stage" style={reduce ? undefined : { scale: stageScale }}>
        <Fachada />
      </motion.div>

      {/* ── Scrim: legibilidad del claim a la izquierda + profundidad ── */}
      <div className="ffac-scrim" aria-hidden />

      {/* ── Firma BNG (remate, a la derecha sobre el horizonte) ── */}
      <motion.div
        className="ffac-sign" aria-hidden
        style={reduce ? undefined : { opacity: signOpacity }}
      >
        <span className="ffac-sign-bng">BNG</span>
        <span className="ffac-sign-sub">SELECCIÓN GLOBAL</span>
      </motion.div>

      {/* ── Claim editorial ── */}
      <motion.div className="site-wrap ffac-content" style={reduce ? undefined : { y: contentY, opacity: contentOpacity }}>
        <div className="ffac-copy">
          <h1 className="fh-h1 t-serif-display">
            Una estrategia global y diversificada, en un solo vehículo.
          </h1>
          <p className="fh-lead">{FONDO.tagline}</p>
          <ul className="fh-ledger">
            <li>Renta variable + renta fija</li>
            <li>Exposición global</li>
            <li>Domiciliado en Uruguay</li>
          </ul>
          <div className="fh-actions">
            <Link href="/contacto" className="ui-btn ui-btn-on-navy">Hablar con un asesor</Link>
            <a href="#estrategia" className="fh-link">Cómo invierte →</a>
          </div>
        </div>
      </motion.div>

      <style>{`
        .ffac-hero {
          position: relative; isolation: isolate; overflow: hidden;
          color: #fff; background: var(--navy);
          min-height: min(90vh, 860px);
          display: flex; align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        /* will-change promueve el stage a su propia capa GPU: el scale del
           parallax escala una textura cacheada en vez de rerasterizar el SVG de
           24 polígonos por frame (eso fundía la máquina al final del hero). */
        .ffac-stage { position: absolute; inset: 0; z-index: 0; will-change: transform; }

        /* Scrim: izquierda muy oscura (claim) → derecha despejada (fachada y
           firma). Más un velo arriba (navbar) y abajo (CTAs). */
        .ffac-scrim {
          position: absolute; inset: 0; z-index: 1; pointer-events: none;
          background:
            linear-gradient(90deg, rgba(7,14,34,0.95) 0%, rgba(7,14,34,0.66) 32%, rgba(7,14,34,0.08) 60%, transparent 78%),
            linear-gradient(180deg, rgba(7,14,34,0.45) 0%, transparent 26%, transparent 64%, rgba(7,14,34,0.40) 100%);
        }

        /* Firma — sobre el horizonte, en el cuadrante derecho. */
        .ffac-sign {
          position: absolute; z-index: 2; top: 50%; left: 72%;
          transform: translate(-50%, -50%); text-align: center; pointer-events: none;
          text-shadow: 0 2px 22px rgba(0,0,0,0.55);
        }
        .ffac-sign-bng {
          display: block; font-size: clamp(40px, 5.2vw, 76px); font-weight: 700;
          line-height: 1; letter-spacing: 0.01em; color: #fff;
        }
        .ffac-sign-sub {
          display: block; margin-top: 12px; font-size: clamp(12px, 1.05vw, 17px);
          font-weight: 600; letter-spacing: 0.26em; color: var(--gold-soft);
        }

        .ffac-content { position: relative; z-index: 3; width: 100%; }
        .ffac-copy { max-width: 31em; }

        .ffac-hero .fh-h1 {
          margin: 0; color: #fff;
          font-size: clamp(34px, 4.6vw, 60px); line-height: 1.04;
        }
        .fh-lead {
          margin: 20px 0 0; max-width: 28em;
          font-size: clamp(15px, 1.4vw, 18px); line-height: 1.55; color: rgba(255,255,255,0.82);
        }
        .fh-ledger {
          list-style: none; margin: 26px 0 0; padding: 18px 0 0;
          border-top: 1px solid rgba(255,255,255,0.16);
          display: flex; flex-wrap: wrap; gap: 10px 30px;
          font-size: 12.5px; letter-spacing: 0.04em; color: rgba(255,255,255,0.7);
        }
        .fh-ledger li { position: relative; }
        .fh-ledger li + li::before {
          content: "·"; position: absolute; left: -16px; color: var(--gold-soft);
        }
        .fh-actions { margin-top: 28px; display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
        .fh-link {
          font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.9);
          text-decoration: none; transition: color 180ms ease;
        }
        .fh-link:hover { color: var(--gold-soft); }

        @media (max-width: 920px) {
          .ffac-hero {
            min-height: auto; align-items: flex-end;
            padding: calc(var(--nav-h) + clamp(120px, 30vh, 240px)) 0 clamp(36px, 7vh, 64px);
          }
          /* La firma sube al cuadrante superior y hace de marca. */
          .ffac-sign { top: clamp(150px, 26vh, 240px); left: 50%; }
          .ffac-scrim {
            background: linear-gradient(180deg, rgba(7,14,34,0.50) 0%, rgba(7,14,34,0.18) 36%, rgba(7,14,34,0.86) 78%);
          }
          .ffac-copy { max-width: none; }
        }
        @media (max-width: 640px) {
          .fh-ledger { flex-direction: column; gap: 9px; padding-top: 16px; }
          .fh-ledger li + li::before { content: none; }
        }
      `}</style>
    </header>
  );
}
