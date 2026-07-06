"use client";

import { useEffect, useState } from "react";

// Lectura compartida de /api/youtube (RSS del canal + destacado). Cachea la
// promesa a nivel de módulo, como useFondo/useInstagram.

export type YtPublic = {
  id: string;
  title: string;
  published: string;
  thumb: string; // ruta same-origin a la miniatura (/api/youtube/thumb/[id])
  watch: string; // watch URL en youtube.com
};
type YoutubePayload = { featured: YtPublic | null; latest: YtPublic[] };

export type YoutubeState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "empty" }
  | { kind: "ready"; featured: YtPublic; latest: YtPublic[] };

let cached: Promise<YoutubePayload> | null = null;

function load(): Promise<YoutubePayload> {
  if (!cached) {
    cached = fetch("/api/youtube", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
      .then((d: YoutubePayload) => d)
      .catch((e) => {
        cached = null;
        throw e;
      });
  }
  return cached;
}

export function useYoutube(): YoutubeState {
  const [state, setState] = useState<YoutubeState>({ kind: "loading" });
  useEffect(() => {
    let alive = true;
    load()
      .then((d) => {
        if (!alive) return;
        if (d.featured) setState({ kind: "ready", featured: d.featured, latest: d.latest ?? [] });
        else setState({ kind: "empty" });
      })
      .catch(() => { if (alive) setState({ kind: "error" }); });
    return () => { alive = false; };
  }, []);
  return state;
}

/** Reproductor privacy-enhanced con autoplay (el clic del usuario lo habilita) y sin videos relacionados de otros canales. */
export function embedSrc(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Fecha de publicación (ISO8601) → '2 jul 2026'. */
export function fmtFechaVideo(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
