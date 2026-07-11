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

/** Un punto de una serie temporal: fecha ISO (YYYY-MM-DD) + valor. */
export type PuntoSerie = { t: string; v: number };

/**
 * Una línea nombrada del gráfico de serie temporal. `enfasis` fija el peso
 * visual: la primaria en navy sólido, la secundaria en un tono claro (ej. en
 * "UI vs USD": el dólar es primario, la UI secundaria).
 */
export type LineaSerie = {
  nombre: string;
  puntos: PuntoSerie[];
  enfasis?: "primaria" | "secundaria";
};

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
  /** Gráfico de barras de retornos, uno o varios grupos en grilla. Se reserva
   *  para el hero de "los que se movieron" (pocos, alto impacto). */
  | { tipo: "barras"; titulo?: string; grupos: GrupoDatos[]; nota?: string }
  /**
   * Gráfico de línea / serie temporal. Una o más líneas sobre un eje de fechas
   * compartido y un solo eje de valores (las series se rebasan a base 100 en el
   * dato cuando hay que compararlas, ej. "UI vs USD (base = 100)"). Recrea los
   * dos gráficos de la página 1 del semanal. OJO: la serie diaria NO está en el
   * PDF —es trazo vectorial—; su dato llega del Excel del cliente.
   */
  | { tipo: "serie"; titulo?: string; subtitulo?: string; lineas: LineaSerie[]; nota?: string }
  /**
   * Grilla de retornos como heatmap (verde/oxblood por signo), fiel a las tablas
   * "Retornos Semanales" del PDF. Misma forma que `barras`; se elige el heatmap
   * para grillas densas (~25 instrumentos) donde las barras quedarían pesadas.
   */
  | { tipo: "retornos"; titulo?: string; grupos: GrupoDatos[]; nota?: string }
  /**
   * Imagen embebida — sobre todo para el MENSUAL, cuyos gráficos son de terceros
   * (Bloomberg, EIA, Goldman…) con su fuente e imposibles de recrear on-brand como
   * los del semanal. `src` es un path SAME-ORIGIN (el CSP del sitio es img-src
   * 'self': nada de hotlink externo); las imágenes se sirven desde el propio host.
   */
  | { tipo: "imagen"; src: string; alt: string; titulo?: string; fuente?: string };

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
