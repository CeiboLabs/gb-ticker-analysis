// BNG Selección Global — capa de datos del fondo.
//
// Dos cosas viven acá:
//   1. Los HECHOS del producto (FONDO), que son los únicos datos publicables hoy.
//      Todo lo de acá sale de lo que confirmó el responsable del fondo; no hay
//      números de performance inventados (el fondo está en pre-lanzamiento).
//   2. La lectura de la serie diaria (valor cuota / AUM) desde D1 y el cómputo
//      de rendimientos por período y por año calendario. Mientras no haya filas
//      en `fund_nav`, el fondo se reporta como 'pre-launch' y la web muestra el
//      estado correspondiente — sin maquetar cifras falsas.
//
// La ingestión diaria (custodio/feed) sólo tiene que insertar filas en
// `fund_nav`; el frontend se entera solo vía /api/fondo y todo —ficha,
// gráfico, tabla de rendimientos— se puebla a partir de la serie.

import type { D1Database } from "@/lib/metrics";
import { readNavSeries, readBenchmarkSeries, readLatestHoldings } from "@/lib/fondoStore";

// ── Hechos del producto (verificables) ─────────────────────────────────────

// Moneda del fondo — el valor cuota, el AUM y todos los rendimientos se
// expresan en ella. Fuente única: la usan la ficha técnica y la UI de
// performance (no repetir el literal "USD" suelto por la página).
export const MONEDA = "USD";

export const FONDO = {
  nombre: "BNG Selección Global",
  // Una línea — confirmado por el responsable del fondo.
  tagline: "Estrategia de crecimiento diversificada, domiciliada en Uruguay.",
  responsable: "Adrián Moreira",
  objetivo:
    "Construir una cartera diversificada y global en un solo vehículo, combinando acciones, bonos y activos alternativos, para acompañar el crecimiento del capital a lo largo de un ciclo completo de mercado.",
  // Ficha técnica del producto — la grilla densa de la página. Todo dato es factual
  // y verificable del producto; nada de cifras de cartera o performance (el
  // fondo está en pre-lanzamiento). El SRI 4/7 es provisional (ver FondoRiesgo).
  fichaTecnica: [
    ["Tipo", "Estrategia balanceada"],
    ["Clases de activo", "Acciones, bonos y activos alternativos"],
    ["Estructura", "Inversión directa y fondos mutuos"],
    ["Alcance", "Exposición global"],
    ["Domicilio", "Uruguay"],
    ["Moneda", MONEDA],
    ["Gestión", "Gastón Bengochea & Cía."],
    ["Responsable del fondo", "Adrián Moreira"],
    ["Inicio", "Enero 2024"],
    ["Valor cuota", "Cálculo diario"],
    ["Suscripción y rescate", "A través de un asesor nuestro"],
    ["Indicador de riesgo", "4 / 7 (provisional)"],
    ["Regulación y custodia", "Sociedad de bolsa regulada por el BCU"],
  ] as const satisfies ReadonlyArray<readonly [string, string]>,
  // Estructura cualitativa de la cartera: las TRES clases de activo del
  // balanceado. SIN pesos ni porcentajes: la asignación es activa y los pesos
  // vigentes se informan en la ficha mensual / a pedido. No inventar números acá.
  cartera: {
    sleeves: [
      {
        clave: "Acciones",
        rol: "Motor de crecimiento",
        desc: "Exposición a acciones de mercados desarrollados y emergentes, a través de vehículos que ofrecen esa exposición de forma eficiente y diversificada. Es el motor de crecimiento de la cartera.",
      },
      {
        clave: "Bonos",
        rol: "Bloque defensivo",
        desc: "Bonos y crédito a nivel global, ya sea por inversión directa en los instrumentos o mediante fondos mutuos. Aporta estabilidad y modera la volatilidad del portafolio.",
      },
      {
        clave: "Activos alternativos",
        rol: "Diversificación y retorno",
        desc: "Históricamente tienen correlación baja o negativa con acciones y bonos tradicionales: reducen la volatilidad del portafolio agregado sin sacrificar retorno esperado.",
      },
    ],
    nota: "La asignación a cada clase de activo se gestiona de forma activa, con un riguroso análisis del contexto de mercado y la coyuntura macroeconómica. La composición vigente se informa en la ficha técnica mensual y a través de un asesor nuestro.",
  },
} as const;

