// Resumen del panel: estado de un vistazo de las secciones que el usuario
// puede ver + últimos movimientos de la auditoría (solo admin).

import { redirect } from "next/navigation";
import { panelPageGate, hasPerm } from "@/lib/panelAuth";
import { getMetricsDb } from "@/lib/metrics";
import { readAudit } from "@/lib/panelStore";
import { readAllFlags } from "@/lib/flags";
import { Badge, Card, PageHeader } from "@/components/admin/ui";
import { fmtTs } from "@/components/admin/format";

export const dynamic = "force-dynamic";

export default async function PanelHome() {
  const gate = await panelPageGate();
  if (!gate.user) redirect(gate.redirectTo);
  const user = gate.user;
  const db = getMetricsDb()!; // panelPageGate ya verificó el binding

  const [ultimoInforme, ultimoNav, flags, audit] = await Promise.all([
    hasPerm(user, "informes")
      ? db
          .prepare("SELECT slug, titulo, status, updated_at FROM informes ORDER BY fecha DESC LIMIT 1")
          .first<{ slug: string; titulo: string; status: string; updated_at: number }>()
      : Promise.resolve(null),
    hasPerm(user, "fondo")
      ? db
          .prepare("SELECT dia, nav FROM fund_nav WHERE status = 'live' ORDER BY dia DESC LIMIT 1")
          .first<{ dia: string; nav: number }>()
      : Promise.resolve(null),
    hasPerm(user, "secciones") ? readAllFlags(db) : Promise.resolve(null),
    user.role === "admin" ? readAudit(db, { limit: 8 }) : Promise.resolve(null),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Panel de gestión"
        title="Resumen"
        dek="Estado de un vistazo de las secciones que administrás, y los últimos movimientos de la auditoría."
      />
      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {hasPerm(user, "informes") && (
          <Card title="Informes">
            {ultimoInforme ? (
              <div className="text-sm">
                <p>{ultimoInforme.titulo}</p>
                <p className="mt-2 flex items-center gap-2">
                  <Badge tone={ultimoInforme.status === "live" ? "pos" : "neu"}>
                    {ultimoInforme.status === "live" ? "Publicado" : "Oculto"}
                  </Badge>
                  <span className="adm-help mt-0!">actualizado {fmtTs(ultimoInforme.updated_at)}</span>
                </p>
              </div>
            ) : (
              <p className="adm-help mt-0!">Sin informes cargados.</p>
            )}
          </Card>
        )}
        {hasPerm(user, "fondo") && (
          <Card title="Fondo BNG">
            {ultimoNav ? (
              <div className="text-sm">
                <p>
                  Último cierre publicado: <span className="mono num">{ultimoNav.dia}</span>
                </p>
                <p className="adm-help">
                  Valor cuota <span className="mono num text-[color:var(--site-ink)]">{Number(ultimoNav.nav).toFixed(4)}</span>
                </p>
              </div>
            ) : (
              <p className="adm-help mt-0!">Sin cierres publicados (pre-lanzamiento).</p>
            )}
          </Card>
        )}
        {flags && (
          <Card title="Secciones visibles">
            <ul className="flex flex-col gap-2">
              {flags.map((f) => (
                <li key={f.key} className="flex items-center justify-between gap-2 text-sm">
                  <span>{f.label}</span>
                  <Badge tone={f.enabled ? "pos" : "neu"}>{f.enabled ? "Visible" : "Oculta"}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      {audit && (
        <Card title="Última actividad">
          {audit.length === 0 ? (
            <p className="adm-help mt-0!">Sin actividad registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Cuándo</th>
                    <th>Quién</th>
                    <th>Acción</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td className="mono num whitespace-nowrap">{fmtTs(a.ts)}</td>
                      <td>{a.actor_email ?? "—"}</td>
                      <td>
                        {a.section} · {a.action}
                        {a.target ? ` · ${a.target}` : ""}
                      </td>
                      <td>
                        <Badge tone={a.decision === "ok" ? "pos" : a.decision === "denied" ? "neu" : "neg"}>
                          {a.decision}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
