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
    <div style={{ padding: "var(--space-3) 0", borderBottom: "1px solid var(--rule)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <label className="cap" style={{ color: "var(--ink-2)" }}>{label}</label>
        <span className="mono" style={{ fontSize: 18, color: "var(--ink)", letterSpacing: 0 }}>
          {displayValue}
        </span>
      </div>

      <div style={{ position: "relative", height: 26, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 1, background: "var(--rule)" }} />
        <div
          style={{
            position: "absolute",
            left: 0,
            height: 1,
            background: "var(--ink)",
            width: `${pct}%`,
            transition: "width 100ms",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `calc(${pct}% - 6px)`,
            width: 12,
            height: 12,
            background: "var(--gold)",
            border: "1px solid var(--ink)",
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

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{minLabel}</span>
        <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{maxLabel}</span>
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

  return (
    <div className="wrap">
      {/* Sec head simulando informe */}
      <div className="sec-head">
        <div>
          <div className="sec-num">Sim · 01</div>
          <div className="cap-gold" style={{ marginTop: 8 }}>Proyección</div>
        </div>
        <div>
          <h2>El interés compuesto, anotado.</h2>
          <p className="dek">
            Configurá monto inicial, aporte mensual, tasa esperada y horizonte. Las cifras son indicativas y asumen rendimiento constante.
          </p>
        </div>
      </div>

      {/* Hero figures */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          borderTop: "1px solid var(--ink)",
          borderBottom: "1px solid var(--rule)",
        }}
        className="calc-figures"
      >
        {[
          ["Valor final", final.total, formatUSD, "gold"] as const,
          ["Ganancia compuesta", final.gains, formatUSD, "pos"] as const,
          ["Total aportado", final.invested, formatUSD, "ink"] as const,
          ["Rendimiento", gainsPct, (n: number) => `${n} %`, "gold"] as const,
        ].map(([cap, value, format, kind], i) => {
          const color =
            kind === "gold" ? "var(--gold-deep)" : kind === "pos" ? "var(--pos)" : "var(--ink)";
          return (
            <div
              key={cap}
              style={{
                padding: "var(--space-4) var(--space-4) var(--space-4) 0",
                paddingLeft: i === 0 ? 0 : "var(--space-4)",
                borderRight: i < 3 ? "1px solid var(--rule)" : "none",
              }}
            >
              <div className="cap" style={{ marginBottom: 8 }}>{cap}</div>
              <div className="mono calc-figure-value" style={{ fontSize: 28, color, letterSpacing: "-0.01em" }}>
                <AnimatedValue value={value} format={format} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls + Chart */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)",
          gap: "var(--space-6)",
          marginTop: "var(--space-6)",
        }}
        className="calc-grid"
      >
        {/* Parámetros */}
        <div>
          <div className="cap-gold" style={{ marginBottom: "var(--space-3)" }}>Parámetros</div>
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
        <div style={{ borderTop: "1px solid var(--ink)", paddingTop: "var(--space-4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-3)" }}>
            <div className="cap-gold">Proyección de crecimiento</div>
            <div style={{ display: "flex", gap: 16 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 18, height: 1, background: "var(--ink)" }} />
                <span className="cap" style={{ color: "var(--ink-3)" }}>Aportado</span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 18, height: 1, background: "var(--gold)" }} />
                <span className="cap" style={{ color: "var(--ink-3)" }}>Valor total</span>
              </span>
            </div>
          </div>

          <div style={{ position: "relative", minHeight: 320 }}>
            <svg viewBox="0 0 500 220" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
              <defs>
                <linearGradient id="area-total" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A84C" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#C9A84C" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Hairlines */}
              {[0.25, 0.5, 0.75].map((pct) => (
                <line
                  key={pct}
                  x1="0"
                  y1={220 - pct * 200}
                  x2="500"
                  y2={220 - pct * 200}
                  stroke="#D9DAE8"
                  strokeWidth="1"
                />
              ))}
              <line x1="0" y1="220" x2="500" y2="220" stroke="#0E1130" strokeWidth="1" />

              {/* Total area */}
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

              {/* Invested line */}
              <path
                d={`M${data
                  .map((d, i) => {
                    const x = (i / years) * 500;
                    const y = 220 - (maxTotal > 0 ? (d.invested / maxTotal) * 200 : 0);
                    return `${x} ${y}`;
                  })
                  .join(" L")}`}
                fill="none"
                stroke="#0E1130"
                strokeWidth="1"
              />
              {/* Total line */}
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
                strokeWidth="1.5"
              />

              <circle
                cx="500"
                cy={220 - (maxTotal > 0 ? (final.total / maxTotal) * 200 : 0)}
                r="3"
                fill="#C9A84C"
              />
              <circle
                cx="500"
                cy={220 - (maxTotal > 0 ? (final.invested / maxTotal) * 200 : 0)}
                r="2.5"
                fill="#0E1130"
              />
            </svg>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>Año 0</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>Año {Math.round(years / 2)}</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>Año {years}</span>
          </div>

          {/* Tabla de hitos */}
          <div style={{ marginTop: "var(--space-5)", overflowX: "auto" }}>
          <table className="fin-table" style={{ minWidth: 420 }}>
            <thead>
              <tr>
                <th>Año</th>
                <th>Aportado</th>
                <th>Ganancia</th>
                <th>Valor total</th>
              </tr>
            </thead>
            <tbody>
              {[5, 10, 15, 20, years].filter((y, i, arr) => y <= years && arr.indexOf(y) === i).map((y) => {
                const d = data[y];
                if (!d) return null;
                return (
                  <tr key={y}>
                    <td>{y}</td>
                    <td>{formatUSD(d.invested)}</td>
                    <td className="pos-fg">{formatUSD(d.gains)}</td>
                    <td>{formatUSD(d.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <p className="body-small" style={{ marginTop: "var(--space-6)", maxWidth: "44em", color: "var(--ink-3)" }}>
        Esta simulación es informativa y no constituye asesoramiento financiero. Los retornos pasados no garantizan resultados futuros. Los cálculos asumen interés compuesto mensual con tasa anual constante.
      </p>

      <style>{`
        @media (max-width: 900px) {
          .calc-grid { grid-template-columns: 1fr !important; }
          .calc-figures { grid-template-columns: repeat(2, 1fr) !important; }
          .calc-figures > div:nth-child(2) { border-right: 0 !important; }
          .calc-figures > div:nth-child(3) { padding-left: 0 !important; }
          .calc-figures > div { border-bottom: 1px solid var(--rule); }
          .calc-figure-value { font-size: 22px !important; }
        }
        @media (max-width: 600px) {
          .calc-figures { grid-template-columns: 1fr !important; }
          .calc-figures > div { border-right: 0 !important; padding-left: 0 !important; }
          .calc-figure-value { font-size: 20px !important; }
        }
      `}</style>
    </div>
  );
}
