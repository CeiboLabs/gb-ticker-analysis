"use client";

// Leads del embudo de /analisis — la vista de la mesa.
//
// QUÉ RESUELVE: hasta ahora los correos capturados por el peaje del análisis se
// acumulaban en una tabla que nadie miraba, y los pedidos de apertura llegaban
// como un mail suelto. Acá se ven las dos cosas juntas y ordenadas por lo único
// que importa a la hora de levantar el teléfono: quién pidió que lo contacten, y
// de qué venía leyendo.
//
// Sólo lectura a propósito. El alta la hace el sitio y la baja la persona: un
// botón de "borrar lead" en el panel sería la forma más fácil de perder la
// prueba del consentimiento que la ley obliga a conservar.

import { useCallback, useEffect, useState } from "react";
import { panelFetch, errorMessage, Card, Notice, Badge, PageHeader, StatGrid, Stat } from "@/components/admin/ui";
import { fmtTs } from "@/components/admin/format";

type LeadRow = {
  esCliente: boolean;
  siguiendo: string[];
  email: string;
  ts: number;
  status: "active" | "unsubscribed";
  source: string | null;
  analisis: number;
  frescos: number;
  ultimaActividad: number | null;
  tickers: string[];
  pedidos: number;
  ultimoPedido: number | null;
  ultimoMotivo: string | null;
};

type Resumen = {
  clientes: number;
  suscriptores: number;
  desdeAnalisis: number;
  conActividad: number;
  pedidosApertura: number;
};

const FUENTE_LABEL: Record<string, string> = {
  analisis: "Análisis",
  informes: "Informes",
};

/** Días transcurridos, para leer "hace cuánto" sin hacer la cuenta mental. */
function haceCuanto(ms: number | null): string {
  if (!ms) return "—";
  const dias = Math.floor((Date.now() - ms) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} d`;
  const meses = Math.floor(dias / 30);
  return `hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
}

