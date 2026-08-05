"use client";

import { useMemo, useState } from "react";
import type { FundNavPoint, ReturnKey } from "@/lib/fondo";
import { BENCHMARK, BENCHMARK_PROXY, MONEDA } from "@/lib/fondo";
import { useFondo, fmtNav, fmtIndex, fmtPct, fmtAum, fmtFechaCorta } from "@/lib/useFondo";
import { FondoChart } from "@/components/institucional/FondoChart";
import { PeriodSlider } from "@/components/institucional/PeriodSlider";

// Módulo de performance: selector de períodos + gráfico del valor cuota +
// rendimientos acumulados, por año calendario y estadísticas derivadas de la
// serie. Réplica de la pestaña Performance de las referencias (Vontobel /
// SSGA). Pre-lanzamiento muestra el andamiaje completo con "—" — sin inventar
// cifras. Cuando llegue el feed, todo se puebla solo.

type PeriodId = "1M" | "3M" | "YTD" | "1A" | "SI";
type ChartView = "cuota" | "base100";
const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "1M", label: "1M" },
  { id: "3M", label: "3M" },
  { id: "YTD", label: "YTD" },
  { id: "1A", label: "1A" },
  { id: "SI", label: "Máx" },
];

// Glosa bajo el chip de la cotización: qué ventana mide el porcentaje.
const PERIOD_GLOSS: Record<PeriodId, string> = {
  "1M": "último mes",
  "3M": "últimos 3 meses",
  YTD: "en el año",
  "1A": "último año",
  SI: "desde el inicio",
};

// El chip no recalcula sobre la ventana visible: toma el rendimiento que ya
// computa el server (YTD contra el cierre del año anterior, 1M contra el punto
// on-or-before, etc.). Derivarlo del primer punto de la ventana daría otro
// número que contradiría la tabla de rentabilidad acumulada de más abajo.
const PERIOD_RETURN: Record<PeriodId, ReturnKey> = {
  "1M": "1M",
  "3M": "3M",
  YTD: "YTD",
  "1A": "1Y",
  SI: "SI",
};

function isoMinusMonths(dia: string, months: number): string {
  const [y, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 - months, d)).toISOString().slice(0, 10);
}

function windowFor(series: FundNavPoint[], period: PeriodId): FundNavPoint[] {
  if (series.length === 0) return series;
  const last = series[series.length - 1].dia;
  let from: string;
  if (period === "SI") return series;
  else if (period === "YTD") from = `${last.slice(0, 4)}-01-01`;
  else if (period === "1M") from = isoMinusMonths(last, 1);
  else if (period === "3M") from = isoMinusMonths(last, 3);
  else from = isoMinusMonths(last, 12);
  const win = series.filter((p) => p.dia >= from);
  return win.length >= 2 ? win : series;
}

// Reescala una serie a base 100 en su primer punto del período visible — para
// comparar la evolución relativa de fondo y benchmark partiendo del mismo
// origen. Devuelve la serie intacta si no hay un primer valor utilizable.
function rebase100(rows: FundNavPoint[]): FundNavPoint[] {
  if (rows.length === 0) return rows;
  const base = rows[0].nav;
  if (!base) return rows;
  return rows.map((p) => ({ ...p, nav: (p.nav / base) * 100 }));
}

// ⚠️ ACÁ VIVÍA EL MODO "SÓLO BENCHMARK" (jul-2026 → 3-ago-2026).
//
// Mientras el Fondo no publicaba valor cuota, el gráfico dibujaba igual la
// serie del benchmark, y su vista en USD la expresaba como una cuota
// HIPOTÉTICA de 1.000 — misma curva del compuesto 60/40, sólo multiplicada por
// una constante, con el rótulo, la unidad del eje y el pie aclarándolo.
//
// Se sacó por decisión del cliente: en la página de un fondo, una curva que
// sube de 1.000 a 1.300 con el eje en USD se lee como el track record del
// fondo, por más que cuatro avisos digan lo contrario. El benchmark vuelve al
// gráfico cuando haya serie propia contra la cual compararlo, que es el único
// trabajo que tiene que hacer. Hasta entonces, el marco del gráfico muestra el
// aviso de «Próximamente» (ver el estado vacío, más abajo).

