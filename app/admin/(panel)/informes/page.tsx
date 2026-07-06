import { redirect } from "next/navigation";
import { panelPageGate } from "@/lib/panelAuth";
import InformesAdmin from "@/components/admin/InformesAdmin";

export const dynamic = "force-dynamic";

export default async function InformesPage() {
  const gate = await panelPageGate("informes");
  if (!gate.user) redirect(gate.redirectTo);
  return <InformesAdmin />;
}
