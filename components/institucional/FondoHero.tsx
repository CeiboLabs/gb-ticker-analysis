"use client";

import {
  Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  useSyncExternalStore,
} from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  Fachada, fachadaMascara, FACHADA_HORIZONTE, FACHADA_HORIZONTE_LEN, FACHADA_VIEWBOX,
} from "@/components/institucional/Fachada";
import { scrollWindow } from "@/components/scroll";

// Hero del fondo — versión FACHADA full-bleed. El header entero es el mosaico de
// paneles embutidos <Fachada /> (extraído a su propio componente, reusado como
// miniatura en el destacado "Invertir" del navbar). Acá va a tamaño completo: un
// scrim oscurece la izquierda para que el claim se lea; y la firma BNG a la
// derecha, sobre el horizonte, como remate.
//
// ── LA VIDA DEL HEADER ────────────────────────────────────────────────────
// La composición no se toca; lo que se agrega es LUZ y una LLEGADA. Se midió
// qué animan de hecho las casas del rubro: Man Group tiene un hero de mosaico
// facetado casi igual a este y es 100% estático; Baillie Gifford tampoco mueve
// nada en reposo, pero sí coreografía la entrada (su `wordFadeInUp`). O sea: el
// loop ambiente NO es la convención, y lo que se lee como vivo es otra cosa.
//
//  1. LLEGADA (CSS puro, sin depender de la hidratación) — el horizonte se
//     traza de izquierda a derecha y la firma BNG materializa justo donde la
//     línea aterriza. Hasta ahora todo el trabajo de `encuadrar()` era
//     invisible: la línea ya estaba en el hueco del wordmark cuando mirabas.
//     Trazarla convierte esa precisión en el gesto de marca del header.
//  2. LUZ RASANTE — una luz recorre la fachada en 30 s, ida y vuelta,
//     RECORTADA POR LAS PROPIAS FACETAS (ver `fachadaMascara`): la reciben
//     panel por panel, como un edificio real.
//  3. FOCO AL PUNTERO — relieve. Mueve la luz, nunca la geometría: el encuadre
//     wordmark↔horizonte queda intacto.
//
// Un solo sol gobierna las tres: el horizonte va dentro de la misma máscara, no
// tiene destello propio. Nada parpadea por su cuenta.
//
// Las dos capas de luz son CLIENT-ONLY (montan con `luzLista`): su máscara
// depende del `pan` del encuadre, que en el server todavía es neutro. Antes de
// hidratar el header se ve exactamente como antes, y la luz sube con un fade.
//
// El claim son DOS niveles, no tres: titular + ledger de hechos (convención de
// key-facts strip de las casas de fondos). El párrafo lead intermedio
// (FONDO.tagline) se sacó porque repetía el titular palabra por palabra
// —"diversificada" ≈ "balanceada", "domiciliada en Uruguay" = el tercer chip—;
// el ledger es lo único que aporta dato nuevo (las 3 clases de activo).
//
// ── EL CRUCE DE LA MARCA ──────────────────────────────────────────────────
// "BNG / SELECCIÓN GLOBAL" + la línea dorada son UNA sola marca: la línea tiene
// que pasar SIEMPRE por el medio del hueco entre las dos palabras, en cualquier
// viewport. No sale gratis: el horizonte es quebrado y el mosaico se recorta con
// `slice`, así que su altura en pantalla —a la x del wordmark— cambia con el
// encuadre (rozaba el BNG en 1440, caía al hueco en 1920, lo cruzaba en diagonal
// en 1120 y en mobile pasaba 100px abajo, cortando el titular). Sólo una recta
// horizontal sería invariante al recorte, y el horizonte quebrado es parte del
// dibujo: entonces se ajusta el ENCUADRE, no el dibujo. `encuadrar()` calcula
// dónde cae la línea y desplaza el mosaico lo justo para que coincida con el
// hueco; el wordmark no se mueve nunca. El desplazamiento va con un scale que
// tapa exactamente lo que el corrimiento destaparía.

type Encuadre = { pan: { x: number; y: number }; dy: number; k: number };
const SIN_ENCUADRE: Encuadre = { pan: { x: 0, y: 0 }, dy: 0, k: 1 };

declare global {
  interface Window {
    __ffacEncuadre?: Encuadre;
    /** Suelta el listener de resize del script inline — lo llama React al
     *  montar, cuando pasa a manejar el encuadre él. Ver `scriptEncuadre`. */
    __ffacSuelta?: () => void;
  }
}

/**
 * Calcula el encuadre del mosaico para que el horizonte entre por el medio del
 * hueco del wordmark. Devuelve null si todavía no hay nada que medir.
 *
 * ⚠️ AUTÓNOMA A PROPÓSITO: viaja al HTML serializada con toString() (ver
 * `scriptEncuadre`), así que no puede referenciar NADA del módulo —ni helpers,
 * ni constantes— y evita spread/destructuring/for-of, que al transpilar se
 * apoyan en helpers externos que ahí no existirían.
 */