// Sparkline del AUM (mini-área) para el header: la tendencia del tamaño del
// fondo de un vistazo, sin ejes ni interacción (la cifra exacta vive al lado).
// SVG inline — hairline navy + relleno suave, en línea con el lenguaje visual.
function AumSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 92, H = 26, padX = 2, padY = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const n = values.length;
  const px = (i: number) => padX + (i / (n - 1)) * (W - 2 * padX);
  const py = (v: number) => padY + (H - 2 * padY) * (1 - (v - min) / span);
  const pts = values.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`);
  const line = `M${pts.join(" L")}`;
  const area = `M${px(0).toFixed(1)},${H} L${pts.join(" L")} L${px(n - 1).toFixed(1)},${H} Z`;
  return (
    <svg
      className="perf-spark"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label="Evolución de activos bajo manejo desde el inicio"
    >
      <title>Evolución de activos bajo manejo desde el inicio</title>
      <path className="perf-spark-area" d={area} />
      <path className="perf-spark-line" d={line} />
      <circle className="perf-spark-dot" cx={px(n - 1)} cy={py(values[n - 1])} r={1.8} />
    </svg>
  );
}

export function FondoPerformance() {
  const state = useFondo();
  const [period, setPeriod] = useState<PeriodId>("SI");
  const [view, setView] = useState<ChartView>("cuota");

  const data = state.kind === "ready" ? state.data : null;
  const live = !!(data && data.status === "live" && data.series.length > 1);
  const series = useMemo(
    () => (live && data ? windowFor(data.series, period) : []),
    [live, data, period],
  );
  // La serie del benchmark ya llega alineada a la vida del fondo desde el server
  // (snapshotFromSeries la recorta), así que acá sólo se le aplica el período.
  // Sin serie del fondo NO se usa: la referencia existe para comparar, no para
  // ocupar el lugar de la curva que falta (ver el comentario de arriba).
  const benchSeries = useMemo(
    () => (live && data && data.benchmark.length > 0 ? windowFor(data.benchmark, period) : []),
    [live, data, period],
  );
  // Datos que entran al gráfico de rendimiento según el modo del slider:
  //   "cuota":   valor cuota real del fondo, una línea, eje en USD.
  //   "base100": fondo + benchmark reescalados a 100 en el primer punto del
  //              período (origen común para leer la evolución relativa); el eje
  //              pasa a índice. El benchmark sólo aparece en este modo.
  // Sin serie del fondo no se arma gráfico: el marco muestra el aviso.
  const chart = useMemo(() => {
    if (view === "base100") {
      return { series: rebase100(series), benchmark: rebase100(benchSeries), format: fmtIndex };
    }
    return { series, benchmark: [] as FundNavPoint[], format: fmtNav };
  }, [view, series, benchSeries]);
  // Valores de AUM (historia completa) para el sparkline del header: la
  // tendencia del tamaño del fondo desde el inicio. No se ata al período — es un
  // resumen del dato, no un gráfico interactivo (el AUM es tamaño, no rendimiento).
  const aumSpark = useMemo(
    () => (data?.series ?? []).filter((p) => p.aum != null).map((p) => p.aum as number),
    [data],
  );
  const returns = data?.returns ?? [];
  const benchReturns = data?.benchReturns ?? [];
  const calendar = data?.calendar ?? [];
  const benchCalendar = data?.benchCalendar ?? [];
  const stats = data?.stats ?? null;
  // El API sigue mandando los rendimientos del benchmark en pre-lanzamiento —no
  // cuesta nada y el día del lanzamiento no hay que tocar el server—, pero acá
  // sólo entran a las tablas cuando hay fondo con qué comparar. Una fila de
  // benchmark con cifras reales al lado de una fila de fondo toda en «—» es el
  // mismo problema que la curva sola: se lee como el rendimiento del Fondo.
  const hasBench = live && benchReturns.length > 0;

  // Etiquetas de columna (cortas) por período — convención de ficha en español.
  const COL_LABEL: Record<ReturnKey, string> = {
    "1M": "1 mes",
    "3M": "3 meses",
    YTD: "En el año",
    "1Y": "1 año",
    SI: "Desde inicio",
  };

  // Lookups por año para las dos filas de la tabla calendario.
  const fundByYear = new Map(calendar.map((c) => [c.year, c.pct]));
  const benchByYear = new Map(benchCalendar.map((c) => [c.year, c.pct]));
  // Años que van como columnas (cronológico, izq.→der.): los del fondo. En
  // pre-lanzamiento no hay ninguno y el bloque muestra su propia línea — no se
  // rellena con los del benchmark, que arrancó cinco años antes que el Fondo.
  const calYears = [...calendar].reverse().map((c) => c.year);
  // Lookup del bench por período — para la tabla transpuesta de mobile.
  const benchByKey = new Map(benchReturns.map((r) => [r.key, r.pct]));
  // Cierre más reciente en pantalla. Marca si el último año calendario va parcial.
  const ultimoDia = data?.asOf ?? null;
  const lastIsPartial =
    ultimoDia != null &&
    calYears.length > 0 &&
    calYears[calYears.length - 1] === Number(ultimoDia.slice(0, 4)) &&
    ultimoDia.slice(5) !== "12-31";

  // Indicadores de riesgo — derivados de la serie NAV. Se muestran sólo los dos
  // más estables (volatilidad y retorno anualizado); drawdown, mejor/peor mes y
  // meses positivos se retiraron a pedido del responsable del fondo. No hay
  // Sharpe porque exige un supuesto de tasa libre de riesgo que no vamos a inventar.
  const riskItems: { label: string; value: string; sub?: string; accent?: "up" | "down" }[] = [
    { label: "Volatilidad (1A)", value: stats?.vol1y != null ? fmtPct(stats.vol1y, false) : "—" },
    {
      label: "Retorno anualizado",
      value: stats?.annualizedSI != null ? fmtPct(stats.annualizedSI) : "—",
      accent: stats?.annualizedSI != null ? (stats.annualizedSI >= 0 ? "up" : "down") : undefined,
    },
  ];

  const latest = data?.latest ?? null;
  // Variación del período elegido en el slider — sigue al gráfico, no al día.
  const periodPct = returns.find((r) => r.key === PERIOD_RETURN[period])?.pct ?? null;

  // Qué ocupa el marco del gráfico cuando no hay serie del fondo. Son TRES
  // estados distintos y hay que distinguirlos: mientras carga no se puede
  // afirmar todavía que el Fondo no opera, y un error de red no es un estado
  // del producto. El de pre-lanzamiento es el único que lleva el aviso de
  // «Próximamente» —los otros dos son transitorios y se resuelven solos, así
  // que no merecen un rótulo permanente.
  const estadoVacio: "cargando" | "error" | "prelanzamiento" =
    state.kind === "loading" ? "cargando" : state.kind === "error" ? "error" : "prelanzamiento";

  return (
    <div className="perf">
      {/* Cotización al día — único lugar de la página con el dato vivo. */}
      <div className="perf-quote">
        <div className="perf-quote-main">
          {/* La moneda va pegada a la cifra y DESPUÉS de ella —convención de
              ficha de fondo—, en marca chica: primero se lee el número. Debajo,
              el cierre al que corresponde ese valor cuota. */}
          <span className="perf-quote-navwrap">
            <span className="perf-quote-nav">
              {latest ? (
                <>
                  {fmtNav(latest.nav)}
                  <span className="perf-quote-cur">{MONEDA}</span>
                </>
              ) : (
                "—"
              )}
            </span>
            {latest && data?.asOf && (
              <span className="perf-quote-navdate">{fmtFechaCorta(data.asOf)}</span>
            )}
          </span>
          {latest && (
            <span className="perf-quote-delta">
              {/* Sin dato para el período (serie más corta que la ventana) el
                  chip va en pizarra: no se inventa un signo que no se sabe. */}
              <span
                className="perf-quote-day"
                data-accent={periodPct == null ? "neu" : periodPct >= 0 ? "up" : "down"}
              >
                {fmtPct(periodPct)}
              </span>
              <em>{PERIOD_GLOSS[period]}</em>
            </span>
          )}
        </div>
        <div className="perf-quote-side">
          <span className="perf-quote-aum">
            <em>Activos bajo manejo</em>
            <span className="perf-quote-aum-val">
              {latest && latest.aum != null ? `${fmtAum(latest.aum)} ${MONEDA}` : "—"}
            </span>
            {live && aumSpark.length > 1 && <AumSparkline values={aumSpark} />}
          </span>
          {/* La fecha del dato vive ahora bajo el valor cuota; a la derecha sólo
              queda la cadencia, y sólo mientras no haya un cierre publicado. */}
          {!(latest && data?.asOf) && <span className="perf-quote-asof">Actualización diaria</span>}
        </div>
      </div>

      <div className="perf-bar">
        {live ? (
          <div className="perf-view" data-active={view} role="tablist" aria-label="Modo del gráfico">
            <span className="perf-view-thumb" aria-hidden />
            <button
              role="tab"
              aria-selected={view === "cuota"}
              className="perf-view-btn"
              onClick={() => setView("cuota")}
            >
              Valor cuota
            </button>
            <button
              role="tab"
              aria-selected={view === "base100"}
              className="perf-view-btn"
              onClick={() => setView("base100")}
            >
              Base 100
            </button>
          </div>
        ) : (
          // Sin serie del fondo el toggle no tiene entre qué elegir: en su lugar
          // va el rótulo de lo que el marco de abajo va a mostrar.
          <span className="perf-bar-label">Evolución del valor cuota</span>
        )}
        <PeriodSlider periods={PERIODS} value={period} onChange={setPeriod} disabled={!live} />
      </div>

      <div className="perf-chart-frame">
        {live ? (
          <FondoChart
            series={chart.series}
            benchmark={chart.benchmark}
            formatValue={chart.format}
            unitLabel={view === "base100" ? "Índice · base 100" : MONEDA}
            seriesLabel="BNG Selección Global"
            benchLabel={BENCHMARK.corto}
            lineKind="fund"
          />
        ) : (
          // El aviso ocupa el LUGAR del gráfico —centrado, con el mismo alto que
          // tendría la curva— en vez de ir arriba o abajo del marco: el hueco es
          // justamente lo que hay que explicar, y una nota al costado deja al
          // lector mirando un rectángulo vacío preguntándose si algo falló.
          <div className="perf-empty">
            {estadoVacio === "prelanzamiento" ? (
              <>
                {/* El oro, una sola palabra: es el acento de identidad de la
                    casa, y acá marca un ESTADO, no un dato (docs/lenguaje-visual). */}
                <span className="perf-empty-eyebrow">Próximamente</span>
                {/* ⚠️ NO atar esta frase al arranque del Fondo ("en cuanto
                    comience a operar"). El Fondo empieza a operar ANTES de que
                    su valor cuota llegue a esta página —hay una ventana de una
                    o dos semanas entre una cosa y la otra—, y en esa ventana
                    una promesa así queda desmentida por los hechos: el Fondo
                    opera y acá no hay nada. La frase habla de la PUBLICACIÓN,
                    que es lo único que este módulo controla. Sin fecha: en la
                    página de un fondo del BCU, un plazo público que se corre es
                    peor que no haberlo dado. */}
                <p className="perf-empty-title">
                  El valor cuota se publicará aquí en las próximas semanas.
                </p>
                {/* Sólo la cadencia. Enumerar acá lo que el módulo va a traer
                    —evolución, rendimientos por período, año calendario— era
                    redundante: los tres bloques ya están abajo, rotulados y en
                    «—», así que el lector los tiene a la vista. */}
                <p className="perf-empty-sub">Con actualización diaria.</p>
              </>
            ) : (
              <p className="perf-empty-title">
                {estadoVacio === "cargando"
                  ? "Cargando datos del fondo…"
                  : "No pudimos cargar los datos del fondo en este momento."}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="perf-data">
        {/* Rentabilidad acumulada — fondo vs benchmark, períodos en columnas. */}
        <section className="perf-block">
          <div className="perf-block-head">
            <h3>Rentabilidad acumulada</h3>
            {ultimoDia && <span className="perf-asof">al {fmtFechaCorta(ultimoDia)}</span>}
          </div>
          <div className="perf-table-scroll">
            <table className="perf-grid">
              <thead>
                <tr>
                  <th scope="col" aria-label="Serie" />
                  {returns.map((r) => (
                    <th key={r.key} scope="col">{COL_LABEL[r.key]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Fondo</th>
                  {returns.map((r) => (
                    <td key={r.key} data-accent={r.pct == null ? "" : r.pct >= 0 ? "up" : "down"}>
                      {fmtPct(r.pct)}
                    </td>
                  ))}
                </tr>
                {hasBench && (
                  <tr className="perf-bench">
                    <th scope="row">{BENCHMARK.corto}</th>
                    {benchReturns.map((r) => (
                      <td key={r.key} data-accent={r.pct == null ? "" : r.pct >= 0 ? "up" : "down"}>
                        {fmtPct(r.pct)}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Mobile: transpuesta (períodos en filas) para entrar sin scroll. */}
          <table className="perf-grid perf-grid--mobile">
            <thead>
              <tr>
                <th scope="col" aria-label="Período" />
                <th scope="col">Fondo</th>
                {hasBench && <th scope="col">{BENCHMARK.corto}</th>}
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => {
                const b = benchByKey.get(r.key) ?? null;
                return (
                  <tr key={r.key}>
                    <th scope="row">{COL_LABEL[r.key]}</th>
                    <td data-accent={r.pct == null ? "" : r.pct >= 0 ? "up" : "down"}>
                      {fmtPct(r.pct)}
                    </td>
                    {hasBench && (
                      <td className="perf-bench-cell" data-accent={b == null ? "" : b >= 0 ? "up" : "down"}>
                        {fmtPct(b)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="perf-foot">
            Cifras netas en USD. «Desde inicio» es la rentabilidad acumulada desde el inicio del fondo; el resto, del período indicado.
            {/* La fila entera en «—» necesita decir POR QUÉ está vacía: sin esto
                se lee como un error de carga, no como el estado del producto.
                Dice «pendiente de publicación» y no «el fondo aún no registra
                rendimientos»: una vez que el Fondo arranque va a registrarlos
                durante un par de semanas antes de que aparezcan acá, y negarlo
                sería falso. */}
            {!live && <> El primer valor cuota del Fondo está pendiente de publicación.</>}
          </p>
        </section>

        {/* Rentabilidad por año calendario — años en columnas. */}
        <section className="perf-block">
          <div className="perf-block-head">
            <h3>Rentabilidad por año calendario</h3>
          </div>
          {calYears.length > 0 ? (
            <>
              <div className="perf-table-scroll">
                <table className="perf-grid">
                  <thead>
                    <tr>
                      <th scope="col" aria-label="Serie" />
                      {calYears.map((y) => (
                        <th key={y} scope="col">{y}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Fondo</th>
                      {calYears.map((y) => {
                        const f = fundByYear.get(y);
                        return (
                          <td key={y} data-accent={f == null ? "" : f >= 0 ? "up" : "down"}>
                            {fmtPct(f ?? null)}
                          </td>
                        );
                      })}
                    </tr>
                    {hasBench && (
                      <tr className="perf-bench">
                        <th scope="row">{BENCHMARK.corto}</th>
                        {calYears.map((y) => {
                          const b = benchByYear.get(y);
                          return (
                            <td key={y} data-accent={b == null ? "" : b >= 0 ? "up" : "down"}>
                              {fmtPct(b ?? null)}
                            </td>
                          );
                        })}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Mobile: transpuesta (años en filas) para entrar sin scroll. */}
              <table className="perf-grid perf-grid--mobile">
                <thead>
                  <tr>
                    <th scope="col" aria-label="Año" />
                    <th scope="col">Fondo</th>
                    {hasBench && <th scope="col">{BENCHMARK.corto}</th>}
                  </tr>
                </thead>
                <tbody>
                  {calYears.map((y) => {
                    const f = fundByYear.get(y);
                    const b = benchByYear.get(y);
                    return (
                      <tr key={y}>
                        <th scope="row">{y}</th>
                        <td data-accent={f == null ? "" : f >= 0 ? "up" : "down"}>{fmtPct(f ?? null)}</td>
                        {hasBench && (
                          <td className="perf-bench-cell" data-accent={b == null ? "" : b >= 0 ? "up" : "down"}>
                            {fmtPct(b ?? null)}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {lastIsPartial && <p className="perf-foot">El año en curso es parcial, a la fecha indicada.</p>}
            </>
          ) : (
            // Sin años no hay tabla que armar: las columnas de este bloque SON
            // los años del fondo. Antes acá decía "Cargando…", que con el Fondo
            // en pre-lanzamiento no terminaba nunca — prometía un dato en camino
            // que no estaba en camino. Se distingue el estado transitorio del
            // permanente, igual que en el marco del gráfico.
            <p className="perf-foot">
              {state.kind === "loading"
                ? "Cargando…"
                : "El primer año calendario se publicará cuando la estrategia cierre su primer ejercicio."}
            </p>
          )}
        </section>

        {/* Indicadores de riesgo — tira subordinada, derivada de la serie. */}
        <section className="perf-block">
          <div className="perf-block-head">
            <h3>Indicadores de riesgo</h3>
          </div>
          <dl className="perf-risk">
            {riskItems.map((it) => (
              <div key={it.label} className="perf-risk-item">
                <dt>{it.label}</dt>
                <dd data-accent={it.accent ?? ""}>
                  {it.value}
                  {it.sub && <em>{it.sub}</em>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <p className="perf-disclaimer">
        Los rendimientos pasados no garantizan resultados futuros. Cifras netas de la comisión del Fondo,
        expresadas en {MONEDA}, la moneda del fondo. La volatilidad y el retorno anualizado se calculan
        sobre la serie diaria de valor cuota.
        {live && view === "base100" &&
          (benchSeries.length > 0 ? (
            <> En la vista base 100, el fondo y su benchmark parten de 100 al inicio del período para
            comparar la evolución de ambas series.</>
          ) : (
            <> En la vista base 100, el valor cuota se reescala a 100 al inicio del período.</>
          ))}
        {/* Lo que el lector necesita es qué índice es y que no es una promesa —
            el gráfico y las tablas lo rotulaban sólo como "Benchmark". Que no
            surja del Reglamento es cierto, pero es razonamiento nuestro: no le
            cambia nada a quien mira la curva.
            Sin fondo el benchmark no está en pantalla: explicar acá cómo se
            construye una serie que nadie ve sólo agrega letra chica. */}
        {(hasBench || benchSeries.length > 0) && (
          <> El benchmark es un compuesto de referencia ({BENCHMARK.nombre}): no es un objetivo de
          rentabilidad ni una garantía. {BENCHMARK_PROXY.nota}</>
        )}
      </p>

      <style>{`
        .perf-quote {
          display: flex; align-items: flex-end; justify-content: space-between; gap: 20px;
          flex-wrap: wrap; margin-bottom: 24px; padding-bottom: 20px;
          border-bottom: 1px solid var(--site-border);
        }
        /* Gap holgado: la marca de moneda cuelga del número (margin chico), así
           que el % del día necesita más aire para no leerse pegado a ella. */
        .perf-quote-main { display: flex; align-items: baseline; gap: 20px; flex-wrap: wrap; }
        .perf-quote-navwrap { display: inline-flex; flex-direction: column; gap: 8px; }
        .perf-quote-navdate { font-size: 12px; color: var(--site-ink-3); font-variant-numeric: tabular-nums; }
        .perf-quote-nav {
          font-size: clamp(32px, 3.4vw, 44px); font-weight: 400; line-height: 1;
          letter-spacing: -0.02em; color: var(--site-ink); font-variant-numeric: tabular-nums;
        }
        /* Marca de moneda: misma línea de base que la cifra, tamaño relativo
           (escala con el clamp) y tono subordinado — unidad, no dato. */
        .perf-quote-cur {
          font-size: 0.42em; font-weight: 600; letter-spacing: 0.08em;
          color: var(--site-ink-3); margin-left: 0.19em;
        }
        /* Variación del día: chip de fondo pleno en los tokens de dato del
           sistema (verde bosque / oxblood), no verdes-semáforo. Radio 4px para
           que lea etiqueta de dato y no botón —los pills de abajo sí lo son—.
           "hoy" va fuera del chip: es glosa temporal, no parte de la cifra. */
        .perf-quote-delta { display: inline-flex; align-items: baseline; gap: 8px; }
        .perf-quote-delta em {
          font-style: normal; font-size: 12.5px; color: var(--site-ink-3);
        }
        .perf-quote-day {
          font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums;
          color: var(--paper); line-height: 1; padding: 5px 9px; border-radius: 4px;
          transition: background 200ms ease;
        }
        .perf-quote-day[data-accent="up"] { background: var(--pos); }
        .perf-quote-day[data-accent="down"] { background: var(--neg); }
        .perf-quote-day[data-accent="neu"] { background: var(--neu); }

        .perf-quote-side {
          display: flex; flex-direction: column; align-items: flex-end; gap: 6px; text-align: right;
        }
        .perf-quote-aum {
          display: flex; align-items: center; gap: 10px;
          font-size: 15px; font-weight: 500; color: var(--site-ink); font-variant-numeric: tabular-nums;
        }
        .perf-quote-aum em { font-style: normal; font-size: 12.5px; font-weight: 400; color: var(--site-ink-3); }
        /* Sparkline del AUM: hairline navy + relleno suave, sin ejes (la cifra
           exacta vive al lado). Tendencia del tamaño del fondo de un vistazo. */
        .perf-spark { display: block; flex: none; overflow: visible; }
        .perf-spark-area { fill: rgba(15, 34, 73, 0.10); }
        .perf-spark-line {
          fill: none; stroke: var(--navy); stroke-width: 1.5;
          stroke-linejoin: round; stroke-linecap: round;
        }
        .perf-spark-dot { fill: var(--navy); }
        .perf-quote-asof {
          display: inline-flex; align-items: center; gap: 10px;
          font-size: 12px; color: var(--site-ink-3);
        }
        @media (max-width: 720px) {
          .perf-quote-side { align-items: flex-start; text-align: left; }
        }

        .perf-bar {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          flex-wrap: wrap; margin-bottom: 18px;
        }
        .perf-bar-label {
          font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--site-ink-3);
        }
        /* El selector de períodos (píldora + thumb) es el componente compartido
           PeriodSlider — sus estilos (.pslider*) viven en globals.css. */

        /* Toggle del modo del gráfico (valor cuota ↔ base 100). Mismo pill firma
           que el selector de períodos; dos celdas iguales vía grid para que el
           thumb al 50% calce con etiquetas de distinto largo. */
        .perf-view {
          position: relative; display: inline-grid; grid-template-columns: 1fr 1fr; padding: 3px;
          background: var(--surface-muted, #f3f4f8); border: 1px solid var(--site-border); border-radius: 999px;
        }
        .perf-view-thumb {
          position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc(50% - 3px);
          background: var(--navy); border-radius: 999px;
          box-shadow: 0 6px 16px -6px rgba(15,34,73,0.6);
          transition: transform 260ms cubic-bezier(0.34, 1.2, 0.4, 1);
        }
        .perf-view[data-active="base100"] .perf-view-thumb { transform: translateX(100%); }
        .perf-view-btn {
          position: relative; z-index: 1; text-align: center; white-space: nowrap;
          border: 0; background: none; cursor: pointer;
          font-size: 13px; font-weight: 600; color: var(--site-ink-3);
          padding: 6px 18px; border-radius: 999px; transition: color 220ms ease;
        }
        .perf-view-btn[aria-selected="true"] { color: #fff; }
        .perf-view-btn:not([aria-selected="true"]):hover { color: var(--navy); }
        /* Mismo criterio táctil que el selector de períodos (.pslider-btn). */
        @media (pointer: coarse) {
          .perf-view-btn { padding-top: 12px; padding-bottom: 12px; }
        }

        /* Relleno igual al de la banda: el marco deja de ser una tarjeta blanca
           flotando y queda como un contorno en torno al gráfico. El canvas de
           lightweight-charts NO hereda CSS, así que su color va replicado a mano
           en PALETTE.bg (FondoChart.tsx) — los dos tienen que moverse juntos.
           El contorno NO usa --site-border: ese token está calculado contra
           blanco y sobre la banda se apaga hasta leerse como un fantasma en las
           esquinas. Va un escalón más oscuro, el mismo PALETTE.rule con que el
           canvas pinta sus ejes, para que caja y eje sean un solo trazo. Los
           hairlines de ADENTRO (separador de la lectura, nota de benchmark) sí
           siguen en --site-border: igualan a las tablas de abajo. */
        /* (Se probó sin marco —borde, radio y padding en 0, el gráfico apoyado
           directo sobre la banda— y se descartó: el marco se queda.) */
        .perf-chart-frame {
          border: 1px solid #DCDEEE; border-radius: 16px; padding: 18px 18px 14px;
          background: var(--surface-muted);
        }
        /* Estado vacío del marco del gráfico. El alto mínimo NO es decorativo:
           iguala el del gráfico para que el módulo no se desinfle en
           pre-lanzamiento ni pegue un salto de layout el día que entre la curva.
           Centrado en los dos ejes — el aviso ocupa el lugar de la serie. */
        .perf-empty {
          min-height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; gap: 6px; color: var(--site-ink-3); padding: 24px;
        }
        .perf-empty-title { font-size: 17px; color: var(--site-ink-2); max-width: 30em; margin: 0; }
        /* «Próximamente» — el rótulo del estado. Oro como acento de una sola
           palabra, en la misma métrica que los antetítulos de la página
           (.eyebrow-sm): mayúsculas, 0.14em de tracking. El filete de abajo es
           el hairline que la casa usa para abrir un bloque de dato; acá, corto y
           centrado, apoya la palabra sin encajonarla. */
        .perf-empty-eyebrow {
          font-size: 11.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--gold-deep); padding-bottom: 12px; margin-bottom: 4px;
          border-bottom: 1.5px solid var(--gold-deep);
        }
        .perf-empty-sub {
          margin: 4px 0 0; font-size: 13.5px; line-height: 1.6;
          color: var(--site-ink-3); max-width: 38em;
        }

        .perf-data { margin-top: 30px; display: flex; flex-direction: column; gap: 38px; }
        .perf-block-head {
          display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px;
        }
        .perf-block-head h3 {
          margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--site-ink-3);
        }
        .perf-asof { font-size: 12px; color: var(--site-ink-3); font-variant-numeric: tabular-nums; }

        /* Tablas planas de ficha técnica: regla superior navy, hairlines por fila,
           sin reglas verticales ni cajas redondeadas. */
        .perf-table-scroll { overflow-x: auto; }
        /* La transpuesta es solo para mobile (ver media query). */
        .perf-grid--mobile { display: none; }
        .perf-grid {
          width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums;
          border-top: 1.5px solid var(--navy);
        }
        .perf-grid thead th {
          text-align: right; font-size: 12px; font-weight: 600; color: var(--site-ink-3);
          padding: 11px 0 11px 28px; border-bottom: 1px solid var(--site-border); white-space: nowrap;
        }
        .perf-grid thead th:first-child { padding-left: 0; }
        .perf-grid tbody tr { border-bottom: 1px solid var(--site-border); }
        .perf-grid tbody tr:last-child { border-bottom: 0; }
        .perf-grid tbody th {
          text-align: left; font-weight: 500; color: var(--site-ink); font-size: 14.5px;
          padding: 14px 0; white-space: nowrap;
        }
        .perf-grid tbody td {
          text-align: right; font-weight: 500; color: var(--site-ink); font-size: 15px;
          padding: 14px 0 14px 28px; white-space: nowrap;
        }
        .perf-grid td[data-accent="up"] { color: var(--pos); }
        .perf-grid td[data-accent="down"] { color: var(--neg); }
        .perf-grid tr.perf-bench th { color: var(--site-ink-2); font-weight: 400; }
        .perf-grid tr.perf-bench td { font-weight: 400; }

        .perf-foot { margin: 12px 0 0; font-size: 12px; line-height: 1.5; color: var(--site-ink-3); max-width: var(--medida-legal); }

        /* Indicadores de riesgo: grilla de celdas regladas, subordinada — no tarjetas. */
        /* Dos indicadores: strip compacto alineado a la izquierda (no dos celdas
           estiradas a media página). La regla navy superior acompaña al ancho. */
        /* El piso de 150px por celda sumaba 301px de contenido mínimo y a 320 de
           viewport —donde la columna de texto mide 280— la tira se salía de la
           página. Sin piso: las dos celdas reparten lo que haya y el techo de
           240 sigue evitando que se estiren a media página en desktop. */
        .perf-risk {
          margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 240px));
          width: fit-content; max-width: 100%;
          border-top: 1.5px solid var(--navy); border-left: 1px solid var(--site-border);
        }
        .perf-risk-item {
          padding: 15px 18px; border-right: 1px solid var(--site-border); border-bottom: 1px solid var(--site-border);
        }
        .perf-risk-item dt { font-size: 11.5px; color: var(--site-ink-3); margin-bottom: 7px; }
        .perf-risk-item dd {
          margin: 0; font-size: 17px; font-weight: 500; color: var(--site-ink); font-variant-numeric: tabular-nums;
        }
        .perf-risk-item dd em {
          display: block; font-style: normal; font-size: 11px; font-weight: 400;
          color: var(--site-ink-3); margin-top: 3px;
        }
        .perf-risk-item dd[data-accent="up"] { color: var(--pos); }
        .perf-risk-item dd[data-accent="down"] { color: var(--neg); }

        /* Sin tope corría los 1.152px del bloque: 173 caracteres por línea, el
           doble de lo legible. Ahora comparte la medida del resto. */
        .perf-disclaimer { margin-top: 20px; font-size: 12px; line-height: 1.5; color: var(--site-ink-3); max-width: var(--medida-legal); }

        @media (max-width: 560px) {
          /* El gráfico sale a los bordes de la pantalla. Contado en un teléfono
             de 390: de los 350px del marco, 36 se iban en su padding y 70 en las
             etiquetas del eje, así que la curva vivía en 242px — el 62% de la
             pantalla— dentro de una caja casi cuadrada. Al ras y con el eje
             angostado (ver etiquetaPrecio en FondoChart) la serie pasa a ~320.
             Los márgenes negativos son exactamente el padding de .site-wrap en
             este breakpoint (20px, globals.css); el marco deja de ser una caja
             redondeada y queda como una banda entre dos hairlines, que es el
             mismo idioma de las tablas que vienen abajo. Es además lo que hace la
             industria: ninguna app de fondos gasta un tercio del ancho del
             teléfono en el marco de su gráfico. */
          .perf-chart-frame {
            margin-left: -20px; margin-right: -20px;
            padding: 14px 10px 12px;
            border-left: 0; border-right: 0; border-radius: 0;
          }
          .perf-grid thead th, .perf-grid tbody td { padding-left: 18px; }
          /* Transpuesta: períodos/años en filas, Fondo/Benchmark en columnas.
             Entra sin scroll horizontal. */
          .perf-table-scroll { display: none; }
          .perf-grid--mobile { display: table; }
          .perf-grid--mobile .perf-bench-cell { color: var(--site-ink-2); font-weight: 400; }
          .perf-grid--mobile .perf-bench-cell[data-accent="up"] { color: var(--pos); }
          .perf-grid--mobile .perf-bench-cell[data-accent="down"] { color: var(--neg); }
        }
      `}</style>
    </div>
  );
}
