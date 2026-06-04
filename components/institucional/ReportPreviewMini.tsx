/* Mini-preview de un reporte real — miniatura del Panel 01 "Tesis" del workstation.
   Datos: snapshot real de AAPL (Yahoo Finance + SEC EDGAR). Estático, sin interacción. */

const VERDICT = "BUY" as const;
const VERDICT_TONE: Record<"BUY" | "HOLD" | "AVOID", string> = {
  BUY: "var(--pos)",
  HOLD: "var(--neu)",
  AVOID: "var(--neg)",
};

const DATA = {
  reportId: "BGC-NVDA-20260426",
  price: "215,83",
  target: "USD 253",
  upside: "+17,32 % desde USD 215,83",
  conviction: "Alta",
};

const THESIS =
  "Recomendamos BUY para NVIDIA con una convicción alta y un precio objetivo de USD 253,20, implicando un upside del 17,3 % desde el precio actual de USD 215,83. El objetivo se deriva de un P/E forward de 20x aplicado a un EPS FY+1 estimado de USD 12,66, reflejando una valoración atractiva relativa al crecimiento proyectado. NVIDIA opera con márgenes líderes en la industria (65,6 % operativo) y un crecimiento de ingresos YoY del 85,2 %, impulsado por la adopción masiva de inteligencia artificial. Aunque el ritmo proyectado se desacelera, la expansión hacia nuevos mercados y una posición financiera sólida, con USD 53,17B en caja, refuerzan la tesis.";

/* tone: "pos" pinta el valor en verde (igual que el Panel 03 real) */
const KPIS: { label: string; value: string; tone?: "pos" }[] = [
  { label: "Cap. Bursátil", value: "5,23 T" },
  { label: "P/E TTM", value: "33,05 ×" },
  { label: "Revenue TTM", value: "USD 253,5 B" },
  { label: "Margen Neto", value: "+63,0 %", tone: "pos" },
  { label: "Rev. Growth", value: "+85,2 %", tone: "pos" },
  { label: "FCF TTM", value: "USD 46,3 B", tone: "pos" },
];

