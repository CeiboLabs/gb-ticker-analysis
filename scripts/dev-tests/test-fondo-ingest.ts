// Tests de los validadores de ingesta del fondo (lib/fondoIngest).
// Correr:  npx tsx scripts/dev-tests/test-fondo-ingest.ts
// Puro, sin red ni D1 — sólo zod en runtime (el import de D1 es type-only).

import { validateNav, validateBatch, type RawNavInput } from "../../lib/fondoIngest";

const NOW = Date.parse("2026-06-26"); // reloj fijo → "fecha futura" determinista
let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; }
  else { fail++; console.error(`  ✗ ${name}`); }
}

// ── validateNav ──────────────────────────────────────────────────────────────
const prev = { dia: "2024-05-31", nav: 100 };

{
  const v = validateNav({ dia: "2024-06-03", nav: 101.2 }, { prevRow: prev, nowMs: NOW });
  check("acepta cierre en banda", v.ok && v.decision === "accepted" && v.value.nav === 101.2);
}
{
  // nav como string (viene del CSV) debe coercionar
  const v = validateNav({ dia: "2024-06-03", nav: "101.2000" }, { prevRow: prev, nowMs: NOW });
  check("acepta nav string canónico", v.ok && v.value.nav === 101.2);
}
{
  const v = validateNav({ dia: "2026-06-27", nav: 100 }, { nowMs: NOW });
  check("rechaza fecha futura", !v.ok && v.reason === "future_date");
}
{
  const v = validateNav({ dia: "2023-12-31", nav: 100 }, { nowMs: NOW });
  check("rechaza fecha anterior al inicio", !v.ok && v.reason === "stale_date");
}
{
  const v = validateNav({ dia: "2024-02-30", nav: 100 }, { nowMs: NOW });
  check("rechaza fecha irreal (feb-30)", !v.ok && v.reason === "parse");
}
{
  const v = validateNav({ dia: "2024-06-03", nav: "abc" }, { nowMs: NOW });
  check("rechaza nav no numérico", !v.ok && v.reason === "parse");
}
{
  const v = validateNav({ dia: "2024-06-03", nav: 0 }, { nowMs: NOW });
  check("rechaza nav no positivo", !v.ok && v.reason === "nonpositive");
}
{
  const v = validateNav({ dia: "2024-06-03", nav: 200000 }, { nowMs: NOW });
  check("rechaza fuera de banda absoluta", !v.ok && v.reason === "sanity_band");
}
{
  // salto 20% > banda 10%
  const v = validateNav({ dia: "2024-06-03", nav: 120 }, { prevRow: prev, nowMs: NOW });
  check("rechaza salto día-a-día > banda", !v.ok && v.reason === "sanity_band");
}
{
  const v = validateNav({ dia: "2024-06-03", nav: 100, aum: "xyz" }, { nowMs: NOW });
  check("rechaza aum ilegible", !v.ok && v.reason === "parse");
}
{
  const existing = { dia: "2024-06-03", nav: 101.2 };
  const v = validateNav({ dia: "2024-06-03", nav: 101.2 }, { existingRow: existing, nowMs: NOW });
  check("detecta duplicado (mismo valor)", v.ok && v.decision === "duplicate");
}
{
  const existing = { dia: "2024-06-03", nav: 101.2 };
  const v = validateNav({ dia: "2024-06-03", nav: 105 }, { existingRow: existing, nowMs: NOW });
  check("detecta conflicto (valor distinto)", !v.ok && v.reason === "conflict");
}

// ── validateBatch ────────────────────────────────────────────────────────────
{
  // desordenado → se ordena y ambos aceptan
  const rows: RawNavInput[] = [
    { dia: "2024-01-03", nav: 100.1 },
    { dia: "2024-01-02", nav: 100 },
  ];
  const r = validateBatch(rows, { nowMs: NOW });
  check("ordena el lote y acepta", r.ok && r.accepted.length === 2 && r.accepted[0].dia === "2024-01-02");
}
{
  // fecha duplicada → una acepta, otra conflicto
  const rows: RawNavInput[] = [
    { dia: "2024-01-02", nav: 100 },
    { dia: "2024-01-02", nav: 101 },
  ];
  const r = validateBatch(rows, { nowMs: NOW });
  check("marca fecha duplicada en el lote", !r.ok && r.accepted.length === 1 && r.results.some((x) => !x.ok && x.reason === "conflict"));
}
{
  // fila mala a mitad no contamina las buenas
  const rows: RawNavInput[] = [
    { dia: "2024-01-02", nav: 100 },
    { dia: "2024-01-03", nav: "ROTO" },
    { dia: "2024-01-04", nav: 100.2 },
  ];
  const r = validateBatch(rows, { nowMs: NOW });
  check("fila mala no contamina el lote", !r.ok && r.accepted.length === 2);
}
{
  // salto entre consecutivos > banda
  const rows: RawNavInput[] = [
    { dia: "2024-01-02", nav: 100 },
    { dia: "2024-01-03", nav: 130 },
  ];
  const r = validateBatch(rows, { nowMs: NOW });
  check("banda día-a-día en el lote", !r.ok && r.results.some((x) => !x.ok && x.reason === "sanity_band"));
}
{
  // priorRow: banda de la primera fila contra el último publicado
  const rows: RawNavInput[] = [{ dia: "2024-02-01", nav: 130 }];
  const r = validateBatch(rows, { priorRow: { dia: "2024-01-31", nav: 100 }, nowMs: NOW });
  check("banda contra priorRow", !r.ok && r.results.some((x) => !x.ok && x.reason === "sanity_band"));
}

// ── resultado ────────────────────────────────────────────────────────────────
console.log(`\nfondo-ingest: ${pass} ok, ${fail} fallaron`);
if (fail > 0) process.exit(1);
