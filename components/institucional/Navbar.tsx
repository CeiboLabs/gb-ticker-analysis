"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { label: string; href: string; external?: boolean };

const NAV_LINKS: NavLink[] = [
  { label: "Nosotros", href: "/nosotros" },
  { label: "Historia", href: "/historia" },
  { label: "Ecosistema", href: "/servicios" },
  { label: "Equipo", href: "/equipo" },
  { label: "Informes", href: "/informes" },
  { label: "Análisis", href: "/analisis" },
];

const ACCESOS: NavLink[] = [
  { label: "Cuenta Activa", href: "https://cuentaactiva.gbengochea.com.uy/", external: true },
  { label: "Consultanet", href: "https://consultanet.gbengochea.com.uy/HBValores/wplogin.aspx", external: true },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const isDark = pathname.startsWith("/analyze");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const bg = isDark ? "var(--navy)" : "var(--ivory)";
  const fg = isDark ? "var(--ivory)" : "var(--ink)";
  const fgSecondary = isDark ? "rgba(255,255,255,0.72)" : "var(--ink-2)";
  const ruleColor = isDark ? "rgba(255,255,255,0.18)" : "var(--rule)";
  const goldAccent = isDark ? "var(--gold-soft)" : "var(--gold-deep)";

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50"
      style={{
        background: bg,
        borderBottom: `1px solid ${scrolled || isDark ? ruleColor : "transparent"}`,
        transition: "border-color 200ms ease",
        height: "var(--nav-h)",
      }}
    >
      <div className="mx-auto max-w-[1440px] px-6 sm:px-8 h-full flex items-center justify-between">
        {/* Wordmark */}
        <Link href="/" className="flex items-center shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-bengochea.svg?v=2"
            alt="Gastón Bengochea"
            style={{
              height: 28,
              width: "auto",
              filter: isDark ? "none" : "invert(1)",
            }}
          />
        </Link>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-7">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className="nav-link-anchor"
                data-dark={isDark ? "1" : "0"}
                data-active={active ? "1" : "0"}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: active ? fg : fgSecondary,
                  paddingBottom: 4,
                  borderBottom: `1px solid ${active ? "var(--gold)" : "transparent"}`,
                  transition: "color 180ms ease, border-color 180ms ease",
                }}
              >
                {link.label}
              </Link>
            );
          })}

          <span
            aria-hidden
            style={{ width: 1, height: 18, background: ruleColor, display: "inline-block" }}
          />

          {ACCESOS.map((acc) => (
            <a
              key={acc.href}
              href={acc.href}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link-anchor"
              data-dark={isDark ? "1" : "0"}
              data-active="0"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 11.5,
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: goldAccent,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {acc.label}
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M3 9L9 3M9 3H4M9 3V8" />
              </svg>
            </a>
          ))}

          <Link
            href="/contacto"
            className={isDark ? "btn btn-on-navy-primary" : "btn btn-primary"}
            style={{ padding: "10px 16px", fontSize: 12 }}
          >
            Contacto <span className="arrow" />
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="lg:hidden p-2"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Menú"
          style={{ color: fg }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            {menuOpen ? (
              <>
                <path d="M6 6l12 12" />
                <path d="M6 18L18 6" />
              </>
            ) : (
              <>
                <path d="M3 7h18" />
                <path d="M3 13h18" />
                <path d="M3 19h18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        className="lg:hidden overflow-hidden"
        style={{
          maxHeight: menuOpen ? "720px" : 0,
          opacity: menuOpen ? 1 : 0,
          background: bg,
          borderTop: menuOpen ? `1px solid ${ruleColor}` : "none",
          transition: "max-height 260ms ease, opacity 200ms ease",
        }}
      >
        <div className="px-6 py-5 flex flex-col gap-1">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className="py-3"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: active ? goldAccent : fg,
                  borderBottom: `1px solid ${ruleColor}`,
                }}
              >
                {link.label}
              </Link>
            );
          })}

          <div
            className="mono pt-4 pb-2"
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: fgSecondary,
            }}
          >
            Accesos clientes
          </div>

          {ACCESOS.map((acc) => (
            <a
              key={acc.href}
              href={acc.href}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: goldAccent,
                borderBottom: `1px solid ${ruleColor}`,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {acc.label}
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M3 9L9 3M9 3H4M9 3V8" />
              </svg>
            </a>
          ))}

          <Link
            href="/contacto"
            className={isDark ? "btn btn-on-navy-primary mt-4" : "btn btn-primary mt-4"}
            style={{ justifyContent: "center" }}
          >
            Agendá una reunión <span className="arrow" />
          </Link>
        </div>
      </div>

      <style>{`
        .nav-link-anchor[data-dark="1"][data-active="0"]:hover { color: var(--ivory) !important; }
        .nav-link-anchor[data-dark="0"][data-active="0"]:hover { color: var(--ink) !important; }
      `}</style>
    </nav>
  );
}
