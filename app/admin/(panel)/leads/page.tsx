import { redirect } from "next/navigation";
import { panelPageGate } from "@/lib/panelAuth";
import LeadsAdmin from "@/components/admin/LeadsAdmin";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const gate = await panelPageGate("leads");
  if (!gate.user) redirect(gate.redirectTo);
  return <LeadsAdmin />;
}
