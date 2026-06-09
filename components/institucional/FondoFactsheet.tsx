"use client";

import Link from "next/link";
import { useFondo, fmtNav, fmtPct, fmtAum, fmtFechaCorta } from "@/lib/useFondo";

// Ficha del fondo — la "spine" de la página, pensada para quedar sticky en
// desktop (el contenedor padre maneja el sticky). Es el SNAPSHOT VIVO del fondo:
// las tres métricas que se actualizan a diario (valor cuota / AUM / YTD), la
// moneda y el sello "datos al [fecha]". La ficha técnica completa del producto
// (tipo, estructura, domicilio, etc.) vive en su propia sección densa más abajo.

function Metric({ label, value, valueAccent, sub, subAccent }: {
  label: string; value: string; valueAccent?: "up" | "down"; sub?: string; subAccent?: "up" | "down";
}) {
  return (
    <div className="fs-metric">
      <span className="fs-metric-label">{label}</span>
      <span className="fs-metric-value" data-accent={valueAccent ?? ""}>{value}</span>
      {sub && <span className="fs-metric-sub" data-accent={subAccent ?? ""}>{sub}</span>}
    </div>
  );
}

export function FondoFactsheet() {
  const state = useFondo();
  const data = state.kind === "ready" ? state.data : null;
  const latest = data?.latest ?? null;
  const ytd = data?.returns.find((r) => r.key === "YTD")?.pct ?? null;
  const asOf = data?.asOf ?? null;

  const navVal = latest ? fmtNav(latest.nav) : "—";
  const aumVal = latest && latest.aum != null ? `USD ${fmtAum(latest.aum)}` : "—";
  const ytdVal = ytd != null ? fmtPct(ytd) : "—";
  const ytdAccent: "up" | "down" | undefined = ytd != null ? (ytd >= 0 ? "up" : "down") : undefined;
  // Variación del día como subtítulo del valor cuota.
  const dayPct = latest?.changePct ?? null;
  const daySub = dayPct != null ? `${fmtPct(dayPct)} en el día` : undefined;
  const dayAccent: "up" | "down" | undefined = dayPct != null ? (dayPct >= 0 ? "up" : "down") : undefined;

  return (
    <aside className="fs-card" aria-label="Ficha del fondo">
      <div className="fs-head">
        <span className="fs-head-title">Ficha del fondo</span>
        <span className="fs-badge">
          <span className="fs-dot" aria-hidden />
          Operativo
        </span>
      </div>

      <div className="fs-metrics">
        <Metric label="Valor cuota" value={navVal} sub={daySub} subAccent={dayAccent} />
        <Metric label="Activos bajo manejo" value={aumVal} />
        <Metric label="Rendimiento año en curso" value={ytdVal} valueAccent={ytdAccent} />
      </div>

      <dl className="fs-ids">
        <div className="fs-id-row">
          <dt>Moneda</dt>
          <dd>USD</dd>
        </div>
        <div className="fs-id-row">
          <dt>Valoración</dt>
          <dd>Diaria</dd>
        </div>
      </dl>

      <div className="fs-asof">
        {asOf ? `Datos al ${fmtFechaCorta(asOf)} · actualización diaria` : "Actualización diaria"}
      </div>

      <Link href="/contacto" className="ui-btn ui-btn-primary fs-cta">Hablar con un asesor</Link>

      <style>{`
        .fs-card {
          border: 1px solid var(--site-border);
          border-radius: 18px;
          background: linear-gradient(180deg, #ffffff 0%, #fbfbfe 100%);
          padding: 26px 26px 24px;
          box-shadow: 0 1px 0 rgba(255,255,255,0.9) inset, 0 18px 48px -28px rgba(3,6,94,0.28);
        }
        .fs-head {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding-bottom: 18px; border-bottom: 1px solid var(--site-border);
        }
        .fs-head-title {
          font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--site-ink-3);
        }
        .fs-badge {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 12px; font-weight: 600; letter-spacing: 0.01em;
          padding: 5px 11px; border-radius: 999px;
          color: #15803d; background: rgba(21,128,61,0.09);
        }
        .fs-dot {
          width: 7px; height: 7px; border-radius: 999px; background: currentColor;
          box-shadow: 0 0 0 0 currentColor; animation: fsPulse 2.4s ease-out infinite;
        }
        @keyframes fsPulse {
          0% { box-shadow: 0 0 0 0 rgba(21,128,61,0.45); }
          70% { box-shadow: 0 0 0 6px rgba(21,128,61,0); }
          100% { box-shadow: 0 0 0 0 rgba(21,128,61,0); }
        }
        @media (prefers-reduced-motion: reduce) { .fs-dot { animation: none; } }

        .fs-metrics { display: flex; flex-direction: column; padding: 20px 0 4px; }
        .fs-metric { padding: 14px 0; border-bottom: 1px solid var(--site-border); display: flex; flex-direction: column; gap: 4px; }
        .fs-metric:last-child { border-bottom: 0; }
        .fs-metric-label { font-size: 13px; color: var(--site-ink-3); }
        .fs-metric-value {
          font-size: 30px; font-weight: 400; letter-spacing: -0.02em; line-height: 1.05;
          color: var(--site-ink); font-variant-numeric: tabular-nums;
        }
        .fs-metric-value[data-accent="up"] { color: #15803d; }
        .fs-metric-value[data-accent="down"] { color: #b91c1c; }
        .fs-metric-sub { font-size: 12px; color: var(--site-ink-3); font-weight: 600; letter-spacing: 0.02em; }
        .fs-metric-sub[data-accent="up"] { color: #15803d; }
        .fs-metric-sub[data-accent="down"] { color: #b91c1c; }

        .fs-ids { margin: 18px 0 0; padding-top: 18px; border-top: 1px solid var(--site-border); display: grid; gap: 0; }
        .fs-id-row {
          display: flex; align-items: baseline; justify-content: space-between; gap: 16px;
          padding: 9px 0; border-bottom: 1px dashed var(--site-border);
        }
        .fs-id-row:last-child { border-bottom: 0; }
        .fs-id-row dt { font-size: 13px; color: var(--site-ink-3); flex: none; }
        .fs-id-row dd { font-size: 14px; font-weight: 500; color: var(--site-ink); margin: 0; text-align: right; }

        .fs-asof { margin-top: 16px; font-size: 12px; line-height: 1.45; color: var(--site-ink-3); }
        .fs-cta { width: 100%; justify-content: center; margin-top: 18px; }
      `}</style>
    </aside>
  );
}
