// Los tres endpoints PÚBLICOS del fondo, como respuestas HTTP estándar.
//
// Están acá y no en las route handlers porque los sirven DOS runtimes distintos:
//
//   · las rutas de Next (`app/api/fondo/…`), que es lo que corre en el dev y en
//     el home server, donde los dos sitios comparten un deploy;
//   · el worker del sitio del fondo en Cloudflare (`workers/fondo-site`), donde
//     la página es HTML estático servido por el borde y lo único que ejecuta
//     código son justamente estos tres endpoints.
//
// Duplicarlos habría significado mantener dos veces las reglas que importan —
// qué se cachea y por cuánto, y sobre todo el fail-closed de los documentos— con
// la garantía de que un día divergen. Devuelven `Response` del estándar web, que
// las route handlers de Next aceptan tal cual.
//
// La I/O entra por parámetro (`db`, `bucket`): cada runtime resuelve sus
// bindings a su manera —`getMetricsDb()` en Next, el `env` del worker en
// Cloudflare— y esta capa no se entera.

import type { D1Database, R2Bucket } from "@/lib/metrics";
import { getFundSnapshot } from "@/lib/fondo";
import { readFlag } from "@/lib/flags";
import { listDocsLive, getDoc } from "@/lib/fondoDocsStore";
import { isFondoDocTipo, type FondoDocTipo } from "@/lib/panelSchemas";

/**
 * Snapshot diario (valor cuota, AUM, serie y tenencias). Sólo lectura. Mientras
 * `fund_nav` esté vacía devuelve el estado 'pre-launch' con serie vacía — el
 * frontend muestra "en proceso de lanzamiento".
 */
export async function respuestaFondo(db: D1Database | null): Promise<Response> {
  const snapshot = await getFundSnapshot(db);

  // En PRE-LANZAMIENTO la serie del benchmark no viaja. Son ~1.200 cierres
  // diarios —62,8 KB de los 63 que pesaba esta respuesta— y no hay nada que los
  // dibuje: el gráfico sólo monta con `live === true` (ver FondoPerformance,
  // donde el modo "sólo benchmark" se sacó por decisión del cliente el
  // 3-ago-2026). Se bajaban, se parseaban y se descartaban en cada visita, y
  // encima con prioridad alta, porque es un fetch del primer render.
  // Ver docs/rendimiento-fondo.md §6.1.
  //
  // Se recortan sólo los PUNTOS. Los agregados derivados (benchReturns,
  // benchCalendar) son cinco filas y quedan: son lo que la tabla comparativa
  // necesita el día que haya serie propia, y no pesan.
  //
  // ⚠️ Si alguna vez vuelve a graficarse el benchmark solo, esto es lo que hay
  // que sacar — no busques el bug en el componente.
  const publicable =
    snapshot.status === "pre-launch" && snapshot.benchmark.length > 0
      ? { ...snapshot, benchmark: [] }
      : snapshot;

  return Response.json(publicable, {
    // Cierre diario: cacheable unos minutos en el borde (s-maxage) sin quedar
    // viejo. Pero el NAVEGADOR revalida siempre (max-age=0).
    //
    // Con max-age=300 el browser servía su copia hasta 5 minutos después de que
    // cambiaran los datos: se cargaba un valor cuota, se recargaba la página y
    // no se veía nada — indistinguible de un bug. Un cierre diario no justifica
    // que el dato tarde en aparecer; el s-maxage sigue absorbiendo la carga.
    headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" },
  });
}

const CACHE_DOCS = { "Cache-Control": "public, max-age=300, s-maxage=300" };

/**
 * Documentos publicados. Respeta el flag `fondo_documentos` y sólo lista filas
 * 'live'; vacío ⇒ el componente cae a los PDFs del deploy y, si tampoco hay,
 * marca el documento "Próximamente". Nunca expone
 * r2_key: la descarga va por tipo.
 */
export async function respuestaDocumentos(db: D1Database | null): Promise<Response> {
  if (!db || !(await readFlag(db, "fondo_documentos"))) {
    return Response.json({ documentos: [] }, { headers: CACHE_DOCS });
  }
  const documentos = (await listDocsLive(db)).map((d) => ({
    tipo: d.tipo,
    titulo: d.titulo,
    descripcion: d.descripcion,
    actualizado: d.updated_at,
    bytes: d.content_len,
  }));
  return Response.json({ documentos }, { headers: CACHE_DOCS });
}

// Nombre con el que el visitante se guarda el archivo. Va aparte del slug del
// enum (que es clave de base y no se toca) para que el PDF no se llame
// "ficha-tecnica" cuando la página dice Factsheet.
const NOMBRE_ARCHIVO: Record<FondoDocTipo, string> = {
  "ficha-tecnica": "Factsheet",
  "datos-fundamentales": "Datos-fundamentales",
  "reglamento": "Reglamento-de-gestion",
  "autorizacion-bcu": "Autorizacion-BCU",
  "informe-cartera": "Informe-de-cartera",
};

/**
 * Descarga del PDF, same-origin desde R2. Fail-closed: tipo fuera del enum, flag
 * apagado, fila 'hold' o archivo ausente ⇒ 404 sin distinguir el motivo.
 */
export async function respuestaDocumento(
  db: D1Database | null,
  bucket: R2Bucket | null,
  tipo: string,
): Promise<Response> {
  if (!isFondoDocTipo(tipo)) return new Response("No encontrado", { status: 404 });
  if (!db || !bucket || !(await readFlag(db, "fondo_documentos"))) {
    return new Response("No encontrado", { status: 404 });
  }
  const doc = await getDoc(db, tipo);
  if (!doc || doc.status !== "live") return new Response("No encontrado", { status: 404 });
  const obj = await bucket.get(doc.r2_key);
  if (!obj) return new Response("No encontrado", { status: 404 });

  return new Response(obj.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="BNG-Seleccion-Global-${NOMBRE_ARCHIVO[tipo]}.pdf"`,
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      ETag: obj.httpEtag,
    },
  });
}
