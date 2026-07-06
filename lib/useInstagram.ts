"use client";

import { useEffect, useState } from "react";

// Lectura compartida de /api/instagram. Cachea la promesa a nivel de módulo para
// que haya una sola llamada de red aunque el módulo monte en más de un lugar.
// Espeja lib/useFondo.ts.

export type InstagramPost = {
  id: string;
  caption: string | null;
  permalink: string;
  mediaType: string;
  takenAt: string;
  image: string; // ruta same-origin al still (/api/instagram/media/[id])
};

export type InstagramState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "empty" }
  | { kind: "ready"; posts: InstagramPost[] };

let cached: Promise<InstagramPost[]> | null = null;

function load(): Promise<InstagramPost[]> {
  if (!cached) {
    cached = fetch("/api/instagram", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
      .then((d: { posts?: InstagramPost[] }) => d.posts ?? [])
      .catch((e) => {
        cached = null; // permitir reintento en el próximo montaje
        throw e;
      });
  }
  return cached;
}

export function useInstagram(): InstagramState {
  const [state, setState] = useState<InstagramState>({ kind: "loading" });
  useEffect(() => {
    let alive = true;
    load()
      .then((posts) => {
        if (!alive) return;
        setState(posts.length ? { kind: "ready", posts } : { kind: "empty" });
      })
      .catch(() => { if (alive) setState({ kind: "error" }); });
    return () => { alive = false; };
  }, []);
  return state;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Fecha del posteo (timestamp ISO8601 de Instagram) → '3 de junio de 2026'. */
export function fmtFechaPost(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** Primera línea / extracto del epígrafe para la tarjeta (sin cortar palabras). */
export function captionExcerpt(caption: string | null, max = 140): string {
  if (!caption) return "";
  const oneLine = caption.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  const cut = oneLine.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
