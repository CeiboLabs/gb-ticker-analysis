"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ArrowRight } from "@/components/institucional/icons";

const INDUSTRIAS: { key: string; label: string; desc: string }[] = [
  { key: "tecnologia", label: "Tecnología", desc: "Semiconductores, software y la infraestructura que mueve al mundo." },
  { key: "energia", label: "Energía", desc: "Renovables, petróleo y gas: el sector que alimenta la economía global." },
  { key: "agro", label: "Agro", desc: "Alimentos y commodities, el corazón productivo de la región." },
  { key: "logistica", label: "Logística", desc: "Puertos, navieras y comercio: las cadenas que conectan los mercados." },
];

// Duración del cruce (en segundos) entre las dos capas al cerrar el loop.
const CROSSFADE = 0.7;

/**
 * Video de fondo con loop sin corte: dos capas del mismo clip que hacen
 * crossfade en la costura. Cuando la capa activa está por terminar, arranca
 * la otra desde 0 y se cruzan por opacidad, evitando el salto del `loop` nativo.
 */
function LoopVideo({ src, poster, reduce }: { src: string; poster: string; reduce: boolean | null }) {
  const aRef = useRef<HTMLVideoElement>(null);
  const bRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (reduce) return;
    const a = aRef.current;
    const b = bRef.current;
    if (!a || !b) return;

    let active: "a" | "b" = "a";
    let swapping = false;
    let swapTimer: ReturnType<typeof setTimeout> | undefined;

    a.currentTime = 0;
    a.play().catch(() => {});

    const onTime = () => {
      if (swapping) return;
      const cur = active === "a" ? a : b;
      const nxt = active === "a" ? b : a;
      if (!cur.duration || Number.isNaN(cur.duration)) return;
      if (cur.currentTime < cur.duration - CROSSFADE) return;

      swapping = true;
      nxt.currentTime = 0;
      nxt.play().catch(() => {});
      nxt.style.opacity = "1";
      cur.style.opacity = "0";
      active = active === "a" ? "b" : "a";
      swapTimer = setTimeout(() => {
        cur.pause();
        swapping = false;
      }, CROSSFADE * 1000);
    };

    a.addEventListener("timeupdate", onTime);
    b.addEventListener("timeupdate", onTime);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      b.removeEventListener("timeupdate", onTime);
      if (swapTimer) clearTimeout(swapTimer);
    };
  }, [reduce]);

  const common = {
    className: "ind-video",
    muted: true,
    playsInline: true,
    preload: "auto" as const,
    poster,
    "aria-hidden": true,
  };

  return (
    <>
      <video ref={aRef} {...common} style={{ opacity: 1 }} {...(reduce ? {} : { autoPlay: true })}>
        <source src={src} type="video/mp4" />
      </video>
      <video ref={bRef} {...common} style={{ opacity: 0 }}>
        <source src={src} type="video/mp4" />
      </video>
    </>
  );
}

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
              <LoopVideo
                src={`/video/ind/${it.key}.mp4`}
                poster={`/video/ind/${it.key}-poster.jpg`}
                reduce={reduce}
              />
              <div className="ind-scrim" aria-hidden />
              <div className="ind-meta">
                <span className="ind-label">{it.label}</span>
                <span className="ind-desc">{it.desc}</span>
                <span className="ind-cta" aria-hidden>
                  Cómo invertir <ArrowRight />
                </span>
              </div>
              <Link
                href={`/oportunidades/${it.key}`}
                className="ind-cardlink"
                aria-label={`${it.label}: cómo invertir en el sector`}
              />
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
          transition: transform 0.9s cubic-bezier(0.16, 1, 0.3, 1), opacity ${CROSSFADE}s linear;
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
        .ind-cta {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-top: 10px;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.01em;
          color: var(--gold-soft);
          opacity: 0;
          transform: translateY(4px);
          transition: opacity 0.45s ease, transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ind-cta svg { width: 16px; height: 16px; }
        .ind-card:hover .ind-cta { opacity: 1; transform: translateY(0); }
        .ind-cardlink {
          position: absolute;
          inset: 0;
          z-index: 3;
          border-radius: var(--r-card);
        }
        .ind-cardlink:focus-visible {
          outline: 2px solid var(--gold);
          outline-offset: -2px;
        }
        @media (hover: none) {
          .ind-cta { opacity: 1; transform: none; }
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
