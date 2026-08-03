-- BNG Selección Global — snapshot de tenencias (detalle por instrumento).
--
-- Dato REAL provisto por el cliente (planilla del 30-jul-2026): 8 tenencias
-- nombradas + el residual. Σ = 10.000 bps (100%).
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
-- Consecuencias a tener presentes, decididas con el cliente el 30-jul-2026:
--   · El gráfico EXCLUYE el residual y normaliza: las etiquetas dicen el peso
--     real sobre la cartera, pero el área es relativa entre las 8 mostradas.
--     La nota al pie de la sección declara ese alcance.
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

INSERT INTO fund_holdings_snapshot (as_of, status, source, note, ingested_at)
VALUES ('2026-07-28', 'live', 'admin', 'Mayores tenencias + resto no detallado', unixepoch() * 1000)
ON CONFLICT(as_of) DO UPDATE SET
  status = 'live', source = 'admin', note = excluded.note, ingested_at = excluded.ingested_at;

DELETE FROM fund_holdings_item WHERE as_of = '2026-07-28';

-- El orden es el de la planilla del cliente (peso descendente); el residual va
-- último. El componente reordena para el donut y la leyenda; el treemap usa el
-- orden por peso.
INSERT INTO fund_holdings_item (as_of, ord, name, short, asset_class, weight_bps) VALUES
  ('2026-07-28', 0, 'Jupiter Merian World Equity Fund',                  'Jupiter World Equity',  'RV',    1000),
  ('2026-07-28', 1, 'Thornburg Equity Income Builder Fund',              'Thornburg Eq. Income',  'RV',    1000),
  ('2026-07-28', 2, 'Invesco QQQ Trust Series 1',                        'Invesco QQQ',           'RV',     750),
  ('2026-07-28', 3, 'Muzinich Enhancedyield Short-Term Fund',            'Muzinich Short-Term',   'RF',     750),
  ('2026-07-28', 4, 'Man Global Investment Grade Opportunities DYV',     'Man Global IG Opps.',   'RF',     750),
  -- 'Jupiter Abs. Return' y no 'Jupiter Global Eq. AR': con el residual dibujado
  -- las celdas nombradas ocupan el 60% del marco y en el treemap en retrato esta
  -- entra en dos renglones de ~11 caracteres. La abreviatura anterior se cortaba
  -- en "Jupiter Global Eq…"; ésta conserva justo lo que explica por qué la línea
  -- es ALT (absolute return) y la distingue del otro Jupiter, que es RV.
  ('2026-07-28', 5, 'Jupiter Merian Global Equity Absolute Return Fund', 'Jupiter Abs. Return',  'ALT',    750),
  ('2026-07-28', 6, 'MFS Meridian Funds — Contrarian Value Fund',        'MFS Contrarian Value',  'RV',     500),
  ('2026-07-28', 7, 'Vontobel Fund — Credit Opportunities',              'Vontobel Credit Opps.', 'RF',     500),
  ('2026-07-28', 8, 'Otros',                                            'Otros',                 'OTROS', 4000);
