"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Barra de navegación interna del fondo — sticky bajo el navbar, con anclas a
// las secciones de la página y scrollspy (patrón de las fichas de producto de
// Vontobel/SSGA). El activo se resuelve con un listener de scroll (la última
// sección cuyo tope quedó por encima de la línea de lectura), no con
// IntersectionObserver: con secciones de alturas muy distintas el observer
// produce saltos de activo poco intuitivos.

const LINKS = [
  { id: "resumen", label: "Resumen" },
  { id: "estrategia", label: "Estrategia" },
  { id: "performance", label: "Performance" },
  { id: "calculadora", label: "Calculadora" },
  { id: "cartera", label: "Cartera" },
  { id: "documentos", label: "Documentos" },
  { id: "faq", label: "Preguntas" },
] as const;

export function FondoNav() {
  const [active, setActive] = useState<string>("");
  const raf = useRef<number>(0);

  useEffect(() => {
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
          position: sticky; top: var(--nav-h); z-index: 40;
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
