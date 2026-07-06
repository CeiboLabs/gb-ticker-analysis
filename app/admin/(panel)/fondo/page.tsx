import { redirect } from "next/navigation";
import { panelPageGate } from "@/lib/panelAuth";
import FondoAdmin from "@/components/admin/FondoAdmin";

export const dynamic = "force-dynamic";

export default async function FondoPage() {
  const gate = await panelPageGate("fondo");
  if (!gate.user) redirect(gate.redirectTo);
  return <FondoAdmin />;
}
