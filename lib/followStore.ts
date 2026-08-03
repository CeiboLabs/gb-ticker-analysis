// Seguimiento de acciones — la continuidad que el informe promete y no cumplía.
//
// EL PUNTO: el informe es una foto congelada de algo que se mueve, y hasta ahora
// no había forma de enterarse de que se movió. Seguir una acción convierte una
// lectura suelta en una relación, y es el único mecanismo del embudo que produce
// VISITAS DE VUELTA — que es la moneda real: nadie abre una cuenta de bolsa en la
// primera visita, así que el trabajo es seguir estando ahí.
//
// FUNCIONA SIN MANDAR UN MAIL, y eso es deliberado. La casa recolecta correos
// pero todavía no envía ninguno; un plan cuya primera fase depende del envío
// queda bloqueado por infraestructura inexistente. Acá el diff se calcula al
// VOLVER al sitio: se guarda el veredicto que la persona vio y se compara con el
// vigente. Cuando el envío exista, lee exactamente lo mismo y no hay que rehacer
// nada.
//
// LA VERDAD LA PONE EL SERVIDOR: el veredicto vigente sale de verdict_log, no de
// lo que diga el cliente. Un POST no puede declarar "yo vi un BUY" para fabricar
// un cambio.

import { getMetricsDb, type D1Database } from "@/lib/metrics";

export type CambioSeguimiento = {
  /** Veredicto que la persona vio la última vez. */
  verdictoAntes: string | null;
  /** Veredicto vigente hoy. */
  verdictoAhora: string | null;
  precioAntes: number | null;
  precioAhora: number | null;
  /** Variación de precio desde la última visita, en fracción. */
  variacion: number | null;
  /** true si la calificación cambió — la única señal que merece un aviso. */
  cambioVerdicto: boolean;
};

export type Seguimiento = {
  ticker: string;
  desde: number;
  vistoEl: number | null;
  cambio: CambioSeguimiento | null;
};

/** Último veredicto emitido para un ticker. La verdad de "qué dice hoy la casa". */
async function verdictoVigente(
  db: D1Database,
  ticker: string,
): Promise<{ rating: string; price: number | null } | null> {
  const r = await db
    .prepare(
      "SELECT rating, price_at_verdict FROM verdict_log WHERE ticker = ? ORDER BY ts DESC LIMIT 1",
    )
    .bind(ticker.toUpperCase())
    .first<{ rating: string; price_at_verdict: number | null }>();
  return r ? { rating: r.rating, price: r.price_at_verdict } : null;
}

/** ¿Sigue esta persona esta acción? */
export async function sigue(db: D1Database, email: string, ticker: string): Promise<boolean> {
  const r = await db
    .prepare("SELECT 1 AS x FROM lead_follow WHERE email = ? AND ticker = ?")
    .bind(email.trim().toLowerCase(), ticker.toUpperCase())
    .first<{ x: number }>();
  return !!r;
}

/**
 * Empieza a seguir. Idempotente: seguir dos veces no duplica ni reinicia la
 * fecha. El veredicto vigente se sella como "ya visto" en el alta — si no, el
 * primer regreso mostraría un cambio que en realidad nunca ocurrió.
 */
export async function seguir(db: D1Database, email: string, ticker: string): Promise<void> {
  const e = email.trim().toLowerCase();
  const t = ticker.toUpperCase();
  const v = await verdictoVigente(db, t);
  const ahora = Date.now();
  await db
    .prepare(
      "INSERT INTO lead_follow (email, ticker, created_at, last_seen_verdict, last_seen_price, last_seen_at) " +
      "VALUES (?,?,?,?,?,?) ON CONFLICT(email, ticker) DO NOTHING",
    )
    .bind(e, t, ahora, v?.rating ?? null, v?.price ?? null, ahora)
    .run();
}

export async function dejarDeSeguir(db: D1Database, email: string, ticker: string): Promise<void> {
  await db
    .prepare("DELETE FROM lead_follow WHERE email = ? AND ticker = ?")
    .bind(email.trim().toLowerCase(), ticker.toUpperCase())
    .run();
}