function calcularEncuadre(HORIZ: number[][], VW: number, VH: number): Encuadre | null {
  const hero = document.querySelector(".ffac-hero") as HTMLElement | null;
  const stage = document.querySelector(".ffac-stage") as HTMLElement | null;
  const sign = document.querySelector(".ffac-sign") as HTMLElement | null;
  const bng = document.querySelector(".ffac-sign-bng") as HTMLElement | null;
  const sub = document.querySelector(".ffac-sign-sub") as HTMLElement | null;
  if (!hero || !stage || !sign || !bng || !sub) return null;
  // clientWidth/Height son medida de LAYOUT: no las toca ningún transform.
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return null;

  // Métrica de Arial (la familia del wordmark) para trabajar con el hueco
  // ÓPTICO y no con el de las cajas: la caja del "BNG" baja bastante por debajo
  // de la base de las mayúsculas, así que centrar cajas dejaría la línea baja.
  const ASC = 0.9053, DESC = 0.2119, CAP = 0.716;
  const cuerpo = function (el: HTMLElement) { return parseFloat(getComputedStyle(el).fontSize) || 0; };
  const base = function (el: HTMLElement) {
    const r = el.getBoundingClientRect(), fs = cuerpo(el);
    return r.top + (r.height - (ASC + DESC) * fs) / 2 + ASC * fs;
  };

  // Altura del horizonte en una x, ambas en unidades del lienzo.
  const yEn = function (x: number) {
    for (let i = 0; i < HORIZ.length - 1; i++) {
      if (x <= HORIZ[i + 1][0] || i === HORIZ.length - 2) {
        const t = Math.max(0, Math.min(1, (x - HORIZ[i][0]) / (HORIZ[i + 1][0] - HORIZ[i][0])));
        return HORIZ[i][1] + (HORIZ[i + 1][1] - HORIZ[i][1]) * t;
      }
    }
    return HORIZ[0][1];
  };
  // Lo más alto y lo más bajo que llega la línea entre dos x del lienzo.
  const banda = function (a: number, b: number) {
    let lo = Math.min(yEn(a), yEn(b)), hi = Math.max(yEn(a), yEn(b));
    for (let i = 0; i < HORIZ.length; i++) {
      const x = HORIZ[i][0], y = HORIZ[i][1];
      if (x > a && x < b) { if (y < lo) lo = y; if (y > hi) hi = y; }
    }
    return [lo, hi];
  };

  // Mapeo del slice: el lienzo se escala para CUBRIR la caja y se centra.
  const s = Math.max(w / VW, h / VH);
  const hr = hero.getBoundingClientRect();
  const x0 = hr.left + (w - VW * s) / 2, y0 = hr.top + (h - VH * s) / 2;
  // Lo que el recorte deja afuera: cuánto se puede pasear la ventana sin
  // destapar nada (en unidades del lienzo). En pantallas angostas sobra medio
  // edificio; en las anchas la sobra es vertical.
  const sobraX = Math.max(0, (VW - w / s) / 2), sobraY = Math.max(0, (VH - h / s) / 2);

  // Ventana del wordmark, en coordenadas del lienzo.
  const m = sign.getBoundingClientRect();
  const xa = (m.left - x0) / s, xb = (m.right - x0) / s;

  // 1) El hueco donde tiene que entrar la línea: de la base del "BNG" al tope
  //    de las mayúsculas de "SELECCIÓN GLOBAL".
  const pie = base(bng), techo = base(sub) - CAP * cuerpo(sub);
  const hueco = (pie + techo) / 2;

  // 2) El horizonte es quebrado, pero tiene un TRAMO RECTO puesto justo para
  //    esto (ver Fachada): la línea tiene que cruzar el wordmark derecha, no en
  //    diagonal. Buscamos la ventana MÁS PLANA al alcance —el tramo recto barre
  //    0— y, entre las que empatan, la más cercana, para no mover el encuadre de
  //    gusto. Pasear la ventana no se nota: el mosaico es abstracto y el recorte
  //    deja medio edificio afuera.
  const ts: number[] = [0], anchos: number[] = [];
  for (let t = -sobraX; t <= sobraX; t += 2) ts.push(t);
  let masPlano = Infinity;
  for (let i = 0; i < ts.length; i++) {
    const b = banda(xa + ts[i], xb + ts[i]);
    anchos.push(b[1] - b[0]);
    if (anchos[i] < masPlano) masPlano = anchos[i];
  }
  let panX = 0, cerca = Infinity;
  for (let i = 0; i < ts.length; i++) {
    if (anchos[i] <= masPlano + 0.25 && Math.abs(ts[i]) < cerca) { panX = ts[i]; cerca = Math.abs(ts[i]); }
  }

  // 3) Centrar esa banda en el hueco. Primero con lo gratis: pasear la ventana
  //    en vertical, hasta donde llegue la sobra del recorte.
  const bf = banda(xa + panX, xb + panX);
  const centro = y0 + ((bf[0] + bf[1]) / 2) * s;
  const panY = Math.max(-sobraY, Math.min(sobraY, -(hueco - centro) / s));

  // 4) Lo que la sobra no alcanzó a cubrir se corre por CSS, con un scale que
  //    tapa justo lo que el corrimiento destaparía. El scale es respecto del
  //    centro del stage, así que también mueve la línea (y = c + (y−c)·k + dy):
  //    el punto fijo se alcanza en dos vueltas.
  const c = hr.top + h / 2, alfa = hueco - c, beta = centro - panY * s - c;
  let dy = 0, k = 1;
  for (let i = 0; i < 4; i++) {
    dy = alfa - beta * k;
    k = Math.abs(dy) < 0.05 ? 1 : 1 + (2 * Math.abs(dy) + 1) / h;
  }

  const r1 = function (v: number) { return Math.round(v * 10) / 10; };
  return { pan: { x: r1(panX), y: r1(panY) }, dy: r1(dy), k: Math.round(k * 1e4) / 1e4 };
}

