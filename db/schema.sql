-- D1 schema for ticker analyze-event monitoring.
-- Apply with:
--   wrangler d1 execute ticker-metrics --file=db/schema.sql --remote
--   wrangler d1 execute ticker-metrics --file=db/schema.sql --local
--
-- Migrations are append-only — add ALTER TABLE statements at the bottom rather
-- than editing existing column definitions, so re-running on an existing DB
-- is a no-op.

CREATE TABLE IF NOT EXISTS analyze_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ts            INTEGER NOT NULL,           -- Date.now() at request end
  ticker        TEXT    NOT NULL,           -- uppercased symbol
  status        TEXT    NOT NULL,           -- 'ok' | 'error' | 'rate_limited' | 'cache_hit' | 'bad_request' | 'not_found'
  duration_ms   INTEGER,                    -- end-to-end wall time
  sankey_source TEXT,                       -- '8k' | '6k' | 'segments' | 'yahoo_fallback' | 'yahoo_ttm' | 'none'
  sankey_stale  INTEGER,                    -- 0/1 (isEdgarStale at response time)
  fx_ok         INTEGER,                    -- 0/1, NULL when fx not needed
  edgar_8k_ok   INTEGER,                    -- 0/1, NULL when not attempted
  segments_ok   INTEGER,                    -- 0/1, NULL when not attempted
  error_stage   TEXT,                       -- 'edgar' | 'yahoo' | 'openai' | 'fx' | 'parse' | 'rate_limit' | NULL
  error_msg     TEXT,                       -- truncated to 500 chars
  user_agent    TEXT,                       -- truncated to 200 chars
  country       TEXT,                       -- request.cf.country (2-letter)
  ip_hash       TEXT                        -- short hash, for unique-user rough counts without storing IPs
);

CREATE INDEX IF NOT EXISTS idx_events_ts          ON analyze_events(ts);
CREATE INDEX IF NOT EXISTS idx_events_ticker_ts   ON analyze_events(ticker, ts);
CREATE INDEX IF NOT EXISTS idx_events_status_ts   ON analyze_events(status, ts);
CREATE INDEX IF NOT EXISTS idx_events_source_ts   ON analyze_events(sankey_source, ts);

-- Migration 2026-05-04: Sankey quality columns. SQLite doesn't support
-- "ADD COLUMN IF NOT EXISTS"; running ALTER on a DB that already has them
-- errors out. The Pages bootstrap pattern is to swallow the error since
-- re-applying the schema is rare. If you hit a duplicate-column error,
-- comment out the lines that already exist and re-run.
ALTER TABLE analyze_events ADD COLUMN quality_score        INTEGER;
ALTER TABLE analyze_events ADD COLUMN has_segments         INTEGER;
ALTER TABLE analyze_events ADD COLUMN segment_count        INTEGER;
ALTER TABLE analyze_events ADD COLUMN has_opex_breakdown   INTEGER;
ALTER TABLE analyze_events ADD COLUMN segment_balance_pct  REAL;
ALTER TABLE analyze_events ADD COLUMN cost_balance_pct     REAL;
ALTER TABLE analyze_events ADD COLUMN opex_balance_pct     REAL;
ALTER TABLE analyze_events ADD COLUMN op_chain_balance_pct REAL;
ALTER TABLE analyze_events ADD COLUMN quality_flags        TEXT;

CREATE INDEX IF NOT EXISTS idx_events_quality_ts ON analyze_events(quality_score, ts);

-- Migration 2026-05-05: store concrete diagnostics + a slim snapshot of the
-- SegmentSankeyData so the dashboard can show "what failed for THIS request"
-- not just an aggregate score.
ALTER TABLE analyze_events ADD COLUMN quality_findings TEXT;  -- JSON array of {code, severity, message, values}
ALTER TABLE analyze_events ADD COLUMN sankey_snapshot  TEXT;  -- JSON, slim SegmentSankeyData; populated when score < 100

-- Migration 2026-05-05: report fields for the analyses-centric dashboard.
-- We store the verdict (BUY/HOLD/AVOID + conviction + rationale), the company
-- name + market snapshot, and price targets so the monitor can show the same
-- decision summary the user saw, without re-running OpenAI.
ALTER TABLE analyze_events ADD COLUMN verdict_rating     TEXT;   -- 'BUY' | 'HOLD' | 'AVOID'
ALTER TABLE analyze_events ADD COLUMN verdict_conviction TEXT;   -- 'HIGH' | 'MEDIUM' | 'LOW'
ALTER TABLE analyze_events ADD COLUMN verdict_rationale  TEXT;   -- short prose, truncated 600
ALTER TABLE analyze_events ADD COLUMN company_name       TEXT;   -- e.g. "Apple Inc."
ALTER TABLE analyze_events ADD COLUMN current_price      REAL;
ALTER TABLE analyze_events ADD COLUMN market_cap         REAL;
ALTER TABLE analyze_events ADD COLUMN bull_target        TEXT;   -- price target string from report
ALTER TABLE analyze_events ADD COLUMN bear_target        TEXT;

CREATE INDEX IF NOT EXISTS idx_events_verdict ON analyze_events(verdict_rating, ts);

-- Migration 2026-06-04: durable rate-limit counters. The previous limiter
-- lived in an in-memory Map per edge isolate — an F5 could land on a fresh
-- isolate and the 429 evaporated. Counters now persist here with atomic
-- UPSERT increments; one row per (key, fixed window). Expired windows are
-- purged by /api/admin/retention.
CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT    NOT NULL,  -- e.g. 'hr:<session>', 'hrip:<ip>', 'dfresh:<session>', 'adminfail:<ip>'
  window_start INTEGER NOT NULL,  -- ms epoch, floor(now / windowMs) * windowMs
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
) WITHOUT ROWID;

-- Migration 2026-06-04: mensajes del formulario de contacto institucional.
-- emailed marca si la notificación por Resend salió bien (0 = quedó solo en
-- DB; el dashboard/inbox manual sigue siendo la fuente de verdad).
CREATE TABLE IF NOT EXISTS contact_messages (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       INTEGER NOT NULL,
  nombre   TEXT    NOT NULL,
  apellido TEXT    NOT NULL,
  email    TEXT    NOT NULL,
  telefono TEXT,
  motivo   TEXT    NOT NULL,
  mensaje  TEXT    NOT NULL,
  ip_hash  TEXT,
  emailed  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_contact_ts ON contact_messages(ts);
