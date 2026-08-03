// El récord del analizador — cuánto acertó, medido y publicable.
//
// POR QUÉ EXISTE: el informe admite en su propio aviso legal que lo escribió un
// modelo y que no lo revisó un analista. Nadie le confía sus ahorros a eso. Pero
// la casa YA midió la herramienta —scripts/backtest/out/backtest-2026-07-19-20-15,
// 122 veredictos sobre tres cortes— y el orden se sostiene: los BUY le ganaron al
// S&P 500, los AVOID le perdieron. Ese número vive en un PDF interno. Este módulo
// lo convierte en algo que se recalcula solo y se puede publicar.
//
// EL MÉTODO ES EL DEL BACKTEST, A PROPÓSITO. Si el número publicado no coincide
// con el medido, no sirve de nada:
//   · Retorno TOTAL sobre serie AJUSTADA (adjclose ⇒ dividendos reinvertidos).
//   · Menos el retorno del S&P 500 en la MISMA ventana calendario. La afirmación
//     es "le ganó al índice", no "subió" — con el mercado en alza, "subió" no
//     dice nada (el baseline trivial de dirección era 73 %).
//   · Cierre EFECTIVO ≤ fecha objetivo, no el del día exacto: los fines de semana
//     y feriados no tienen vela.
//
// VENTANAS MADURAS vs MARK-TO-MARKET: un veredicto de hace dos meses tiene un
// "exceso a 6 meses" que todavía no terminó. Se computa igual (sirve para el
// seguimiento), pero se marca matured_6m = 0 y el agregado publicado NO lo cuenta.
// Mezclarlos sería inflar la muestra con ventanas incompletas.
//
// COSTO: una llamada de serie diaria por ticker distinto + una del S&P 500. Con
// 52 tickers son ~53 llamadas a Yahoo, así que esto NO puede colgar de un request
// de página: se corre por lock (recomputeRecord) y la página lee record_agg.

import type { D1Database } from "@/lib/metrics";
import { yahooFinance } from "@/lib/fetchStockData";
import { reportError } from "@/lib/errorReporter";

/** Índice de referencia. El backtest usó SPY; cambiarlo invalida la comparación. */
const BENCHMARK = "SPY";

export type Horizon = "6m" | "12m";
export type Rating = "BUY" | "HOLD" | "AVOID";

export type RecordCell = {
  horizon: Horizon;
  rating: Rating | "ALL";
  /** Veredictos con la ventana YA cerrada — los únicos que entran al número. */
  n: number;
  /** Veredictos con la ventana abierta, declarados aparte. */
  nOpen: number;
  excessMed: number | null;
  excessAvg: number | null;
  /** Fracción que salió como la calificación pedía (BUY/HOLD arriba, AVOID abajo). */
  winRate: number | null;
  computedAt: number;
};

// ── Series de precios ────────────────────────────────────────────────────────

type Punto = { day: string; value: number };

/**
 * Velas diarias ajustadas desde 2024 (cubre el archivo entero de verdict_log con
 * margen). Misma llamada que usa el backtest en scripts/backtest/asof.ts.
 */
async function fetchDailyAdjusted(ticker: string): Promise<Punto[]> {
  const res = (await yahooFinance.chart(
    ticker,
    { period1: new Date("2024-01-01"), interval: "1d", return: "array" },
    { validateResult: false },
  )) as { quotes?: Array<{ date: Date; close: number | null; adjclose?: number | null }> };

  const out: Punto[] = [];
  for (const q of res?.quotes ?? []) {
    const v = q.adjclose ?? q.close;
    if (v == null || !Number.isFinite(v) || v <= 0) continue;
    out.push({ day: q.date.toISOString().slice(0, 10), value: v });
  }
  out.sort((a, b) => a.day.localeCompare(b.day));
  return out;
}

/** Último cierre ≤ fecha. La serie viene ordenada ascendente. */
function closeOn(series: Punto[], day: string): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].day <= day) return series[i].value;
  }
  return null;
}

function returnBetween(series: Punto[], from: string, to: string): number | null {
  const a = closeOn(series, from);
  const b = closeOn(series, to);
  return a != null && b != null && a > 0 ? b / a - 1 : null;
}

