// Modelo de contenido de los informes-artículo. Cada informe que hoy vive como
// PDF en gbengochea.com.uy se transcribe a una lista ordenada de `Bloque`s: la
// prosa se cura a mano y los gráficos/tablas se RECREAN on-brand (editorial v2:
// serif para el argumento, mono para todo número, datos sobre hairlines). La
// página /informes/[slug] consume este contenido; el PDF original queda como
// descarga. Ver docs/lenguaje-visual.md §6 "Datos como diseño".

/** Un dato puntual: etiqueta + valor porcentual. `valor: 1.8` ⇒ "+1,80 %". */
export type Dato = { etiqueta: string; valor: number };

/** Grupo de datos rotulado para un gráfico de barras (ej. "Monedas", "América"). */
export type GrupoDatos = { nombre: string; datos: Dato[] };

/** Definición de una columna de tabla. */
export type Columna = {
  titulo: string;
  /** Si es un retorno: se formatea con signo y "%", y se colorea pos/neg. */
  delta?: boolean;
  /** Sufijo para valores numéricos que NO son delta (ej. " %"). */
  sufijo?: string;
};

/**
 * Bloques de contenido, en orden de lectura. Unión discriminada por `tipo`:
 * el renderer (ArticuloInforme) hace un switch exhaustivo sobre esto.
 */
export type Bloque =
  /** Cabecera de sección: índice + eyebrow (split-label) + titular Arial. */
  | { tipo: "seccion"; numero: string; titulo: string; eyebrow?: string }
  /** Párrafo de prosa en Markdown. El primero del artículo lleva capitular. */
  | { tipo: "parrafo"; md: string }
  /** Subtítulo dentro de una sección (ej. país o tema). `volanta` = matiz en gris. */
  | { tipo: "subtitulo"; titulo: string; volanta?: string }
  /** Lista de viñetas (el mensual abre con bullets de "Visión de mercado"). */
  | { tipo: "lista"; items: string[] }
  /** Cita destacada — momento de respiro editorial (ej. comunicado del BCU). */
  | { tipo: "cita"; texto: string; fuente?: string }
  /** Tabla de datos numéricos, renderizada con `.fin-table`. */
  | { tipo: "tabla"; titulo?: string; columnas: Columna[]; filas: (string | number)[][]; nota?: string }
  /** Gráfico de barras de retornos, uno o varios grupos en grilla. */
  | { tipo: "barras"; titulo?: string; grupos: GrupoDatos[]; nota?: string };

/** Un punto del "at a glance" del hero: etiqueta breve + la línea de la semana. */
export type ResumenItem = { etiqueta: string; texto: string };

/** El "gráfico de la semana" — un dato protagonista, curado, para el hero. */
export type GraficoSemana = {
  titulo: string;
  subtitulo?: string;
  datos: Dato[];
  nota?: string;
};

/** Contenido editorial completo de un informe. */
export type ContenidoInforme = {
  /** Volanta corta sobre el titular (ej. "Informe semanal"). */
  volanta: string;
  /** Titular editorial grande, en serif. Oración declarativa con punto final. */
  titular: string;
  /** Bajada / standfirst: una o dos oraciones que resumen la edición. */
  bajada: string;
  /** Autor tal como firma el informe (ej. "Ec. Adrián Moreira, CFA"). */
  autor: string;
  /** "La semana en tres líneas" — la tesis de un vistazo, en el hero. */
  resumen: ResumenItem[];
  /** Dato protagonista del hero. Opcional: no todo informe lo tiene. */
  graficoSemana?: GraficoSemana;
  /** Bloques en orden de lectura. */
  bloques: Bloque[];
};
