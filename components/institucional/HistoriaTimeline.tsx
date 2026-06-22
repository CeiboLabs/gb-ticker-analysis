"use client";

import { motion, useReducedMotion } from "framer-motion";

type Item = { year: string; title: string; body: string };
export type Era = { id: string; kicker: string; range: string; items: Item[] };

const EASE = [0.16, 1, 0.3, 1] as const;

// Trayectoria minimalista: lista cronológica refinada en <ol> semántico. Cada
// capítulo abre con una caption fina (nombre + rango) sobre un hairline, y sus
// hitos son filas año / título / texto separadas por hairlines, con mucho aire.
// Sin numerales gigantes ni bandas pesadas — el peso lo lleva el espacio en
// blanco. Reveal sutil al entrar, respetando prefers-reduced-motion.
export function HistoriaTimeline({ eras }: { eras: Era[] }) {
  const reduce = useReducedMotion();

  return (
    <div className="hx">
      {eras.map((era) => (
        <section key={era.id} id={era.id} className="hx-era">
          <div className="hx-cap">
            <span className="hx-cap-name">{era.kicker}</span>
            <span className="hx-cap-range">{era.range}</span>
          </div>

          <ol className="hx-list">
            {era.items.map((t, i) => (
              <motion.li
                key={t.year + i}
                className="hx-row"
                initial={reduce ? false : { opacity: 0, y: 16 }}
                whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, ease: EASE }}
              >
                <div className="hx-year">{t.year}</div>
                <div className="hx-main">
                  <h3 className="hx-title">{t.title}</h3>
                  <p className="hx-body">{t.body}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </section>
      ))}

      <style>{`
        .hx { margin-top: clamp(36px, 5vw, 68px); }
        .hx-era + .hx-era { margin-top: clamp(52px, 6vw, 96px); }

        .hx-cap {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 18px;
          border-bottom: 1px solid var(--site-border-2);
        }
        .hx-cap-name {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--gold-deep);
        }
        .hx-cap-range {
          font-size: 13px;
          font-weight: 400;
          letter-spacing: 0.04em;
          color: var(--site-ink-3);
          font-variant-numeric: tabular-nums;
        }

        .hx-list { list-style: none; margin: 0; padding: 0; }
        .hx-row {
          display: grid;
          grid-template-columns: 116px 1fr;
          gap: clamp(24px, 4vw, 72px);
          padding: clamp(28px, 3.4vw, 46px) 0;
          border-bottom: 1px solid var(--site-border);
          align-items: baseline;
        }
        .hx-year {
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.01em;
          color: var(--navy);
          font-variant-numeric: tabular-nums;
        }
        .hx-title {
          margin: 0;
          font-size: clamp(20px, 1.9vw, 26px);
          font-weight: 400;
          line-height: 1.2;
          letter-spacing: -0.015em;
          color: var(--site-ink);
        }
        .hx-body {
          margin: 12px 0 0;
          max-width: 40em;
          font-size: 17px;
          line-height: 1.72;
          color: var(--site-ink-2);
        }

        @media (max-width: 720px) {
          .hx-row { grid-template-columns: 1fr; gap: 6px; padding: 26px 0; }
          .hx-year { color: var(--gold-deep); }
        }
      `}</style>
    </div>
  );
}
