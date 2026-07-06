-- Seam de datos del fondo BNG Selección Global — versión "crear todo completo"
-- (idempotente: sólo CREATE ... IF NOT EXISTS, sin ALTER).
--
-- Usar esta cuando la base NO tiene todavía la tabla fund_nav (p. ej. la D1
-- remota, a la que nunca se le aplicó la migración base 2026-06-07): crea
-- fund_nav con TODAS las columnas (base + ingesta) y las tablas nuevas de una.
--
-- Aplicar con --command (usa el API de queries; --file --remote usa el API de
-- import, que puede fallar con "Authentication error [code: 10000]" en tokens
-- OAuth viejos):
--   npx wrangler d1 execute ticker-metrics --remote --command "$(cat db/migrations/2026-06-26-fondo-ingesta.sql)"
--   npx wrangler d1 execute ticker-metrics --local  --command "$(cat db/migrations/2026-06-26-fondo-ingesta.sql)"
--
-- ⚠️ Si tu base YA tiene una fund_nav vieja (sólo dia,nav,aum,nota,updated_at),
-- este script NO le agrega las columnas nuevas (CREATE IF NOT EXISTS la saltea).
-- En ese caso corré los 4 ALTER del bloque "Migration 2026-06-26" de db/schema.sql.

CREATE TABLE IF NOT EXISTS fund_nav (
  dia         TEXT    NOT NULL,
  nav         REAL    NOT NULL,
  aum         REAL,
  nota        TEXT,
  updated_at  INTEGER NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'live',   -- 'live' | 'hold'
  source      TEXT,                              -- 'email' | 'backfill' | 'override'
  message_id  TEXT,                              -- Message-ID del mail (idempotencia)
  sender_hash TEXT,                              -- hash FNV-1a del remitente (nunca crudo)
  PRIMARY KEY (dia)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_fund_nav_dia    ON fund_nav(dia);
CREATE INDEX IF NOT EXISTS idx_fund_nav_status ON fund_nav(status, dia);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fund_nav_msgid ON fund_nav(message_id) WHERE message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS fund_audit (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,
  actor       TEXT    NOT NULL,
  channel     TEXT    NOT NULL,
  action      TEXT    NOT NULL,
  decision    TEXT    NOT NULL,
  reason      TEXT,
  target_dia  TEXT,
  parsed_nav  REAL,
  parsed_aum  REAL,
  prev_nav    REAL,
  strategy    TEXT,
  message_id  TEXT,
  sender_hash TEXT,
  ip_hash     TEXT,
  raw_excerpt TEXT
);
CREATE INDEX IF NOT EXISTS idx_fund_audit_ts       ON fund_audit(ts);
CREATE INDEX IF NOT EXISTS idx_fund_audit_dia      ON fund_audit(target_dia, ts);
CREATE INDEX IF NOT EXISTS idx_fund_audit_decision ON fund_audit(decision, ts);

CREATE TABLE IF NOT EXISTS fund_ingest_seen (
  message_id TEXT    NOT NULL,
  ts         INTEGER NOT NULL,
  outcome    TEXT    NOT NULL,
  PRIMARY KEY (message_id)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS fund_benchmark (
  dia        TEXT    NOT NULL,
  level      REAL    NOT NULL,
  source     TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (dia)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_fund_benchmark_dia ON fund_benchmark(dia);

CREATE TABLE IF NOT EXISTS fund_holdings_snapshot (
  as_of       TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'live',
  source      TEXT,
  message_id  TEXT,
  sender_hash TEXT,
  note        TEXT,
  ingested_at INTEGER NOT NULL,
  PRIMARY KEY (as_of)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS fund_holdings_item (
  as_of       TEXT    NOT NULL,
  ord         INTEGER NOT NULL,
  name        TEXT    NOT NULL,
  short       TEXT,
  asset_class TEXT    NOT NULL,
  weight_bps  INTEGER NOT NULL,
  PRIMARY KEY (as_of, name)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_fund_holdings_item_asof ON fund_holdings_item(as_of, ord);
