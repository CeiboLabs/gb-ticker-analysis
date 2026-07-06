"use client";

import { useState } from "react";
import { embedSrc } from "@/lib/useYoutube";

// Embed de UN video de YouTube por id, click-to-play, en el lenguaje de la casa
// (16:9 sobre hairline, play dorado). La miniatura se sirve same-origin
// (/api/youtube/thumb/[id]) para respetar el CSP `img-src 'self'`; el iframe
// (youtube-nocookie, ya en `frame-src`) sólo se monta al hacer clic — no carga
// YouTube en cada visita (mejor performance y privacidad). Reutilizable: la fila
// del mensual en /informes hoy, y a futuro el artículo del mensual.

export function VideoEmbed({ videoId, title }: { videoId: string; title: string }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="vembed">
      {playing ? (
        <iframe
          className="vembed-iframe"
          src={embedSrc(videoId)}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          className="vembed-btn"
          onClick={() => setPlaying(true)}
          aria-label={`Reproducir: ${title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="vembed-thumb" src={`/api/youtube/thumb/${videoId}`} alt="" loading="lazy" decoding="async" />
          <span className="vembed-play">
            <svg viewBox="0 0 72 72" className="vembed-play-svg" aria-hidden="true">
              <circle cx="36" cy="36" r="34.5" className="vembed-ring" />
              <path d="M29 23.5 L52 36 L29 48.5 Z" fill="#fff" />
            </svg>
          </span>
        </button>
      )}

      <style>{`
        .vembed {
          position: relative;
          aspect-ratio: 16 / 9;
          overflow: hidden;
          border: 1px solid var(--site-border);
          background: #0f2249;
          transition: border-color 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .vembed:hover { border-color: var(--gold-deep); }
        .vembed-btn {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          padding: 0; border: 0; background: none; cursor: pointer; display: block;
        }
        .vembed-thumb {
          width: 100%; height: 100%;
          object-fit: cover; display: block;
          transform: scale(1.001);
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .vembed:hover .vembed-thumb { transform: scale(1.04); }
        .vembed-iframe { width: 100%; height: 100%; border: 0; display: block; }
        .vembed-play { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
        .vembed-play-svg { width: clamp(52px, 6vw, 74px); height: clamp(52px, 6vw, 74px); display: block; }
        .vembed-ring {
          fill: rgba(15, 34, 73, 0.55);
          stroke: rgba(255, 255, 255, 0.9);
          stroke-width: 1.5;
          transition: fill 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .vembed:hover .vembed-ring { fill: var(--gold-deep); stroke: var(--gold-soft); }
        .vembed-btn:focus-visible { outline: 2px solid var(--gold-deep); outline-offset: 3px; }
        @media (prefers-reduced-motion: reduce) {
          .vembed-thumb, .vembed, .vembed-ring { transition: none; }
          .vembed:hover .vembed-thumb { transform: none; }
        }
      `}</style>
    </div>
  );
}
