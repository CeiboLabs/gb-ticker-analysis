"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Fachada, FACHADA_HORIZONTE, FACHADA_VIEWBOX } from "@/components/institucional/Fachada";

// Hero del fondo — versión FACHADA full-bleed. El header entero es el mosaico de
// paneles embutidos <Fachada /> (extraído a su propio componente, reusado como
// miniatura en el destacado "Invertir" del navbar). Acá va a tamaño completo: un
// scrim oscurece la izquierda para que el claim se lea; y la firma BNG a la
// derecha, sobre el horizonte, como remate. SIN animación de entrada: todo
// renderiza en su estado final; sólo queda un push-out sutil al scroll (atenuado
// en reduce-motion).
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
  interface Window { __ffacEncuadre?: Encuadre }
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
 * El HTML que devuelve es 100% estático —números del propio módulo y el código
 * de `calcularEncuadre`—: no entra nada de afuera, no hay superficie de XSS.
 */
function scriptEncuadre(horizonte: number[][], vw: number, vh: number) {
  return `(function(){try{var f=${calcularEncuadre.toString()};var r=f(${JSON.stringify(horizonte)},${vw},${vh});`
    + `if(!r)return;window.__ffacEncuadre=r;`
    + `var s=document.querySelector(".ffac-stage svg");if(s)s.setAttribute("viewBox",r.pan.x+" "+r.pan.y+" "+${vw}+" "+${vh});`
    + `var d=document.querySelector(".ffac-stage-fit");if(d)d.style.transform="translateY("+r.dy+"px) scale("+r.k+")";`
    + `}catch(e){}})()`;
}

// useLayoutEffect avisa en SSR; en el server no hay nada que medir.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function FondoHero() {
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
  const signOpacity = useTransform(scrollYProgress, [0, 0.45], [1, 0]);

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
  useIsoLayoutEffect(() => {
    encuadrar();
    const hero = heroRef.current;
    if (!hero) return;
    const ro = new ResizeObserver(() => encuadrar());
    ro.observe(hero);
    document.fonts?.ready.then(() => encuadrar());
    return () => ro.disconnect();
  }, [encuadrar]);

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
          <Fachada pan={encuadre.pan} />
        </div>
      </motion.div>

      {/* ── Scrim: legibilidad del claim a la izquierda + profundidad ── */}
      <div className="ffac-scrim" aria-hidden />

      {/* ── Marca BNG (wordmark atravesado por el horizonte dorado) ── */}
      <motion.div
        className="ffac-sign" aria-hidden
        style={reduce ? undefined : { opacity: signOpacity }}
      >
        <span className="ffac-sign-bng">BNG</span>
        <span className="ffac-sign-sub">SELECCIÓN GLOBAL</span>
      </motion.div>

      {/* ── Claim editorial ── */}
      <motion.div className="site-wrap ffac-content" style={reduce ? undefined : { y: contentY, opacity: contentOpacity }}>
        <div className="ffac-copy">
          <h1 className="fh-h1 t-serif-display">
            Una estrategia balanceada y gestionada profesionalmente, con exposición global.
          </h1>
          <ul className="fh-ledger">
            <li>Acciones + Bonos + Activos alternativos</li>
            <li>Exposición global</li>
            <li>Domiciliado en Uruguay</li>
          </ul>
          <div className="fh-actions">
            <Link href="/contacto" className="ui-btn ui-btn-on-navy">Hablar con un asesor</Link>
            <a href="#estrategia" className="fh-link">Cómo invierte →</a>
          </div>
        </div>
      </motion.div>

      <style>{`
        .ffac-hero {
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
           preposición ("profesionalmente, con" / "exposición global") y deja
           una línea huérfana en el medio. */
        .ffac-hero .fh-h1 {
          margin: 0; color: #fff; text-wrap: balance;
          font-size: clamp(34px, 4.6vw, 60px); line-height: 1.04;
        }
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
        }
        @media (max-width: 640px) {
          .fh-ledger { flex-direction: column; gap: 9px; padding-top: 16px; }
          .fh-ledger li + li::before { content: none; }
        }
      `}</style>

      {/* Encuadre antes del primer pintado. Va acá abajo, después del markup y
          de los estilos del hero, para que al ejecutarse ya haya layout que
          medir. */}
      <script
        dangerouslySetInnerHTML={{
          __html: scriptEncuadre(FACHADA_HORIZONTE, FACHADA_VIEWBOX.w, FACHADA_VIEWBOX.h),
        }}
      />
    </header>
  );
}
