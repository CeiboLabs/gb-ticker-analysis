// Exposición geográfica del fondo: la TAXONOMÍA de regiones (código) y la
// línea de base que viaja en el deploy.
//
// QUÉ ES ESTE DATO, QUE DECIDE TODO LO DEMÁS
// Los pesos son la ASIGNACIÓN OBJETIVO del mandato —lo que la estrategia busca
// sostener—, no la exposición efectiva medida a una fecha. Por eso el bloque no
// lleva fecha de corte, no envejece, y no le aplica el rezago anti
// front-running de las tenencias: un objetivo no es información de posición.
// ⚠️ Si algún día se publicara la exposición EFECTIVA, esto cambia de
// naturaleza: hace falta fecha de corte y hay que reescribir el pie de
// FondoGeografia (la cláusula "la vigente te la informa un asesor" deja de ser
// cierta), que salió de la revisión legal del 3-ago-2026.
//
// POR QUÉ LA TAXONOMÍA VIVE ACÁ Y LOS PESOS EN LA BASE
// Agregar una región no es cargar un número: exige además clasificar los países
// que le corresponden (PAIS_A_REGION, en el componente, que es quien pinta el
// mapa). Es una taxonomía, no un dato — que sea un cambio de código es lo
// correcto. Lo único que se mueve "cada tanto", y lo único que carga el panel,
// son los cinco pesos.
//
// POR QUÉ NO SE DERIVA DE LAS TENENCIAS
// Se evaluó y no se puede: el ~45% de la cartera es la fila residual "OTROS",
// que no tiene región posible, y las líneas que sí se nombran son FONDOS, no
// activos — un "World Equity Fund" está diversificado por dentro y no admite
// una región. No hay `region` que agregarle a fund_holdings_item.
//
// SIN DEPENDENCIAS A PROPÓSITO: este módulo lo importan `lib/fondoStore.ts` y
// por esa vía el worker del sitio del fondo. Meterle zod (o cualquier cosa que
// arrastre el panel) lo mete al bundle del worker. La validación de forma es
// `parseGeoTarget`, a mano; el schema zod con los mensajes lindos vive en
// lib/panelSchemas.ts y se construye a partir de las claves de acá, así que no
// pueden divergir.

export type GeoKey = "NA" | "EM" | "EU" | "AD" | "OT";

export type GeoRegion = {
  key: GeoKey;
  label: string;
  /**
   * No se pinta en el mapa —el efectivo no tiene geografía— pero su peso SÍ
   * cuenta para el 100%: va en la lista para que la suma cierre. En la leyenda
   * lleva el cuadrito hueco y la barra llena.
   */
  sinMapa?: boolean;
};

/**
 * Las cinco regiones, en orden canónico. El orden de ESTA lista no es el orden
 * de la leyenda —ese sale de `geoOrdenado`, por peso— pero sí es el orden en el
 * que se muestran los campos del panel, donde reordenar mientras se tipea sería
 * insoportable.
 *
 * Clasificación estándar de mercados (MSCI), que es la que usa el propio
 * mandato: "Mercados Emergentes" y "Asia Desarrollada" cortan la geografía al
 * través (México es norteamericano y emergente; Japón y China comparten
 * continente y están en buckets distintos).
 */
export const GEO_REGIONES: readonly GeoRegion[] = [
  { key: "NA", label: "Norteamérica" },
  { key: "EM", label: "Mercados Emergentes" },
  { key: "EU", label: "Europa" },
  { key: "AD", label: "Asia Desarrollada" },
  { key: "OT", label: "Otros / Efectivo", sinMapa: true },
] as const;

export const GEO_KEYS = GEO_REGIONES.map((r) => r.key) as [GeoKey, ...GeoKey[]];

/** Los cinco pesos, en porcentaje entero. Suman exactamente GEO_TOTAL. */
export type GeoTarget = Record<GeoKey, number>;

export const GEO_TOTAL = 100;

/**
 * Línea de base que viaja en el DEPLOY. Es el valor que la página muestra
 * mientras no haya dato en la base (o si la lectura falla), y también el estado
 * inicial del render — así el caso normal, que es "nadie cambió nada", pinta
 * idéntico a como pintaba cuando esto era una constante, sin transición.
 *
 * Mismo trato que lib/fondoDocsEstaticos.ts con los PDFs: línea de base en el
 * deploy, el dato publicado manda cuando existe.
 *
 * ⚠️ Queda vieja en cuanto Adrián publique otra cosa. No es una segunda fuente
 * de verdad: es el piso para que la página nunca tenga un agujero.
 */
export const GEO_BASELINE: GeoTarget = { NA: 46, EM: 24, EU: 22, AD: 5, OT: 3 };

/**
 * Valida la FORMA de un objetivo geográfico venido de la base (o de cualquier
 * lado). Devuelve null en vez de tirar: un JSON corrupto en `fund_config` no
 * tiene por qué voltear la página del fondo — se cae a la línea de base.
 *
 * Las reglas son las mismas que aplica GeoTargetSchema en el panel: las cinco
 * claves exactas, enteros 0..100, y la suma en GEO_TOTAL clavado. El "clavado"
 * es a propósito y se aparta de HoldingsSchema (que tolera ±100 bps): allá la
 * holgura absorbe el redondeo de pesos calculados desde importes; acá los cinco
 * números los escribe una persona y "suman 99" es un error de tipeo, no un
 * redondeo.
 */
export function parseGeoTarget(raw: unknown): GeoTarget | null {
  let v: unknown = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const obj = v as Record<string, unknown>;
  if (Object.keys(obj).length !== GEO_KEYS.length) return null;

  const out = {} as GeoTarget;
  let suma = 0;
  for (const k of GEO_KEYS) {
    const n = obj[k];
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > GEO_TOTAL) return null;
    out[k] = n;
    suma += n;
  }
  return suma === GEO_TOTAL ? out : null;
}

/**
 * La lista para pintar: región + peso, ordenada por peso descendente, con las
 * que no van al mapa siempre al final.
 *
 * El orden importa porque la leyenda numera las filas (01, 02, …): un "rank"
 * que no siga a los pesos se lee como un error. Y "Otros / Efectivo" va último
 * aunque su peso creciera — no es una región que compita con las demás, es el
 * residual que cierra el 100%.
 */
export function geoOrdenado(t: GeoTarget): Array<GeoRegion & { peso: number }> {
  return GEO_REGIONES.map((r) => ({ ...r, peso: t[r.key] })).sort((a, b) => {
    if (!!a.sinMapa !== !!b.sinMapa) return a.sinMapa ? 1 : -1;
    return b.peso - a.peso;
  });
}
