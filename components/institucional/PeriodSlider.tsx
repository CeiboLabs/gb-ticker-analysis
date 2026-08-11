"use client";

// Selector de período tipo píldora con thumb navy deslizante sobre superficie
// tenue. Es EL MISMO control en el gráfico de valor cuota del fondo
// (/bng-seleccion-global) y en el precio histórico de /analisis, para que
// cambiar de período se sienta idéntico en todo el sitio. Presentacional y
// genérico sobre el tipo del id — la lógica de datos vive en cada gráfico.
// Estilos en globals.css (.pslider*), que dependen de --surface-muted /
// --site-border / --navy / --site-ink-3, presentes bajo .site y .analyze-root.

interface PeriodSliderProps<T extends string> {
  periods: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  disabled?: boolean;
  ariaLabel?: string;
  /**
   * Aprieta el padding horizontal en pantallas chicas. Para filas de MÁS de
   * cinco opciones —el selector del backtest lleva un chip por año más «Todo»—,
   * que con el padding normal se salen de un teléfono de 320. Es opt-in para no
   * angostar de rebote los selectores de cinco, donde no hace falta.
   */
  dense?: boolean;
}

export function PeriodSlider<T extends string>({
  periods,
  value,
  onChange,
  disabled = false,
  ariaLabel = "Período",
  dense = false,
}: PeriodSliderProps<T>) {
  const activeIndex = Math.max(
    0,
    periods.findIndex((p) => p.id === value),
  );
  return (
    <div
      className="pslider"
      role="tablist"
      aria-label={ariaLabel}
      data-dense={dense ? "1" : undefined}
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
  );
}
