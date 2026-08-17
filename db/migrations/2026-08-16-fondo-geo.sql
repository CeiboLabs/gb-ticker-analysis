-- Exposición geográfica del fondo editable desde el panel de empleados.
--
-- Hasta ahora los cinco pesos por región eran una constante en
-- components/institucional/FondoGeografia.tsx y cambiarlos era un cambio de
-- código + deploy. Adrián los va a mover "cada tanto", así que pasan a ser dato.
--
-- QUÉ SE GUARDA, Y QUÉ NO
-- Sólo los PESOS. La taxonomía —qué regiones existen, cómo se llaman, y qué
-- país cae en cuál— sigue en código (lib/fondoGeo.ts + el mapa PAIS_A_REGION del
-- componente), porque agregar una región exige clasificar países y eso no es
-- cargar un número. Ver el encabezado de lib/fondoGeo.ts.
--
-- POR QUÉ UN DOCUMENTO Y NO CINCO FILAS
-- Los cinco pesos son indivisibles: tienen que sumar 100, así que la única
-- mutación válida es reemplazarlos a todos juntos. Una tabla de cinco filas
-- cuyo único UPDATE legal es "borrar las cinco e insertar cinco" está diciendo
-- mal lo que es. Y no hay consulta que quiera una región sola: la página las
-- lee siempre completas. Además el conjunto de claves está CERRADO por código
-- (la base no puede tener una sexta región sin un deploy), que es justo el caso
-- donde una tabla por fila no compra nada.
--
-- `fund_config` queda como el lugar de los ajustes del fondo que son un
-- documento chico y no una serie. Mismo molde que `site_flags` (clave/valor,
-- WITHOUT ROWID, sello de quién y cuándo), que ya existe para los flags.
--
-- La FORMA del valor no la impone SQLite: la valida `parseGeoTarget` al leer y
-- `GeoTargetSchema` al escribir. Un JSON corrupto acá no voltea la página — la
-- lectura devuelve null y el sitio cae a la línea de base del deploy.
--
-- Aplicar sobre una base YA inicializada (user_version >= 1) con el sqlite3 CLI
-- — ver docs/RUNBOOK-home.md. En base FRESCA la tabla ya viene en db/schema.sql.
-- Idempotente: IF NOT EXISTS, y sin fila semilla a propósito (sin fila, la
-- página usa GEO_BASELINE, que es exactamente lo que mostraba antes de esto).

BEGIN;

CREATE TABLE IF NOT EXISTS fund_config (
  key        TEXT    NOT NULL,
  value      TEXT    NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (key)
) WITHOUT ROWID;

COMMIT;