/**
 * El mismo cálculo, corriendo INLINE apenas el navegador parsea el hero. Si
 * esperáramos a la hidratación, el mosaico se reencuadraría a la vista: un
 * salto de ~330px en mobile. El resultado queda en window para que el primer
 * render de React arranque de ahí y no lo pise.
 *
 * ⚠️ Y SE QUEDA VIGILANDO EL LAYOUT hasta que React monte, con los MISMOS tres
 * disparadores que después usa el efecto de React (resize, tamaño del hero,
 * fuentes). No es de más: entre el primer pintado y la hidratación pasa mucho
 * —en un teléfono, segundos; contra el dev server, más— y en ese rato el layout
 * cambia solo dos veces:
 *   · el viewport, porque Safari de iOS hace el primer layout con la barra
 *     desplegada y lo rehace con el viewport grande (el padding del hero y el
 *     `top` del wordmark son vh). Medido en ese cruce (844↔750): dy 13.5px y
 *     escala 1.41→1.46;
 *   · el TITULAR, que en la primera visita (cache frío) se reacomoda solo a los
 *     ~200ms y con eso mueve el alto del hero, que es contra lo que se encuadra.
 *     Medido en el iPhone: el h1 pasa de 245px a 140px y el hero de 850 a 745.
 *     Por eso vigilamos el tamaño del hero y `document.fonts.ready` además del
 *     resize: cuál de los dos lo dispara no está confirmado, pero los dos
 *     llegan antes que la hidratación y con cualquiera alcanza.
 * Sin vigilar, el encuadre queda viejo hasta que alguien lo despierte: o se
 * aplica de golpe (el salto del mosaico) o no se aplica nunca y la línea dorada
 * queda fuera del hueco del wordmark hasta que recargues. Las dos cosas se
 * vieron en el iPhone; la segunda, medida en dos fotos con el MISMO layout y la
 * línea 56px más arriba en la primera visita que en el refresh.
 *
 * El HTML que devuelve es 100% estático —números del propio módulo y el código
 * de `calcularEncuadre`—: no entra nada de afuera, no hay superficie de XSS.
 */
function scriptEncuadre(horizonte: number[][], vw: number, vh: number) {
  return `(function(){try{`
    + `var f=${calcularEncuadre.toString()};`
    + `var raf=0;`
    + `var aplicar=function(){raf=0;if(!vivo)return;`
    + `var r=f(${JSON.stringify(horizonte)},${vw},${vh});if(!r)return;window.__ffacEncuadre=r;`
    + `var s=document.querySelector(".ffac-stage svg");if(s)s.setAttribute("viewBox",r.pan.x+" "+r.pan.y+" "+${vw}+" "+${vh});`
    + `var d=document.querySelector(".ffac-stage-fit");if(d)d.style.transform="translateY("+r.dy+"px) scale("+r.k+")";};`
    // Un solo recálculo por frame: al retraerse la barra del navegador el
    // resize llega en ráfaga.
    + `var vivo=1;`
    + `var pedir=function(){if(vivo&&!raf)raf=requestAnimationFrame(aplicar)};`
    + `addEventListener("resize",pedir);`
    // El alto del hero, en border-box —el padding es en vh y el de contenido no
    // lo ve— y las fuentes, que recortan el titular distinto al entrar.
    // El del hero aplica EN EL ACTO, sin pasar por rAF: el callback del
    // ResizeObserver corre después del layout y antes de pintar, así que el
    // mosaico se reencuadra en el MISMO frame en que el hero cambió de alto.
    // Diferido, el frame del medio muestra el encuadre viejo — que es el
    // parpadeo que se ve. Escribir acá no puede realimentar al observer: lo
    // único que toca son un transform y un viewBox, y ninguno mueve la caja.
    + `var ro=null,h=document.querySelector(".ffac-hero");`
    + `if(h&&window.ResizeObserver){ro=new ResizeObserver(function(){`
    + `if(raf){cancelAnimationFrame(raf);raf=0}aplicar()});ro.observe(h,{box:"border-box"});}`
    + `if(document.fonts&&document.fonts.ready)document.fonts.ready.then(pedir);`
    // React lo llama al montar: de ahí en adelante el transform lo escribe él y
    // no puede haber dos manos sobre el mismo nodo. `vivo` corta también lo que
    // no se puede desenganchar, que es el then() de las fuentes.
    + `window.__ffacSuelta=function(){vivo=0;removeEventListener("resize",pedir);`
    + `if(ro)ro.disconnect();if(raf)cancelAnimationFrame(raf);raf=0;};`
    // El primer encuadre va ÚLTIMO a propósito: si llegara a fallar, el catch
    // se lo come y queremos que el listener ya esté puesto igual.
    + `aplicar();`
    + `}catch(e){}})()`;
}

// useLayoutEffect avisa en SSR; en el server no hay nada que medir.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// El titular entra palabra por palabra (patrón `wordFadeInUp` de Baillie
// Gifford). Se parte acá, en el módulo, y no midiendo líneas en el cliente: el
// índice de cada palabra es el mismo en server y en browser, así que la
// coreografía arranca con el primer pintado en vez de esperar la hidratación
// —que dejaría el titular quieto un instante y recién ahí lo animaría.
// Va agrupado porque hay pares que NO se pueden cortar. Cada grupo de más de
// una palabra se envuelve en `.fh-liga` (white-space: nowrap) — y tiene que ser
// eso, no un espacio duro: entre dos `inline-block` la oportunidad de corte
// existe igual, con `&nbsp;` o sin él (probado, el nbsp no cambia nada).
//
// Atar "con diversificación" es lo que permite APAGAR `text-wrap: balance` en el
// teléfono sin que el titular corte en preposición, que era justo lo que el
// balance estaba evitando. Ver el porqué en la regla de .fh-h1, abajo.
const GRUPOS = [
  ["Una"], ["estrategia"], ["balanceada"], ["y"], ["gestionada"],
  ["profesionalmente,"], ["con", "diversificación"], ["global."],
];
// El índice del escalonado es el de PALABRA, no el de grupo: la coreografía
// entra palabra por palabra aunque dos viajen atadas. Se calcula una sola vez.
const TITULAR: { palabra: string; i: number }[][] = (() => {
  let i = 0;
  return GRUPOS.map((grupo) => grupo.map((palabra) => ({ palabra, i: i++ })));
})();

// "¿Ya estoy en el cliente?" vía useSyncExternalStore: devuelve false en el
// server y true en el browser, sin el setState-dentro-de-effect que dispara un
// render en cascada. Las tres funciones viven en el módulo para que sean
// estables entre renders y no re-suscriban.
const NO_SUSCRIBE = () => () => {};
const HAY_CLIENTE = () => true;
const NO_HAY_CLIENTE = () => false;

