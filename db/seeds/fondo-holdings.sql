-- BNG Selección Global — snapshot de tenencias (detalle por instrumento).
--
-- Dato REAL provisto por el cliente: 17 líneas, Σ = 10.000 bps (100%).
--   RV  4.500 bps (45%) · RF 4.000 bps (40%) · ALT 1.500 bps (15%)
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
-- Aplicar:  sqlite3 data/bengochea.sqlite3 < db/seeds/fondo-holdings.sql

BEGIN;

INSERT INTO fund_holdings_snapshot (as_of, status, source, note, ingested_at)
VALUES ('2026-07-28', 'live', 'admin', 'Detalle por instrumento — carga inicial', unixepoch() * 1000)
ON CONFLICT(as_of) DO UPDATE SET
  status = 'live', source = 'admin', note = excluded.note, ingested_at = excluded.ingested_at;

DELETE FROM fund_holdings_item WHERE as_of = '2026-07-28';

INSERT INTO fund_holdings_item (as_of, ord, name, short, asset_class, weight_bps) VALUES
  ('2026-07-28',  0, 'Jupiter Merian World Equity Fund L (USD) Acc',                  'Jupiter World Equity',  'RV', 1000),
  ('2026-07-28',  1, 'Thornburg Equity Income Builder Fund A (USD) Acc Unhedged',     'Thornburg Eq. Income',  'RV', 1000),
  ('2026-07-28',  2, 'Invesco QQQ Trust Series 1',                                    'Invesco QQQ',           'RV',  750),
  ('2026-07-28',  3, 'Jupiter Merian Global Equity Absolute Return Fund L (USD) Acc', 'Jupiter Global Eq. AR', 'ALT', 750),
  ('2026-07-28',  4, 'Neuberger Berman Global Flexible Credit Income Fund A (USD) Acc','NB Flexible Credit',   'RF',  750),
  ('2026-07-28',  5, 'Muzinich Enhancedyield Short-Term Fund S (USD) Inc A',          'Muzinich Short-Term',   'RF',  750),
  ('2026-07-28',  6, 'Man Global Investment Grade Opportunities DYV (USD) Acc',       'Man Global IG Opps.',   'RF',  750),
  ('2026-07-28',  7, 'MFS Meridian Funds — Contrarian Value Fund A1 (USD) Acc',       'MFS Contrarian Value',  'RV',  500),
  ('2026-07-28',  8, 'iShares MSCI Emerging Markets ETF',                             'iShares MSCI EM',       'RV',  500),
  ('2026-07-28',  9, 'Schroder Alternative Solutions Commodity Fund A Acc USD',       'Schroder Commodity',    'ALT', 500),
  ('2026-07-28', 10, 'iShares Core S&P Small-Cap ETF',                                'iShares S&P Small Cap', 'RV',  500),
  ('2026-07-28', 11, 'BSF ESG Fixed Income Strategies Fund A2 (USD)',                 'BSF ESG Fixed Income',  'RF',  500),
  ('2026-07-28', 12, 'Vontobel Fund — Credit Opportunities B1 (USD) Cap',             'Vontobel Credit Opps.', 'RF',  500),
  ('2026-07-28', 13, 'Vontobel Fund — Emerging Markets Debt Blend B (USD) Acc',       'Vontobel EM Debt',      'RF',  500),
  ('2026-07-28', 14, 'Energy Select Sector SPDR Fund',                                'Energy Select SPDR',    'RV',  250),
  ('2026-07-28', 15, 'SPDR Gold Shares',                                              'SPDR Gold Shares',      'ALT', 250),
  ('2026-07-28', 16, 'PIMCO GIS Low Duration Income Fund E (USD) Acc',                'PIMCO Low Duration',    'RF',  250);

COMMIT;