// Benchmark de referencia — confirmado por el responsable del fondo: compuesto
// 60/40 que imita la estructura del balanceado (renta variable global + renta
// fija). Es la vara contra la cual se compara el valor cuota en el gráfico
// (el benchmark se reescala al valor cuota inicial del fondo). La composición
// exacta del tramo de renta fija (Global vs US Aggregate) está pendiente de
// confirmar; el nombre largo se
// finaliza cuando se cierre. NO se grafica con datos inventados: la serie del
// benchmark sólo se muestra cuando hay data real de índices (o, en
// pre-lanzamiento, junto al placeholder del fondo y claramente marcada).
export const BENCHMARK = {
  corto: "Benchmark",
  nombre: "60% MSCI World · 40% Bloomberg Aggregate",
  pesos: { rv: 0.6, rf: 0.4 },
} as const;

// ── Serie diaria + rendimientos ──────────────────────────────────────────────

export type FundNavPoint = {
  dia: string;   // 'YYYY-MM-DD'
  nav: number;
  aum: number | null;
};

// Tenencias del fondo (snapshot mensual, con rezago de divulgación). weightBps
// en puntos básicos (entero) — la suma a 100% no tiene drift de punto flotante.
// El color NO viaja en el dato: lo deriva el componente por clase + rank.
export type HoldingItem = {
  name: string;
  short: string | null;
  assetClass: "RV" | "RF" | "Otros";
  weightBps: number;
};
export type HoldingsSnapshot = { asOf: string; items: HoldingItem[] };

export type ReturnKey = "1M" | "3M" | "YTD" | "1Y" | "SI";

export type PeriodReturn = {
  key: ReturnKey;
  label: string;
  pct: number | null;   // null = sin historia suficiente todavía
};

export type CalendarReturn = { year: number; pct: number };

// Estadísticas derivadas de la serie NAV — nada se carga a mano: todo se
// computa de los cierres diarios, así que cuando entre el feed real del
// custodio estas cifras se corrigen solas.
export type FundStats = {
  vol1y: number | null;          // volatilidad anualizada (12 meses), en %
  bestMonth: { ym: string; pct: number } | null;   // ym = 'YYYY-MM'
  worstMonth: { ym: string; pct: number } | null;
  maxDrawdown: number | null;    // caída máxima desde un pico, en % (negativo)
  positiveMonths: number | null; // % de meses calendario con retorno positivo
  annualizedSI: number | null;   // retorno anualizado desde el inicio (CAGR), en %
};

export type FundSnapshot = {
  // 'pre-launch' mientras no haya ninguna fila en fund_nav.
  status: "pre-launch" | "live";
  asOf: string | null;   // fecha del último cierre, 'YYYY-MM-DD'
  latest: {
    dia: string;
    nav: number;
    aum: number | null;
    // Variación contra el cierre inmediato anterior (si existe).
    changeAbs: number | null;
    changePct: number | null;
  } | null;
  returns: PeriodReturn[];
  calendar: CalendarReturn[];
  stats: FundStats;
  // Serie completa ordenada por fecha ascendente, para el gráfico.
  series: FundNavPoint[];
  // Serie del benchmark de referencia, alineada por fecha con `series` para la
  // comparación en el gráfico (se reescala al valor cuota inicial del fondo).
  // Vacía si no hay data de índices todavía: en ese caso el gráfico muestra
  // sólo la línea del fondo.
  benchmark: FundNavPoint[];
  // Rendimientos del benchmark, en el mismo orden/clave que `returns` y
  // `calendar` del fondo, para la fila comparativa de las tablas. Vacíos cuando
  // no hay serie de benchmark (data real sin feed de índices): la tabla degrada
  // a sólo la fila del fondo.
  benchReturns: PeriodReturn[];
  benchCalendar: CalendarReturn[];
  // Snapshot de tenencias vigente y divulgable (con rezago). null en
  // pre-lanzamiento o si no hay snapshot lo bastante viejo para divulgar.
  holdings: HoldingsSnapshot | null;
};

