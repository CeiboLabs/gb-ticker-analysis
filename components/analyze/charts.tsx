"use client";

import { useEffect, useRef, useState } from "react";

/* ──────────────────────────────────────────────────────────────
   Chart primitives — SVG puro, sin dependencias.
   Reglas comunes: hairlines --rule-soft, labels --ink-3 mono 10,
   sin animaciones de entrada.
   ────────────────────────────────────────────────────────────── */

function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(Math.max(120, Math.round(e.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width: w };
}

interface SeriesPoint { y: number }
interface SeriesDef {
  points: SeriesPoint[];
  color: string;
  area?: boolean;
  dashed?: boolean;
  label?: string;
}

interface LineChartProps {
  series: SeriesDef[];
  height?: number;
  formatY?: (n: number) => string;
  showLastValue?: boolean;
  xLabels?: string[];
}

export function LineChart({
  series,
  height = 280,
  formatY = (n) => n.toFixed(0),
  showLastValue = true,
  xLabels,
}: LineChartProps) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const PAD = { top: 14, right: showLastValue ? 60 : 12, bottom: xLabels ? 24 : 8, left: 44 };
  const W = width;
  const H = height;
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  if (W < 80 || series.length === 0) {
    return <div ref={ref} style={{ width: "100%", height }} />;
  }

  const all = series.flatMap((s) => s.points.map((p) => p.y));
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo) * 0.08 || 1;
  const yMin = lo - pad;
  const yMax = hi + pad;
  const yScale = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * ch;
  const len = series[0].points.length;
  const xScale = (i: number) => PAD.left + (i / Math.max(1, len - 1)) * cw;

  const yTicks = 4;
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => yMin + (i / yTicks) * (yMax - yMin));

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img">
        {/* Horizontal gridlines */}
        {tickVals.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yScale(v)}
              y2={yScale(v)}
              stroke="var(--rule-soft)"
              strokeWidth={0.5}
            />
            <text
              x={PAD.left - 6}
              y={yScale(v) + 3}
              textAnchor="end"
              fontFamily="var(--font-mono)"
              fontSize={10}
              fill="var(--ink-3)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatY(v)}
            </text>
          </g>
        ))}

        {/* Series */}
        {series.map((s, sIdx) => {
          const path = s.points
            .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(p.y)}`)
            .join(" ");
          const areaPath = `${path} L ${xScale(s.points.length - 1)} ${PAD.top + ch} L ${xScale(0)} ${PAD.top + ch} Z`;
          return (
            <g key={sIdx}>
              {s.area && <path d={areaPath} fill={s.color} fillOpacity={0.08} />}
              <path
                d={path}
                fill="none"
                stroke={s.color}
                strokeWidth={1.5}
                strokeDasharray={s.dashed ? "4 3" : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {showLastValue && (
                <g>
                  <circle
                    cx={xScale(s.points.length - 1)}
                    cy={yScale(s.points[s.points.length - 1].y)}
                    r={3}
                    fill={s.color}
                  />
                  <text
                    x={xScale(s.points.length - 1) + 6}
                    y={yScale(s.points[s.points.length - 1].y) + 4}
                    fontFamily="var(--font-mono)"
                    fontSize={11}
                    fill={s.color}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatY(s.points[s.points.length - 1].y)}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* X labels */}
        {xLabels &&
          xLabels.map((l, i) => (
            <text
              key={i}
              x={xScale(i)}
              y={H - 6}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize={10}
              fill="var(--ink-3)"
            >
              {l}
            </text>
          ))}
      </svg>
    </div>
  );
}

/* ────── BarChart grouped ────── */

interface BarGroup {
  label: string;
  bars: { value: number; color: string }[];
}

interface BarChartProps {
  groups: BarGroup[];
  height?: number;
  formatY?: (n: number) => string;
}

export function BarChart({
  groups,
  height = 220,
  formatY = (n) => n.toFixed(1),
}: BarChartProps) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const PAD = { top: 12, right: 12, bottom: 28, left: 44 };
  const W = width;
  const H = height;
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  if (W < 80 || groups.length === 0) {
    return <div ref={ref} style={{ width: "100%", height }} />;
  }

  const all = groups.flatMap((g) => g.bars.map((b) => b.value));
  const hi = Math.max(...all);
  const yMax = hi * 1.1;
  const yScale = (v: number) => PAD.top + (1 - v / yMax) * ch;
  const groupW = cw / groups.length;
  const numBars = groups[0].bars.length;
  const barGap = 3;
  const barW = (groupW - barGap * (numBars + 1)) / numBars;

  const yTicks = 4;
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => (i / yTicks) * yMax);

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img">
        {/* Gridlines */}
        {tickVals.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yScale(v)}
              y2={yScale(v)}
              stroke="var(--rule-soft)"
              strokeWidth={0.5}
            />
            <text
              x={PAD.left - 6}
              y={yScale(v) + 3}
              textAnchor="end"
              fontFamily="var(--font-mono)"
              fontSize={10}
              fill="var(--ink-3)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatY(v)}
            </text>
          </g>
        ))}

        {/* Bars */}
        {groups.map((g, gi) => {
          const gx = PAD.left + gi * groupW;
          return (
            <g key={gi}>
              {g.bars.map((b, bi) => {
                const x = gx + barGap + bi * (barW + barGap);
                const y = yScale(b.value);
                return (
                  <rect
                    key={bi}
                    x={x}
                    y={y}
                    width={barW}
                    height={Math.max(1, PAD.top + ch - y)}
                    fill={b.color}
                  />
                );
              })}
              <text
                x={gx + groupW / 2}
                y={H - 8}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize={10}
                fill="var(--ink-3)"
              >
                {g.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ────── Spark ────── */

interface SparkProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Spark({
  data,
  width = 56,
  height = 20,
  color = "var(--navy-300)",
}: SparkProps) {
  if (!data || data.length < 2) return <svg width={width} height={height} />;
  const lo = Math.min(...data);
  const hi = Math.max(...data);
  const pad = (hi - lo) * 0.1 || 1;
  const yMin = lo - pad;
  const yMax = hi + pad;
  const path = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * (width - 2) + 1;
      const y = (1 - (v - yMin) / (yMax - yMin)) * (height - 2) + 1;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={path} fill="none" stroke={color} strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ────── Sankey · 4 stages, 7 nodes ────── */

export interface SankeyData {
  revenue: number;
  costOfRevenue: number;
  grossProfit: number;
  opex: number;
  operatingIncome: number;
  otherAndTax: number;
  netIncome: number;
}

interface SankeyProps {
  data: SankeyData;
  height?: number;
}

export function Sankey({ data, height = 400 }: SankeyProps) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const W = width;
  const H = height;

  if (W < 200) return <div ref={ref} style={{ width: "100%", height }} />;

  const PAD = { top: 28, right: 100, bottom: 16, left: 110 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  // Vertical scale: every node height proportional to value / revenue
  const total = data.revenue;
  const NODE_W = 12;
  const VGAP = 8;

  // 4 stage X positions
  const xs = [PAD.left, PAD.left + cw / 3, PAD.left + (2 * cw) / 3, PAD.left + cw];

  // Stage 1: revenue (single node at y center)
  const yCenter = PAD.top + ch / 2;
  const revH = ch * 0.92;
  const revY = yCenter - revH / 2;

  // Stage 2: costOfRevenue (top) + grossProfit (bottom)
  const s2TotalH = revH;
  const corH = (data.costOfRevenue / total) * s2TotalH;
  const gpH = (data.grossProfit / total) * s2TotalH;
  const corY = revY;
  const gpY = corY + corH + VGAP;

  // Stage 3: opex (top) + operatingIncome (bottom) — derived from grossProfit only
  const opexH = (data.opex / total) * s2TotalH;
  const oiH = (data.operatingIncome / total) * s2TotalH;
  const opexY = gpY;
  const oiY = opexY + opexH + VGAP;

  // Stage 4: tax+other + netIncome — derived from operatingIncome
  const taxH = (data.otherAndTax / total) * s2TotalH;
  const niH = (data.netIncome / total) * s2TotalH;
  const taxY = oiY;
  const niY = taxY + taxH + VGAP;

  // Nodes
  const nodes = [
    { id: "rev", x: xs[0], y: revY, h: revH, label: "Revenue", value: data.revenue, color: "var(--navy)" },
    { id: "cor", x: xs[1], y: corY, h: corH, label: "Cost of revenue", value: data.costOfRevenue, color: "var(--neg)", out: true },
    { id: "gp", x: xs[1], y: gpY, h: gpH, label: "Gross profit", value: data.grossProfit, color: "var(--navy)" },
    { id: "opex", x: xs[2], y: opexY, h: opexH, label: "Operating expense", value: data.opex, color: "var(--neg)", out: true },
    { id: "oi", x: xs[2], y: oiY, h: oiH, label: "Operating income", value: data.operatingIncome, color: "var(--navy)" },
    { id: "tax", x: xs[3], y: taxY, h: taxH, label: "Tax + other", value: data.otherAndTax, color: "var(--neg)", out: true },
    { id: "ni", x: xs[3], y: niY, h: niH, label: "Net income", value: data.netIncome, color: "var(--navy)" },
  ] as const;

  // Bezier link helper
  function link(sourceX: number, sourceY1: number, sourceY2: number, targetX: number, targetY1: number, targetY2: number, color: string) {
    const sx = sourceX + NODE_W;
    const tx = targetX;
    const cx = (sx + tx) / 2;
    return (
      <path
        d={`M ${sx} ${sourceY1}
            C ${cx} ${sourceY1}, ${cx} ${targetY1}, ${tx} ${targetY1}
            L ${tx} ${targetY2}
            C ${cx} ${targetY2}, ${cx} ${sourceY2}, ${sx} ${sourceY2}
            Z`}
        fill={color}
        opacity={0.35}
      />
    );
  }

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img">
        {/* Links */}
        {/* rev → cor (top portion of rev) */}
        {link(nodes[0].x, nodes[0].y, nodes[0].y + corH, nodes[1].x, nodes[1].y, nodes[1].y + corH, "var(--neg)")}
        {/* rev → gp (bottom portion of rev) */}
        {link(nodes[0].x, nodes[0].y + corH, nodes[0].y + revH, nodes[2].x, nodes[2].y, nodes[2].y + gpH, "var(--navy)")}
        {/* gp → opex */}
        {link(nodes[2].x, nodes[2].y, nodes[2].y + opexH, nodes[3].x, nodes[3].y, nodes[3].y + opexH, "var(--neg)")}
        {/* gp → oi */}
        {link(nodes[2].x, nodes[2].y + opexH, nodes[2].y + gpH, nodes[4].x, nodes[4].y, nodes[4].y + oiH, "var(--navy)")}
        {/* oi → tax */}
        {link(nodes[4].x, nodes[4].y, nodes[4].y + taxH, nodes[5].x, nodes[5].y, nodes[5].y + taxH, "var(--neg)")}
        {/* oi → ni */}
        {link(nodes[4].x, nodes[4].y + taxH, nodes[4].y + oiH, nodes[6].x, nodes[6].y, nodes[6].y + niH, "var(--navy)")}

        {/* Nodes */}
        {nodes.map((n) => (
          <g key={n.id}>
            <rect x={n.x} y={n.y} width={NODE_W} height={Math.max(1, n.h)} fill={n.color} />
            <text
              x={"out" in n && n.out ? n.x + NODE_W + 6 : n.x === xs[0] ? n.x - 6 : n.x + NODE_W + 6}
              y={n.y - 6}
              textAnchor={n.x === xs[0] ? "end" : "start"}
              fontFamily="var(--font-sans)"
              fontSize={11}
              fontWeight={500}
              fill="var(--ink)"
            >
              {n.label}
            </text>
            <text
              x={n.x === xs[0] ? n.x - 6 : n.x + NODE_W + 6}
              y={n.y + 8}
              textAnchor={n.x === xs[0] ? "end" : "start"}
              fontFamily="var(--font-mono)"
              fontSize={11}
              fill="var(--ink-2)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {n.value.toFixed(1).replace(".", ",")} B
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ────── Donut ────── */

interface DonutProps {
  data: { value: number; color: string; label: string }[];
  size?: number;
  thickness?: number;
  centerLabel: string;
  centerSub?: string;
}

export function DonutChart({
  data,
  size = 130,
  thickness = 20,
  centerLabel,
  centerSub,
}: DonutProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <svg width={size} height={size} />;

  const r = size / 2 - thickness / 2 - 1;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;

  let accum = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {data.map((d, i) => {
          const frac = d.value / total;
          const len = frac * C;
          const offset = -accum * C;
          accum += frac;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={offset}
            />
          );
        })}
      </g>
      <text
        x={cx}
        y={cy - 2}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={22}
        fontWeight={500}
        fill="var(--ink)"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {centerLabel}
      </text>
      {centerSub && (
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fontFamily="var(--font-sans)"
          fontSize={9}
          letterSpacing={1.5}
          fill="var(--ink-3)"
        >
          {centerSub}
        </text>
      )}
    </svg>
  );
}
