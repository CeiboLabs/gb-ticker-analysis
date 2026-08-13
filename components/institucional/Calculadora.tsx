"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { css } from "@/lib/css";

function formatUSD(n: number): string {
  // Separadores rioplatenses: 1.234.567
  return "USD " + Math.round(n).toLocaleString("de-DE", { maximumFractionDigits: 0 });
}

// Número pelado, sin prefijo de moneda. La tabla de hitos lo usa para no
// repetir "USD" en cada celda: la unidad se aclara una sola vez al pie, lo que
// además angosta las columnas y permite una tipografía legible en mobile.
function formatNum(n: number): string {
  return Math.round(n).toLocaleString("de-DE", { maximumFractionDigits: 0 });
}

// Coma decimal rioplatense y sin decimales cuando el valor es entero: "7 %",
// "7,25 %". Importa desde que el slider de rendimiento admite pasos fraccionarios.
function formatPct(n: number): string {
  return n.toLocaleString("es-UY", { maximumFractionDigits: 2 });
}

function AnimatedValue({
  value,
  format,
  fit,
}: {
  value: number;
  format: (n: number) => string;
  // Tamaño máximo en px. Si está definido, la cifra se renderiza en una sola
  // línea: el font-size cede según el largo del texto y el ancho de la celda
  // (cqw — la celda es un container), en lugar de romper de línea.
  fit?: number;
}) {
  const [display, setDisplay] = useState(value);
  // Lo que está DIBUJADO ahora, no el destino de la animación anterior. Son
  // cosas distintas apenas llega un valor nuevo antes de que la anterior
  // termine —o sea, todo el tiempo mientras se arrastra— y arrancar desde el
  // destino viejo haría saltar la cifra a un número que nunca se mostró.
  const dibujado = useRef(value);

  useEffect(() => {
    const from = dibujado.current;
    const to = value;
    const diff = to - from;
    if (diff === 0) return;

    const duration = 360;
    const start = performance.now();
    // ⚠️ UNA SOLA CADENA VIVA. Sin este handle + el cleanup, cada valor nuevo
    // largaba OTRA cadena de requestAnimationFrame de 360ms sin cortar la
    // anterior. Arrastrando un slider eso no es un detalle: medido sobre el
    // sitio publicado, 45 rAF por paso de arrastre (1.674 llamadas para 32
    // eventos de input, hasta 29 cadenas simultáneas en un mismo frame) contra
    // la única que corresponde. Cada una llamaba setDisplay con su propia
    // interpolación, así que además de gastar renders se peleaban por escribir
    // la misma cifra.
    let raf = 0;

    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const v = Math.round(from + diff * ease);
      dibujado.current = v;
      setDisplay(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const text = format(display);
  if (!fit) return <>{text}</>;
  // ~0,6em por carácter con ~92cqw útiles ⇒ 145/len cqw como techo fluido.
  // El tope en px sale de --calc-fit (con `fit` como fallback) para que un
  // breakpoint pueda bajarlo sin tocar el JSX: en el teléfono las tres cifras
  // de apoyo pasan a 20px y sólo "Valor final" conserva el tamaño grande.
  const cap = (145 / Math.max(text.length, 1)).toFixed(1);
  return (
    <span style={{ whiteSpace: "nowrap", fontSize: `min(var(--calc-fit, ${fit}px), ${cap}cqw)` }}>
      {text}
    </span>
  );
}

interface SliderProps {
  label: string;
  labelExtra?: React.ReactNode;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  minLabel: string;
  maxLabel: string;
  onChange: (v: number) => void;
}

// Estado de un arrastre en curso. Vive en un ref porque cambia dentro del
// gesto y no tiene por qué re-renderizar.
interface Gesto {
  /** Distancia entre el dedo y el centro del círculo al apoyar (0 si se apoyó en la barra). */
  desfase: number;
  x0: number;
  y0: number;
  /** Todavía no se fijó ningún valor: el gesto podría terminar siendo un scroll. */
  pendiente: boolean;
  /** El gesto arrancó agarrando el círculo, no la barra. */
  desdeElCirculo: boolean;
  /** Valor al apoyar, para devolverlo si el browser se queda con el gesto. */
  valorInicial: number;
  /** Quién tiene la captura, para poder devolverla si el gesto resulta ajeno. */
  captura: { el: HTMLElement; id: number } | null;
}

/**
 * Distancia (manhattan, en px) a la que se decide si el dedo vino a mover el
 * slider o a scrollear la página. Mismo número y mismo criterio que el gesto de
 * medición de los gráficos (`components/dragRange.ts`), para que las dos
 * decisiones se sientan iguales en todo el sitio.
 */
const DECISION_EJE = 5;

function Slider({
  label,
  labelExtra,
  value,
  displayValue,
  min,
  max,
  step,
  minLabel,
  maxLabel,
  onChange,
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const pista = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const gesto = useRef<Gesto | null>(null);
  const [agarrado, setAgarrado] = useState(false);

  // Decimales del paso: sin esto, 6 + 3×0,25 devuelve 6.750000000000001 y la
  // cifra rotulada sale con la basura del binario.
  const decimales = (String(step).split(".")[1] ?? "").length;

  function valorEn(clientX: number): number {
    const r = pista.current?.getBoundingClientRect();
    if (!r || r.width === 0) return value;
    const pasos = Math.round((((clientX - r.left) / r.width) * (max - min)) / step);
    return Math.min(max, Math.max(min, Number((min + pasos * step).toFixed(decimales))));
  }

  function apoyar(e: React.PointerEvent<HTMLElement>, sobreElCirculo: boolean) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const r = pista.current?.getBoundingClientRect();
    if (!r) return;
    // Sin esto el foco NO queda en el input: la acción por omisión del
    // mousedown de compatibilidad —que se dispara después de este handler—
    // devuelve el foco al body, porque quien recibe el gesto es un span que no
    // es focusable. Medido: activeElement quedaba en BODY y las flechas del
    // teclado no ajustaban nada después de tocar el control.
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    gesto.current = {
      // Agarrando el círculo el arrastre es RELATIVO —se conserva la distancia
      // entre el dedo y el centro—, así el valor no pega un salto de hasta 22px
      // en el instante de apoyar, que es justo lo que uno NO quiere del control
      // que está por ajustar fino.
      desfase: sobreElCirculo ? e.clientX - (r.left + (pct / 100) * r.width) : 0,
      x0: e.clientX,
      y0: e.clientY,
      pendiente: !sobreElCirculo && e.pointerType === "touch",
      desdeElCirculo: sobreElCirculo,
      valorInicial: value,
      captura: { el: e.currentTarget, id: e.pointerId },
    };
    setAgarrado(true);
    // El foco al input real, para que después de usar el control las flechas del
    // teclado lo sigan ajustando.
    //
    // Con el dedo NO: enfocar por script después de un toque le hace matchear
    // :focus-visible a Chrome —medido acá, no supuesto— y el aro de foco queda
    // pegado al soltar, o sea el control parece agarrado cuando ya no lo está.
    // Y en un teléfono el foco no habilita nada: las flechas no existen, y quien
    // navegue con teclado o lector de pantalla llega igual por tabulación.
    if (e.pointerType !== "touch") campo.current?.focus({ preventScroll: true });
    if (!gesto.current.pendiente && !sobreElCirculo) onChange(valorEn(e.clientX));
  }

  // Suelta el gesto sin tocar el valor: el dedo era de la página, o entró un
  // segundo dedo (eso es una pinza y le pertenece al navegador).
  const abandonar = useCallback(() => {
    const g = gesto.current;
    gesto.current = null;
    setAgarrado(false);
    if (g?.captura?.el.hasPointerCapture(g.captura.id)) {
      g.captura.el.releasePointerCapture(g.captura.id);
    }
  }, []);

  // De quién es el gesto. Apoyado sobre la BARRA no se sabe hasta que el dedo se
  // mueva: hasta los 5px no se fija valor ni se previene nada; si el movimiento
  // fue más horizontal que vertical el gesto es nuestro y desde ahí se le frena
  // el default a cada touchmove; si fue más vertical, es scroll de la página y
  // se abandona. Agarrando el círculo no hay nada que decidir (el touch-action
  // de esa zona ya no le deja al navegador ningún gesto de un dedo).
  const decidirEje = useCallback(
    (x: number, y: number): boolean => {
      const g = gesto.current;
      if (!g) return false;
      if (!g.pendiente) return true;
      const dx = Math.abs(x - g.x0);
      const dy = Math.abs(y - g.y0);
      if (dx + dy < DECISION_EJE) return false;
      if (dx >= dy) {
        g.pendiente = false;
        return true;
      }
      abandonar();
      return false;
    },
    [abandonar],
  );

  function mover(e: React.PointerEvent<HTMLElement>) {
    const g = gesto.current;
    if (!g) return;
    if (!decidirEje(e.clientX, e.clientY)) return;
    onChange(valorEn(e.clientX - g.desfase));
  }

  // BLOQUEO DE EJE — el mismo que ya lleva el arrastre de los gráficos, y por el
  // mismo motivo (ver `components/dragRange.ts`): con `touch-action: pan-y` el
  // navegador NO decide de una vez al empezar el toque, se reserva el derecho de
  // llevarse el gesto para scrollear en cualquier momento del arrastre. Cuando
  // lo hace dispara `pointercancel` y el arrastre se muere solo — en los
  // gráficos alcanzaba un temblor vertical de dos píxeles a mitad de camino, y
  // eso lo reportó el cliente desde el teléfono (en Chrome de escritorio no
  // reproduce: fija el eje al arranque).
  //
  // Una vez que el gesto es nuestro, cada `touchmove` va con `preventDefault` y
  // el navegador ya no puede arrancar a scrollear. Va aparte del `pointermove`
  // porque el de React se registra pasivo y un listener pasivo no puede frenar
  // nada; y va en el montaje porque Safari de iOS decide al empezar el toque si
  // los `touchmove` de ese gesto van a ser cancelables — registrarlo después ya
  // no sirve. El scroll de la página es nativo (Lenis va con syncTouch: false),
  // así que frenar el default alcanza.
  useEffect(() => {
    const el = pista.current;
    if (!el) return;
    const enTouchMove = (e: TouchEvent) => {
      if (!gesto.current) return;
      if (e.touches.length !== 1) {
        abandonar(); // dos dedos es una pinza: el zoom es del navegador
        return;
      }
      if (!decidirEje(e.touches[0].clientX, e.touches[0].clientY)) return;
      if (e.cancelable) e.preventDefault();
    };
    el.addEventListener("touchmove", enTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", enTouchMove);
  }, [abandonar, decidirEje]);

  function soltar(e: React.PointerEvent<HTMLElement>) {
    const g = gesto.current;
    gesto.current = null;
    setAgarrado(false);
    // Toque seco sobre la barra: no hubo arrastre, pero sí la intención de
    // llevar el valor ahí.
    if (g?.pendiente) onChange(valorEn(e.clientX));
  }

  function cancelar() {
    const g = gesto.current;
    gesto.current = null;
    setAgarrado(false);
    // El browser se quedó con el gesto para scrollear. Si había arrancado en la
    // BARRA, la intención era scrollear y el parámetro vuelve a donde estaba;
    // agarrando el círculo la intención era ajustar, así que se deja donde
    // quedó. Sin esto, cada intento de scrollear con el dedo apoyado sobre una
    // barra dejaba el parámetro cambiado de callado.
    if (g && !g.desdeElCirculo) onChange(g.valorInicial);
  }

  // Red de seguridad: si la captura se pierde por cualquier otro motivo, el
  // gesto no queda vivo esperando un pointerup que no va a llegar.
  function perderCaptura() {
    if (!gesto.current) return;
    gesto.current = null;
    setAgarrado(false);
  }

  return (
    <div className="calc-slider">
      {/* Encabezado del parámetro: rótulo (+ el toggle de frecuencia, si lo hay)
          a la izquierda y el valor a la derecha.
          ⚠️ EL VALOR NO SE MUEVE NUNCA — ver .calc-slider-head en el CSS. */}
      <div className="calc-slider-head">
        <span className="calc-slider-lab">
          <label className="ui-label" style={{ marginBottom: 0 }}>{label}</label>
          {/* El toggle va en su propia caja para poder mandarlo a un renglón
              aparte cuando la columna es angosta, sin estirar la pastilla. */}
          {labelExtra ? <span className="calc-slider-extra">{labelExtra}</span> : null}
        </span>
        <span className="calc-slider-val">{displayValue}</span>
      </div>

      {/* ⚠️ EL ARRASTRE NO LO MANEJA EL <input type=range>, Y NO ES CAPRICHO.
          Hasta el 13-ago-2026 el control era el input nativo estirado e
          invisible por encima de un dibujo hecho a mano. Eso deja el gesto en
          manos de cada motor, y los motores no se comportan igual:

          · El círculo que se ve NO era el control. Se dibuja centrado en la
            punta de la pista, o sea que en un extremo la mitad de su cuerpo
            queda FUERA de la caja del input; y el thumb nativo —invisible, con
            su propia geometría— se corre hacia adentro media perilla (en iOS son
            ~28px de ancho). Apretar el círculo en el extremo era apretar al lado
            del control: "el círculo marca, no acciona".
          · Barrer el dedo en VERTICAL sobre una barra cambiaba el parámetro.
            Medido sobre esta misma página en un teléfono de 390px, con el gesto
            real: los cuatro sliders saltaban al punto donde se apoyaba el dedo
            (Aporte 48.000 → 60.000, Horizonte 17 → 21 años) y la página
            scrolleaba igual. O sea que intentar leer la sección te reescribía la
            simulación sin que la tocaras.

          Ahora el gesto lo maneja la página con eventos de puntero y captura, y
          el reparto del touch-action es el mismo que hace un slider de iOS:

            · sobre la BARRA        → pan-y pinch-zoom: la página sigue
              scrolleando con el dedo (son cuatro filas de 44px: volverlas zona
              muerta se siente como que la página se trabó), y el valor recién se
              fija cuando el gesto se declara horizontal.
            · sobre el CÍRCULO      → pinch-zoom: el gesto es del control y el
              browser no puede robarlo. Un arrastre en diagonal —lo normal con el
              pulgar— ya no se convierte en scroll a mitad de camino.

          El zoom por pinza queda intacto en los dos: restringir el gesto no
          puede costarle el zoom a quien lo necesita para leer.

          ⚠️ NI LA BARRA NI EL THUMB LLEVAN TRANSITION, Y NO ES UN OLVIDO.
          Hasta el 11-ago-2026 tenían `width 100ms` y `left 100ms`. En un
          control de manipulación directa eso no suaviza nada: mientras se
          arrastra, el valor ya viene continuo —un evento por frame—, así que lo
          único que agrega la transición es que el dibujo salga a perseguir al
          cursor y nunca lo alcance.

          Y el precio no es igual en todos lados, que es de dónde salió el
          reporte de "en localhost va fluido y en producción se traba". Mismo
          HTML, misma CSS, mismo arrastre sobre el sitio publicado, midiendo
          cada frame la distancia entre dónde está dibujado el thumb y dónde lo
          pone el valor que el input YA tiene:

            Chrome   ·  mediana  10,9 px   ·  p90   11 px
            Safari   ·  mediana 124,8 px   ·  p90  264,6 px  (máx 302,5 px)
            sin transition, en Safari · 0 px en las 63 muestras

          WebKit reinicia mucho más lento una transición interrumpida, y como
          acá se interrumpe en cada frame del arrastre, la perilla queda hasta
          300px atrás del cursor. Los frames, en los dos navegadores, iban a
          17ms — no se perdía ni uno. O sea que el "tranque" nunca fue costo de
          render: era retraso de dibujo, y por eso no aparecía en ninguna
          medición de fps. Si algún día se quiere volver a suavizar, que sea
          sólo para los cambios que NO vienen de un arrastre (teclado, click en
          la pista); mientras el dedo está apoyado, 1:1 o nada. */}
      <div className="calc-track" ref={pista} data-agarrado={agarrado ? "1" : undefined}>
        {/* El input real sigue existiendo, invisible y sordo al puntero: es lo
            que hace que el control se anuncie como slider, se ajuste con las
            flechas y lo entienda VoiceOver. Va PRIMERO en el DOM para que el
            anillo de foco pueda pintarse sobre el círculo con un selector de
            hermano. */}
        <input
          ref={campo}
          className="calc-range"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
        />
        <span className="calc-rail" />
        <span className="calc-rail calc-rail-llena" style={{ width: `${pct}%` }} />
        <span className="calc-thumb" style={{ left: `calc(${pct}% - 10px)` }} />
        {/* Las dos zonas del gesto. La de la barra se estira 11px por fuera de
            la pista —lo que se ve mide 22px de alto y con el dedo eso queda muy
            por debajo del mínimo táctil de 44—; los absorbe el padding del
            propio .calc-slider, así que ningún slider invade al de al lado. La
            del círculo lo acompaña y lo desborda, para que agarrarlo en un
            extremo sea agarrarlo y no errarle por 10px. */}
        <span
          className="calc-hit"
          onPointerDown={(e) => apoyar(e, false)}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={cancelar}
          onLostPointerCapture={perderCaptura}
        />
        <span
          className="calc-grab"
          style={{ left: `calc(${pct}% - 22px)` }}
          onPointerDown={(e) => apoyar(e, true)}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={cancelar}
          onLostPointerCapture={perderCaptura}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        <span className="t-small" style={{ fontSize: 12 }}>{minLabel}</span>
        <span className="t-small" style={{ fontSize: 12 }}>{maxLabel}</span>
      </div>
    </div>
  );
}

interface YearData {
  year: number;
  invested: number;
  total: number;
  gains: number;
}

// Geometría del gráfico. El SVG se estira al ancho del panel
// (preserveAspectRatio="none"): la escala horizontal cambia con el viewport
// mientras la vertical queda clavada en SVG_H/VB_H. Dentro de ese sistema un
// <circle> se ovala —medido: 8,8 × 8,9 px a 1900 de viewport, 6,4 × 8,9 a
// 500—, y uno apoyado en el borde derecho se corta por la mitad contra el
// recorte del SVG. Por eso los puntos de fin de serie se dibujan en HTML
// encima del SVG (redondos a cualquier ancho) y el trazado reserva
// PLOT_INSET a la derecha para que entren dentro del área del gráfico.
// Color de cada serie, en un solo lugar. La referencia y el trazo salían de
// fuentes distintas —el swatch de "Valor total" con var(--gold), la línea con
// #C9A84C hardcodeado— y habían quedado en dos oros que no eran el mismo
// (#EBD288 vs #C9A84C). Ninguno de los dos era el correcto: sobre fondo claro
// el token es gold-deep (docs/lenguaje-visual.md: "gold-deep sobre claro").
// Todo lo que pinte una serie tiene que leer de acá, incluida la leyenda.
const SERIE = {
  aportado: "var(--navy-500)",
  total: "var(--gold-deep)",
} as const;

const VB_W = 500; // ancho del viewBox
const VB_H = 220; // alto del viewBox
const PLOT_H = 200; // alto útil de la serie: deja aire arriba
const PLOT_INSET = 12; // reserva a la derecha, en unidades del viewBox
const PLOT_W = VB_W - PLOT_INSET;
const SVG_H = 280; // alto renderizado, en px

// Núcleo del simulador (cifras + sliders + gráfico + hitos), sin header ni
// site-wrap: lo embebe la página /calculadora con su propio encabezado y la
// página del fondo dentro de su sección #calculadora, cada una con los
// defaults que le hacen sentido a su audiencia.
export function CalculadoraSim({
  defaults = {},
  rateRange,
}: {
  // `aporte` va SIEMPRE en la unidad de `freq`: con freq "anual" son USD por
  // año, no por mes. Los dos viajan juntos por eso — fijar el monto sin la
  // frecuencia (o al revés) deja un default que simula otro flujo del que se
  // quiso.
  defaults?: Partial<{
    initial: number;
    aporte: number;
    freq: "mensual" | "anual";
    rate: number;
    years: number;
  }>;
  // Recorrido del slider de rendimiento anual promedio. Por defecto abierto
  // (1–20 % de a 0,5), que es lo que corresponde a un simulador genérico de
  // interés compuesto. La página del fondo lo acota a una banda estrecha.
  rateRange?: { min: number; max: number; step?: number };
}) {
  const rateMin = rateRange?.min ?? 1;
  const rateMax = rateRange?.max ?? 20;
  const rateStep = rateRange?.step ?? 0.5;

  const [initial, setInitial] = useState(defaults.initial ?? 200000);
  const [freq, setFreq] = useState<"mensual" | "anual">(defaults.freq ?? "mensual");
  const [aporte, setAporte] = useState(defaults.aporte ?? (defaults.freq === "anual" ? 6000 : 500));
  // Se acota al rango: un default fuera de banda dejaría el valor simulado y el
  // del slider desacoplados (el <input range> clampea, el estado no).
  const [rate, setRate] = useState(Math.min(Math.max(defaults.rate ?? 8, rateMin), rateMax));
  const [years, setYears] = useState(defaults.years ?? 25);

  // Al cambiar la frecuencia se convierte el monto (×12 / ÷12) para que la
  // simulación siga representando el mismo flujo de aportes.
  function changeFreq(f: "mensual" | "anual") {
    if (f === freq) return;
    setFreq(f);
    setAporte(f === "anual" ? aporte * 12 : Math.round(aporte / 12 / 100) * 100);
  }

  const data = useMemo<YearData[]>(() => {
    // Simulación mes a mes: el aporte mensual se acredita al cierre de cada
    // mes; el anual, al cierre de cada año (anualidad vencida). El año 0 vale
    // exactamente lo aportado: no hay carga de entrada.
    //
    // ⚠️ EL CRITERIO DE ESTE CÁLCULO ES QUE EL LECTOR PUEDA REPLICARLO. Pedido
    // del cliente (6-ago-2026): probó de varias formas y no llegaba al número.
    // Dos decisiones salen de ahí y no hay que "corregirlas" de vuelta:
    //
    //  1. LA TASA ES EFECTIVA ANUAL, y a mensual se pasa por raíz doceava — no
    //     dividiendo entre 12. Con `rate/12` un 7 % rotulado compone al 7,229 %
    //     efectivo, así que la cifra nunca cerraba contra la fórmula de valor
    //     futuro de una planilla y el desvío (+5,1 % a 30 años) no se explicaba
    //     por ningún lado de la página. Con la raíz, doce meses componen
    //     exactamente (1 + rate), y el modo anual da idéntico a
    //     `=VF(tasa; años; -aporte; -inicial)`. El modo mensual queda replicable
    //     con esa misma tasa mensual, y de paso los dos modos comparten un único
    //     rendimiento efectivo (con `rate/12` el toggle abría una brecha del
    //     7,3 % para el mismo flujo; ahora es 2,1 %, sólo por el calendario del
    //     aporte).
    //
    //  2. NO SE DESCUENTA NINGÚN COSTO. Hasta el 6-ago-2026 la página del fondo
    //     pasaba `fees={{annualPct: 0.015}}` y la comisión se prorrateaba mes a
    //     mes. Era defendible —la tasa del slider era un rendimiento BRUTO de
    //     mercado— pero irreplicable: el lector veía "7 %" y un resultado que
    //     correspondía a 5,63 % efectivo neto, sin forma de deducir el puente.
    //     Ahora la tasa se asume NETA DE COMISIONES y así lo dice el pie del
    //     simulador. El supuesto se declara en el texto en vez de esconderse en
    //     la aritmética.
    //
    // Consecuencia que conviene tener presente: la cifra que se muestra subió
    // ~34 % respecto de la versión con comisión (3.258.221 → 4.356.275 en el
    // default del fondo). Ya no es la lectura conservadora — es la que el 7 %
    // rotulado promete. Ver FondoCalculadora sobre el default de la tasa.
    const result: YearData[] = [
      { year: 0, invested: initial, total: initial, gains: 0 },
    ];
    const monthlyRate = Math.pow(1 + rate / 100, 1 / 12) - 1;
    let total = initial;

    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) {
        total = total * (1 + monthlyRate) + (freq === "mensual" ? aporte : 0);
      }
      if (freq === "anual") total += aporte;
      const invested = initial + aporte * (freq === "mensual" ? y * 12 : y);
      result.push({
        year: y,
        invested,
        total: Math.round(total),
        gains: Math.round(total - invested),
      });
    }
    return result;
  }, [initial, aporte, freq, rate, years]);

  const final = data[data.length - 1];
  const maxTotal = final.total;
  const gainsPct = final.invested > 0 ? Math.round((final.gains / final.invested) * 100) : 0;

  const hitos = [5, 10, 15, 20, years].filter((y, i, arr) => y <= years && arr.indexOf(y) === i);

  // Índice de año → x, y valor → y, ambos en unidades del viewBox.
  const px = (i: number) => (i / years) * PLOT_W;
  const py = (v: number) => VB_H - (maxTotal > 0 ? (v / maxTotal) * PLOT_H : 0);

  return (
    // El DOM va en orden LÓGICO —parámetros, resultado, gráfico, hitos— y el
    // grid de .calc-root sube las cifras a la primera fila en desktop. El orden
    // no es cosmético: en una pantalla angosta no hay golpe de vista, así que el
    // orden de lectura ES el orden del DOM (y el que recorre un lector de
    // pantalla). Con las cifras primero, la página contestaba una pregunta que
    // el lector todavía no había hecho: medido a 390px, 588px de cifras y el
    // primer control recién a 1.162px del arranque de la sección. En desktop las
    // cifras sí funcionan arriba, porque entran de un vistazo junto a los
    // sliders que las producen; por eso el cambio es sólo de layout.
    <div className="calc-root">
      {/* Parámetros */}
      <div className="calc-panel calc-params">
        <div className="eyebrow-sm" style={{ marginBottom: 24 }}>Parámetros</div>
        <Slider
          label="Inversión inicial"
          value={initial}
          displayValue={formatUSD(initial)}
          min={1000}
          max={500000}
          step={1000}
          minLabel="USD 1 K"
          maxLabel="USD 500 K"
          onChange={setInitial}
        />
        <Slider
          label="Aporte"
          labelExtra={
            <span className="calc-freq" data-active={freq} role="tablist" aria-label="Frecuencia del aporte">
              <span className="calc-freq-thumb" aria-hidden />
              <button
                type="button" role="tab" aria-selected={freq === "mensual"}
                className="calc-freq-btn" onClick={() => changeFreq("mensual")}
              >
                Mensual
              </button>
              <button
                type="button" role="tab" aria-selected={freq === "anual"}
                className="calc-freq-btn" onClick={() => changeFreq("anual")}
              >
                Anual
              </button>
            </span>
          }
          value={aporte}
          displayValue={formatUSD(aporte)}
          min={0}
          max={freq === "mensual" ? 10000 : 120000}
          step={freq === "mensual" ? 100 : 1200}
          minLabel="USD 0"
          maxLabel={freq === "mensual" ? "USD 10 K" : "USD 120 K"}
          onChange={setAporte}
        />
        <Slider
          label="Rendimiento anual promedio"
          value={rate}
          displayValue={`${formatPct(rate)} %`}
          min={rateMin}
          max={rateMax}
          step={rateStep}
          minLabel={`${formatPct(rateMin)} %`}
          maxLabel={`${formatPct(rateMax)} %`}
          onChange={setRate}
        />
        <Slider
          label="Horizonte temporal"
          value={years}
          displayValue={`${years} años`}
          min={1}
          max={40}
          step={1}
          minLabel="1 año"
          maxLabel="40 años"
          onChange={setYears}
        />
      </div>

      {/* Rótulo del bloque de cifras. En desktop no hace falta —la barra ES el
          encabezado de la sección, arriba de todo—, pero abajo de los sliders
          un bloque de cifras sin nombre queda huérfano. Se muestra sólo cuando
          el layout colapsa a una columna. */}
      <div className="eyebrow-sm calc-res-cap">Resultado</div>

      {/* Cifras destacadas — hairline grid */}
      <div className="calc-figures">
        {[
          ["Valor final", final.total, formatUSD, "gold"] as const,
          ["Ganancia compuesta", final.gains, formatUSD, "pos"] as const,
          ["Total aportado", final.invested, formatUSD, "ink"] as const,
          ["Rendimiento", gainsPct, (n: number) => `${n} %`, "gold"] as const,
        ].map(([cap, value, format, kind]) => {
          // Oro de TEXTO y no --gold-deep: la cifra se achica sola con el
          // contenedor (fit=40 contra 29cqw), así que en el teléfono "196 %"
          // baja a 20px. Ahí ya no es texto grande y --gold-deep, con sus
          // 3,88:1 sobre blanco, reprueba AA. El tono más profundo sirve en los
          // dos extremos de la escala.
          const color =
            kind === "gold" ? "var(--gold-ink)" : kind === "pos" ? "var(--pos)" : "var(--site-ink)";
          return (
            <div key={cap} className="calc-figure">
              <div className="eyebrow-sm calc-figure-cap">{cap}</div>
              <div className="calc-figure-value" style={{ color }}>
                <AnimatedValue value={value} format={format} fit={40} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Gráfico */}
      <div className="calc-panel calc-chart">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div className="eyebrow-sm">Proyección de crecimiento</div>
          <div style={{ display: "flex", gap: 18 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 16, height: 3, borderRadius: 2, background: SERIE.aportado }} />
              <span className="t-small" style={{ fontSize: 12 }}>Aportado</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 16, height: 3, borderRadius: 2, background: SERIE.total }} />
              <span className="t-small" style={{ fontSize: 12 }}>Valor total</span>
            </span>
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" style={{ width: "100%", height: SVG_H, display: "block" }}>
            <defs>
              <linearGradient id="area-total" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIE.total} stopOpacity="0.20" />
                <stop offset="100%" stopColor={SERIE.total} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Líneas guía — el marco sí ocupa el ancho completo */}
            {[0.25, 0.5, 0.75].map((pct) => (
              <line
                key={pct}
                x1="0"
                y1={VB_H - pct * PLOT_H}
                x2={VB_W}
                y2={VB_H - pct * PLOT_H}
                stroke="#E7E8F2"
                strokeWidth="1"
              />
            ))}
            <line x1="0" y1={VB_H} x2={VB_W} y2={VB_H} stroke="#D7D9E8" strokeWidth="1" />

            {/* Área valor total */}
            <path
              d={`M0 ${VB_H} ${data.map((d, i) => `L${px(i)} ${py(d.total)}`).join(" ")} L${PLOT_W} ${VB_H} Z`}
              fill="url(#area-total)"
            />

            {/* Línea aportado */}
            <path
              d={`M${data.map((d, i) => `${px(i)} ${py(d.invested)}`).join(" L")}`}
              fill="none"
              stroke={SERIE.aportado}
              strokeWidth="1.5"
            />
            {/* Línea valor total */}
            <path
              d={`M${data.map((d, i) => `${px(i)} ${py(d.total)}`).join(" L")}`}
              fill="none"
              stroke={SERIE.total}
              strokeWidth="2"
            />
          </svg>

          {/* Puntos de fin de serie. Van en HTML y no adentro del SVG para que
              queden redondos con cualquier ancho de panel (ver PLOT_INSET). */}
          {[
            { valor: final.total, color: SERIE.total, d: 9 },
            { valor: final.invested, color: SERIE.aportado, d: 8 },
          ].map(({ valor, color, d }) => (
            <span
              key={color}
              aria-hidden
              style={{
                position: "absolute",
                left: `${(PLOT_W / VB_W) * 100}%`,
                top: (py(valor) / VB_H) * SVG_H,
                width: d,
                height: d,
                marginLeft: -d / 2,
                marginTop: -d / 2,
                borderRadius: "50%",
                background: color,
                pointerEvents: "none",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
          <span className="t-small" style={{ fontSize: 12 }}>Año 0</span>
          <span className="t-small" style={{ fontSize: 12 }}>Año {Math.round(years / 2)}</span>
          <span className="t-small" style={{ fontSize: 12 }}>Año {years}</span>
        </div>
      </div>

      {/* Tabla de hitos */}
      <div className="calc-hitos">
        <div style={{ padding: "0 0 4px" }}>
          <div className="eyebrow-sm" style={{ marginTop: 24 }}>Hitos de la proyección</div>
        </div>
        <div style={{ overflowX: "auto", marginTop: 20 }}>
          <table className="calc-table">
            <thead>
              <tr>
                <th>Año</th>
                <th style={{ textAlign: "right" }}>Aportado</th>
                <th style={{ textAlign: "right" }}>Ganancia</th>
                <th style={{ textAlign: "right" }}>Valor total</th>
              </tr>
            </thead>
            <tbody>
              {hitos.map((y) => {
                const d = data[y];
                if (!d) return null;
                return (
                  <tr key={y}>
                    <td style={{ fontWeight: 500 }}>{y}</td>
                    <td style={{ textAlign: "right" }}>{formatNum(d.invested)}</td>
                    <td style={{ textAlign: "right", color: "var(--pos)" }}>{formatNum(d.gains)}</td>
                    <td style={{ textAlign: "right", fontWeight: 500, color: "var(--site-ink)" }}>{formatNum(d.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="calc-table-foot">Cifras en USD.</p>
        </div>
      </div>

      {/* Misma medida que el resto de los avisos legales del sitio (globals.css
          → --medida-legal): el tope en caracteres, no en em. */}
      <p className="t-small calc-legal">
        Esta simulación es informativa y no constituye asesoramiento financiero ni una proyección de
        rendimiento de ningún producto. El rendimiento anual promedio lo elegís vos y se asume
        constante: la simulación no descuenta costos, de modo que la tasa que ingresás se toma como
        un rendimiento ya neto de comisiones. Es una tasa efectiva anual y los aportes se acreditan
        al cierre de cada período.
        {/* Las últimas dos frases NO son relleno legal: son la definición
            operativa que le falta a quien quiera rehacer la cuenta. "Efectiva
            anual" descarta dividir entre 12 y "al cierre de cada período"
            descarta la anualidad adelantada — con las dos, el modo anual sale
            exacto con la función de valor futuro de cualquier planilla. Ver el
            bloque del useMemo por qué llegamos acá.

            SOBRE LOS COSTOS, y por qué está redactado así y no de otras dos
            formas que parecen equivalentes:

            · "se asume neto de comisiones" A SECAS (como quedó el 6-ago) deja
              ambiguo quién netea: se puede leer como "el resultado que estás
              viendo ya está neto", o sea que la página lo hizo. Es lo contrario
              de lo que pasa. Por eso ahora la omisión va PRIMERO y explícita
              ("no descuenta costos") y el supuesto sobre la tasa va después,
              como consecuencia.
            · "no se descuenta la comisión del Fondo" es peor que no decir nada:
              nombra UNA omisión y se lee como la lista completa. No lo es — el
              Reglamento tiene una segunda capa de comisiones (las de los ETFs y
              fondos subyacentes; factor de riesgo 7 la llama estructural), más
              los gastos de la 12.2 y los tributos de la 12.3.

            Por eso: omisión completa, sin enumerar. Enumerarlas fue vetado por
            el cliente el 3-ago —hacía leer el producto como si tuviera costos
            escondidos— y ese veto sigue en pie. La comisión sí está declarada en
            su propia sección de la página y en el FAQ. */}
      </p>

      <style>{css`
        /* Layout general. Dos columnas y colocación explícita: el DOM viene en
           orden lógico (parámetros → resultado → gráfico → hitos) y acá las
           cifras suben a la fila 1, ancho completo. */
        .calc-root {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
          column-gap: clamp(32px, 6vw, 72px);
          align-items: start;
        }
        .calc-figures { grid-area: 1 / 1 / 2 / -1; }
        .calc-params  { grid-area: 2 / 1 / 3 / 2; margin-top: 56px; }
        .calc-chart   { grid-area: 2 / 2 / 3 / -1; margin-top: 56px; }
        .calc-hitos   { grid-area: 3 / 1 / 4 / -1; margin-top: 56px; border-top: 1px solid var(--site-border); }
        .calc-legal   { grid-area: 4 / 1 / 5 / -1; margin-top: 32px; max-width: var(--medida-legal); }
        .calc-res-cap { display: none; }
        /* La columna de parámetros es el contenedor de consulta de los
           encabezados: lo que decide si el toggle entra al lado del rótulo es su
           ancho, no el del viewport (a 901px de viewport esta columna mide
           333px, más angosta que un teléfono). */
        .calc-params { container-type: inline-size; }
        .calc-panel { min-width: 0; }

        .calc-figures {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          border-top: 1px solid var(--site-border);
          border-bottom: 1px solid var(--site-border);
        }
        .calc-figure {
          padding: 28px 28px 28px 0;
          border-left: 1px solid var(--site-border);
          padding-left: 28px;
          container-type: inline-size;
        }
        .calc-figure:first-child { border-left: 0; padding-left: 0; }
        .calc-figure-cap { margin-bottom: 12px; }
        .calc-figure-value { font-weight: 400; font-size: 40px; letter-spacing: -0.025em; }
        .calc-slider { padding: 16px 0; border-bottom: 1px solid var(--site-border); }
        /* Pista y gesto. El reparto del touch-action está explicado arriba, en
           el JSX; acá sólo se aplica. */
        .calc-track {
          position: relative; height: 22px; display: flex; align-items: center;
          /* Nada de acá es texto: sin esto, mantener el dedo apoyado en el
             teléfono levanta la lupa de selección y el arrastre se pierde. */
          user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
          -webkit-tap-highlight-color: transparent;
        }
        .calc-rail {
          position: absolute; left: 0; right: 0; height: 6px; border-radius: 999px;
          background: var(--site-border);
        }
        .calc-rail-llena { right: auto; background: var(--navy); }
        .calc-thumb {
          position: absolute; width: 20px; height: 20px; border-radius: 50%;
          background: #fff; border: 2px solid var(--navy);
          box-shadow: 0 2px 6px rgba(3,6,94,0.18);
          z-index: 2; pointer-events: none;
        }
        /* Que el círculo se vea agarrado. No es adorno: la queja era que "marca,
           no acciona", y un control de manipulación directa tiene que acusar
           recibo del dedo. Sin transición, como todo lo que sigue al gesto. */
        .calc-track[data-agarrado] .calc-thumb,
        .calc-range:focus-visible ~ .calc-thumb {
          box-shadow: 0 0 0 6px rgba(3,6,94,0.12), 0 2px 6px rgba(3,6,94,0.18);
        }
        @media (hover: hover) {
          .calc-track:hover .calc-thumb { box-shadow: 0 0 0 4px rgba(3,6,94,0.08), 0 2px 6px rgba(3,6,94,0.18); }
        }
        .calc-range {
          position: absolute; inset: -11px 0; width: 100%; margin: 0;
          opacity: 0; pointer-events: none;
        }
        .calc-hit {
          position: absolute; inset: -11px; z-index: 3; cursor: pointer;
          touch-action: pan-y pinch-zoom;
        }
        .calc-grab {
          position: absolute; top: 50%; margin-top: -22px; width: 44px; height: 44px;
          z-index: 4; cursor: grab; touch-action: pinch-zoom;
        }
        .calc-track[data-agarrado] .calc-grab { cursor: grabbing; }
        /* ⚠️ DOS COLUMNAS DE GRID, NO UN FLEX QUE ENVUELVE, Y ESA ES LA
           DIFERENCIA. Con flex-wrap el valor era un ítem más de la fila: en
           cuanto rótulo + toggle + cifra no entraban, la cifra se iba sola al
           renglón de abajo. Y el umbral lo decidía el LARGO DEL NÚMERO, o sea
           que saltaba a mitad del arrastre: medido a 390px, "Aporte" con la
           pastilla mide 226px y la cifra entre 106 ("USD 30.000") y 117 ("USD
           120.000") contra 350px de columna — entra con cinco cifras y se cae
           con seis. En un teléfono de 375 se cae ya en la quinta, que es el
           reporte.
           Con el grid la cifra tiene columna propia (auto: nunca se parte ni se
           baja) y la presión la absorbe el rótulo, cuya columna es
           minmax(0, 1fr) —minmax y no 1fr pelado: 1fr es minmax(auto, 1fr) y una
           palabra larga desbordaría la página—. */
        .calc-slider-head {
          display: grid; grid-template-columns: minmax(0, 1fr) auto;
          align-items: baseline; gap: 8px 12px; margin-bottom: 12px;
        }
        .calc-slider-lab { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; min-width: 0; }
        .calc-slider-val {
          justify-self: end; white-space: nowrap;
          font-size: 20px; font-weight: 400; letter-spacing: -0.015em; color: var(--site-ink);
        }
        /* Y el toggle, en columna angosta, SIEMPRE en su propio renglón. Dejarlo
           librado a si entra lo devuelve al mismo problema por otra puerta: la
           pastilla bajaría recién al pasar de "USD 99.000" a "USD 100.000", o
           sea saltando durante el arrastre. El umbral sale de la medición de
           arriba (355px de necesidad) con margen para métricas de fuente
           distintas; abarca el teléfono y también la columna de parámetros
           cuando el escritorio queda angosto (333px a 901px de viewport). */
        @container (max-width: 380px) {
          .calc-slider-extra { flex-basis: 100%; }
        }
        /* Toggle mensual/anual — mismo patrón que el toggle de "Mayores
           tenencias" (.ten-toggle): pastilla con thumb navy deslizante. */
        .calc-freq {
          position: relative; display: inline-flex; padding: 3px;
          background: var(--surface-muted, #f3f4f8); border: 1px solid var(--site-border); border-radius: 999px;
        }
        .calc-freq-thumb {
          position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc(50% - 3px);
          background: var(--navy); border-radius: 999px;
          box-shadow: 0 6px 16px -6px rgba(15,34,73,0.6);
          transition: transform 260ms cubic-bezier(0.34, 1.2, 0.4, 1);
        }
        .calc-freq[data-active="anual"] .calc-freq-thumb { transform: translateX(100%); }
        .calc-freq-btn {
          position: relative; z-index: 1; border: 0; background: none; cursor: pointer;
          font-size: 12px; font-weight: 600; color: var(--site-ink-3);
          padding: 5px 18px; border-radius: 999px; transition: color 220ms ease; min-width: 78px;
        }
        .calc-freq-btn[aria-selected="true"] { color: #fff; }
        .calc-freq-btn:not([aria-selected="true"]):hover { color: var(--navy); }
        /* Mismo criterio táctil que el selector de períodos (.pslider-btn en
           globals.css): con el dedo, 29px de alto se quedan cortos. */
        @media (pointer: coarse) {
          .calc-freq-btn { min-height: 44px; padding-top: 8px; padding-bottom: 8px; }
        }
        .calc-slider:last-child { border-bottom: 0; padding-bottom: 0; }
        .calc-table { width: 100%; border-collapse: collapse; min-width: 460px; }
        .calc-table th {
          font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
          color: var(--site-ink-3); text-align: left; padding: 14px 24px 14px 0; border-bottom: 1px solid var(--site-border);
        }
        .calc-table th:last-child, .calc-table td:last-child { padding-right: 0; }
        .calc-table td {
          font-size: 16px; color: var(--site-ink-2); padding: 18px 24px 18px 0; border-bottom: 1px solid var(--site-border);
        }
        .calc-table tbody tr:last-child td { border-bottom: 0; }
        .calc-table-foot { margin: 14px 0 0; font-size: 12px; color: var(--site-ink-3); }
        /* Una sola columna: acá se deshace la colocación explícita y todo cae en
           el orden del DOM —los controles primero, el resultado después. */
        @media (max-width: 900px) {
          .calc-root { grid-template-columns: minmax(0, 1fr); }
          .calc-figures, .calc-params, .calc-chart, .calc-hitos, .calc-legal { grid-area: auto; }
          .calc-params {
            margin-top: 0;
            border-top: 1px solid var(--site-border);
            padding-top: 28px;
          }
          .calc-res-cap { display: block; margin: 40px 0 20px; }
          .calc-chart { margin-top: 40px; }
          .calc-hitos { margin-top: 48px; }
          .calc-figures { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .calc-figure:nth-child(3) { border-left: 0; padding-left: 0; }
          .calc-figure { padding-top: 24px; padding-bottom: 24px; }
        }
        /* Teléfono: las cuatro cifras apiladas a 40px medían 588px —el 70 % de
           una pantalla—, y eso es demasiado output entre el control y su efecto
           (el punto de un slider es el ciclo arrastrar→ver). Pasan a jerarquía:
           "Valor final" conserva el tamaño grande porque ES la respuesta, y las
           otras tres bajan a filas de hairline con el rótulo a la izquierda y la
           cifra a la derecha —el mismo par que ya usa el encabezado de cada
           slider. El bloque queda en ~270px. */
        @media (max-width: 540px) {
          .calc-figures { grid-template-columns: minmax(0, 1fr); }
          .calc-figure { border-left: 0; }
          .calc-figure:first-child { padding: 24px 0 26px; }
          .calc-figure + .calc-figure {
            display: flex; align-items: baseline; justify-content: space-between; gap: 16px;
            padding: 13px 0; border-top: 1px solid var(--site-border);
            --calc-fit: 20px;
          }
          .calc-figure + .calc-figure .calc-figure-cap { margin-bottom: 0; }
          .calc-figure + .calc-figure .calc-figure-value {
            font-size: 20px; letter-spacing: -0.015em;
          }
        }
        /* En teléfonos angostos soltamos el min-width base (460) y pasamos a
           table-layout fijo para que las 4 columnas entren sin scroll. Al no
           repetir "USD" en cada celda (ver formatNum) las cifras son más cortas,
           así que la tipografía puede quedar legible en vez de diminuta. */
        @media (max-width: 520px) {
          .calc-table { min-width: 0; table-layout: fixed; }
          .calc-table th {
            font-size: 10.5px; letter-spacing: 0.02em; padding: 12px 6px 12px 0;
          }
          .calc-table th:first-child { width: 2.4em; }
          .calc-table td {
            font-size: 13.5px; padding: 14px 6px 14px 0;
            font-variant-numeric: tabular-nums; white-space: nowrap;
          }
        }
      `}</style>
    </div>
  );
}

export function Calculadora() {
  return (
    <div className="site site-wrap">
      <div className="split-label">
        <div className="eyebrow-sm">Proyección</div>
        <div>
          <h2 className="t-h2" style={{ maxWidth: "14em" }}>El interés compuesto, paso a paso.</h2>
          <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
            Configurá monto inicial, aporte periódico, rendimiento promedio y horizonte. Las cifras son indicativas y asumen rendimiento constante.
          </p>
        </div>
      </div>
      <div style={{ marginTop: 56 }}>
        <CalculadoraSim />
      </div>
    </div>
  );
}
