// BNG Selección Global — importa el backtest de la estrategia (Excel → JSON).
//
// QUÉ ES ESTE DATO
// Una simulación: la estrategia de HOY aplicada hacia atrás sobre precios
// históricos. NO es el valor cuota del Fondo, que todavía no comenzó a
// publicarse. La distinción no es un tecnicismo — es lo único que separa a este
// bloque de publicar rendimientos inventados de un fondo regulado por el BCU—,
// así que viaja en el propio dato: el JSON se llama `backtest-…`, sus series se
// llaman `estrategia` y `referencia` (nunca `nav` ni `fondo`), y la UI que lo
// dibuja lo rotula como simulación en cuatro lugares (ver FondoBacktest).
//
// POR QUÉ UN JSON ESTÁTICO Y NO D1
// La serie es INMUTABLE: sólo cambia cuando el cliente manda un Excel nuevo. No
// hay nada que consultar en tiempo real, y meterla en D1 obligaría a tocar el
// worker, la migración y el proxy PHP del hosting para servir un archivo que no
// cambia. Como asset estático lo sirve Apache directo, comprimido y cacheado.
//
// Tampoco va importada al bundle: son ~1.100 cierres y quedarían parseándose en
// cada visita, incluso para quien nunca baja hasta Rendimientos. Se pide en
// diferido (ver lib/fondoBacktest.ts). Es el mismo criterio con el que se sacó
// la serie del benchmark del payload de /api/fondo — docs/rendimiento-fondo.md §6.1.
//
// USO
//   npx tsx scripts/fondo-backtest.mts <archivo.xlsx>
//
// SALIDA: public/fondo/backtest-estrategia.json
//
// ⚠️ Después de correrlo hay que mirar la tabla que imprime y contrastarla
// contra la hoja «Resumen» del Excel. El script valida la FORMA de la serie
// (orden, huecos, base), no puede validar que los números sean los correctos.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = path.join(REPO, "public", "fondo", "backtest-estrategia.json");

// Nombres tal como vienen del Excel del cliente. Si el archivo nuevo los cambia,
// el script corta con un error legible en vez de escribir un JSON vacío.
const HOJA = "Serie Diaria";
const COL_FECHA = "Fecha";
const COL_ESTRATEGIA = "Portafolio";
const COL_REFERENCIA = "BM_6040";

const entrada = process.argv[2];
if (!entrada) {
  console.error("\n✘ Falta el archivo.\n  npx tsx scripts/fondo-backtest.mts <archivo.xlsx>\n");
  process.exit(1);
}
if (!fs.existsSync(entrada)) {
  console.error(`\n✘ No existe: ${entrada}\n`);
  process.exit(1);
}

// `XLSX.readFile` no sirve acá: el build ESM del paquete no trae `fs` cableado
// y tira "Cannot access file" aunque el archivo exista. Se lee el buffer a mano.
const libro = XLSX.read(fs.readFileSync(entrada), { type: "buffer" });
if (!libro.SheetNames.includes(HOJA)) {
  console.error(
    `\n✘ El Excel no tiene la hoja «${HOJA}».\n  Hojas encontradas: ${libro.SheetNames.join(", ")}\n`,
  );
  process.exit(1);
}

type Fila = Record<string, unknown>;
const filas = XLSX.utils.sheet_to_json<Fila>(libro.Sheets[HOJA], { raw: true });
if (filas.length === 0) {
  console.error(`\n✘ La hoja «${HOJA}» está vacía.\n`);
  process.exit(1);
}
for (const col of [COL_FECHA, COL_ESTRATEGIA, COL_REFERENCIA]) {
  if (!(col in filas[0])) {
    console.error(
      `\n✘ Falta la columna «${col}» en «${HOJA}».\n` +
        `  Columnas encontradas: ${Object.keys(filas[0]).join(", ")}\n`,
    );
    process.exit(1);
  }
}

