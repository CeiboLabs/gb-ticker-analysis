/**
 * Gesto de medición por arrastre: apretar → arrastrar → soltar pinta la banda
 * del tramo y devuelve sus dos extremos. Lo comparten el gráfico de precio de
 * /analisis y el de valor cuota de /bng-seleccion-global, para que medir se
 * sienta igual en todo el sitio.
 *
 * Vive acá afuera y no adentro de cada gráfico porque ÉSTE es el lugar donde
 * estuvieron los bugs del gesto —punto duplicado en dos posiciones, vertical
 * punteada duplicada— y tenerlo dos veces significa arreglarlos dos veces. Los
 * dos gráficos difieren en datos, series y lectura numérica; el gesto no.
 *
 * Sólo maneja el gesto: no calcula la variación (eso lo arma cada componente,
 * que sabe cómo formatea sus valores) ni dibuja (eso es DragRangePrimitive).
 */
import type { IChartApiBase, Time } from "lightweight-charts";
import type { DragRangePrimitive, RangeSelection } from "@/components/DragRangePrimitive";

/** Un extremo del tramo: el punto REAL de la serie, no el precio del pixel. */
export interface DragRangePoint {
  time: string | number;
  price: number;
}

export interface DragRangeSelection {
  from: DragRangePoint;
  to: DragRangePoint;
}

/** Lo único que el gesto necesita de una serie: poder apagarle su punto. */
interface MarkerToggleable {
  applyOptions(options: { crosshairMarkerVisible: boolean }): void;
}

export interface AttachDragRangeParams {
  chart: IChartApiBase<Time>;
  /** El div que contiene al gráfico — sobre él se escucha el `pointerdown`. */
  container: HTMLElement;
  /** Puntos de la serie que se mide, ya ordenados y sin repetidos. */
  points: readonly { time: string | number; value: number }[];
  primitive: DragRangePrimitive;
  /** Series a las que apagarles el punto del crosshair mientras hay tramo. */
  markerSeries: readonly (MarkerToggleable | null | undefined)[];
  /** Tramo vigente al (re)crear el gráfico, para no perderlo en un resize. */
  initial?: DragRangeSelection | null;
  /** Corre en cada cambio del tramo — de acá sale la lectura numérica. */
  onSelection: (selection: DragRangeSelection | null) => void;
  /** Para que el componente pueda cortar la selección de texto mientras dura. */
  onDragging?: (dragging: boolean) => void;
  /**
   * La caja de lectura (`DragRangeCard`), montada por el componente sobre el
   * gráfico. Acá se la UBICA y se la muestra; qué dice la arma el componente.
   *
   * La posición se escribe en el mismo evento que la banda y no con el commit
   * de React: la caja está pegada a un borde que se mueve con el cursor, y un
   * frame de retraso se ve como si se despegara y la persiguiera.
   */
  labelEl?: { readonly current: HTMLElement | null };
}

/** Ordena los extremos cronológicamente: la variación se lee siempre del punto
 *  más viejo al más nuevo, sin importar hacia qué lado se arrastró. */
export function chronological(a: DragRangePoint, b: DragRangePoint): [DragRangePoint, DragRangePoint] {
  const ta = typeof a.time === "number" ? a.time : Date.parse(String(a.time));
  const tb = typeof b.time === "number" ? b.time : Date.parse(String(b.time));
  return ta <= tb ? [a, b] : [b, a];
}

/** Adapta el tramo al tipo `Time` que espera el primitive. */
export function toSelection(sel: DragRangeSelection | null): RangeSelection | null {
  if (!sel) return null;
  const asTime = (t: string | number) => t as unknown as Time;
  return {
    from: { time: asTime(sel.from.time), price: sel.from.price },
    to: { time: asTime(sel.to.time), price: sel.to.price },
  };
}