const EMPTY_RETURNS: PeriodReturn[] = [
  { key: "1M", label: "1 mes", pct: null },
  { key: "3M", label: "3 meses", pct: null },
  { key: "YTD", label: "Año en curso", pct: null },
  { key: "1Y", label: "1 año", pct: null },
  { key: "SI", label: "Desde inicio", pct: null },
];

const EMPTY_STATS: FundStats = {
  vol1y: null,
  bestMonth: null,
  worstMonth: null,
  maxDrawdown: null,
  positiveMonths: null,
  annualizedSI: null,
};

const EMPTY_SNAPSHOT: FundSnapshot = {
  status: "pre-launch",
  asOf: null,
  latest: null,
  returns: EMPTY_RETURNS,
  calendar: [],
  stats: EMPTY_STATS,
  series: [],
  benchmark: [],
  benchReturns: [],
  benchCalendar: [],
  holdings: null,
};

function isoMinusMonths(dia: string, months: number): string {
  const [y, m, d] = dia.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 - months, d));
  return dt.toISOString().slice(0, 10);
}

// Último punto con fecha <= target (serie ascendente). null si todos son posteriores.
function baseOnOrBefore(series: FundNavPoint[], targetIso: string): FundNavPoint | null {
  let found: FundNavPoint | null = null;
  for (const p of series) {
    if (p.dia <= targetIso) found = p;
    else break;
  }
  return found;
}

function pct(base: FundNavPoint | null, last: FundNavPoint): number | null {
  if (!base || base.nav === 0) return null;
  return (last.nav / base.nav - 1) * 100;
}

function computeReturns(series: FundNavPoint[]): PeriodReturn[] {
  if (series.length < 2) return EMPTY_RETURNS;
  const last = series[series.length - 1];
  const first = series[0];
  const lastYear = Number(last.dia.slice(0, 4));
  // YTD: contra el último cierre del año anterior (o inicio si no hay).
  const ytdBase = baseOnOrBefore(series, `${lastYear - 1}-12-31`) ?? first;
  return [
    { key: "1M", label: "1 mes", pct: pct(baseOnOrBefore(series, isoMinusMonths(last.dia, 1)), last) },
    { key: "3M", label: "3 meses", pct: pct(baseOnOrBefore(series, isoMinusMonths(last.dia, 3)), last) },
    { key: "YTD", label: "Año en curso", pct: pct(ytdBase, last) },
    { key: "1Y", label: "1 año", pct: pct(baseOnOrBefore(series, isoMinusMonths(last.dia, 12)), last) },
    { key: "SI", label: "Desde inicio", pct: pct(first, last) },
  ];
}

function computeCalendar(series: FundNavPoint[]): CalendarReturn[] {
  if (series.length < 2) return [];
  // Para cada año presente: cierre del año = último punto del año; base = último
  // punto del año anterior (o el primer punto disponible para el primer año).
  const years = [...new Set(series.map((p) => Number(p.dia.slice(0, 4))))].sort();
  const reversed = [...series].reverse();
  const out: CalendarReturn[] = [];
  for (const y of years) {
    const last = reversed.find((p) => Number(p.dia.slice(0, 4)) === y);
    if (!last) continue;
    const base = baseOnOrBefore(series, `${y - 1}-12-31`) ?? series[0];
    const r = pct(base, last);
    if (r != null && base !== last) out.push({ year: y, pct: r });
  }
  return out.reverse(); // más reciente primero
}

