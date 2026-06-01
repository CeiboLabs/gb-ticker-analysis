"use client";

import { useReducedMotion } from "framer-motion";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";

const INDUSTRIAS: { key: string; label: string; desc: string }[] = [
  { key: "tecnologia", label: "Tecnología", desc: "Semiconductores, software y la infraestructura que mueve al mundo." },
  { key: "energia", label: "Energía", desc: "Renovables, petróleo y gas: el sector que alimenta la economía global." },
  { key: "agro", label: "Agro", desc: "Alimentos y commodities, el corazón productivo de la región." },
  { key: "logistica", label: "Logística", desc: "Puertos, navieras y comercio: las cadenas que conectan los mercados." },
];

export function Industrias() {
  const reduce = useReducedMotion();

  return (
    <section className="band site-section">
      <div className="site-wrap">
        <Reveal className="split-label">
          <div className="eyebrow-sm">Oportunidades</div>
          <div>
            <h2 className="t-h2" style={{ maxWidth: "16em" }}>
              Las industrias que mueven el mundo, en tu cartera.
            </h2>
            <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
              Desde Montevideo accedés a los sectores que definen la economía global.
              Estas son algunas de las industrias en las que podés invertir.
            </p>
          </div>
        </Reveal>

        <Stagger className="ind-grid" as="div">
          {INDUSTRIAS.map((it) => (
            <StaggerItem key={it.key} className="ind-card" as="div">
              <video
                className="ind-video"
                muted
                loop
                playsInline
                preload="none"
                poster={`/video/ind/${it.key}-poster.jpg`}
                aria-hidden
                {...(reduce ? {} : { autoPlay: true })}
              >
                <source src={`/video/ind/${it.key}.mp4`} type="video/mp4" />
              </video>
              <div className="ind-scrim" aria-hidden />
              <div className="ind-meta">
                <span className="ind-label">{it.label}</span>
                <span className="ind-desc">{it.desc}</span>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>

      <style>{`
        .ind-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-top: 56px;
        }
        .ind-card {
          position: relative;
          aspect-ratio: 3 / 4;
          border-radius: var(--r-card);
          overflow: hidden;
          background: var(--navy);
          border: 1px solid var(--site-border);
          isolation: isolate;
        }
        .ind-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
          transition: transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ind-card:hover .ind-video { transform: scale(1.06); }
        .ind-scrim {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background: linear-gradient(180deg, rgba(2,4,40,0.10) 0%, transparent 38%, rgba(2,4,40,0.85) 100%);
        }
        .ind-meta {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          z-index: 2;
          padding: 22px 22px 24px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .ind-label {
          font-size: 21px;
          font-weight: 500;
          letter-spacing: -0.01em;
          color: #fff;
        }
        .ind-desc {
          font-size: 13.5px;
          line-height: 1.5;
          color: rgba(255,255,255,0.78);
        }
        @media (max-width: 900px) {
          .ind-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 520px) {
          .ind-grid { grid-template-columns: 1fr; }
          .ind-card { aspect-ratio: 16 / 10; }
        }
      `}</style>
    </section>
  );
}
