// Publicación de los datos del fondo desde el panel hacia el hosting cPanel.
//
// QUÉ PROBLEMA RESUELVE
// El panel de empleados escribe en SU base (la SQLite del home server) y el
// sitio del fondo es HTML estático en otro hosting. Hasta ahora el puente era
// una D1 de Cloudflare consultada en vivo por un worker; esto lo reemplaza por
// un PASO DE PUBLICACIÓN explícito: Adrián guarda, aprieta "Publicar", y lo que
// tenía la base viaja como archivos estáticos al hosting.
//
// Ver docs/plan-consolidacion-fondo.md.
//
// QUÉ SE PUBLICA: LOS BYTES EXACTOS DE /api/fondo
// El artefacto `fondo` NO es un sobre con metadatos alrededor del snapshot: es
// el cuerpo tal cual lo devuelve `respuestaFondo()`. Así el archivo estático y
// la ruta de Next sirven lo MISMO, y el cliente (lib/useFondo.ts) no tiene que
// desenvolver nada distinto según dónde esté corriendo. Los metadatos de la
// publicación (cuándo, quién, qué versión) viajan en las CABECERAS del POST y
// quedan en la base del panel, no adentro del archivo.
//
// PURO A PROPÓSITO: sin imports de Next, sin I/O de red, sólo WebCrypto — mismo
// criterio que lib/panelCrypto.ts, para poder testearlo con tsx. Quien hace el
// POST es la route handler.

const te = new TextEncoder();

/**
 * Qué se puede publicar. Lista CERRADA: el receptor PHP la valida contra la
 * misma enumeración, y de ahí sale el nombre del archivo destino. Los nombres
 * NUNCA se derivan del payload — es lo que impide que un cuerpo malicioso
 * elija dónde se escribe.
 */
export type Artefacto = "fondo" | "documentos" | `doc:${string}`;

export function artefactoDoc(tipo: string): Artefacto {
  return `doc:${tipo}`;
}

/**
 * Cadena canónica que se firma. Incluye el artefacto y no sólo el cuerpo: sin
 * eso, un PDF interceptado podría reenviarse como si fuera otro documento, o el
 * JSON del fondo escribirse encima de la lista de documentos. Con el artefacto
 * adentro, cada firma sirve para UN destino y nada más.
 *
 * El timestamp entra por lo mismo de siempre: sin él, capturar un POST válido
 * alcanza para repetirlo para siempre.
 */
export function cadenaFirma(ts: number, art: Artefacto, hashCuerpoHex: string): string {
  return `${ts}\n${art}\n${hashCuerpoHex}`;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Bytes(cuerpo: Uint8Array): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", cuerpo as BufferSource)));
}

export async function hmacHex(secreto: string, mensaje: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    te.encode(secreto) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, te.encode(mensaje) as BufferSource)));
}

/** Cabeceras del POST al receptor. El cuerpo va crudo (JSON o PDF). */
export async function cabecerasPublicacion(
  secreto: string,
  art: Artefacto,
  cuerpo: Uint8Array,
  ts: number,
): Promise<Record<string, string>> {
  const hashCuerpo = await sha256Bytes(cuerpo);
  return {
    "X-BNG-Ts": String(ts),
    "X-BNG-Art": art,
    "X-BNG-Sig": await hmacHex(secreto, cadenaFirma(ts, art, hashCuerpo)),
    "Content-Type": art.startsWith("doc:") ? "application/pdf" : "application/json",
  };
}

// ── Huella del estado publicable ─────────────────────────────────────────────

/**
 * Identidad de un PDF SIN leerlo. El panel necesita saber si un documento
 * cambió para decidir si lo re-sube; abrir cada PDF (hasta 15 MB) en cada
 * chequeo sería absurdo cuando la base ya guarda largo y fecha, que se mueven
 * juntos en cada reemplazo.
 */
export function huellaDoc(tipo: string, contentLen: number | null, updatedAt: number): string {
  return `${tipo}:${contentLen ?? 0}:${updatedAt}`;
}

export type EstadoPublicable = {
  /** Cuerpo exacto de /api/fondo. */
  fondo: string;
  /** Cuerpo exacto de /api/fondo/documentos. */
  documentos: string;
  /** huellaDoc() por tipo, de los documentos publicables. */
  docs: Record<string, string>;
};

/**
 * Huella de TODO lo publicable, en una sola cadena. Compararla contra la huella
 * de la última publicación es lo que responde "¿hay cambios sin publicar?".
 *
 * Se hace por comparación de contenido y no llevando una marca de "sucio" en
 * cada camino de escritura a propósito: una marca hay que acordarse de ponerla
 * en cada ruta nueva, y el día que alguien la olvide el panel dirá que está
 * todo publicado cuando no lo está. Esto no se puede olvidar.
 */
export async function huellaEstado(e: EstadoPublicable): Promise<string> {
  const docs = Object.keys(e.docs)
    .sort()
    .map((k) => e.docs[k])
    .join("|");
  return sha256Texto(`${e.fondo}\n${e.documentos}\n${docs}`);
}

/** SHA-256 de una cadena. Sin clave: acá no hay nada que autenticar, sólo comparar. */
async function sha256Texto(s: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", te.encode(s) as BufferSource)));
}

// ── Registro de la última publicación (fila `publicado` de fund_config) ───────

export type RegistroPublicacion = {
  version: number;
  huella: string;
  /** huellaDoc() por tipo, de lo que efectivamente se subió. */
  docs: Record<string, string>;
};

export function parseRegistro(raw: unknown): RegistroPublicacion | null {
  let v: unknown = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.version !== "number" || typeof o.huella !== "string") return null;
  const docs: Record<string, string> = {};
  if (typeof o.docs === "object" && o.docs !== null) {
    for (const [k, val] of Object.entries(o.docs as Record<string, unknown>)) {
      if (typeof val === "string") docs[k] = val;
    }
  }
  return { version: o.version, huella: o.huella, docs };
}

/**
 * Qué PDFs hay que subir: los que cambiaron de huella y los que nunca se
 * subieron. Los que están igual no se re-suben — un factsheet de 12 MB no tiene
 * por qué viajar porque cambió el valor cuota.
 */
export function docsASubir(
  actual: Record<string, string>,
  publicado: Record<string, string>,
): string[] {
  return Object.keys(actual)
    .filter((tipo) => actual[tipo] !== publicado[tipo])
    .sort();
}
