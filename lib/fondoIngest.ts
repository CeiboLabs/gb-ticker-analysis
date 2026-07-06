// BNG Selección Global — validación de ingesta del valor cuota.
//
// Núcleo PURO y agnóstico del runtime: importa sólo el TIPO de D1. Nada de
// process.env, Next, I/O a D1, ni postal-mime. Esto es a propósito: el mismo
// módulo lo usa el Email Worker (workers/nav-ingest), así que la lógica de
// "¿este número es publicable?" se decide en un solo lado, con los mismos
// códigos de auditoría. Vive acá y en ningún otro lado.
//
// Convención de números: el validador trabaja con valores CANÓNICOS (fecha ISO
// 'YYYY-MM-DD', nav con punto decimal). La normalización de formato local
// (coma decimal es-UY, miles, etc.) es responsabilidad de quien extrae el dato
// —el extractor del mail o el parser de CSV— antes de llamar acá.

import type { D1Database } from "@/lib/metrics";

// ── Vocabulario de razones (cerrado, espeja fund_audit.reason) ───────────────
// 'sender' y 'low_confidence' los emite la capa de ingesta (allowlist del worker
// / confianza del extractor), no validateNav; se incluyen para tipar la columna.
export type IngestReason =
  | "ok"
  | "sender"
  | "parse"
  | "sanity_band"
  | "future_date"
  | "stale_date"
  | "nonpositive"
  | "conflict"
  | "low_confidence";

export type RejectReason = Exclude<IngestReason, "ok">;

// Entrada cruda: lo que llega del CSV o del extractor, sin confiar en tipos.
export type RawNavInput = {
  dia: unknown;
  nav: unknown;
  aum?: unknown;
  nota?: unknown;
};

// Fila ya validada y lista para escribir en fund_nav.
export type NormalizedNav = {
  dia: string;
  nav: number;            // redondeado a 4 decimales (misma precisión que lib/fondo.ts)
  aum: number | null;
  nota: string | null;
};

// Bandas de cordura. Son atrapa-typos, no un filtro de mercado: un balanceado
// que se mueve >10% en un día es casi seguro un error de unidades (102 → 1020).
// Lo que cae fuera de banda NO se publica; se audita y se alerta, y un humano
// puede forzarlo por la ruta de override.
export type NavBands = {
  navMin: number;         // piso absoluto del valor cuota
  navMax: number;         // techo absoluto
  maxDailyMove: number;   // |Δ| máximo contra el cierre previo (fracción, 0.10 = 10%)
  inceptionDia: string;   // no se aceptan cierres anteriores al inicio del fondo
  dupEpsilon: number;     // tolerancia para considerar "mismo valor" (duplicado)
};

export const DEFAULT_BANDS: NavBands = {
  navMin: 1,
  navMax: 100_000,
  maxDailyMove: 0.10,
  inceptionDia: "2024-01-01", // FONDO.fichaTecnica → "Inicio: Enero 2024"
  dupEpsilon: 5e-5,           // medio dígito en la 4ª decimal
};

export type NavContext = {
  // Último cierre PUBLICADO estrictamente anterior a `dia` (para la banda
  // día-a-día). null = es el primer dato de la serie.
  prevRow?: { dia: string; nav: number } | null;
  // Cierre ya publicado EN `dia` (para detectar duplicado vs conflicto).
  existingRow?: { dia: string; nav: number } | null;
  // Reloj inyectable para tests; default Date.now().
  nowMs?: number;
  bands?: Partial<NavBands>;
};

export type NavValidation =
  | { ok: true; decision: "accepted" | "duplicate"; value: NormalizedNav }
  | { ok: false; decision: "rejected"; reason: RejectReason; message: string };

// ── Helpers ──────────────────────────────────────────────────────────────────

const UY_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC-3, sin DST (mismo criterio que el resto del repo)

