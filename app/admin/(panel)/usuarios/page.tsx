import { redirect } from "next/navigation";
import { panelPageGate } from "@/lib/panelAuth";
import UsuariosAdmin from "@/components/admin/UsuariosAdmin";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const gate = await panelPageGate("usuarios");
  if (!gate.user) redirect(gate.redirectTo);
  return <UsuariosAdmin />;
}
