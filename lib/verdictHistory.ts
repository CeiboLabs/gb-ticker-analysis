// Historia de calificaciones por acción — lectura pública de verdict_log.
//
// POR QUÉ EXISTE: el informe es una foto congelada de algo que se mueve, y hasta
// ahora no había forma de saber que se movió. verdict_log guarda cada veredicto
// emitido con el precio de ese día, está exenta de purga y nunca recibe UPDATE
// (ver lib/verdictLog.ts): es un archivo real de 18 meses que no se estaba
// mostrando. "Hace dos meses decía comprar y ahora dice mantener" es la única
// historia que la herramienta puede contar sobre sí misma, y es la que justifica
// seguir una acción.
//
// CORRIDAS, NO EVENTOS: se colapsan las repeticiones consecutivas del mismo
// rating. Un HOLD generado ocho veces seguidas no son ocho noticias — es un HOLD
// que se sostuvo desde la primera. Es además cómo publica los cambios de
// calificación cualquier casa de research: "HOLD desde mayo (antes BUY)".
//
// SUPERFICIE MÍNIMA: sale rating, convicción, fecha y precio. NADA de
// metrics_json, coherence_flags ni model — eso es instrumentación interna y no
// tiene por qué viajar al cliente.

import { getMetricsDb, type D1Database } from "@/lib/metrics";

/** Un tramo con la misma calificación sostenida. */
export type VerdictRun = {
  rating: "BUY" | "HOLD" | "AVOID";
  /** Convicción del primer veredicto del tramo. */
  conviction: string | null;
  /** Date.now() del primer veredicto del tramo — "desde cuándo". */
  since: number;
  /** Precio del día en que empezó el tramo. */
  priceAt: number | null;
  /** Cuántas generaciones cayeron dentro del tramo. */
  count: number;
};

export type VerdictHistory = {
  /** Tramos del más reciente al más viejo (tope: `limit`). */
  runs: VerdictRun[];
  /** Calificación anterior a la vigente, si alguna vez cambió. */
  previous: "BUY" | "HOLD" | "AVOID" | null;
  /** Total de veredictos registrados para el ticker (sin colapsar). */
  total: number;
};

type Row = { id: number; ts: number; rating: string; conviction: string | null; price_at_verdict: number | null };

function isRating(v: string): v is "BUY" | "HOLD" | "AVOID" {
  return v === "BUY" || v === "HOLD" || v === "AVOID";
}

/**
 * Historia de un ticker. Devuelve `null` si no hay base; una historia vacía si
 * el ticker nunca se analizó. Nunca tira: sin historia el informe se dibuja
 * igual, así que un problema acá no puede tumbar la página.
 */
export async function verdictHistory(
  ticker: string,
  { limit = 4, db }: { limit?: number; db?: D1Database | null } = {},
): Promise<VerdictHistory | null> {
  const base = db ?? getMetricsDb();
  if (!base) return null;

  try {
    // ASC para poder colapsar corridas en orden cronológico; se invierte al final.
    const res = await base
      .prepare(
        "SELECT id, ts, rating, conviction, price_at_verdict FROM verdict_log " +
        "WHERE ticker = ? ORDER BY ts ASC",
      )
      .bind(ticker.toUpperCase())
      .all<Row>();

    const rows = (res.results ?? []).filter((r) => isRating(r.rating));
    if (rows.length === 0) return { runs: [], previous: null, total: 0 };

    const runs: VerdictRun[] = [];
    for (const r of rows) {
      const rating = r.rating as "BUY" | "HOLD" | "AVOID";
      const ultimo = runs[runs.length - 1];
      if (ultimo && ultimo.rating === rating) {
        ultimo.count += 1;
        continue;
      }
      runs.push({
        rating,
        conviction: r.conviction,
        since: r.ts,
        priceAt: r.price_at_verdict,
        count: 1,
      });
    }

    // Más reciente primero, que es el orden en que se lee.
    runs.reverse();
    const previous = runs.length > 1 ? runs[1].rating : null;

    return { runs: runs.slice(0, limit), previous, total: rows.length };
  } catch (err) {
    console.error("[verdictHistory] read failed:", err);
    return null;
  }
}
