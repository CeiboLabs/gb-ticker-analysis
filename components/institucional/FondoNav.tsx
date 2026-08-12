"use client";

import { useEffect, useRef, useState } from "react";
import { css } from "@/lib/css";

// Barra de secciones del SITIO DEL FONDO — sticky al tope, con anclas a las
// secciones de la página y scrollspy (patrón de las fichas de producto de
// Vontobel/SSGA). El activo se resuelve con un listener de scroll (la última
// sección cuyo tope quedó por encima de la línea de lectura), no con
// IntersectionObserver: con secciones de alturas muy distintas el observer
// produce saltos de activo poco intuitivos.
//
// Desde que el fondo es un sitio propio (ver lib/sitios.ts) ésta es LA barra de
// navegación de la página, y no una sub-barra debajo del navbar de la casa. Dos
// consecuencias, las dos abajo:
//   · muestra el nombre del fondo — cuando el hero se fue, es la única marca en
//     pantalla (la barra institucional scrollea con la página);
//   · ya no hay que correr ningún navbar fijo para no quedar tapada. El bloque
//     que hacía eso —transform sobre .nav-root frame a frame, más apagarle el
//     backdrop-filter mientras se deslizaba— se fue completo: era la pieza más
//     frágil de este componente y existía sólo por convivir con el otro navbar.

// Subconjunto curado de las secciones de la página, en el MISMO orden vertical
// del DOM — requisito del scrollspy de abajo: la lista debe ser una subsecuencia
// creciente de las secciones para que el activo avance de forma monótona.
// No están todas a propósito: Diferencia y Perfil son conectores narrativos
// cortos y se omiten del menú.
// Flujo: promesa → cómo invierte → de qué se compone → cómo le fue → quién la
// gestiona (credibilidad) → proyección → documentos → objeciones.
// El orden tiene que espejar el del DOM: el scrollspy recorre esta lista.
//
// `desde` = sección donde la pestaña EMPIEZA a estar activa, cuando además de la
// suya cubre un conector que no tiene entrada propia. Sin esto el activo de un
// conector se queda en la pestaña previa, y eso rotula mal: «Qué lo distingue»
// va entre Performance y La casa, así que sin `desde` se lee bajo "Performance"
// —una sección de argumentación anunciada como rendimientos—. Argumenta hacia
// adelante ("y en quién lo hace"), así que pertenece a "Nosotros". El ancla del
// clic sigue siendo `id`.
// Perfil queda bajo "Calculadora" a propósito: es el cierre de esa lectura.
const LINKS = [
  { id: "resumen", label: "Resumen" },
  { id: "estrategia", label: "Estrategia" },
  { id: "cartera", label: "Cartera" },
  { id: "performance", label: "Performance" },
  { id: "casa", label: "Nosotros", desde: "diferencia" },
  { id: "calculadora", label: "Calculadora" },
  { id: "documentos", label: "Documentos" },
  { id: "faq", label: "Preguntas" },
] as const satisfies ReadonlyArray<{ id: string; label: string; desde?: string }>;

// Línea de lectura del scrollspy, en px desde el tope del viewport: apenas por
// debajo de esta barra (≈50 px de alto). Tiene que quedar POR DEBAJO del
// scroll-margin-top de las secciones (58 px, ver la página) para que al saltar a
// un ancla su pestaña quede activa.
const LINEA_LECTURA = 140;

