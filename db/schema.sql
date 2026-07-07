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
  error_stage   TEXT,                       -- 'edgar' | 'yahoo' | 'openai' | 'fx' | 'parse' | 'rate_limit' | 'upstream_timeout' | NULL
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

-- Migration 2026-06-07: serie diaria del fondo BNG Selección Global.
-- Una fila por día hábil (dia = 'YYYY-MM-DD'). El sitio lee la última fila
-- para el valor cuota (nav) y los activos bajo manejo (aum), y toda la serie
-- para el gráfico de performance. Mientras el fondo esté en pre-lanzamiento la
-- tabla queda vacía y la web muestra el estado "en proceso de lanzamiento"; la
-- ingestión diaria (custodio/feed) se enchufa acá sin tocar el frontend.
CREATE TABLE IF NOT EXISTS fund_nav (
  dia      TEXT    NOT NULL,           -- fecha de cierre, 'YYYY-MM-DD' (clave natural)
  nav      REAL    NOT NULL,           -- valor cuota del día
  aum      REAL,                       -- activos bajo manejo (misma moneda que nav), NULL si no se publica
  nota     TEXT,                       -- comentario opcional del cierre
  updated_at INTEGER NOT NULL,         -- Date.now() del ingreso/actualización de la fila
  PRIMARY KEY (dia)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_fund_nav_dia ON fund_nav(dia);

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 2026-06-26: infraestructura de datos del fondo BNG Selección Global.
-- La cuota diaria entra por mail (Cloudflare Email Worker → D1) o por backfill
-- admin; cada decisión de ingesta se audita y sólo lo válido se publica. Estas
-- tablas las lee el sitio (/api/fondo) y el panel /admin/fondo, y las escriben
-- el worker workers/nav-ingest y las rutas /api/admin/fondo/*.

-- fund_nav: procedencia + estado de publicación. Un valor rechazado NUNCA llega
-- acá (vive sólo en fund_audit); status habilita un hold/corrección manual sin
-- DELETE destructivo. SQLite no soporta "ADD COLUMN IF NOT EXISTS": si al
-- re-aplicar da error de columna duplicada, comentar las ALTER ya aplicadas
-- (mismo criterio que la migración 2026-05-04 de arriba).
ALTER TABLE fund_nav ADD COLUMN status      TEXT NOT NULL DEFAULT 'live'; -- 'live' | 'hold'
ALTER TABLE fund_nav ADD COLUMN source      TEXT;     -- 'email' | 'backfill' | 'override'
ALTER TABLE fund_nav ADD COLUMN message_id  TEXT;     -- Message-ID del mail, para idempotencia
ALTER TABLE fund_nav ADD COLUMN sender_hash TEXT;     -- hash FNV-1a del remitente (nunca la dirección cruda)

CREATE INDEX IF NOT EXISTS idx_fund_nav_status ON fund_nav(status, dia);
-- Idempotencia a nivel DB: un Message-ID puede escribir a lo sumo una fila nav.
CREATE UNIQUE INDEX IF NOT EXISTS idx_fund_nav_msgid ON fund_nav(message_id) WHERE message_id IS NOT NULL;

-- Auditoría inmutable y append-only de CADA decisión de ingesta (aceptada,
-- rechazada, duplicada u override). Fuente de verdad de "qué pasó con la cuota
-- de tal día" y material para depurar el parser.
CREATE TABLE IF NOT EXISTS fund_audit (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,           -- Date.now() de la decisión
  actor       TEXT    NOT NULL,           -- 'email-worker' | 'admin' | 'backfill' | 'deadman'
  channel     TEXT    NOT NULL,           -- 'email' | 'http' | 'cron'
  action      TEXT    NOT NULL,           -- 'ingest' | 'override' | 'backfill' | 'holdings' | 'deadman_alert'
  decision    TEXT    NOT NULL,           -- 'accepted' | 'rejected' | 'duplicate' | 'superseded'
  reason      TEXT,                       -- vocab cerrado: 'ok'|'sender'|'parse'|'sanity_band'|'future_date'|'stale_date'|'nonpositive'|'conflict'|'low_confidence'
  target_dia  TEXT,                       -- 'YYYY-MM-DD' al que refiere el valor
  parsed_nav  REAL,
  parsed_aum  REAL,
  prev_nav    REAL,                       -- valor publicado en target_dia antes de este evento (rastro de conflicto/override)
  strategy    TEXT,                       -- extractor que matcheó: 'subject_regex'|'body_regex'|'csv'|'xlsx'|'pdf'
  message_id  TEXT,
  sender_hash TEXT,                       -- hasheado, nunca crudo
  ip_hash     TEXT,                       -- para el canal http (backfill/override)
  raw_excerpt TEXT                        -- asunto/snippet saneado + truncado; nunca el cuerpo completo
);

CREATE INDEX IF NOT EXISTS idx_fund_audit_ts       ON fund_audit(ts);
CREATE INDEX IF NOT EXISTS idx_fund_audit_dia      ON fund_audit(target_dia, ts);
CREATE INDEX IF NOT EXISTS idx_fund_audit_decision ON fund_audit(decision, ts);

-- Supresión de replay para TODO desenlace (incluidos los rechazos): un mail
-- re-entregado no debe re-escribir ni re-alertar. fund_nav.message_id sólo cubre
-- los aceptados; esto cubre también rechazos y duplicados.
CREATE TABLE IF NOT EXISTS fund_ingest_seen (
  message_id TEXT    NOT NULL,
  ts         INTEGER NOT NULL,
  outcome    TEXT    NOT NULL,           -- espeja fund_audit.decision
  PRIMARY KEY (message_id)
) WITHOUT ROWID;

-- Serie del benchmark de referencia (compuesto 60/40), guardada como NIVELES de
-- índice. El gráfico ya reescala al valor cuota inicial del fondo, así que sólo
-- importan los niveles relativos. Vacía ⇒ el gráfico dibuja sólo la línea del
-- fondo. NUNCA se escriben niveles inventados.
CREATE TABLE IF NOT EXISTS fund_benchmark (
  dia        TEXT    NOT NULL,           -- 'YYYY-MM-DD', alineado a días de la serie del fondo
  level      REAL    NOT NULL,
  source     TEXT,                       -- 'administrator' | 'etf_proxy' | 'index_licensed'
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (dia)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_fund_benchmark_dia ON fund_benchmark(dia);

-- Tenencias del fondo: snapshots periódicos (cadencia mensual, con rezago de
-- divulgación deliberado anti front-running). La meta del snapshot (status/lag)
-- vive separada de los ítems. El sitio sólo expone el snapshot más reciente con
-- as_of <= hoy - lag.
CREATE TABLE IF NOT EXISTS fund_holdings_snapshot (
  as_of       TEXT    NOT NULL,           -- fecha de cartera 'YYYY-MM-DD' (clave natural)
  status      TEXT    NOT NULL DEFAULT 'live',  -- 'live' | 'hold'
  source      TEXT,                       -- 'admin' | 'email'
  message_id  TEXT,
  sender_hash TEXT,
  note        TEXT,
  ingested_at INTEGER NOT NULL,
  PRIMARY KEY (as_of)
) WITHOUT ROWID;

-- Línea de tenencia. weight_bps en puntos básicos (entero) para que la
-- validación "suma 100%" no tenga drift de punto flotante. Los colores NO se
-- guardan: se derivan en el componente por asset_class + sombra por rank.
CREATE TABLE IF NOT EXISTS fund_holdings_item (
  as_of       TEXT    NOT NULL,           -- FK → fund_holdings_snapshot.as_of
  ord         INTEGER NOT NULL,           -- orden de despliegue
  name        TEXT    NOT NULL,
  short       TEXT,                       -- etiqueta corta para la celda del treemap
  asset_class TEXT    NOT NULL,           -- 'RV' | 'RF' | 'Otros' (enum cerrado, validado en ingesta)
  weight_bps  INTEGER NOT NULL,
  PRIMARY KEY (as_of, name)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_fund_holdings_item_asof ON fund_holdings_item(as_of, ord);

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 2026-07-02: feed de Instagram. Un scheduled worker
-- (workers/instagram-ingest/) trae los últimos posteos por la API de Instagram
-- (Instagram Login), guarda la metadata acá y copia la imagen a R2 (bucket
-- INSTAGRAM_MEDIA) porque las URLs del CDN de Instagram expiran; el sitio los lee
-- por /api/instagram y sirve las imágenes same-origin por /api/instagram/media/[id].

-- Un posteo publicable. id = media id de Instagram. r2_key apunta al still en R2.
CREATE TABLE IF NOT EXISTS instagram_posts (
  id           TEXT    NOT NULL,                    -- media id de Instagram (clave natural)
  caption      TEXT,                                -- epígrafe (conserva saltos de línea)
  permalink    TEXT    NOT NULL,                    -- URL pública del posteo en Instagram
  media_type   TEXT    NOT NULL,                    -- 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  taken_at     TEXT    NOT NULL,                    -- timestamp original ISO8601 (para mostrar)
  taken_at_ms  INTEGER NOT NULL,                    -- epoch ms del posteo (para ordenar)
  r2_key       TEXT    NOT NULL,                    -- key del still en R2 (bucket INSTAGRAM_MEDIA)
  content_type TEXT,                                -- mime del still ('image/jpeg')
  status       TEXT    NOT NULL DEFAULT 'live',     -- 'live' | 'hold'
  updated_at   INTEGER NOT NULL,                    -- Date.now() del último refresco de la fila
  PRIMARY KEY (id)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_instagram_posts_order ON instagram_posts(status, taken_at_ms);

-- Token de acceso (Instagram Login), fila ÚNICA (id = 1). Se siembra a mano y el
-- worker lo refresca in situ (el refresh genera un token nuevo y un worker no
-- puede reescribir su propio secret; por eso el token vive en D1, no en un secret).
CREATE TABLE IF NOT EXISTS instagram_auth (
  id           INTEGER NOT NULL,                    -- siempre 1 (fila única)
  access_token TEXT    NOT NULL,
  expires_at   INTEGER NOT NULL,                    -- epoch ms de vencimiento del token largo
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (id),
  CHECK (id = 1)
) WITHOUT ROWID;

-- Auditoría compacta del cron (sync / refresh de token / prune), append-only.
CREATE TABLE IF NOT EXISTS instagram_audit (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       INTEGER NOT NULL,
  action   TEXT    NOT NULL,                        -- 'sync' | 'refresh_token' | 'prune'
  decision TEXT    NOT NULL,                        -- 'ok' | 'error' | 'noop'
  detail   TEXT
);

CREATE INDEX IF NOT EXISTS idx_instagram_audit_ts ON instagram_audit(ts);

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 2026-07-03: suscriptores del newsletter de la casa. Alta desde
-- /informes (y donde se monte el bloque) vía /api/newsletter. Etapa 1 = SOLO
-- recolección: el envío de campañas se enchufa después sin tocar esta tabla. Opt-in
-- simple con consentimiento expreso (Ley 18.331, Art. 9): se guarda la marca y el
-- TEXTO aceptado como prueba. email en minúsculas (índice único) → el re-alta es
-- un UPSERT idempotente que reactiva en vez de duplicar. La baja
-- (status='unsubscribed') queda modelada para cuando arranque el envío.
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT    NOT NULL,                   -- normalizado a minúsculas
  ts              INTEGER NOT NULL,                   -- Date.now() del alta
  status          TEXT    NOT NULL DEFAULT 'active',  -- 'active' | 'unsubscribed'
  source          TEXT,                               -- página de origen, p.ej. 'informes'
  consent         INTEGER NOT NULL DEFAULT 1,         -- 1 = marcó la casilla de consentimiento
  consent_text    TEXT,                               -- texto exacto que aceptó (prueba Art. 9)
  ip_hash         TEXT,                               -- hash corto del alta, nunca la IP cruda
  unsubscribed_at INTEGER                             -- Date.now() de la baja, NULL mientras activo
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_ts ON newsletter_subscribers(ts);

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 2026-07-04: panel de administración de empleados (login propio +
-- TOTP obligatorio + permisos por sección). Usuarios/sesiones/auditoría del
-- panel, flags de visibilidad de módulos, informes administrables y documentos
-- del fondo. Las escriben SOLO las rutas /api/admin/panel/* (cookie de sesión);
-- las leen el panel /admin, la lista /informes, el proxy de PDFs y los
-- data-APIs públicos que respetan site_flags. Detalle y seeds en
-- db/migrations/2026-07-04-panel-admin.sql.

-- password_hash autodescriptivo ('pbkdf2-sha256$<iters>$<salt>$<dk>') — subir
-- el costo no exige migrar (re-hash en el próximo login). totp_secret CIFRADO
-- (AES-GCM con clave derivada de PANEL_PEPPER): un dump de la DB sola no
-- entrega contraseñas ni seeds. perms = CSV ⊆ {informes,fondo,secciones};
-- 'admin' implica todo + gestión de usuarios.
CREATE TABLE IF NOT EXISTS admin_users (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  email                   TEXT    NOT NULL,              -- minúsculas
  nombre                  TEXT    NOT NULL,
  password_hash           TEXT    NOT NULL,
  must_change_password    INTEGER NOT NULL DEFAULT 0,
  password_changed_at     INTEGER,
  totp_secret             TEXT,                          -- 'enc$..$..' | NULL = no enrolado
  totp_pending_secret     TEXT,                          -- ídem, durante el enrolamiento
  totp_pending_created_at INTEGER,
  totp_enrolled_at        INTEGER,
  totp_last_step          INTEGER NOT NULL DEFAULT 0,    -- anti-replay RFC 6238
  role                    TEXT    NOT NULL DEFAULT 'editor' CHECK (role IN ('admin','editor')),
  perms                   TEXT    NOT NULL DEFAULT '',
  status                  TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at              INTEGER NOT NULL,
  created_by              TEXT,
  updated_at              INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- Sesiones: la DB guarda SOLO el SHA-256 hex del token de la cookie. Doble
-- vencimiento (absoluto + inactividad). scope='setup' = restringida al primer
-- acceso (clave temporal + enrolamiento TOTP).
CREATE TABLE IF NOT EXISTS admin_sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash   TEXT    NOT NULL,
  user_id      INTEGER NOT NULL,
  scope        TEXT    NOT NULL DEFAULT 'full' CHECK (scope IN ('setup','full')),
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  ip_hash      TEXT,
  user_agent   TEXT,
  revoked_at   INTEGER                                   -- NULL = viva
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id, revoked_at);

-- Auditoría append-only de toda mutación del panel y todo intento de login
-- (calcada de fund_audit). Nunca se borra ni se actualiza.
CREATE TABLE IF NOT EXISTS admin_audit (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,
  actor_id    INTEGER,           -- NULL en logins fallidos / setup
  actor_email TEXT,
  ip_hash     TEXT,
  section     TEXT    NOT NULL,  -- 'auth' | 'informes' | 'fondo' | 'secciones' | 'usuarios'
  action      TEXT    NOT NULL,  -- 'login'|'logout'|'setup'|'create'|'update'|'upload'|'toggle'|
                                 -- 'nav'|'override'|'backfill'|'holdings'|'reset_password'|
                                 -- 'reset_totp'|'enroll_totp'|'change_password'|'denied'
  target      TEXT,
  decision    TEXT    NOT NULL,  -- 'ok' | 'denied' | 'rejected' | 'error'
  detail      TEXT               -- JSON corto saneado; jamás passwords/secrets/tokens
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_ts    ON admin_audit(ts);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit(actor_email, ts);

-- Flags de visibilidad. Vocabulario cerrado en código (lib/flags.ts); sin fila
-- rige el default del código (OFF). Enforcement en los data-APIs, no en las
-- páginas (que siguen estáticas).
CREATE TABLE IF NOT EXISTS site_flags (
  key        TEXT    NOT NULL,
  enabled    INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (key)
) WITHOUT ROWID;

-- Informes publicados (la lista /informes y el proxy PDF leen de acá; los
-- artículos curados siguen en código). pdf_url (histórico externo) O r2_key
-- (subido a R2); la regla "no live sin PDF" la aplica el código — sin CHECK a
-- propósito, porque el flujo real es crear la fila y subir el PDF después.
CREATE TABLE IF NOT EXISTS informes (
  slug        TEXT    NOT NULL,              -- 'mensual-YYYY-MM' | 'semanal-YYYY-MM-DD'
  fecha       TEXT    NOT NULL,              -- ISO 'YYYY-MM-DD'
  fecha_texto TEXT    NOT NULL,
  titulo      TEXT    NOT NULL,
  categoria   TEXT    NOT NULL CHECK (categoria IN ('Mensual','Semanal')),
  pdf_url     TEXT,
  r2_key      TEXT,
  video_id    TEXT,                          -- sólo mensuales
  status      TEXT    NOT NULL DEFAULT 'hold' CHECK (status IN ('live','hold')),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  updated_by  TEXT,
  PRIMARY KEY (slug)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_informes_order ON informes(status, fecha);

-- Documentos regulatorios del fondo. Uno VIGENTE por tipo; cada upload escribe
-- una key nueva con timestamp (las versiones viejas quedan en R2 para rollback
-- manual). Vacía ⇒ el sitio cae al fallback "Solicitar" → /contacto.
CREATE TABLE IF NOT EXISTS fondo_documentos (
  tipo        TEXT    NOT NULL CHECK (tipo IN ('ficha-tecnica','datos-fundamentales','reglamento','informe-cartera')),
  titulo      TEXT    NOT NULL,
  descripcion TEXT,
  r2_key      TEXT    NOT NULL,
  content_len INTEGER,
  status      TEXT    NOT NULL DEFAULT 'live' CHECK (status IN ('live','hold')),
  updated_at  INTEGER NOT NULL,
  updated_by  TEXT    NOT NULL,
  PRIMARY KEY (tipo)
) WITHOUT ROWID;
