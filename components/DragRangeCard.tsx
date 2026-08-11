"use client";

import { css } from "@/lib/css";

/**
 * Lectura del tramo medido: un renglón único que flota CENTRADO sobre la banda
 * mientras se arrastra. Antes los números vivían en una tira DEBAJO del
 * gráfico: el ojo tenía que soltar la curva, bajar, leer y volver — justo
 * mientras la mano sigue midiendo. Acá la lectura aparece donde está el gesto.
 *
 * Lo comparten el gráfico de precio de /analisis y el de valor cuota de
 * /bng-seleccion-global, por la misma razón que `components/dragRange.ts`
 * comparte el gesto: medir tiene que sentirse igual en los dos sitios, y una
 * caja duplicada se desincroniza en el primer retoque.
 *
 * La caja NO se posiciona sola: la ubica el gesto, en el mismo evento en que
 * pinta la banda (ver `placeLabel` en dragRange.ts). Este componente sólo pone
 * el contenido y el estilo — de ahí que reciba una ref y quede oculta por CSS
 * hasta que el gesto la muestre.
 */

/** Lectura ya formateada: los números los arma cada gráfico, que sabe con qué
 *  formato muestra los suyos (valor cuota, precio, índice). Las fechas vienen
 *  cortas —"28 sep '22"— porque acá entra todo en un solo renglón. */
export interface DragRangeReading {
  /** Extremo más viejo: fecha/hora y valor. */
  fromLabel: string;
  fromValue: string;
  /** Extremo más nuevo. */
  toLabel: string;
  toValue: string;
  /** Variación del tramo, con signo. */
  pct: string;
  abs: string;
  dir: "up" | "down";
}

/**
 * La invitación al gesto. Vive DENTRO del gráfico y no en una tira debajo:
 *
 *   · como renglón fijo al pie pagaba una franja de layout —hairline y hasta 62px
 *     en el teléfono— para siempre, por una lección que se aprende una vez;
 *   · una ficha de fondo no lleva instrucciones de uso al pie de su gráfico.
 *
 * Pero sacarla del todo tampoco: en touch es la ÚNICA señal de que el gráfico se
 * puede medir (en desktop, al menos, está el cursor de mira). Adentro no cuesta
 * layout, y se desvanece con la primera medición — ya cumplió, y el lugar es
 * justo donde va a aparecer la lectura.
 */
export function DragRangeHint({ hidden }: {
  /** Se apaga con el arrastre y NO vuelve: quien pasa `hidden` es el gráfico, y
   *  lo deja en true desde la primera medición (la lección se aprende una vez, y
   *  en una caja de teléfono cualquier texto encima compite con la serie). */
  hidden: boolean;
}) {
  return (
    <>
      <span className="drag-hint" data-hidden={hidden || undefined} aria-hidden>
        Arrastrá para medir<span className="drag-hint-opt"> un tramo</span>
      </span>
      <style>{css`
        /* Centrado arriba, no en una esquina: las esquinas son de los ejes —a la
           izquierda el hint se montaba sobre la primera marca de la escala de
           revenue, que no siempre está y no siempre mide lo mismo—, y el centro
           es justo donde va a salir la lectura cuando el gesto empiece. */
        .drag-hint {
          position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
          z-index: 3; pointer-events: none; white-space: nowrap;
          /* Del color del canvas —cada gráfico pinta el suyo en --chart-bg—, sin
             borde: en una caja baja de teléfono la serie pasa justo por acá
             arriba y el texto encima de la curva no se lee. Con el fondo se
             despega sin convertirse en una tarjeta. */
          background: var(--chart-bg, #FFFFFF); padding: 1px 6px;
          font-family: var(--font-mono), "IBM Plex Mono", ui-monospace, monospace;
          font-size: 10.5px; letter-spacing: 0.04em;
          color: var(--site-ink-3, #797D99); opacity: 0.75;
          transition: opacity 140ms ease;
        }
        .drag-hint[data-hidden] { opacity: 0; }
        /* En el teléfono el gráfico es chico y el renglón corto deja aire a los
           dos lados del pane, en vez de tocar los dos ejes. */
        @media (max-width: 520px) {
          .drag-hint-opt { display: none; }
        }
      `}</style>
    </>
  );
}

