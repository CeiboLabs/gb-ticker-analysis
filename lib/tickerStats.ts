// Popularidad de tickers para "Las más analizadas" de /analisis.
//
// Persistida en SQLite (binding METRICS_DB, vía getMetricsDb) — una fila por
// (symbol, día UTC) con UPSERT atómico. Reemplaza el contador in-memory anterior
// (resto de la época Cloudflare Cache API, que se borraba en cada reinicio del
// proceso): ahora el ranking SOBREVIVE reinicios y deploys, y el incremento
// atómico elimina la pérdida de conteos por escrituras concurrentes.
//
// La tabla vive en db/schema.sql; ensureTable() la crea lazy (IF NOT EXISTS) para
// que funcione también contra una base ya inicializada sin migración manual.
//
// Sin binding (contexto edge o server sin inicializar): degradación limpia —
// recordTickerView es no-op y getTopTickers devuelve [] (⇒ /api/popular cae al
// fallback curado). Best-effort: los callers ya envuelven la llamada en .catch().

import { getMetricsDb, type D1Database } from "@/lib/metrics";

const RETENTION_DAYS = 30;

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS ticker_views (
  symbol TEXT NOT NULL,
  day    TEXT NOT NULL,
  count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (symbol, day)
) WITHOUT ROWID`;
const CREATE_INDEX = `CREATE INDEX IF NOT EXISTS idx_ticker_views_day ON ticker_views(day)`;

function todayUtc(): string {
  return new Date().toISOString().split("T")[0];
}

function dateNDaysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}

// Crea tabla + índice una sola vez por proceso (memoizado). Redundante con
// db/schema.sql en base fresca; imprescindible en una base ya inicializada que
// aún no tiene la tabla. Si falla, se resetea para reintentar en la próxima.
let ensured: Promise<void> | null = null;
function ensureTable(db: D1Database): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await db.prepare(CREATE_TABLE).run();
      await db.prepare(CREATE_INDEX).run();
    })().catch((err) => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}

// Purga best-effort de filas fuera de retención, una vez por proceso. Son inertes
// para el ranking (filtra por ventana), así que esto es sólo higiene de la tabla.
let pruned = false;
function pruneOnce(db: D1Database): void {
  if (pruned) return;
  pruned = true;
  void db
    .prepare("DELETE FROM ticker_views WHERE day < ?")
    .bind(dateNDaysAgo(RETENTION_DAYS))
    .run()
    .catch(() => {
      pruned = false;
    });
}

export async function recordTickerView(ticker: string): Promise<void> {
  const db = getMetricsDb();
  if (!db) return;
  await ensureTable(db);
  await db
    .prepare(
      `INSERT INTO ticker_views (symbol, day, count) VALUES (?, ?, 1)
       ON CONFLICT(symbol, day) DO UPDATE SET count = count + 1`,
    )
    .bind(ticker.toUpperCase(), todayUtc())
    .run();
  pruneOnce(db);
}

export async function getTopTickers(
  limit: number,
  lookbackDays = 7,
): Promise<{ symbol: string; count: number }[]> {
  const db = getMetricsDb();
  if (!db) return [];
  await ensureTable(db);
  const { results } = await db
    .prepare(
      `SELECT symbol, SUM(count) AS count
         FROM ticker_views
        WHERE day >= ?
        GROUP BY symbol
        ORDER BY count DESC, symbol ASC
        LIMIT ?`,
    )
    .bind(dateNDaysAgo(lookbackDays), Math.max(1, Math.floor(limit)))
    .all<{ symbol: string; count: number }>();
  return results.map((r) => ({ symbol: r.symbol, count: Number(r.count) }));
}
