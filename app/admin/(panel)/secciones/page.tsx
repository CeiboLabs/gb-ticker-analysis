import { redirect } from "next/navigation";
import { panelPageGate } from "@/lib/panelAuth";
import SeccionesAdmin from "@/components/admin/SeccionesAdmin";

export const dynamic = "force-dynamic";

export default async function SeccionesPage() {
  const gate = await panelPageGate("secciones");
  if (!gate.user) redirect(gate.redirectTo);
  return <SeccionesAdmin />;
}