/**
 * Lista de seguidos con lo que cambió en cada uno desde la última visita. NO
 * muta: marcar como visto es una acción aparte (`marcarVisto`), porque si leer la
 * lista marcara visto, el aviso desaparecería antes de que la persona entre a ver
 * qué pasó.
 */
export async function listarSeguidos(db: D1Database, email: string): Promise<Seguimiento[]> {
  const res = await db
    .prepare(
      "SELECT f.ticker, f.created_at, f.last_seen_verdict, f.last_seen_price, f.last_seen_at, " +
      // El veredicto vigente por ticker, en la misma consulta: subconsulta
      // correlacionada sobre el índice (ticker, ts) de verdict_log.
      "  (SELECT v.rating FROM verdict_log v WHERE v.ticker = f.ticker ORDER BY v.ts DESC LIMIT 1) AS rating_hoy, " +
      "  (SELECT v.price_at_verdict FROM verdict_log v WHERE v.ticker = f.ticker ORDER BY v.ts DESC LIMIT 1) AS precio_hoy " +
      "FROM lead_follow f WHERE f.email = ? ORDER BY f.created_at DESC",
    )
    .bind(email.trim().toLowerCase())
    .all<{
      ticker: string; created_at: number;
      last_seen_verdict: string | null; last_seen_price: number | null; last_seen_at: number | null;
      rating_hoy: string | null; precio_hoy: number | null;
    }>();

  return (res.results ?? []).map((r) => {
    const variacion =
      r.last_seen_price != null && r.precio_hoy != null && r.last_seen_price > 0
        ? r.precio_hoy / r.last_seen_price - 1
        : null;
    const cambioVerdicto =
      r.rating_hoy != null && r.last_seen_verdict != null && r.rating_hoy !== r.last_seen_verdict;
    return {
      ticker: r.ticker,
      desde: r.created_at,
      vistoEl: r.last_seen_at,
      // Sin nada que comparar no hay "cambio": es una acción recién seguida.
      cambio:
        r.rating_hoy == null && r.last_seen_verdict == null
          ? null
          : {
              verdictoAntes: r.last_seen_verdict,
              verdictoAhora: r.rating_hoy,
              precioAntes: r.last_seen_price,
              precioAhora: r.precio_hoy,
              variacion,
              cambioVerdicto,
            },
    };
  });
}

/**
 * Sella lo que la persona está viendo AHORA como "visto". Se llama cuando abre el
 * informe de esa acción, y sólo si la sigue: es lo que hace que el aviso de
 * cambio se apague recién cuando efectivamente lo leyó.
 */
export async function marcarVisto(db: D1Database, email: string, ticker: string): Promise<void> {
  const t = ticker.toUpperCase();
  const v = await verdictoVigente(db, t);
  if (!v) return;
  await db
    .prepare(
      "UPDATE lead_follow SET last_seen_verdict = ?, last_seen_price = ?, last_seen_at = ? " +
      "WHERE email = ? AND ticker = ?",
    )
    .bind(v.rating, v.price, Date.now(), email.trim().toLowerCase(), t)
    .run();
}

/**
 * Cuántas personas siguen un ticker. Lo usa el panel para priorizar el refresco
 * programado: si diez personas siguen una acción, hoy son diez generaciones a
 * demanda; con seguimiento es UNA sola y los diez reciben el aviso.
 */
export async function seguidoresPorTicker(
  db: D1Database,
  limit = 30,
): Promise<Array<{ ticker: string; n: number }>> {
  const res = await db
    .prepare(
      "SELECT ticker, COUNT(*) AS n FROM lead_follow GROUP BY ticker ORDER BY n DESC, ticker LIMIT ?",
    )
    .bind(Math.min(Math.max(limit, 1), 200))
    .all<{ ticker: string; n: number }>();
  return res.results ?? [];
}

/** Atajo con el binding por defecto, para llamadas fire-and-forget. */
export function dbOrNull(): D1Database | null {
  return getMetricsDb();
}