// La fecha puede llegar como texto ('2022-01-03') o como serial de Excel, según
// cómo se haya exportado la planilla. Se normaliza a ISO en los dos casos.
function iso(v: unknown): string {
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) throw new Error(`fecha ilegible: ${v}`);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.y}-${p(d.m)}-${p(d.d)}`;
  }
  throw new Error(`fecha ilegible: ${String(v)}`);
}

const num = (v: unknown, ctx: string): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw new Error(`valor no numérico en ${ctx}: ${String(v)}`);
  return n;
};

const puntos = filas.map((f, i) => ({
  dia: iso(f[COL_FECHA]),
  estrategia: num(f[COL_ESTRATEGIA], `fila ${i + 2} · ${COL_ESTRATEGIA}`),
  referencia: num(f[COL_REFERENCIA], `fila ${i + 2} · ${COL_REFERENCIA}`),
}));
puntos.sort((a, b) => a.dia.localeCompare(b.dia));

// ── Validación de forma ──────────────────────────────────────────────────────
// No valida que los números sean CORRECTOS —eso no se puede desde acá—, sino
// que la serie tenga la forma de una serie diaria continua. Un hueco largo o una
// base distinta de 100 son las dos maneras en que un Excel nuevo puede romper el
// gráfico sin que se note hasta que alguien mire la página.

const problemas: string[] = [];
const duplicados = puntos.length - new Set(puntos.map((p) => p.dia)).size;
if (duplicados > 0) problemas.push(`${duplicados} fechas duplicadas`);

const dias = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;
// Un fin de semana largo son 4 días; más que eso es un feriado raro o un hueco
// de datos, y sobre el gráfico un hueco se dibuja como una recta que no existió.
for (let i = 1; i < puntos.length; i++) {
  const g = dias(puntos[i - 1].dia, puntos[i].dia);
  if (g > 5) problemas.push(`hueco de ${g} días entre ${puntos[i - 1].dia} y ${puntos[i].dia}`);
}
for (const serie of ["estrategia", "referencia"] as const) {
  const base = puntos[0][serie];
  if (Math.abs(base - 100) > 0.01) {
    problemas.push(`la serie «${serie}» arranca en ${base} y no en 100 (base 100)`);
  }
  if (puntos.some((p) => p[serie] <= 0)) problemas.push(`la serie «${serie}» tiene valores ≤ 0`);
}
if (problemas.length > 0) {
  console.error("\n✘ La serie no pasó la validación:\n" + problemas.map((p) => `  · ${p}`).join("\n") + "\n");
  process.exit(1);
}

// ── Salida ───────────────────────────────────────────────────────────────────
// Columnar: mismo dato que un array de objetos pero sin repetir las claves 1.127
// veces (28,7 KB contra 52,8). Comprimido por Apache queda en ~8 KB.
//
// SIN marca de tiempo de generación, a propósito: el JSON tiene que ser función
// pura del Excel de entrada. Con un timestamp adentro, volver a correr el script
// sobre el mismo archivo ensuciaría el diff y no habría forma de ver de un
// vistazo si los datos cambiaron. La vigencia del dato la da `hasta`.
const salida = {
  fuente: path.basename(entrada),
  desde: puntos[0].dia,
  hasta: puntos[puntos.length - 1].dia,
  base: 100,
  dias: puntos.map((p) => p.dia),
  estrategia: puntos.map((p) => p.estrategia),
  referencia: puntos.map((p) => p.referencia),
};

fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
fs.writeFileSync(SALIDA, JSON.stringify(salida));

// ── Informe para el operador ─────────────────────────────────────────────────
// Lo que hay que contrastar a mano contra la hoja «Resumen» del Excel.

const pct = (a: number, b: number) => ((b / a - 1) * 100).toFixed(2).replace(".", ",");
const anios = [...new Set(puntos.map((p) => p.dia.slice(0, 4)))].sort();

console.log(`\nBNG Selección Global — backtest de la estrategia`);
console.log(`· fuente : ${path.basename(entrada)}`);
console.log(`· período: ${salida.desde} → ${salida.hasta}  (${puntos.length} cierres)`);
console.log(`· salida : ${path.relative(REPO, SALIDA)}  (${(fs.statSync(SALIDA).size / 1024).toFixed(1)} KB)`);
console.log(`\n  AÑO    ESTRATEGIA   REFERENCIA`);
for (const a of anios) {
  const delAnio = puntos.filter((p) => p.dia.slice(0, 4) === a);
  const previos = puntos.filter((p) => p.dia.slice(0, 4) < a);
  // Mismo criterio que computeCalendar() en lib/fondo.ts: el año se mide contra
  // el último cierre del año anterior, no contra su propio primer cierre.
  const base = previos.length > 0 ? previos[previos.length - 1] : delAnio[0];
  const fin = delAnio[delAnio.length - 1];
  const parcial = a === anios[anios.length - 1] && !fin.dia.endsWith("-12-31");
  console.log(
    `  ${a}   ${pct(base.estrategia, fin.estrategia).padStart(8)}%   ` +
      `${pct(base.referencia, fin.referencia).padStart(8)}%` +
      (parcial ? `   (parcial, al ${fin.dia})` : ""),
  );
}
const p0 = puntos[0];
const pN = puntos[puntos.length - 1];
console.log(`  TOTAL  ${pct(p0.estrategia, pN.estrategia).padStart(8)}%   ${pct(p0.referencia, pN.referencia).padStart(8)}%`);
console.log(
  `\n⚠️  Contrastá estas cifras contra la hoja «Resumen» del Excel antes de publicar.\n` +
    `   Y confirmá con el cliente si la serie es NETA de la comisión del Fondo\n` +
    `   (ver docs/RUNBOOK-fondo.md → «Backtest de la estrategia»).\n`,
);
