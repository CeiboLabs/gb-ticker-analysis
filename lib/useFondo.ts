"use client";

import { useEffect, useState } from "react";
import type { FundSnapshot } from "@/lib/fondo";

// ⚠️ SE LEE LA ENV DIRECTO Y NO SE IMPORTA `FONDO_STANDALONE` DE lib/sitios,
// que es donde vive la definición canónica. La duplicación es a propósito y
// compra una cosa concreta: que el ternario de abajo se PLIEGUE en el build.
//
// Importado, el bundler no propaga la constante entre chunks y el bundle queda
// con las DOS ramas — o sea, idéntico esté el flag prendido o apagado. Leído
// acá, Next inlinea el valor en este mismo módulo, el minificador se come la
// rama muerta, y entonces el origen que quedó horneado se puede VERIFICAR
// mirando el bundle (verificarOrigenDatos, en scripts/build-fondo.mts). Medido
// el 2026-08-17: importándolo, `/api/fondo` sobrevivía en el chunk.
//
// Si algún día se renombra el flag, hay que tocar los dos lugares — de ahí que
// el build falle cuando el bundle no menciona /datos/fondo.json.
const ESTATICO = process.env.NEXT_PUBLIC_FONDO_STANDALONE === "1";

// Lectura compartida del snapshot del fondo. La ficha sticky y el módulo de
// performance montan en secciones distintas de la página; este hook cachea la
// promesa a nivel de módulo para que haya una sola llamada de red en lugar de
// una por componente.

// ── De dónde salen los datos ─────────────────────────────────────────────────
//
// DOS ORÍGENES, Y NO ES LO MISMO QUE DOS FORMATOS: los bytes son idénticos.
//
//   · deploy propio del fondo (Apache/cPanel): ARCHIVOS ESTÁTICOS que publica el
//     panel de empleados. No hay servidor de aplicación que pueda calcular el
//     snapshot en ese hosting, y no hace falta: el panel ya lo calculó con el
//     MISMO `respuestaFondo()` y lo dejó escrito. Apache los sirve sin ejecutar
//     nada.
//   · todo lo demás (el dev y la app Node completa): las rutas de Next, que
//     calculan el snapshot contra la base local en cada pedido.
//
// El JSON estático lo produce `respuestaFondo()`, la misma función que sirve
// `/api/fondo`, así que este switch elige de DÓNDE se baja y nunca QUÉ se
// parsea. Ver docs/plan-consolidacion-fondo.md § Fase 2.
export const RUTA_FONDO = ESTATICO ? "/datos/fondo.json" : "/api/fondo";

export const RUTA_DOCUMENTOS = ESTATICO ? "/datos/documentos.json" : "/api/fondo/documentos";

/**
 * Descarga del PDF por tipo. En el deploy estático es el archivo servido por
 * Apache; en la app es el proxy same-origin que lo saca del bucket.
 *
 * ⚠️ El nombre con el que el visitante guarda el archivo NO es el mismo por los
 * dos caminos: el proxy manda `Content-Disposition` con el nombre lindo
 * (`BNG-Seleccion-Global-Reglamento-de-gestion.pdf`, ver NOMBRE_ARCHIVO en
 * lib/fondoApi.ts) y un asset estático no lleva esa cabecera, así que se guarda
 * como `reglamento.pdf`. Es el mismo trato que ya tenían los PDFs de
 * lib/fondoDocsEstaticos.ts, y se aceptó ahí por la misma razón: no vale un
 * proceso PHP por descarga sólo para renombrar el archivo.
 */
export function rutaDocumento(tipo: string): string {
  return ESTATICO ? `/datos/docs/${tipo}.pdf` : `/api/fondo/documentos/${tipo}`;
}

export type FondoState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; data: FundSnapshot };

let cached: Promise<FundSnapshot> | null = null;

function load(): Promise<FundSnapshot> {
  if (!cached) {
    cached = fetch(RUTA_FONDO, { headers: { Accept: "application/json" } })
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