export function ReportPreviewMini() {
  const tone = VERDICT_TONE[VERDICT];

  return (
    <div className="rpm" role="img" aria-label="Vista previa de un reporte de análisis de NVIDIA.">
      {/* Meta hairline row */}
      <div className="rpm-meta">
        <div className="rpm-cell">
          <div className="rpm-label">Reporte ID</div>
          <div className="rpm-value">{DATA.reportId}</div>
        </div>
        <div className="rpm-cell">
          <div className="rpm-label">Mesa</div>
          <div className="rpm-value">Research · Bengochea</div>
        </div>
        <div className="rpm-cell">
          <div className="rpm-label">Horizonte</div>
          <div className="rpm-value">12 meses</div>
        </div>
      </div>

      {/* Cuerpo: veredicto + tesis */}
      <div className="rpm-body">
        {/* Veredicto */}
        <div className="rpm-verdict" style={{ background: tone }}>
          <div className="rpm-vd-eyebrow">— Veredicto · Bengochea</div>
          <div className="rpm-vd-value">{VERDICT}</div>
          <div className="rpm-vd-rule" />
          <div className="rpm-vd-sub">Target casa · 12m</div>
          <div className="rpm-vd-target">{DATA.target}</div>
          <div className="rpm-vd-upside">Upside {DATA.upside}</div>
          <div className="rpm-vd-rule" />
          <div className="rpm-vd-sub">Convicción</div>
          <div className="rpm-vd-conv">{DATA.conviction}</div>
        </div>

        {/* Tesis */}
        <div className="rpm-tesis">
          <div className="rpm-eyebrow">— 01 · Tesis de inversión</div>
          <h3 className="rpm-h">
            Argumentos que sostienen el veredicto <em>buy.</em>
          </h3>
          <div className="rpm-prose">
            <p>{THESIS}</p>
          </div>
        </div>
      </div>

      {/* Métricas y KPIs */}
      <div className="rpm-kpi-head">
        <span className="rpm-eyebrow">— 03 · Métricas y KPIs</span>
        <span className="rpm-kpi-src">Yahoo Finance · TTM</span>
      </div>
      <div className="rpm-kpis">
        {KPIS.map((k) => (
          <div key={k.label} className={`rpm-kpi${k.tone === "pos" ? " is-pos" : ""}`}>
            <div className="rpm-kpi-top">
              <span className="rpm-kpi-label">{k.label}</span>
              <span className="rpm-kpi-i" aria-hidden>i</span>
            </div>
            <div className="rpm-kpi-value">{k.value}</div>
          </div>
        ))}
      </div>

      <style>{`
        .rpm {
          background: var(--paper);
          border: 1px solid var(--rule);
          border-radius: var(--r-card);
          box-shadow: 0 28px 64px -34px rgba(14,17,48,0.4);
          overflow: hidden;
          font-family: var(--font-sans), sans-serif;
        }

        /* ── Meta row ── */
        .rpm-meta {
          display: grid;
          grid-template-columns: 1.4fr 1.2fr 0.9fr;
          border-top: 2px solid var(--ink);
          border-bottom: 1px solid var(--rule);
        }
        .rpm-cell { padding: 9px 12px; border-right: 1px solid var(--rule); min-width: 0; }
        .rpm-cell:last-child { border-right: 0; }
        .rpm-label {
          font-family: var(--font-mono), monospace;
          font-size: 8px; letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--ink-3); margin-bottom: 3px;
        }
        .rpm-value {
          font-family: var(--font-mono), monospace;
          font-size: 11px; font-weight: 500; color: var(--ink);
          font-variant-numeric: tabular-nums;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* ── Body ── */
        .rpm-body { display: grid; grid-template-columns: minmax(0, 150px) 1fr; }

        /* Veredicto */
        .rpm-verdict {
          position: relative;
          color: var(--ivory);
          padding: 16px 16px 18px;
          border-right: 1px solid var(--rule);
        }
        .rpm-vd-eyebrow {
          font-family: var(--font-mono), monospace;
          font-size: 8px; letter-spacing: 0.06em; text-transform: uppercase;
          color: rgba(255,255,255,0.78);
          white-space: nowrap;
        }
        .rpm-vd-value {
          font-family: var(--font-mono), monospace;
          font-size: 38px; font-weight: 500; line-height: 1; letter-spacing: -0.01em;
          margin: 10px 0 14px;
        }
        .rpm-vd-rule { height: 1px; background: rgba(255,255,255,0.25); margin: 12px 0; }
        .rpm-vd-sub {
          font-family: var(--font-mono), monospace;
          font-size: 8.5px; letter-spacing: 0.14em; text-transform: uppercase;
          color: rgba(255,255,255,0.7);
        }
        .rpm-vd-target {
          font-family: var(--font-mono), monospace;
          font-size: 22px; font-weight: 500; margin-top: 3px;
          font-variant-numeric: tabular-nums;
        }
        .rpm-vd-upside {
          font-family: var(--font-mono), monospace;
          font-size: 9.5px; color: rgba(255,255,255,0.78); margin-top: 3px;
          font-variant-numeric: tabular-nums;
        }
        .rpm-vd-conv {
          font-family: var(--font-mono), monospace;
          font-size: 13px; margin-top: 3px;
        }

        /* Tesis */
        .rpm-tesis { position: relative; padding: 16px 18px 18px; min-width: 0; }
        .rpm-eyebrow {
          font-family: var(--font-mono), monospace;
          font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--gold-deep);
        }
        .rpm-h {
          font-family: var(--font-serif), Georgia, serif;
          font-weight: 400; font-size: 18px; line-height: 1.2; letter-spacing: -0.012em;
          color: var(--ink); margin: 8px 0 12px;
        }
        .rpm-h em { font-style: italic; font-weight: 300; color: var(--gold-deep); }
        .rpm-prose {
          font-family: var(--font-serif), Georgia, serif;
          font-size: 13px; line-height: 1.55; color: var(--ink-2);
        }
        .rpm-prose p { margin: 0; }
        .rpm-prose p::first-letter {
          font-family: var(--font-serif), Georgia, serif;
          font-weight: 500; font-size: 2.6em; float: left;
          line-height: 0.86; margin: 0.04em 0.08em 0 0; color: var(--gold-deep);
        }
        /* ── KPIs (Panel 03) ── */
        .rpm-kpi-head {
          display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
          padding: 14px 18px 10px;
          border-top: 1px solid var(--rule);
        }
        .rpm-kpi-src {
          font-family: var(--font-mono), monospace;
          font-size: 8px; letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--ink-3);
        }
        .rpm-kpis {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          border-top: 1px solid var(--ink);
          border-left: 1px solid var(--rule);
        }
        .rpm-kpi {
          padding: 10px 12px; min-height: 62px;
          border-right: 1px solid var(--rule);
          border-bottom: 1px solid var(--rule);
          background: var(--paper);
          display: flex; flex-direction: column; justify-content: space-between; gap: 8px;
        }
        .rpm-kpi-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
        .rpm-kpi-label {
          font-family: var(--font-sans), sans-serif;
          font-size: 8.5px; letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--ink-3); line-height: 1.3;
        }
        .rpm-kpi-i {
          flex: none; width: 13px; height: 13px;
          display: grid; place-items: center;
          border: 1px solid var(--rule); border-radius: 3px;
          font-family: var(--font-mono), monospace; font-size: 8px; font-style: italic;
          color: var(--ink-3);
        }
        .rpm-kpi-value {
          font-family: var(--font-mono), monospace;
          font-size: 15px; font-weight: 500; letter-spacing: -0.005em;
          color: var(--ink); font-variant-numeric: tabular-nums;
        }
        .rpm-kpi.is-pos .rpm-kpi-value { color: var(--pos); }

        @media (max-width: 560px) {
          .rpm-body { grid-template-columns: 1fr; }
          .rpm-verdict { border-right: 0; border-bottom: 1px solid var(--rule); }
          .rpm-meta { grid-template-columns: 1fr 1fr; }
          .rpm-cell:nth-child(3) { display: none; }
          .rpm-kpis { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}