export function DragRangeCard({
  ref,
  reading,
}: {
  ref: React.Ref<HTMLDivElement>;
  /** `null` sólo antes de la primera medición: después se deja la última
   *  lectura montada aunque la caja esté oculta, para que el ancho ya esté
   *  medido cuando arranque el arrastre siguiente — el gesto la centra, y
   *  centrar sin ancho la dejaría corrida medio renglón (ver dragRange.ts). */
  reading: DragRangeReading | null;
}) {
  return (
    <>
      <div ref={ref} className="drag-read" aria-hidden>
        {reading && (
          <>
            {/* La variación primero: es el titular de la medición. Las dos
                puntas van detrás, que es el respaldo de dónde salió. */}
            <span className="drag-read-pct" data-dir={reading.dir}>{reading.pct}</span>
            <span className="drag-read-abs">{reading.abs}</span>
            <i className="drag-read-sep" />
            <span className="drag-read-d">{reading.fromLabel}</span>
            <b className="drag-read-v">{reading.fromValue}</b>
            <span className="drag-read-arrow">→</span>
            <span className="drag-read-d">{reading.toLabel}</span>
            <b className="drag-read-v">{reading.toValue}</b>
          </>
        )}
      </div>

      <style>{css`
        /* Fondo pleno y hairline, sin sombra ni radio: es una anotación de dato
           sobre el gráfico, no una tarjeta flotante (docs/lenguaje-visual.md). */
        .drag-read {
          position: absolute; top: 0; left: 0;
          visibility: hidden; pointer-events: none; z-index: 3;
          /* Piso de ancho: en el PRIMER arrastre de la página la caja todavía no
             tiene contenido cuando el gesto la ubica, y sin ancho el centrado
             sale corrido por un frame. */
          min-width: 120px;
          padding: 5px 10px;
          background: #FFFFFF;
          border: 1px solid var(--site-border-2, #D7D9E8);
          display: flex; align-items: baseline; gap: 7px;
          font-family: var(--font-mono), "IBM Plex Mono", ui-monospace, monospace;
          font-variant-numeric: tabular-nums;
          /* Un renglón, siempre — y si ni recortando el contenido entra en el
             gráfico, se corta contra el borde en vez de desbordarlo (el gesto le
             pone de techo el ancho del pane; ver placeLabel en dragRange.ts). */
          white-space: nowrap; overflow: hidden;
          /* Sólo el eje Y: el cambio de arriba a abajo —cuando la serie ocupa la
             parte alta— es un salto de todo el gráfico y merece animarse. La X
             va por transform y sin transición: tiene que seguir al cursor. */
          transition: top 150ms ease;
        }

        .drag-read-pct { font-size: 12px; font-weight: 600; line-height: 1.2; }
        .drag-read-pct[data-dir="up"]   { color: var(--pos, #1F6B45); }
        .drag-read-pct[data-dir="down"] { color: var(--neg, #8E2A2A); }
        .drag-read-abs { font-size: 10.5px; color: var(--site-ink-3, #797D99); }
        .drag-read-sep {
          width: 1px; align-self: stretch; margin: 1px 2px;
          background: var(--site-border, #E7E8F2);
        }
        .drag-read-d { font-size: 10.5px; color: var(--site-ink-3, #797D99); }
        .drag-read-v { font-size: 11px; font-weight: 500; color: var(--site-ink, #16193A); }
        .drag-read-arrow { font-size: 10.5px; color: var(--site-ink-3, #797D99); }

        /* En un teléfono el renglón entero no entra sobre la serie, así que la
           lectura se poda en dos escalones, sacando siempre lo más recuperable
           por otro lado. Medido contra el ANCHO DEL PANE, que es bastante menos
           que el del teléfono: el eje de precios se lleva unos 50px.

           1. ≤520 (pane ~330): se caen los VALORES de las puntas — la mira los
              muestra contra el eje mientras el dedo está apoyado.
           2. ≤400 (pane ~250): se cae también la variación ABSOLUTA, que se
              deduce del porcentaje y de la escala. Quedan la variación y las dos
              fechas, que es lo que no se lee en ningún otro lado. */
        @media (max-width: 520px) {
          .drag-read { padding: 4px 8px; gap: 6px; min-width: 0; }
          .drag-read-v { display: none; }
          .drag-read-pct { font-size: 11.5px; }
          .drag-read-abs, .drag-read-d, .drag-read-arrow { font-size: 10px; }
        }
        @media (max-width: 400px) {
          .drag-read-abs { display: none; }
        }
      `}</style>
    </>
  );
}
