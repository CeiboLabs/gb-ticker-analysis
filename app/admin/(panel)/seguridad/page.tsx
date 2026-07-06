import { redirect } from "next/navigation";
import { panelPageGate } from "@/lib/panelAuth";
import SeguridadAdmin from "@/components/admin/SeguridadAdmin";

export const dynamic = "force-dynamic";

export default async function SeguridadPage() {
  const gate = await panelPageGate();
  if (!gate.user) redirect(gate.redirectTo);
  return <SeguridadAdmin totpEnrolled={gate.user.totpEnrolled} />;
}
