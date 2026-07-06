-- Seam de datos del feed de Instagram — versión "crear todo" (idempotente:
-- sólo CREATE ... IF NOT EXISTS, sin ALTER).
--
-- Alimenta el módulo de Instagram del sitio: un scheduled worker
-- (workers/instagram-ingest/) trae los últimos posteos por la API de Instagram
-- (Instagram Login), guarda la metadata acá y copia la imagen a R2, y el sitio
-- los lee por /api/instagram. Misma base D1 que el resto (ticker-metrics).
--
-- Aplicar con --command (mismo gotcha que la migración del fondo: --file --remote
-- usa el API de import y puede fallar con "Authentication error [code: 10000]"
-- en tokens OAuth viejos):
--   npx wrangler d1 execute ticker-metrics --remote --command="$(cat db/migrations/2026-07-02-instagram-feed.sql)"
--   npx wrangler d1 execute ticker-metrics --local  --command="$(cat db/migrations/2026-07-02-instagram-feed.sql)"

-- Un posteo publicable. id = media id de Instagram (clave natural). La imagen NO
-- vive acá: se copia a R2 (r2_key) porque las URLs del CDN de Instagram son
-- temporales y expiran. status habilita ocultar un posteo sin DELETE. El sitio
-- ordena por taken_at_ms DESC y toma los primeros N.
CREATE TABLE IF NOT EXISTS instagram_posts (
  id           TEXT    NOT NULL,                    -- media id de Instagram
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

-- Token de acceso (Instagram Login), fila ÚNICA (id = 1). Se siembra a mano una
-- vez (ver RUNBOOK) y el worker lo refresca in situ: el refresh genera un token
-- NUEVO y un worker no puede reescribir su propio secret, así que el token vive
-- acá en D1, no en un secret.
CREATE TABLE IF NOT EXISTS instagram_auth (
  id           INTEGER NOT NULL,                    -- siempre 1 (fila única)
  access_token TEXT    NOT NULL,
  expires_at   INTEGER NOT NULL,                    -- epoch ms de vencimiento del token largo
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (id),
  CHECK (id = 1)
) WITHOUT ROWID;

-- Auditoría compacta del cron (sync / refresh de token / prune): para depurar
-- sin depender de los logs efímeros del worker. Append-only.
CREATE TABLE IF NOT EXISTS instagram_audit (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       INTEGER NOT NULL,                        -- Date.now() del evento
  action   TEXT    NOT NULL,                        -- 'sync' | 'refresh_token' | 'prune'
  decision TEXT    NOT NULL,                        -- 'ok' | 'error' | 'noop'
  detail   TEXT                                     -- saneado y truncado
);

CREATE INDEX IF NOT EXISTS idx_instagram_audit_ts ON instagram_audit(ts);
