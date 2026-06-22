"use client";

import { useState, useMemo, useRef, useEffect } from "react";

function formatUSD(n: number): string {
  // Separadores rioplatenses: 1.234.567
  return "USD " + Math.round(n).toLocaleString("de-DE", { maximumFractionDigits: 0 });
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
  const cap = (145 / Math.max(text.length, 1)).toFixed(1);
  return (
    <span style={{ whiteSpace: "nowrap", fontSize: `min(${fit}px, ${cap}cqw)` }}>
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
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <label className="ui-label" style={{ marginBottom: 0 }}>{label}</label>
          {labelExtra}
        </span>
        <span style={{ fontSize: 20, fontWeight: 400, letterSpacing: "-0.015em", color: "var(--site-ink)" }}>
          {displayValue}
        </span>
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
            inset: 0,
            width: "100%",
            opacity: 0,
            cursor: "grab",
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

// Núcleo del simulador (cifras + sliders + gráfico + hitos), sin header ni
// site-wrap: lo embebe la página /calculadora con su propio encabezado y la
// página del fondo dentro de su sección #calculadora, cada una con los
// defaults que le hacen sentido a su audiencia.
export function CalculadoraSim({
  defaults = {},
  rateLocked = false,
  fees,
  omitGenericLegal = false,
}: {
  defaults?: Partial<{ initial: number; monthly: number; rate: number; years: number }>;
  // Con rateLocked el retorno anual no es editable: se muestra como dato fijo
  // (la página del fondo lo fija en el promedio anualizado del fondo).
  rateLocked?: boolean;
  // Costos opcionales del fondo (los pasa la página del fondo desde el
  // Tarifario). Cuando se proveen, la proyección se muestra neta de costos:
  //   buyPct          comisión de compraventa por operación (p.ej. 0,0075 = 0,75 %)
  //   maintAnnualPct  costo de mantenimiento anual sobre valores en cartera
  //   iva             IVA aplicable a ambos (Uruguay = 0,22)
  // La calculadora genérica (/calculadora) no los pasa y simula sin costos.
  fees?: { buyPct: number; maintAnnualPct: number; iva: number };
  // Cuando la página ya carga el aviso legal genérico en otro lado (la del
  // fondo lo tiene al pie + en el lead de la sección), se omite acá el
  // "no constituye asesoramiento / rendimientos pasados" para no repetirlo, y
  // queda sólo la nota de método (tasa constante) y de costos. La calculadora
  // genérica (/calculadora) no tiene ese bloque, así que mantiene el texto completo.
  omitGenericLegal?: boolean;
}) {
  const [initial, setInitial] = useState(defaults.initial ?? 200000);
  const [aporte, setAporte] = useState(defaults.monthly ?? 500);
  const [freq, setFreq] = useState<"mensual" | "anual">("mensual");
  const [rate, setRate] = useState(defaults.rate ?? 8);
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
    // Costos (sólo si `fees`): la comisión de compraventa se descuenta de cada
    // monto antes de invertirlo (la inicial y cada aporte) y el costo de
    // mantenimiento se cobra semestralmente sobre el valor en cartera. `invested`
    // sigue siendo el dinero bruto que puso el cliente, así que `gains` ya
    // refleja el costo neto y las cifras se muestran netas sin línea aparte.
    const buyCost = fees ? fees.buyPct * (1 + fees.iva) : 0;
    const maintSemester = fees ? (fees.maintAnnualPct * (1 + fees.iva)) / 2 : 0;
    const net = (amount: number) => amount * (1 - buyCost);

    const result: YearData[] = [
      { year: 0, invested: initial, total: Math.round(net(initial)), gains: Math.round(net(initial) - initial) },
    ];
    const monthlyRate = rate / 100 / 12;
    let total = net(initial);

    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) {
        total = total * (1 + monthlyRate) + (freq === "mensual" ? net(aporte) : 0);
        // Mantenimiento: cobro semestral (cierres de junio y diciembre).
        if (m === 5 || m === 11) total -= total * maintSemester;
      }
      if (freq === "anual") total += net(aporte);
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

  return (
    <div>
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
              <div className="eyebrow-sm" style={{ marginBottom: 12 }}>{cap}</div>
              <div className="calc-figure-value" style={{ fontWeight: 400, fontSize: 40, letterSpacing: "-0.025em", color }}>
                <AnimatedValue value={value} format={format} fit={40} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Controles + Gráfico */}
      <div className="calc-grid" style={{ marginTop: 56 }}>
        {/* Parámetros */}
        <div className="calc-panel">
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
          {rateLocked ? (
            <div className="calc-slider">
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <label className="ui-label" style={{ marginBottom: 0 }}>Retorno anual</label>
                <span style={{ fontSize: 20, fontWeight: 400, letterSpacing: "-0.015em", color: "var(--site-ink)" }}>
                  {rate.toLocaleString("es-UY", { maximumFractionDigits: 2 })} %
                </span>
              </div>
            </div>
          ) : (
            <Slider
              label="Retorno anual esperado"
              value={rate}
              displayValue={`${rate} %`}
              min={1}
              max={20}
              step={0.5}
              minLabel="1 %"
              maxLabel="20 %"
              onChange={setRate}
            />
          )}
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

        {/* Gráfico */}
        <div className="calc-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
            <div className="eyebrow-sm">Proyección de crecimiento</div>
            <div style={{ display: "flex", gap: 18 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 16, height: 3, borderRadius: 2, background: "var(--navy-500)" }} />
                <span className="t-small" style={{ fontSize: 12 }}>Aportado</span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 16, height: 3, borderRadius: 2, background: "var(--gold)" }} />
                <span className="t-small" style={{ fontSize: 12 }}>Valor total</span>
              </span>
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <svg viewBox="0 0 500 220" preserveAspectRatio="none" style={{ width: "100%", height: 280, display: "block" }}>
              <defs>
                <linearGradient id="area-total" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A84C" stopOpacity="0.20" />
                  <stop offset="100%" stopColor="#C9A84C" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Líneas guía */}
              {[0.25, 0.5, 0.75].map((pct) => (
                <line
                  key={pct}
                  x1="0"
                  y1={220 - pct * 200}
                  x2="500"
                  y2={220 - pct * 200}
                  stroke="#E7E8F2"
                  strokeWidth="1"
                />
              ))}
              <line x1="0" y1="220" x2="500" y2="220" stroke="#D7D9E8" strokeWidth="1" />

              {/* Área valor total */}
              <path
                d={`M0 220 ${data
                  .map((d, i) => {
                    const x = (i / years) * 500;
                    const y = 220 - (maxTotal > 0 ? (d.total / maxTotal) * 200 : 0);
                    return `L${x} ${y}`;
                  })
                  .join(" ")} L500 220 Z`}
                fill="url(#area-total)"
              />

              {/* Línea aportado */}
              <path
                d={`M${data
                  .map((d, i) => {
                    const x = (i / years) * 500;
                    const y = 220 - (maxTotal > 0 ? (d.invested / maxTotal) * 200 : 0);
                    return `${x} ${y}`;
                  })
                  .join(" L")}`}
                fill="none"
                stroke="#2C3194"
                strokeWidth="1.5"
              />
              {/* Línea valor total */}
              <path
                d={`M${data
                  .map((d, i) => {
                    const x = (i / years) * 500;
                    const y = 220 - (maxTotal > 0 ? (d.total / maxTotal) * 200 : 0);
                    return `${x} ${y}`;
                  })
                  .join(" L")}`}
                fill="none"
                stroke="#C9A84C"
                strokeWidth="2"
              />

              <circle
                cx="500"
                cy={220 - (maxTotal > 0 ? (final.total / maxTotal) * 200 : 0)}
                r="3.5"
                fill="#C9A84C"
              />
              <circle
                cx="500"
                cy={220 - (maxTotal > 0 ? (final.invested / maxTotal) * 200 : 0)}
                r="3"
                fill="#2C3194"
              />
            </svg>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            <span className="t-small" style={{ fontSize: 12 }}>Año 0</span>
            <span className="t-small" style={{ fontSize: 12 }}>Año {Math.round(years / 2)}</span>
            <span className="t-small" style={{ fontSize: 12 }}>Año {years}</span>
          </div>
        </div>
      </div>

      {/* Tabla de hitos */}
      <div style={{ marginTop: 56, borderTop: "1px solid var(--site-border)" }}>
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
                    <td style={{ textAlign: "right" }}>{formatUSD(d.invested)}</td>
                    <td style={{ textAlign: "right", color: "var(--pos)" }}>{formatUSD(d.gains)}</td>
                    <td style={{ textAlign: "right", fontWeight: 500, color: "var(--site-ink)" }}>{formatUSD(d.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="t-small" style={{ marginTop: 32, maxWidth: "44em" }}>
        {!omitGenericLegal && "Esta simulación es informativa y no constituye asesoramiento financiero. Los retornos pasados no garantizan resultados futuros. "}
        Los cálculos asumen interés compuesto mensual con tasa anual constante.
        {fees && (
          <>
            {" "}Las cifras son netas de la comisión de compraventa ({(fees.buyPct * 100).toLocaleString("es-UY", { maximumFractionDigits: 2 })} % + IVA por operación) y del costo de mantenimiento ({(fees.maintAnnualPct * 100).toLocaleString("es-UY", { maximumFractionDigits: 2 })} % + IVA anual sobre valores en cartera, cobro semestral), según el Tarifario de Gastón Bengochea.
          </>
        )}
      </p>

      <style>{`
        .calc-figures {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
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
        .calc-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: clamp(32px, 6vw, 72px); align-items: start; }
        .calc-panel { min-width: 0; }
        .calc-slider { padding: 16px 0; border-bottom: 1px solid var(--site-border); }
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
        @media (max-width: 900px) {
          .calc-grid { grid-template-columns: 1fr; gap: 40px; }
          .calc-figures { grid-template-columns: repeat(2, 1fr); }
          .calc-figure:nth-child(3) { border-left: 0; padding-left: 0; }
          .calc-figure { padding-top: 24px; padding-bottom: 24px; }
        }
        @media (max-width: 540px) {
          .calc-figures { grid-template-columns: 1fr; }
          .calc-figure, .calc-figure:nth-child(3) { border-left: 0; padding-left: 0; }
        }
        /* En teléfonos angostos las 4 columnas de hitos no caben con el ancho
           base (min-width 460): la columna Valor total quedaba fuera de pantalla.
           Compactamos tipografía y padding y soltamos el min-width para que la
           tabla entre completa sin scroll horizontal. */
        @media (max-width: 520px) {
          .calc-table { min-width: 0; table-layout: fixed; }
          .calc-table th {
            font-size: 9.5px; letter-spacing: 0.02em; padding: 12px 8px 12px 0;
          }
          .calc-table th:first-child { width: 2.5em; }
          .calc-table td {
            font-size: 12.5px; padding: 14px 8px 14px 0;
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
            Configurá monto inicial, aporte periódico, tasa esperada y horizonte. Las cifras son indicativas y asumen rendimiento constante.
          </p>
        </div>
      </div>
      <div style={{ marginTop: 56 }}>
        <CalculadoraSim />
      </div>
    </div>
  );
}