/** `casa` = origen del sitio institucional para los links que salen de este
 *  sitio; vacío cuando los dos comparten hostname. Ver lib/sitios.ts. */
export function FondoHero({ casa }: { casa: string }) {
  const reduce = useReducedMotion();

  const heroRef = useRef<HTMLElement>(null);
  // Encuadre del mosaico: qué ventana del lienzo muestro (pan, gratis) y, si no
  // alcanza, cuánto lo corro y lo agrando por CSS para que el corrimiento no
  // destape borde. En el server arranca neutro; en el cliente, del valor que ya
  // dejó el script inline —así el primer render de React coincide con el DOM
  // que el navegador ya pintó y no lo revierte.
  const [encuadre, setEncuadre] = useState<Encuadre>(
    () => (typeof window === "undefined" ? SIN_ENCUADRE : window.__ffacEncuadre ?? SIN_ENCUADRE));
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.65, 1], [1, 1, 0.4]);
  const stageScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  // La firma se va con el scroll, y a mitad del hero ya no está. Es la única
  // ventana PARCIAL de las cuatro (las otras tres llegan a 1), así que va por
  // scrollWindow: framer v12 acelera estos transforms a WAAPI y usa el
  // inputRange como offsets de keyframes; sin uno explícito en 1, el navegador
  // completa la cola interpolando hacia el valor subyacente del style
  // —opacity: 1— y el wordmark REAPARECE de a poco hasta el final del hero
  // (medido: 0 a los 368px, de vuelta en 1 a los 810). Ver components/scroll.tsx.
  const signW = scrollWindow(0, 0.45, 1, 0);
  const signOpacity = useTransform(scrollYProgress, signW.times, signW.values);

  /** Corre el mosaico hasta que el horizonte entre por el medio del wordmark. */
  const encuadrar = useCallback(() => {
    const next = calcularEncuadre(FACHADA_HORIZONTE, FACHADA_VIEWBOX.w, FACHADA_VIEWBOX.h);
    if (!next) return;
    setEncuadre((prev) =>
      Math.abs(prev.pan.x - next.pan.x) < 0.2 && Math.abs(prev.pan.y - next.pan.y) < 0.2
        && Math.abs(prev.dy - next.dy) < 0.2 && Math.abs(prev.k - next.k) < 0.002 ? prev : next);
  }, []);

  // Re-encuadra ante cualquier cambio de tamaño del hero (viewport, rotación,
  // barra del navegador en mobile) y cuando terminan de cargar las fuentes —el
  // serif del titular puede cambiar la altura del hero, y con ella el recorte.
  //
  // La regla que ordena todo esto: el encuadre no puede quedar VIEJO nunca. No
  // porque una línea corrida se note —se nota poco—, sino porque la corrección
  // se acumula y el siguiente disparo la aplica entera de una: el salto del
  // mosaico en el teléfono era eso, no un reencuadre de más.
  useIsoLayoutEffect(() => {
    // Hasta este render el encuadre lo venía manteniendo el script inline (ver
    // scriptEncuadre). De acá en adelante lo escribe React: que suelte el suyo.
    window.__ffacSuelta?.();
    encuadrar();
    const hero = heroRef.current;
    if (!hero) return;
    // ⚠️ border-box, NO el de contenido (que es lo que observa por defecto).
    // En mobile el alto del hero se mueve sólo por su padding —`calc(--nav-h +
    // clamp(120px, 30vh, 240px))`—, y el padding no entra en la caja de
    // contenido: el observer por default es CIEGO justo al cambio que importa.
    // Medido con los dos a la vez sobre cinco cambios de alto de viewport: el
    // de contenido se disparó una sola vez (la llamada inicial) y el de borde,
    // las cinco.
    const ro = new ResizeObserver(() => encuadrar());
    ro.observe(hero, { box: "border-box" });
    // Y el viewport aparte, porque no todo cambio de encuadre pasa por el
    // tamaño del hero: el wordmark se sitúa con `top: clamp(150px, 26vh,
    // 240px)` y cambiar de POSICIÓN no es cambiar de tamaño — no hay
    // ResizeObserver que se entere. En los teléfonos grandes el hero ya tiene
    // los 30vh clampeados en 240 y es justamente el wordmark el que se mueve.
    let raf = 0;
    const alResize = () => {
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; encuadrar(); });
    };
    window.addEventListener("resize", alResize);
    document.fonts?.ready.then(() => encuadrar());
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", alResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [encuadrar]);

  // ── Luz ──────────────────────────────────────────────────────────────────
  // Las capas de luz montan recién en el cliente: su máscara se recorta contra
  // los paneles y tiene que llevar el MISMO pan que el mosaico, que en el
  // server todavía es neutro. Montarlas después evita que la luz aparezca
  // corrida medio edificio durante el primer pintado.
  const luzLista = useSyncExternalStore(NO_SUSCRIBE, HAY_CLIENTE, NO_HAY_CLIENTE);
  const mascara = useMemo(() => fachadaMascara(encuadre.pan), [encuadre.pan]);

  // La luz sólo existe mientras el hero esté a la vista. Sin esto la banda
  // rasante sigue animando toda la página —que mide unos 13.500 px contra los
  // 774 del hero—, o sea que ~94% del scroll estaría gastando CPU y memoria de
  // GPU en algo que nadie puede ver. La clase la escribe el observer directo
  // sobre el nodo: pasarlo por estado dispararía un render por cada cruce.
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const io = new IntersectionObserver(([e]) => hero.classList.toggle("ffac-fuera", !e.isIntersecting));
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  // Foco que sigue al puntero. Escribe el transform directo sobre el nodo (no
  // por estado de React: son ~60 actualizaciones por segundo) y persigue al
  // cursor con inercia, así el relieve se siente material y no pegado al mouse.
  // Sólo con puntero fino: en touch no hay hover que seguir y sería una capa
  // más para componer a cambio de nada.
  // ⚠️ `luzLista` VA EN LAS DEPS. La bola se monta recién cuando esa bandera se
  // prende, o sea un render DESPUÉS del de hidratación: si el efecto sólo
  // dependiera de `reduce`, correría con bolaRef.current en null, saldría por la
  // guarda y no volvería a intentarlo nunca. Enganchaba sólo de casualidad —
  // cuando useReducedMotion pasaba de null a false después de montarse la capa y
  // lo hacía correr de nuevo—, y de ahí que el foco anduviera a veces sí y a
  // veces no.
  const bolaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const hero = heroRef.current, bola = bolaRef.current;
    if (!hero || !bola || reduce) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let destinoX = 0, destinoY = 0, x = 0, y = 0, raf = 0;
    const paso = () => {
      x += (destinoX - x) * 0.055;
      y += (destinoY - y) * 0.055;
      // Del ref y no de la variable capturada: si la capa se remontara, escribir
      // sobre el nodo viejo —ya desconectado— no se vería y no habría error.
      const nodo = bolaRef.current;
      if (nodo) nodo.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      raf = Math.abs(destinoX - x) > 0.5 || Math.abs(destinoY - y) > 0.5
        ? requestAnimationFrame(paso) : 0;
    };
    const mover = (e: PointerEvent) => {
      // Con el hero fuera de cuadro la bola ya no se ve, pero ahora la capa
      // sigue montada (ver el comentario de .ffac-fuera en los estilos): sin
      // esta guarda seguiríamos escribiéndole transform a algo invisible y
      // ensuciando su capa por nada. Antes lo tapaba el display:none.
      if (hero.classList.contains("ffac-fuera")) return;
      const r = hero.getBoundingClientRect();
      destinoX = e.clientX - r.left - r.width / 2;
      destinoY = e.clientY - r.top - r.height / 2;
      if (!raf) raf = requestAnimationFrame(paso);
    };
    window.addEventListener("pointermove", mover, { passive: true });
    return () => {
      window.removeEventListener("pointermove", mover);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduce, luzLista]);

  return (
    <header className="ffac-hero" ref={heroRef}>
      {/* ── Fachada (mosaico + horizonte) ── */}
      <motion.div className="ffac-stage" style={reduce ? undefined : { scale: stageScale }}>
        {/* suppressHydrationWarning: el server manda el encuadre neutro y el
            script inline ya lo ajustó antes de hidratar — la diferencia es
            deliberada (si no, el mosaico saltaría a la vista). */}
        <div
          className="ffac-stage-fit" suppressHydrationWarning
          style={{ transform: `translateY(${encuadre.dy}px) scale(${encuadre.k})` }}
        >
          {/* Caja de la LLEGADA. Va aparte del stage-fit porque ahí escribe el
              encuadre, y aparte del stage porque ahí escribe framer el parallax:
              tres transforms, tres cajas, ninguna pisando a la otra. */}
          <div className="ffac-lienzo">
            <Fachada pan={encuadre.pan} />

            {luzLista && (
              <>
                {/* Luz rasante: la banda es lo único que se mueve (transform,
                    compositada); la máscara de facetas es estática y se
                    rasteriza una sola vez. */}
                <div
                  className="ffac-luz on"
                  style={{ WebkitMaskImage: mascara, maskImage: mascara }}
                  aria-hidden
                >
                  <div className="ffac-luz-banda" />
                </div>

                {/* Foco al puntero — misma máscara, mismo material. */}
                <div
                  className="ffac-foco on"
                  style={{ WebkitMaskImage: mascara, maskImage: mascara }}
                  aria-hidden
                >
                  <div className="ffac-foco-bola" ref={bolaRef} />
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Scrim: legibilidad del claim a la izquierda + profundidad ── */}
      <div className="ffac-scrim" aria-hidden />

      {/* ── Marca BNG (wordmark atravesado por el horizonte dorado) ── */}
      <motion.div
        className="ffac-sign" aria-hidden
        style={reduce ? undefined : { opacity: signOpacity }}
      >
        {/* La llegada va en una caja INTERIOR: framer le anima la opacidad al
            .ffac-sign para el fade-out del scroll, y lo hace por WAAPI —que en
            la cascada le gana a las animaciones de CSS—, así que un keyframe de
            entrada puesto ahí no se vería nunca. Separadas, cada una manda en su
            capa y las dos opacidades se multiplican. */}
        <span className="ffac-sign-in">
          <span className="ffac-sign-bng">BNG</span>
          <span className="ffac-sign-sub">SELECCIÓN GLOBAL</span>
        </span>
      </motion.div>

      {/* ── Claim editorial ── */}
      <motion.div className="site-wrap ffac-content" style={reduce ? undefined : { y: contentY, opacity: contentOpacity }}>
        <div className="ffac-copy">
          <h1 className="fh-h1 t-serif-display">
            {TITULAR.map((grupo, g) => {
              const palabras = grupo.map(({ palabra, i }) => (
                <Fragment key={i}>
                  <span className="fh-w" style={{ "--i": i } as React.CSSProperties}>{palabra}</span>{" "}
                </Fragment>
              ));
              return grupo.length > 1
                ? <span className="fh-liga" key={g}>{palabras}</span>
                : <Fragment key={g}>{palabras}</Fragment>;
            })}
          </h1>
          <ul className="fh-ledger">
            <li>Acciones + Bonos + Activos alternativos</li>
            <li>Exposición global</li>
            <li>Domiciliado en Uruguay</li>
          </ul>
          <div className="fh-actions">
            <a href={`${casa}/contacto`} className="ui-btn ui-btn-on-navy">Hablar con un asesor</a>
            <a href="#estrategia" className="fh-link">Cómo invierte →</a>
          </div>
        </div>
      </motion.div>

      <style>{`
        .ffac-hero {
          /* La curva única de la casa (docs/lenguaje-visual.md). */
          --ffac-ease: cubic-bezier(0.16, 1, 0.3, 1);
          position: relative; isolation: isolate; overflow: hidden;
          color: #fff; background: var(--navy);
          min-height: min(90vh, 860px);
          display: flex; align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        /* will-change promueve el stage a su propia capa GPU: el scale del
           parallax escala una textura cacheada en vez de rerasterizar el SVG de
           24 polígonos por frame (eso fundía la máquina al final del hero). */
        .ffac-stage { position: absolute; inset: 0; z-index: 0; will-change: transform; }
        /* Caja del encuadre: la mueve encuadrar() para que el horizonte entre
           por el medio del wordmark. Va aparte del stage para no pelearse con el
           transform que framer escribe ahí para el parallax. */
        .ffac-stage-fit { position: absolute; inset: 0; }
        .ffac-lienzo { position: absolute; inset: 0; }

        /* ── LUZ ──────────────────────────────────────────────────────────
           Dos capas, una sola máscara: la silueta de los paneles (la arma
           fachadaMascara con el mismo pan que el mosaico). Por eso la luz cae
           panel por panel en vez de barrer el hero como un brillo plano.
           Quedan DEBAJO del scrim a propósito: a la izquierda el scrim las
           apaga, que es donde tiene que mandar el claim. */
        .ffac-luz, .ffac-foco {
          position: absolute; inset: 0; pointer-events: none; overflow: hidden;
          opacity: 0; transition: opacity 900ms var(--ffac-ease);
          -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
          -webkit-mask-size: 100% 100%; mask-size: 100% 100%;
          /* Capa propia: la máscara se rasteriza una vez y el hijo que se mueve
             no obliga a repintar el SVG de 24 polígonos que hay debajo. */
          transform: translateZ(0);
        }
        .ffac-luz.on, .ffac-foco.on { opacity: 1; }

        /* Fuera de pantalla no hay luz que valga: las capas dejan de pintarse y
           la banda —lo único que cuesta por frame— se pausa.

           ⚠️ ACÁ NO VA display:none, por más que sea lo que uno escribiría.
           Medido en Safari (safaridriver, wheel frame a frame): sacar las dos
           capas del árbol cuesta un frame de ~55ms, porque WebKit rehace el
           layout del hero y reconstruye su árbol de capas de una. Y ese frame
           cae SIEMPRE en el peor momento posible: el hero mide exactamente lo
           que hay que scrollear para que termine de salir, que es el mismo
           píxel en el que la barra de secciones llega al tope y se pega. Con
           Lenis el scroll lo mueve el main thread, así que esos 55ms no se ven
           como un salto de la luz —que ya no está— sino como un tranque de la
           PÁGINA justo cuando la barra empieza a acompañar el scroll.

           visibility + animation-play-state compran lo mismo —ni se pintan ni
           animan— pero son cambios de pintado y de compositor, sin layout: el
           frame del cruce baja de 55ms a 17. */
        .ffac-hero.ffac-fuera .ffac-luz,
        .ffac-hero.ffac-fuera .ffac-foco { visibility: hidden; }
        .ffac-hero.ffac-fuera .ffac-luz-banda { animation-play-state: paused; }

        /* En touch no hay puntero que seguir. El efecto ya no se suscribía a
           nada, pero la capa se seguía componiendo: un degradado de varios MB
           quieto para siempre. Acá muere del lado del CSS, que es el que manda
           sobre si la capa existe. */
        @media (hover: none), (pointer: coarse) {
          .ffac-foco { display: none; }
        }

        /* Banda rasante: lo ÚNICO que se mueve en reposo. 30 s de ida y vuelta
           con ease-in-out simétrico — no la curva de la casa, que es de llegada
           y acá dejaría el retorno arrancando de golpe. El núcleo es blanco y
           los flancos dorados: luz, no un tinte de color. */
        /* La caja se queda en el alto del hero y sobra sólo a los costados, que
           es por donde viaja. Desbordarla también en vertical no agregaba nada
           —el degradado llena su caja igual, la inclinación de 101deg ya sale
           de los stops— y engordaba la capa a componer un 40%. */
        .ffac-luz-banda {
          position: absolute; top: 0; bottom: 0; left: -45%; width: 190%;
          background: linear-gradient(101deg,
            transparent 0%,
            rgba(235,210,136,0) 26%,
            rgba(235,210,136,0.13) 40%,
            rgba(255,255,255,0.22) 50%,
            rgba(235,210,136,0.13) 60%,
            rgba(235,210,136,0) 74%,
            transparent 100%);
          will-change: transform;
          animation: ffac-rasante 30s ease-in-out infinite alternate;
        }
        /* ±28% del ancho propio (190%) = ±53% del hero: el núcleo de luz barre
           de borde a borde justo, sin recorrido de más. */
        @keyframes ffac-rasante {
          from { transform: translate3d(-28%, 0, 0); }
          to   { transform: translate3d(28%, 0, 0); }
        }

        /* Foco al puntero: lo posiciona el efecto de arriba escribiendo
           transform. Sobredimensionado para que el borde del degradado nunca
           entre en cuadro. */
        .ffac-foco-bola {
          position: absolute; left: 50%; top: 50%;
          width: 80vmax; height: 80vmax; margin: -40vmax 0 0 -40vmax;
          background: radial-gradient(closest-side,
            rgba(255,255,255,0.20), rgba(235,210,136,0.07) 45%, transparent 72%);
          will-change: transform;
        }

        /* ── LLEGADA ──────────────────────────────────────────────────────
           Todo en CSS y servido desde el server: arranca con el primer pintado,
           sin esperar la hidratación. El estado inicial (invisible) lo pone el
           fill-mode, así que si el navegador pide reduce-motion y matamos las
           animaciones, todo queda visible sin más. */
        .ffac-lienzo { animation: ffac-entra-lienzo 1400ms var(--ffac-ease) both; }
        @keyframes ffac-entra-lienzo {
          from { opacity: 0; transform: scale(1.03); }
          to   { opacity: 1; transform: none; }
        }

        /* El horizonte se traza. Scopeado al hero: la misma polilínea la usa la
           miniatura del navbar, que tiene que seguir apareciendo dibujada. */
        .ffac-hero .ffac-horizonte {
          stroke-dasharray: ${FACHADA_HORIZONTE_LEN};
          animation: ffac-traza 1500ms var(--ffac-ease) 250ms both;
        }
        @keyframes ffac-traza {
          from { stroke-dashoffset: ${FACHADA_HORIZONTE_LEN}; }
          to   { stroke-dashoffset: 0; }
        }

        /* La firma materializa cuando la línea ya le llegó: ese encuentro ES el
           gesto de marca. Va en .ffac-sign-in y no en .ffac-sign porque ahí
           manda framer (ver el comentario en el markup).
           ⚠️ SÓLO OPACIDAD, NUNCA TRANSFORM. El wordmark es lo que mide
           calcularEncuadre() para saber dónde tiene que entrar el horizonte, y
           con fill: both la animación ya lo tiene desplazado ANTES de arrancar:
           el script inline mediría la firma 14px más abajo, encuadraría contra
           esa posición falsa y dejaría la línea pegada a SELECCIÓN GLOBAL para
           siempre (el encuadre no se recalcula solo: el ResizeObserver mira el
           tamaño del hero, que no cambia). Que la firma no se mueva además es
           lo correcto de diseño: su posición es justamente el punto. */
        .ffac-sign-in { display: block; }
        .ffac-hero .ffac-sign-in {
          animation: ffac-aparece 900ms var(--ffac-ease) 1000ms both;
        }
        @keyframes ffac-aparece { from { opacity: 0; } to { opacity: 1; } }

        /* Titular palabra por palabra; después el ledger y los botones. */
        .fh-h1 .fh-w {
          display: inline-block;
          animation: ffac-entra 800ms var(--ffac-ease) both;
          animation-delay: calc(120ms + var(--i) * 45ms);
        }
        .ffac-hero .fh-ledger  { animation: ffac-entra 800ms var(--ffac-ease) 1150ms both; }
        .ffac-hero .fh-actions { animation: ffac-entra 800ms var(--ffac-ease) 1280ms both; }
        @keyframes ffac-entra {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: none; }
        }

        /* Scrim: izquierda muy oscura (claim) → derecha despejada (fachada y
           firma). Más un velo arriba (navbar) y abajo (CTAs). */
        .ffac-scrim {
          position: absolute; inset: 0; z-index: 1; pointer-events: none;
          background:
            linear-gradient(90deg, rgba(7,14,34,0.95) 0%, rgba(7,14,34,0.66) 32%, rgba(7,14,34,0.08) 60%, transparent 78%),
            linear-gradient(180deg, rgba(7,14,34,0.45) 0%, transparent 26%, transparent 64%, rgba(7,14,34,0.40) 100%);
        }

        /* Firma — sobre el horizonte, en el cuadrante derecho. No se mueve:
           el que se acomoda para que la línea le entre por el hueco es el
           mosaico (ver encuadrar() arriba). */
        .ffac-sign {
          position: absolute; z-index: 2; top: 50%; left: 72%;
          transform: translate(-50%, -50%); text-align: center; pointer-events: none;
          text-shadow: 0 2px 22px rgba(0,0,0,0.55);
        }
        .ffac-sign-bng {
          display: block; font-size: clamp(40px, 5.2vw, 76px); font-weight: 700;
          line-height: 1; letter-spacing: 0.01em; color: #fff;
        }
        .ffac-sign-sub {
          display: block; margin-top: 12px; font-size: clamp(12px, 1.05vw, 17px);
          font-weight: 600; letter-spacing: 0.26em; color: var(--gold-soft);
        }

        .ffac-content { position: relative; z-index: 3; width: 100%; }
        /* El bloque respira más ancho en desktop (40em), pero el tope en vw lo
           encoge junto al viewport para que nunca choque con la firma BNG
           (centrada al 72%) ni se meta en el cuadrante claro de la fachada cerca
           del breakpoint móvil. Debajo de 920px pasa a ancho completo (abajo). */
        .ffac-copy { max-width: min(40em, 48vw); }

        /* text-wrap: balance reparte las palabras entre las líneas en vez de
           llenar cada una hasta el borde: sin esto el titular corta en
           preposición ("profesionalmente, con" / "diversificación global") y deja
           una línea huérfana en el medio. Se apaga en el teléfono — ver la regla
           en el bloque de ≤920px, que explica por qué. */
        .ffac-hero .fh-h1 {
          margin: 0; color: #fff; text-wrap: balance;
          font-size: clamp(34px, 4.6vw, 60px); line-height: 1.04;
        }
        /* Par de palabras que viaja junto (ver GRUPOS arriba). */
        .fh-liga { white-space: nowrap; }
        /* Sin lead de por medio, el ledger cuelga directo del titular: necesita
           más aire arriba para no leerse como una cuarta línea del H1. */
        .fh-ledger {
          list-style: none; margin: 34px 0 0; padding: 18px 0 0;
          border-top: 1px solid rgba(255,255,255,0.16);
          display: flex; flex-wrap: wrap; gap: 10px 30px;
          font-size: 12.5px; letter-spacing: 0.04em; color: rgba(255,255,255,0.7);
        }
        .fh-ledger li { position: relative; }
        .fh-ledger li + li::before {
          content: "·"; position: absolute; left: -16px; color: var(--gold-soft);
        }
        .fh-actions { margin-top: 28px; display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
        .fh-link {
          font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.9);
          text-decoration: none; transition: color 180ms ease;
        }
        /* Con el dedo el link tiene que ser tan tocable como el botón que tiene
           al lado: 24px de alto de texto pasan a 44 de caja. No mueve nada —el
           botón blanco ya mide 47 y la fila los centra—. */
        @media (pointer: coarse) {
          .fh-link { display: inline-flex; align-items: center; min-height: 44px; }
        }
        .fh-link:hover { color: var(--gold-soft); }

        @media (max-width: 920px) {
          .ffac-hero {
            min-height: auto; align-items: flex-end;
            padding: calc(var(--nav-h) + clamp(120px, 30vh, 240px)) 0 clamp(36px, 7vh, 64px);
          }
          /* La firma sube al cuadrante superior y hace de marca — el mosaico se
             reencuadra solo para que el horizonte la siga hasta ahí (antes la
             línea quedaba 100px más abajo, cortando el titular). */
          .ffac-sign { top: clamp(150px, 26vh, 240px); left: 50%; }
          .ffac-scrim {
            background: linear-gradient(180deg, rgba(7,14,34,0.50) 0%, rgba(7,14,34,0.18) 36%, rgba(7,14,34,0.86) 78%);
          }
          .ffac-copy { max-width: none; }

          /* ⚠️ SIN BALANCE ACÁ, y no es capricho de diseño.
             El balanceador de WebKit entrega un resultado INTERMEDIO antes de
             asentarse: medido en un iPhone (iOS 18.7, primera visita en frío),
             a los 369ms el titular estaba en 7 renglones —"Una" sola, después
             "estrategia" sola— y a los 706ms pasaba a los 4 definitivos. No es
             la fuente ni el ancho: en las dos muestras las palabras miden lo
             mismo (Una=57, estrategia=126, balanceada=149), el contenedor mide
             335 en las dos y ninguna @font-face había cargado todavía. Con
             "Una estrategia" ocupando 189 de 335, cortar después de "Una" no es
             una decisión de ancho: es el balanceador a medio hacer.
             Eso mueve el alto del titular de 245 a 140 y con él el del hero,
             que es contra lo que se encuadra el mosaico (ver calcularEncuadre).
             En desktop se puede dejar porque ahí el hero tiene min-height: su
             alto no depende del titular y un intermedio no mueve nada.
             El corte bueno no se pierde: lo sostiene la atadura de
             "con diversificación" (ver GRUPOS), que es lo único que el balance
             estaba comprando en este ancho. */
          .ffac-hero .fh-h1 { text-wrap: wrap; }
        }
        @media (max-width: 640px) {
          .fh-ledger { flex-direction: column; gap: 9px; padding-top: 16px; }
          .fh-ledger li + li::before { content: none; }
        }

        /* ── Teléfono acostado ────────────────────────────────────────────
           La firma se posiciona con 26vh y el claim con 30vh, pero cada clamp
           tiene su propio piso: con 390px de alto los dos vh se derrumban y
           mandan los pisos —firma clavada a 150px del tope, claim arrancando a
           192— así que entre el subtítulo de la marca y el titular quedaban
           CUATRO píxeles (medido a 844x390 y a 667x375; en vertical el aire es
           de 36 a 62). El disparador es el ALTO, que es la dimensión que falta:
           un teléfono en vertical (568px o más) no entra acá.

           La firma tampoco puede subir más allá de lo que tapa el navbar fijo:
           su caja está centrada en su propio top (translate -50%), así que el
           límite es --nav-h + la mitad de su alto + aire. Con 94px la mitad del
           wordmark quedaba abajo de la barra. */
        @media (max-width: 920px) and (max-height: 560px) {
          .ffac-hero { padding-top: calc(var(--nav-h) + 112px); }
          .ffac-sign { top: calc(var(--nav-h) + 46px); }
          .ffac-sign-bng { font-size: clamp(32px, 4vw, 52px); }
          .ffac-sign-sub { margin-top: 9px; }
        }

        /* Reduce-motion: se apaga TODO el movimiento. Como el estado inicial de
           la llegada lo pone el fill-mode, matar las animaciones deja cada cosa
           en su estado final —no hace falta redeclarar nada visible—; sólo hay
           que soltar el dasharray para que el horizonte no quede punteado. */
        @media (prefers-reduced-motion: reduce) {
          .ffac-lienzo,
          .ffac-hero .ffac-horizonte,
          .ffac-hero .ffac-sign-in,
          .fh-h1 .fh-w,
          .ffac-hero .fh-ledger,
          .ffac-hero .fh-actions,
          .ffac-luz-banda { animation: none; }
          .ffac-hero .ffac-horizonte { stroke-dasharray: none; }
          .ffac-foco { display: none; }
        }
      `}</style>

      {/* Encuadre antes del primer pintado. Va acá abajo, después del markup y
          de los estilos del hero, para que al ejecutarse ya haya layout que
          medir.

          ⚠️ VA COMO HTML CRUDO DE UN CONTENEDOR, no como un elemento script del
          árbol de React. Un script sólo se ejecuta cuando el HTML lo escribe el
          server: si React lo crea en el CLIENTE —navegación interna, o cualquier
          render que no sea la hidratación— el nodo nace inerte, y React 19 lo
          cantea por consola ("Encountered a script tag while rendering React
          component"). Metido en el innerHTML de un div, el server lo sigue
          emitiendo tal cual (el navegador lo ejecuta al parsear, que es lo único
          que nos importa) y en el cliente queda un nodo muerto que no avisa nada:
          ahí el encuadre ya lo pone el layout effect, antes del pintado. */}
      <div
        hidden
        dangerouslySetInnerHTML={{
          __html: `<script>${
            scriptEncuadre(FACHADA_HORIZONTE, FACHADA_VIEWBOX.w, FACHADA_VIEWBOX.h)
          }</script>`,
        }}
      />
    </header>
  );
}
