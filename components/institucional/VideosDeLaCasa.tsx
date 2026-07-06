"use client";

import { useState } from "react";
import { Reveal } from "@/components/motion";
import { ArrowRight } from "@/components/institucional/icons";
import { useYoutube, embedSrc, fmtFechaVideo, type YtPublic } from "@/lib/useYoutube";
import { YOUTUBE_CHANNEL_URL } from "@/lib/youtube";

// Módulo de videos de la casa para el hub de research (/informes): un DESTACADO
// grande + los 2 ÚLTIMOS, en el lenguaje de la casa (16:9 sobre hairlines, play
// dorado, sin tarjetas con sombra). Es la misma lectura de mercado que los
// informes escritos, en otro soporte — por eso vive al pie de /informes.
// Reproducción CLICK-TO-PLAY: la miniatura (servida same-origin) se reemplaza
// por el reproductor sólo al hacer clic — no carga el iframe de YouTube en cada
// visita (mejor performance y privacidad). Si el canal no responde, el módulo no
// aparece. `variant` fija la banda para encajar en el ritmo de la página anfitriona.

function PlayGlyph() {
  return (
    <svg viewBox="0 0 72 72" className="vid-play-svg" aria-hidden="true">
      <circle cx="36" cy="36" r="34.5" className="vid-play-ring" />
      <path d="M29 23.5 L52 36 L29 48.5 Z" className="vid-play-tri" />
    </svg>
  );
}

function VideoFrame({
  video,
  size,
  playing,
  onPlay,
}: {
  video: YtPublic;
  size: "lg" | "sm";
  playing: boolean;
  onPlay: (id: string) => void;
}) {
  return (
    <div className={`vid-frame vid-frame--${size}`}>
      {playing ? (
        <iframe
          className="vid-iframe"
          src={embedSrc(video.id)}
          title={video.title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <button type="button" className="vid-play-btn" onClick={() => onPlay(video.id)} aria-label={`Reproducir: ${video.title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="vid-thumb" src={video.thumb} alt="" loading="lazy" decoding="async" />
          <span className="vid-play"><PlayGlyph /></span>
        </button>
      )}
    </div>
  );
}

function VideoMeta({ video, size }: { video: YtPublic; size: "lg" | "sm" }) {
  const fecha = fmtFechaVideo(video.published);
  return (
    <div className="vid-meta">
      <a href={video.watch} target="_blank" rel="noopener noreferrer" className={`vid-title vid-title--${size}`}>
        {video.title}
      </a>
      {fecha ? <span className="vid-date">{fecha}</span> : null}
    </div>
  );
}

export function VideosDeLaCasa({ variant = "band" }: { variant?: "band" | "band-muted" }) {
  const state = useYoutube();
  const [playingId, setPlayingId] = useState<string | null>(null);

  if (state.kind !== "ready") return null;
  const { featured, latest } = state;

  return (
    <section className={`${variant} site-section`}>
      <div className="site-wrap">
        <Reveal className="split-label">
          <div className="eyebrow-sm">En video</div>
          <div>
            <h2 className="t-h2">La lectura de la mesa, en video.</h2>
            <a
              href={YOUTUBE_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="link-arrow"
              style={{ marginTop: 24 }}
            >
              Ver el canal <ArrowRight />
            </a>
          </div>
        </Reveal>

        <div className="vid-grid">
          <article className="vid-featured">
            <VideoFrame video={featured} size="lg" playing={playingId === featured.id} onPlay={setPlayingId} />
            <VideoMeta video={featured} size="lg" />
          </article>

          {latest.length > 0 ? (
            <div className="vid-side">
              {latest.map((v) => (
                <article key={v.id} className="vid-item">
                  <VideoFrame video={v} size="sm" playing={playingId === v.id} onPlay={setPlayingId} />
                  <VideoMeta video={v} size="sm" />
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <style>{`
        .vid-grid {
          margin-top: clamp(32px, 4vw, 52px);
          display: grid;
          grid-template-columns: 1.7fr 1fr;
          gap: clamp(22px, 2.6vw, 40px);
          align-items: start;
        }
        .vid-side { display: flex; flex-direction: column; gap: clamp(20px, 2.4vw, 30px); }

        .vid-frame {
          position: relative;
          aspect-ratio: 16 / 9;
          overflow: hidden;
          border: 1px solid var(--site-border);
          background: #0f2249;
          transition: border-color 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .vid-play-btn {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          padding: 0; border: 0; background: none; cursor: pointer; display: block;
        }
        .vid-thumb {
          width: 100%; height: 100%;
          object-fit: cover; display: block;
          transform: scale(1.001);
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .vid-iframe { width: 100%; height: 100%; border: 0; display: block; }
        .vid-play { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
        .vid-play-svg { width: clamp(52px, 6vw, 74px); height: clamp(52px, 6vw, 74px); display: block; }
        .vid-play-ring {
          fill: rgba(15, 34, 73, 0.55);
          stroke: rgba(255, 255, 255, 0.9);
          stroke-width: 1.5;
          transition: fill 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .vid-play-tri { fill: #fff; }
        .vid-frame:hover { border-color: var(--gold-deep); }
        .vid-frame:hover .vid-thumb { transform: scale(1.04); }
        .vid-frame:hover .vid-play-ring { fill: var(--gold-deep); stroke: var(--gold-soft); }
        .vid-play-btn:focus-visible { outline: 2px solid var(--gold-deep); outline-offset: 3px; }

        .vid-meta { margin-top: 14px; }
        .vid-title {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          color: var(--site-ink);
          letter-spacing: -0.01em;
          text-decoration: none;
          transition: color 0.2s ease;
        }
        .vid-title:hover { color: var(--gold-deep); }
        .vid-title--lg { font-size: clamp(19px, 1.7vw, 24px); line-height: 1.3; }
        .vid-title--sm { font-size: clamp(15px, 1.2vw, 17px); line-height: 1.35; }
        .vid-date {
          display: block; margin-top: 9px;
          font-size: 11px; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; color: var(--site-ink-3);
          font-variant-numeric: tabular-nums;
        }

        @media (max-width: 860px) {
          .vid-grid { grid-template-columns: 1fr; gap: clamp(24px, 6vw, 36px); }
          .vid-side { flex-direction: row; }
          .vid-side .vid-item { flex: 1 1 0; min-width: 0; }
        }
        @media (max-width: 520px) {
          .vid-side { flex-direction: column; }
        }
        @media (prefers-reduced-motion: reduce) {
          .vid-thumb, .vid-frame, .vid-play-ring { transition: none; }
          .vid-frame:hover .vid-thumb { transform: none; }
        }
      `}</style>
    </section>
  );
}
