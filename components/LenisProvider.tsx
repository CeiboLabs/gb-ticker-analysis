"use client";

import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

/**
 * Smooth scroll global (Lenis) para el sitio institucional.
 * - Scrollea window/documentElement: no rompe position:sticky.
 * - Con prefers-reduced-motion no se instancia: scroll nativo.
 * - lenis.css setea html.lenis { scroll-behavior: auto } y evita
 *   pelear con data-scroll-behavior="smooth" del root layout.
 *
 * ⚠️ La preferencia se lee con matchMedia y NO con el `useReducedMotion` de
 * framer-motion, que es lo que había acá. Un proveedor de scroll no tiene por
 * qué arrastrar una librería de animación de 122 KB a la cáscara de todo el
 * sitio sólo para preguntar por un media query de una línea — y en el sitio del
 * fondo ese import era una de las razones por las que framer entra en el bundle.
 * Ver docs/rendimiento-fondo.md §6.3.
 */
export function LenisProvider({ children }: { children: ReactNode }) {
  // Un solo efecto, y la preferencia se consulta ADENTRO. Con la preferencia en
  // estado de React, el efecto que instancia Lenis corre igual en el commit del
  // montaje —los efectos de un commit se ejecutan todos antes del re-render que
  // dispara el setState—, así que Lenis alcanzaba a existir un instante aunque
  // el usuario pidiera nada de movimiento. Acá no hay ventana: el media query se
  // lee antes de construir nada.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lenis: Lenis | null = null;
    let raf = 0;

    const arrancar = () => {
      if (lenis) return;
      lenis = new Lenis({
        lerp: 0.1,
        smoothWheel: true,
        syncTouch: false, // touch nativo en mobile: más fiable y barato
        anchors: true, // links #hash siguen funcionando suaves
      });
      raf = requestAnimationFrame(function loop(time) {
        lenis?.raf(time);
        raf = requestAnimationFrame(loop);
      });
    };

    const parar = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      lenis?.destroy();
      lenis = null;
    };

    // Y sigue la preferencia en vivo: cambiarla en el sistema toma efecto sin
    // recargar, que es lo que hacía el hook que había antes.
    const aplicar = () => (mq.matches ? parar() : arrancar());
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => {
      mq.removeEventListener("change", aplicar);
      parar();
    };
  }, []);

  return <>{children}</>;
}
