// Configuración de acceso del primer login / post-reset: contraseña propia y
// enrolamiento del segundo factor. Acepta sesiones de setup y también
// completas (un usuario full puede aterrizar acá por link viejo: ve "todo listo").

import { redirect } from "next/navigation";
import { getPanelUser } from "@/lib/panelAuth";
import ConfigurarAcceso from "@/components/admin/ConfigurarAcceso";

export const dynamic = "force-dynamic";

export default async function ConfigurarAccesoPage() {
  const user = await getPanelUser("setup");
  if (!user) redirect("/admin/login");

  return (
    <div className="site adm-auth">
      <div className="w-full max-w-xl">
        <div className="adm-auth-brand">
          <p className="wm">
            Gastón Bengochea <span className="amp">&amp; Cía.</span>
          </p>
          <div className="goldline" />
          <p className="sub">Configurar acceso</p>
        </div>
        <ConfigurarAcceso
          email={user.email}
          mustChangePassword={user.mustChangePassword}
          totpEnrolled={user.totpEnrolled}
        />
      </div>
    </div>
  );
}
