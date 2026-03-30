"use client";

import { sankey as d3Sankey, sankeyCenter } from "d3-sankey";
import type { SegmentSankeyData } from "@/types/Report";

// ── Palette ──────────────────────────────────────────────────────────────────
const SEG_COLORS = [
  "#4E86C8", "#5AAF6E", "#E8952A", "#D95050",
  "#8E67C4", "#38A8A8", "#C47A40", "#6E9E3C",
];
const C_GP   = "#4AAE6A";
const C_COGS = "#E07575";
const C_OP   = "#3892C0";
const C_OPEX = "#E09A40";
const C_NP   = "#2ECC71";
const C_TAX  = "#C03030";
const C_INV  = "#8A6CC8";

const VW       = 1800;
const FLOW_OP  = 0.72;
const NODE_W   = 28;
const PAD      = 8;
const MAX_SEGS = 7;
const SEG_LEFT = 420;
const TOP_PAD  = 160; // vertical room above nodes for above-node labels


// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(v: number | string, unit: string) {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return `$${n % 1 === 0 ? n : n.toFixed(1)}${unit}`;
}

// S-curve ribbon between two node columns.
function ribbon(
  x1: number, yt1: number, yb1: number,
  x2: number, yt2: number, yb2: number,
) {
  const dx  = x2 - x1;
  const cp1 = x1 + dx / 3;
  const cp2 = x2 - dx / 3;
  return [
    `M ${x1} ${yt1}`,
    `C ${cp1} ${yt1}  ${cp2} ${yt2}  ${x2} ${yt2}`,
    `L ${x2} ${yb2}`,
    `C ${cp2} ${yb2}  ${cp1} ${yb1}  ${x1} ${yb1}`,
    "Z",
  ].join(" ");
}

// ── d3-sankey node / link types ───────────────────────────────────────────────
interface SNode {
  id: string;
  name: string;
  displayValue?: string;
  subLabel?: string;
  color: string;
  x0?: number; x1?: number; y0?: number; y1?: number; value?: number;
}

