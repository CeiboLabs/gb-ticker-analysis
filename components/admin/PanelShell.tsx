"use client";

// Shell del panel: barra lateral navy (el polo estructural de la marca) con las
// secciones que el usuario puede ver — filtradas por permisos, la barra es UX y
// el gate real vive en cada page y route handler — + identidad y logout. Envuelto
// en .site para heredar Arial y los tokens de marca; el material lo dan las
// clases .adm-* de globals.css.

import { usePathname } from "next/navigation";
import Link from "next/link";
import { type ReactNode } from "react";
import { panelFetch, Badge } from "@/components/admin/ui";

export type ShellUser = {
  nombre: string;
  email: string;
  role: "admin" | "editor";
  perms: string[];
};

const NAV: Array<{ href: string; label: string; perm?: string; adminOnly?: boolean }> = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/informes", label: "Informes", perm: "informes" },
  { href: "/admin/fondo", label: "Fondo BNG", perm: "fondo" },
  { href: "/admin/monitor", label: "Monitor", perm: "monitor" },
  { href: "/admin/secciones", label: "Secciones", perm: "secciones" },
  { href: "/admin/usuarios", label: "Usuarios", adminOnly: true },
  { href: "/admin/seguridad", label: "Mi seguridad" },
];

export default function PanelShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const pathname = usePathname();

  const items = NAV.filter((it) => {
    if (it.adminOnly && user.role !== "admin") return false;
    if (it.perm && user.role !== "admin" && !user.perms.includes(it.perm)) return false;
    return true;
  });

  async function logout() {
    await panelFetch("/api/admin/panel/auth/logout", { method: "POST", redirectOn401: false });
    window.location.href = "/admin/login";
  }

  return (
    <div className="site adm-shell">
      <aside className="adm-side">
        <div className="adm-brand">
          <p className="wm">
            <b>Bengochea</b> <span className="amp">&amp; Cía.</span>
          </p>
          <div className="goldline" />
          <p className="sub">Panel de gestión</p>
        </div>
        <div className="adm-user">
          <span className="nm">
            {user.nombre}
            <Badge tone={user.role === "admin" ? "gold" : "neutral"}>{user.role === "admin" ? "Admin" : "Editor"}</Badge>
          </span>
          <span className="em" title={user.email}>
            {user.email}
          </span>
        </div>
        <nav className="adm-nav">
          {items.map((it) => {
            const active = it.href === "/admin" ? pathname === "/admin" : pathname.startsWith(it.href);
            return (
              <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}>
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="adm-foot">
          <button onClick={logout}>Cerrar sesión</button>
        </div>
      </aside>
      <main className="adm-main">
        <div className="adm-main-wrap">{children}</div>
      </main>
    </div>
  );
}
