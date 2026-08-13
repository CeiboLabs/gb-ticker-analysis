-- BNG Selección Global — snapshots de tenencias (detalle por instrumento).
--
-- Dato REAL provisto por el cliente. Cada snapshot es una FOTO A UNA FECHA de la
-- cartera: 8 tenencias nombradas + el residual, Σ = 10.000 bps (100%).
--
-- Hoy el archivo carga DOS composiciones, y la página publica la más nueva:
--
--   · 2026-08-05 — la foto de la planilla del 30-jul (antes estuvo cargada como
--     28-jul y como 4-ago). Queda en la base como histórico.
--       RV 3.250 (32,5%) · RF 2.000 (20%) · ALT 750 (7,5%) · OTROS 4.000 (40%)
--   · 2026-08-13 — composición vigente. El cliente pidió bajar de 10% a 7,5% las
--     dos líneas que estaban en 10% (Jupiter World Equity y Thornburg). Los 500
--     bps que liberan los absorbe el residual (4.000 → 4.500): el pedido no tocó
--     las otras seis tenencias, así que el único lugar donde puede caer la
--     diferencia es el tramo que no se abre por instrumento. Sin eso la suma
--     cerraría en 9.500 y HoldingsSchema lo rechaza.
--       RV 2.750 (27,5%) · RF 2.000 (20%) · ALT 750 (7,5%) · OTROS 4.500 (45%)
--
-- ⚠️ VA COMO SNAPSHOT NUEVO Y NO PISANDO EL DEL 5-AGO (decisión del 13-ago-2026).
-- La alternativa era tratarlo como corrección de la foto del 5-ago, y no es lo
-- mismo: el as_of es la fecha que la página muestra al pie del gráfico
-- ("Composición al …"), o sea que es una AFIRMACIÓN sobre a qué día corresponde
-- la cartera —las nueve líneas, no sólo las dos que se movieron—. Pisar el 5-ago
-- habría dicho que ese día la cartera era otra; cargarlo aparte dice lo que
-- efectivamente pasa: la cartera cambió y ésta es la foto de hoy. Además deja el
-- histórico de composiciones intacto, que es lo que hace auditable la sección.
--
-- ⚠️ Estos snapshots divulgan sólo las MAYORES tenencias y cierran el 100% con un
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
--   · Se cayó la barra de split por clase: con el 45% sin clasificar no hay
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
-- el mes — y ahí la página seguiría mostrando el del 5-ago, que es justamente
-- para lo que el histórico tiene que estar cargado.
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
-- No cambian lo que se ve —readLatestHoldings toma el as_of más alto— pero dejan
-- al panel listando composiciones que nunca existieron como tales: son la MISMA
-- foto redatada tres veces, no tres carteras. Se borran para que el histórico
-- que queda sea el de verdad (5-ago y 13-ago) y no el rastro de las redataciones.
DELETE FROM fund_holdings_item     WHERE as_of IN ('2026-07-28', '2026-08-04');
DELETE FROM fund_holdings_snapshot WHERE as_of IN ('2026-07-28', '2026-08-04');

-- ── 2026-08-05 — histórico ───────────────────────────────────────────────────
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
  -- 'Jupiter Abs. Return' y no 'Jupiter Global Eq. AR': en el treemap en retrato
  -- esta celda entra en dos renglones de ~11 caracteres. La abreviatura anterior
  -- se cortaba en "Jupiter Global Eq…"; ésta conserva justo lo que explica por
  -- qué la línea es ALT (absolute return) y la distingue del otro Jupiter, que
  -- es RV.
  ('2026-08-05', 5, 'Jupiter Merian Global Equity Absolute Return Fund', 'Jupiter Abs. Return',  'ALT',    750),
  ('2026-08-05', 6, 'MFS Meridian Funds — Contrarian Value Fund',        'MFS Contrarian Value',  'RV',     500),
  ('2026-08-05', 7, 'Vontobel Fund — Credit Opportunities',              'Vontobel Credit Opps.', 'RF',     500),
  ('2026-08-05', 8, 'Otros',                                            'Otros',                 'OTROS', 4000);

-- ── 2026-08-13 — composición vigente (la que publica la página) ──────────────
-- Mismas nueve líneas; cambian los dos pesos que pidió el cliente y el residual
-- que los absorbe. Seis tenencias quedan empatadas en 7,5%: el treemap sale como
-- una grilla pareja de 4×2 y el donut con seis porciones iguales — es la forma
-- honesta de una cartera casi equiponderada, no un error de layout.
INSERT INTO fund_holdings_snapshot (as_of, status, source, note, ingested_at)
VALUES ('2026-08-13', 'live', 'admin', 'Mayores tenencias + resto no detallado', unixepoch() * 1000)
ON CONFLICT(as_of) DO UPDATE SET
  status = 'live', source = 'admin', note = excluded.note, ingested_at = excluded.ingested_at;

DELETE FROM fund_holdings_item WHERE as_of = '2026-08-13';

INSERT INTO fund_holdings_item (as_of, ord, name, short, asset_class, weight_bps) VALUES
  ('2026-08-13', 0, 'Jupiter Merian World Equity Fund',                  'Jupiter World Equity',  'RV',     750),
  ('2026-08-13', 1, 'Thornburg Equity Income Builder Fund',              'Thornburg Eq. Income',  'RV',     750),
  ('2026-08-13', 2, 'Invesco QQQ Trust Series 1',                        'Invesco QQQ',           'RV',     750),
  ('2026-08-13', 3, 'Muzinich Enhancedyield Short-Term Fund',            'Muzinich Short-Term',   'RF',     750),
  ('2026-08-13', 4, 'Man Global Investment Grade Opportunities DYV',     'Man Global IG Opps.',   'RF',     750),
  ('2026-08-13', 5, 'Jupiter Merian Global Equity Absolute Return Fund', 'Jupiter Abs. Return',  'ALT',     750),
  ('2026-08-13', 6, 'MFS Meridian Funds — Contrarian Value Fund',        'MFS Contrarian Value',  'RV',     500),
  ('2026-08-13', 7, 'Vontobel Fund — Credit Opportunities',              'Vontobel Credit Opps.', 'RF',     500),
  ('2026-08-13', 8, 'Otros',                                            'Otros',                 'OTROS', 4500);
