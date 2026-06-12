"use client";

import { useMemo, useState } from "react";
import type { FundNavPoint } from "@/lib/fondo";
import { useFondo, fmtNav, fmtPct, fmtAum, fmtFechaCorta, fmtMesAnio } from "@/lib/useFondo";
import { FondoChart } from "@/components/institucional/FondoChart";

// Módulo de performance: selector de períodos + gráfico del valor cuota +
// rendimientos acumulados, por año calendario y estadísticas derivadas de la
// serie. Réplica de la pestaña Performance de las referencias (Vontobel /
// SSGA). Pre-lanzamiento muestra el andamiaje completo con "—" — sin inventar
// cifras. Cuando llegue el feed, todo se puebla solo.

type PeriodId = "1M" | "3M" | "YTD" | "1A" | "SI";
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

export function FondoPerformance() {
  const state = useFondo();
  const [period, setPeriod] = useState<PeriodId>("SI");

  const data = state.kind === "ready" ? state.data : null;
  const live = !!(data && data.status === "live" && data.series.length > 1);
  const series = useMemo(
    () => (live && data ? windowFor(data.series, period) : []),
    [live, data, period],
  );
  const returns = data?.returns ?? [];
  const calendar = data?.calendar ?? [];
  const stats = data?.stats ?? null;

  const statRows: { label: string; value: string; sub?: string; accent?: "up" | "down" }[] = [
    {
      label: "Volatilidad anualizada (1A)",
      value: stats?.vol1y != null ? fmtPct(stats.vol1y, false) : "—",
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
      label: "Máx. drawdown",
      value: stats?.maxDrawdown != null ? fmtPct(stats.maxDrawdown) : "—",
      accent: stats?.maxDrawdown != null ? "down" : undefined,
    },
    {
      label: "Meses positivos",
      value: stats?.positiveMonths != null ? `${Math.round(stats.positiveMonths)}%` : "—",
    },
  ];

  const latest = data?.latest ?? null;
  const dayPct = latest?.changePct ?? null;

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
            {latest && latest.aum != null ? `USD ${fmtAum(latest.aum)}` : "—"}
          </span>
          <span className="perf-quote-asof">
            {data?.asOf ? `Datos al ${fmtFechaCorta(data.asOf)} · USD` : "Actualización diaria · USD"}
          </span>
        </div>
      </div>

      <div className="perf-bar">
        <span className="perf-bar-label">Evolución del valor cuota</span>
        <div className="perf-periods" role="tablist" aria-label="Período">
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
          <FondoChart series={series} formatValue={fmtNav} />
        ) : (
          <div className="perf-empty">
            <p className="perf-empty-title">Cargando datos del fondo…</p>
          </div>
        )}
      </div>

      <div className="perf-tables">
        <div className="perf-table">
          <div className="perf-table-head">Rendimientos acumulados</div>
          <table>
            <tbody>
              {returns.map((r) => (
                <tr key={r.key}>
                  <th scope="row">{r.label}</th>
                  <td data-accent={r.pct == null ? "" : r.pct >= 0 ? "up" : "down"}>{fmtPct(r.pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="perf-table">
          <div className="perf-table-head">Por año calendario</div>
          {calendar.length > 0 ? (
            <table>
              <tbody>
                {calendar.map((c) => (
                  <tr key={c.year}>
                    <th scope="row">{c.year}</th>
                    <td data-accent={c.pct >= 0 ? "up" : "down"}>{fmtPct(c.pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="perf-cal-empty">Cargando…</p>
          )}
        </div>

        <div className="perf-table">
          <div className="perf-table-head">Estadísticas</div>
          <table>
            <tbody>
              {statRows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td data-accent={r.accent ?? ""}>
                    {r.value}
                    {r.sub && <span className="perf-stat-sub">{r.sub}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="perf-disclaimer">
        Los rendimientos pasados no garantizan resultados futuros. Cifras netas, expresadas en la moneda del fondo.
        Volatilidad, drawdown y retornos mensuales se calculan sobre la serie diaria de valor cuota.
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
          display: flex; align-items: baseline; gap: 10px;
          font-size: 15px; font-weight: 500; color: var(--site-ink); font-variant-numeric: tabular-nums;
        }
        .perf-quote-aum em { font-style: normal; font-size: 12.5px; font-weight: 400; color: var(--site-ink-3); }
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
          display: inline-flex; gap: 2px; padding: 3px;
          background: var(--surface-muted, #f3f4f8); border: 1px solid var(--site-border); border-radius: 999px;
        }
        .perf-period {
          border: 0; background: none; cursor: pointer;
          font-size: 13px; font-weight: 600; color: var(--site-ink-3);
          padding: 6px 14px; border-radius: 999px; transition: background 160ms ease, color 160ms ease;
        }
        .perf-period[data-active="1"] { background: var(--navy); color: #fff; }
        .perf-period:disabled { cursor: not-allowed; opacity: 0.5; }
        .perf-period:not(:disabled):not([data-active="1"]):hover { color: var(--navy); }

        .perf-chart-frame {
          border: 1px solid var(--site-border); border-radius: 16px; padding: 18px 18px 14px;
          background: #fff;
        }
        .perf-empty {
          min-height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; gap: 6px; color: var(--site-ink-3); padding: 24px;
        }
        .perf-empty-title { font-size: 17px; color: var(--site-ink-2); max-width: 30em; margin: 0; }

        .perf-tables { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 28px; }
        .perf-table { border: 1px solid var(--site-border); border-radius: 16px; overflow: hidden; }
        .perf-table-head {
          font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--site-ink-3); padding: 16px 20px; border-bottom: 1px solid var(--site-border);
          background: var(--surface-muted, #f7f8fc);
        }
        .perf-table table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
        .perf-table tr { border-bottom: 1px solid var(--site-border); }
        .perf-table tr:last-child { border-bottom: 0; }
        .perf-table th { text-align: left; font-weight: 400; color: var(--site-ink-2); font-size: 14.5px; padding: 13px 20px; }
        .perf-table td { text-align: right; font-weight: 500; color: var(--site-ink); font-size: 15px; padding: 13px 20px; white-space: nowrap; }
        .perf-table td[data-accent="up"] { color: #15803d; }
        .perf-table td[data-accent="down"] { color: #b91c1c; }
        .perf-stat-sub { display: block; font-size: 11.5px; font-weight: 400; color: var(--site-ink-3); }
        .perf-cal-empty { font-size: 14px; color: var(--site-ink-3); padding: 22px 20px; margin: 0; }

        .perf-disclaimer { margin-top: 20px; font-size: 12px; line-height: 1.5; color: var(--site-ink-3); }

        @media (max-width: 1020px) {
          .perf-tables { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
