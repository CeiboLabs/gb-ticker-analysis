// Bootstrap del primer admin. Con usuarios ya creados, esta página no existe
// para nadie: redirige al login (y el endpoint, además, contesta 409 — la
// página es UX, el gate real es el INSERT atómico del server).

import { redirect } from "next/navigation";
import { getMetricsDb } from "@/lib/metrics";
import { countUsers } from "@/lib/panelStore";
import SetupForm from "@/components/admin/SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const db = getMetricsDb();
  if (db && (await countUsers(db)) > 0) redirect("/admin/login");

  return (
    <div className="site adm-auth">
      <div className="w-full max-w-md">
        <div className="adm-auth-brand">
          <p className="wm">
            Gastón Bengochea <span className="amp">&amp; Cía.</span>
          </p>
          <div className="goldline" />
          <p className="sub">Instalación del panel</p>
        </div>
        {!db ? (
          <p className="adm-notice info">
            Sin binding de D1: el panel no corre en <code>next dev</code>. Levantalo con <code>npm run pages:preview</code>.
          </p>
        ) : (
          <SetupForm />
        )}
      </div>
    </div>
  );
}