export function FondoNav({ casa }: { casa: string }) {
  const [active, setActive] = useState<string>("");
  const raf = useRef<number>(0);
  const linksRef = useRef<HTMLDivElement>(null);

  // Al cambiar el activo, deslizamos la tira horizontal para centrarlo. Movemos
  // sólo el scrollLeft del contenedor (no scrollIntoView, que arrastraría el
  // scroll vertical de la página). En desktop el contenedor no desborda, así que
  // el destino es 0 y el efecto es inocuo.
  useEffect(() => {
    const container = linksRef.current;
    if (!container || !active) return;
    const el = container.querySelector<HTMLElement>('[data-active="1"]');
    if (!el) return;
    // Posición vía rects (no offsetLeft: su origen es el offsetParent, que no es
    // este contenedor). Llevamos el centro del enlace al centro de la tira.
    const elRect = el.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    const target =
      container.scrollLeft + (elRect.left - cRect.left) - (container.clientWidth - elRect.width) / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [active]);

  useEffect(() => {
    const onScroll = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        let current = "";
        for (const l of LINKS) {
          // Se mide `desde` (el arranque del tramo), pero se activa `id`.
          const el = document.getElementById("desde" in l ? l.desde : l.id);
          if (el && el.getBoundingClientRect().top <= LINEA_LECTURA) current = l.id;
        }
        setActive(current);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <nav className="fnav" aria-label="Secciones del fondo">
      <div className="site-wrap fnav-row">
        {/* Marca del sitio, no un título de sección: es lo que queda en pantalla
            una vez que el hero —donde vive el wordmark grande— se fue. Va al tope
            de la página, que en este sitio es su home. */}
        <a href="#top" className="fnav-marca">BNG Selección Global</a>

        <div className="fnav-links" ref={linksRef}>
          {LINKS.map((l) => (
            <a key={l.id} href={`#${l.id}`} className="fnav-link" data-active={active === l.id ? "1" : "0"}>
              {l.label}
            </a>
          ))}
        </div>
        {/* Contacto vive en el sitio institucional: <a> y no <Link>, porque en
            producción el destino está en otro origen (ver lib/sitios.ts). */}
        <a href={`${casa}/contacto`} className="ui-btn ui-btn-primary fnav-cta">Hablar con un asesor</a>
      </div>

      <style>{css`
        .fnav {
          position: sticky; top: 0; z-index: 60;
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--site-border);
        }
        .fnav-row { display: flex; align-items: center; gap: 20px; }
        /* La tira de secciones toma el espacio libre y empuja el CTA al margen
           derecho; la marca queda pegada al izquierdo. */
        .fnav-links {
          flex: 1 1 auto; min-width: 0;
          display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          /* Cada enlace es un punto de anclaje: el deslizamiento se asienta con
             un item centrado en vez de quedar a mitad de camino. «proximity»
             (no «mandatory») deja libres los extremos. */
          scroll-snap-type: x proximity;
          scroll-behavior: smooth;
        }
        .fnav-links::-webkit-scrollbar { display: none; }
        .fnav-marca {
          flex: none; margin-right: 8px;
          font-size: 14px; font-weight: 600; letter-spacing: -0.005em;
          color: var(--navy); text-decoration: none; white-space: nowrap;
        }
        /* Por debajo de ~1180 px la marca le saca lugar a las secciones, que son
           ocho: gana la navegación. La marca vuelve a estar en el pie. */
        @media (max-width: 1180px) { .fnav-marca { display: none; } }
        /* En teléfonos los enlaces no entran todos: scrollean en horizontal.
           Un degradé en el borde derecho señala que hay más (evita que el
           último enlace se vea "cortado" como si la barra estuviera rota). */
        @media (max-width: 620px) {
          .fnav-links {
            padding-right: 14px;
            -webkit-mask-image: linear-gradient(90deg, #000 86%, transparent 100%);
            mask-image: linear-gradient(90deg, #000 86%, transparent 100%);
          }
        }
        .fnav-link {
          position: relative; flex: none; scroll-snap-align: center;
          font-size: 13.5px; font-weight: 500; color: var(--site-ink-3);
          text-decoration: none; padding: 16px 12px;
          transition: color 160ms ease;
        }
        .fnav-link:hover { color: var(--site-ink); }
        .fnav-link::after {
          content: ""; position: absolute; left: 12px; right: 12px; bottom: -1px; height: 2px;
          background: var(--gold-deep); transform: scaleX(0); transform-origin: left center;
          transition: transform 220ms ease;
        }
        /* El activo NO cambia de peso a propósito: el negrita ensancha el enlace
           entre 2 y 6 px (medido) y corre a todos los que le siguen, así que la
           barra se reacomoda sola mientras uno scrollea. El estado lo cargan el
           color —gris #797D99 a navy, un salto grande— y el filete oro, que es
           absoluto y no ocupa lugar. Es la misma regla del navbar de la casa:
           un solo peso para toda la fila, la página actual se marca por color y
           por subrayado (Navbar.tsx, .nav-trigger). */
        .fnav-link[data-active="1"] { color: var(--navy); }
        .fnav-link[data-active="1"]::after { transform: scaleX(1); }
        .fnav-cta { flex: none; padding-top: 8px; padding-bottom: 8px; font-size: 13.5px; }
        @media (max-width: 860px) { .fnav-cta { display: none; } }
      `}</style>
    </nav>
  );
}
