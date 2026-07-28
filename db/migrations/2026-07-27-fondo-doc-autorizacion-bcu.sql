-- Amplía el enum de `fondo_documentos.tipo` con 'autorizacion-bcu': la
-- Resolución RR-SSF-2026-434 del BCU (7-jul-2026) que aprueba el Reglamento del
-- Fondo, lo inscribe en el Registro del Mercado de Valores y lo habilita para
-- oferta pública. El documento es público ("Publicable: Sí" al pie) y se
-- descarga desde /bng-seleccion-global#documentos.
--
-- SQLite no sabe alterar un CHECK: hay que reconstruir la tabla (crear, copiar,
-- borrar, renombrar). Las filas ya cargadas se preservan.
--
-- Aplicar sobre una base YA inicializada (user_version >= 1) con el sqlite3 CLI
-- — ver docs/RUNBOOK-home.md. En base FRESCA el CHECK nuevo ya viene en
-- db/schema.sql, así que correrla ahí es un no-op caro pero inocuo. Re-correrla
-- es idempotente: rehace la misma tabla con el mismo contenido.

BEGIN;

CREATE TABLE fondo_documentos_nueva (
  tipo        TEXT    NOT NULL CHECK (tipo IN ('ficha-tecnica','datos-fundamentales','reglamento','autorizacion-bcu','informe-cartera')),
  titulo      TEXT    NOT NULL,
  descripcion TEXT,
  r2_key      TEXT    NOT NULL,
  content_len INTEGER,
  status      TEXT    NOT NULL DEFAULT 'live' CHECK (status IN ('live','hold')),
  updated_at  INTEGER NOT NULL,
  updated_by  TEXT    NOT NULL,
  PRIMARY KEY (tipo)
) WITHOUT ROWID;

INSERT INTO fondo_documentos_nueva (tipo, titulo, descripcion, r2_key, content_len, status, updated_at, updated_by)
SELECT tipo, titulo, descripcion, r2_key, content_len, status, updated_at, updated_by FROM fondo_documentos;

DROP TABLE fondo_documentos;
ALTER TABLE fondo_documentos_nueva RENAME TO fondo_documentos;

COMMIT;
