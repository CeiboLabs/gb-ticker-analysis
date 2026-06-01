"use client";

import { useState, useMemo, useRef, useEffect } from "react";

function formatUSD(n: number): string {
  // Separadores rioplatenses: 1.234.567
  return "USD " + Math.round(n).toLocaleString("de-DE", { maximumFractionDigits: 0 });
}

function AnimatedValue({
  value,
  format,
}: {
  value: number;
  format: (n: number) => string;
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

  return <>{format(display)}</>;
}

interface SliderProps {
  label: string;
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
        <label className="ui-label" style={{ marginBottom: 0 }}>{label}</label>
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

export function Calculadora() {
  const [initial, setInitial] = useState(200000);
  const [monthly, setMonthly] = useState(500);
  const [rate, setRate] = useState(8);
  const [years, setYears] = useState(25);

  const data = useMemo<YearData[]>(() => {
    const result: YearData[] = [];
    const monthlyRate = rate / 100 / 12;

    for (let y = 0; y <= years; y++) {
      const months = y * 12;
      let total = initial * Math.pow(1 + monthlyRate, months);
      if (monthlyRate > 0) {
        total += monthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
      } else {
        total += monthly * months;
      }
      const invested = initial + monthly * months;
      result.push({
        year: y,
        invested,
        total: Math.round(total),
        gains: Math.round(total - invested),
      });
    }
    return result;
  }, [initial, monthly, rate, years]);

  const final = data[data.length - 1];
  const maxTotal = final.total;
  const gainsPct = final.invested > 0 ? Math.round((final.gains / final.invested) * 100) : 0;

  const hitos = [5, 10, 15, 20, years].filter((y, i, arr) => y <= years && arr.indexOf(y) === i);

  return (
    <div className="site site-wrap">
      <div className="split-label">
        <div className="eyebrow-sm">Proyección</div>
        <div>
          <h2 className="t-h2" style={{ maxWidth: "14em" }}>El interés compuesto, paso a paso.</h2>
          <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
            Configurá monto inicial, aporte mensual, tasa esperada y horizonte. Las cifras son indicativas y asumen rendimiento constante.
          </p>
        </div>
      </div>

      {/* Cifras destacadas — hairline grid */}
      <div className="calc-figures" style={{ marginTop: 56 }}>
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
                <AnimatedValue value={value} format={format} />
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
            label="Aporte mensual"
            value={monthly}
            displayValue={formatUSD(monthly)}
            min={0}
            max={10000}
            step={100}
            minLabel="USD 0"
            maxLabel="USD 10 K"
            onChange={setMonthly}
          />
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
        Esta simulación es informativa y no constituye asesoramiento financiero. Los retornos pasados no garantizan resultados futuros. Los cálculos asumen interés compuesto mensual con tasa anual constante.
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
        }
        .calc-figure:first-child { border-left: 0; padding-left: 0; }
        .calc-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: clamp(32px, 6vw, 72px); align-items: start; }
        .calc-panel { min-width: 0; }
        .calc-slider { padding: 16px 0; border-bottom: 1px solid var(--site-border); }
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
          .calc-figure-value { font-size: 32px !important; }
        }
      `}</style>
    </div>
  );
}
