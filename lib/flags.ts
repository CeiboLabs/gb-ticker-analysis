// Flags de visibilidad de módulos del sitio (tabla site_flags).
//
// El vocabulario es CERRADO y vive acá: una key desconocida no se puede crear
// ni togglear. El enforcement corre en los data-APIs públicos (/api/youtube,
// /api/instagram, /api/fondo/documentos) — las páginas institucionales siguen
// 100% estáticas y los componentes ya se auto-ocultan cuando el API devuelve
// vacío. Default OFF: sin fila en la tabla (o sin binding, o con la tabla aún
// sin migrar) el módulo NO se muestra. Fail-closed pero jamás tumba el API.

import type { D1Database } from "@/lib/metrics";

export const FLAG_DEFS = {
  videos_casa: {
    label: "Videos de la casa",
    descripcion: "Muestra el módulo con los últimos videos del canal de YouTube al pie de /informes.",
  },
  instagram_feed: {
    label: "Feed de Instagram",
    descripcion: "Muestra los últimos posteos de @bengochea_inversiones en la portada.",
  },
  fondo_documentos: {
    label: "Documentos del fondo",
    descripcion: "Publica los documentos descargables del fondo (ficha, reglamento) en /bng-seleccion-global.",
  },
} as const;

export type FlagKey = keyof typeof FLAG_DEFS;
export const FLAG_KEYS = Object.keys(FLAG_DEFS) as FlagKey[];

export function isFlagKey(k: string): k is FlagKey {
  return Object.prototype.hasOwnProperty.call(FLAG_DEFS, k);
}

/**
 * ¿Está prendido el módulo? Para los data-APIs públicos: db null (next dev sin
 * bindings) o cualquier error de D1 ⇒ default OFF, nunca una excepción.
 */
export async function readFlag(db: D1Database | null, key: FlagKey): Promise<boolean> {
  if (!db) return false;
  try {
    const row = await db
      .prepare("SELECT enabled FROM site_flags WHERE key = ? LIMIT 1")
      .bind(key)
      .first<{ enabled: number }>();
    return row ? Number(row.enabled) === 1 : false;
  } catch {
    return false;
  }
}

export type FlagState = {
  key: FlagKey;
  label: string;
  descripcion: string;
  enabled: boolean;
  updatedAt: number | null;
  updatedBy: string | null;
};

/** Estado completo para el panel: FLAG_DEFS ⋈ filas (sin fila ⇒ OFF). */
export async function readAllFlags(db: D1Database): Promise<FlagState[]> {
  const { results } = await db
    .prepare("SELECT key, enabled, updated_at, updated_by FROM site_flags")
    .all<{ key: string; enabled: number; updated_at: number; updated_by: string | null }>();
  const rows = new Map((results ?? []).map((r) => [r.key, r]));
  return FLAG_KEYS.map((key) => {
    const row = rows.get(key);
    return {
      key,
      label: FLAG_DEFS[key].label,
      descripcion: FLAG_DEFS[key].descripcion,
      enabled: row ? Number(row.enabled) === 1 : false,
      updatedAt: row ? Number(row.updated_at) : null,
      updatedBy: row?.updated_by ?? null,
    };
  });
}

export async function setFlag(db: D1Database, key: FlagKey, enabled: boolean, updatedBy: string, nowMs?: number): Promise<void> {
  await db
    .prepare(
      "INSERT INTO site_flags (key, enabled, updated_at, updated_by) VALUES (?,?,?,?) " +
        "ON CONFLICT(key) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
    )
    .bind(key, enabled ? 1 : 0, nowMs ?? Date.now(), updatedBy)
    .run();
}
