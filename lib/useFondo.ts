"use client";

import { useEffect, useState } from "react";
import type { FundSnapshot } from "@/lib/fondo";

// Lectura compartida de /api/fondo. La ficha sticky y el módulo de performance
// montan en secciones distintas de la página; este hook cachea la promesa a
// nivel de módulo para que haya una sola llamada de red en lugar de una por
// componente.

export type FondoState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; data: FundSnapshot };

let cached: Promise<FundSnapshot> | null = null;

function load(): Promise<FundSnapshot> {
  if (!cached) {
    cached = fetch("/api/fondo", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
      .catch((e) => {
        cached = null; // permitir reintento en el próximo montaje
        throw e;
      });
  }
  return cached;
}

export function useFondo(): FondoState {
  const [state, setState] = useState<FondoState>({ kind: "loading" });
  useEffect(() => {
    let alive = true;
    load()
      .then((data) => { if (alive) setState({ kind: "ready", data }); })
      .catch(() => { if (alive) setState({ kind: "error" }); });
    return () => { alive = false; };
  }, []);
  return state;
}

// Helpers de formato compartidos por los componentes del fondo.
export function fmtNav(n: number): string {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Índice base 100 — fondo/benchmark reescalados a 100 en el origen del período.
// Sin moneda: es un número índice, no un valor cuota en USD.
export function fmtIndex(n: number): string {
  return n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtPct(n: number | null, withSign = true): string {
  if (n == null) return "—";
  const s = n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return withSign && n > 0 ? `+${s}%` : `${s}%`;
}

export function fmtAum(n: number): string {
  return n.toLocaleString("es-UY", { maximumFractionDigits: 0 });
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fmtFechaLarga(dia: string): string {
  const [y, m, d] = dia.split("-").map(Number);
  return `${d} de ${MESES[(m ?? 1) - 1]} de ${y}`;
}

export function fmtFechaCorta(dia: string): string {
  const [y, m, d] = dia.split("-").map(Number);
  return `${d} ${MESES_CORTO[(m ?? 1) - 1]} ${y}`;
}

/** 'YYYY-MM' → 'mar 2025' (para las estadísticas de mejor/peor mes). */
export function fmtMesAnio(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES_CORTO[(m ?? 1) - 1]} ${y}`;
}
