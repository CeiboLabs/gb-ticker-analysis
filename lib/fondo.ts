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
  // Ficha técnica del producto — la grilla densa de la página.
  //
  // ⚠️ FUENTE ÚNICA: el Reglamento de Gestión aprobado por el BCU (Resolución
  // RR-SSF-2026-434 del 7-jul-2026, Comunicación N° 2026/139), publicado en la
  // sección Documentos. Cada fila de acá tiene que poder señalarse en un
  // literal del "Resumen de las características del Fondo". Nada de cifras de
  // cartera ni de performance: el Fondo todavía no comenzó a funcionar (la
  // resolución exige comunicar la fecha de inicio con 10 días hábiles de
  // anticipación, art. 74 RNMV).
  fichaTecnica: [
    ["Tipo", "Fondo de inversión abierto, plazo ilimitado"],
    ["Clases de activo", "Acciones, bonos y activos alternativos"],
    // Literal (n): los Activos Elegibles son efectivo/equivalentes, deuda de
    // soberanos u organismos internacionales, ETFs y fondos mutuos. NO hay
    // compra directa de acciones ni de crédito corporativo.
    ["Estructura", "ETFs y fondos mutuos; deuda soberana y de organismos internacionales, directa"],
    ["Alcance", "Exposición global"],
    ["Domicilio", "Uruguay"],
    // Literal (d): hasta 30% en $/UI y 5% en otras monedas.
    ["Moneda", MONEDA],
    ["Sociedad administradora", "Valores Administradora de Fondos de Inversión y Fideicomisos S.A."],
    ["Gestor del Fondo", "Gastón Bengochea y Compañía Corredor de Bolsa S.A."],
    ["Responsable del fondo", "Adrián Moreira"],
    ["Autorización", "BCU, 7 de julio de 2026 (Comunicación N° 2026/139)"],
    ["Inicio", "Pendiente de comunicación al BCU"],
    ["Valor cuota", "Cálculo diario"],
    ["Mínimo de suscripción", "USD 100"],
    ["Suscripciones", "Diarias"],
    ["Rescates", "Martes y viernes hábiles; pago dentro de 4 días hábiles"],
    ["Comisión", "Hasta 1,5% anual (IVA incluido) sobre el patrimonio neto del Fondo"],
    ["Auditor externo", "Ernst & Young Uy S.A.S."],
    ["Calificación de riesgo", "El Fondo no cuenta con calificación de riesgo"],
  ] as const satisfies ReadonlyArray<readonly [string, string]>,
  // Estructura cualitativa de la cartera: las TRES clases de activo del
  // balanceado. SIN pesos ni porcentajes: la asignación es activa y los pesos
  // vigentes se informan en la ficha mensual / a pedido. No inventar números acá.
  cartera: {
    sleeves: [
      {
        clave: "Acciones",
        rol: "Motor de crecimiento",
        // Reglamento 3.3.1: "instrumentada principalmente a través de ETFs de
        // gestión pasiva referenciados a índices bursátiles de amplia
        // diversificación, complementados con Fondos Mutuos de gestión activa".
        desc: "Exposición a acciones de mercados desarrollados y emergentes, principalmente a través de ETFs de gestión pasiva sobre índices amplios, complementados con fondos mutuos de gestión activa.",
      },
      {
        clave: "Bonos",
        rol: "Bloque defensivo",
        // La deuda DIRECTA elegible es sólo la de Estados soberanos y organismos
        // internacionales de crédito (Activo Elegible B). El crédito corporativo
        // entra únicamente vía ETFs y fondos mutuos.
        desc: "Deuda de Estados soberanos y organismos internacionales, que el Fondo puede tener de forma directa, y crédito global a través de ETFs y fondos. Aporta estabilidad y modera la volatilidad del portafolio.",
      },
      {
        clave: "Activos alternativos",
        rol: "Complemento táctico",
        // Reglamento 3.3.1: asignación TÁCTICA, tope 20%, "sin que dicha
        // asignación constituya un objetivo estratégico permanente", y el acceso
        // es "exclusivamente a través de ETFs y Fondos Mutuos especializados, en
        // ningún caso mediante la tenencia directa de los activos subyacentes".
        desc: "Se incorporan de forma táctica —hasta un 20% de la cartera— y siempre a través de ETFs y fondos especializados, nunca por tenencia directa. Buscan descorrelacionar la cartera y reducir su riesgo de mercado.",
      },
    ],
    // Se nombra el límite, no se transcribe la tabla: los rangos del Reglamento
    // (3.3.1) son término del contrato y están en el documento que la página
    // publica. Tampoco se promete acá una cadencia de reporte propia — el
    // literal (t) es el que manda.
    nota: "La asignación a cada clase se gestiona de forma activa, con un riguroso análisis del contexto de mercado y la coyuntura macroeconómica, dentro de los límites que fija el Reglamento de Gestión.",
  },
} as const;

