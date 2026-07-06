-- Panel de administración de empleados — usuarios, sesiones, auditoría, flags
-- de visibilidad, informes y documentos del fondo. Versión "crear todo"
-- (idempotente: CREATE ... IF NOT EXISTS + seeds con INSERT OR IGNORE).
--
-- Quién escribe acá: SOLO las rutas /api/admin/panel/* (cookie de sesión).
-- Quién lee: el panel /admin, la lista /informes, el proxy de PDFs y los
-- data-APIs públicos que respetan site_flags.
--
-- Aplicar con --command (mismo gotcha que las migraciones anteriores: --file
-- --remote usa el API de import y puede fallar con "Authentication error
-- [code: 10000]" en tokens OAuth viejos):
--   npx wrangler d1 execute ticker-metrics --remote --command="$(cat db/migrations/2026-07-04-panel-admin.sql)"
--   npx wrangler d1 execute ticker-metrics --local  --command="$(cat db/migrations/2026-07-04-panel-admin.sql)"

-- Un empleado con acceso al panel. password_hash es autodescriptivo
-- ('pbkdf2-sha256$<iters>$<salt_b64u>$<dk_b64u>'): las iteraciones viven en la
-- fila, así que subir/bajar el costo NO exige migrar (se re-hashea en el
-- próximo login). totp_secret va CIFRADO (AES-GCM con clave derivada de
-- PANEL_PEPPER, formato 'enc$<iv>$<ct>'): un dump de la DB sola no entrega ni
-- contraseñas ni seeds TOTP. perms es un CSV cerrado ⊆ {informes,fondo,
-- secciones}; el rol 'admin' implica todas las secciones + gestión de usuarios.
CREATE TABLE IF NOT EXISTS admin_users (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  email                   TEXT    NOT NULL,              -- normalizado a minúsculas
  nombre                  TEXT    NOT NULL,
  password_hash           TEXT    NOT NULL,
  must_change_password    INTEGER NOT NULL DEFAULT 0,    -- 1 = alta/reset con clave temporal
  password_changed_at     INTEGER,
  totp_secret             TEXT,                          -- 'enc$..$..' | NULL = no enrolado
  totp_pending_secret     TEXT,                          -- ídem, durante el enrolamiento (TTL 15 min)
  totp_pending_created_at INTEGER,
  totp_enrolled_at        INTEGER,
  totp_last_step          INTEGER NOT NULL DEFAULT 0,    -- último timestep TOTP usado (anti-replay RFC 6238)
  role                    TEXT    NOT NULL DEFAULT 'editor' CHECK (role IN ('admin','editor')),
  perms                   TEXT    NOT NULL DEFAULT '',
  status                  TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at              INTEGER NOT NULL,
  created_by              TEXT,                          -- email del admin que dio el alta | 'setup'
  updated_at              INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- Sesiones del panel. En la DB vive SOLO el SHA-256 hex del token de la cookie
-- (el token en claro jamás se persiste: robar la tabla no da sesiones). Doble
-- vencimiento: absoluto (expires_at) e inactividad (last_seen_at + idle, que
-- aplica el código). scope='setup' = sesión restringida al primer acceso
-- (cambio de clave temporal + enrolamiento TOTP); 'full' = panel completo.
CREATE TABLE IF NOT EXISTS admin_sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash   TEXT    NOT NULL,
  user_id      INTEGER NOT NULL,
  scope        TEXT    NOT NULL DEFAULT 'full' CHECK (scope IN ('setup','full')),
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  ip_hash      TEXT,                                     -- hash corto, nunca la IP cruda
  user_agent   TEXT,                                     -- truncado
  revoked_at   INTEGER                                   -- NULL = viva
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id, revoked_at);

-- Auditoría inmutable y append-only de TODA mutación del panel y de cada
-- intento de login (calcada de fund_audit). Nunca se borra ni se actualiza;
-- el volumen es ínfimo y el valor de compliance, alto.
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
  target      TEXT,              -- slug / email / tipo / flag / dia, según sección
  decision    TEXT    NOT NULL,  -- 'ok' | 'denied' | 'rejected' | 'error'
  detail      TEXT               -- JSON corto saneado; jamás passwords/secrets/tokens
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_ts    ON admin_audit(ts);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit(actor_email, ts);

-- Flags de visibilidad de módulos del sitio. El vocabulario de keys es CERRADO
-- y vive en código (lib/flags.ts, FLAG_DEFS); sin fila rige el default del
-- código (OFF). El enforcement corre en los data-APIs (/api/instagram,
-- /api/youtube, /api/fondo/documentos), no en las páginas — que siguen 100%
-- estáticas y se auto-ocultan cuando el API devuelve vacío.
CREATE TABLE IF NOT EXISTS site_flags (
  key        TEXT    NOT NULL,
  enabled    INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (key)
) WITHOUT ROWID;

-- Informes publicados. La lista /informes y el proxy de PDF leen de acá; los
-- ARTÍCULOS curados siguen en código (lib/informeContenido). El PDF vive en
-- una URL externa (pdf_url, histórico en gbengochea.com.uy) O subido a R2
-- (r2_key, bucket bengochea-docs). Sin CHECK "pdf_url OR r2_key" a propósito:
-- el flujo real es crear la fila y subir el PDF después — la regla "no se
-- publica (live) sin PDF" la aplica el código. status='hold' oculta el informe
-- de la lista y del proxy sin DELETE (default para las altas nuevas).
CREATE TABLE IF NOT EXISTS informes (
  slug        TEXT    NOT NULL,              -- 'mensual-YYYY-MM' | 'semanal-YYYY-MM-DD'
  fecha       TEXT    NOT NULL,              -- ISO 'YYYY-MM-DD' (ordena la lista)
  fecha_texto TEXT    NOT NULL,              -- '29 de mayo, 2026'
  titulo      TEXT    NOT NULL,
  categoria   TEXT    NOT NULL CHECK (categoria IN ('Mensual','Semanal')),
  pdf_url     TEXT,                          -- URL externa https (host allowlisted en código)
  r2_key      TEXT,                          -- key en R2 (bucket bengochea-docs), generada server-side
  video_id    TEXT,                          -- YouTube id del video que presenta el informe (sólo mensuales)
  status      TEXT    NOT NULL DEFAULT 'hold' CHECK (status IN ('live','hold')),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  updated_by  TEXT,                          -- email del empleado | 'seed'
  PRIMARY KEY (slug)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_informes_order ON informes(status, fecha);

-- Seed: las 7 entradas hardcodeadas de lib/informes.ts al momento de la
-- migración. INSERT OR IGNORE ⇒ re-aplicar la migración NUNCA pisa ediciones
-- hechas desde el panel.
INSERT OR IGNORE INTO informes (slug, fecha, fecha_texto, titulo, categoria, pdf_url, video_id, status, created_at, updated_at, updated_by) VALUES
  ('semanal-2026-05-29','2026-05-29','29 de mayo, 2026','Informe semanal · 29 de mayo','Semanal','https://gbengochea.com.uy/img/informes/GB INFORME SEMANAL 29-05-2026.pdf',NULL,'live',unixepoch()*1000,unixepoch()*1000,'seed'),
  ('semanal-2026-05-22','2026-05-22','22 de mayo, 2026','Informe semanal · 22 de mayo','Semanal','https://gbengochea.com.uy/img/informes/GB INFORME SEMANAL 22-05-2026.pdf',NULL,'live',unixepoch()*1000,unixepoch()*1000,'seed'),
  ('mensual-2026-05','2026-05-18','18 de mayo, 2026','Informe mensual · Mayo 2026','Mensual','https://gbengochea.com.uy/img/informes/Bengochea Inversiones - Informe mensual Mayo 2026.pdf','mWJ8df43m34','live',unixepoch()*1000,unixepoch()*1000,'seed'),
  ('semanal-2026-05-15','2026-05-15','15 de mayo, 2026','Informe semanal · 15 de mayo','Semanal','https://gbengochea.com.uy/img/informes/GB INFORME SEMANAL 15-05-2026.pdf',NULL,'live',unixepoch()*1000,unixepoch()*1000,'seed'),
  ('semanal-2026-05-11','2026-05-11','11 de mayo, 2026','Informe semanal · 11 de mayo','Semanal','https://gbengochea.com.uy/img/informes/GB INFORME SEMANAL 11-05-2026.pdf',NULL,'live',unixepoch()*1000,unixepoch()*1000,'seed'),
  ('semanal-2026-04-24','2026-04-24','24 de abril, 2026','Informe semanal · 24 de abril','Semanal','https://gbengochea.com.uy/img/informes/GB INFORME SEMANAL 24-04-2026.pdf',NULL,'live',unixepoch()*1000,unixepoch()*1000,'seed'),
  ('semanal-2026-04-20','2026-04-20','20 de abril, 2026','Informe semanal · 20 de abril','Semanal','https://gbengochea.com.uy/img/informes/GB INFORME SEMANAL 20-04-2026.pdf',NULL,'live',unixepoch()*1000,unixepoch()*1000,'seed');

-- Documentos regulatorios del fondo (hoy la sección linkea a /contacto). Un
-- documento VIGENTE por tipo; cada upload escribe una key nueva con timestamp
-- (las versiones anteriores quedan en R2 para rollback manual). Vacía hasta que
-- el panel suba el primero — el sitio cae al fallback "Solicitar".
CREATE TABLE IF NOT EXISTS fondo_documentos (
  tipo        TEXT    NOT NULL CHECK (tipo IN ('ficha-tecnica','datos-fundamentales','reglamento','informe-cartera')),
  titulo      TEXT    NOT NULL,
  descripcion TEXT,
  r2_key      TEXT    NOT NULL,
  content_len INTEGER,                       -- bytes del PDF subido
  status      TEXT    NOT NULL DEFAULT 'live' CHECK (status IN ('live','hold')),
  updated_at  INTEGER NOT NULL,
  updated_by  TEXT    NOT NULL,
  PRIMARY KEY (tipo)
) WITHOUT ROWID;
