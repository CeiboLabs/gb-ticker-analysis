"use client";

import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { useRef } from "react";

type Item = { year: string; title: string; body: string };

const EASE = [0.16, 1, 0.3, 1] as const;

export function HistoriaTimeline({ items }: { items: Item[] }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 75%", "end 65%"],
  });
  const fillHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <div ref={ref} className="tl">
      <div className="tl-track" aria-hidden>
        <motion.div className="tl-fill" style={{ height: reduce ? "100%" : fillHeight }} />
      </div>

      {items.map((t, i) => (
        <motion.div
          key={t.year + i}
          className="tl-row"
          initial={reduce ? false : { opacity: 0, y: 32 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <span className="tl-dot" aria-hidden />
          <div className="tl-year">{t.year}</div>
          <div className="tl-content">
            <h3 className="t-h3">{t.title}</h3>
            <p className="t-body" style={{ marginTop: 10, marginBottom: 0, maxWidth: "44em" }}>
              {t.body}
            </p>
          </div>
        </motion.div>
      ))}

      <style>{`
        .tl { position: relative; margin-top: 56px; }
        .tl-track {
          position: absolute;
          left: 96px; top: 12px; bottom: 12px;
          width: 2px;
          background: var(--site-border);
          overflow: hidden;
        }
        .tl-fill {
          position: absolute;
          left: 0; top: 0;
          width: 100%;
          background: linear-gradient(180deg, var(--gold) , var(--gold-deep));
          transform-origin: top;
        }
        .tl-row {
          position: relative;
          display: grid;
          grid-template-columns: 80px 1fr;
          column-gap: 56px;
          padding: 30px 0;
          align-items: baseline;
          border-bottom: 1px solid var(--site-border);
        }
        .tl-row:first-child { border-top: 1px solid var(--site-border); }
        .tl-dot {
          position: absolute;
          left: 91px; top: 40px;
          width: 12px; height: 12px;
          border-radius: 50%;
          background: var(--gold-deep);
          box-shadow: 0 0 0 4px var(--surface-muted);
        }
        .tl-year {
          text-align: right;
          font-size: clamp(28px, 3.4vw, 44px);
          font-weight: 400;
          line-height: 1;
          letter-spacing: -0.02em;
          color: var(--navy);
        }
        @media (max-width: 760px) {
          .tl-track, .tl-dot { display: none; }
          .tl-row { grid-template-columns: 1fr; column-gap: 0; gap: 12px; padding: 26px 0; }
          .tl-year { text-align: left; font-size: 34px; }
        }
      `}</style>
    </div>
  );
}
