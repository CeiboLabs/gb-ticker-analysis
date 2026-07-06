"use client";

import { useMemo, useState } from "react";
import type { FundNavPoint, ReturnKey } from "@/lib/fondo";
import { BENCHMARK } from "@/lib/fondo";
import { useFondo, fmtNav, fmtIndex, fmtPct, fmtAum, fmtFechaCorta, fmtMesAnio } from "@/lib/useFondo";
import { FondoChart } from "@/components/institucional/FondoChart";

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
  const benchSeries = useMemo(
    () => (live && data && data.benchmark.length > 0 ? windowFor(data.benchmark, period) : []),
    [live, data, period],
  );
  // Datos que entran al gráfico de rendimiento según el modo del slider:
  //   "cuota":   valor cuota real del fondo, una línea, eje en USD.
  //   "base100": fondo + benchmark reescalados a 100 en el primer punto del
  //              período (origen común para leer la evolución relativa); el eje
  //              pasa a índice. El benchmark sólo aparece en este modo.
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
  const hasBench = benchReturns.length > 0;

  // Etiquetas de columna (cortas) por período — convención de ficha en español.
  const COL_LABEL: Record<ReturnKey, string> = {
    "1M": "1 mes",
    "3M": "3 meses",
    YTD: "En el año",
    "1Y": "1 año",
    SI: "Desde inicio",
  };

  // Año calendario en orden cronológico (columnas izq.→der.) + lookup del bench.
  const calAsc = [...calendar].reverse();
  const benchByYear = new Map(benchCalendar.map((c) => [c.year, c.pct]));
  // Lookup del bench por período — para la tabla transpuesta de mobile.
  const benchByKey = new Map(benchReturns.map((r) => [r.key, r.pct]));
  const asOfYear = data?.asOf ? Number(data.asOf.slice(0, 4)) : null;
  const lastIsPartial =
    asOfYear != null &&
    calAsc.length > 0 &&
    calAsc[calAsc.length - 1].year === asOfYear &&
    (data?.asOf ?? "").slice(5) !== "12-31";

  // Indicadores de riesgo — todo derivado de la serie NAV. No hay Sharpe porque
  // exige un supuesto de tasa libre de riesgo que no vamos a inventar.
  const riskItems: { label: string; value: string; sub?: string; accent?: "up" | "down" }[] = [
    { label: "Volatilidad (1A)", value: stats?.vol1y != null ? fmtPct(stats.vol1y, false) : "—" },
    {
      label: "Retorno anualizado",
      value: stats?.annualizedSI != null ? fmtPct(stats.annualizedSI) : "—",
      accent: stats?.annualizedSI != null ? (stats.annualizedSI >= 0 ? "up" : "down") : undefined,
    },
    {
      label: "Máx. caída",
      value: stats?.maxDrawdown != null ? fmtPct(stats.maxDrawdown) : "—",
      accent: stats?.maxDrawdown != null ? "down" : undefined,
    },
    {
      label: "Mejor mes",
      value: stats?.bestMonth ? fmtPct(stats.bestMonth.pct) : "—",
      sub: stats?.bestMonth ? fmtMesAnio(stats.bestMonth.ym) : undefined,
      accent: stats?.bestMonth ? "up" : undefined,
    },
    {
      label: "Peor mes",
      value: stats?.worstMonth ? fmtPct(stats.worstMonth.pct) : "—",
      sub: stats?.worstMonth ? fmtMesAnio(stats.worstMonth.ym) : undefined,
      accent: stats?.worstMonth ? "down" : undefined,
    },
    {
      label: "Meses positivos",
      value: stats?.positiveMonths != null ? `${Math.round(stats.positiveMonths)}%` : "—",
    },
  ];

  const latest = data?.latest ?? null;
  const dayPct = latest?.changePct ?? null;
  const activeIndex = PERIODS.findIndex((p) => p.id === period);

  // Estado vacío: distinguir carga, error y pre-lanzamiento. En prod sin datos
  // reales esto queda en "en proceso de lanzamiento" (no un spinner perpetuo).
  const emptyMsg =
    state.kind === "loading"
      ? "Cargando datos del fondo…"
      : state.kind === "error"
        ? "No pudimos cargar los datos del fondo en este momento."
        : "El fondo está en proceso de lanzamiento. El valor cuota y su evolución se publican aquí en cuanto comiencen a calcularse.";

  return (
    <div className="perf">
      {/* Cotización al día — único lugar de la página con el dato vivo. */}
      <div className="perf-quote">
        <div className="perf-quote-main">
          <span className="perf-quote-label">Valor cuota</span>
          <span className="perf-quote-nav">{latest ? fmtNav(latest.nav) : "—"}</span>
          {dayPct != null && (
            <span className="perf-quote-day" data-accent={dayPct >= 0 ? "up" : "down"}>
              {fmtPct(dayPct)} hoy
            </span>
          )}
        </div>
        <div className="perf-quote-side">
          <span className="perf-quote-aum">
            <em>Activos bajo manejo</em>
            <span className="perf-quote-aum-val">
              {latest && latest.aum != null ? `USD ${fmtAum(latest.aum)}` : "—"}
            </span>
            {live && aumSpark.length > 1 && <AumSparkline values={aumSpark} />}
          </span>
          <span className="perf-quote-asof">
            {data?.asOf ? `Datos al ${fmtFechaCorta(data.asOf)} · USD` : "Actualización diaria · USD"}
          </span>
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
          <span className="perf-bar-label">Evolución del valor cuota</span>
        )}
        <div
          className="perf-periods"
          role="tablist"
          aria-label="Período"
          style={{ ["--perf-count" as string]: PERIODS.length }}
        >
          <span
            className="perf-period-thumb"
            aria-hidden
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          />
          {PERIODS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={period === p.id}
              disabled={!live}
              onClick={() => setPeriod(p.id)}
              className="perf-period"
              data-active={period === p.id ? "1" : "0"}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="perf-chart-frame">
        {live ? (
          chart.benchmark.length > 0 ? (
            <FondoChart
              series={chart.series}
              benchmark={chart.benchmark}
              formatValue={chart.format}
              seriesLabel="BNG Selección Global"
              benchLabel={BENCHMARK.corto}
            />
          ) : (
            <FondoChart series={chart.series} formatValue={chart.format} />
          )
        ) : (
          <div className="perf-empty">
            <p className="perf-empty-title">{emptyMsg}</p>
          </div>
        )}
      </div>

      <div className="perf-data">
        {/* Rentabilidad acumulada — fondo vs benchmark, períodos en columnas. */}
        <section className="perf-block">
          <div className="perf-block-head">
            <h3>Rentabilidad acumulada</h3>
            {data?.asOf && <span className="perf-asof">al {fmtFechaCorta(data.asOf)}</span>}
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
          </p>
        </section>

        {/* Rentabilidad por año calendario — años en columnas. */}
        <section className="perf-block">
          <div className="perf-block-head">
            <h3>Rentabilidad por año calendario</h3>
          </div>
          {calAsc.length > 0 ? (
            <>
              <div className="perf-table-scroll">
                <table className="perf-grid">
                  <thead>
                    <tr>
                      <th scope="col" aria-label="Serie" />
                      {calAsc.map((c) => (
                        <th key={c.year} scope="col">{c.year}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Fondo</th>
                      {calAsc.map((c) => (
                        <td key={c.year} data-accent={c.pct >= 0 ? "up" : "down"}>{fmtPct(c.pct)}</td>
                      ))}
                    </tr>
                    {hasBench && (
                      <tr className="perf-bench">
                        <th scope="row">{BENCHMARK.corto}</th>
                        {calAsc.map((c) => {
                          const b = benchByYear.get(c.year);
                          return (
                            <td key={c.year} data-accent={b == null ? "" : b >= 0 ? "up" : "down"}>
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
                  {calAsc.map((c) => {
                    const b = benchByYear.get(c.year);
                    return (
                      <tr key={c.year}>
                        <th scope="row">{c.year}</th>
                        <td data-accent={c.pct >= 0 ? "up" : "down"}>{fmtPct(c.pct)}</td>
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
            <p className="perf-foot">Cargando…</p>
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
        Los rendimientos pasados no garantizan resultados futuros. Cifras netas, expresadas en la moneda del fondo.
        Volatilidad, drawdown y retornos mensuales se calculan sobre la serie diaria de valor cuota.
        {view === "base100" &&
          (benchSeries.length > 0 ? (
            <> En la vista base 100, el fondo y su benchmark de referencia ({BENCHMARK.nombre}) parten
            de 100 al inicio del período para comparar su evolución relativa.</>
          ) : (
            <> En la vista base 100, el valor cuota se reescala a 100 al inicio del período.</>
          ))}
      </p>

      <style>{`
        .perf-quote {
          display: flex; align-items: flex-end; justify-content: space-between; gap: 20px;
          flex-wrap: wrap; margin-bottom: 24px; padding-bottom: 20px;
          border-bottom: 1px solid var(--site-border);
        }
        .perf-quote-main { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
        .perf-quote-label {
          font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--site-ink-3); align-self: center;
        }
        .perf-quote-nav {
          font-size: clamp(32px, 3.4vw, 44px); font-weight: 400; line-height: 1;
          letter-spacing: -0.02em; color: var(--site-ink); font-variant-numeric: tabular-nums;
        }
        .perf-quote-day { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
        .perf-quote-day[data-accent="up"] { color: #15803d; }
        .perf-quote-day[data-accent="down"] { color: #b91c1c; }

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
        .perf-periods {
          position: relative; display: inline-grid; grid-auto-flow: column; grid-auto-columns: 1fr;
          padding: 3px; background: var(--surface-muted, #f3f4f8);
          border: 1px solid var(--site-border); border-radius: 999px;
        }
        .perf-period-thumb {
          position: absolute; top: 3px; bottom: 3px; left: 3px;
          width: calc((100% - 6px) / var(--perf-count, 5));
          background: var(--navy); border-radius: 999px;
          box-shadow: 0 6px 16px -6px rgba(15,34,73,0.6);
          transition: transform 260ms cubic-bezier(0.34, 1.2, 0.4, 1);
        }
        .perf-period {
          position: relative; z-index: 1; text-align: center; white-space: nowrap;
          border: 0; background: none; cursor: pointer;
          font-size: 13px; font-weight: 600; color: var(--site-ink-3);
          padding: 6px 14px; border-radius: 999px; transition: color 220ms ease;
        }
        .perf-period[data-active="1"] { color: #fff; }
        .perf-period:disabled { cursor: not-allowed; opacity: 0.5; }
        .perf-period:not(:disabled):not([data-active="1"]):hover { color: var(--navy); }

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

        .perf-chart-frame {
          border: 1px solid var(--site-border); border-radius: 16px; padding: 18px 18px 14px;
          background: #fff;
        }
        .perf-empty {
          min-height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; gap: 6px; color: var(--site-ink-3); padding: 24px;
        }
        .perf-empty-title { font-size: 17px; color: var(--site-ink-2); max-width: 30em; margin: 0; }

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
        .perf-grid td[data-accent="up"] { color: #15803d; }
        .perf-grid td[data-accent="down"] { color: #b91c1c; }
        .perf-grid tr.perf-bench th { color: var(--site-ink-2); font-weight: 400; }
        .perf-grid tr.perf-bench td { font-weight: 400; }

        .perf-foot { margin: 12px 0 0; font-size: 12px; line-height: 1.5; color: var(--site-ink-3); }

        /* Indicadores de riesgo: grilla de celdas regladas, subordinada — no tarjetas. */
        .perf-risk {
          margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
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
        .perf-risk-item dd[data-accent="up"] { color: #15803d; }
        .perf-risk-item dd[data-accent="down"] { color: #b91c1c; }

        .perf-disclaimer { margin-top: 20px; font-size: 12px; line-height: 1.5; color: var(--site-ink-3); }

        @media (max-width: 560px) {
          .perf-grid thead th, .perf-grid tbody td { padding-left: 18px; }
          /* Transpuesta: períodos/años en filas, Fondo/Benchmark en columnas.
             Entra sin scroll horizontal. */
          .perf-table-scroll { display: none; }
          .perf-grid--mobile { display: table; }
          .perf-grid--mobile .perf-bench-cell { color: var(--site-ink-2); font-weight: 400; }
          .perf-grid--mobile .perf-bench-cell[data-accent="up"] { color: #15803d; }
          .perf-grid--mobile .perf-bench-cell[data-accent="down"] { color: #b91c1c; }
        }
      `}</style>
    </div>
  );
}