function computeStats(series: FundNavPoint[]): FundStats {
  if (series.length < 2) return EMPTY_STATS;
  const last = series[series.length - 1];

  // Volatilidad anualizada: desvío de los retornos diarios de los últimos 12
  // meses × √252. Exige una ventana mínima para no anualizar ruido.
  let vol1y: number | null = null;
  const win = series.filter((p) => p.dia >= isoMinusMonths(last.dia, 12));
  if (win.length >= 60) {
    const rets: number[] = [];
    for (let i = 1; i < win.length; i++) {
      if (win[i - 1].nav !== 0) rets.push(win[i].nav / win[i - 1].nav - 1);
    }
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
    vol1y = Math.sqrt(variance) * Math.sqrt(252) * 100;
  }

  // Retornos por mes calendario: cierre de cada mes contra el cierre del mes
  // anterior (serie ascendente ⇒ la última fila de cada mes queda en el Map).
  // El mes en curso cuenta aunque esté parcial: es el dato a la fecha.
  const closes = new Map<string, number>();
  for (const p of series) closes.set(p.dia.slice(0, 7), p.nav);
  const months = [...closes.keys()].sort();
  const monthly: { ym: string; pct: number }[] = [];
  for (let i = 1; i < months.length; i++) {
    const base = closes.get(months[i - 1])!;
    if (base !== 0) monthly.push({ ym: months[i], pct: (closes.get(months[i])! / base - 1) * 100 });
  }
  let bestMonth: FundStats["bestMonth"] = null;
  let worstMonth: FundStats["worstMonth"] = null;
  let positiveMonths: number | null = null;
  if (monthly.length >= 3) {
    bestMonth = monthly.reduce((a, b) => (b.pct > a.pct ? b : a));
    worstMonth = monthly.reduce((a, b) => (b.pct < a.pct ? b : a));
    positiveMonths = (monthly.filter((m) => m.pct > 0).length / monthly.length) * 100;
  }

  // Máximo drawdown sobre toda la historia: peor caída desde un pico previo.
  let peak = series[0].nav;
  let mdd = 0;
  for (const p of series) {
    if (p.nav > peak) peak = p.nav;
    else if (peak > 0) mdd = Math.min(mdd, (p.nav / peak - 1) * 100);
  }

  // Retorno anualizado desde el inicio (CAGR). Sólo con ≥ 1 año de historia:
  // anualizar una ventana corta amplifica el ruido.
  let annualizedSI: number | null = null;
  const first = series[0];
  const days = (Date.parse(last.dia) - Date.parse(first.dia)) / 86400000;
  if (days >= 365 && first.nav > 0) {
    annualizedSI = (Math.pow(last.nav / first.nav, 365.25 / days) - 1) * 100;
  }

  return { vol1y, bestMonth, worstMonth, maxDrawdown: mdd === 0 ? null : mdd, positiveMonths, annualizedSI };
}

// Arma el snapshot completo (latest + rendimientos + calendario) a partir de
// una serie ascendente. Pura y testeable; la usan tanto la lectura de D1 como
// cualquier fuente alternativa.
export function snapshotFromSeries(
  series: FundNavPoint[],
  benchmark: FundNavPoint[] = [],
  holdings: HoldingsSnapshot | null = null,
): FundSnapshot {
  if (series.length === 0) return EMPTY_SNAPSHOT;
  const last = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : null;
  const changeAbs = prev ? last.nav - prev.nav : null;
  const changePct = prev && prev.nav !== 0 ? (last.nav / prev.nav - 1) * 100 : null;
  return {
    status: "live",
    asOf: last.dia,
    latest: { dia: last.dia, nav: last.nav, aum: last.aum, changeAbs, changePct },
    returns: computeReturns(series),
    calendar: computeCalendar(series),
    stats: computeStats(series),
    series,
    benchmark,
    benchReturns: benchmark.length > 1 ? computeReturns(benchmark) : [],
    benchCalendar: benchmark.length > 1 ? computeCalendar(benchmark) : [],
    holdings,
  };
}

// PLACEHOLDER temporal: serie estática determinista (sin Math.random) hasta
// que llegue el feed real del custodio. Simula un fondo balanceado operando
// desde ene-2024: tendencia alcista suave con oscilación realista. Cuando se
// inserten filas en `fund_nav`, esos datos reales toman precedencia y este
// placeholder deja de usarse. ⚠️ Reemplazar por datos reales antes de prod.
const PLACEHOLDER_END = Date.UTC(2026, 5, 5); // último cierre simulado: 2026-06-05

// Valor cuota inicial simulado. A propósito NO es 100: si la cuota arrancara en
// 100, el gráfico en base 100 daría exactamente los mismos valores que el de
// valor cuota (base 100 de una serie que empieza en 100 es la propia serie) y el
// toggle no distinguiría nada. ⚠️ Reemplazar por el valor cuota inicial real.
const PLACEHOLDER_START_NAV = 1000;

