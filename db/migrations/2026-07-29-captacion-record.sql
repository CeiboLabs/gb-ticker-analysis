-- Estrategia de captación de /analisis. Cuatro piezas en una sola migración
-- porque se estrenan juntas y ninguna sirve sola.
--
-- LA IDEA: el cuello de botella de la herramienta no es la falta de un CTA, es
-- que nunca hizo una afirmación que pueda defender —su propio aviso legal dice
-- que la escribió un modelo y que no la revisó nadie—. Pero la casa YA midió su
-- análisis (scripts/backtest/out/backtest-2026-07-19-20-15): 122 veredictos, y
-- el orden BUY > HOLD > AVOID se sostiene contra el S&P 500. Estas tablas
-- sirven para publicar esa medición, y para que la herramienta pase de documento
-- huérfano a nota de cobertura con continuidad.
--
-- Aplicar con --command (mismo gotcha que las demás: --file --remote usa el API
-- de import y falla con "Authentication error [code: 10000]" en tokens viejos):
--   npx wrangler d1 execute ticker-metrics --local  --command="$(cat db/migrations/2026-07-29-captacion-record.sql)"
--   npx wrangler d1 execute ticker-metrics --remote --command="$(cat db/migrations/2026-07-29-captacion-record.sql)"
-- En el home server, directo:  sqlite3 data/bengochea.sqlite3 < <este archivo>

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Retorno realizado por veredicto — el sustrato del récord público
-- ─────────────────────────────────────────────────────────────────────────────
-- Una fila por veredicto de verdict_log, con lo que pasó DESPUÉS. Es cache
-- derivado: se puede truncar y se reconstruye (lib/recordStore.ts). Por eso no
-- lleva FK: verdict_log es append-only y jamás borra, así que el id no se queda
-- colgado, y una FK obligaría a recrear la tabla si algún día se re-siembra.
--
-- El método replica EXACTAMENTE el del backtest, para que el número publicado
-- sea el mismo que el medido: retorno total sobre serie AJUSTADA (adjclose, o
-- sea con dividendos reinvertidos), menos el retorno del S&P 500 en la MISMA
-- ventana. El exceso, no el retorno bruto, es la afirmación: "le ganó al índice".
--
-- matured_6m / matured_12m distinguen la ventana CERRADA del mark-to-market. Un
-- veredicto de hace dos meses tiene un exceso "a 6 meses" que todavía no
-- terminó; publicarlo mezclado con los cerrados sería inflar la muestra. El
-- récord publica sólo los maduros y dice cuántos hay abiertos.
--
-- SI YA CORRISTE UNA VERSIÓN ANTERIOR DE ESTE ARCHIVO: las dos tablas de récord
-- son cache derivado, así que la forma de actualizarlas es tirarlas y rehacerlas.
-- Estas dos líneas son seguras (no hay dato original acá) y necesarias, porque el
-- CREATE de abajo es IF NOT EXISTS y no altera una tabla que ya exista:
DROP TABLE IF EXISTS record_agg;
DROP TABLE IF EXISTS verdict_return;

