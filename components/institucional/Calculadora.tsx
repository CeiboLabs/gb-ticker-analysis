"use client";

import { useState, useMemo, useRef, useEffect } from "react";

function formatUSD(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
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

    const duration = 400;
    const start = performance.now();

    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(from + diff * ease));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [value]);

  return <>{format(display)}</>;
}

interface YearData {
  year: number;
  invested: number;
  total: number;
  gains: number;
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
  icon: React.ReactNode;
  color: string;
  thumbColor: string;
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
  icon,
  color,
  thumbColor,
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} text-white flex items-center justify-center`}
          >
            {icon}
          </div>
          <label className="text-xs font-semibold text-[#03065E]/70">
            {label}
          </label>
        </div>
        <span className="text-sm font-bold text-[#03065E] font-mono bg-[#03065E]/[0.04] px-3 py-1 rounded-lg">
          {displayValue}
        </span>
      </div>

      {/* Custom range */}
      <div className="relative h-10 flex items-center">
        {/* Track bg */}
        <div className="absolute left-0 right-0 h-[6px] rounded-full bg-[#03065E]/[0.06]" />
        {/* Track fill */}
        <div
          className={`absolute left-0 h-[6px] rounded-full bg-gradient-to-r ${color}`}
          style={{ width: `${pct}%`, transition: "width 80ms" }}
        />
        {/* Thumb */}
        <div
          className="absolute w-[22px] h-[22px] rounded-full bg-white z-10 pointer-events-none"
          style={{
            left: `calc(${pct}% - 11px)`,
            transition: "left 80ms",
            boxShadow: `0 0 0 3px ${thumbColor}, 0 1px 6px rgba(0,0,0,0.12)`,
          }}
        />
        {/* Invisible native input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-grab active:cursor-grabbing z-20"
        />
      </div>

      <div className="flex justify-between text-[10px] text-[#03065E]/25 mt-0.5">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

export function Calculadora() {
  const [initial, setInitial] = useState(200000);
  const [monthly, setMonthly] = useState(500);
  const [rate, setRate] = useState(8);
  const [years, setYears] = useState(25);

  const data = useMemo(() => {
    const result: YearData[] = [];
    const monthlyRate = rate / 100 / 12;

    for (let y = 0; y <= years; y++) {
      const months = y * 12;
      let total = initial * Math.pow(1 + monthlyRate, months);
      if (monthlyRate > 0) {
        total +=
          monthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
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
  const gainsPct =
    final.total > 0 ? Math.round((final.gains / final.total) * 100) : 0;

  // Filter bars for display
  const bars = data.filter((_, i) => {
    if (years <= 20) return true;
    return i % Math.ceil(years / 20) === 0 || i === years;
  });

  return (
    <div className="max-w-5xl mx-auto">
      {/* Results hero cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <div className="glass-light rounded-2xl p-5 text-center gradient-border">
          <p className="text-[10px] text-[#03065E]/35 uppercase tracking-wider mb-2 font-semibold">
            Valor Final
          </p>
          <p className="text-lg sm:text-2xl font-bold gradient-text font-mono inline-block">
            <AnimatedValue value={final.total} format={formatUSD} />
          </p>
        </div>
        <div className="glass-light rounded-2xl p-5 text-center gradient-border">
          <p className="text-[10px] text-[#03065E]/35 uppercase tracking-wider mb-2 font-semibold">
            Ganancias
          </p>
          <p className="text-lg sm:text-2xl font-bold text-emerald-600 font-mono">
            <AnimatedValue value={final.gains} format={formatUSD} />
          </p>
        </div>
        <div className="glass-light rounded-2xl p-5 text-center gradient-border">
          <p className="text-[10px] text-[#03065E]/35 uppercase tracking-wider mb-2 font-semibold">
            Total Invertido
          </p>
          <p className="text-lg sm:text-2xl font-bold text-[#03065E]/70 font-mono">
            <AnimatedValue value={final.invested} format={formatUSD} />
          </p>
        </div>
        <div className="glass-light rounded-2xl p-5 text-center gradient-border">
          <p className="text-[10px] text-[#03065E]/35 uppercase tracking-wider mb-2 font-semibold">
            Rendimiento
          </p>
          <p className="text-lg sm:text-2xl font-bold text-[#C9A84C] font-mono">
            {gainsPct}%
          </p>
          <p className="text-[10px] text-[#03065E]/25 mt-0.5">
            sobre invertido
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Controls - 2 cols */}
        <div className="lg:col-span-2 glass-light rounded-2xl p-6 sm:p-7 gradient-border">
          <h3 className="text-base font-semibold text-[#03065E] mb-7">
            Parámetros
          </h3>

          <div className="space-y-7">
            <Slider
              label="Inversión Inicial"
              value={initial}
              displayValue={formatUSD(initial)}
              min={1000}
              max={500000}
              step={1000}
              minLabel="$1K"
              maxLabel="$500K"
              onChange={setInitial}
              color="from-blue-500 to-blue-600"
              thumbColor="#3b82f6"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              }
            />

            <Slider
              label="Aporte Mensual"
              value={monthly}
              displayValue={formatUSD(monthly)}
              min={0}
              max={10000}
              step={100}
              minLabel="$0"
              maxLabel="$10K"
              onChange={setMonthly}
              color="from-emerald-500 to-emerald-600"
              thumbColor="#10b981"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              }
            />

            <Slider
              label="Retorno Anual"
              value={rate}
              displayValue={`${rate}%`}
              min={1}
              max={20}
              step={0.5}
              minLabel="1%"
              maxLabel="20%"
              onChange={setRate}
              color="from-amber-500 to-amber-600"
              thumbColor="#f59e0b"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              }
            />

            <Slider
              label="Horizonte"
              value={years}
              displayValue={`${years} años`}
              min={1}
              max={40}
              step={1}
              minLabel="1 año"
              maxLabel="40 años"
              onChange={setYears}
              color="from-violet-500 to-violet-600"
              thumbColor="#8b5cf6"
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              }
            />
          </div>

          {/* Composition donut */}
          <div className="mt-8 pt-6 border-t border-[#03065E]/[0.06]">
            <p className="text-xs font-semibold text-[#03065E]/50 mb-4">
              Composición del Valor Final
            </p>
            <div className="flex items-center gap-5">
              <div className="relative w-20 h-20 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="#03065E"
                    strokeWidth="4"
                    strokeOpacity="0.08"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="#03065E"
                    strokeWidth="4"
                    strokeOpacity="0.5"
                    strokeDasharray={`${((final.invested / (final.total || 1)) * 97.4).toFixed(1)} 97.4`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="url(#gold-grad)"
                    strokeWidth="4"
                    strokeDasharray={`${((final.gains / (final.total || 1)) * 97.4).toFixed(1)} 97.4`}
                    strokeDashoffset={`-${((final.invested / (final.total || 1)) * 97.4).toFixed(1)}`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                  <defs>
                    <linearGradient id="gold-grad">
                      <stop offset="0%" stopColor="#C9A84C" />
                      <stop offset="100%" stopColor="#e8d48a" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-[#03065E]/60 font-mono">
                    {gainsPct}%
                  </span>
                </div>
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#03065E]/50" />
                    <span className="text-xs text-[#03065E]/50">
                      Invertido
                    </span>
                  </div>
                  <span className="text-xs font-bold text-[#03065E]/60 font-mono">
                    <AnimatedValue value={final.invested} format={formatUSD} />
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-[#C9A84C] to-[#e8d48a]" />
                    <span className="text-xs text-[#03065E]/50">
                      Ganancias
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 font-mono">
                    <AnimatedValue value={final.gains} format={formatUSD} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chart - 3 cols */}
        <div className="lg:col-span-3 glass-light rounded-2xl p-6 sm:p-7 gradient-border flex flex-col">
          <h3 className="text-base font-semibold text-[#03065E] mb-2">
            Proyección de Crecimiento
          </h3>
          <p className="text-xs text-[#03065E]/35 mb-6">
            Hover sobre las barras para ver el detalle de cada año
          </p>

          {/* SVG area chart */}
          <div className="flex-1 min-h-[300px] relative">
            <svg
              viewBox="0 0 500 200"
              preserveAspectRatio="none"
              className="w-full h-full"
            >
              <defs>
                <linearGradient
                  id="area-invested"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#03065E" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#03065E" stopOpacity="0.03" />
                </linearGradient>
                <linearGradient
                  id="area-gains"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#C9A84C" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#C9A84C" stopOpacity="0.05" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              {[0.25, 0.5, 0.75].map((pct) => (
                <line
                  key={pct}
                  x1="0"
                  y1={200 - pct * 190}
                  x2="500"
                  y2={200 - pct * 190}
                  stroke="#03065E"
                  strokeOpacity="0.05"
                  strokeDasharray="4 4"
                />
              ))}

              {/* Invested area */}
              <path
                d={`M0 200 ${data
                  .map((d, i) => {
                    const x = (i / years) * 500;
                    const y = 200 - (maxTotal > 0 ? (d.invested / maxTotal) * 190 : 0);
                    return `L${x} ${y}`;
                  })
                  .join(" ")} L500 200 Z`}
                fill="url(#area-invested)"
                className="transition-all duration-500"
              />
              {/* Total area */}
              <path
                d={`M0 200 ${data
                  .map((d, i) => {
                    const x = (i / years) * 500;
                    const y = 200 - (maxTotal > 0 ? (d.total / maxTotal) * 190 : 0);
                    return `L${x} ${y}`;
                  })
                  .join(" ")} L500 200 Z`}
                fill="url(#area-gains)"
                className="transition-all duration-500"
              />

              {/* Invested line */}
              <path
                d={`M${data
                  .map((d, i) => {
                    const x = (i / years) * 500;
                    const y = 200 - (maxTotal > 0 ? (d.invested / maxTotal) * 190 : 0);
                    return `${x} ${y}`;
                  })
                  .join(" L")}`}
                fill="none"
                stroke="#03065E"
                strokeWidth="2"
                strokeOpacity="0.4"
                className="transition-all duration-500"
              />
              {/* Total line */}
              <path
                d={`M${data
                  .map((d, i) => {
                    const x = (i / years) * 500;
                    const y = 200 - (maxTotal > 0 ? (d.total / maxTotal) * 190 : 0);
                    return `${x} ${y}`;
                  })
                  .join(" L")}`}
                fill="none"
                stroke="#C9A84C"
                strokeWidth="2.5"
                className="transition-all duration-500"
              />

              {/* End dots */}
              <circle
                cx="500"
                cy={200 - (maxTotal > 0 ? (final.total / maxTotal) * 190 : 0)}
                r="4"
                fill="#C9A84C"
                className="transition-all duration-500"
              />
              <circle
                cx="500"
                cy={200 - (maxTotal > 0 ? (final.invested / maxTotal) * 190 : 0)}
                r="3"
                fill="#03065E"
                fillOpacity="0.5"
                className="transition-all duration-500"
              />
            </svg>

            {/* Y-axis labels */}
            <div className="absolute top-0 left-0 h-full flex flex-col justify-between py-1 pointer-events-none">
              <span className="text-[9px] text-[#03065E]/25 font-mono">
                {formatUSD(maxTotal)}
              </span>
              <span className="text-[9px] text-[#03065E]/25 font-mono">
                {formatUSD(Math.round(maxTotal / 2))}
              </span>
              <span className="text-[9px] text-[#03065E]/25 font-mono">
                $0
              </span>
            </div>
          </div>

          {/* X-axis */}
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-[#03065E]/25 font-mono">
              Año 0
            </span>
            <span className="text-[10px] text-[#03065E]/25 font-mono">
              Año {Math.round(years / 2)}
            </span>
            <span className="text-[10px] text-[#03065E]/25 font-mono">
              Año {years}
            </span>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 mt-5 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5 rounded-full bg-[#03065E]/40" />
              <span className="text-xs text-[#03065E]/40">Total invertido</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5 rounded-full bg-[#C9A84C]" />
              <span className="text-xs text-[#03065E]/40">
                Valor total
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-[#03065E]/20 text-center mt-8 max-w-xl mx-auto">
        Esta calculadora es informativa y no constituye asesoramiento
        financiero. Los retornos pasados no garantizan resultados futuros. Los
        cálculos asumen interés compuesto mensual con tasa constante.
      </p>
    </div>
  );
}
