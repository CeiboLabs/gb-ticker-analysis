// Estimaciones forward point-in-time vía Wayback Machine — la única pieza que
// no existe en ningún archivo estructurado gratis (el consenso forward vive en
// IBES/FactSet). finviz.com/quote.ashx es server-rendered, Wayback lo crawlea
// seguido, y su tabla trae: EPS next Y ($ estimado y % growth), Forward P/E,
// Target Price (medio de analistas), Insider/Inst Own.
//
// ANTI-FUGA: se usa el último snapshot ESTRICTAMENTE ≤ corte (CDX con to=)
// — nunca el "closest" bilateral. APROXIMACIÓN DECLARADA: el snapshot puede
// tener días o semanas de antigüedad (staleness registrada por fila y
// devuelta al caller); cobertura verificada ~70-85% del golden set con sesgo
// a large caps (JPM −29d del corte ene-25; ULCC sin snapshot pre-ene-25).
//
// Cache en disco (out/wayback-cache/) porque web.archive.org es lento (1-3s
// por request) y los snapshots son inmutables — la segunda corrida es gratis.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const CACHE_DIR = path.resolve(process.cwd(), "scripts/backtest/out/wayback-cache");
const UA = "gb-ticker-backtest/1.0 (research; contact: admin@localhost)";

export interface FinvizAsOf {
  snapshotDate: string;      // YYYY-MM-DD del snapshot usado
  stalenessDays: number;     // corte − snapshot
  epsNextY: number | null;         // estimación de consenso EPS próximo FY ($)
  epsNextYGrowthPct: number | null; // % growth próximo FY
  forwardPE: number | null;
  targetPrice: number | null;      // target medio de analistas
  insiderOwnPct: number | null;
  instOwnPct: number | null;
}

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

// Último timestamp de snapshot 200 ESTRICTAMENTE ≤ corte, vía CDX.
async function latestSnapshotTs(ticker: string, cutoff: string): Promise<string | null> {
  const to = cutoff.replace(/-/g, "");
  const url =
    `http://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(`finviz.com/quote.ashx?t=${ticker}`)}` +
    `&to=${to}&limit=-1&fl=timestamp&filter=statuscode:200`;
  const body = await fetchText(url, 20_000);
  if (!body) return null;
  const lines = body.trim().split("\n").filter((l) => /^\d{14}$/.test(l.trim()));
  const ts = lines.at(-1)?.trim() ?? null;
  // Cinturón anti-fuga: el timestamp DEBE ser ≤ corte.
  return ts && ts.slice(0, 8) <= to ? ts : null;
}

function parseNum(s: string | null): number | null {
  if (s == null) return null;
  const t = s.trim();
  if (!t || t === "-") return null;
  const m = t.match(/^-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

// La snapshot-table de finviz es label/valor en celdas alternadas. El markup
// cambió con los años (clases snapshot-td2 / js-snapshot-*): parser tolerante
// por REGEX de pares "<td...>Label</td><td...><b>Valor</b></td>" con fallback
// a texto plano entre celdas.
function extractField(html: string, label: string): string | null {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<td[^>]*>${esc}</td>\\s*<td[^>]*>(?:<b[^>]*>)?(?:<span[^>]*>)?([^<]+)`,
    "i",
  );
  return html.match(re)?.[1]?.trim() ?? null;
}

// "EPS next Y" aparece DOS veces (estimación $ y growth %): distinguimos por
// el sufijo % del valor.
function extractEpsNextY(html: string): { eps: number | null; growthPct: number | null } {
  const esc = "EPS next Y";
  const re = new RegExp(
    `<td[^>]*>${esc}</td>\\s*<td[^>]*>(?:<b[^>]*>)?(?:<span[^>]*>)?([^<]+)`,
    "gi",
  );
  let eps: number | null = null;
  let growthPct: number | null = null;
  for (const m of html.matchAll(re)) {
    const v = m[1].trim();
    if (v.endsWith("%")) growthPct = parseNum(v);
    else eps = parseNum(v);
  }
  return { eps, growthPct };
}

export async function finvizAsOf(ticker: string, cutoff: string): Promise<FinvizAsOf | null> {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    const tsCachePath = path.join(CACHE_DIR, `${ticker}-${cutoff}.ts.txt`);
    let ts: string | null = null;
    if (existsSync(tsCachePath)) {
      const cached = readFileSync(tsCachePath, "utf8").trim();
      ts = /^\d{14}$/.test(cached) ? cached : null; // "NONE" cacheado → null
      if (cached === "NONE") return null;
    } else {
      ts = await latestSnapshotTs(ticker, cutoff);
      writeFileSync(tsCachePath, ts ?? "NONE");
      if (!ts) return null;
    }
    if (!ts) return null;

    const htmlCachePath = path.join(CACHE_DIR, `${ticker}-${ts}.html`);
    let html: string;
    if (existsSync(htmlCachePath)) {
      html = readFileSync(htmlCachePath, "utf8");
    } else {
      // id_ = página original sin el chrome de Wayback (URLs intactas).
      const fetched = await fetchText(
        `https://web.archive.org/web/${ts}id_/https://finviz.com/quote.ashx?t=${ticker}`,
        30_000,
      );
      if (!fetched) return null;
      writeFileSync(htmlCachePath, fetched);
      html = fetched;
    }

    const snapshotDate = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
    const stalenessDays = Math.round((Date.parse(cutoff) - Date.parse(snapshotDate)) / 86400000);
    const { eps, growthPct } = extractEpsNextY(html);
    const pct = (label: string) => {
      const v = extractField(html, label);
      return v != null && v.endsWith("%") ? parseNum(v) : parseNum(v);
    };
    const out: FinvizAsOf = {
      snapshotDate,
      stalenessDays,
      epsNextY: eps,
      epsNextYGrowthPct: growthPct,
      forwardPE: parseNum(extractField(html, "Forward P/E")),
      targetPrice: parseNum(extractField(html, "Target Price")),
      insiderOwnPct: pct("Insider Own"),
      instOwnPct: pct("Inst Own"),
    };
    // Sin ningún campo útil (markup irreconocible) → null, no un objeto vacío.
    if (out.epsNextY == null && out.forwardPE == null && out.targetPrice == null) return null;
    return out;
  } catch {
    return null;
  }
}
