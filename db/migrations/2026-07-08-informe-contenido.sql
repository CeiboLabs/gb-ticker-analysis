-- Artículo editorial de cada informe, como JSON (ContenidoInforme) en la propia
-- fila `informes`. NULL = el informe todavía es sólo PDF. La página
-- /informes/[slug] lo lee por request (force-dynamic); el panel lo escribe con
-- PUT /api/admin/panel/informes/[slug]/contenido.
--
-- Aplicar sobre una base YA inicializada (user_version >= 1) con el sqlite3 CLI
-- y subir user_version — ver docs/RUNBOOK-home.md. En base FRESCA la columna ya
-- viene en db/schema.sql, así que NO correr este ALTER ahí (daría "duplicate
-- column"). La lectura del store tolera la columna ausente (cae al seed).

ALTER TABLE informes ADD COLUMN contenido TEXT;