export default function LeadsAdmin() {
  const [rows, setRows] = useState<LeadRow[] | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await panelFetch<{ rows: LeadRow[]; resumen: Resumen; total: number }>(
      "/api/admin/panel/leads",
    );
    if (r.status === 200 && r.data?.rows) {
      setRows(r.data.rows);
      setResumen(r.data.resumen ?? null);
      setError(null);
    } else {
      setError(errorMessage(r));
    }
  }, []);

  useEffect(() => {
    // Diferido a microtask, como el resto del panel: ningún setState sincrónico
    // dentro del effect.
    queueMicrotask(() => void load());
  }, [load]);

  return (
    <div>
      <PageHeader
        eyebrow="Panel · Comercial"
        title="Leads del análisis"
        dek="Quién dejó su correo, qué acciones sigue y quién pidió abrir cuenta. Ordenado por prioridad de llamado: primero los clientes de la casa (una orden esta semana), después los prospectos que pidieron contacto, después por actividad."
      />

      {error && <Notice kind="error">{error}</Notice>}

      {resumen && (
        <StatGrid>
          <Stat k="Suscriptores activos" v={resumen.suscriptores} />
          <Stat k="Desde el análisis" v={resumen.desdeAnalisis} />
          <Stat k="Con actividad" v={resumen.conActividad} s="miraron al menos una acción" />
          <Stat k="Pidieron apertura" v={resumen.pedidosApertura} s="desde el informe" />
          <Stat k="Clientes de la casa" v={resumen.clientes} s="declarado al seguir una acción" />
        </StatGrid>
      )}

      <Card title="Leads">
        {rows === null ? (
          <p className="adm-dek" style={{ margin: 0 }}>Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="adm-dek" style={{ margin: 0 }}>
            Todavía no hay nadie anotado. Los correos entran por el peaje de /analisis y por el
            bloque de suscripción de /informes.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Correo</th>
                  <th>Relación</th>
                  <th>Origen</th>
                  <th className="adm-num">Análisis</th>
                  <th>Sigue</th>
                  <th>Viene mirando</th>
                  <th>Última actividad</th>
                  <th>Pedido</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                    <tr key={r.email} className={r.esCliente ? "lead-cliente" : undefined}>
                    <td>
                      {/* mailto: el llamado a la acción del panel es escribirle.
                          El asunto sale prellenado con lo que estaba mirando. */}
                      <a
                        href={`mailto:${r.email}${r.tickers[0] ? `?subject=${encodeURIComponent(`Tu consulta sobre ${r.tickers[0]}`)}` : ""}`}
                        className="adm-link"
                      >
                        {r.email}
                      </a>
                      <div className="adm-sub">alta {fmtTs(r.ts)}</div>
                    </td>
                    <td>
                      {/* Cliente vs prospecto es LA distinción operativa: a un
                          cliente que investiga algo lo llama su asesor y puede
                          terminar en una orden esta semana; a un prospecto lo
                          trabaja la mesa como apertura. */}
                      {r.esCliente ? <Badge tone="gold">cliente</Badge> : <Badge tone="neutral">prospecto</Badge>}
                      {r.status !== "active" && <div className="adm-sub">de baja del newsletter</div>}
                    </td>
                    <td>{r.source ? (FUENTE_LABEL[r.source] ?? r.source) : "—"}</td>
                    <td className="adm-num">
                      {r.analisis}
                      {/* Los frescos son la señal fuerte: mandó a GENERAR un
                          análisis que no existía, eligió el ticker y esperó. */}
                      {r.frescos > 0 && <div className="adm-sub">{r.frescos} nuevos</div>}
                    </td>
                    <td>
                      {r.siguiendo.length === 0 ? (
                        <span className="adm-sub">—</span>
                      ) : (
                        <span className="lead-tickers">
                          {r.siguiendo.map((t) => (
                            <a key={t} href={`/analisis?ticker=${t}`} target="_blank" rel="noreferrer" className="lead-tk is-sigue">
                              {t}
                            </a>
                          ))}
                        </span>
                      )}
                    </td>
                    <td>
                      {r.tickers.length === 0 ? (
                        <span className="adm-sub">—</span>
                      ) : (
                        <span className="lead-tickers">
                          {r.tickers.map((t) => (
                            <a key={t} href={`/analisis?ticker=${t}`} target="_blank" rel="noreferrer" className="lead-tk">
                              {t}
                            </a>
                          ))}
                        </span>
                      )}
                    </td>
                    <td>
                      {haceCuanto(r.ultimaActividad)}
                      {r.ultimaActividad && <div className="adm-sub">{fmtTs(r.ultimaActividad)}</div>}
                    </td>
                    <td>
                      {r.pedidos === 0 ? (
                        <span className="adm-sub">—</span>
                      ) : (
                        <>
                          <Badge tone={r.ultimoMotivo === "cuenta-analisis" ? "gold" : "neutral"}>
                            {r.ultimoMotivo === "cuenta-analisis" ? "abrir cuenta" : (r.ultimoMotivo ?? "consulta")}
                          </Badge>
                          <div className="adm-sub">{fmtTs(r.ultimoPedido)}</div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <style>{`
        .adm-sub {
          font-size: 11.5px;
          color: var(--site-ink-3);
          margin-top: 3px;
        }
        .adm-link { color: var(--navy); text-decoration: underline; text-underline-offset: 2px; }
        .adm-link:hover { color: var(--gold-deep); }
        .lead-tickers { display: flex; flex-wrap: wrap; gap: 5px; }
        .lead-tk {
          font-family: var(--font-mono), monospace;
          font-size: 11.5px;
          letter-spacing: 0.02em;
          padding: 2px 6px;
          border: 1px solid var(--site-border);
          border-radius: 3px;
          color: var(--site-ink);
          text-decoration: none;
          white-space: nowrap;
        }
        .lead-tk:hover { border-color: var(--navy); color: var(--navy); }
        /* Lo SEGUIDO se distingue de lo mirado de paso: seguir es intención
           declarada, y es de lo que se habla en el llamado. */
        .lead-tk.is-sigue { border-color: var(--gold-deep); color: var(--site-ink); }
        /* Los clientes arriba y marcados: es la fila que hay que trabajar hoy. */
        .lead-cliente td { background: rgba(160, 124, 40, 0.05); }
      `}</style>
    </div>
  );
}
