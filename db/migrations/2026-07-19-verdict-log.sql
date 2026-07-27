-- Migration 2026-07-19: historial de veredictos (verdict_log).
--
-- WHY: medir la calidad de la recomendación ("cuando el sistema dice BUY,
-- ¿cuántas veces acierta?") exige comparar cada veredicto contra el retorno
-- 6-12 meses después. Hoy eso es incontestable: el cache de análisis es
-- efímero (Cache API / memoria, se pisa por ticker) y analyze_events —que sí
-- guarda el rating— se purga a los RETENTION_DAYS (90) en purgeExpiredRows.
--
-- verdict_log es append-only y EXENTA de toda retención: una fila por
-- generación FRESCA (nunca cache_hit, nunca mock), con el snapshot mínimo
-- para backtesting — rating + targets + precio al momento + las condiciones
-- del framework ya evaluadas en código (metrics_json). Las condiciones
-- permiten calibración por condición y evaluar señales nuevas (p.ej. contexto
-- técnico) contra resultados reales antes de dejarlas opinar en el veredicto.
--
-- La escribe SOLO lib/verdictLog.ts desde el path de éxito de /api/analyze
-- (best-effort, jamás afecta la respuesta). Nunca se hace UPDATE ni DELETE.
--
-- En base ya inicializada:  sqlite3 data/bengochea.sqlite3 < db/migrations/2026-07-19-verdict-log.sql
-- En base fresca ya viene en schema.sql (todo acá es idempotente: re-correrla
-- es un no-op, incluido el backfill gracias al guard NOT EXISTS).

CREATE TABLE IF NOT EXISTS verdict_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ts               INTEGER NOT NULL,           -- Date.now() de la generación
  ticker           TEXT    NOT NULL,           -- símbolo en mayúsculas
  company_name     TEXT,
  rating           TEXT    NOT NULL,           -- 'BUY' | 'HOLD' | 'AVOID'
  conviction       TEXT,                       -- 'HIGH' | 'MEDIUM' | 'LOW'
  price_at_verdict REAL,                       -- stockData.currentPrice del snapshot que vio el usuario
  currency         TEXT,                       -- moneda de cotización (Yahoo)
  price_target     REAL,                       -- verdict.priceTarget (target central 12m)
  bull_target      REAL,
  bear_target      REAL,
  bull_probability REAL,                       -- % asignado al bull case
  bear_probability REAL,
  market_cap       REAL,                       -- para segmentar hit-rate por tamaño
  consensus        TEXT,                       -- 'buy' | 'hold' | 'sell' (clasificado en código)
  metrics_json     TEXT,                       -- JSON slim: métricas derivadas + condiciones del framework
  coherence_flags  TEXT,                       -- CSV: verdict_repaired | verdict_incoherent_final | ...
  model            TEXT,                       -- modelo LLM que generó el reporte
  report_version   TEXT,                       -- CACHE_VERSION del shape del reporte (cohortes de eval)
  source           TEXT    NOT NULL DEFAULT 'live'  -- 'live' | 'backfill_events'
);

CREATE INDEX IF NOT EXISTS idx_verdict_log_ts        ON verdict_log(ts);
CREATE INDEX IF NOT EXISTS idx_verdict_log_ticker_ts ON verdict_log(ticker, ts);
CREATE INDEX IF NOT EXISTS idx_verdict_log_rating_ts ON verdict_log(rating, ts);

-- Backfill: siembra el log con los veredictos que analyze_events todavía
-- conserva (ventana de retención ~90 días; sólo generaciones frescas con
-- rating — los cache_hit del mock stub no llevan verdict_rating). Sin
-- price_target central ni condiciones (las filas viejas no los guardaron):
-- alcanzan ticker + ts + rating + precio para hit-rate direccional. Los
-- targets bull/bear son strings numéricos puros post-clamp ("215.50"); el
-- GLOB descarta cualquier formato inesperado en vez de castearlo a 0.
INSERT INTO verdict_log (
  ts, ticker, company_name, rating, conviction,
  price_at_verdict, bull_target, bear_target, market_cap, source
)
SELECT
  e.ts, e.ticker, e.company_name, e.verdict_rating, e.verdict_conviction,
  e.current_price,
  CASE WHEN e.bull_target GLOB '[0-9]*' AND NOT e.bull_target GLOB '*[^0-9.]*'
       THEN CAST(e.bull_target AS REAL) END,
  CASE WHEN e.bear_target GLOB '[0-9]*' AND NOT e.bear_target GLOB '*[^0-9.]*'
       THEN CAST(e.bear_target AS REAL) END,
  e.market_cap, 'backfill_events'
FROM analyze_events e
WHERE e.status = 'ok'
  AND e.verdict_rating IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM verdict_log v
    WHERE v.source = 'backfill_events' AND v.ticker = e.ticker AND v.ts = e.ts
  );
