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
}: AttachDragRangeParams): () => void {
  let down = false;
  let anchor: DragRangePoint | null = null;

  primitive.setSelection(toSelection(initial));

  // Traduce un x de pantalla al punto REAL de la serie más cercano. Se calcula
  // desde las coordenadas y NO desde el crosshair: durante un arrastre con el
  // botón apretado el crosshair puede dejar de emitir, y la medición quedaría
  // congelada. Así el gesto es determinístico.
  const pointAtX = (clientX: number): DragRangePoint | null => {
    if (points.length === 0) return null;
    const rect = container.getBoundingClientRect();
    // coordinateToTime trabaja en coordenadas del PANE, no del contenedor:
    // cuando hay un eje izquierdo visible el pane arranca corrido ese ancho.
    // Sin descontarlo la medición cae a la derecha del cursor. width() ya
    // devuelve 0 si el eje está oculto.
    const leftAxis = chart.priceScale("left").width();
    const paneWidth = chart.paneSize?.().width ?? rect.width - leftAxis;
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
    onSelection(next);
  };

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
  };
}
