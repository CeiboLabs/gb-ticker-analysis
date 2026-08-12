"use client";

import { useEffect, useRef } from "react";

// Selector de período tipo píldora con thumb navy deslizante sobre superficie
// tenue. Es EL MISMO control en el gráfico de valor cuota del fondo
// (/bng-seleccion-global) y en el precio histórico de /analisis, para que
// cambiar de período se sienta idéntico en todo el sitio. Presentacional y
// genérico sobre el tipo del id — la lógica de datos vive en cada gráfico.
// Estilos en globals.css (.pslider*), que dependen de --surface-muted /
// --site-border / --navy / --site-ink-3, presentes bajo .site y .analyze-root.
//
// La fila va SIEMPRE en una pista que puede desplazarse. No es un adorno: los
// chips tienen un ancho mínimo (el que hace falta para que sigan siendo
// píldoras y no botones cuadrados con el radio de 999px, ver globals.css) y el
// contenedor decide si sobra lugar —ahí se reparten el ancho— o si falta, y ahí
// la fila se corre. Antes esto se resolvía apretando el chip hasta que entrara,
// que es lo que dejaba los años del backtest como círculos en el teléfono.

interface PeriodSliderProps<T extends string> {
  periods: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export function PeriodSlider<T extends string>({
  periods,
  value,
  onChange,
  disabled = false,
  ariaLabel = "Período",
}: PeriodSliderProps<T>) {
  const activeIndex = Math.max(
    0,
    periods.findIndex((p) => p.id === value),
  );

  const pistaRef = useRef<HTMLDivElement>(null);

  // Marca en qué lado sigue habiendo chips para que el CSS difumine ESE borde.
  // Sin esto la píldora queda cortada a cuchillo contra el borde de la pantalla
  // —sus puntas redondeadas y los hairlines se rebanan— y lee como un error de
  // layout en vez de como una fila que sigue. Va por dataset y no por estado:
  // corre en cada cuadro del desplazamiento y no tiene por qué re-renderizar.
  useEffect(() => {
    const pista = pistaRef.current;
    if (!pista) return;
    const marcar = () => {
      const sobra = pista.scrollWidth - pista.clientWidth;
      pista.dataset.antes = sobra > 1 && pista.scrollLeft > 2 ? "1" : "0";
      pista.dataset.despues = sobra > 1 && pista.scrollLeft < sobra - 2 ? "1" : "0";
    };
    marcar();
    pista.addEventListener("scroll", marcar, { passive: true });
    // El ancho de la pista cambia al rotar el teléfono y al abrirse el panel:
    // un listener de resize de window no ve lo segundo (ver el observer del
    // gráfico). Observa la caja de borde porque el aire vertical va en padding.
    const ro = new ResizeObserver(marcar);
    ro.observe(pista, { box: "border-box" });
    return () => {
      pista.removeEventListener("scroll", marcar);
      ro.disconnect();
    };
  }, [periods.length]);

  // Con la pista corrida, el chip elegido puede quedar fuera de la ventana. Y
  // no es un caso raro: en el backtest el valor inicial es «Máx», que es el
  // ÚLTIMO chip — sin esto el control abre mostrando una selección invisible.
  const yaMontado = useRef(false);
  useEffect(() => {
    const pista = pistaRef.current;
    const primera = !yaMontado.current;
    yaMontado.current = true;
    if (!pista) return;
    const sobra = pista.scrollWidth - pista.clientWidth;
    if (sobra <= 1) return; // entra entera: no hay nada que centrar
    const chip = pista.querySelectorAll<HTMLElement>(".pslider-btn")[activeIndex];
    if (!chip) return;
    const destino = chip.offsetLeft - (pista.clientWidth - chip.offsetWidth) / 2;
    // En el primer pintado es un salto: animar la posición de arranque leería
    // como que algo se movió solo. El deslizamiento es para los cambios.
    const quieto =
      primera || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    pista.scrollTo({
      left: Math.max(0, Math.min(destino, sobra)),
      behavior: quieto ? "auto" : "smooth",
    });
  }, [activeIndex]);

  return (
    <div className="pslider-scroll" ref={pistaRef}>
      <div
        className="pslider"
        role="tablist"
        aria-label={ariaLabel}
        style={{ ["--pslider-count" as string]: periods.length }}
      >
        {/* Deshabilitado NO lleva thumb. Los botones se apagan con opacity, pero
            el thumb es un span aparte: quedaba una píldora navy a saturación
            plena, con su sombra, encima de un control muerto — la única cosa
            "encendida" del módulo era la que no se podía tocar. Y sin serie no hay
            período seleccionado que señalar. */}
        {!disabled && (
          <span
            className="pslider-thumb"
            aria-hidden
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          />
        )}
        {periods.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={value === p.id}
            disabled={disabled}
            onClick={() => onChange(p.id)}
            className="pslider-btn"
            data-active={value === p.id ? "1" : "0"}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