/** 'YYYY-MM-DD' con formato válido Y fecha real (rechaza 2025-02-30). */
export function isRealDate(dia: unknown): dia is string {
  if (typeof dia !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false;
  const [y, m, d] = dia.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Día calendario en hora Uruguay como 'YYYY-MM-DD'. */
export function todayUY(nowMs: number): string {
  return new Date(nowMs - UY_OFFSET_MS).toISOString().slice(0, 10);
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

/**
 * Coerción canónica a número finito: acepta number, o string con punto decimal
 * (sin separador de miles ni coma). Devuelve null si no es parseable. La
 * normalización de formato local se hace ANTES, en el extractor/CSV.
 */
export function toCanonicalNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function cleanNota(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, 300) : null;
}

// ── Validación de un cierre ──────────────────────────────────────────────────

/**
 * Decide si un cierre diario es publicable. Orden de chequeos (primer fallo
 * gana): estructura → rango de fecha → positividad → bandas de cordura →
 * duplicado/conflicto. Devuelve la fila normalizada en caso de aceptar.
 */
export function validateNav(input: RawNavInput, ctx: NavContext = {}): NavValidation {
  const bands = { ...DEFAULT_BANDS, ...(ctx.bands ?? {}) };
  const nowMs = ctx.nowMs ?? Date.now();

  // 1. Estructura.
  if (!isRealDate(input.dia)) {
    return reject("parse", "Fecha inválida o ausente (se espera 'YYYY-MM-DD').");
  }
  const dia = input.dia;
  const nav = toCanonicalNumber(input.nav);
  if (nav === null) {
    return reject("parse", "Valor cuota ausente o no numérico.");
  }
  // AUM es opcional; presente-pero-ilegible marca la fila como sospechosa.
  let aum: number | null = null;
  if (input.aum != null && !(typeof input.aum === "string" && input.aum.trim() === "")) {
    aum = toCanonicalNumber(input.aum);
    if (aum === null || aum < 0) {
      return reject("parse", "AUM presente pero no numérico o negativo.");
    }
  }

  // 2. Rango de fecha.
  if (dia > todayUY(nowMs)) {
    return reject("future_date", `Fecha futura (${dia}): un cierre no puede ser posterior a hoy.`);
  }
  if (dia < bands.inceptionDia) {
    return reject("stale_date", `Fecha anterior al inicio del fondo (${bands.inceptionDia}).`);
  }

  // 3. Positividad.
  if (nav <= 0) {
    return reject("nonpositive", `Valor cuota no positivo (${nav}).`);
  }

  // 4. Bandas de cordura.
  if (nav < bands.navMin || nav > bands.navMax) {
    return reject("sanity_band", `Valor cuota fuera de rango absoluto [${bands.navMin}, ${bands.navMax}]: ${nav}.`);
  }
  if (ctx.prevRow && ctx.prevRow.nav > 0) {
    const move = Math.abs(nav / ctx.prevRow.nav - 1);
    if (move > bands.maxDailyMove) {
      return reject(
        "sanity_band",
        `Salto de ${(move * 100).toFixed(1)}% vs ${ctx.prevRow.dia} (${ctx.prevRow.nav}) supera la banda de ${(bands.maxDailyMove * 100).toFixed(0)}%.`,
      );
    }
  }

  const value: NormalizedNav = { dia, nav: round4(nav), aum: aum === null ? null : round4(aum), nota: cleanNota(input.nota) };

  // 5. Duplicado / conflicto contra lo ya publicado en ese día.
  if (ctx.existingRow) {
    if (Math.abs(round4(ctx.existingRow.nav) - value.nav) <= bands.dupEpsilon) {
      return { ok: true, decision: "duplicate", value };
    }
    return reject(
      "conflict",
      `Ya hay un valor publicado para ${dia} (${ctx.existingRow.nav}) distinto del recibido (${value.nav}). Las correcciones van por override.`,
    );
  }

  return { ok: true, decision: "accepted", value };
}

function reject(reason: RejectReason, message: string): NavValidation {
  return { ok: false, decision: "rejected", reason, message };
}

// ── Validación de lote (backfill por CSV) ────────────────────────────────────

export type BatchRowResult =
  | { ok: true; decision: "accepted" | "duplicate"; index: number; value: NormalizedNav }
  | { ok: false; index: number; dia: string | null; reason: RejectReason; message: string };

export type BatchResult = {
  ok: boolean;                  // true si NINGUNA fila fue rechazada
  accepted: NormalizedNav[];    // ordenadas asc por fecha, listas para UPSERT
  results: BatchRowResult[];    // una por fila de entrada (en su orden original)
};

/**
 * Valida un histórico completo para backfill. El input puede venir desordenado:
 * se valida cada fila de forma independiente para el contenido, se ordena por
 * fecha, se detectan duplicados de fecha dentro del lote (→ conflicto) y se
 * controla la banda día-a-día entre cierres consecutivos (y de la primera fila
 * contra `priorRow`, el último cierre ya publicado antes del lote). Una fila
 * mala no contamina al resto: se reporta por índice y las buenas siguen.
 */
export function validateBatch(
  rawRows: RawNavInput[],
  ctx: { priorRow?: { dia: string; nav: number } | null; nowMs?: number; bands?: Partial<NavBands> } = {},
): BatchResult {
  const bands = { ...DEFAULT_BANDS, ...(ctx.bands ?? {}) };
  const nowMs = ctx.nowMs ?? Date.now();

  // Paso 1: estructura + rango + positividad + banda absoluta, sin contexto de
  // serie (prevRow se evalúa recién tras ordenar).
  const staged: { index: number; value: NormalizedNav }[] = [];
  const results: BatchRowResult[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    const v = validateNav(rawRows[i], { nowMs, bands }); // sin prev/existing aún
    if (!v.ok) {
      const dia = isRealDate(rawRows[i].dia) ? (rawRows[i].dia as string) : null;
      results.push({ ok: false, index: i, dia, reason: v.reason, message: v.message });
    } else {
      staged.push({ index: i, value: v.value });
    }
  }

  // Paso 2: ordenar por fecha y detectar duplicados de fecha dentro del lote.
  staged.sort((a, b) => (a.value.dia < b.value.dia ? -1 : a.value.dia > b.value.dia ? 1 : 0));
  const accepted: NormalizedNav[] = [];
  let prev = ctx.priorRow ?? null;
  for (let k = 0; k < staged.length; k++) {
    const { index, value } = staged[k];
    const sameDiaPrev = k > 0 && staged[k - 1].value.dia === value.dia;
    if (sameDiaPrev) {
      results.push({
        ok: false, index, dia: value.dia, reason: "conflict",
        message: `Fecha duplicada dentro del lote: ${value.dia}.`,
      });
      continue;
    }
    // Banda día-a-día contra el cierre anterior (del lote o priorRow).
    if (prev && prev.nav > 0) {
      const move = Math.abs(value.nav / prev.nav - 1);
      if (move > bands.maxDailyMove) {
        results.push({
          ok: false, index, dia: value.dia, reason: "sanity_band",
          message: `Salto de ${(move * 100).toFixed(1)}% vs ${prev.dia} supera la banda de ${(bands.maxDailyMove * 100).toFixed(0)}%.`,
        });
        continue;
      }
    }
    results.push({ ok: true, decision: "accepted", index, value });
    accepted.push(value);
    prev = { dia: value.dia, nav: value.nav };
  }

  results.sort((a, b) => a.index - b.index);
  return { ok: results.every((r) => r.ok), accepted, results };
}

// ── Interfaz de extractores (el Email Worker la usa; se completa en Etapa 3) ──
// La estrategia ACTIVA se escribe una vez que tengamos un mail de muestra real,
// según dónde viva el número (asunto / cuerpo / CSV / XLSX / PDF). Hasta
// entonces EXTRACTORS queda vacío y el worker loguea la muestra para diseñarlo.

export interface ParsedEmail {
  subject: string;
  text: string;
  html: string;
  attachments: { filename: string; mimeType: string; content: Uint8Array }[];
  header(name: string): string | null;
}

export interface ExtractionResult {
  dia?: string;
  nav?: number;
  aum?: number | null;
  nota?: string;
  strategy: string;
  confidence: "high" | "low";
}

export interface NavExtractor {
  name: string;
  canHandle(email: ParsedEmail): boolean;
  extract(email: ParsedEmail): ExtractionResult | null;
}

export const EXTRACTORS: NavExtractor[] = [];

/** Prueba los extractores en orden y devuelve el primer match. */
export function runExtractors(email: ParsedEmail, extractors: NavExtractor[] = EXTRACTORS): ExtractionResult | null {
  for (const ex of extractors) {
    if (!ex.canHandle(email)) continue;
    const r = ex.extract(email);
    if (r && (r.nav != null || r.dia != null)) return r;
  }
  return null;
}

// Re-export del tipo D1 para que los consumidores tengan una sola fuente.
export type { D1Database };
