// Shell del panel completo (route group — no aparece en la URL). SOLO arma la
// navegación: el gate de verdad lo repite CADA page con panelPageGate, porque
// los layouts no se re-ejecutan en la navegación client-side y un gate acá
// sería decorativo. Sin sesión, devuelve children pelado (la page ya redirigió).

import { getPanelUser } from "@/lib/panelAuth";
import PanelShell from "@/components/admin/PanelShell";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getPanelUser();
  if (!user) return <>{children}</>;
  return (
    <PanelShell user={{ nombre: user.nombre, email: user.email, role: user.role, perms: user.perms }}>
      {children}
    </PanelShell>
  );
}
