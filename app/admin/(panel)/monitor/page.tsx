import { redirect } from "next/navigation";
import { panelPageGate } from "@/lib/panelAuth";
import MonitorDashboard from "@/components/admin/MonitorDashboard";

export const dynamic = "force-dynamic";

export default async function MonitorPage() {
  const gate = await panelPageGate("monitor");
  if (!gate.user) redirect(gate.redirectTo);
  return <MonitorDashboard />;
}
