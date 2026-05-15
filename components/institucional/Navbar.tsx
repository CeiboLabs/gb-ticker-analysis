"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { label: "Servicios", href: "/servicios" },
  { label: "Nosotros", href: "/nosotros" },
  { label: "Equipo", href: "/equipo" },
  { label: "Calculadora", href: "/calculadora" },
  { label: "Análisis", href: "/analisis" },
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
        <Link href="/" className="flex items-baseline gap-2 shrink-0">
          <span
            className="serif"
            style={{
              fontWeight: 400,
              fontSize: 22,
              color: fg,
              letterSpacing: "-0.01em",
            }}
          >
            Bengochea
          </span>
          <span
            className="serif-i"
            style={{ fontSize: 18, color: goldAccent }}
          >
            &amp; Cía.
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-9">
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
                  fontSize: 13,
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
          <Link
            href="/contacto"
            className={isDark ? "btn btn-on-navy-primary" : "btn btn-primary"}
            style={{ padding: "10px 18px", fontSize: 13 }}
          >
            Agendá una reunión <span className="arrow" />
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
          maxHeight: menuOpen ? "420px" : 0,
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
