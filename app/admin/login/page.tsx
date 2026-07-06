// Login del panel. Con sesión completa redirige al panel; con sesión de setup,
// al flujo de configuración. redirect() se llama a nivel de page, nunca dentro
// de try/catch (lanza una excepción de control de flujo).

import { redirect } from "next/navigation";
import { getPanelUser } from "@/lib/panelAuth";
import LoginForm from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getPanelUser();
  if (user) redirect("/admin");
  const setupUser = await getPanelUser("setup");
  if (setupUser) redirect("/admin/configurar-acceso");

  return (
    <div className="site adm-auth">
      <div className="w-full max-w-sm">
        <div className="adm-auth-brand">
          <p className="wm">
            Gastón Bengochea <span className="amp">&amp; Cía.</span>
          </p>
          <div className="goldline" />
          <p className="sub">Panel de gestión</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
