"use client";

import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { sankey as d3Sankey, sankeyCenter, sankeyJustify } from "d3-sankey";
import type { SegmentSankeyData } from "@/types/Report";
import { currencyPrefix } from "@/lib/currencyPrefix";

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

const VW       = 1000;
const FLOW_OP  = 0.72;
const NODE_W   = 18;
const PAD      = 6;
const MAX_SEGS = 7;
const SEG_LEFT = 200;
const TOP_PAD  = 90; // vertical room above nodes for above-node labels
const MAX_NAME = 18; // truncate segment names for compact layout


// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtRaw(v: number | string, unit: string, prefix: string) {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return `${prefix}${n % 1 === 0 ? n : n.toFixed(1)}${unit}`;
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
export function SankeyChart({ data, svgRef }: { data: SegmentSankeyData; svgRef?: RefObject<SVGSVGElement | null> }) {
  const {
    segments, totalRevenue, grossProfit, costOfRevenue,
    operatingProfit, operatingExpenses, netProfit,
    opexBreakdown, investments, tax, unit,
    grossMarginPct, operatingMarginPct, netMarginPct, totalRevenueYoy,
    nonOperatingIncome, netLoss, operatingLoss, currency,
    industryProfile,
    interestIncome, interestExpense, netInterestIncome,
    provisionForLoanLosses, noninterestIncome, noninterestExpense,
    premiumsEarned, policyholderBenefits, underwritingExpense,
    rentalIncome, propertyOpex, noi, ffo,
    managementFees, performanceFees, compensationExpense, compensationRatioPct,
    nonOpBreakdown, geographyOnly,
  } = data;

  // Currency-aware formatter — closes over the issuer's reporting currency
  // so every node's value renders with the correct symbol (€, £, $, ...).
  const pfx = currencyPrefix(currency);
  const fmt = (v: number | string, u: string) => fmtRaw(v, u, pfx);

  const rev = Number(totalRevenue);
  const lossEarly = Math.max(0, Number(netLoss) || 0);
  // Pre-revenue issuers (NextDecade-style LNG developers, clinical-stage
  // biotech) report rev = 0 with tagged opex + a net loss. We still render
  // a meaningful Sankey (cost buckets → Net Loss sink) instead of nothing.
  const isPreRevenue = industryProfile === "pre-revenue" || (rev === 0 && lossEarly > 0);
  if (!isPreRevenue && (!isFinite(rev) || rev <= 0)) return null;

  const gp   = Math.min(Number(grossProfit)     || 0, rev);
  const cogs = Math.max(0, rev - gp);
  const rawOp = Math.max(0, Number(operatingProfit) || 0);
  const op    = gp > 0 ? Math.min(rawOp, gp) : rawOp;
  // Operating loss flag: set when issuer's OperatingIncomeLoss < 0. The data
  // pipeline still clamps `operatingProfit` to ≥ 0 (so the GP→Op chain doesn't
  // try to flow negative values) and reports the loss magnitude separately.
  const opLoss = Math.max(0, Number(operatingLoss) || 0);
  // With no GP layer (airlines, oil majors), gp − op underflows to 0 and the
  // opex breakdown gate below would skip rendering. Fall back to the reported
  // total opex so the airline buckets still surface.
  // Op-loss override: when the issuer reports an operating loss, true OpEx >
  // GP. Use the reported `operatingExpenses` (which already accounts for the
  // loss via signed gp − is.operatingIncome upstream) so the OpEx node is
  // sized correctly. The gap (opex − gp) is funded by an "Op. Loss" source
  // added below in the GP branch.
  const opex  = opLoss > 0
    ? Math.max(0, Number(operatingExpenses) || 0)
    : gp > 0
      ? Math.max(0, gp - op)
      : Math.max(0, Number(operatingExpenses) || 0);
  const nonOp = Math.max(0, Number(nonOperatingIncome) || 0);
  // Cap np by whichever upstream node it flows from. With no op/gp data
  // (e.g. Yahoo headline-only quarter for some tickers), fall back to rev.
  const npCap = op > 0 ? op : (gp > 0 ? gp : rev);
  const np    = Math.max(0, Math.min(Number(netProfit) || 0, npCap));
  const loss  = lossEarly;
  const inv   = Number(investments) || 0;
  const tx    = Number(tax) || 0;

  // Detect "airline-style" layout: no GP layer (gp = 0) but a populated opex
  // breakdown. In this mode the Sankey routes the breakdown through "Op.
  // Costs" instead of "Op. Expenses", and bundles below-the-line items
  // (taxes + non-op) into a single "Tax & Non-Op" sibling of Net Income to
  // keep tiny op→tax / op→inv ribbons from crossing the breakdown ribbons.
  const hasBreakdownBuckets = !!opexBreakdown && (
    (Number(opexBreakdown.rd) || 0) > 0 ||
    (Number(opexBreakdown.salesMarketing) || 0) > 0 ||
    (Number(opexBreakdown.generalAdmin) || 0) > 0 ||
    (Number(opexBreakdown.other) || 0) > 0 ||
    (Number(opexBreakdown.fuel) || 0) > 0 ||
    (Number(opexBreakdown.salariesWages) || 0) > 0 ||
    (Number(opexBreakdown.maintenance) || 0) > 0 ||
    (Number(opexBreakdown.rentAndLanding) || 0) > 0 ||
    (Number(opexBreakdown.depreciation) || 0) > 0 ||
    // Oil & gas-specific buckets (XOM, CVX, COP). Same routing as airlines:
    // through "Op. Costs" instead of "Op. Expenses".
    (Number(opexBreakdown.taxesOther) || 0) > 0 ||
    (Number(opexBreakdown.exploration) || 0) > 0 ||
    (Number(opexBreakdown.purchases) || 0) > 0 ||
    // Standard-profile sub-buckets (RYOJ-style: payroll/rent/adv/D&A)
    (Number(opexBreakdown.payroll) || 0) > 0 ||
    (Number(opexBreakdown.rentExpense) || 0) > 0 ||
    (Number(opexBreakdown.advertising) || 0) > 0 ||
    (Number(opexBreakdown.depreciationStandard) || 0) > 0
  );
  const airlineNoGp = gp <= 0 && op > 0 && hasBreakdownBuckets;

  // ── Build nodes ────────────────────────────────────────────────────────────
  const nodes: SNode[] = [];
  const links: SLink[] = [];

  function addNode(n: SNode) { nodes.push(n); }
  function addLink(l: SLink) { if (l.value > 0.001) links.push(l); }

  // Sort segments by value desc so the dominant revenue source sits at the
  // top of the column. Then dynamically extend the cap from 7 → 9 when the
  // 8th-9th segments each carry ≥3% of revenue (worth showing instead of
  // rolling into "Others"). Tail segments below that threshold collapse.
  const sortedSegs = [...segments].sort((a, b) => Number(b.value) - Number(a.value));
  const minMaterial = rev * 0.03;
  let dynCap = MAX_SEGS;
  for (let i = MAX_SEGS; i < Math.min(sortedSegs.length, 9); i++) {
    // sortedSegs[i] value is in scaled units (M/B/T), rev is also scaled — but
    // both come from the same scaler so the ratio works regardless of unit.
    if (Number(sortedSegs[i].value) >= rev * 0.03 && Number(sortedSegs[i].value) >= minMaterial * 0.001) {
      dynCap = i + 1;
    } else {
      break;
    }
  }

  const displaySegs = sortedSegs.length > dynCap
    ? [
        ...sortedSegs.slice(0, dynCap - 1),
        {
          name: "Others",
          value: parseFloat(
            sortedSegs.slice(dynCap - 1).reduce((s, seg) => s + Number(seg.value), 0).toFixed(2)
          ),
        } as typeof segments[number],
      ]
    : sortedSegs;

  // Track which IDs are segment nodes so we can give them LEFT labels
  const segNodeIds = new Set<string>();

  if (!isPreRevenue && displaySegs.length > 0) {
    displaySegs.forEach((seg, i) => {
      const v = Number(seg.value) || 0;
      if (v <= 0) return;
      const id = `seg-${i}`;
      segNodeIds.add(id);
      const truncName = seg.name.length > MAX_NAME ? seg.name.slice(0, MAX_NAME - 1) + "…" : seg.name;
      addNode({
        id,
        name: truncName,
        displayValue: fmt(v, unit),
        subLabel: seg.yoy || undefined,
        color: SEG_COLORS[i % SEG_COLORS.length],
      });
      addLink({ source: id, target: "revenue", value: v, color: SEG_COLORS[i % SEG_COLORS.length] });
    });
  }

  if (!isPreRevenue) {
    addNode({
      id: "revenue",
      name: "Revenue",
      displayValue: fmt(rev, unit),
      subLabel: totalRevenueYoy ?? undefined,
      color: "#03065E",
    });
  }

  // ── Industry-profile right-side dispatch ──────────────────────────────────
  // For bank / REIT / asset-manager / insurance, replace the standard
  // GP→OpInc waterfall with an industry-specific layout: revenue is split
  // by the cost lines that actually define the issuer's economics. The
  // segment column was already overridden upstream (lib/fetchSegmentData.ts)
  // to feed industry-correct sources into Revenue. Setting customProfileBuilt
  // skips the standard gp/op/loss/np flow below.
  let customProfileBuilt = false;

  if (isPreRevenue) {
    // Pre-revenue Sankey: cost buckets (left, sources) → Net Loss (right, sink).
    // This is the "burn" view — there's no top-line to decompose, so we show
    // what the company spent and where it ended up. Each tagged bucket flows
    // directly into Net Loss; an "Other Charges" residual catches the gap
    // between the sum of tagged costs and the reported loss (typical for
    // dev-stage issuers with capitalized interest / NCI / equity-method lines).
    const opbRdPR    = opexBreakdown ? Math.max(0, Number(opexBreakdown.rd)            || 0) : 0;
    const opbGaPR    = opexBreakdown ? Math.max(0, Number(opexBreakdown.generalAdmin)  || 0) : 0;
    const opbDepPR   = opexBreakdown ? Math.max(0, Number(opexBreakdown.depreciation)  || 0) : 0;
    const opbOtPR    = opexBreakdown ? Math.max(0, Number(opexBreakdown.other)         || 0) : 0;
    const intExpPR   = nonOpBreakdown ? Math.max(0, Number(nonOpBreakdown.interestExpense) || 0) : 0;
    const taxPR      = Math.max(0, Number(tax) || 0);
    const taggedSum  = opbRdPR + opbGaPR + opbDepPR + opbOtPR + intExpPR + taxPR;
    const residualPR = Math.max(0, loss - taggedSum);
    const lossSinkVal= taggedSum + residualPR;
    if (lossSinkVal > 0) {
      addNode({
        id: "loss",
        name: "Net Loss",
        displayValue: `-${fmt(loss, unit)}`,
        color: "#B0353A",
      });
      const buckets: Array<{ id: string; name: string; value: number; color: string }> = [];
      if (opbGaPR  > 0) buckets.push({ id: "ga",     name: "G&A",            value: opbGaPR,  color: "#B07030" });
      if (opbRdPR  > 0) buckets.push({ id: "rd",     name: "R&D",            value: opbRdPR,  color: "#D06050" });
      if (opbDepPR > 0) buckets.push({ id: "dep",    name: "D&A",            value: opbDepPR, color: "#7A6E5A" });
      if (opbOtPR  > 0) buckets.push({ id: "ot",     name: "Other OpEx",     value: opbOtPR,  color: "#C09050" });
      if (intExpPR > 0) buckets.push({ id: "intExp", name: "Interest Exp.",  value: intExpPR, color: "#C95A2C" });
      if (taxPR    > 0) buckets.push({ id: "tax",    name: "Taxes",          value: taxPR,    color: C_TAX     });
      if (residualPR > loss * 0.005) {
        buckets.push({ id: "otherCh", name: "Other Charges", value: residualPR, color: "#A06070" });
      }
      for (const b of buckets) {
        addNode({ id: b.id, name: b.name, displayValue: fmt(b.value, unit), color: b.color });
        addLink({ source: b.id, target: "loss", value: b.value, color: b.color });
        // Mark left-column buckets so the label renderer places names to the
        // LEFT of the node bar (same treatment as revenue segments). Without
        // this they default to above/below placement, which collides with the
        // tightly-packed Sankey ribbons.
        segNodeIds.add(b.id);
      }
    }
    customProfileBuilt = true;
  } else if (industryProfile === "bank") {
    const provision  = Math.max(0, Number(provisionForLoanLosses) || 0);
    const nonExp     = Math.max(0, Number(noninterestExpense)     || 0);
    const taxBank    = Math.max(0, Number(tax) || 0);
    const niBank     = Math.max(0, Number(netProfit) || 0);
    const lossBank   = Math.max(0, Number(netLoss) || 0);

    // Efficiency Ratio = Noninterest Expense / Total Net Revenue. Bank
    // analysts' #1 expense-side metric — lower is better. JPM ≈ 55%, BAC ≈ 65%.
    const efficiencyRatio = rev > 0 ? (nonExp / rev) * 100 : 0;
    const niiBits: string[] = [];
    if (interestExpense) niiBits.push(`after ${fmt(Number(interestExpense), unit)} int. exp.`);
    if (efficiencyRatio > 0) niiBits.push(`${efficiencyRatio.toFixed(0)}% efficiency`);
    const niiSubLabel = niiBits.length > 0 ? niiBits.join(" · ") : undefined;

    if (lossBank > 0) {
      // Loss period — Net Loss is a co-source alongside Revenue, not a sink.
      // When expenses (Provision + NonExp + Tax) exceed revenue by the loss
      // amount, treating loss as another outflow off Revenue makes outflows >
      // inflows; d3-sankey scales the Revenue node to the larger side and
      // produces a visually unbalanced chart (BAFN-style: tall right column,
      // empty space below the input ribbon). Mirror the standard treatAsLoss
      // pattern: route Revenue + Net Loss through an "Op. Costs" intermediate
      // that splits into the expense lines.
      const tagged      = provision + nonExp + taxBank;
      const synthSink   = Math.max(0, (rev + lossBank) - tagged);
      const synthSource = Math.max(0, tagged - (rev + lossBank));

      addNode({ id: "loss", name: "Net Loss", displayValue: `-${fmt(lossBank, unit)}`, color: "#B0353A" });
      segNodeIds.add("loss");

      if (synthSource > 0) {
        addNode({ id: "nonop", name: "Non-Op Income", displayValue: `+${fmt(synthSource, unit)}`, color: "#5A8A5A" });
        segNodeIds.add("nonop");
      }

      const tcTotal = rev + lossBank + synthSource;
      addNode({ id: "tc", name: "Op. Costs", displayValue: fmt(tcTotal, unit), color: C_OPEX });
      addLink({ source: "revenue", target: "tc", value: rev,      color: C_OPEX });
      addLink({ source: "loss",    target: "tc", value: lossBank, color: "#B0353A" });
      if (synthSource > 0) addLink({ source: "nonop", target: "tc", value: synthSource, color: "#5A8A5A" });

      if (provision > 0) {
        addNode({ id: "provision", name: "Provisions", displayValue: fmt(provision, unit), color: C_COGS });
        addLink({ source: "tc", target: "provision", value: provision, color: C_COGS });
      }
      if (nonExp > 0) {
        addNode({ id: "nonExp", name: "Noninterest Exp.", displayValue: fmt(nonExp, unit), subLabel: niiSubLabel, color: C_OPEX });
        addLink({ source: "tc", target: "nonExp", value: nonExp, color: C_OPEX });
      }
      if (taxBank > 0) {
        addNode({ id: "tax", name: "Taxes", displayValue: fmt(taxBank, unit), color: C_TAX });
        addLink({ source: "tc", target: "tax", value: taxBank, color: C_TAX });
      }
      if (synthSink > 0) {
        addNode({ id: "otherBank", name: "Other Costs", displayValue: fmt(synthSink, unit), color: "#A06070" });
        addLink({ source: "tc", target: "otherBank", value: synthSink, color: "#A06070" });
      }
    } else {
      const sumOut   = provision + nonExp + taxBank + niBank;
      // Residual to balance Revenue inflow with outflow. Common when
      // intermediate-tag concepts (corporate / treasury / other items) sit
      // between Total Net Revenue and Pre-Tax Income.
      const residual = Math.max(0, rev - sumOut);

      if (provision > 0) {
        addNode({ id: "provision", name: "Provisions", displayValue: fmt(provision, unit), color: C_COGS });
        addLink({ source: "revenue", target: "provision", value: provision, color: C_COGS });
      }
      if (nonExp > 0) {
        addNode({
          id: "nonExp",
          name: "Noninterest Exp.",
          displayValue: fmt(nonExp, unit),
          subLabel: niiSubLabel,
          color: C_OPEX,
        });
        addLink({ source: "revenue", target: "nonExp", value: nonExp, color: C_OPEX });

        // Decompose Noninterest Expense into compensation / tech / occupancy /
        // professional / marketing / other when the issuer tagged them. Sub-
        // nodes flow from `nonExp` so the chart shows the bank's cost
        // structure (typically compensation 50-60% of noninterest expense).
        const bankBuckets: Array<{ id: string; name: string; value: number; color: string }> = [];
        if (opexBreakdown) {
          const v = (x: number | undefined) => Math.max(0, Number(x) || 0);
          const compNeb  = v(opexBreakdown.bankCompensation);
          const techNeb  = v(opexBreakdown.bankTechnology);
          const occNeb   = v(opexBreakdown.bankOccupancy);
          const profNeb  = v(opexBreakdown.bankProfessional);
          const mktNeb   = v(opexBreakdown.bankMarketing);
          const othNeb   = v(opexBreakdown.bankOtherNoninterest);
          if (compNeb > 0)  bankBuckets.push({ id: "neComp",  name: "Compensation",   value: compNeb, color: "#A06070" });
          if (techNeb > 0)  bankBuckets.push({ id: "neTech",  name: "Tech & Comm.",   value: techNeb, color: "#7A6E5A" });
          if (occNeb > 0)   bankBuckets.push({ id: "neOcc",   name: "Occupancy",      value: occNeb,  color: "#B07030" });
          if (profNeb > 0)  bankBuckets.push({ id: "neProf",  name: "Prof. Services", value: profNeb, color: "#5A8A5A" });
          if (mktNeb > 0)   bankBuckets.push({ id: "neMkt",   name: "Marketing",      value: mktNeb,  color: "#C95A2C" });
          if (othNeb > 0)   bankBuckets.push({ id: "neOther", name: "Other",          value: othNeb,  color: "#C09050" });
        }
        const bucketSum = bankBuckets.reduce((s, b) => s + b.value, 0);
        if (bucketSum > 0 && bucketSum <= nonExp * 1.02) {
          // Fold the unallocated residual into the existing "Other" bucket
          // when the issuer tagged `OtherNoninterestExpense`, so the chart
          // doesn't render two sibling "Other" nodes under Noninterest Exp.
          const neResidual = nonExp - bucketSum;
          const otherBucket = bankBuckets.find((b) => b.id === "neOther");
          if (otherBucket && neResidual > nonExp * 0.02) {
            otherBucket.value += neResidual;
          }
          for (const b of bankBuckets) {
            addNode({ id: b.id, name: b.name, displayValue: fmt(b.value, unit), color: b.color });
            addLink({ source: "nonExp", target: b.id, value: b.value, color: b.color });
          }
          if (!otherBucket && neResidual > nonExp * 0.02) {
            addNode({ id: "neResidual", name: "Other", displayValue: fmt(neResidual, unit), color: "#C09050" });
            addLink({ source: "nonExp", target: "neResidual", value: neResidual, color: "#C09050" });
          }
        }
      }
      if (residual > 0 && residual / rev > 0.01) {
        addNode({ id: "otherBank", name: "Other Costs", displayValue: fmt(residual, unit), color: "#C09050" });
        addLink({ source: "revenue", target: "otherBank", value: residual, color: "#C09050" });
      }
      if (taxBank > 0) {
        addNode({ id: "tax", name: "Taxes", displayValue: fmt(taxBank, unit), color: C_TAX });
        addLink({ source: "revenue", target: "tax", value: taxBank, color: C_TAX });
      }
      if (niBank > 0) {
        addNode({
          id: "np",
          name: "Net Income",
          displayValue: fmt(niBank, unit),
          subLabel: netMarginPct ? `${netMarginPct}% margin` : undefined,
          color: C_NP,
        });
        addLink({ source: "revenue", target: "np", value: niBank, color: C_NP });
      }
    }
    customProfileBuilt = true;
  } else if (industryProfile === "reit") {
    const propOpex   = Math.max(0, Number(propertyOpex) || 0);
    // Derive NOI from revenue − property opex so the Sankey balances even
    // when the parser's pre-computed `noi` lags behind the corrected revenue
    // (e.g. AMT split-revenue case where rental and services were summed).
    // The displayed value still uses the parser's `noi` if present (FFO/NOI
    // labels match what the issuer reports), but the link width comes from
    // the algebraic identity revenue = propertyOpex + NOI.
    const noiFlow    = Math.max(0, rev - propOpex);
    const noiDisplay = Math.max(0, Number(noi) || noiFlow);
    const ga         = opexBreakdown ? Math.max(0, Number(opexBreakdown.generalAdmin) || 0) : 0;
    const dep        = opexBreakdown ? Math.max(0, Number(opexBreakdown.depreciation) || 0) : 0;
    const intExp     = nonOpBreakdown ? Math.max(0, Number(nonOpBreakdown.interestExpense) || 0) : 0;
    const niReit     = Math.max(0, Number(netProfit) || 0);
    const taxReit    = Math.max(0, Number(tax) || 0);
    const ffoSub     = ffo ? `FFO ${fmt(Number(ffo), unit)}` : undefined;

    if (propOpex > 0 && noiFlow > 0) {
      // Revenue → Property Opex (sink) + NOI (continues)
      addNode({ id: "propOpex", name: "Property Opex", displayValue: fmt(propOpex, unit), color: C_COGS });
      addLink({ source: "revenue", target: "propOpex", value: propOpex, color: C_COGS });
      addNode({
        id: "noi",
        name: "NOI",
        displayValue: fmt(noiDisplay, unit),
        subLabel: ffoSub,
        color: C_OP,
      });
      addLink({ source: "revenue", target: "noi", value: noiFlow, color: C_OP });
      // NOI → G&A, Interest Expense, D&A, Tax, Net Income.
      // Children scaled to fit noiFlow (the actual link width), not the
      // potentially-stale displayed noi value.
      const noiOut = ga + dep + intExp + taxReit + niReit;
      const noiK = noiOut > noiFlow && noiOut > 0 ? noiFlow / noiOut : 1;
      if (ga > 0)     { addNode({ id: "ga", name: "G&A", displayValue: fmt(ga, unit), color: "#B07030" });
                        addLink({ source: "noi", target: "ga", value: ga * noiK, color: "#B07030" }); }
      if (dep > 0)    { addNode({ id: "dep", name: "D&A", displayValue: fmt(dep, unit), color: "#7A6E5A" });
                        addLink({ source: "noi", target: "dep", value: dep * noiK, color: "#7A6E5A" }); }
      if (intExp > 0) { addNode({ id: "intExp", name: "Interest Exp.", displayValue: fmt(intExp, unit), color: "#C95A2C" });
                        addLink({ source: "noi", target: "intExp", value: intExp * noiK, color: "#C95A2C" }); }
      if (taxReit > 0){ addNode({ id: "tax", name: "Taxes", displayValue: fmt(taxReit, unit), color: C_TAX });
                        addLink({ source: "noi", target: "tax", value: taxReit * noiK, color: C_TAX }); }
      if (niReit > 0) { addNode({ id: "np", name: "Net Income", displayValue: fmt(niReit, unit),
                                  subLabel: netMarginPct ? `${netMarginPct}% margin` : undefined, color: C_NP });
                        addLink({ source: "noi", target: "np", value: niReit * noiK, color: C_NP }); }
      // Residual NOI not explained by tagged outflows (G&A, D&A, Interest,
      // Tax, NI) — preserves balance when the issuer has uncategorized
      // operating items between NOI and Net Income.
      const noiResidual = Math.max(0, noiFlow - (ga + dep + intExp + taxReit + niReit) * noiK);
      if (noiResidual > rev * 0.005) {
        addNode({ id: "noiOther", name: "Other", displayValue: fmt(noiResidual, unit), color: "#C09050" });
        addLink({ source: "noi", target: "noiOther", value: noiResidual, color: "#C09050" });
      }
      customProfileBuilt = true;
    }
  } else if (industryProfile === "asset-manager") {
    const comp    = Math.max(0, Number(compensationExpense) || 0);
    const ga      = opexBreakdown ? Math.max(0, Number(opexBreakdown.generalAdmin) || 0) : 0;
    const opAsset = Math.max(0, Number(operatingProfit) || 0);
    const taxAm   = Math.max(0, Number(tax) || 0);
    const niAm    = Math.max(0, Number(netProfit) || 0);
    const otherCosts = Math.max(0, rev - comp - ga - opAsset);

    if (comp > 0 && opAsset > 0) {
      // Revenue → Compensation (sink, dominant cost) + G&A + Other + Op Income (continues)
      addNode({
        id: "comp",
        name: "Compensation",
        displayValue: fmt(comp, unit),
        subLabel: compensationRatioPct ? `${compensationRatioPct}% comp ratio` : undefined,
        color: C_OPEX,
      });
      addLink({ source: "revenue", target: "comp", value: comp, color: C_OPEX });
      if (ga > 0) {
        addNode({ id: "ga", name: "G&A", displayValue: fmt(ga, unit), color: "#B07030" });
        addLink({ source: "revenue", target: "ga", value: ga, color: "#B07030" });
      }
      if (otherCosts > rev * 0.01) {
        addNode({ id: "otherCosts", name: "Other Costs", displayValue: fmt(otherCosts, unit), color: "#C09050" });
        addLink({ source: "revenue", target: "otherCosts", value: otherCosts, color: "#C09050" });
      }
      addNode({
        id: "op",
        name: "Op. Income",
        displayValue: fmt(opAsset, unit),
        subLabel: operatingMarginPct ? `${operatingMarginPct}% margin` : undefined,
        color: C_OP,
      });
      addLink({ source: "revenue", target: "op", value: opAsset, color: C_OP });
      // Op Income → Tax + Net Income
      const opOut = taxAm + niAm;
      const opK2 = opOut > opAsset && opOut > 0 ? opAsset / opOut : 1;
      if (taxAm > 0) { addNode({ id: "tax", name: "Taxes", displayValue: fmt(taxAm, unit), color: C_TAX });
                       addLink({ source: "op", target: "tax", value: taxAm * opK2, color: C_TAX }); }
      if (niAm > 0)  { addNode({ id: "np", name: "Net Income", displayValue: fmt(niAm, unit),
                                  subLabel: netMarginPct ? `${netMarginPct}% margin` : undefined, color: C_NP });
                       addLink({ source: "op", target: "np", value: niAm * opK2, color: C_NP }); }
      customProfileBuilt = true;
    }
  } else if (industryProfile === "insurance") {
    const benefits   = Math.max(0, Number(policyholderBenefits) || 0);
    const underw     = Math.max(0, Number(underwritingExpense) || 0);
    const taxIns     = Math.max(0, Number(tax) || 0);
    const niIns      = Math.max(0, Number(netProfit) || 0);
    const lossIns    = Math.max(0, Number(netLoss) || 0);
    const sumOutIns  = benefits + underw + taxIns + niIns;
    const residualIns= Math.max(0, rev - sumOutIns);
    // Combined Ratio = (Benefits + UW Expense + Other operating costs) / Premiums Earned.
    // The canonical insurance profitability metric: < 100 means underwriting profit,
    // > 100 means UW losses (offset by investment income). PGR ≈ 88%, AIG ≈ 95%.
    const premiums = Math.max(0, Number(premiumsEarned) || 0);
    const combinedRatio = premiums > 0
      ? ((benefits + underw + residualIns) / premiums) * 100
      : 0;

    if (benefits > 0 && (niIns > 0 || lossIns > 0)) {
      addNode({ id: "benefits", name: "Benefits & Claims", displayValue: fmt(benefits, unit), color: C_COGS });
      addLink({ source: "revenue", target: "benefits", value: benefits, color: C_COGS });
      if (underw > 0) {
        addNode({ id: "underw", name: "Underwriting Exp.", displayValue: fmt(underw, unit), color: C_OPEX });
        addLink({ source: "revenue", target: "underw", value: underw, color: C_OPEX });
      }
      if (residualIns > rev * 0.01) {
        addNode({ id: "otherIns", name: "Other Costs", displayValue: fmt(residualIns, unit), color: "#C09050" });
        addLink({ source: "revenue", target: "otherIns", value: residualIns, color: "#C09050" });
      }
      if (taxIns > 0) {
        addNode({ id: "tax", name: "Taxes", displayValue: fmt(taxIns, unit), color: C_TAX });
        addLink({ source: "revenue", target: "tax", value: taxIns, color: C_TAX });
      }
      if (niIns > 0) {
        const niBits: string[] = [];
        if (netMarginPct)        niBits.push(`${netMarginPct}% margin`);
        if (combinedRatio > 0)   niBits.push(`${combinedRatio.toFixed(0)}% combined`);
        addNode({
          id: "np",
          name: "Net Income",
          displayValue: fmt(niIns, unit),
          subLabel: niBits.length > 0 ? niBits.join(" · ") : undefined,
          color: C_NP,
        });
        addLink({ source: "revenue", target: "np", value: niIns, color: C_NP });
      } else if (lossIns > 0) {
        addNode({ id: "loss", name: "Net Loss", displayValue: `-${fmt(lossIns, unit)}`, color: "#B0353A" });
        addLink({ source: "revenue", target: "loss", value: lossIns, color: "#B0353A" });
      }
      customProfileBuilt = true;
    }
  }

  // `lossHandled` is read by layout/label code below; declared here so
  // industry-profile branches that don't go through the loss path still
  // have it available without re-declaration.
  let lossHandled = false;

  if (!customProfileBuilt) {

  // Pre-compute cost breakdown values so we can decide between the regular
  // GP→OpEx layout and the loss-period "Total Costs" pattern up front.
  const realCogs = Number(costOfRevenue) || 0;
  const opbRd = opexBreakdown ? Number(opexBreakdown.rd) || 0 : 0;
  const opbSm = opexBreakdown ? Number(opexBreakdown.salesMarketing) || 0 : 0;
  const opbGa = opexBreakdown ? Number(opexBreakdown.generalAdmin) || 0 : 0;
  const opbOt = opexBreakdown ? Number(opexBreakdown.other) || 0 : 0;
  // Airline buckets — populated only when the issuer is an airline (fuel +
  // labor reported as top-level expense lines). All zero for non-airlines.
  const opbFuel  = opexBreakdown ? Number(opexBreakdown.fuel) || 0 : 0;
  const opbLabor = opexBreakdown ? Number(opexBreakdown.salariesWages) || 0 : 0;
  const opbMaint = opexBreakdown ? Number(opexBreakdown.maintenance) || 0 : 0;
  const opbRent  = opexBreakdown ? Number(opexBreakdown.rentAndLanding) || 0 : 0;
  const opbDep   = opexBreakdown ? Number(opexBreakdown.depreciation) || 0 : 0;
  // Cross-industry sub-buckets — populated when the issuer XBRL-tagged them.
  // Render under Op Expenses parent like rd/sm/ga, in addition to (not in
  // place of) the existing buckets. Sized small relative to total opex but
  // common at conglomerates and tech firms with heavy SBC.
  const opbSbc          = opexBreakdown ? Number(opexBreakdown.stockBasedComp) || 0 : 0;
  const opbImpairment   = opexBreakdown ? Number(opexBreakdown.impairment)     || 0 : 0;
  const opbRestructure  = opexBreakdown ? Number(opexBreakdown.restructuring)  || 0 : 0;
  const realOpex = opbRd + opbSm + opbGa + opbOt
    + opbFuel + opbLabor + opbMaint + opbRent + opbDep
    + opbSbc + opbImpairment + opbRestructure;
  const realTax  = Math.max(0, Number(tax) || 0);
  const realTotalCosts = realCogs + realOpex + realTax;

  // Loss-period detection: triggered by either an explicit Net Loss (data.netLoss
  // set when reported NI < 0 — covers PFE-style cases with positive GP but
  // negative bottom line from impairment/non-op charges) or an all-negative
  // biotech profile (MRNA-style: gp/op/np all clamp to 0 with realTotalCosts > rev).
  // Both render the same Total Costs structure: Revenue + Net Loss → Total Costs
  // → cost breakdown. This keeps the loss visually prominent without distorting
  // the GP→OpEx flow that wouldn't make sense in a money-losing period.
  const treatAsLoss =
    (loss > 0 && realTotalCosts > 0) ||
    (gp <= 0 && op <= 0 && np <= 0 && realTotalCosts > rev);

  if (treatAsLoss) {
    // Loss amount: prefer the explicit reported NI (data.netLoss) so the
    // displayed "-$X" matches what the issuer actually reported. Fall back to
    // the cost gap (realTotalCosts − rev) when no explicit value is present
    // (early biotechs that don't tag NI separately, etc.).
    const baseGap   = Math.max(0, realTotalCosts - rev);
    const lossAmt   = loss > 0 ? loss : baseGap;
    // Reconciliation between (rev + loss) and the sum of tagged costs:
    //   synthSink   > 0 → tagged costs short of (rev + loss) → untagged costs
    //                     (impairment, interest, restructuring) absorbed by a
    //                     synthetic "Tax & Non-Op" sink. PFE-style.
    //   synthSource > 0 → tagged costs exceed (rev + loss) → untagged income
    //                     (interest income, tax benefit) modeled as a "Non-Op
    //                     Income" SOURCE alongside Revenue + Net Loss. MRNA-style.
    const synthSink   = Math.max(0, (rev + lossAmt) - realTotalCosts);
    const synthSource = Math.max(0, realTotalCosts - (rev + lossAmt));

    addNode({
      id: "loss",
      name: "Net Loss",
      displayValue: `-${fmt(lossAmt, unit)}`,
      color: "#B0353A",
    });
    // Label "loss" with the same LEFT placement + greedy anti-overlap used for
    // revenue segments — prevents label collisions when col-1 stacks Revenue,
    // Net Loss, and (optionally) Non-Op Income in the same column.
    segNodeIds.add("loss");

    if (synthSource > 0) {
      addNode({
        id: "nonop",
        name: "Non-Op Income",
        displayValue: `+${fmt(synthSource, unit)}`,
        color: "#5A8A5A",
      });
      segNodeIds.add("nonop");
    }

    // CoGS sits as a direct outflow from Revenue (standard income statement
    // view). When CoGS > rev (biotech burn), Revenue funds what it can and
    // Net Loss funds the rest of CoGS via a second inflow.
    const cogsFromRev  = Math.min(realCogs, rev);
    const cogsFromLoss = Math.max(0, realCogs - rev);
    const revRemainder = rev - cogsFromRev;

    if (realCogs > 0) {
      addNode({ id: "cogs", name: "Cost of Rev.", displayValue: fmt(realCogs, unit), color: C_COGS });
      addLink({ source: "revenue", target: "cogs", value: cogsFromRev, color: C_COGS });
      if (cogsFromLoss > 0) {
        addLink({ source: "loss", target: "cogs", value: cogsFromLoss, color: "#B0353A" });
      }
    }

    const otherCostEntries: Array<{ id: string; name: string; value: number; color: string }> = [];
    if (opbFuel  > 0) otherCostEntries.push({ id: "fuel",  name: "Fuel",            value: opbFuel,  color: "#C95A2C" });
    if (opbLabor > 0) otherCostEntries.push({ id: "labor", name: "Salaries & Wages", value: opbLabor, color: "#B5723A" });
    if (opbMaint > 0) otherCostEntries.push({ id: "maint", name: "Maintenance",     value: opbMaint, color: "#9D7A45" });
    if (opbRent  > 0) otherCostEntries.push({ id: "rent",  name: "Rent & Landing",  value: opbRent,  color: "#8B7050" });
    if (opbDep   > 0) otherCostEntries.push({ id: "dep",   name: "D&A",             value: opbDep,   color: "#7A6E5A" });
    if (opbRd    > 0) otherCostEntries.push({ id: "rd",    name: "R&D",          value: opbRd,      color: "#D06050" });
    if (opbSm    > 0) otherCostEntries.push({ id: "sm",    name: "Sales & Mkt",  value: opbSm,      color: C_OPEX   });
    if (opbGa    > 0) otherCostEntries.push({ id: "ga",    name: "G&A",          value: opbGa,      color: "#B07030" });
    if (opbSbc   > 0) otherCostEntries.push({ id: "sbc",   name: "Stock Comp",   value: opbSbc,         color: "#9B7C40" });
    if (opbImpairment > 0) otherCostEntries.push({ id: "impair", name: "Impairment", value: opbImpairment, color: "#C0707A" });
    if (opbRestructure > 0) otherCostEntries.push({ id: "restr", name: "Restructuring", value: opbRestructure, color: "#A06070" });
    if (opbOt    > 0) otherCostEntries.push({ id: "ot",    name: "Other OpEx",   value: opbOt,      color: "#C09050" });
    // Merge "Taxes" + synthSink into one "Tax & Non-Op" sink in loss mode.
    // Both represent below-the-line items consuming the operating result; a
    // separate $70M Taxes bucket next to a $700M Tax & Non-Op produces a
    // tiny secondary ribbon to col 3 that visually crosses the cost-bucket
    // ribbons (DAL Q1 2026). One combined bucket keeps the layout clean.
    const taxAndBelow = realTax + synthSink;
    if (taxAndBelow > 0) {
      otherCostEntries.push({
        id: "below",
        name: "Tax & Non-Op",
        value: taxAndBelow,
        color: "#A06070",
      });
    }

    // Route everything below CoGS through an "Op. Costs" intermediate so
    // multiple inflows (residual Revenue, Net Loss, Non-Op Income) cleanly
    // split into the cost breakdown without criss-crossing ribbons.
    const lossToTc = lossAmt - cogsFromLoss;
    const tcTotal  = revRemainder + lossToTc + synthSource;

    if (otherCostEntries.length > 0 && tcTotal > 0) {
      addNode({
        id: "tc",
        name: "Op. Costs",
        displayValue: fmt(tcTotal, unit),
        color: C_OPEX,
      });
      if (revRemainder > 0) {
        addLink({ source: "revenue", target: "tc", value: revRemainder, color: C_OPEX });
      } else {
        // Structural-only: a negligible Revenue → Op. Costs link so d3-sankey's
        // BFS depth puts tc downstream of Revenue (depth 2). Without it, tc's
        // only inflows are Loss/Non-Op sources at depth 0 → tc collapses to
        // depth 1, gets clamped into Revenue's column, and the layout breaks.
        // Width = 0.0011 ≈ 0.0003 px — visually invisible.
        links.push({ source: "revenue", target: "tc", value: 0.0011, color: C_OPEX });
      }
      if (lossToTc > 0)    addLink({ source: "loss",  target: "tc", value: lossToTc,    color: "#B0353A" });
      if (synthSource > 0) addLink({ source: "nonop", target: "tc", value: synthSource, color: "#5A8A5A" });
      for (const c of otherCostEntries) {
        addNode({ id: c.id, name: c.name, displayValue: fmt(c.value, unit), color: c.color });
        addLink({ source: "tc", target: c.id, value: c.value, color: c.color });
      }
    }
    lossHandled = true;
  } else if (gp > 0) {
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
        name: "Op. Income",
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
      // Standard path: GP → OpEx with the full opex value.
      // Op-loss path: GP covers only its share; the deficit (opex − gp) is
      // funded below by a "Below the line" source that also funds NI when
      // the issuer recovered to a positive bottom line via tax/non-op
      // (RYOJ-style: op loss but NI > 0). Wired in the np-handling block.
      const gpToOpex = opLoss > 0 ? Math.min(gp, opex) : opex;
      addLink({ source: "gp", target: "opex", value: gpToOpex, color: C_OPEX });
    }
  } else if (op > 0) {
    addNode({
      id: "op",
      name: "Op. Income",
      displayValue: fmt(op, unit),
      subLabel: operatingMarginPct ? `${operatingMarginPct}% margin` : undefined,
      color: C_OP,
    });
    addLink({ source: "revenue", target: "op", value: op, color: C_OP });
    const totalCosts = rev - op;
    if (totalCosts > 0) {
      // Airlines (and other no-GP issuers with a populated opex breakdown)
      // route the breakdown through this node — relabel "Op. Costs" so the
      // intermediate matches its role as a cost aggregator.
      const tcName = airlineNoGp ? "Op. Costs" : "Total Costs";
      addNode({ id: "cogs", name: tcName, displayValue: fmt(totalCosts, unit), color: C_COGS });
      addLink({ source: "revenue", target: "cogs", value: totalCosts, color: C_COGS });
    }
  }

  const opOutRaw = np + tx + inv;
  const opK      = opOutRaw > op && opOutRaw > 0 ? op / opOutRaw : 1;

  const npSubLabel = [
    netMarginPct ? `${netMarginPct}% margin` : null,
    nonOp > 0 ? `+ ${fmt(nonOp, unit)} non-operating` : null,
  ].filter(Boolean).join("  ·  ") || undefined;

  // Bare-minimum Sankey when only revenue + net income are available
  // (typical of Yahoo headline-only data — e.g. press release before 10-Q).
  // Connect NP straight off revenue and represent everything else as
  // "Total Costs" so we still have a renderable two-link flow.
  let npHandled = lossHandled;
  if (!lossHandled && gp <= 0 && op <= 0 && np > 0) {
    addNode({ id: "np", name: "Net Income", displayValue: fmt(np, unit), subLabel: npSubLabel, color: C_NP });
    addLink({ source: "revenue", target: "np", value: np, color: C_NP });
    const totalCosts = rev - np;
    if (totalCosts > 0 && !nodes.some((n) => n.id === "cogs")) {
      addNode({ id: "cogs", name: "Total Costs", displayValue: fmt(totalCosts, unit), color: C_COGS });
      addLink({ source: "revenue", target: "cogs", value: totalCosts, color: C_COGS });
    }
    npHandled = true;
  }
  // Op-loss + positive NI (RYOJ FY2025: op −$755K, NI +$119K via tax benefit
  // and non-op income). Standard branch built GP→OpEx but `op` clamped to 0,
  // so there's no "op" node for the np-link block below to hang NI off, and
  // a Revenue→NI bypass would overflow Revenue (Revenue already splits into
  // CoGS + GP for the full top-line).
  //
  // Solution: introduce a synthetic "Tax & Non-Op" source sized to cover
  // both the operating-loss deficit (opex − gp, the OpEx inflow shortfall)
  // AND the net income. Mirrors how the issuer actually got from operating
  // loss to positive NI: external contributions below the operating line.
  // Outflows split:
  //   • → OpEx (= opex − gp): funds the cost gap (RED ribbon = the loss)
  //   • → NI   (= np):        the bottom line   (green ribbon)
  // A tiny structural Revenue→source link pins this node to depth 1 (the
  // same column as Revenue) so its outflow ribbons stay short instead of
  // crossing the whole chart from column 0. Mirrors the trick used in the
  // treatAsLoss "tc" routing.
  if (!lossHandled && !npHandled && opLoss > 0 && op <= 0 && np > 0 && opex > 0) {
    const opexGap   = Math.max(0, opex - gp);
    const synthSrc  = opexGap + np;
    if (synthSrc > 0) {
      addNode({
        id: "below",
        name: "Tax & Non-Op",
        displayValue: `+${fmt(synthSrc, unit)}`,
        color: "#5A8A5A",
      });
      // Structural-only link gp → below: width 0.0011 ≈ 0.0003 px, visually
      // invisible but forces d3-sankey to place `below` at depth gp+1 — the
      // SAME column as Op. Expenses and Net Income (its real consumers).
      // Routing it through Revenue would land it in the GP/Cost-of-Rev column
      // and crowd labels there (RYOJ FY2025: GP rect collapses to a sliver
      // and its label gets crossed by the GP→OpEx ribbon).
      links.push({ source: "gp", target: "below", value: 0.0011, color: "#5A8A5A" });
      if (opexGap > 0) {
        addLink({ source: "below", target: "opex", value: opexGap, color: "#B0353A" });
      }
      addNode({ id: "np", name: "Net Income", displayValue: fmt(np, unit), subLabel: npSubLabel, color: C_NP });
      addLink({ source: "below", target: "np", value: np, color: C_NP });
      npHandled = true;
    }
  }

  if (np > 0 && !npHandled) {
    // Airline mode: link np with full value (no opK rescaling) — the residual
    // op − np feeds a "Tax & Non-Op" sibling below so the op outflow balances
    // exactly without scaling. Falls back to opK scaling when np > op
    // (non-op income / tax credit pushed NI above OpIncome — RYAAY Q3
    // winter quarter case) since the "below" sibling can't absorb a
    // negative residual and the link would exceed op's inflow.
    const npLinkVal = airlineNoGp && np <= op ? np : np * opK;
    addNode({ id: "np", name: "Net Income", displayValue: fmt(np, unit), subLabel: npSubLabel, color: C_NP });
    addLink({ source: "op", target: "np",  value: npLinkVal, color: C_NP  });
  }
  if (airlineNoGp && !lossHandled) {
    // Bundle taxes + non-op residual into one "Tax & Non-Op" leaf so it sits
    // adjacent to Net Income at the top of the rightmost column instead of
    // dropping a tiny standalone "Taxes" node between Net Income and Fuel
    // (which forces d3-sankey to route a red ribbon across the cogs→fuel flow).
    const belowOp = Math.max(0, op - np);
    if (belowOp > 0) {
      addNode({ id: "below", name: "Tax & Non-Op", displayValue: fmt(belowOp, unit), color: "#A06070" });
      addLink({ source: "op", target: "below", value: belowOp, color: "#A06070" });
    }
  } else {
    if (tx > 0 && !lossHandled) {
      addNode({ id: "tax", name: "Taxes", displayValue: fmt(tx, unit), color: C_TAX });
      addLink({ source: "op", target: "tax", value: tx  * opK, color: C_TAX });
    }
    if (inv > 0 && !lossHandled) {
      addNode({ id: "inv", name: "Investments", displayValue: fmt(inv, unit), color: C_INV });
      addLink({ source: "op", target: "inv", value: inv * opK, color: C_INV });
    }
    // Below-the-line: when np + tx + inv < op (op income gets eaten by non-
    // operating items before reaching NI), the rendered children leave op
    // partially unconsumed unless we surface the gap as outflows.
    //
    // The data pipeline already extracts the actual components into
    // `nonOpBreakdown` (fetchSegmentData.ts:697-703) — interestIncome,
    // interestExpense, gainLossOnSale — and other branches (pre-revenue:248,
    // REIT:427) already render Interest Exp. as a real child. The standard
    // branch was the only one ignoring the breakdown, so the gap appeared
    // as visual rectangle leakage instead of a labeled flow.
    //
    // Now we consume the breakdown in two passes:
    //  1) Net interest expense (interestExpense − interestIncome) → "Interest
    //     Exp." child, capped to the gap. For cash-rich issuers where
    //     intInc ≥ intExp (e.g. GOOGL), the netted value floors at 0 and the
    //     node is omitted, which is correct (no net interest drag).
    //  2) Any remaining gap (FX losses, equity-method losses, other non-op
    //     items not tagged in the breakdown) → fallback "Non-Op Exp." sink.
    //
    // SNPS Q1 FY2026: op $0.2B, np ≈ $50M, tax ≈ $20M, gross intExp ≈ $130M
    // from $10B Ansys-deal debt → Interest Exp. ($130M) closes the gap
    // exactly; "Non-Op Exp." doesn't fire.
    //
    // The gate is `op > 0` — NOT `op > 0 && np > 0`. When NI is negative or
    // tiny enough to round to 0 in scaled units (BA Q1 FY2026: NI = −$4M
    // against $22B revenue → sc(-4M / 1e9) = 0.00 → np clamps to 0, netLoss
    // also rounds to 0 so treatAsLoss doesn't fire), the np > 0 gate would
    // skip gap-filling and leave Op Income with only its tiny Tax ribbon
    // (Boeing's $448M op income → only $33M tax ribbon, ~7% of the op node's
    // height — visually a barely-visible sliver). Op Income's $616M was
    // actually consumed by InterestAndDebtExpense; rendering Interest Exp.
    // as the gap-fill child shows that flow honestly.
    if (op > 0 && !lossHandled) {
      const opGap = Math.max(0, op - (np + tx + inv));
      const intExpReported = Math.max(0, Number(nonOpBreakdown?.interestExpense) || 0);
      const intIncReported = Math.max(0, Number(nonOpBreakdown?.interestIncome)  || 0);
      const netIntExp = Math.max(0, intExpReported - intIncReported);
      const intExpVal = Math.min(netIntExp, opGap);
      if (intExpVal > op * 0.005) {
        addNode({ id: "intExp", name: "Interest Exp.", displayValue: fmt(intExpVal, unit), color: "#C95A2C" });
        addLink({ source: "op", target: "intExp", value: intExpVal, color: "#C95A2C" });
      }
      const residualGap = opGap - intExpVal;
      if (residualGap > op * 0.005) {
        addNode({ id: "below", name: "Non-Op Exp.", displayValue: fmt(residualGap, unit), color: "#A06070" });
        addLink({ source: "op", target: "below", value: residualGap, color: "#A06070" });
      }
    }
  }

  // Skip when in loss-period mode: there is no "opex" parent node — the cost
  // breakdown was already wired directly under "tc" (Total Costs).
  if (opexBreakdown && opex > 0 && !lossHandled) {
    const rd    = Number(opexBreakdown.rd)             || 0;
    const sm    = Number(opexBreakdown.salesMarketing)  || 0;
    const ga    = Number(opexBreakdown.generalAdmin)    || 0;
    const ot    = Number(opexBreakdown.other)           || 0;
    const fuel  = Number(opexBreakdown.fuel)            || 0;
    const labor = Number(opexBreakdown.salariesWages)   || 0;
    const maint = Number(opexBreakdown.maintenance)     || 0;
    const rent  = Number(opexBreakdown.rentAndLanding)  || 0;
    const dep   = Number(opexBreakdown.depreciation)    || 0;
    const sbc        = Number(opexBreakdown.stockBasedComp) || 0;
    const impair     = Number(opexBreakdown.impairment)     || 0;
    const restruct   = Number(opexBreakdown.restructuring)  || 0;
    // Oil & gas-specific lines. `purchases` is the residual (crude/product
    // purchases + production & manufacturing) that absorbs whatever isn't
    // tagged as D&A / SG&A / Other Taxes / Exploration.
    const taxesOther    = Number(opexBreakdown.taxesOther)  || 0;
    const exploration   = Number(opexBreakdown.exploration) || 0;
    const purchases     = Number(opexBreakdown.purchases)   || 0;
    // Standard-profile sub-buckets — surfaced when the issuer breaks out
    // payroll / rent / advertising / D&A as separate IS lines that reconcile
    // to OperatingExpenses. RYOJ-style foreign issuers use this shape.
    const payroll      = Number(opexBreakdown.payroll)              || 0;
    const rentExp      = Number(opexBreakdown.rentExpense)          || 0;
    const advertising  = Number(opexBreakdown.advertising)          || 0;
    const depStd       = Number(opexBreakdown.depreciationStandard) || 0;
    const entries = [
      { id: "purchases", name: "Purchases & Prod.", displayValue: fmt(purchases, unit), value: purchases, color: "#A86040" },
      { id: "fuel",  name: "Fuel",             displayValue: fmt(fuel, unit), value: fuel, color: "#C95A2C" },
      { id: "labor", name: "Salaries & Wages", displayValue: fmt(labor, unit), value: labor, color: "#B5723A" },
      { id: "payroll", name: "Payroll",        displayValue: fmt(payroll, unit), value: payroll, color: "#B5723A" },
      { id: "maint", name: "Maintenance",      displayValue: fmt(maint, unit), value: maint, color: "#9D7A45" },
      { id: "rent",  name: "Rent & Landing",   displayValue: fmt(rent, unit), value: rent, color: "#8B7050" },
      { id: "rentE", name: "Rent",             displayValue: fmt(rentExp, unit), value: rentExp, color: "#8B7050" },
      { id: "dep",   name: "D&A",              displayValue: fmt(dep, unit), value: dep,  color: "#7A6E5A" },
      { id: "depStd",name: "D&A",              displayValue: fmt(depStd, unit), value: depStd, color: "#7A6E5A" },
      { id: "adv",   name: "Advertising",      displayValue: fmt(advertising, unit), value: advertising, color: "#A07050" },
      { id: "txOth", name: "Other Taxes",      displayValue: fmt(taxesOther, unit), value: taxesOther, color: "#9C5560" },
      { id: "explor",name: "Exploration",      displayValue: fmt(exploration, unit), value: exploration, color: "#856B4A" },
      { id: "rd",  name: "R&D",         displayValue: fmt(rd, unit), value: rd,  color: "#D06050" },
      { id: "sm",  name: "Sales & Mkt", displayValue: fmt(sm, unit), value: sm,  color: C_OPEX   },
      { id: "ga",  name: "G&A",         displayValue: fmt(ga, unit), value: ga,  color: "#B07030" },
      { id: "sbc",   name: "Stock Comp",     displayValue: fmt(sbc, unit),      value: sbc,      color: "#9B7C40" },
      { id: "impair",name: "Impairment",     displayValue: fmt(impair, unit),   value: impair,   color: "#C0707A" },
      { id: "restr", name: "Restructuring",  displayValue: fmt(restruct, unit), value: restruct, color: "#A06070" },
      { id: "ot",  name: "Other OpEx",  displayValue: fmt(ot, unit), value: ot,  color: "#C09050" },
    ];
    // Pick whichever cost-parent node exists. Issuers with a GP layer get
    // an "opex" node from the gp > 0 branch; airlines / no-GP issuers route
    // the breakdown through "cogs" (the "Op. Costs" intermediate from the
    // op > 0 branch above).
    const parentId = nodes.some((n) => n.id === "opex") ? "opex" : "cogs";
    // Reconcile the breakdown buckets to sum exactly to the parent's
    // upstream link value. Without this the parent node ends up with
    // sum(in) ≠ sum(out); d3-sankey sizes the bar to max(in, out) and the
    // smaller side leaves visible empty space — the trace doesn't line up
    // with the node's start/end. Handle both directions:
    //   • gap > 0 (outflows fall short): pad with a residual sibling.
    //       - standard (AAPL): parser missed CostOfRevenue → "Cost of Rev."
    //       - services (V, MA): no CoGS exists → "Other OpEx" so it doesn't
    //         imply a Cost of Goods Sold that isn't there.
    //   • gap < 0 (outflows overshoot): shrink the largest bucket. Common
    //     when the reported op tag includes items (e.g., equity-affiliate
    //     income for integrated oil majors) so rev − op underestimates the
    //     tagged cost stack by a small amount. The residual bucket
    //     ("Purchases & Prod" for oil-gas, the largest opex line otherwise)
    //     absorbs the overflow, displayed value preserved.
    {
      const parentVal = parentId === "opex"
        ? (opLoss > 0 ? Math.min(gp, opex) : opex)
        : (rev - op);
      const breakdownSum = entries.reduce(
        (s, e) => s + (e.value > 0 ? e.value : 0),
        0,
      );
      const gap = parentVal - breakdownSum;
      const RECONCILE_THRESHOLD = 0.005; // 0.5%
      if (parentVal > 0 && gap > parentVal * RECONCILE_THRESHOLD) {
        const isServices = industryProfile === "services";
        entries.unshift({
          id: isServices ? "otherOpex" : "cor",
          name: isServices ? "Other OpEx" : "Cost of Rev.",
          displayValue: fmt(gap, unit),
          value: gap,
          color: isServices ? "#C09050" : C_COGS,
        });
      } else if (parentVal > 0 && -gap > parentVal * RECONCILE_THRESHOLD) {
        const overflow = -gap;
        let largest: typeof entries[number] | undefined;
        for (const e of entries) {
          if (e.value > 0 && (!largest || e.value > largest.value)) largest = e;
        }
        if (largest && largest.value > overflow) {
          largest.value -= overflow;
        }
      }
    }
    entries.forEach(({ id, name, displayValue, value, color }) => {
      if (value <= 0) return;
      addNode({ id, name, displayValue, color });
      addLink({ source: parentId, target: id, value, color });
    });
  }

  } // end if (!customProfileBuilt)

  if (nodes.length < 3 || links.length < 2) return null;

  // ── Run d3-sankey layout ───────────────────────────────────────────────────
  const VH = Math.max(550, displaySegs.length * 70 + 250);

  // Loss-period layout uses sankeyJustify so all cost sinks (CoGS, R&D, G&A,
  // OpEx items) line up at the last column instead of getting scattered across
  // intermediate columns by their topology depth. Net Loss is forced into the
  // same column as Revenue so the two source-side nodes stack vertically.
  // Loss-period: Net Loss + Non-Op Income are sources (depth 0) so by default
  // sankeyJustify would put them next to segments at column 0. Force them into
  // Revenue's column so the source-side stacks vertically. The structural
  // Revenue→Op.Costs link added during loss-handler construction takes care of
  // pushing tc and downstream sinks into their own columns.
  const baseCol = displaySegs.length > 0 ? 1 : 0;
  const lossAware = (node: SNode, n: number) =>
    node.id === "loss" || node.id === "nonop"
      ? baseCol
      : sankeyJustify(node, n);

  // Standard-profile column ordering. d3-sankey's barycentric relaxation can
  // place Op. Income above Op. Expenses, then route the op→tax ribbon to the
  // middle of the rightmost column where it visually crosses the opex→bucket
  // ribbons (BABA Q3 FY26 case). Pin a deterministic top→bottom order so:
  //   • Col 2 stack:   cogs, gp, opex, op  (op at bottom)
  //   • Col 3 stack:   rd, sm, ga, sbc, impair, restr, payroll, rentE, adv,
  //                    depStd, txOth, explor, ot     (children of opex, top)
  //                    np, intExp, tax, inv, below   (children of op, bottom)
  // Tax stays at the bottom of its column where its inflow ribbon (op→tax)
  // can travel the short bottom band without crossing any opex bucket ribbon.
  // intExp slots between np and tax: NI (green) at top of op's children for
  // visual continuity with the largest op→child ribbon, then the red non-op
  // ribbons (intExp, tax) flow underneath without crossing.
  const standardOrder = [
    "revenue", "loss", "nonop",
    "cogs", "gp", "opex", "op",
    "rd", "sm", "ga",
    "sbc", "impair", "restr",
    "payroll", "rentE", "adv", "depStd",
    "txOth", "explor",
    "ot",
    "np", "intExp", "tax", "inv", "below",
  ];
  const standardSort = (a: SNode, b: SNode) => {
    const ai = standardOrder.indexOf(a.id);
    const bi = standardOrder.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  };

  // Bank profile col-2 ordering. Without this, d3-sankey leaves the small
  // residual nodes (otherBank, provision) at the top and pushes the dominant
  // nonExp into the middle of the column. nonExp non-top means its label
  // renders BELOW its rect (y1 + LABEL_GAP) and lands directly on the next
  // node down (tax) because PAD=6 leaves no room. Pin nonExp at the top so
  // its label uses the empty TOP_PAD area; sinks below get right-side labels
  // (handled in the render path).
  const bankOrder = ["revenue", "nonExp", "provision", "otherBank", "tax", "np"];
  const bankSort = (a: SNode, b: SNode) => {
    const ai = bankOrder.indexOf(a.id);
    const bi = bankOrder.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  };

  // Airline-mode column ordering. The col-3 sinks are pinned in this order:
  //   • cost buckets first (TOP — children of Op. Costs)
  //   • tax + np/below at the END (BOTTOM — children of Op. Income)
  // Op. Income is pinned BELOW Op. Costs in col 2 to match: that way the
  // op→np ribbon stays in the bottom band and the cogs→bucket ribbons stay
  // in the top band, no crossing. Earlier versions did the opposite (op on
  // top, np on bottom) which produced a long diagonal ribbon traversing
  // every cost-bucket flow — the LTM Q4 2025 case the user flagged.
  //
  // Within the np/below tail, the BIGGER op-outflow goes first (closer to
  // op). Profitable periods → np first; loss/marginal-profit periods (VLRS
  // Q4 2025: NI=$4M, Tax+Non-Op=$96M) flip so "below" sits adjacent to op.
  const npAndBelow = np >= Math.max(0, op - np)
    ? ["np", "below"]
    : ["below", "np"];
  const airlineRightCol = [
    "revenue", "loss",
    "cogs", "tc", "op",
    "purchases", "fuel", "labor", "maint", "rent", "dep",
    "txOth", "explor", "sm", "ga", "rd", "ot",
    "tax",
    ...npAndBelow,
  ];
  const airlineSort = (a: SNode, b: SNode) => {
    const ai = airlineRightCol.indexOf(a.id);
    const bi = airlineRightCol.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  };

  // SEG_LEFT (200px) reserves room for segment labels drawn to the LEFT of the
  // column-0 segment bars. When no segment nodes were emitted (e.g. SKBL-style
  // single-segment ≥99% revenue rolled into "Other", or any ticker where all
  // three parsers fail to produce a breakdown), Revenue itself sits at column 0
  // and its label renders ABOVE the bar, so the 200px reservation becomes
  // visible dead space to the left of Revenue. Shrink the left margin in that
  // case so Revenue isn't suspended in empty canvas.
  const layoutLeft = displaySegs.length > 0 ? SEG_LEFT : 40;
  const layout = d3Sankey<SNode, SLink>()
    .nodeId((n) => n.id)
    .nodeAlign(lossHandled ? lossAware : sankeyCenter)
    .nodeWidth(NODE_W)
    .nodePadding(PAD)
    // Leave 70 SVG units at the bottom so BELOW-node labels have room.
    .extent([[layoutLeft, TOP_PAD], [VW - 180, VH - 70]]);
  if (airlineNoGp) layout.nodeSort(airlineSort);
  else if (industryProfile === "bank") layout.nodeSort(bankSort);
  else if (!customProfileBuilt && !lossHandled) layout.nodeSort(standardSort);

  const graph = layout({ nodes: nodes.map(n => ({ ...n })), links: links.map(l => ({ ...l })) });

  // Airline-mode safety: d3-sankey's barycentric relaxation can still place
  // Op. Income above Op. Costs (the bulk flow pulls Op. Income up because
  // its tiny np/below children get sorted toward the middle by default).
  // We need op BELOW cogs so its children (np, tax, below — pinned to the
  // bottom of col-3 by airlineRightCol) flow in a straight bottom band
  // instead of cutting diagonally across the cost-bucket ribbons.
  // LTM Q4 2025 case the user flagged: rev $3.9B, op $0.6B, NI $0.5B —
  // d3 default put op at top, NI at bottom → the op→NI ribbon sliced
  // diagonally across the entire chart.
  // Force op below cogs by swapping y-coords AND re-running
  // computeLinkBreadths so every ribbon anchored on rev/op/cogs picks up
  // the new vertical order. Tolerance on x0 accounts for sub-pixel rounding
  // when the columns share an x.
  // Airline-mode prior: force op below cogs when d3 placed op on top.
  // The generic minimizer below would catch this too (the swap reduces
  // crossings), but the explicit prior is faster and battle-tested. The
  // minimizer can never *undo* it because reverting would strictly
  // increase the crossing score, which fails its accept condition.
  if (airlineNoGp) {
    type DNodeAir = SNode & { sourceLinks?: SLink[]; targetLinks?: SLink[] };
    const airNodes = graph.nodes as DNodeAir[];
    const opNode   = airNodes.find((n) => n.id === "op");
    const cogsNode = airNodes.find((n) => n.id === "cogs");
    if (opNode && cogsNode
        && Math.abs((opNode.x0 ?? 0) - (cogsNode.x0 ?? 0)) < 1
        && (opNode.y0 ?? 0) < (cogsNode.y0 ?? 0)) {
      const opH    = (opNode.y1 ?? 0) - (opNode.y0 ?? 0);
      const cogsH  = (cogsNode.y1 ?? 0) - (cogsNode.y0 ?? 0);
      const topY   = Math.min(opNode.y0 ?? 0, cogsNode.y0 ?? 0);
      const botY   = Math.max(opNode.y1 ?? 0, cogsNode.y1 ?? 0);
      const gap    = Math.max(0, (botY - topY) - opH - cogsH);
      cogsNode.y0 = topY;
      cogsNode.y1 = topY + cogsH;
      opNode.y0   = topY + cogsH + gap;
      opNode.y1   = opNode.y0 + opH;
      for (const n of airNodes) {
        if (n.sourceLinks) {
          n.sourceLinks.sort((a, b) => {
            const ay = (a.target as DNodeAir).y0 ?? 0;
            const by = (b.target as DNodeAir).y0 ?? 0;
            return ay - by;
          });
        }
        if (n.targetLinks) {
          n.targetLinks.sort((a, b) => {
            const ay = (a.source as DNodeAir).y0 ?? 0;
            const by = (b.source as DNodeAir).y0 ?? 0;
            return ay - by;
          });
        }
      }
      for (const n of airNodes) {
        let yOut = n.y0 ?? 0;
        for (const lk of n.sourceLinks ?? []) {
          const w = lk.width ?? 0;
          lk.y0 = yOut + w / 2;
          yOut += w;
        }
        let yIn = n.y0 ?? 0;
        for (const lk of n.targetLinks ?? []) {
          const w = lk.width ?? 0;
          lk.y1 = yIn + w / 2;
          yIn += w;
        }
      }
    }
  }

  // Generic post-layout crossing minimizer.
  //
  // d3-sankey's barycentric relaxation is a *heuristic* — for non-trivial
  // graphs (multiple sinks, asymmetric magnitudes, structural back-edges from
  // our loss/airline hacks) it can leave residual ribbon crossings. The
  // semantic priors above (standardSort / airlineSort / loss-aware nodeAlign
  // / the airline op-cogs swap) handle the predictable cases, but they can't
  // anticipate every issuer — pre-revenue biotechs with odd opex shapes,
  // REITs with non-trivial NOI flow, banks with provision branches that
  // cross noninterest income, etc.
  //
  // This pass enumerates per-column node permutations and accepts a swap
  // only when it *strictly* reduces a weighted crossing score. Score weights
  // by ribbon width², so eliminating a crossing of two big ribbons matters
  // more than fixing two thin ones. Strict-decrease guarantees the pass can
  // never make the chart worse — at worst it's a no-op.
  type DNode = SNode & { sourceLinks?: SLink[]; targetLinks?: SLink[] };
  const dnodes = graph.nodes as DNode[];
  const dlinks = graph.links as SLink[];

  // Reorder a node's source/target links by partner y0, then recompute
  // each link's y0 (source side) / y1 (target side) from the stacking order.
  // Mirrors d3-sankey's internal reorderLinks + computeLinkBreadths so the
  // ribbon endpoints follow the new vertical node order.
  function recomputeLinkY() {
    for (const n of dnodes) {
      if (n.sourceLinks) {
        n.sourceLinks.sort((a, b) => {
          const ay = (a.target as DNode).y0 ?? 0;
          const by = (b.target as DNode).y0 ?? 0;
          return ay - by;
        });
      }
      if (n.targetLinks) {
        n.targetLinks.sort((a, b) => {
          const ay = (a.source as DNode).y0 ?? 0;
          const by = (b.source as DNode).y0 ?? 0;
          return ay - by;
        });
      }
    }
    for (const n of dnodes) {
      let yOut = n.y0 ?? 0;
      for (const lk of n.sourceLinks ?? []) {
        const w = lk.width ?? 0;
        lk.y0 = yOut + w / 2;
        yOut += w;
      }
      let yIn = n.y0 ?? 0;
      for (const lk of n.targetLinks ?? []) {
        const w = lk.width ?? 0;
        lk.y1 = yIn + w / 2;
        yIn += w;
      }
    }
  }

  // Group nodes by column (rounded x0). Capture each column's original
  // [top, bottom] extent so re-stacking after a reorder preserves the
  // visual envelope — we never grow or shrink a column's vertical reach,
  // which keeps labels and adjacent columns where they were.
  const colsMap = new Map<number, DNode[]>();
  for (const n of dnodes) {
    const key = Math.round(n.x0 ?? 0);
    if (!colsMap.has(key)) colsMap.set(key, []);
    colsMap.get(key)!.push(n);
  }
  const colExtent = new Map<number, { top: number; bottom: number }>();
  for (const [key, col] of colsMap) {
    col.sort((a, b) => (a.y0 ?? 0) - (b.y0 ?? 0));
    colExtent.set(key, {
      top: Math.min(...col.map((n) => n.y0 ?? 0)),
      bottom: Math.max(...col.map((n) => n.y1 ?? 0)),
    });
  }

  // Re-stack a column from its in-array order, top-to-bottom, distributing
  // any slack between nodes evenly (≥ PAD between adjacent nodes).
  function restack(col: DNode[], top: number, bottom: number) {
    if (col.length === 0) return;
    const heights = col.map((n) => (n.y1 ?? 0) - (n.y0 ?? 0));
    const totalH  = heights.reduce((s, h) => s + h, 0);
    const span    = bottom - top;
    const slack   = Math.max(0, span - totalH);
    const gap     = col.length > 1 ? Math.max(PAD, slack / (col.length - 1)) : 0;
    let y = top;
    for (let i = 0; i < col.length; i++) {
      col[i].y0 = y;
      col[i].y1 = y + heights[i];
      y = y + heights[i] + gap;
    }
  }

  // Weighted crossing score. Two links cross iff the order of their source
  // y-coords differs from the order of their target y-coords. Skip pairs
  // whose x-spans are disjoint (a link entirely to the left of another
  // can't physically cross it). Skip near-zero-width links — those are
  // structural-only padding ribbons (e.g. invisible Revenue→Op.Costs) and
  // counting their crossings would chase ghosts.
  const W_MIN = 0.5;
  function crossingScore(): number {
    let score = 0;
    for (let i = 0; i < dlinks.length; i++) {
      const li = dlinks[i];
      const wi = li.width ?? 0;
      if (wi < W_MIN) continue;
      const si = li.source as DNode;
      const ti = li.target as DNode;
      const xi0 = si.x1 ?? 0;
      const xi1 = ti.x0 ?? 0;
      const yi0 = li.y0 ?? 0;
      const yi1 = li.y1 ?? 0;
      for (let j = i + 1; j < dlinks.length; j++) {
        const lj = dlinks[j];
        const wj = lj.width ?? 0;
        if (wj < W_MIN) continue;
        const sj = lj.source as DNode;
        const tj = lj.target as DNode;
        const xj0 = sj.x1 ?? 0;
        const xj1 = tj.x0 ?? 0;
        // Disjoint x-spans → can't cross.
        if (xi1 <= xj0 || xj1 <= xi0) continue;
        const yj0 = lj.y0 ?? 0;
        const yj1 = lj.y1 ?? 0;
        if ((yi0 - yj0) * (yi1 - yj1) < 0) {
          score += wi * wj;
        }
      }
    }
    return score;
  }

  // Save current layout (snapshot of node y's + link y0/y1) so we can
  // revert if a trial swap doesn't improve.
  type Snapshot = { nY: Map<DNode, [number, number]>; lY: Map<SLink, [number, number]> };
  function snap(): Snapshot {
    const nY = new Map<DNode, [number, number]>();
    for (const n of dnodes) nY.set(n, [n.y0 ?? 0, n.y1 ?? 0]);
    const lY = new Map<SLink, [number, number]>();
    for (const l of dlinks) lY.set(l, [l.y0 ?? 0, l.y1 ?? 0]);
    return { nY, lY };
  }
  function restore(s: Snapshot) {
    for (const [n, [y0, y1]] of s.nY) { n.y0 = y0; n.y1 = y1; }
    for (const [l, [y0, y1]] of s.lY) { l.y0 = y0; l.y1 = y1; }
    // Re-sort link arrays so subsequent passes start from a consistent state.
    recomputeLinkY();
  }

  // Iteratively try every pair-swap within every column. Accept only if
  // the weighted crossing score *strictly* decreases. Repeat until a full
  // pass yields no improvement. Iter cap is a defensive upper bound — in
  // practice the loop converges in 1–3 passes on real data.
  let baseScore = crossingScore();
  const colKeys = [...colsMap.keys()].sort((a, b) => a - b);
  for (let iter = 0; iter < 12 && baseScore > 0; iter++) {
    let improved = false;
    for (const key of colKeys) {
      const col = colsMap.get(key)!;
      if (col.length < 2) continue;
      const ext = colExtent.get(key)!;
      for (let i = 0; i < col.length - 1; i++) {
        for (let j = i + 1; j < col.length; j++) {
          const before = snap();
          [col[i], col[j]] = [col[j], col[i]];
          restack(col, ext.top, ext.bottom);
          recomputeLinkY();
          const after = crossingScore();
          if (after < baseScore) {
            baseScore = after;
            improved = true;
          } else {
            // Revert: swap back, restore y's, restack to original order.
            [col[i], col[j]] = [col[j], col[i]];
            restore(before);
            restack(col, ext.top, ext.bottom);
            recomputeLinkY();
          }
        }
      }
    }
    if (!improved) break;
  }

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
  // Loss-period exception: the "Op. Costs" intermediate (tc) sits in its own
  // column with straight-through ribbons (Revenue→CoGS, Loss→CoGS) crossing
  // ABOVE it. Force its label BELOW so it doesn't land on top of a ribbon.
  // Doesn't affect non-loss charts where tc never exists.
  colTopId.delete("tc");

  // ── Render helpers ─────────────────────────────────────────────────────────
  const LINE_H = 20;
  const LABEL_GAP = 8; // gap between label block bottom and node top

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
  // Same collapse-to-single-line logic as segments when nodes are thin.
  // Nodes with `lh < LABEL_MIN_H` don't render a label (see `showLabel` in
  // the renderer), so they must NOT advance `prevBottom` — otherwise their
  // phantom label space cascades down and pushes the next visible label past
  // its own rect (Citi: 3 sub-$0.5B noninterest sinks between Tech & Comm.
  // and Other made "Other" land below its own bar).
  const LABEL_MIN_H = 12;
  interface LastColState { topY: number; singleLine: boolean; showSub: boolean; }
  const lastColLabelState = new Map<string, LastColState>();
  {
    const sorted = (graph.nodes as SNode[])
      .filter(n => Math.round(n.x0 ?? 0) === lastColX)
      .sort((a, b) => (a.y0 ?? 0) - (b.y0 ?? 0));
    let prevBottom = -Infinity;
    for (const ln of sorted) {
      const lh       = Math.max(1, (ln.y1 ?? 0) - (ln.y0 ?? 0));
      if (lh < LABEL_MIN_H) continue;
      const lcy      = (ln.y0 ?? 0) + lh / 2;
      const singleLine = lh < 1.5 * LINE_H;
      const showSub    = !singleLine && lh >= 2.5 * LINE_H && !!ln.subLabel;
      const nl         = singleLine ? 1 : 1 + (ln.displayValue ? 1 : 0) + (showSub ? 1 : 0);
      let ty = lcy - (nl * LINE_H) / 2;
      if (ty < prevBottom + 4) ty = prevBottom + 4;
      lastColLabelState.set(ln.id, { topY: ty, singleLine, showSub });
      prevBottom = ty + nl * LINE_H;
    }
  }

  // ── Pre-compute mid-col label positions (greedy push-down) ─────────────────
  // When a mid-column stacks multiple short nodes vertically (RYOJ FY2025: GP
  // node sits adjacent to the synthetic "Tax & Non-Op" source in the same
  // column), each non-top node's label sits BELOW its own rect — and without
  // anti-overlap they collide because the rects themselves are nearly touching.
  // Push each subsequent label down past the previous label's bottom; collapse
  // to a single line when the available gap is tighter than the multi-line block.
  // For pure-sink nodes (no outflow) where the room below is tighter than even
  // a single-line label, switch to RIGHT-side placement: the right edge of a
  // sink is empty (no outgoing ribbons) so the label sits in clear space
  // instead of overlapping the rect of the next node down (GS bank case where
  // tax sits between nonExp and np with PAD=6 leaving no room below).
  // Right-side mid-col labels share horizontal real estate with the next
  // column's rects. Find the nearest rect to the right of `n` whose y-band
  // overlaps `n`'s y-band; the renderer (RightSideMidColLabel) measures the
  // actual rendered text width post-render via getComputedTextLength and
  // degrades the label content if it would cross into the neighbor rect.
  // RIGHT_LABEL_MARGIN is a small visual buffer to keep the label and the
  // neighbor rect from touching at the pixel level.
  const RIGHT_LABEL_MARGIN = 6;
  function nearestRightRectX(n: SNode): number {
    const x1 = n.x1 ?? 0;
    const ny0 = n.y0 ?? 0;
    const ny1 = n.y1 ?? 0;
    // Slack matches the label band: a single-line right-side label sits at
    // n.cy ± LINE_H/2 and may extend past the rect's own height when the
    // rect is thinner than the label. Use LINE_H so any rect whose y-band
    // overlaps the label's vertical span counts as a neighbor.
    const slack = LINE_H;
    let best = Infinity;
    for (const o of graph.nodes as SNode[]) {
      if (o === n) continue;
      const ox0 = o.x0 ?? 0;
      if (ox0 <= x1) continue;
      const oy0 = o.y0 ?? 0;
      const oy1 = o.y1 ?? 0;
      if (oy1 < ny0 - slack || oy0 > ny1 + slack) continue;
      if (ox0 < best) best = ox0;
    }
    // Fallback: if no rect is in the label's y-band (rare — happens when
    // last-col rects are positioned outside the slack window), still cap at
    // the last column's left edge. A mid-col label should never cross into
    // the last column's horizontal lane, regardless of whether a specific
    // rect lies in its y-row — ribbons and other visual elements live in
    // that lane and the label would clutter the destination side of the
    // chart. WFC case: provision's nearest neighbor at exact y-band could
    // be far enough away that slack doesn't catch it, but lastColX is
    // always a valid hard cap.
    if (best === Infinity && Number.isFinite(lastColX) && lastColX > x1) {
      best = lastColX;
    }
    return best;
  }

  // True if any link's ribbon passes through the label's y-band somewhere
  // in [rx, rx + estimatedWidth]. Right-side mid-col labels live in the
  // inter-column lane that is mostly filled with outgoing ribbons from
  // upstream nodes (e.g. nonExp → its children in bank profile). Even when
  // the label fits horizontally between rects, it can still cross through
  // a ribbon, which the eye reads as overlap. This check lets us suppress
  // the label entirely in that case.
  //
  // Approach: for each link whose horizontal x-range covers any sample x,
  // linearly interpolate the link's y center between source and target,
  // expand by ±link.width/2, and test for y-band overlap with the label.
  // d3-sankey ribbons are smooth Bézier curves but the linear interpolation
  // is a tight enough approximation in the middle of the span (the curves
  // ease at the endpoints, not the middle).
  function ribbonBlocksLabel(rx: number, cy: number, endX: number): boolean {
    const labelTop = cy - LINE_H / 2;
    const labelBot = cy + LINE_H / 2;
    // Sample at multiple x positions across the label's projected span so
    // we catch ribbons that cross diagonally even if they don't sit at the
    // label's start/end.
    const samples: number[] = [];
    const step = Math.max(20, (endX - rx) / 6);
    for (let xp = rx; xp <= endX; xp += step) samples.push(xp);
    if (samples[samples.length - 1] !== endX) samples.push(endX);
    for (const link of graph.links) {
      const src = link.source as SNode;
      const tgt = link.target as SNode;
      const srcX1 = src.x1 ?? 0;
      const tgtX0 = tgt.x0 ?? 0;
      if (tgtX0 <= srcX1) continue;
      const linkY0 = link.y0 ?? 0; // ribbon center y at source side
      const linkY1 = link.y1 ?? 0; // ribbon center y at target side
      const lw     = link.width ?? 0;
      if (lw <= 0) continue;
      for (const xp of samples) {
        if (xp < srcX1 || xp > tgtX0) continue;
        const t  = (xp - srcX1) / (tgtX0 - srcX1);
        const ly = linkY0 + (linkY1 - linkY0) * t;
        const linkTop = ly - lw / 2;
        const linkBot = ly + lw / 2;
        if (linkBot >= labelTop && linkTop <= labelBot) return true;
      }
    }
    return false;
  }

  // ── Pre-compute mid-col label positions (greedy push-down) ─────────────────
  // When a mid-column stacks multiple short nodes vertically (RYOJ FY2025: GP
  // node sits adjacent to the synthetic "Tax & Non-Op" source in the same
  // column), each non-top node's label sits BELOW its own rect — and without
  // anti-overlap they collide because the rects themselves are nearly touching.
  // Push each subsequent label down past the previous label's bottom; collapse
  // to a single line when the available gap is tighter than the multi-line block.
  // For pure-sink nodes (no outflow) where the room below is tighter than even
  // a single-line label, switch to RIGHT-side placement: the right edge of a
  // sink is empty (no outgoing ribbons) so the label sits in clear space
  // instead of overlapping the rect of the next node down (GS bank case where
  // tax sits between nonExp and np with PAD=6 leaving no room below).
  interface MidColState { topY: number; nLines: number; showSub: boolean; singleLine: boolean; side: "above" | "below" | "right"; maxRightX?: number; ribbonBlocked?: boolean }
  const midColLabelState = new Map<string, MidColState>();
  {
    for (const [colX, colNodes] of byCol) {
      if (colX === 0 || colX === lastColX) continue;
      if (colNodes.length < 2) continue;
      const sorted = [...colNodes].sort((a, b) => (a.y0 ?? 0) - (b.y0 ?? 0));
      let prevBottom = -Infinity;
      for (let i = 0; i < sorted.length; i++) {
        const n  = sorted[i];
        const y0 = n.y0 ?? 0;
        const y1 = n.y1 ?? 0;
        const h  = Math.max(1, y1 - y0);
        if (h < LABEL_MIN_H) continue;
        const isTop   = i === 0 && colTopId.has(n.id);
        const showSub = h >= 60 && !!n.subLabel;
        const nLinesFull = 1 + (n.displayValue ? 1 : 0) + (showSub ? 1 : 0);
        if (isTop) {
          const topY = y0 - LABEL_GAP - nLinesFull * LINE_H;
          midColLabelState.set(n.id, { topY, nLines: nLinesFull, showSub, singleLine: false, side: "above" });
          // Top label lives ABOVE the column; doesn't constrain push-down chain.
          prevBottom = -Infinity;
          continue;
        }
        // Non-top: label below own node, but never above prev label's bottom.
        let topY = y1 + LABEL_GAP;
        if (topY < prevBottom + 4) topY = prevBottom + 4;
        // If pushed far below own node, drop subLabel first; if still tight,
        // collapse to single-line to keep labels readable without spilling
        // visually past the next node down.
        const nextTop = i + 1 < sorted.length ? (sorted[i + 1].y0 ?? Infinity) : Infinity;
        const room = nextTop - topY;
        let nLines = nLinesFull;
        let singleLine = false;
        let finalShowSub = showSub;
        if (room < nLines * LINE_H) {
          finalShowSub = false;
          nLines = 1 + (n.displayValue ? 1 : 0);
        }
        if (room < nLines * LINE_H) {
          singleLine = true;
          nLines = 1;
        }
        // If even the single-line block won't fit below the node without
        // landing on the next node's rect, and this node is a pure sink (no
        // outgoing ribbon to the right), switch to RIGHT-side placement.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const outCount = ((n as any).sourceLinks?.length ?? 0) as number;
        if (room < nLines * LINE_H && outCount === 0) {
          const cy = y0 + h / 2;
          const rightSingle = h < 1.5 * LINE_H;
          const rightShowSub = !rightSingle && h >= 2.5 * LINE_H && !!n.subLabel;
          const rightLines   = rightSingle ? 1 : 1 + (n.displayValue ? 1 : 0) + (rightShowSub ? 1 : 0);
          const rightTopY    = cy - (rightLines * LINE_H) / 2;
          // Cap horizontally at the nearest right-side rect (with margin) so
          // tightly-packed downstream nodes (small last-col residuals at
          // overlapping y) don't get clipped or visually touched.
          const neighborX = nearestRightRectX(n);
          const maxRightX = neighborX - RIGHT_LABEL_MARGIN;
          // Check whether ANY ribbon crosses the label's projected band.
          // If a ribbon overlaps, the label would visually sit on top of
          // it (reading as collision) — suppress the label entirely in
          // that case rather than show a clean-but-occluded label.
          const rxProj    = (n.x1 ?? 0) + 10;
          const cyProj    = y0 + h / 2;
          const endXProj  = Number.isFinite(maxRightX) ? maxRightX : (n.x1 ?? 0) + 200;
          const ribbonBlocked = ribbonBlocksLabel(rxProj, cyProj, endXProj);
          midColLabelState.set(n.id, {
            topY: rightTopY,
            nLines: rightLines,
            showSub: rightShowSub,
            singleLine: rightSingle,
            side: "right",
            maxRightX: Number.isFinite(maxRightX) ? maxRightX : undefined,
            ribbonBlocked,
          });
          // Right-side labels live next to the node, not in the below-stack:
          // don't update prevBottom so subsequent below-labels in the chain
          // are not pushed further down by labels that aren't even there.
          continue;
        }
        midColLabelState.set(n.id, { topY, nLines, showSub: finalShowSub, singleLine, side: "below" });
        prevBottom = topY + nLines * LINE_H;
      }
    }
  }

  // ── Pre-compute segment (left-column) label positions ────────────────────
  // Same greedy top-to-bottom push. For thin nodes collapse to a single line
  // ("Name · $value") so labels never overlap.
  interface SegState { topY: number; singleLine: boolean; showSub: boolean; }
  const segLabelState = new Map<string, SegState>();
  {
    const sorted = (graph.nodes as SNode[])
      .filter(n => segNodeIds.has(n.id))
      .sort((a, b) => (a.y0 ?? 0) - (b.y0 ?? 0));
    let prevBottom = -Infinity;
    for (const sn of sorted) {
      const lh       = Math.max(1, (sn.y1 ?? 0) - (sn.y0 ?? 0));
      if (lh < LABEL_MIN_H) continue;
      const lcy      = (sn.y0 ?? 0) + lh / 2;
      const singleLine = lh < 1.5 * LINE_H;
      const showSub    = !singleLine && lh >= 2.5 * LINE_H && !!sn.subLabel;
      const nl         = singleLine ? 1 : 1 + (sn.displayValue ? 1 : 0) + (showSub ? 1 : 0);
      let ty = lcy - (nl * LINE_H) / 2;
      if (ty < prevBottom + 4) ty = prevBottom + 4;
      segLabelState.set(sn.id, { topY: ty, singleLine, showSub });
      prevBottom = ty + nl * LINE_H;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full rounded-xl border border-[#03065E]/10 bg-white py-3 px-1">
      <div className="text-xs font-semibold text-[#03065E] mb-2 px-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>{data.period} · Income Statement</span>
        {data.geographyOnly && data.segments.length > 0 && (
          <span className="font-normal text-[#707070]">· Revenue by region</span>
        )}
        {data.segmentPeriod && data.segments.length > 0 && data.segmentPeriod !== data.period && (
          <span className="font-normal text-[#707070]">· Segments: {data.segmentPeriod}</span>
        )}
        {/^FY\d{4}$/i.test(data.period ?? "") && (
          <span
            className="font-normal text-[#707070] italic"
            title="El emisor publica resultados trimestrales en formato no estructurado (slides / imágenes / press release sin tabla parseable). El reporte muestra el último período anual (20-F / 40-F / 10-K) que sí está en XBRL."
          >
            · trimestral no disponible
          </span>
        )}
        <span className="font-normal text-[#707070]">in {data.currency}</span>
      </div>

      <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`} className="w-full sm:max-h-[800px]" style={{ display: "block" }}>

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
          const showLabel = h >= LABEL_MIN_H;

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
                  const nameSz  = h >= 200 ? 16 : 13;
                  const valSz   = h >= 200 ? 14 : 11;
                  // Pre-computed greedy-stack state for cols where multiple
                  // non-top labels would collide (RYOJ-style). Falls through
                  // to the default above/below placement when only one node
                  // populates the column.
                  const mid = midColLabelState.get(n.id);
                  if (mid) {
                    if (mid.side === "right") {
                      // Pure sink with no room below: anchor label to the
                      // right of the rect. Width must not cross into the
                      // nearest right-side neighbor — measured post-render
                      // by RightSideMidColLabel.
                      // If a ribbon already covers the projected label band
                      // (e.g. nonExp → its children pass through provision's
                      // y in the bank profile), suppress the label entirely
                      // — the rect's color and height carry the row meaning.
                      if (mid.ribbonBlocked) return null;
                      const rx = x0 + NODE_W + 10;
                      const ty = mid.topY + LINE_H / 2;
                      // Key derived from inputs: when any change, the label
                      // remounts and re-measures from scratch instead of
                      // carrying over a stale degraded mode.
                      const lblKey = `${n.id}|${n.name}|${n.displayValue ?? ""}|${rx}|${mid.maxRightX ?? "inf"}`;
                      if (mid.singleLine) {
                        return [
                          <RightSideMidColLabel key={lblKey}
                            x={rx} y={ty} maxX={mid.maxRightX ?? Infinity}
                            name={n.name} value={n.displayValue} color={n.color} />,
                        ];
                      }
                      // Multi-line block (rect tall enough): also constrain
                      // each line. The block layout reuses LINE_H stacking
                      // and mirrors the singleLine fallback by hiding lines
                      // that would overflow.
                      return [
                        <RightSideMidColLabel key={lblKey}
                          x={rx} y={ty} maxX={mid.maxRightX ?? Infinity}
                          name={n.name} value={n.displayValue} color={n.color}
                          subLabel={mid.showSub ? n.subLabel : undefined}
                          stacked />,
                      ];
                    }
                    if (mid.singleLine) {
                      return [
                        <text key="sl" x={cx} y={mid.topY + LINE_H / 2}
                          fontSize={11} textAnchor="middle" dominantBaseline="middle">
                          <tspan fontWeight="800" fill={n.color}>{n.name}</tspan>
                          {n.displayValue && (
                            <tspan fontWeight="600" fill={n.color}>{"  " + n.displayValue}</tspan>
                          )}
                        </text>,
                      ];
                    }
                    return labelBlock(n, cx, mid.topY, "middle", nameSz, valSz, 10, n.color, n.color, mid.showSub);
                  }
                  const showSub = h >= 60;
                  const nLines  = 1 + (n.displayValue ? 1 : 0) + (n.subLabel && showSub ? 1 : 0);
                  const topY    = isTop
                    ? y0 - LABEL_GAP - nLines * LINE_H   // above the node
                    : y0 + h + LABEL_GAP;                  // below the node
                  return labelBlock(n, cx, topY, "middle", nameSz, valSz, 10, n.color, n.color, showSub);

                } else if (isSegment) {
                  // ── LEFT of node ──
                  const lx    = x0 - 10;
                  const state = segLabelState.get(n.id);
                  const topY  = state?.topY ?? (cy - LINE_H / 2);

                  if (state?.singleLine) {
                    // Collapse to one line; match weights of the multi-line case
                    // (name → 800, value → 600) using tspan
                    return [
                      <text key="sl" x={lx} y={topY + LINE_H / 2}
                        fontSize={10} textAnchor="end" dominantBaseline="middle">
                        <tspan fontWeight="800" fill="#111">{n.name}</tspan>
                        {n.displayValue && (
                          <tspan fontWeight="600" fill="#444">{"  " + n.displayValue}</tspan>
                        )}
                      </text>,
                    ];
                  }
                  return labelBlock(n, lx, topY, "end", 13, 11, 9, "#111", "#444", state?.showSub ?? true);

                } else {
                  // ── RIGHT of node (last column only) ──
                  // Use pre-computed topY that guarantees no vertical overlap.
                  const lx    = x1 + 10;
                  const state = lastColLabelState.get(n.id);
                  const topY  = state?.topY ?? (cy - LINE_H / 2);

                  if (state?.singleLine) {
                    return [
                      <text key="sl" x={lx} y={topY + LINE_H / 2}
                        fontSize={10} textAnchor="start" dominantBaseline="middle">
                        <tspan fontWeight="800" fill="#111">{n.name}</tspan>
                        {n.displayValue && (
                          <tspan fontWeight="600" fill="#444">{"  " + n.displayValue}</tspan>
                        )}
                      </text>,
                    ];
                  }
                  return labelBlock(n, lx, topY, "start", 13, 11, 9, "#111", "#444", state?.showSub ?? true);
                }
              })()}
            </g>
          );
        })}
      </svg>
      {data.source && (
        <div className="px-3 pt-1 text-[10px] text-[#707070] text-right">
          Fuente:{" "}
          {data.sourceUrl ? (
            <a
              href={data.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted hover:text-[#0a2540]"
            >
              SEC EDGAR · {data.source} ↗
            </a>
          ) : (
            data.source
          )}
        </div>
      )}
    </div>
  );
}

// ── Right-side mid-col label: full "Name  $value" or nothing ────────────────
// Mid-col sinks (provision/tax/otherBank in bank profile) live in a
// horizontal lane filled with ribbons. Renders the full "Name  $value" only
// when it fits cleanly in the available channel [x, maxX]; otherwise hides
// the label entirely (the rect itself remains and conveys the value via its
// height — better than a half-readable label that overlaps neighbors).
//
// One offscreen probe measures the full string post-render via SVG's
// getComputedTextLength so the decision uses real font metrics. SSR-safe
// initial state is "hidden" — first paint shows nothing, hydration reveals
// the label only if measurement confirms it fits. A brief flash of "no
// label" is acceptable; a flash of "overlapping label" is not.
function RightSideMidColLabel({
  x, y, maxX, name, value, color,
}: {
  x: number;
  y: number;
  maxX: number;
  name: string;
  value?: string;
  color: string;
  subLabel?: string;
  stacked?: boolean;
}) {
  const probeRef = useRef<SVGTextElement>(null);
  const [visible, setVisible] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    if (!Number.isFinite(maxX)) {
      // Unconstrained channel: always show.
      setVisible(true);
      return;
    }
    const w = probeRef.current?.getComputedTextLength() ?? Infinity;
    const FIT_BUFFER = 8; // visual gap to neighbor rect / ribbon edge
    setVisible(x + w + FIT_BUFFER <= maxX);
  }, [x, maxX, name, value]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Offscreen probe rendered always (when constraint exists) so the
  // measurement can run on every mount/update.
  const probe = Number.isFinite(maxX) ? (
    <text ref={probeRef} x={-99999} y={-99999}
      fontSize={11} aria-hidden="true" pointerEvents="none">
      <tspan fontWeight="800">{name}</tspan>
      {value && <tspan fontWeight="600">{"  " + value}</tspan>}
    </text>
  ) : null;

  if (!visible) return probe;

  return (
    <>
      {probe}
      <text x={x} y={y}
        fontSize={11} textAnchor="start" dominantBaseline="middle">
        <tspan fontWeight="800" fill={color}>{name}</tspan>
        {value && (
          <tspan fontWeight="600" fill={color}>{"  " + value}</tspan>
        )}
      </text>
    </>
  );
}
