// Reconstrucción EDGAR point-in-time para el backtest — guidance, insiders
// (Form 4) y selección de filing para segmentos/IS, todo con frontera
// anti-fuga = FILING DATE ≤ corte (EDGAR es archivo histórico: lo que un
// inversor tenía ese día es exactamente lo publicado hasta ese día).
//
// PAGINACIÓN (el porqué de este módulo): submissions.recent de SEC trae sólo
// los ÚLTIMOS ~1000 filings. Para filers charlatanes (JPM emite cientos de
// 424B2 y Form 4 por año) eso cubre pocos MESES — un corte a 18 meses vista
// queda fuera de la ventana y el as-of devolvería vacío en silencio. Acá se
// combinan recent + las páginas históricas (filings.files) que intersecten la
// ventana [corte − 420 días, corte], normalizadas y ordenadas desc; el
// resultado se cachea por (cik, corte) y las páginas viejas (inmutables) van
// con TTL largo en secFetch.

import { secFetch, resolveCIK, type EdgarFilingSelection } from "@/lib/fetchEdgarSegments";
import {
  fetchGuidanceFromFilings,
  type FilingMatch,
  type EdgarGuidance,
} from "@/lib/fetchEdgar8K";
import type { InsiderTransaction } from "@/types/StockData";
import type { PublishedPeriod } from "./asof";

const DATA_SEC = "https://data.sec.gov";
const WWW_SEC = "https://www.sec.gov";
// Ventana hacia atrás desde el corte: cubre el 10-Q más reciente (~100 días),
// un 20-F/40-F anual (~365) y el último earnings release, con margen.
const WINDOW_DAYS = 420;

export interface SubmissionRow {
  form: string;
  accession: string;
  filingDate: string;
  reportDate: string | null;
  items: string | null;
  primaryDocument: string | null;
  size: number | null;
}

type ColumnarFilings = {
  form?: string[];
  accessionNumber?: string[];
  filingDate?: string[];
  reportDate?: string[];
  items?: string[];
  primaryDocument?: string[];
  size?: number[];
};

function rowsFromColumns(c: ColumnarFilings): SubmissionRow[] {
  const forms = c.form ?? [];
  const out: SubmissionRow[] = [];
  for (let i = 0; i < forms.length; i++) {
    if (!forms[i] || !c.accessionNumber?.[i] || !c.filingDate?.[i]) continue;
    out.push({
      form: forms[i],
      accession: c.accessionNumber[i],
      filingDate: c.filingDate[i],
      reportDate: c.reportDate?.[i] ?? null,
      items: c.items?.[i] ?? null,
      primaryDocument: c.primaryDocument?.[i] ?? null,
      size: typeof c.size?.[i] === "number" ? c.size[i] : null,
    });
  }
  return out;
}

const rowsCache = new Map<string, SubmissionRow[]>();