/** Engancha el gesto. Devuelve la función que lo desengancha. */
export function attachDragRange({
  chart,
  container,
  points,
  primitive,
  markerSeries,
  initial = null,
  onSelection,
  onDragging,
  labelEl,
}: AttachDragRangeParams): () => void {
  let down = false;
  let anchor: DragRangePoint | null = null;

  // El PANE es la caja de la serie, y no arranca en el borde del contenedor:
  // cuando hay un eje izquierdo visible empieza corrido ese ancho. Sin
  // descontarlo la medición cae a la derecha del cursor. `width()` ya devuelve
  // 0 con el eje oculto.
  const paneBox = () => {
    const leftAxis = chart.priceScale("left").width();
    return {
      leftAxis,
      width: chart.paneSize?.().width ?? container.getBoundingClientRect().width - leftAxis,
    };
  };

  // Traduce un x de pantalla al punto REAL de la serie más cercano. Se calcula
  // desde las coordenadas y NO desde el crosshair: durante un arrastre con el
  // botón apretado el crosshair puede dejar de emitir, y la medición quedaría
  // congelada. Así el gesto es determinístico.
  const pointAtX = (clientX: number): DragRangePoint | null => {
    if (points.length === 0) return null;
    const rect = container.getBoundingClientRect();
    const { leftAxis, width: paneWidth } = paneBox();
    // Clampeado al pane: arrastrar más allá del borde mide hasta el extremo.
    const x = Math.max(0, Math.min(clientX - rect.left - leftAxis, paneWidth));
    const t = chart.timeScale().coordinateToTime(x);
    if (t == null) return null;
    const target = typeof t === "number" ? t : Date.parse(String(t));
    if (!Number.isFinite(target)) return null;

    let best: (typeof points)[number] | null = null;
    let bestD = Infinity;
    for (const p of points) {
      const pt = typeof p.time === "number" ? p.time : Date.parse(String(p.time));
      const d = Math.abs(pt - target);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best ? { time: best.time, price: best.value } : null;
  };

  // Mientras hay un tramo dibujado, el extremo lo marca UNA sola capa: el
  // primitive. Se apagan las dos marcas que el gráfico pone por su cuenta en el
  // mismo lugar —cada duplicado se veía como algo dibujado dos veces—:
  //
  //   · El punto del crosshair de cada serie. Pinta el mismo extremo que el del
  //     tramo, y alcanzaba con que uno llegara un frame tarde para verlo
  //     duplicado en dos posiciones.
  //   · La vertical punteada del crosshair. Sigue al cursor CRUDO, mientras que
  //     el borde del tramo cae en el punto de dato: quedaban dos rayas separadas
  //     hasta medio espaciado. La etiqueta de fecha del eje no depende de
  //     `visible` sino de `labelVisible`, así que no se pierde.
  //
  // Sin tramo vuelve a mandar el gráfico, que es el hover de siempre —y el punto
  // es idéntico, así que el relevo no se nota.
  let marksOwned = false;
  const ownCursorMarks = (own: boolean) => {
    if (own === marksOwned) return;
    marksOwned = own;
    for (const s of markerSeries) s?.applyOptions({ crosshairMarkerVisible: !own });
    chart.applyOptions({ crosshair: { vertLine: { visible: !own } } });
  };

  // Ubica la caja de lectura CENTRADA sobre el tramo: centrada pertenece a la
  // banda entera y no a una de sus puntas. Al ser más ancha que un tramo corto,
  // se sale de la banda por los dos lados; eso es correcto, sigue apuntando al
  // medio. Lo único que se corrige en el eje X es que no se salga del gráfico:
  // contra los bordes la caja se frena y el centro se corre. Prefiero eso a
  // recortarla contra el eje.
  //
  // En el eje Y va arriba salvo que ahí esté la serie. En una curva que sube
  // —el caso normal— medir el tramo final dejaba la caja justo encima de la
  // parte alta de la línea, tapando la curva y los dos puntos del tramo. Así que
  // se mira la franja de serie que queda DEBAJO de la caja (no sólo los extremos
  // del tramo: la caja suele ser más ancha que él) y se elige el lado con aire.
  const LABEL_MARGIN = 10;
  let lastMaxWidth = -1;
  const ms = (t: string | number) => (typeof t === "number" ? t : Date.parse(String(t)));

  const placeLabel = (sel: DragRangeSelection | null) => {
    const el = labelEl?.current;
    if (!el) return;
    const ts = chart.timeScale();
    const xTo = sel ? ts.timeToCoordinate(sel.to.time as unknown as Time) : null;
    const xFrom = sel ? ts.timeToCoordinate(sel.from.time as unknown as Time) : null;
    if (!sel || xTo == null || xFrom == null) {
      el.style.visibility = "hidden";
      // Sin transición mientras está escondida: si no, al empezar el arrastre
      // siguiente la caja se desliza desde el lado en que quedó la anterior.
      el.style.transition = "none";
      return;
    }
    const { leftAxis, width: paneWidth } = paneBox();

    // Techo de ancho = el pane. El renglón es de ancho variable (números largos,
    // o el zoom de texto del navegador, que agranda la caja y no el gráfico): si
    // superara al pane, el clamp de abajo la dejaría en x=0 igual y se saldría
    // POR FUERA del gráfico, que en un teléfono es scroll horizontal de todo el
    // documento. Con el techo se recorta contra el borde y no pasa. Se escribe
    // sólo cuando cambia: cada write invalida el layout que se lee dos líneas
    // más abajo, y esto corre en cada pointermove.
    const maxWidth = Math.max(0, Math.round(paneWidth));
    if (maxWidth !== lastMaxWidth) {
      lastMaxWidth = maxWidth;
      el.style.maxWidth = `${maxWidth}px`;
    }

    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const x = Math.max(0, Math.min((xFrom + xTo) / 2 - w / 2, Math.max(0, paneWidth - w)));

    el.style.top = `${Math.round(labelTop(x, w, h))}px`;
    // La X va en transform y la Y en `top`: el transform no transiciona —tiene
    // que pegarse al cursor sin arrastre— y el `top` sí, para que el cambio de
    // lado no sea un salto (la regla vive en el CSS de la caja).
    el.style.transform = `translateX(${Math.round(x + leftAxis)}px)`;
    if (el.style.visibility !== "visible") {
      el.style.visibility = "visible";
      // Reflow: fija la posición de arranque SIN transición y recién después la
      // reactiva, para que anime sólo los cambios de lado dentro del arrastre.
      void el.offsetHeight;
      el.style.transition = "";
    }
  };

  /** Y de la caja: arriba, salvo que la serie no deje lugar. */
  const labelTop = (x: number, w: number, h: number): number => {
    const paneHeight = chart.paneSize?.().height ?? container.clientHeight;
    const series = primitive.series;
    const ts = chart.timeScale();
    const arribaDelTodo = LABEL_MARGIN;
    const abajoDelTodo = Math.max(LABEL_MARGIN, paneHeight - h - LABEL_MARGIN);
    if (!series || points.length === 0) return arribaDelTodo;

    // Franja de tiempo que cubre la CAJA, no el tramo. Los bordes van clampeados
    // al primer y último dato: `coordinateToTime` devuelve null fuera del rango
    // con datos, y la caja se pasa de largo justo en el caso que importa —el
    // tramo contra el final de la serie, que es donde una curva que sube tiene
    // su parte alta—.
    const xPrimero = ts.timeToCoordinate(points[0].time as unknown as Time);
    const xUltimo = ts.timeToCoordinate(points[points.length - 1].time as unknown as Time);
    if (xPrimero == null || xUltimo == null) return arribaDelTodo;
    const xa = Math.max(x, Math.min(xPrimero, xUltimo));
    const xb = Math.min(x + w, Math.max(xPrimero, xUltimo));
    if (xb < xa) return arribaDelTodo; // la caja no tiene serie debajo
    const t0 = ts.coordinateToTime(xa);
    const t1 = ts.coordinateToTime(xb);
    if (t0 == null || t1 == null) return arribaDelTodo;
    const lo = Math.min(ms(t0 as unknown as string | number), ms(t1 as unknown as string | number));
    const hi = Math.max(ms(t0 as unknown as string | number), ms(t1 as unknown as string | number));
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return arribaDelTodo;

    // Alcanza con los extremos de VALOR: priceToCoordinate es monótona, así que
    // el máximo da el punto más alto en pantalla. Dos llamadas en vez de una por
    // punto — esto corre en cada pointermove.
    let vMax = -Infinity;
    let vMin = Infinity;
    for (const p of points) {
      const t = ms(p.time);
      if (t < lo || t > hi) continue;
      if (p.value > vMax) vMax = p.value;
      if (p.value < vMin) vMin = p.value;
    }
    if (vMax === -Infinity) return arribaDelTodo;

    const yAlto = series.priceToCoordinate(vMax);
    const yBajo = series.priceToCoordinate(vMin);
    if (yAlto == null || yBajo == null) return arribaDelTodo;

    const aireArriba = yAlto - LABEL_MARGIN;
    const aireAbajo = paneHeight - yBajo - LABEL_MARGIN;
    if (aireArriba >= h + LABEL_MARGIN) return arribaDelTodo;
    if (aireAbajo >= h + LABEL_MARGIN) return abajoDelTodo;
    // No entra en ninguno (la serie cruza todo el alto): el lado más despejado.
    return aireArriba >= aireAbajo ? arribaDelTodo : abajoDelTodo;
  };

  // El tramo se le pasa al primitive EN EL MISMO EVENTO, sin esperar a React.
  //
  // El canvas lo pinta el gráfico dentro de su propio requestAnimationFrame:
  // cuando el cursor cruza al punto siguiente, la librería ya movió su marcador
  // del crosshair en ese mismo evento. Si el extremo del tramo llegara recién
  // con el commit de React —una tarea después—, el frame que cae en el medio
  // sale con DOS puntos, el viejo y el nuevo, y al arrastrar despacio se ve el
  // parpadeo en cada cambio de punto.
  const applySelection = (next: DragRangeSelection | null) => {
    ownCursorMarks(next !== null);
    primitive.setSelection(toSelection(next));
    placeLabel(next);
    onSelection(next);
  };

  // Tramo vigente al (re)crear el gráfico: se repone entero —banda, marcas y
  // caja—, no sólo la banda.
  if (initial) applySelection(initial);
  else primitive.setSelection(null);

  // Apretar → arrastrar → soltar. Sin pointer capture: capturar redirige los
  // eventos y el canvas dejaría de recibirlos. El move/up van en window para no
  // perder el gesto si el cursor sale del gráfico.
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const p = pointAtX(e.clientX);
    if (!p) return;
    down = true;
    anchor = p;
    onDragging?.(true);
    applySelection(null);
  };
  const onMove = (e: PointerEvent) => {
    if (!down || !anchor) return;
    const p = pointAtX(e.clientX);
    if (!p) return;
    // Volver sobre el punto del ancla no deja tramo que medir: se limpia, en vez
    // de dejar colgado el anterior con su banda y su extremo viejo.
    applySelection(p.time === anchor.time ? null : { from: anchor, to: p });
  };
  // Al soltar se borra: la medición es un gesto momentáneo, no deja marca fija
  // en el gráfico (por eso tampoco hace falta un botón de limpiar).
  const onUp = () => {
    if (!down) return;
    down = false;
    anchor = null;
    onDragging?.(false);
    applySelection(null);
  };

  container.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  return () => {
    container.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    down = false;
    anchor = null;
    // La caja la monta el componente y sobrevive al gráfico (un cambio de
    // período lo recrea): si quedara visible, quedaría flotando sobre una serie
    // que ya no es la que se midió.
    if (labelEl?.current) labelEl.current.style.visibility = "hidden";
  };
}