interface SLink {
  source: string | SNode;
  target: string | SNode;
  value: number;
  color: string;
  y0?: number; y1?: number; width?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function SankeyChart({ data }: { data: SegmentSankeyData }) {
  const {
    segments, totalRevenue, grossProfit,
    operatingProfit, operatingExpenses, netProfit,
    opexBreakdown, investments, tax, unit,
    grossMarginPct, operatingMarginPct, netMarginPct, totalRevenueYoy,
    nonOperatingIncome,
  } = data;

  const rev = Number(totalRevenue);
  if (!isFinite(rev) || rev <= 0) return null;

  const gp   = Math.min(Number(grossProfit)     || 0, rev);
  const cogs = Math.max(0, rev - gp);
  const rawOp = Math.max(0, Number(operatingProfit) || 0);
  const op    = gp > 0 ? Math.min(rawOp, gp) : rawOp;
  const opex  = Math.max(0, gp - op);
  const nonOp = Math.max(0, Number(nonOperatingIncome) || 0);
  const np    = Math.max(0, Math.min(Number(netProfit) || 0, op));
  const inv   = Number(investments) || 0;
  const tx    = Number(tax) || 0;

  // ── Build nodes ────────────────────────────────────────────────────────────
  const nodes: SNode[] = [];
  const links: SLink[] = [];

  function addNode(n: SNode) { nodes.push(n); }
  function addLink(l: SLink) { if (l.value > 0.001) links.push(l); }

  const displaySegs = segments.length > MAX_SEGS
    ? [
        ...segments.slice(0, MAX_SEGS - 1),
        {
          name: "Others",
          value: parseFloat(
            segments.slice(MAX_SEGS - 1).reduce((s, seg) => s + Number(seg.value), 0).toFixed(2)
          ),
        } as typeof segments[number],
      ]
    : segments;

  // Track which IDs are segment nodes so we can give them LEFT labels
  const segNodeIds = new Set<string>();

  if (displaySegs.length > 0) {
    displaySegs.forEach((seg, i) => {
      const v = Number(seg.value) || 0;
      if (v <= 0) return;
      const id = `seg-${i}`;
      segNodeIds.add(id);
      addNode({
        id,
        name: seg.name,
        displayValue: fmt(v, unit),
        subLabel: seg.yoy || undefined,
        color: SEG_COLORS[i % SEG_COLORS.length],
      });
      addLink({ source: id, target: "revenue", value: v, color: SEG_COLORS[i % SEG_COLORS.length] });
    });
  }

  addNode({
    id: "revenue",
    name: "Revenue",
    displayValue: fmt(rev, unit),
    subLabel: totalRevenueYoy ?? undefined,
    color: "#03065E",
  });

  if (gp > 0) {
    addNode({
      id: "gp",
      name: "Gross Profit",
      displayValue: fmt(gp, unit),
      subLabel: grossMarginPct ? `${grossMarginPct}% margin` : undefined,
      color: C_GP,
    });
    addLink({ source: "revenue", target: "gp", value: gp, color: C_GP });
    if (cogs > 0) {
      addNode({ id: "cogs", name: "Cost of Rev.", displayValue: fmt(cogs, unit), color: C_COGS });
      addLink({ source: "revenue", target: "cogs", value: cogs, color: C_COGS });
    }
    if (op > 0) {
      addNode({
        id: "op",
        name: "Operating Income",
        displayValue: fmt(op, unit),
        subLabel: operatingMarginPct ? `${operatingMarginPct}% margin` : undefined,
        color: C_OP,
      });
      addLink({ source: "gp", target: "op", value: op, color: C_OP });
    }
    if (opex > 0) {
      addNode({
        id: "opex",
        name: "Op. Expenses",
        displayValue: fmt(operatingExpenses, unit),
        color: C_OPEX,
      });
      addLink({ source: "gp", target: "opex", value: opex, color: C_OPEX });
    }
  } else if (op > 0) {
    addNode({
      id: "op",
      name: "Operating Income",
      displayValue: fmt(op, unit),
      subLabel: operatingMarginPct ? `${operatingMarginPct}% margin` : undefined,
      color: C_OP,
    });
    addLink({ source: "revenue", target: "op", value: op, color: C_OP });
    const totalCosts = rev - op;
    if (totalCosts > 0) {
      addNode({ id: "cogs", name: "Total Costs", displayValue: fmt(totalCosts, unit), color: C_COGS });
      addLink({ source: "revenue", target: "cogs", value: totalCosts, color: C_COGS });
    }
  }

  const opOutRaw = np + tx + inv;
  const opK      = opOutRaw > op && opOutRaw > 0 ? op / opOutRaw : 1;

  const npSubLabel = [
    netMarginPct ? `${netMarginPct}% margin` : null,
    nonOp > 0 ? `+ ${fmt(nonOp, unit)} non-operating` : null,
  ].filter(Boolean).join("  ·  ") || undefined;

  if (np > 0) {
    addNode({ id: "np", name: "Net Income", displayValue: fmt(np, unit), subLabel: npSubLabel, color: C_NP });
    addLink({ source: "op", target: "np",  value: np  * opK, color: C_NP  });
  }
  if (tx > 0) {
    addNode({ id: "tax", name: "Taxes", displayValue: fmt(tx, unit), color: C_TAX });
    addLink({ source: "op", target: "tax", value: tx  * opK, color: C_TAX });
  }
  if (inv > 0) {
    addNode({ id: "inv", name: "Investments", displayValue: fmt(inv, unit), color: C_INV });
    addLink({ source: "op", target: "inv", value: inv * opK, color: C_INV });
  }

  if (opexBreakdown && opex > 0) {
    const rd = Number(opexBreakdown.rd)             || 0;
    const sm = Number(opexBreakdown.salesMarketing)  || 0;
    const ga = Number(opexBreakdown.generalAdmin)    || 0;
    const ot = Number(opexBreakdown.other)           || 0;
    const entries = [
      { id: "rd",  name: "R&D",         displayValue: fmt(rd, unit), value: rd,  color: "#D06050" },
      { id: "sm",  name: "Sales & Mkt", displayValue: fmt(sm, unit), value: sm,  color: C_OPEX   },
      { id: "ga",  name: "G&A",         displayValue: fmt(ga, unit), value: ga,  color: "#B07030" },
      { id: "ot",  name: "Other OpEx",  displayValue: fmt(ot, unit), value: ot,  color: "#C09050" },
    ];
    entries.forEach(({ id, name, displayValue, value, color }) => {
      if (value <= 0) return;
      addNode({ id, name, displayValue, color });
      addLink({ source: "opex", target: id, value, color });
    });
  }

  if (nodes.length < 3 || links.length < 2) return null;

  // ── Run d3-sankey layout ───────────────────────────────────────────────────
  const VH = Math.max(1000, displaySegs.length * 100 + 500);
  const layout = d3Sankey<SNode, SLink>()
    .nodeId((n) => n.id)
    .nodeAlign(sankeyCenter)
    .nodeWidth(NODE_W)
    .nodePadding(PAD)
    // Leave 120 SVG units at the bottom so BELOW-node labels have room.
    .extent([[SEG_LEFT, TOP_PAD], [VW - 320, VH - 120]]);

  const graph = layout({ nodes: nodes.map(n => ({ ...n })), links: links.map(l => ({ ...l })) });

  // Rightmost column x0 — only these pure-sink nodes get right-side labels.
  const lastColX = Math.max(...(graph.nodes as SNode[]).map(n => Math.round(n.x0 ?? 0)));

  // For each column, find the topmost node (smallest y0).
  // Mid-col nodes: topmost → label ABOVE; all others → label BELOW (avoids
  // landing on the node that sits directly above the non-topmost node).
  const byCol = new Map<number, SNode[]>();
  for (const node of graph.nodes as SNode[]) {
    const colX = Math.round(node.x0 ?? 0);
    if (!byCol.has(colX)) byCol.set(colX, []);
    byCol.get(colX)!.push(node);
  }
  const colTopId = new Set<string>();
  for (const [, colNodes] of byCol) {
    const top = colNodes.reduce((a, b) => (a.y0 ?? Infinity) < (b.y0 ?? Infinity) ? a : b);
    colTopId.add(top.id);
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  const LINE_H = 28;
  const LABEL_GAP = 14; // gap between label block bottom and node top

  function labelBlock(
    n: SNode,
    cx: number,
    topY: number,
    anchor: "start" | "end" | "middle",
    nameSz: number,
    valSz: number,
    subSz: number,
    nameFill: string,
    valFill: string,
    showSub = true,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lines: any[] = [];
    let idx = 0;

    lines.push(
      <text key="name" x={cx} y={topY + LINE_H * idx + LINE_H / 2}
        fontSize={nameSz} fontWeight="800" fill={nameFill}
        textAnchor={anchor} dominantBaseline="middle">
        {n.name}
      </text>
    );
    idx++;

    if (n.displayValue) {
      lines.push(
        <text key="val" x={cx} y={topY + LINE_H * idx + LINE_H / 2}
          fontSize={valSz} fontWeight="600" fill={valFill}
          textAnchor={anchor} dominantBaseline="middle">
          {n.displayValue}
        </text>
      );
      idx++;
    }

    if (n.subLabel && showSub) {
      lines.push(
        <text key="sub" x={cx} y={topY + LINE_H * idx + LINE_H / 2}
          fontSize={subSz} fill="#666"
          textAnchor={anchor} dominantBaseline="middle">
          {n.subLabel}
        </text>
      );
    }

    return lines;
  }

  // ── Pre-compute last-column label positions (greedy anti-overlap) ──────────
  // Labels are centered on cy, but thin nodes have blocks taller than the node
  // itself, so consecutive labels can collide. Push each one down until clear.
  const lastColLabelY = new Map<string, number>();
  {
    const sorted = (graph.nodes as SNode[])
      .filter(n => Math.round(n.x0 ?? 0) === lastColX)
      .sort((a, b) => (a.y0 ?? 0) - (b.y0 ?? 0));
    let prevBottom = -Infinity;
    for (const ln of sorted) {
      const lh  = Math.max(1, (ln.y1 ?? 0) - (ln.y0 ?? 0));
      const lcy = (ln.y0 ?? 0) + lh / 2;
      const nl  = 1 + (ln.displayValue ? 1 : 0) + (ln.subLabel ? 1 : 0);
      let ty = lcy - (nl * LINE_H) / 2;
      if (ty < prevBottom + 8) ty = prevBottom + 8;
      lastColLabelY.set(ln.id, ty);
      prevBottom = ty + nl * LINE_H;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full rounded-xl border border-[#03065E]/10 bg-white py-3 px-1">
      <div className="text-xs font-semibold text-[#03065E] mb-2 px-3">
        {data.period} · Income Statement
        {data.segmentPeriod && data.segments.length > 0 && data.segmentPeriod !== data.period && (
          <span className="ml-1">· Segments: {data.segmentPeriod}</span>
        )}
        <span className="ml-2 font-normal text-[#707070]">in {data.currency}, {unit}</span>
      </div>

      <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" style={{ display: "block" }}>

        {/* ── Ribbon flows ── */}
        {graph.links.map((link, i) => {
          const src = link.source as SNode;
          const dst = link.target as SNode;
          const hw  = (link.width ?? 0) / 2;
          const y0  = link.y0 ?? 0;
          const y1  = link.y1 ?? 0;
          return (
            <path
              key={i}
              d={ribbon(
                src.x1 ?? 0, y0 - hw, y0 + hw,
                dst.x0 ?? 0, y1 - hw, y1 + hw,
              )}
              fill={(link as SLink).color}
              fillOpacity={FLOW_OP}
            />
          );
        })}

        {/* ── Node bars + labels ── */}
        {graph.nodes.map((node) => {
          const n  = node as SNode;
          const x0 = node.x0 ?? 0;
          const y0 = node.y0 ?? 0;
          const x1 = node.x1 ?? 0;
          const h  = Math.max(1, (node.y1 ?? 0) - y0);
          const cy = y0 + h / 2;

          // Label placement:
          //   segment nodes  → LEFT  (nothing to their left)
          //   last-col nodes → RIGHT (pure sinks, nothing flowing to their right)
          //   everything else → ABOVE (ribbon flows pass right of these nodes,
          //                            so side labels would land on colored ribbons)
          const isSegment = segNodeIds.has(n.id);
          const isLastCol = Math.round(x0) === lastColX;
          const isMidCol  = !isSegment && !isLastCol;
          const showLabel = h >= 12;

          return (
            <g key={n.id}>
              <rect x={x0} y={y0} width={NODE_W} height={h} fill={n.color} rx={2} />

              {showLabel && (() => {
                if (isMidCol) {
                  // ── ABOVE (topmost in col) or BELOW (non-topmost) ──
                  // Non-topmost nodes can't go above without landing on the node above them.
                  const isTop   = colTopId.has(n.id);
                  const cx      = x0 + NODE_W / 2;
                  // Always at least medium (18px) — label lives above the node,
                  // not inside it, so height doesn't constrain readability.
                  const nameSz  = h >= 250 ? 23 : 18;
                  const valSz   = h >= 250 ? 20 : 15;
                  const showSub = h >= 80;
                  const nLines  = 1 + (n.displayValue ? 1 : 0) + (n.subLabel && showSub ? 1 : 0);
                  const topY    = isTop
                    ? y0 - LABEL_GAP - nLines * LINE_H   // above the node
                    : y0 + h + LABEL_GAP;                  // below the node
                  return labelBlock(n, cx, topY, "middle", nameSz, valSz, 14, n.color, n.color, showSub);

                } else if (isSegment) {
                  // ── LEFT of node ──
                  const lx     = x0 - 10;
                  const nLines = 1 + (n.displayValue ? 1 : 0) + (n.subLabel ? 1 : 0);
                  const topY   = cy - nLines * LINE_H / 2;
                  return labelBlock(n, lx, topY, "end", 18, 15, 13, "#111", "#444");

                } else {
                  // ── RIGHT of node (last column only) ──
                  // Use pre-computed topY that guarantees no vertical overlap.
                  const lx   = x1 + 10;
                  const topY = lastColLabelY.get(n.id)
                    ?? cy - (1 + (n.displayValue ? 1 : 0) + (n.subLabel ? 1 : 0)) * LINE_H / 2;
                  return labelBlock(n, lx, topY, "start", 18, 15, 13, "#111", "#444");
                }
              })()}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
