// Registro de las apariciones de la casa en la prensa: menciones en medios,
// columnas propias, entrevistas y participación en eventos.
//
// VACÍO a propósito hasta que llegue material REAL (regla de la casa: todo dato
// institucional sale de gbengochea.com.uy o del cliente — nunca se inventa).
// Para poblarlo alcanza con `medio` + `fecha` + `titulo`; el resto es opcional.
//
// La página /prensa y el link en el navbar/footer se ACTIVAN SOLOS cuando este
// array deja de estar vacío (ver HAY_PRENSA): no hay que tocar nada más. Con el
// array vacío, /prensa muestra un estado "próximamente" honesto y no se linkea
// desde la navegación (para no anunciar una sección vacía en producción).

export type PrensaTipo = "mencion" | "columna" | "entrevista" | "evento";

export type PrensaItem = {
  /** Dónde salió: "El País", "El Observador", "Búsqueda", "Radio Carve", "VTV"… */
  medio: string;
  /** ISO, del más específico al menos: "2026-03-12" · "2026-03" · "2026".
   *  Se usa para ordenar (desc) y agrupar por año. */
  fecha: string;
  /** Titular de la nota, o descripción de la aparición. */
  titulo: string;
  /** Enlace externo a la nota, si está online. Ausente = papel / paywall sin
   *  URL / portal que ya no la aloja → se lista igual, sin flecha. */
  url?: string;
  /** Quién de la casa apareció (opcional; suma autoría). */
  quien?: string;
  /** Clasificación para la etiqueta de la fila. Default: "mencion". */
  tipo?: PrensaTipo;
  /** Nota breve opcional bajo el título: "Requiere suscripción", una cita, etc. */
  nota?: string;
};

// ── El archivo ───────────────────────────────────────────────────────────────
// Sin entradas todavía. Formato de ejemplo (borrar estas líneas al cargar real):
//
//   {
//     medio: "El Observador",
//     fecha: "2026-03-12",
//     titulo: "La deuda uruguaya en un año de tasas altas",
//     url: "https://www.elobservador.com.uy/...",
//     quien: "Gastón Bengochea",
//     tipo: "entrevista",
//   },
export const PRENSA: PrensaItem[] = [];

/** True apenas hay al menos una aparición cargada. Gobierna el link de nav/footer. */
export const HAY_PRENSA = PRENSA.length > 0;

export const PRENSA_TIPO_LABEL: Record<PrensaTipo, string> = {
  mencion: "Mención",
  columna: "Columna",
  entrevista: "Entrevista",
  evento: "Evento",
};

/** Apariciones agrupadas por año, cada grupo y sus filas en orden descendente. */
export function prensaPorAnio(items: PrensaItem[] = PRENSA): { anio: string; items: PrensaItem[] }[] {
  const ordenadas = [...items].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  const grupos: { anio: string; items: PrensaItem[] }[] = [];
  for (const it of ordenadas) {
    const anio = it.fecha.slice(0, 4);
    const grupo = grupos.find((g) => g.anio === anio);
    if (grupo) grupo.items.push(it);
    else grupos.push({ anio, items: [it] });
  }
  return grupos;
}
