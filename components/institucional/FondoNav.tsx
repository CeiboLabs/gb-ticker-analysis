"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Barra de navegación interna del fondo — sticky bajo el navbar, con anclas a
// las secciones de la página y scrollspy (patrón de las fichas de producto de
// Vontobel/SSGA). El activo se resuelve con un listener de scroll (la última
// sección cuyo tope quedó por encima de la línea de lectura), no con
// IntersectionObserver: con secciones de alturas muy distintas el observer
// produce saltos de activo poco intuitivos.

// Subconjunto curado de las secciones de la página, en el MISMO orden vertical
// del DOM — requisito del scrollspy de abajo: la lista debe ser una subsecuencia
// creciente de las secciones para que el activo avance de forma monótona.
// No están todas a propósito: Diferencia y Perfil son conectores narrativos
// cortos y se omiten del menú; al pasarlas, el activo se queda en la sección
// previa (Cartera / Calculadora), lo cual es aceptable.
// Flujo: promesa → cómo invierte → de qué se compone → quién la gestiona
// (credibilidad) → estado/proyección → documentos → objeciones.
const LINKS = [
  { id: "resumen", label: "Resumen" },
  { id: "estrategia", label: "Estrategia" },
  { id: "cartera", label: "Cartera" },
  { id: "casa", label: "La casa" },
  { id: "performance", label: "Performance" },
  { id: "calculadora", label: "Calculadora" },
  { id: "documentos", label: "Documentos" },
  { id: "faq", label: "Preguntas" },
] as const;

export function FondoNav() {
  const [active, setActive] = useState<string>("");
  const raf = useRef<number>(0);
  const navRef = useRef<HTMLElement>(null);
  const lastShift = useRef<number>(-1);

  useEffect(() => {
    // Nodo del navbar global (se desplaza para meterse detrás de esta barra).
    const navRoot = document.querySelector<HTMLElement>(".nav-root");

    const onScroll = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        // Línea de lectura: justo debajo del navbar + esta barra.
        const line = 72 + 120;
        let current = "";
        for (const { id } of LINKS) {
          const el = document.getElementById(id);
          if (el && el.getBoundingClientRect().top <= line) current = id;
        }
        setActive(current);

        // El navbar global se mete detrás de esta barra a medida que sube: lo
        // desplazamos hacia arriba en lockstep con el borde superior de la
        // sub-navbar, de modo que su borde inferior nunca quede por debajo de
        // ella (la sub-navbar es más baja, así que taparlo no alcanzaría).
        const nav = navRef.current;
        if (nav && navRoot) {
          const top = nav.getBoundingClientRect().top; // distancia de la sub-navbar al tope
          const shift = Math.round(Math.min(72, Math.max(0, 72 - top))); // 0 → navbar entera, 72 → fuera
          if (shift !== lastShift.current) {
            const wasShifting = lastShift.current > 0;
            const isShifting = shift > 0;
            lastShift.current = shift;
            // transform DIRECTO sobre el navbar (un solo nodo, costo de
            // compositor). Evitamos una CSS var en :root: cambiarla por frame
            // recalcula el estilo de TODO el documento → eso trababa la PC.
            navRoot.style.transform = shift ? `translateY(-${shift}px)` : "";
            // Mientras se desliza apagamos su backdrop-filter (clase en el mismo
            // nodo): animar el blur por frame es el otro costo que la fundía.
            if (isShifting !== wasShifting) {
              navRoot.classList.toggle("nav-tucking", isShifting);
            }
          }
        }
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (navRoot) {
        navRoot.style.transform = "";
        navRoot.classList.remove("nav-tucking");
      }
    };
  }, []);

  return (
    <nav ref={navRef} className="fnav" aria-label="Secciones del fondo">
      <div className="site-wrap fnav-row">
        <div className="fnav-links">
          {LINKS.map((l) => (
            <a key={l.id} href={`#${l.id}`} className="fnav-link" data-active={active === l.id ? "1" : "0"}>
              {l.label}
            </a>
          ))}
        </div>
        <Link href="/contacto" className="ui-btn ui-btn-primary fnav-cta">Hablar con un asesor</Link>
      </div>

      <style>{`
        .fnav {
          position: sticky; top: 0; z-index: 60;
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--site-border);
        }
        .fnav-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
        .fnav-links {
          display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .fnav-links::-webkit-scrollbar { display: none; }
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
          position: relative; flex: none;
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
        .fnav-link[data-active="1"] { color: var(--navy); font-weight: 600; }
        .fnav-link[data-active="1"]::after { transform: scaleX(1); }
        .fnav-cta { flex: none; padding-top: 8px; padding-bottom: 8px; font-size: 13.5px; }
        @media (max-width: 860px) { .fnav-cta { display: none; } }
      `}</style>
    </nav>
  );
}