// Benchmark de referencia — confirmado por el responsable del fondo: compuesto
// 60/40 que imita la estructura del balanceado (renta variable global + renta
// fija). Es la vara contra la cual se compara el valor cuota en el gráfico
// (el benchmark se reescala al valor cuota inicial del fondo), y mientras el
// Fondo no tenga serie propia es la ÚNICA línea del gráfico, rotulada como tal.
// NO se grafica con datos inventados: la serie sale de `fund_benchmark`.
export const BENCHMARK = {
  corto: "Benchmark",
  nombre: "60% MSCI ACWI · 40% Bloomberg Global Aggregate",
  // Tickers Bloomberg de los índices, para el pie de la página: es lo que el
  // equipo nombra puertas adentro y lo que habría que pedirle al administrador.
  tickers: "ACWI · LEGATRUU",
  pesos: { rv: 0.6, rf: 0.4 },
} as const;

// Cómo se construye HOY la serie del benchmark, mientras no tengamos los
// niveles reales de los índices (Bloomberg/MSCI son datos licenciados: ninguna
// fuente pública los sirve). Se reconstruye con ETFs que los replican, a
// precios ajustados por dividendos —total return, que es lo que miden los
// índices originales— y rebalanceo diario a pesos constantes.
//
// El tramo de renta fija es el aproximado: no existe un ETF accesible que siga
// al Global Aggregate SIN cobertura de moneda (BNDX/BNDW/AGGU están cubiertos,
// y la cobertura es justo lo que separa a LEGATRUU de su gemelo cubierto). Se
// arma con dos piezas de la misma familia Bloomberg —agregado de EE.UU. y
// tesoro global ex-EE.UU. sin cobertura— en la proporción por moneda del Global
// Aggregate real (~45% USD / ~55% resto).
//
// Los pesos de acá son ABSOLUTOS sobre el compuesto (suman 1): el script los usa
// tal cual (Σ peso × retorno del día). Fuente única: la usan
// `scripts/fondo-benchmark-proxy.ts` y la nota al pie de la página.
export const BENCHMARK_PROXY = {
  componentes: [
    { symbol: "ACWI", nombre: "iShares MSCI ACWI ETF", peso: 0.6 },
    { symbol: "AGG", nombre: "iShares Core U.S. Aggregate Bond ETF", peso: 0.4 * 0.45 },
    { symbol: "BWX", nombre: "SPDR Bloomberg International Treasury Bond ETF", peso: 0.4 * 0.55 },
  ],
  // Texto que se publica al pie del módulo de performance. Decir cómo está
  // hecha la serie es obligatorio: no son los índices, son sus réplicas.
  nota:
    "La serie del benchmark está reconstruida con ETFs que replican esos índices (ACWI, AGG y BWX), " +
    "a precios ajustados por dividendos y con rebalanceo diario. Es una aproximación a los índices " +
    "originales, no su valor oficial.",
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
// Las tres clases son las MISMAS que declara la ficha técnica y los tres paneles
// de <FondoCartera />: renta variable, renta fija y activos alternativos. "ALT"
// no es un cajón de sastre — es la tercera clase del balanceado (Reglamento
// 3.3.1: asignación táctica, tope 20%).
export type HoldingItem = {
  name: string;
  short: string | null;
  assetClass: "RV" | "RF" | "ALT";
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
  // La referencia se ACOTA a la vida del fondo. `fund_benchmark` guarda años de
  // historia —hace falta para poder graficarla sola en pre-lanzamiento—, pero
  // una vez que el fondo tiene serie propia, comparar su «desde inicio» contra
  // el del benchmark desde 2021 no compara nada. Mismo recorte para el gráfico:
  // si no, el eje se abre a cinco años para dibujar dos puntos de fondo.
  // (Si el benchmark empezara DESPUÉS que el fondo no hay nada que recortar: eso
  // es un problema de carga de datos, no de acá.)
  const bench = benchmark.filter((p) => p.dia >= series[0].dia && p.dia <= last.dia);
  return {
    status: "live",
    asOf: last.dia,
    latest: { dia: last.dia, nav: last.nav, aum: last.aum, changeAbs, changePct },
    returns: computeReturns(series),
    calendar: computeCalendar(series),
    stats: computeStats(series),
    series,
    benchmark: bench,
    benchReturns: bench.length > 1 ? computeReturns(bench) : [],
    benchCalendar: bench.length > 1 ? computeCalendar(bench) : [],
    holdings,
  };
}

// Snapshot de PRE-LANZAMIENTO CON BENCHMARK: el Fondo todavía no tiene serie de
// valor cuota propia, pero sí publicamos la evolución del benchmark de
// referencia — es lo único que se puede graficar el día del lanzamiento.
//
// Todo lo del fondo queda vacío/null a propósito: valor cuota, AUM, retornos y
// estadísticas NO se rellenan con los del benchmark. La única serie real acá es
// la de la referencia, y la UI la rotula como tal (ver FondoPerformance). El
// `status` sigue siendo 'pre-launch': el Fondo no tiene historia propia todavía.
export function preLaunchWithBenchmark(
  benchmark: FundNavPoint[],
  holdings: HoldingsSnapshot | null = null,
): FundSnapshot {
  return {
    ...EMPTY_SNAPSHOT,
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

// ── Modo DEMO (presentaciones internas) ──────────────────────────────────────
//
// Enciende una serie de valor cuota SIMULADA para que la página se vea
// exactamente como se verá en régimen: cotización del día, AUM con su
// sparkline, toggle Valor cuota ↔ Base 100, rendimientos, año calendario e
// indicadores de riesgo. Sirve para mostrarle el producto terminado al equipo
// comercial antes de que el custodio publique el primer cierre.
//
// 🚨 SÓLO PARA INSTANCIAS NO PÚBLICAS. La página no distingue estos números de
// los reales —ése es justamente el punto del demo—, así que cualquiera que la
// vea va a leer un track record que el Fondo no tiene. Encenderlo en una
// instancia que alcance a un inversor es publicar rendimientos inventados de un
// fondo regulado por el BCU.
//
// Por eso es un flag EXPLÍCITO de entorno y no un default: apagarlo es no
// setearlo, no hace falta acordarse de limpiar filas de ninguna tabla, y no hay
// forma de que se filtre a un deploy real sin que alguien lo escriba a mano.
// Ver docs/RUNBOOK-fondo.md → "Modo demo".
const DEMO = process.env.FONDO_DEMO === "1";

// Valor cuota simulado DERIVADO del benchmark real: el fondo se mueve con el
// mercado (mismos días, misma textura de una serie real) pero con beta < 1 y un
// poco de alfa, que es como se ve un balanceado de gestión activa. Derivarlo del
// benchmark en vez de inventar una curva hace que las dos líneas del modo Base
// 100 estén correlacionadas —como en la realidad— en lugar de cruzarse raro.
// Determinista: sin Math.random.
function demoNavFromBenchmark(bench: FundNavPoint[]): FundNavPoint[] {
  let nav = 1000;
  return bench.map((p, i) => {
    if (i > 0) {
      const ret = bench[i - 1].nav !== 0 ? bench[i].nav / bench[i - 1].nav - 1 : 0;
      // beta 0,90 + ~1,5% anual de alfa. Modesto a propósito: un demo que
      // muestre al fondo pulverizando a su benchmark le deja a los comerciales
      // una expectativa que después el producto tiene que pagar.
      nav *= 1 + ret * 0.9 + 0.00006;
    }
    // AUM: suscripciones que entran parejo + el efecto del propio rendimiento.
    const aum = Math.round((8_000_000 + i * 18_000) * (nav / 1000));
    return { dia: p.dia, nav: Math.round(nav * 1e4) / 1e4, aum };
  });
}

// Lee la serie publicada de fund_nav (+ benchmark y tenencias) y arma el
// snapshot. Sin datos reales (sin binding D1, tabla vacía o error de query):
// en dev cae al placeholder; en prod, a pre-lanzamiento honesto.
export async function getFundSnapshot(db: D1Database | null): Promise<FundSnapshot> {
  // Las tenencias NO cuelgan de la serie: la cartera es un dato independiente y
  // el Fondo puede publicarla antes del primer valor cuota. Por eso el fallback
  // las recibe — en pre-lanzamiento la página muestra el bloque de composición
  // aunque `fund_nav` esté vacía, en vez de esconderlo por un dato que no tiene
  // nada que ver.
  const fallback = (holdings: HoldingsSnapshot | null = null): FundSnapshot => {
    if (!ALLOW_PLACEHOLDER) return { ...EMPTY_SNAPSHOT, holdings };
    const fund = placeholderSeries();
    return { ...snapshotFromSeries(fund, placeholderBenchmark(fund)), holdings };
  };
  if (!db) return fallback();
  try {
    // Las tres lecturas van en paralelo y cada una degrada sola: sin serie →
    // pre-lanzamiento, sin benchmark → gráfico de una línea, sin snapshot
    // divulgable → sin bloque de tenencias.
    const [series, benchmark, holdings] = await Promise.all([
      readNavSeries(db),
      readBenchmarkSeries(db),
      readLatestHoldings(db),
    ]);
    // Sin serie del fondo pero CON benchmark cargado: pre-lanzamiento con la
    // línea de la referencia. Tiene precedencia sobre el placeholder de dev —si
    // hay datos reales en la base, se muestran los datos reales.
    //
    // El modo demo se cuela sólo acá: mientras el Fondo NO tenga cierres
    // propios. En cuanto haya una fila real en fund_nav manda el dato real,
    // aunque alguien se haya olvidado el flag prendido.
    if (series.length === 0) {
      if (benchmark.length > 1) {
        if (DEMO) {
          console.warn("[fondo] FONDO_DEMO=1 — valor cuota SIMULADO. No exponer esta instancia.");
          return snapshotFromSeries(demoNavFromBenchmark(benchmark), benchmark, holdings);
        }
        return preLaunchWithBenchmark(benchmark, holdings);
      }
      return fallback(holdings);
    }
    return snapshotFromSeries(series, benchmark, holdings);
  } catch (err) {
    // En prod, un error de D1 NO inventa datos: pre-lanzamiento honesto (el
    // cache de 5 min de /api/fondo amortigua los blips transitorios).
    if (!ALLOW_PLACEHOLDER) console.error("[fondo] getFundSnapshot D1 error:", err);
    return fallback();
  }
}
