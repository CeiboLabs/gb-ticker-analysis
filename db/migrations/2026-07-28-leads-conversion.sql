-- Embudo de /analisis → cliente. Dos piezas: el registro de QUÉ mira cada lead
-- y el CONTEXTO con el que llega un pedido de apertura de cuenta.
--
-- POR QUÉ EXISTE: el peaje del análisis ya captura correos
-- (newsletter_subscribers, source='analisis'), pero un correo suelto no es un
-- lead — es un renglón. "juan@… miró NVDA, MELI y AAPL, volvió tres veces en
-- diez días" sí lo es, y ese dato ya pasaba por el servidor y se tiraba. La
-- mesa necesita saber a quién llamar y de qué hablarle.
--
-- DATO PERSONAL: esto es actividad atada a una persona identificada, así que la
-- finalidad se declara en el texto de consentimiento que se sella en cada alta
-- (lib/newsletterConsent.ts, Ley 18.331 Art. 9). Si cambia el alcance de lo que
-- se guarda acá, cambia ese texto ANTES. La base va declarada ante la URCDP
-- junto con newsletter_subscribers.
--
-- Aplicar con --command (mismo gotcha que las demás: --file --remote usa el API
-- de import y falla con "Authentication error [code: 10000]" en tokens viejos):
--   npx wrangler d1 execute ticker-metrics --local  --command="$(cat db/migrations/2026-07-28-leads-conversion.sql)"
--   npx wrangler d1 execute ticker-metrics --remote --command="$(cat db/migrations/2026-07-28-leads-conversion.sql)"

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Actividad del lead
-- ─────────────────────────────────────────────────────────────────────────────
-- Una fila por consulta identificada. Se escribe SÓLO cuando la cookie del
-- leadGate trae un correo válido: el tráfico anónimo no deja rastro acá (para
-- eso está ticker_views, que es agregado y sin persona).
--
-- Log de eventos y no contador agregado a propósito: "volvió tres veces en diez
-- días" es la señal comercial, y un UPSERT con `veces` la perdería. El panel
-- agrega al leer, que es barato con los índices de abajo.
--
-- kind distingue la naturaleza de la visita, porque no valen lo mismo:
--   · 'fresh' — mandó a generar un análisis nuevo (máxima intención, cuesta plata)
--   · 'cache' — leyó uno ya hecho
-- El vocabulario es cerrado del lado de la app (lib/leadStore.ts).
CREATE TABLE IF NOT EXISTS lead_activity (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  email  TEXT    NOT NULL,  -- minúsculas, misma clave natural que newsletter_subscribers
  ticker TEXT    NOT NULL,  -- mayúsculas, como en analyze_events
  ts     INTEGER NOT NULL,  -- Date.now() de la consulta
  kind   TEXT    NOT NULL   -- 'fresh' | 'cache'
);

-- La consulta del panel: actividad de una persona, más reciente primero.
CREATE INDEX IF NOT EXISTS idx_lead_activity_email ON lead_activity(email, ts);
-- La consulta inversa: quién viene mirando este ticker (para cuando la mesa
-- quiera trabajar un nombre puntual).
CREATE INDEX IF NOT EXISTS idx_lead_activity_ticker ON lead_activity(ticker, ts);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Contexto del pedido de contacto
-- ─────────────────────────────────────────────────────────────────────────────
-- De dónde salió el pedido: hoy, el ticker que la persona estaba leyendo cuando
-- pidió abrir cuenta desde el informe (motivo 'cuenta-analisis'). NULL en los
-- mensajes del formulario general de /contacto, que no tienen contexto.
--
-- SQLite no tiene ADD COLUMN IF NOT EXISTS: si la columna ya está, esta línea
-- tira "duplicate column name: contexto" y se ignora sin romper nada (el resto
-- del archivo ya corrió). Es el único statement no idempotente del archivo, y
-- va último por eso.
ALTER TABLE contact_messages ADD COLUMN contexto TEXT;
