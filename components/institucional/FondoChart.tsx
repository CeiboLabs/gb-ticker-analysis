"use client";

import { useEffect, useRef, useState } from "react";
import type { FundNavPoint } from "@/lib/fondo";
import { fmtNav, fmtFechaCorta } from "@/lib/useFondo";
import { DragRangePrimitive } from "@/components/DragRangePrimitive";
import { LineShadowPrimitive } from "@/components/LineShadowPrimitive";
import { CrosshairPriceLabelPrimitive } from "@/components/CrosshairPriceLabelPrimitive";
import { DragRangeCard, DragRangeHint } from "@/components/DragRangeCard";
import { css } from "@/lib/css";
import {
  attachDragRange,
  chronological,
  type DragRangeSelection,
} from "@/components/dragRange";

// Curva de valor cuota del fondo, renderizada con el MISMO motor que el gráfico
// de los análisis de tickers (lightweight-charts v5), la misma estética
// institucional y EL MISMO gesto de medición: apretar, arrastrar y soltar marca
// un tramo y da su variación (components/dragRange). A diferencia del de tickers
// no tiene intradía ni barras de ingresos —un fondo sólo tiene cierres diarios de
// NAV—, y la serie llega ya recortada por período desde FondoPerformance (no
// fetchea).

// Paleta institucional — espejo de los tokens de app/globals.css :root.
const PALETTE = {
  // El canvas se pinta del MISMO color que la banda que lo contiene
  // (--surface-muted, la sección #performance) para que no se note la costura:
  // el frame (.perf-chart-frame) pasa a ser un contorno hairline, no una tarjeta
  // blanca flotando sobre la banda. Si cambia el fondo de la sección, hay que
  // cambiar este valor con él — el canvas no hereda CSS.
  bg: "#F4F5FB",     // --surface-muted
  ink3: "#797D99",     // --site-ink-3
  ink4: "#9FA2C0",
  // Las reglas del gráfico van RECALIBRADAS a la banda, no copiadas del token.
  // --navy-050 (#ECEDF6) estaba calculado contra blanco: sobre la banda muted
  // queda en delta 8 —contra 19 que tenía— y la grilla se borra. El nivel al que
  // sube es el de --site-border, que es lo que usan las tablas de la sección
  // sobre este mismo fondo: la grilla es la línea más suave del sistema, así que
  // no puede pesar MÁS que las reglas de las tablas (ese fue el primer intento).
  // El eje va un escalón más oscuro, igualado al contorno del marco
  // (.perf-chart-frame): el borde del canvas y el de la caja son un solo trazo.
  rule: "#DCDEEE",     // eje + contorno del marco, sobre --surface-muted
  ruleSoft: "#E7E8F2", // grilla — mismo peso que los hairlines de las tablas
  navy: "#0f2249",     // --navy
  ink2: "#4A4E6B",     // --site-ink-2
  paper: "#FBFBFE",    // --paper (texto de etiquetas sobre navy)
  // Benchmark: coral FT. La línea de referencia se distingue POR TONO, no por
  // punteado (ver el bloque de `benchSeries` para el porqué del cambio), y el
  // tono no puede ser el rojo semántico —#8E2A2A, --neg— porque en esta misma
  // sección hay tablas donde el rojo significa "rendimiento negativo": un rojo
  // de dato y un rojo de serie compitiendo enseñan dos lecturas contradictorias.
  // El coral #C24A3A es el tono que docs/lenguaje-visual.md (regla 4 de color)
  // ya tenía reservado para exactamente esto —charts comparativos, sin tocar el
  // par rojo/verde—, así que la línea entra al sistema en vez de abrirle una
  // excepción. Da 4,45:1 sobre la banda muted; el gris que reemplaza daba 2,30:1,
  // por debajo del 3:1 que WCAG le pide a un objeto gráfico.
  bench: "#C24A3A",    // coral FT — comparativas (docs/lenguaje-visual.md §1.4)
  // Sombra proyectada de la curva del fondo (ver LineShadowPrimitive). Va SÓLO
  // en la serie protagonista: el benchmark es una referencia reescalada y
  // sombrearlo también pondría a las dos a pelear por el mismo primer plano.
  shadow: "rgba(15, 34, 73, 0.42)",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LineSeriesApi = any;

// Formateador de las etiquetas de PRECIO del gráfico (eje + mira). El mismo
// formateador atiende a los dos, pero no necesitan lo mismo:
//
//   · las marcas del eje caen siempre en valores redondos (1.050, 1.100, 1.150…)
//     y ahí los decimales son ruido puro — ocho etiquetas "1.400,00" apiladas se
//     comían 70px de los 312 del gráfico en un teléfono, un 22% del ancho para
//     no decir nada;
//   · el valor bajo la mira es un dato real (1.369,37) y ahí el decimal ES el
//     dato.
//
// Se distinguen solos: entero ⇒ marca del eje, con decimales ⇒ lectura. No hay
// pérdida de precisión en ningún lado y el eje angosta en cualquier viewport.
const etiquetaPrecio = (formatValue: (n: number) => string) => (p: number) =>
  Number.isInteger(p) ? p.toLocaleString("es-UY", { maximumFractionDigits: 0 }) : formatValue(p);

// "28 sep 2022" → "28 sep '22". La lectura del tramo entra en UN renglón sobre
// el gráfico: ahí el siglo es ruido, y son dos fechas.
const fechaTramo = (dia: string) => fmtFechaCorta(dia).replace(/ (\d{2})(\d{2})$/, " '$2");

// ¿El gráfico está en una caja de teléfono? Se decide por el ANCHO REAL del
// contenedor y no por un media query: lo que importa es cuánto le queda a la
// serie después del eje, y eso es una medida del elemento, no del viewport.
const angosto = (el: HTMLElement) => el.clientWidth < 420;

export function FondoChart({
  series,
  benchmark = [],
  formatValue = fmtNav,
  unitLabel,
  seriesLabel = "Fondo",
  benchLabel = "Benchmark",
  lineKind = "fund",
}: {
  series: FundNavPoint[];
  /** Serie del benchmark, alineada por fecha. Vacía ⇒ sólo se dibuja el fondo. */
  benchmark?: FundNavPoint[];
  /** Formato de los valores en eje, crosshair y puntos fijados (default: valor cuota). */
  formatValue?: (n: number) => string;
  /** Unidad del eje (p. ej. "USD" o "Índice · base 100"). Se rotula una vez arriba
   *  del gráfico, no en cada marca del eje. */
  unitLabel?: string;
  seriesLabel?: string;
  benchLabel?: string;
  /**
   * Qué ES la serie protagonista. En pre-lanzamiento el Fondo todavía no tiene
   * valor cuota, así que la línea principal puede no ser la suya: el benchmark
   * ("bench") o el backtest de la estrategia ("sim"). Entra igual por `series`
   * —es la que se mide con el gesto de arrastre— pero no puede vestirse de
   * fondo: va en tono subordinado y sin sombra proyectada, porque el navy pleno
   * con sombra es del valor cuota y de nadie más. La leyenda la nombra siempre.
   */
  lineKind?: "fund" | "bench" | "sim";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Tramo medido con el gesto de arrastre, en dos lugares y por dos motivos:
  //
  //   · el ref es el tramo VIGENTE —lo escribe el propio gesto— y sirve para
  //     reponerlo si hay que recrear el gráfico;
  //   · el estado es el CONTENIDO de la caja de lectura, y por eso nunca vuelve
  //     a null: al soltar, la caja se esconde pero queda montada con la última
  //     medición, así ya tiene ancho medido cuando el gesto la ubica en el
  //     arrastre siguiente (ver DragRangeCard).
  const [reading, setReading] = useState<DragRangeSelection | null>(null);
  const selectionRef = useRef<DragRangeSelection | null>(null);
  const [dragging, setDragging] = useState(false);
  const primitiveRef = useRef<DragRangePrimitive | null>(null);
  const lineSeriesRef = useRef<LineSeriesApi>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Al cambiar la ventana (cambio de período en FondoPerformance) se borra el
  // tramo: la serie es otra y la medición ya no corresponde. Ese cambio además
  // recrea el gráfico, así que hay que limpiar el ref o el nuevo lo repondría.
  const sig = series.length > 0 ? `${series[0].dia}|${series[series.length - 1].dia}|${series.length}` : "";
  useEffect(() => {
    selectionRef.current = null;
  }, [sig]);

  useEffect(() => {
    if (!containerRef.current || series.length === 0) return;

    let destroyed = false;
    let chartInstance: { remove: () => void } | null = null;
    let observerInstance: ResizeObserver | null = null;
    let detachPointer: (() => void) | null = null;

    import("lightweight-charts").then(({ createChart, LineSeries, CrosshairMode, LineStyle, TrackingModeExitMode }) => {
      if (destroyed || !containerRef.current) return;

      const container = containerRef.current;
      const chart = createChart(container, {
        width: container.clientWidth,
        // El alto lo manda el CSS (.fondo-chart-canvas), no un número acá: en el
        // teléfono baja a 220 y el ResizeObserver de abajo lo replica en el
        // gráfico. Con 300 fijos y 242px de plot la serie quedaba en una caja
        // casi cuadrada (0,89:1) y una curva de tres años no se lee en un
        // cuadrado — el gesto de una serie de tiempo es horizontal.
        height: container.clientHeight || 300,
        layout: {
          background: { color: PALETTE.bg },
          textColor: PALETTE.ink3,
          attributionLogo: false,
        },
        localization: {
          locale: "es-UY",
          priceFormatter: etiquetaPrecio(formatValue),
          timeFormatter: (time: import("lightweight-charts").Time) =>
            typeof time === "string" ? fmtFechaCorta(time) : String(time),
        },
        grid: {
          // Sólo horizontales, igual que en el informe de equity: son las que
          // ayudan a leer un valor contra el eje. Las verticales no aportan —la
          // fecha se lee abajo— y encajonan el gráfico en una cuadrícula.
          vertLines: { visible: false },
          horzLines: { color: PALETTE.ruleSoft },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: PALETTE.ink4, labelBackgroundColor: PALETTE.navy },
          horzLine: {
            color: PALETTE.ink4, labelBackgroundColor: PALETTE.navy,
            // La escala de precios RESERVA el ancho de esta etiqueta, no el de
            // sus marcas: por eso el eje seguía midiendo 70px después de sacarle
            // los decimales a las marcas —el chip de la mira sí los lleva—. En
            // pantalla angosta la apagamos y el eje se achica a lo que miden sus
            // números. No se pierde nada: en touch la mira sólo aparece durante
            // el arrastre, y ahí los DOS extremos con decimales ya están en la
            // lectura de abajo del gráfico —mientras que el chip, además, tapaba
            // justo las marcas del eje debajo del dedo—. La etiqueta de FECHA es
            // la del eje de tiempo (vertLine) y no se toca.
            labelVisible: !angosto(container),
          },
        },
        rightPriceScale: {
          borderColor: PALETTE.rule,
          textColor: PALETTE.ink3,
          scaleMargins: { top: 0.12, bottom: 0.08 },
        },
        timeScale: {
          borderColor: PALETTE.rule,
          timeVisible: false,
          secondsVisible: false,
          // SIN esto, en el teléfono la ventana «Máx» del backtest se ve
          // RECORTADA por delante. La librería tiene un ancho mínimo por punto
          // (minBarSpacing, 0.5px por defecto) y fitContent no lo puede pisar:
          // con 328px de plot entran 656 puntos, y la simulación son ~1.000
          // cierres diarios, así que el encuadre se comía el primer año y medio
          // —arrancaba en 2024 con los chips diciendo 2022— sin ninguna señal de
          // que faltaba serie. Bajándolo, fitContent comprime hasta donde haga
          // falta y la ventana entra entera en cualquier ancho. No afecta a las
          // ventanas cortas: ahí el espaciado que calcula fitContent es mucho
          // mayor que este piso.
          minBarSpacing: 0.02,
        },
        handleScroll: false,
        handleScale: {
          mouseWheel: false,
          pinch: false,
          axisPressedMouseMove: false,
          axisDoubleClickReset: false,
        },
        // SIN esto, en el teléfono la mira queda colgada al soltar el arrastre.
        // La librería tiene un modo de seguimiento para touch —apretar y
        // sostener 240ms lo prende, y es lo que dibuja la mira mientras se mide,
        // porque en un teléfono no hay hover— y por defecto lo apaga recién en
        // el toque SIGUIENTE (OnNextTap). O sea: al levantar el dedo la mira se
        // queda dibujada, y el arrastre siguiente la mueve RELATIVA a donde
        // quedó en vez de al dedo, así que aparece en cualquier lado (medido:
        // soltando en x=200 quedaba clavada ahí; el arrastre siguiente, soltando
        // en 260, la dejaba en 327 —el borde del pane—). Con OnTouchEnd el
        // seguimiento muere con el dedo: el gesto no deja rastro y cada arrastre
        // arranca de cero.
        trackingMode: { exitMode: TrackingModeExitMode.OnTouchEnd },
      });

      chartInstance = chart;

      // Dedup + orden ascendente por fecha.
      const clean = (arr: FundNavPoint[]) => {
        const seen = new Set<string>();
        return [...arr]
          .sort((a, b) => a.dia.localeCompare(b.dia))
          .filter((p) => {
            if (seen.has(p.dia)) return false;
            seen.add(p.dia);
            return true;
          });
      };
      const toPoints = (rows: FundNavPoint[], scale = 1) =>
        rows.map((p) => ({
          time: p.dia as unknown as import("lightweight-charts").Time,
          value: p.nav * scale,
        }));

      // El fondo se grafica en su valor cuota real. El benchmark es un índice de
      // escala arbitraria: lo reescalamos para que arranque en el mismo valor
      // cuota inicial del fondo, así ambas líneas comparten origen y el eje lee
      // en valor cuota —no en base 100—.
      const fundRows = clean(series);
      const points = toPoints(fundRows);
      const fundAnchor = fundRows.length > 0 ? fundRows[0].nav : null;

      const benchRows = benchmark.length > 0 ? clean(benchmark) : [];
      const benchScale =
        fundAnchor != null && benchRows.length > 0 && benchRows[0].nav !== 0
          ? fundAnchor / benchRows[0].nav
          : 1;
      const benchPoints = toPoints(benchRows, benchScale);

      // Benchmark primero (queda por debajo); la línea del fondo se dibuja encima.
      // Se guarda fuera del if: el gesto necesita apagarle el punto mientras
      // haya tramo, igual que a la del fondo.
      //
      // CONTINUA, NO PUNTEADA (pedido del cliente, 13-ago-2026: "quedan puntos
      // apuntando para varios lados"). Es el mismo defecto que ya había obligado
      // a dejar continua a la serie protagonista, y por el mismo motivo: son
      // años de cierres diarios en ~700px, así que cada guión abarca varios
      // puntos y toma la pendiente del tramo que le tocó. En una curva que sube
      // y baja, los guiones salen con inclinaciones distintas y a distinta
      // distancia entre sí —el punteado no cae en fase con la señal—, y el ojo
      // lee eso como render roto, no como convención de "línea de referencia".
      // El punteado sólo hace su trabajo cuando cada guión cubre un tramo
      // monótono; a esta densidad no queda ninguno.
      //
      // Lo que el punteado aportaba —separar la referencia del protagonista— lo
      // toma el color (PALETTE.bench). Un trazo continuo en coral separa MEJOR
      // que uno punteado en gris: el tono se lee a cualquier densidad y a
      // cualquier tamaño, incluso en la captura de pantalla de un teléfono, y no
      // depende de que el guión sobreviva al muestreo.
      let benchSeries: LineSeriesApi = null;
      if (benchPoints.length > 0) {
        benchSeries = chart.addSeries(LineSeries, {
          color: PALETTE.bench,
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          priceScaleId: "right",
          priceLineVisible: false,
          // Sin etiqueta de último valor: si la del fondo no va (vive arriba, en
          // la tira), la del benchmark sola quedaría flotando sin par.
          lastValueVisible: false,
          priceFormat: { type: "custom", formatter: (p: number) => formatValue(p), minMove: 0.01 },
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 3,
          crosshairMarkerBorderWidth: 0,
          crosshairMarkerBackgroundColor: PALETTE.bench,
        });
        benchSeries.setData(benchPoints);
      }

      // Tono de la protagonista: navy pleno SÓLO si es el valor cuota del
      // fondo. Cualquier otra serie (benchmark suelto, backtest) va en el gris
      // azulado --site-ink-2, un escalón por debajo del navy.
      const esFondo = lineKind === "fund";
      const mainColor = esFondo ? PALETTE.navy : PALETTE.ink2;

      const lineSeries = chart.addSeries(LineSeries, {
        color: mainColor,
        lineWidth: 2,
        // Continua siempre, también cuando la protagonista no es el valor cuota:
        // sobre una serie diaria de años el punteado se pulveriza y la curva se
        // lee rota (el porqué largo está arriba, en benchSeries — desde el
        // 13-ago-2026 no queda ninguna línea punteada en este gráfico). Que esta
        // serie no sea el fondo lo dicen el tono, la falta de sombra y cuatro
        // rótulos de texto.
        priceScaleId: "right",
        priceLineVisible: false,
        // El valor cuota ya está en la tira de arriba — no se repite en el eje.
        lastValueVisible: false,
        priceFormat: { type: "custom", formatter: (p: number) => formatValue(p), minMove: 0.01 },
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        // Punto pleno, sin aro. El primitive del tramo lee ESTAS opciones, así
        // que el punto del hover y el del extremo medido cambian juntos.
        crosshairMarkerBorderWidth: 0,
        crosshairMarkerBackgroundColor: mainColor,
      });
      lineSeries.setData(points);
      lineSeriesRef.current = lineSeries;

      // Etiqueta de precio de la mira acotada al lienzo: sin esto, contra el
      // borde de arriba o el de abajo el chip se dibuja mitad afuera y sale
      // cortado —la librería sólo acota la de FECHA—. No cambia nada más: el
      // chip es el mismo y la opción de arriba (labelVisible) lo sigue
      // mandando, también en pantalla angosta.
      lineSeries.attachPrimitive(new CrosshairPriceLabelPrimitive());

      // La curva deja caer su sombra (zOrder bottom: la línea sigue nítida y el
      // benchmark, que se dibuja aparte, conserva su tono). La sombra es un
      // recurso de jerarquía: sólo la lleva el fondo.
      if (esFondo) {
        const shadow = new LineShadowPrimitive({ color: PALETTE.shadow });
        lineSeries.attachPrimitive(shadow);
        shadow.setPoints(points.map((p) => ({ time: p.time as unknown as string, value: p.value })));
      }

      chart.timeScale().fitContent();

      const primitive = new DragRangePrimitive({
        band: "rgba(15, 34, 73, 0.07)",
        edge: "rgba(15, 34, 73, 0.32)",
        marker: mainColor,
        markerHalo: PALETTE.bg,
      });
      lineSeries.attachPrimitive(primitive);
      primitiveRef.current = primitive;

      // La medición corre sobre la serie del FONDO: el benchmark es una
      // referencia reescalada, no el dato que se mide.
      detachPointer = attachDragRange({
        chart,
        container,
        points: fundRows.map((p) => ({ time: p.dia, value: p.nav })),
        primitive,
        markerSeries: [lineSeries, benchSeries],
        initial: selectionRef.current,
        onSelection: (sel) => {
          selectionRef.current = sel;
          if (sel) setReading(sel);
        },
        onDragging: setDragging,
        labelEl: cardRef,
      });

      // Ancho Y ALTO: el alto sale del CSS (baja en el teléfono), así que rotar
      // el aparato o cruzar el breakpoint tiene que re-encuadrar el gráfico. Y
      // con el ancho puede cambiar de lado del umbral de `angosto`, así que la
      // etiqueta de la mira se recalcula acá también.
      observerInstance = new ResizeObserver(() => {
        const el = containerRef.current;
        if (!el) return;
        chart.applyOptions({
          width: el.clientWidth,
          height: el.clientHeight,
          crosshair: { horzLine: { labelVisible: !angosto(el) } },
        });
      });
      observerInstance.observe(container);
    });

    return () => {
      destroyed = true;
      detachPointer?.();
      observerInstance?.disconnect();
      chartInstance?.remove();
      primitiveRef.current = null;
      lineSeriesRef.current = null;
    };
  }, [series, benchmark, formatValue, lineKind]);

  if (series.length === 0) return null;

  // Lectura del tramo, siempre del extremo más viejo al más nuevo.
  const measure = (() => {
    const sel = reading;
    if (!sel) return null;
    const [a, b] = chronological(sel.from, sel.to);
    if (!a.price) return null;
    const abs = b.price - a.price;
    const pct = (abs / a.price) * 100;
    return {
      fromLabel: fechaTramo(String(a.time)),
      fromValue: formatValue(a.price),
      toLabel: fechaTramo(String(b.time)),
      toValue: formatValue(b.price),
      // Coma decimal, como el resto de los números de la página.
      pct: `${pct >= 0 ? "+" : ""}${pct.toFixed(2).replace(".", ",")}%`,
      abs: `${abs >= 0 ? "+" : ""}${formatValue(abs)}`,
      dir: (abs >= 0 ? "up" : "down") as "up" | "down",
    };
  })();

  return (
    <div className="fondo-chart">
      {(benchmark.length > 0 || lineKind !== "fund" || unitLabel) && (
        <div className="fondo-chart-legend">
          {/* Con una sola línea la leyenda normalmente sobra —se sabe qué es—,
              salvo justo cuando esa línea NO es el fondo: ahí es obligatoria. */}
          {(benchmark.length > 0 || lineKind !== "fund") && (
            <>
              <span className="fondo-chart-leg">
                <span
                  className="fondo-chart-leg-line"
                  data-kind={lineKind === "fund" ? "fund" : "bench-solo"}
                />
                {seriesLabel}
              </span>
              {benchmark.length > 0 && (
                <span className="fondo-chart-leg">
                  <span className="fondo-chart-leg-line" data-kind="bench" />
                  {benchLabel}
                </span>
              )}
            </>
          )}
          {/* Unidad del eje, alineada a la derecha —donde vive la escala—. */}
          {unitLabel && <span className="fondo-chart-unit">{unitLabel}</span>}
        </div>
      )}

      {/* Cursor de mira y sin selección de texto: el arrastre es un gesto de
          medición, no una selección del documento.

          touch-action — SIN esto la medición NO EXISTE en el teléfono.
          Con el valor por defecto el navegador se reserva el gesto en los dos
          ejes: al segundo pointermove decide que el dedo está haciendo scroll,
          dispara pointercancel y el arrastre muere antes de marcar un tramo
          (medido: down 1, move 2, cancel 1, ninguna lectura). Dejándole sólo el
          eje vertical (y el pinch, que no se le saca a nadie), el horizontal
          queda para nosotros y la página se sigue scrolleando igual. La
          propiedad no se hereda pero sí se compone con la de los ancestros, así
          que alcanza con ponerla acá: los canvas que inyecta la librería adentro
          quedan cubiertos. */}
      {/* Envoltorio posicionado: la caja de lectura se ubica contra ESTA caja,
          que es la misma del gráfico. No va adentro del contenedor del gráfico
          porque ese div es de la librería —le mete sus canvas y le maneja el
          tamaño—, y un hijo ajeno ahí adentro es pedir problemas. */}
      <div className="fondo-chart-plot" style={{ ["--chart-bg" as string]: PALETTE.bg }}>
        <div
          ref={containerRef}
          className="fondo-chart-canvas"
          style={{
            cursor: "crosshair",
            touchAction: "pan-y pinch-zoom",
            userSelect: dragging ? "none" : undefined,
            WebkitUserSelect: dragging ? "none" : undefined,
          }}
        />
        <DragRangeHint hidden={dragging || measure !== null} />
        {/* Siempre montada: el gesto la muestra, la centra sobre el tramo y la
            vuelve a esconder al soltar. */}
        <DragRangeCard ref={cardRef} reading={measure} />
      </div>

      <style>{css`
        /* El alto vive acá y no en un style inline para que el teléfono lo pueda
           bajar: la caja de la serie tiene que leerse horizontal (ver el
           comentario de createChart). El ResizeObserver replica el valor en el
           gráfico, así que basta con cambiarlo por media query. */
        .fondo-chart-canvas { height: 300px; }
        .fondo-chart-plot { position: relative; }

        .fondo-chart-legend {
          display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
          margin-bottom: 10px;
        }
        .fondo-chart-leg {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 12.5px; font-weight: 500; color: var(--site-ink-2);
        }
        .fondo-chart-leg-line { width: 18px; height: 0; display: inline-block; }
        .fondo-chart-leg-line[data-kind="fund"] {
          border-top: 2px solid var(--navy);
        }
        /* Espeja el trazo: continuo y en coral (PALETTE.bench). La muestra de la
           leyenda tiene que ser la MISMA línea que el gráfico —es lo único que
           ata el rótulo a la curva—, así que los dos valores se mueven juntos. */
        .fondo-chart-leg-line[data-kind="bench"] {
          border-top: 2px solid #C24A3A;
        }
        /* Protagonista que NO es el valor cuota (pre-lanzamiento: benchmark
           suelto o backtest): continua, en el tono subordinado — espeja
           PALETTE.ink2 del trazo. */
        .fondo-chart-leg-line[data-kind="bench-solo"] {
          border-top: 2px solid var(--site-ink-2);
        }
        .fondo-chart-unit {
          margin-left: auto; font-family: var(--font-mono), monospace; font-size: 11px;
          letter-spacing: 0.08em; color: var(--site-ink-3);
        }
        @media (max-width: 560px) {
          /* Caja más baja: con el ancho que gana el marco al ir de borde a borde
             (ver .perf-chart-frame) la serie pasa de 242x272 —cuadrada— a
             ~320x190, que es la proporción con la que se lee una curva. */
          .fondo-chart-canvas { height: 220px; }
          /* La leyenda pasa a pesar menos que el gráfico. */
          .fondo-chart-leg { font-size: 12px; }
        }
        /* Teléfono chico (360 y menos): al eje ya no se le puede sacar más, así
           que la proporción se recupera bajando el alto — 246x162 lee como serie,
           246x192 lee como cuadrado. */
        @media (max-width: 360px) {
          .fondo-chart-canvas { height: 190px; }
        }
      `}</style>
    </div>
  );
}