// Filings del emisor con filing date dentro de [asOf − WINDOW_DAYS, asOf],
// ordenados desc por fecha. Recorre recent + páginas históricas necesarias.
export async function submissionRowsAsOf(cik: string, asOf: string): Promise<SubmissionRow[]> {
  const key = `${cik}|${asOf}`;
  const cached = rowsCache.get(key);
  if (cached) return cached;

  const from = new Date(Date.parse(asOf) - WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  const rows: SubmissionRow[] = [];

  const r = await secFetch(`${DATA_SEC}/submissions/CIK${cik.padStart(10, "0")}.json`, 1800);
  if (!r.ok) {
    rowsCache.set(key, []);
    return [];
  }
  const d = await r.json();
  if (d.filings?.recent) rows.push(...rowsFromColumns(d.filings.recent as ColumnarFilings));

  // Páginas históricas que intersecten la ventana (inmutables → TTL 7 días).
  const files = (d.filings?.files ?? []) as Array<{ name?: string; filingFrom?: string; filingTo?: string }>;
  for (const f of files) {
    if (!f.name || !f.filingFrom || !f.filingTo) continue;
    if (f.filingTo < from || f.filingFrom > asOf) continue;
    const pr = await secFetch(`${DATA_SEC}/submissions/${f.name}`, 7 * 86400);
    if (!pr.ok) continue;
    rows.push(...rowsFromColumns((await pr.json()) as ColumnarFilings));
  }

  const filtered = rows
    .filter((row) => row.filingDate >= from && row.filingDate <= asOf)
    .sort((a, b) => b.filingDate.localeCompare(a.filingDate));
  rowsCache.set(key, filtered);
  return filtered;
}

/* ── Fechas reales de publicación de resultados ─────────────────────────────
   Alimenta la frontera de frescura de snapshotAsOf: un row contable de Yahoo
   entra al corte sólo si su período fue efectivamente publicado (filing ≤
   corte). Dos clases: "periodic" (10-Q/K/20-F/40-F — reportDate ES el cierre
   del período) y "release" (8-K Item 2.02 — reportDate es la fecha del EVENTO;
   la regla de cobertura vive en asof.isPublished). Los 6-K quedan afuera a
   propósito: su reportDate suele ser la fecha de filing, y el matching por
   cercanía produciría falsos "publicado" — los FPIs se quedan con el fallback
   conservador de 45 días.
   ────────────────────────────────────────────────────────────────────────── */

export async function publishedPeriodsAsOf(ticker: string, cutoff: string): Promise<PublishedPeriod[]> {
  try {
    const cik = await resolveCIK(ticker);
    if (!cik) return [];
    const rows = await submissionRowsAsOf(cik, cutoff);
    const out: PublishedPeriod[] = [];
    for (const row of rows) {
      if (row.form === "10-Q" || row.form === "10-K" || row.form === "20-F" || row.form === "40-F") {
        if (row.reportDate) out.push({ kind: "periodic", end: row.reportDate, filed: row.filingDate });
      } else if (row.form === "8-K" && row.items != null && /\b2\.02\b/.test(row.items)) {
        out.push({ kind: "release", end: null, filed: row.filingDate });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/* ── Guidance as-of ─────────────────────────────────────────────────────────
   Sólo 8-K con Item 2.02 ("Results of Operations", el canal confiable de
   earnings releases). Los 6-K de FPIs quedan afuera a propósito: sin la señal
   del item, un 6-K "sustancial" puede ser un informe anual y el extractor
   muerde risk factors como si fueran guidance (falso positivo MUFG detectado
   por probe 2026-07-19). Límite documentado: guidance as-of cubre emisores US.
   ────────────────────────────────────────────────────────────────────────── */

export async function guidanceAsOf(ticker: string, cutoff: string): Promise<EdgarGuidance | null> {
  try {
    const cik = await resolveCIK(ticker);
    if (!cik) return null;
    const rows = await submissionRowsAsOf(cik, cutoff);
    const candidates: FilingMatch[] = rows
      .filter((row) => row.form === "8-K" && row.items != null && /\b2\.02\b/.test(row.items))
      .slice(0, 2)
      .map((row) => ({
        form: row.form,
        accession: row.accession,
        filingDate: row.filingDate,
        reportDate: row.reportDate ?? undefined,
        primaryDocument: row.primaryDocument ?? undefined,
        size: row.size ?? undefined,
      }));
    return await fetchGuidanceFromFilings(cik, candidates);
  } catch {
    return null;
  }
}

/* ── Insiders Form 4 as-of ──────────────────────────────────────────────────
   El texto de cada transacción se genera desde el TRANSACTION CODE del XML
   (P/S/M/F/A/G/C — más confiable que el texto ambiguo de Yahoo) con frases
   que lib/insiders.ts clasifica igual que producción; el flag 10b5-1 del
   propio Form 4 (aff10b5One, obligatorio desde 2023) fuerza la clasificación
   mecánica. FPIs (MUFG, TM, BABA...) no presentan Form 4 → lista vacía → N/D
   honesto, igual que producción para esos tickers.
   ────────────────────────────────────────────────────────────────────────── */

const tagBlock = (xml: string, name: string): string | null =>
  xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`))?.[1] ?? null;

const decodeXmlEntities = (s: string): string =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'");

// Los leafs del ownership XML vienen como <x><value>v</value></x> o <x>v</x>.
const leaf = (xml: string, name: string): string | null => {
  const b = tagBlock(xml, name);
  if (b == null) return null;
  const v = (tagBlock(b, "value") ?? b).trim();
  return v ? decodeXmlEntities(v) : null;
};

const numOf = (s: string | null): number | null => {
  if (s == null) return null;
  const n = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

// Frases calibradas contra los regex de classifyInsiderTransaction.
function describeTransaction(code: string, price: number | null, tenB51: boolean): string {
  const at = price != null && price > 0 ? ` at price ${price.toFixed(2)} per share` : "";
  const plan = tenB51 ? " under 10b5-1 plan" : "";
  switch (code) {
    case "P": return `Purchase${at}${plan}`;
    case "S": return `Sale${at}${plan}`;
    case "M": return "Stock option exercise (non-open market)";
    case "F": return "Non-open market disposition (tax withholding)";
    case "A": return "Stock award/grant";
    case "G": return "Gift";
    case "C": return "Conversion (non-open market)";
    case "J": return `Other (non-open market)${at}`;
    default:  return `Code ${code}${at}`;
  }
}

// URL del XML crudo del Form 4: primaryDocument suele venir con el prefijo del
// stylesheet ("xslF345X05/doc.xml") — el documento real es el mismo nombre sin
// ese directorio.
function form4XmlUrl(cik: string, row: SubmissionRow): string | null {
  const doc = (row.primaryDocument ?? "").replace(/^xslF345X\d+\//, "");
  if (!doc.endsWith(".xml")) return null;
  const accession = row.accession.replace(/-/g, "");
  return `${WWW_SEC}/Archives/edgar/data/${parseInt(cik, 10)}/${accession}/${doc}`;
}

export async function insidersAsOf(ticker: string, cutoff: string): Promise<InsiderTransaction[]> {
  try {
    const cik = await resolveCIK(ticker);
    if (!cik) return [];
    const rows = await submissionRowsAsOf(cik, cutoff);
    const refs = rows.filter((row) => row.form === "4" && row.primaryDocument).slice(0, 8);

    const out: InsiderTransaction[] = [];
    for (const ref of refs) {
      if (out.length >= 5) break;
      const url = form4XmlUrl(cik, ref);
      if (!url) continue;
      const xr = await secFetch(url, 7 * 86400);
      if (!xr.ok) continue;
      const xml = await xr.text();

      const name = leaf(tagBlock(xml, "reportingOwnerId") ?? "", "rptOwnerName") ?? "Insider";
      const rel = tagBlock(xml, "reportingOwnerRelationship") ?? "";
      const relation =
        leaf(rel, "officerTitle") ??
        (leaf(rel, "isDirector") === "1" || leaf(rel, "isDirector") === "true" ? "Director" : null) ??
        (leaf(rel, "isTenPercentOwner") === "1" || leaf(rel, "isTenPercentOwner") === "true" ? "10% Owner" : null) ??
        "Insider";
      const tenB51 = leaf(xml, "aff10b5One") === "1" || leaf(xml, "aff10b5One") === "true";

      for (const m of xml.matchAll(/<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/g)) {
        if (out.length >= 5) break;
        const tx = m[1];
        const code = leaf(tagBlock(tx, "transactionCoding") ?? "", "transactionCode");
        if (!code) continue;
        const shares = numOf(leaf(tx, "transactionShares"));
        const price = numOf(leaf(tx, "transactionPricePerShare"));
        const date = leaf(tx, "transactionDate") ?? ref.filingDate;
        out.push({
          date,
          name,
          relation,
          transactionText: describeTransaction(code, price, tenB51),
          value: shares != null && price != null && price > 0 ? Math.round(shares * price * 100) / 100 : null,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/* ── Selección de filing para segmentos/IS as-of ────────────────────────────
   Réplica de la semántica de latestFilingAccession (fetchEdgarSegments) sobre
   las filas as-of: el 10-Q / 10-K / 20-F / 40-F más reciente con filing date
   ≤ corte, con priorQuarterlyAccession para la derivación Q4 = anual − YTD.
   El resultado se inyecta a fetchSegmentData como override — el parser XBRL
   de producción corre intacto sobre ese filing histórico.
   ────────────────────────────────────────────────────────────────────────── */

export async function filingForSegmentsAsOf(
  ticker: string,
  cutoff: string,
): Promise<EdgarFilingSelection | null> {
  try {
    const cik = await resolveCIK(ticker);
    if (!cik) return null;
    const rows = await submissionRowsAsOf(cik, cutoff);

    const firstOf = (form: string): SubmissionRow | null =>
      rows.find((row) => row.form === form) ?? null;
    const q = firstOf("10-Q");
    const k = firstOf("10-K");
    const f = firstOf("20-F");
    const mjds = firstOf("40-F");

    const annuals = [
      k ? { row: k, foreign: false as const, type: undefined } : null,
      f ? { row: f, foreign: true as const, type: "20-F" as const } : null,
      mjds ? { row: mjds, foreign: true as const, type: "40-F" as const } : null,
    ].filter((x): x is NonNullable<typeof x> => x != null)
      .sort((a, b) => b.row.filingDate.localeCompare(a.row.filingDate));
    const annual = annuals[0] ?? null;

    if (!q && !annual) return null;
    if (!annual || (q && q.filingDate > annual.row.filingDate)) {
      return {
        accession: q!.accession,
        isAnnual: false,
        isForeign: false,
        primaryDocument: q!.primaryDocument ?? undefined,
      };
    }
    return {
      accession: annual.row.accession,
      isAnnual: true,
      isForeign: annual.foreign,
      foreignFormType: annual.type,
      priorQuarterlyAccession: !annual.foreign && q ? q.accession : undefined,
      primaryDocument: annual.row.primaryDocument ?? undefined,
    };
  } catch {
    return null;
  }
}
