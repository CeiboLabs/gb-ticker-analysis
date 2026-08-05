"use client";

import { useState, useMemo, useRef, useEffect } from "react";

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
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = to;
    const diff = to - from;
    if (diff === 0) return;

    const duration = 360;
    const start = performance.now();

    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + diff * ease));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
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

  return (
    <div className="calc-slider">
      {/* Encabezado del parámetro: rótulo (+ el toggle de frecuencia, si lo
          hay) a la izquierda y el valor a la derecha. Envuelve: en el teléfono
          angosto "Aporte + Mensual/Anual + USD 500" no entra en un renglón y el
          valor se partía en dos ("USD" / "500"). Al envolver, el valor baja
          entero y sigue alineado a la derecha por el margin auto. */}
      <div className="calc-slider-head">
        <span className="calc-slider-lab">
          <label className="ui-label" style={{ marginBottom: 0 }}>{label}</label>
          {labelExtra}
        </span>
        <span className="calc-slider-val">{displayValue}</span>
      </div>

      <div style={{ position: "relative", height: 22, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 6, borderRadius: 999, background: "var(--site-border)" }} />
        <div
          style={{
            position: "absolute",
            left: 0,
            height: 6,
            borderRadius: 999,
            background: "var(--navy)",
            width: `${pct}%`,
            transition: "width 100ms",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `calc(${pct}% - 10px)`,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#FFFFFF",
            border: "2px solid var(--navy)",
            boxShadow: "0 2px 6px rgba(3,6,94,0.18)",
            zIndex: 2,
            transition: "left 100ms",
            pointerEvents: "none",
          }}
        />
        {/* El input real es invisible y se estira por FUERA de la pista: lo que
            se ve mide 22px de alto —el thumb dibujado— y con el dedo eso queda
            muy por debajo del mínimo táctil de 44. Los 11px de más por lado los
            absorbe el padding del propio .calc-slider (16px arriba y abajo), así
            que ningún slider invade al de al lado. */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: -11,
            bottom: -11,
            width: "100%",
            opacity: 0,
            cursor: "grab",
            // pinch-zoom explícito: restringir el gesto no puede costarle el zoom
            // a quien lo necesita para leer.
            touchAction: "pan-y pinch-zoom",
            zIndex: 3,
          }}
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
  fees,
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
  // Costo opcional del fondo (lo pasa la página del fondo). Cuando se provee, la
  // proyección se muestra neta de la comisión del Fondo:
  //   annualPct  tasa anual máxima (p.ej. 0,015 = 1,5 %), IVA incluido
  // Se descuenta porque la tasa del simulador es un rendimiento BRUTO supuesto
  // por el lector. NO es el único costo del Fondo (ver FondoCalculadora). La
  // calculadora genérica (/calculadora) no lo pasa y simula sin costos.
  fees?: { annualPct: number };
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
    // mes; el anual, al cierre de cada año.
    //
    // Costo (sólo si `fees`): la comisión de administración del fondo es el
    // único costo. Se prorratea mensualmente sobre el valor en cartera
    // (annualPct / 12) y se descuenta al cierre de cada mes. `invested` sigue
    // siendo el dinero bruto que puso el cliente, así que `gains` ya refleja el
    // costo neto y las cifras se muestran netas sin línea aparte. No hay carga
    // de entrada: el año 0 vale lo aportado.
    const monthlyFee = fees ? fees.annualPct / 12 : 0;

    const result: YearData[] = [
      { year: 0, invested: initial, total: initial, gains: 0 },
    ];
    const monthlyRate = rate / 100 / 12;
    let total = initial;

    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) {
        total = total * (1 + monthlyRate) + (freq === "mensual" ? aporte : 0);
        total -= total * monthlyFee;
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
  }, [initial, aporte, freq, rate, years, fees]);

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
          const color =
            kind === "gold" ? "var(--gold-deep)" : kind === "pos" ? "var(--pos)" : "var(--site-ink)";
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
        rendimiento de ningún producto. El rendimiento anual promedio lo elegís vos; los cálculos
        asumen interés compuesto mensual con tasa constante.
        {/* Acá NO se enumeran los costos (pedido del cliente, 3-ago): nombrar la
            comisión del Fondo y lo que queda fuera —comisiones de los ETFs y
            fondos subyacentes, demás gastos, tributos— hacía leer la simulación
            como si el producto tuviera costos escondidos. El cálculo sigue
            descontando la comisión (ver `fees` arriba), así que la cifra que se
            muestra es la conservadora; simplemente no se afirma nada sobre
            costos en esta nota. La comisión sí está declarada en su propia
            sección de la página. */}
      </p>

      <style>{`
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
        .calc-slider-head {
          display: flex; align-items: baseline; justify-content: space-between;
          flex-wrap: wrap; gap: 8px 12px; margin-bottom: 12px;
        }
        .calc-slider-lab { display: inline-flex; align-items: center; gap: 12px; min-width: 0; }
        .calc-slider-val {
          margin-left: auto; white-space: nowrap;
          font-size: 20px; font-weight: 400; letter-spacing: -0.015em; color: var(--site-ink);
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