function placeholderSeries(): FundNavPoint[] {
  const out: FundNavPoint[] = [];
  let factor = 1; // crecimiento acumulado desde el inicio (1 = valor cuota inicial)
  const start = Date.UTC(2024, 0, 2);
  for (let i = 0; ; i++) {
    const t = start + i * 86400000;
    if (t > PLACEHOLDER_END) break;
    const d = new Date(t);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue; // sólo días hábiles
    // drift + oscilación determinista (ciclos cortos y medianos). Calibrado a
    // un perfil balanceado: ~+7%/año con drawdowns suaves.
    factor *= 1 + 0.00017 + Math.sin(i / 13) * 0.0017 + Math.sin(i / 57) * 0.0013 + Math.cos(i / 97) * 0.0007;
    const aum = Math.round((11_000_000 + i * 42_000) * factor);
    out.push({ dia: d.toISOString().slice(0, 10), nav: Math.round(PLACEHOLDER_START_NAV * factor * 1e4) / 1e4, aum });
  }
  return out;
}

// PLACEHOLDER del benchmark 60/40, alineado por fecha con placeholderSeries().
// Se DERIVA de la serie del fondo para que ambas líneas estén correlacionadas
// (como en la realidad): el benchmark amplifica el retorno diario del fondo
// (beta > 1 ⇒ se ve más volátil) y le resta un pequeño drag, de modo que la
// selección activa termina un poco por encima con menos vaivén. Determinista,
// sin Math.random. ⚠️ Reemplazar por la serie real de los índices (MSCI World
// + Bloomberg Aggregate) antes de prod.
function placeholderBenchmark(fund: FundNavPoint[]): FundNavPoint[] {
  // Arranca en el mismo valor cuota inicial del fondo: en base 100 ambos se
  // reescalan a 100 y los rendimientos de las tablas son escala-invariantes.
  let nav = fund.length > 0 ? fund[0].nav : PLACEHOLDER_START_NAV;
  return fund.map((p, i) => {
    if (i > 0) {
      const fundRet = fund[i - 1].nav !== 0 ? fund[i].nav / fund[i - 1].nav - 1 : 0;
      nav *= 1 + fundRet * 1.18 - 0.00013; // beta 1.18 + drag diario
    }
    return { dia: p.dia, nav: Math.round(nav * 1e4) / 1e4, aum: null };
  });
}

// El placeholder simulado SÓLO se usa fuera de producción (maqueta de dev/
// preview). En prod, sin datos reales, la página muestra el estado honesto de
// pre-lanzamiento — "claims verificables": nunca cifras inventadas.
const ALLOW_PLACEHOLDER = process.env.NODE_ENV !== "production";

// Lee la serie publicada de fund_nav (+ benchmark y tenencias) y arma el
// snapshot. Sin datos reales (sin binding D1, tabla vacía o error de query):
// en dev cae al placeholder; en prod, a pre-lanzamiento honesto.
export async function getFundSnapshot(db: D1Database | null): Promise<FundSnapshot> {
  const fallback = (): FundSnapshot => {
    if (!ALLOW_PLACEHOLDER) return EMPTY_SNAPSHOT;
    const fund = placeholderSeries();
    return snapshotFromSeries(fund, placeholderBenchmark(fund));
  };
  if (!db) return fallback();
  try {
    const series = await readNavSeries(db);
    if (series.length === 0) return fallback();
    // Benchmark y tenencias se leen sólo si existen filas reales; cada uno
    // degrada solo (gráfico de una línea / sin bloque de tenencias) si está vacío.
    const [benchmark, holdings] = await Promise.all([
      readBenchmarkSeries(db),
      readLatestHoldings(db),
    ]);
    return snapshotFromSeries(series, benchmark, holdings);
  } catch (err) {
    // En prod, un error de D1 NO inventa datos: pre-lanzamiento honesto (el
    // cache de 5 min de /api/fondo amortigua los blips transitorios).
    if (!ALLOW_PLACEHOLDER) console.error("[fondo] getFundSnapshot D1 error:", err);
    return fallback();
  }
}
