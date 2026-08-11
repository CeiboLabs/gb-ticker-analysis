"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ParallaxLayer } from "@/components/scroll";
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
  const [cargar, setCargar] = useState(false);

  // La grilla de industrias vive bien abajo del fold, pero los clips se
  // descargaban en la carga inicial: `preload="auto"` + `autoPlay` no esperan a
  // que el elemento se vea. Eran 3,3 MB (los cuatro clips) que pagaba hasta el
  // que rebotaba en el hero sin scrollear nunca. Con el observer, hasta que la
  // tarjeta no se acerca al viewport sólo se muestra el poster.
  //
  // El poster SÍ sigue siendo eager: es el contenido visible de la tarjeta y
  // pesa dos órdenes de magnitud menos que el clip.
  // Sin IntersectionObserver el clip no carga nunca y la tarjeta se queda en el
  // poster: degradación aceptable, y de todos modos el sitio ya lo exige en
  // otros lados (los `whileInView` de framer-motion). Por eso no hay fallback.
  useEffect(() => {
    const a = aRef.current;
    if (!a) return;
    const io = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((e) => e.isIntersecting)) return;
        setCargar(true);
        io.disconnect();
      },
      // Margen generoso: el clip empieza a bajar antes de entrar en pantalla,
      // así llega reproduciéndose y no se ve el cambio poster → video.
      { rootMargin: "400px 0px" },
    );
    io.observe(a);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduce || !cargar) return;
    const a = aRef.current;
    const b = bRef.current;
    if (!a || !b) return;

    // Los <source> se acaban de montar: sin load() el elemento no los mira.
    a.load();
    b.load();

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
  }, [reduce, cargar]);

  const common = {
    className: "ind-video",
    muted: true,
    playsInline: true,
    poster,
    "aria-hidden": true,
  };

  return (
    <>
      <video
        ref={aRef}
        {...common}
        preload={cargar ? "auto" : "none"}
        style={{ opacity: 1 }}
        {...(reduce ? {} : { autoPlay: true })}
      >
        {cargar && <source src={src} type="video/mp4" />}
      </video>
      {/* La capa B recién se reproduce en el primer crossfade (~fin del clip):
          con metadata alcanza y evita descargar los 4 clips dos veces. */}
      <video ref={bRef} {...common} preload={cargar ? "metadata" : "none"} style={{ opacity: 0 }}>
        {cargar && <source src={src} type="video/mp4" />}
      </video>
    </>
  );
}

export function Industrias() {
  const reduce = useReducedMotion();

  return (
    <section className="band-muted site-section">
      <div className="site-wrap">
        <Reveal className="split-label">
          <div className="eyebrow-sm">Oportunidades</div>
          <div>
            <h2 className="t-h2" style={{ maxWidth: "16em" }}>
              Las industrias que mueven el mundo, en tu cartera.
            </h2>
            <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
              Accedé a los sectores que definen la economía global. Estas son
              algunas de las industrias en las que podés invertir.
            </p>
          </div>
        </Reveal>

        <Stagger className="ind-grid" as="div">
          {INDUSTRIAS.map((it, i) => (
            /* Parallax en el contenedor EXTERNO: el transform no puede ir en
               .ind-card (overflow:hidden + aspect-ratio del crossfade). Offsets
               alternados para que las tarjetas "floten" a distinta velocidad. */
            <ParallaxLayer key={it.key} offset={i % 2 === 0 ? 16 : 44}>
              <StaggerItem className="ind-card" as="div">
              <LoopVideo
                src={`/video/ind/${it.key}.mp4`}
                poster={`/video/ind/${it.key}-poster.jpg`}
                reduce={reduce}
              />
              <div className="ind-scrim" aria-hidden />
              {/* Texto sobre el video (sin fondo glass) */}
              <div className="ind-meta">
                <div className="ind-meta-inner">
                  <span className="ind-label">{it.label}</span>
                  <span className="ind-desc">{it.desc}</span>
                  <span className="ind-cta" aria-hidden>
                    Cómo invertir <ArrowRight />
                  </span>
                </div>
              </div>
              <Link
                href={`/oportunidades/${it.key}`}
                className="ind-cardlink"
                aria-label={`${it.label}: cómo invertir en el sector`}
              />
              </StaggerItem>
            </ParallaxLayer>
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
          /* Sin placa glass: el scrim ahora garantiza la legibilidad del texto */
          background: linear-gradient(180deg, rgba(2,4,40,0.10) 0%, transparent 30%, rgba(2,4,40,0.78) 100%);
        }
        .ind-meta {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          z-index: 2;
          pointer-events: none;
        }
        .ind-meta-inner {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 18px 20px 20px;
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
          color: rgba(255,255,255,0.82);
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
