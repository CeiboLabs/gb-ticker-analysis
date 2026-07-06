// Layout de TODO /admin (panel de empleados + dashboard de métricas): sólo
// aporta el noindex — los buscadores no tienen nada que hacer acá (además del
// header X-Robots-Tag que agrega next.config.ts). El gate de auth NO vive en
// layouts: cada page se protege sola (los layouts no se re-ejecutan al navegar).

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Panel — Bengochea",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
