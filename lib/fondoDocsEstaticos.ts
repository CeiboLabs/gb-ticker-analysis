// Los documentos del fondo que VIAJAN EN EL DEPLOY, como archivos de `public/`.
//
// POR QUÉ EXISTE ESTA LISTA
// El sitio de BNG Selección Global es HTML estático + un worker chico
// (docs/RUNBOOK-fondo-cloudflare.md). Los documentos, en cambio, los publica el
// panel de empleados, que escribe en SU base y SU filesystem —el home server— y
// no tiene puente hacia la D1 ni el R2 de la cuenta del fondo (R2 ni siquiera
// está habilitado ahí). Resultado: se publicaban en el panel y el sitio los
// seguía mostrando como "Solicitar", porque el API respondía la lista vacía.
//
// Con esta lista, un PDF ya publicado se sirve desde el propio deploy: sin D1,
// sin R2 y sin invocar al worker (los assets los sirve el borde).
//
// ES UNA LÍNEA DE BASE, NO UN REEMPLAZO
// Donde el API de documentos sí responde —el home server hoy, y el sitio del
// fondo el día que exista el puente panel→D1/R2— manda el API: FondoDocumentos
// usa esta lista sólo para los tipos que el API no trae. Por eso el panel sigue
// gobernando los documentos donde puede, y agregar el puente después no obliga a
// deshacer nada de acá.
//
// EL COSTO, EXPLÍCITO
// Un PDF listado acá se publica al deployar y deja de responder al panel: no hay
// "pausar" que lo saque del aire. Actualizarlo es editar esta lista, reemplazar
// el archivo y volver a deployar. Es el trato que se eligió a cambio de no
// habilitar R2; si algún día molesta, la salida es el puente, no un parche acá.

import type { FondoDocTipo } from "@/lib/panelSchemas";

export type DocEstatico = {
  tipo: FondoDocTipo;
  /**
   * Ruta pública, tal cual va en el href. El basename es el nombre con el que el
   * visitante se guarda el archivo —un asset estático no lleva
   * `Content-Disposition`—, así que repite la convención de `NOMBRE_ARCHIVO` en
   * lib/fondoApi.ts para que el PDF se llame igual por los dos caminos.
   */
  archivo: string;
  bytes: number;
  /** epoch ms — la fecha que se le muestra al lector ("Actualizado 27/07/2026"). */
  actualizado: number;
};

/**
 * ⚠️ Los tres campos se mueven JUNTOS: al reemplazar un PDF hay que actualizar
 * `bytes` y `actualizado` en la misma edición, o la página informa un tamaño y
 * una fecha que no son los del archivo. `scripts/build-fondo.mts` verifica que
 * el archivo exista y que `bytes` coincida, y corta el build si no — el tamaño
 * es lo que delata que el PDF cambió y la lista no.
 */
export const DOCS_ESTATICOS: DocEstatico[] = [
  {
    tipo: "reglamento",
    archivo: "/documentos/BNG-Seleccion-Global-Reglamento-de-gestion.pdf",
    bytes: 677003,
    actualizado: 1785179476000, // 27/07/2026
  },
  {
    tipo: "autorizacion-bcu",
    archivo: "/documentos/BNG-Seleccion-Global-Autorizacion-BCU.pdf",
    bytes: 335270,
    actualizado: 1785179476000, // 27/07/2026
  },
];

/** Índice por tipo, que es como lo consulta el catálogo de FondoDocumentos. */
export const DOCS_ESTATICOS_POR_TIPO: Partial<Record<FondoDocTipo, DocEstatico>> =
  Object.fromEntries(DOCS_ESTATICOS.map((d) => [d.tipo, d]));