/** Suma meses de calendario a un 'YYYY-MM-DD'. */
function addMonths(day: string, months: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

// ── Estadística ──────────────────────────────────────────────────────────────

function median(vals: number[]): number | null {
  if (vals.length === 0) return null;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function average(vals: number[]): number | null {
  return vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * Banda de "se movió con el mercado" para el HOLD, en puntos de exceso.
 * Es la del backtest (scripts/backtest/informe-asesores.ts, HOLD_BAND).
 */
const HOLD_BAND = 0.15;

/**
 * ¿Salió como la calificación pedía? Es LA MISMA regla que declara el backtest
 * interno, y eso no es un detalle: si el número publicado se calcula con otra
 * regla que el medido, la casa termina contradiciéndose con su propio informe de
 * asesores.
 *
 *   · BUY   acierta si le ganó al índice.
 *   · AVOID acierta si le perdió — que es exactamente lo que anticipaba.
 *   · HOLD  acierta si se movió CON el mercado (±15 pts de exceso). Ojo con la
 *     tentación de tratarlo como un BUY: un HOLD que le ganó al índice por 40
 *     puntos no fue un buen HOLD, fue un BUY que no se emitió. Medirlo como
 *     "exceso > 0" infla el acierto del rating más frecuente de todos.
 *
 * La regla va escrita en la página del récord. Una regla de acierto sin declarar
 * es la forma más barata de publicar un récord que no significa nada.
 */
function acerto(rating: Rating, excess: number): boolean {
  if (rating === "BUY") return excess > 0;
  if (rating === "AVOID") return excess < 0;
  return Math.abs(excess) <= HOLD_BAND;
}

// ── Recómputo ────────────────────────────────────────────────────────────────

type VerdictRow = {
  id: number; ts: number; ticker: string; rating: string;
  price_target: number | null; bull_target: number | null; bear_target: number | null;
};

/** Cuánto vale un recómputo antes de considerarse viejo. */
const TTL_MS = 20 * 60 * 60 * 1000; // 20 h — una vez por día hábil

/** ¿Hace falta recomputar? */
export async function recordIsStale(db: D1Database): Promise<boolean> {
  const r = await db
    .prepare("SELECT MAX(computed_at) AS t FROM record_agg")
    .first<{ t: number | null }>();
  return !r?.t || Date.now() - r.t > TTL_MS;
}

/**
 * Recalcula todo el récord: retornos por veredicto y agregados publicados.
 *
 * Serializado por ticker con una pausa corta entre llamadas — Yahoo tolera mal
 * las ráfagas, y esto corre en background donde el tiempo no importa. Devuelve
 * el resumen de lo hecho para que el panel lo muestre.
 */
export async function recomputeRecord(
  db: D1Database,
  { pausaMs = 120 }: { pausaMs?: number } = {},
): Promise<{ veredictos: number; tickers: number; conRetorno: number; errores: string[] }> {
  const errores: string[] = [];

  const vres = await db
    .prepare(
      "SELECT id, ts, ticker, rating, price_target, bull_target, bear_target FROM verdict_log " +
      "WHERE rating IN ('BUY','HOLD','AVOID') ORDER BY ts ASC",
    )
    .all<VerdictRow>();
  const veredictos = vres.results ?? [];
  if (veredictos.length === 0) return { veredictos: 0, tickers: 0, conRetorno: 0, errores };

  const tickers = [...new Set(veredictos.map((v) => v.ticker.toUpperCase()))];

  // El índice primero: sin él no hay exceso que calcular y no vale la pena
  // gastar 52 llamadas.
  let spy: Punto[];
  try {
    spy = await fetchDailyAdjusted(BENCHMARK);
  } catch (err) {
    reportError("recordStore/benchmark", err);
    throw new Error(`No se pudo traer la serie de ${BENCHMARK}; sin índice no hay exceso.`);
  }
  if (spy.length === 0) throw new Error(`Serie de ${BENCHMARK} vacía.`);

  const hoy = new Date().toISOString().slice(0, 10);
  const filas: FilaFull[] = [];

  for (const t of tickers) {
    let serie: Punto[];
    try {
      serie = await fetchDailyAdjusted(t);
    } catch (err) {
      errores.push(`${t}: serie no disponible`);
      reportError("recordStore/serie", err, { ticker: t });
      continue;
    }
    if (serie.length === 0) { errores.push(`${t}: serie vacía`); continue; }

    for (const v of veredictos.filter((x) => x.ticker.toUpperCase() === t)) {
      const day = new Date(v.ts).toISOString().slice(0, 10);
      const d6 = addMonths(day, 6);
      const d12 = addMonths(day, 12);
      // Ventana cerrada = la fecha objetivo ya pasó. Si no, se mide hasta hoy
      // (mark-to-market) y se marca abierta.
      const mat6 = d6 <= hoy ? 1 : 0;
      const mat12 = d12 <= hoy ? 1 : 0;
      const fin6 = mat6 ? d6 : hoy;
      const fin12 = mat12 ? d12 : hoy;

      const ret6 = returnBetween(serie, day, fin6);
      const s6 = returnBetween(spy, day, fin6);
      const ret12 = returnBetween(serie, day, fin12);
      const s12 = returnBetween(spy, day, fin12);

      // Precisión del target. Se mide contra el precio EFECTIVO al cierre de la
      // ventana, no contra el retorno: el target es un precio, así que el error
      // tiene que ser un error de precio.
      const p0 = closeOn(serie, day);
      const a6 = closeOn(serie, fin6);
      const a12 = closeOn(serie, fin12);
      const tgt = v.price_target;
      const errRel = (actual: number | null) =>
        tgt != null && actual != null && actual > 0 ? Math.abs(tgt / actual - 1) : null;
      // Dirección: ¿el target apuntaba al mismo lado al que el precio se movió?
      // Con target == p0 exacto (raro) no hay dirección que evaluar → null.
      const dirOk = (actual: number | null) => {
        if (tgt == null || p0 == null || actual == null || tgt === p0) return null;
        return (tgt > p0) === (actual > p0) ? 1 : 0;
      };
      const inRange = (actual: number | null) => {
        if (v.bull_target == null || v.bear_target == null || actual == null) return null;
        const lo = Math.min(v.bear_target, v.bull_target);
        const hi = Math.max(v.bear_target, v.bull_target);
        return actual >= lo && actual <= hi ? 1 : 0;
      };
      const subio = (actual: number | null) =>
        p0 != null && actual != null ? (actual > p0 ? 1 : 0) : null;

      filas.push({
        id: v.id, ticker: t, rating: v.rating, day,
        priceAt: p0,
        ret6, spy6: s6, ex6: ret6 != null && s6 != null ? ret6 - s6 : null, mat6,
        ret12, spy12: s12, ex12: ret12 != null && s12 != null ? ret12 - s12 : null, mat12,
        targetAt: tgt, bullAt: v.bull_target, bearAt: v.bear_target,
        actual6: a6, actual12: a12,
        absErr6: errRel(a6), absErr12: errRel(a12),
        dirOk6: dirOk(a6), dirOk12: dirOk(a12),
        inRange6: inRange(a6), inRange12: inRange(a12),
        up6: subio(a6), up12: subio(a12),
      });
    }

    if (pausaMs > 0) await new Promise((r) => setTimeout(r, pausaMs));
  }

  const ahora = Date.now();

  // Reemplazo completo: es cache derivado, así que se rehace en vez de conciliar.
  // En batch para que la tabla nunca quede a medias.
  const stmts = [db.prepare("DELETE FROM verdict_return")];
  for (const f of filas) {
    stmts.push(
      db.prepare(
        "INSERT INTO verdict_return (verdict_id, ticker, rating, verdict_day, price_at, " +
        "ret_6m, spy_6m, excess_6m, ret_12m, spy_12m, excess_12m, matured_6m, matured_12m, " +
        "target_at, bull_at, bear_at, actual_6m, actual_12m, abs_err_6m, abs_err_12m, " +
        "dir_ok_6m, dir_ok_12m, in_range_6m, in_range_12m, up_6m, up_12m, computed_at) " +
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      ).bind(
        f.id, f.ticker, f.rating, f.day, f.priceAt,
        f.ret6, f.spy6, f.ex6, f.ret12, f.spy12, f.ex12, f.mat6, f.mat12,
        f.targetAt, f.bullAt, f.bearAt, f.actual6, f.actual12, f.absErr6, f.absErr12,
        f.dirOk6, f.dirOk12, f.inRange6, f.inRange12, f.up6, f.up12, ahora,
      ),
    );
  }
  await db.batch(stmts);

  await recomputeAggregates(db, filas, ahora);
  await recomputeTargetAggregates(db, filas, ahora);

  return {
    veredictos: veredictos.length,
    tickers: tickers.length,
    conRetorno: filas.filter((f) => f.ex6 != null).length,
    errores,
  };
}

/** Fila completa de cómputo — lo que entra a verdict_return. */
type FilaFull = {
  id: number; ticker: string; rating: string; day: string; priceAt: number | null;
  ret6: number | null; spy6: number | null; ex6: number | null; mat6: number;
  ret12: number | null; spy12: number | null; ex12: number | null; mat12: number;
  targetAt: number | null; bullAt: number | null; bearAt: number | null;
  actual6: number | null; actual12: number | null;
  absErr6: number | null; absErr12: number | null;
  dirOk6: number | null; dirOk12: number | null;
  inRange6: number | null; inRange12: number | null;
  up6: number | null; up12: number | null;
};

type FilaCalc = { rating: string; ex6: number | null; ex12: number | null; mat6: number; mat12: number };

/** Lo que necesita el agregado de precisión del target. */
type FilaTarget = Pick<
  FilaFull,
  "mat6" | "mat12" | "absErr6" | "absErr12" | "dirOk6" | "dirOk12" | "inRange6" | "inRange12" | "up6" | "up12"
>;

/**
 * Precisión del precio objetivo, por horizonte. Sólo ventanas MADURAS: un error
 * de pronóstico contra una ventana sin cerrar no significa nada.
 */
async function recomputeTargetAggregates(db: D1Database, filas: FilaTarget[], ahora: number): Promise<void> {
  const stmts = [db.prepare("DELETE FROM record_target_agg")];

  for (const horizon of ["6m", "12m"] as Horizon[]) {
    const es6 = horizon === "6m";
    const maduras = filas.filter((f) => (es6 ? f.mat6 : f.mat12) === 1);

    const errs = maduras.map((f) => (es6 ? f.absErr6 : f.absErr12)).filter((v): v is number => v != null);
    const dirs = maduras.map((f) => (es6 ? f.dirOk6 : f.dirOk12)).filter((v): v is number => v != null);
    const ups = maduras.map((f) => (es6 ? f.up6 : f.up12)).filter((v): v is number => v != null);
    const rangos = maduras.map((f) => (es6 ? f.inRange6 : f.inRange12)).filter((v): v is number => v != null);

    stmts.push(
      db.prepare(
        "INSERT INTO record_target_agg (horizon, n, mae, dir_rate, baseline_dir_rate, in_range_n, in_range_rate, computed_at) " +
        "VALUES (?,?,?,?,?,?,?,?)",
      ).bind(
        horizon,
        errs.length,
        average(errs),
        dirs.length > 0 ? dirs.reduce((a, b) => a + b, 0) / dirs.length : null,
        // Baseline trivial "siempre sube": su acierto ES la fracción que subió.
        ups.length > 0 ? ups.reduce((a, b) => a + b, 0) / ups.length : null,
        rangos.length,
        rangos.length > 0 ? rangos.reduce((a, b) => a + b, 0) / rangos.length : null,
        ahora,
      ),
    );
  }

  await db.batch(stmts);
}

/**
 * Rehace SÓLO los agregados, leyendo verdict_return. Sirve cuando cambia una
 * regla de presentación —la banda del HOLD, por ejemplo— y no hay ninguna razón
 * para volver a pedirle 53 series a Yahoo por eso.
 */
export async function recomputeAggregatesFromStored(db: D1Database): Promise<number> {
  const res = await db
    .prepare(
      "SELECT rating, excess_6m, excess_12m, matured_6m, matured_12m, " +
      "abs_err_6m, abs_err_12m, dir_ok_6m, dir_ok_12m, in_range_6m, in_range_12m, up_6m, up_12m " +
      "FROM verdict_return",
    )
    .all<{
      rating: string; excess_6m: number | null; excess_12m: number | null;
      matured_6m: number; matured_12m: number;
      abs_err_6m: number | null; abs_err_12m: number | null;
      dir_ok_6m: number | null; dir_ok_12m: number | null;
      in_range_6m: number | null; in_range_12m: number | null;
      up_6m: number | null; up_12m: number | null;
    }>();
  const filas = (res.results ?? []).map((r) => ({
    rating: r.rating,
    ex6: r.excess_6m, ex12: r.excess_12m,
    mat6: r.matured_6m, mat12: r.matured_12m,
    absErr6: r.abs_err_6m, absErr12: r.abs_err_12m,
    dirOk6: r.dir_ok_6m, dirOk12: r.dir_ok_12m,
    inRange6: r.in_range_6m, inRange12: r.in_range_12m,
    up6: r.up_6m, up12: r.up_12m,
  }));
  const ahora = Date.now();
  await recomputeAggregates(db, filas, ahora);
  await recomputeTargetAggregates(db, filas, ahora);
  return filas.length;
}

async function recomputeAggregates(db: D1Database, filas: FilaCalc[], ahora: number): Promise<void> {
  const RATINGS: Rating[] = ["BUY", "HOLD", "AVOID"];
  const stmts = [db.prepare("DELETE FROM record_agg")];

  for (const horizon of ["6m", "12m"] as Horizon[]) {
    const ex = (f: FilaCalc) => (horizon === "6m" ? f.ex6 : f.ex12);
    const mat = (f: FilaCalc) => (horizon === "6m" ? f.mat6 : f.mat12);

    const push = (rating: Rating | "ALL", subset: FilaCalc[]) => {
      const maduros = subset.filter((f) => mat(f) === 1 && ex(f) != null);
      const abiertos = subset.filter((f) => mat(f) === 0).length;
      const vals = maduros.map((f) => ex(f) as number);
      // El win rate de 'ALL' no tiene sentido: mezclaría "le ganó al índice" con
      // "le perdió" como si fueran el mismo acierto. Queda null y no se publica.
      const wins =
        rating === "ALL"
          ? null
          : vals.length > 0
            ? maduros.filter((f) => acerto(rating, ex(f) as number)).length / vals.length
            : null;
      stmts.push(
        db.prepare(
          "INSERT INTO record_agg (horizon, rating, n, n_open, excess_med, excess_avg, win_rate, computed_at) " +
          "VALUES (?,?,?,?,?,?,?,?)",
        ).bind(horizon, rating, vals.length, abiertos, median(vals), average(vals), wins, ahora),
      );
    };

    for (const r of RATINGS) push(r, filas.filter((f) => f.rating === r));
    push("ALL", filas);
  }

  await db.batch(stmts);
}

// ── Lectura para la página ───────────────────────────────────────────────────

/** Precisión del precio objetivo — la parte que el récord publica como límite. */
export type TargetAccuracy = {
  horizon: Horizon;
  n: number;
  /** Error absoluto medio, en fracción (0.228 = 22,8 %). */
  mae: number | null;
  /** Acierto de dirección del target. */
  dirRate: number | null;
  /** Acierto del pronóstico trivial "siempre sube", en la misma muestra. */
  baselineDirRate: number | null;
  inRangeN: number;
  /** Fracción con el precio real dentro del rango bajista-alcista. */
  inRangeRate: number | null;
};

export type RecordSnapshot = {
  cells: RecordCell[];
  targets: TargetAccuracy[];
  computedAt: number | null;
  /** Rango del archivo medido, para poder decir "desde cuándo". */
  desde: string | null;
  hasta: string | null;
  tickers: number;
};

export async function readRecord(db: D1Database): Promise<RecordSnapshot> {
  const [agg, meta, tgt] = await Promise.all([
    db
      .prepare(
        "SELECT horizon, rating, n, n_open, excess_med, excess_avg, win_rate, computed_at FROM record_agg",
      )
      .all<{
        horizon: string; rating: string; n: number; n_open: number;
        excess_med: number | null; excess_avg: number | null; win_rate: number | null; computed_at: number;
      }>(),
    db
      .prepare(
        "SELECT MIN(verdict_day) AS desde, MAX(verdict_day) AS hasta, COUNT(DISTINCT ticker) AS tickers FROM verdict_return",
      )
      .first<{ desde: string | null; hasta: string | null; tickers: number }>(),
    db
      .prepare(
        "SELECT horizon, n, mae, dir_rate, baseline_dir_rate, in_range_n, in_range_rate FROM record_target_agg",
      )
      .all<{
        horizon: string; n: number; mae: number | null; dir_rate: number | null;
        baseline_dir_rate: number | null; in_range_n: number; in_range_rate: number | null;
      }>(),
  ]);

  const cells: RecordCell[] = (agg.results ?? []).map((r) => ({
    horizon: r.horizon as Horizon,
    rating: r.rating as Rating | "ALL",
    n: r.n,
    nOpen: r.n_open,
    excessMed: r.excess_med,
    excessAvg: r.excess_avg,
    winRate: r.win_rate,
    computedAt: r.computed_at,
  }));

  const targets: TargetAccuracy[] = (tgt.results ?? []).map((r) => ({
    horizon: r.horizon as Horizon,
    n: r.n,
    mae: r.mae,
    dirRate: r.dir_rate,
    baselineDirRate: r.baseline_dir_rate,
    inRangeN: r.in_range_n,
    inRangeRate: r.in_range_rate,
  }));

  return {
    cells,
    targets,
    computedAt: cells.length > 0 ? Math.max(...cells.map((c) => c.computedAt)) : null,
    desde: meta?.desde ?? null,
    hasta: meta?.hasta ?? null,
    tickers: meta?.tickers ?? 0,
  };
}

/** Atajo tipado: la precisión del target en un horizonte. */
export function targetAccuracy(snap: RecordSnapshot, horizon: Horizon): TargetAccuracy | null {
  return snap.targets.find((t) => t.horizon === horizon) ?? null;
}

/** Atajo tipado para la página: la celda de un (horizonte, rating). */
export function cell(snap: RecordSnapshot, horizon: Horizon, rating: Rating | "ALL"): RecordCell | null {
  return snap.cells.find((c) => c.horizon === horizon && c.rating === rating) ?? null;
}
