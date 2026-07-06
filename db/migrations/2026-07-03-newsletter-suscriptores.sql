-- Suscriptores del newsletter de la casa — alta desde /informes (y donde se
-- monte el bloque). Versión "crear todo" (idempotente: sólo CREATE ... IF NOT
-- EXISTS, sin ALTER).
--
-- Etapa 1: SOLO recolección. El sitio da de alta acá vía /api/newsletter; el
-- envío de campañas (Resend/otro) se enchufa después sin tocar esta tabla ni el
-- frontend. Opt-in simple con consentimiento expreso (Ley 18.331, Art. 9): se
-- guarda la marca de consentimiento y el TEXTO que la persona aceptó como prueba.
-- La baja (status='unsubscribed') queda modelada para cuando arranque el envío.
-- Misma base D1 que el resto (ticker-metrics).
--
-- Aplicar con --command (mismo gotcha que las migraciones del fondo/Instagram:
-- --file --remote usa el API de import y puede fallar con "Authentication error
-- [code: 10000]" en tokens OAuth viejos):
--   npx wrangler d1 execute ticker-metrics --remote --command="$(cat db/migrations/2026-07-03-newsletter-suscriptores.sql)"
--   npx wrangler d1 execute ticker-metrics --local  --command="$(cat db/migrations/2026-07-03-newsletter-suscriptores.sql)"

-- Un suscriptor. email en minúsculas (clave natural, vía índice único) para que
-- el re-alta sea idempotente: ON CONFLICT reactiva en vez de duplicar. consent
-- guarda que marcó la casilla; consent_text, la versión del texto que aceptó
-- (prueba del consentimiento, no reconstruible si el copy cambia). ip_hash es el
-- hash corto del alta (mismo criterio que contact_messages), nunca la IP cruda.
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

-- Un mail = a lo sumo una fila. Habilita el UPSERT idempotente del re-alta.
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);
-- Orden cronológico para exportar la lista / auditar altas.
CREATE INDEX IF NOT EXISTS idx_newsletter_ts ON newsletter_subscribers(ts);