CREATE TABLE IF NOT EXISTS verdict_return (
  verdict_id   INTEGER PRIMARY KEY,  -- = verdict_log.id
  ticker       TEXT    NOT NULL,
  rating       TEXT    NOT NULL,     -- copiado de verdict_log para agregar sin join
  verdict_day  TEXT    NOT NULL,     -- 'YYYY-MM-DD' del veredicto
  price_at     REAL,                 -- cierre ajustado del día del veredicto

  -- Lo que hizo la acción contra el índice (la parte que SÍ funciona)
  ret_6m       REAL,                 -- retorno total del ticker (fracción, 0.065 = +6,5 %)
  spy_6m       REAL,                 -- retorno del S&P 500 en la misma ventana
  excess_6m    REAL,                 -- ret_6m - spy_6m
  ret_12m      REAL,
  spy_12m      REAL,
  excess_12m   REAL,
  matured_6m   INTEGER NOT NULL DEFAULT 0,  -- 1 = pasaron 6 meses desde el veredicto
  matured_12m  INTEGER NOT NULL DEFAULT 0,

  -- Lo que el precio objetivo pronosticó, y lo que pasó (la parte que NO funciona).
  -- Se mide en vivo y no se cita el PDF de julio: si la estrategia es publicar los
  -- límites, esos límites tienen que envejecer con el producto. El backtest midió
  -- MAE 22,8 % a 6m y el precio real dentro del rango bull-bear sólo el 43 % de
  -- las veces; acá eso se recalcula solo.
  target_at    REAL,                 -- verdict.priceTarget del veredicto
  bull_at      REAL,
  bear_at      REAL,
  actual_6m    REAL,                 -- precio efectivo al cierre de la ventana
  actual_12m   REAL,
  abs_err_6m   REAL,                 -- |target/actual - 1|
  abs_err_12m  REAL,
  dir_ok_6m    INTEGER,              -- 1 = el target acertó la DIRECCIÓN del movimiento
  dir_ok_12m   INTEGER,
  in_range_6m  INTEGER,              -- 1 = el precio real cayó entre bear y bull
  in_range_12m INTEGER,
  up_6m        INTEGER,              -- 1 = la acción efectivamente subió (baseline trivial)
  up_12m       INTEGER,

  computed_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verdict_return_rating ON verdict_return(rating, matured_6m);
CREATE INDEX IF NOT EXISTS idx_verdict_return_ticker ON verdict_return(ticker, verdict_day);

-- Precisión del precio objetivo, agregada. Va en tabla aparte de record_agg
-- porque no se corta por rating: es una sola medición por horizonte.
--
-- baseline_dir_rate es la clave de lectura y no puede faltar: es el acierto de
-- direccion del pronóstico trivial "siempre sube". Si el target acierta 48 % y el
-- baseline 73 %, el target no sólo es impreciso — es PEOR que no pronosticar. Sin
-- ese número al lado, un 48 % suena a moneda al aire cuando en realidad es peor.
CREATE TABLE IF NOT EXISTS record_target_agg (
  horizon           TEXT    NOT NULL PRIMARY KEY,  -- '6m' | '12m'
  n                 INTEGER NOT NULL,
  mae               REAL,          -- error absoluto medio del target, en fracción
  dir_rate          REAL,          -- acierto de dirección del target
  baseline_dir_rate REAL,          -- acierto de "siempre sube" en la misma muestra
  in_range_n        INTEGER NOT NULL,
  in_range_rate     REAL,          -- fracción con el precio real dentro del rango bear-bull
  computed_at       INTEGER NOT NULL
) WITHOUT ROWID;

-- Agregados publicados + marca del último recómputo. Una fila por (horizonte,
-- rating) más filas 'ALL'. Se lee en cada visita a la página del récord, así que
-- tiene que salir de acá y no de un recálculo: el cómputo pide una serie diaria
-- por ticker a Yahoo (~53 llamadas) y eso no puede colgar de un request.
CREATE TABLE IF NOT EXISTS record_agg (
  horizon     TEXT    NOT NULL,   -- '6m' | '12m'
  rating      TEXT    NOT NULL,   -- 'BUY' | 'HOLD' | 'AVOID' | 'ALL'
  n           INTEGER NOT NULL,   -- veredictos MADUROS en la celda
  n_open      INTEGER NOT NULL,   -- abiertos (ventana sin cerrar), sólo para declararlos
  excess_med  REAL,               -- mediana del exceso
  excess_avg  REAL,
  win_rate    REAL,              -- fracción que le ganó al índice (BUY/HOLD) o le perdió (AVOID)
  computed_at INTEGER NOT NULL,
  PRIMARY KEY (horizon, rating)
) WITHOUT ROWID;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Seguimiento de acciones — la continuidad que la nota promete
-- ─────────────────────────────────────────────────────────────────────────────
-- Quién sigue qué. La clave natural es (email, ticker): seguir dos veces es
-- idempotente y dejar de seguir es un DELETE.
--
-- last_seen_* es lo que habilita "cambió desde que lo viste" SIN mandar un mail:
-- se guarda el veredicto y el precio que la persona vio, y en la próxima visita
-- se comparan contra los de hoy. El correo, cuando exista el envío, lee lo mismo.
CREATE TABLE IF NOT EXISTS lead_follow (
  email             TEXT    NOT NULL,
  ticker            TEXT    NOT NULL,
  created_at        INTEGER NOT NULL,
  last_seen_verdict TEXT,              -- veredicto que vio la última vez
  last_seen_price   REAL,
  last_seen_at      INTEGER,
  PRIMARY KEY (email, ticker)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_lead_follow_ticker ON lead_follow(ticker);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Perfil del lead — lo que separa un cliente de un prospecto
-- ─────────────────────────────────────────────────────────────────────────────
-- Autodeclarado, y alcanza: lo único que decide es a QUIÉN va el aviso. Si dice
-- que es cliente, el llamado sale del asesor que ya lo atiende (y jamás se le
-- ofrece abrir una cuenta que ya tiene); si no, es un prospecto y lo trabaja la
-- mesa. Un impostor no gana nada declarándose cliente.
--
-- Separado de newsletter_subscribers a propósito: esa tabla es el registro de
-- consentimiento del newsletter (prueba legal, Ley 18.331) y no se le agregan
-- campos comerciales. Acá van los datos que el embudo va juntando de a uno
-- (perfilado progresivo): primero el correo, después el teléfono, después el
-- nombre — nunca todo junto en un formulario.
CREATE TABLE IF NOT EXISTS lead_profile (
  email      TEXT    PRIMARY KEY,
  es_cliente INTEGER NOT NULL DEFAULT 0,  -- 1 = declaró ser cliente de la casa
  nombre     TEXT,
  telefono   TEXT,
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Publicación del récord — DECIDIDO por el cliente el 2026-07-29
-- ─────────────────────────────────────────────────────────────────────────────
-- El récord nació detrás de un interruptor apagado porque publicarlo expone a la
-- casa de forma irreversible (se publica también que el precio objetivo acierta
-- la dirección MENOS que el pronóstico trivial "siempre sube"). El cliente tomó
-- la decisión: se publica. Esta línea deja /analisis/record en línea en cuanto
-- corre la migración, sin depender de que alguien se acuerde de prender el flag.
--
-- ON CONFLICT DO NOTHING y no un UPDATE: si más adelante lo apagan desde
-- /admin/secciones, re-correr la migración NO tiene que volver a prenderlo.
INSERT INTO site_flags (key, enabled, updated_at, updated_by)
VALUES ('record_publico', 1, 0, 'migracion-2026-07-29')
ON CONFLICT(key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4b. ÚLTIMO — el único statement no idempotente del archivo
-- ─────────────────────────────────────────────────────────────────────────────
-- El veredicto vigente al momento de la consulta. Con esto "qué cambió desde tu
-- última visita" funciona para CUALQUIER acción que la persona haya mirado, no
-- sólo las que sigue.
--
-- Va al final porque SQLite no tiene ADD COLUMN IF NOT EXISTS: en una base que
-- ya lo tenga, esta línea falla con "duplicate column name: verdict". Puesta
-- acá, todo lo de arriba ya corrió y el error es inocuo — misma convención que
-- db/migrations/2026-07-28-leads-conversion.sql. Si corrés el archivo con
-- `sqlite3 -bail`, esperá ese error en la segunda pasada.
ALTER TABLE lead_activity ADD COLUMN verdict TEXT;
