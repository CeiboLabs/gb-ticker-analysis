-- BNG Selección Global — snapshot de tenencias (detalle por instrumento).
--
-- Dato REAL provisto por el cliente (planilla del 30-jul-2026): 8 tenencias
-- nombradas + el residual. Σ = 10.000 bps (100%).
--
-- ⚠️ La fecha del snapshot es 5-ago-2026 por pedido del cliente (5-ago; antes
-- estuvo en 4-ago y, antes de eso, en la foto del 28-jul). Es la fecha que la
-- página muestra al pie del gráfico ("Composición al …"), así que tiene que ser
-- la del dato que pasó el cliente y no la del día en que se cargó. Consecuencia
-- del filtro `as_of <= hoy` de readLatestHoldings: el snapshot NO se publica
-- antes de esa fecha; hasta entonces la sección de tenencias no se dibuja.
--   RV 3.250 bps (32,5%) · RF 2.000 bps (20%) · ALT 750 bps (7,5%) · OTROS 4.000 bps (40%)
--
-- ⚠️ Esta pasada REEMPLAZA la lista de 17 líneas que traía el seed anterior: el
-- cliente pasó a divulgar sólo las mayores tenencias y a cerrar el 100% con un
-- "Otros". Ese "Otros" NO es una clase de activo — es el tramo de cartera que no
-- se abre por instrumento (clase 'OTROS', ver HoldingItem en lib/fondo.ts).
--
-- La línea del residual SE CARGA IGUAL aunque la página no la dibuje. Es lo que
-- hace que el snapshot siga siendo un registro del 100% de la cartera, que la
-- validación Σ=10.000 bps del panel (HoldingsSchema) siga siendo un control real,
-- y que <FondoTenencias /> pueda decir con verdad qué porcentaje de la cartera
-- cubre el gráfico. Si se borra, el sitio pierde esa nota y el panel deja de
-- poder distinguir una cartera incompleta de una mal cargada.
--
-- Consecuencias a tener presentes:
--   · El gráfico DIBUJA el residual, con su área verdadera: el treemap y el
--     donut afirman "esto es la cartera entera", así que repartir el marco sólo
--     entre las 8 nombradas mostraba la cartera más concentrada de lo que es.
--     (Así estuvo el 30-jul; se revirtió el 31 — el porqué largo vive en el
--     encabezado de components/institucional/FondoTenencias.tsx.)
--   · Se cayó la barra de split por clase: con el 40% sin clasificar no hay
--     versión que se sostenga. Vuelve si el cliente pasa el split de ese tramo.
--
-- Los pesos van en basis points ENTEROS: la cartera se mueve de a medio punto
-- (250 bps = 2,5%) y en porcentaje flotante la suma no cerraría en 100.
--
-- ⚠️ Esto es un seed para desarrollo. En producción el snapshot se carga por el
-- panel de empleados (/admin/fondo → Tenencias), que valida con HoldingsSchema
-- y deja auditoría. El sitio publica el snapshot más reciente con
-- as_of <= hoy − HOLDINGS_LAG_DAYS (lib/fondoStore.ts): ese rezago está en 0
-- mientras el Fondo no opere, así que esta cartera se ve el mismo día.
-- Cuando vuelva a 30, un snapshot con fecha de hoy NO se publica hasta pasado
-- el mes.
--
-- Aplicar (home server):  sqlite3 data/bengochea.sqlite3 < db/seeds/fondo-holdings.sql
-- Aplicar (D1):           npx wrangler d1 execute <base> --file=db/seeds/fondo-holdings.sql
--
-- Sin BEGIN/COMMIT a propósito: D1 rechaza las transacciones explícitas
-- ("use the state.storage.transaction() APIs instead"). En D1 la atomicidad la
-- da el batch del propio `d1 execute --file`; por sqlite3 cada statement va
-- suelto, y si algo falla entre el DELETE y el INSERT alcanza con re-aplicar —
-- el seed es idempotente de punta a punta.

-- Fechas superadas. Este mismo snapshot ya estuvo cargado como '2026-07-28' (la
-- versión commiteada) y como '2026-08-04' (la pasada del 3-ago). Donde alguno de
-- esos seeds se haya aplicado, esas filas siguen en la base y con status 'live'.
-- Hoy no cambian lo que se ve —readLatestHoldings toma el as_of más alto— pero
-- dejan al panel listando composiciones que ya no existen, y a cualquiera que
-- baje el rezago mirando una cartera vieja. Se borran acá para que re-aplicar el
-- seed deje UNA sola composición, que es lo que este archivo promete.
DELETE FROM fund_holdings_item     WHERE as_of IN ('2026-07-28', '2026-08-04');
DELETE FROM fund_holdings_snapshot WHERE as_of IN ('2026-07-28', '2026-08-04');

INSERT INTO fund_holdings_snapshot (as_of, status, source, note, ingested_at)
VALUES ('2026-08-05', 'live', 'admin', 'Mayores tenencias + resto no detallado', unixepoch() * 1000)
ON CONFLICT(as_of) DO UPDATE SET
  status = 'live', source = 'admin', note = excluded.note, ingested_at = excluded.ingested_at;

DELETE FROM fund_holdings_item WHERE as_of = '2026-08-05';

-- El orden es el de la planilla del cliente (peso descendente); el residual va
-- último. El componente reordena para el donut y la leyenda; el treemap usa el
-- orden por peso.
INSERT INTO fund_holdings_item (as_of, ord, name, short, asset_class, weight_bps) VALUES
  ('2026-08-05', 0, 'Jupiter Merian World Equity Fund',                  'Jupiter World Equity',  'RV',    1000),
  ('2026-08-05', 1, 'Thornburg Equity Income Builder Fund',              'Thornburg Eq. Income',  'RV',    1000),
  ('2026-08-05', 2, 'Invesco QQQ Trust Series 1',                        'Invesco QQQ',           'RV',     750),
  ('2026-08-05', 3, 'Muzinich Enhancedyield Short-Term Fund',            'Muzinich Short-Term',   'RF',     750),
  ('2026-08-05', 4, 'Man Global Investment Grade Opportunities DYV',     'Man Global IG Opps.',   'RF',     750),
  -- 'Jupiter Abs. Return' y no 'Jupiter Global Eq. AR': con el residual dibujado
  -- las celdas nombradas ocupan el 60% del marco y en el treemap en retrato esta
  -- entra en dos renglones de ~11 caracteres. La abreviatura anterior se cortaba
  -- en "Jupiter Global Eq…"; ésta conserva justo lo que explica por qué la línea
  -- es ALT (absolute return) y la distingue del otro Jupiter, que es RV.
  ('2026-08-05', 5, 'Jupiter Merian Global Equity Absolute Return Fund', 'Jupiter Abs. Return',  'ALT',    750),
  ('2026-08-05', 6, 'MFS Meridian Funds — Contrarian Value Fund',        'MFS Contrarian Value',  'RV',     500),
  ('2026-08-05', 7, 'Vontobel Fund — Credit Opportunities',              'Vontobel Credit Opps.', 'RF',     500),
  ('2026-08-05', 8, 'Otros',                                            'Otros',                 'OTROS', 4000);
