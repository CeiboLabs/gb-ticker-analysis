"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Glass } from "@/components/institucional/LiquidGlass";

type NavLink = { label: string; href: string; external?: boolean };

const NAV_LINKS: NavLink[] = [
  { label: "Nosotros", href: "/nosotros" },
  { label: "Historia", href: "/historia" },
  { label: "Ecosistema", href: "/servicios" },
  { label: "Fondo", href: "/bng-seleccion-global" },
  { label: "Equipo", href: "/equipo" },
  { label: "Informes", href: "/informes" },
  { label: "Análisis", href: "/analisis" },
];

const CONSULTANET = "https://consultanet.gbengochea.com.uy/HBValores/wplogin.aspx";

const ARIAL = 'Arial, "Helvetica Neue", Helvetica, system-ui, sans-serif';

/**
 * Navbar estilo Fey: logo a la izquierda, links sueltos al lado y a la
 * derecha una cápsula glass con Consultanet + pill "Contacto".
 * Adaptativa: oscura/transparente sobre los heros navy; glass clara al
 * scrollear (o en /analyze, cuyo tope es blanco).
 */
export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // El modo oscuro dura mientras el hero (oscuro) esté detrás de la barra:
    // recién al pasarlo flipea a claro. Sin hero que participe (p.ej. /analyze,
    // o el fondo, que flipea apenas arranca el scroll) → claro casi de entrada.
    const heroBottom = () => {
      const hero = document.querySelector(".hero-media, .hero-split, .dossier-hero");
      if (!hero) return 8;
      const navH = 72;
      return Math.max(hero.getBoundingClientRect().height - navH, 8);
    };
    let threshold = heroBottom();
    const onScroll = () => setScrolled(window.scrollY > threshold);
    const onResize = () => {
      threshold = heroBottom();
      onScroll();
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [pathname]);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // /analyze e /informes no tienen hero oscuro de lado a lado (el panel del
  // modelo 3D es blanco): navbar siempre en modo claro/glass.
  const light = scrolled || menuOpen || pathname.startsWith("/analyze") || pathname.startsWith("/informes");
  const mode = light ? "light" : "dark";

  return (
    <nav className="site nav-root" data-mode={mode}>
      <div className="mx-auto max-w-[1440px] px-6 sm:px-8 h-full flex items-center gap-10">
        {/* Wordmark */}
        <Link href="/" className="flex items-center shrink-0 cursor-pointer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-bengochea-light.svg?v=1" alt="Gastón Bengochea" className="nav-logo" />
        </Link>

        {/* Links sueltos junto al logo (estilo Fey) */}
        <div className="hidden lg:flex items-center gap-7">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className="nav-link"
                data-active={active ? "1" : "0"}
                style={{ fontFamily: ARIAL }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Cápsula liquid glass a la derecha: Consultanet + pill Contacto */}
        <div className="hidden lg:flex items-center ml-auto">
          <Glass interactive variant={light ? "light" : "dark"} contentClassName="nav-capsule-row">
            <a
              href={CONSULTANET}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-consultanet"
              style={{ fontFamily: ARIAL }}
            >
              Consultanet
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M3 9L9 3M9 3H4M9 3V8" />
              </svg>
            </a>
            <Link href="/contacto" className="nav-cta" style={{ fontFamily: ARIAL }}>
              Contacto
            </Link>
          </Glass>
        </div>

        {/* Mobile hamburger */}
        <button
          className="lg:hidden p-2 ml-auto nav-burger"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Menú"
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
        className="lg:hidden overflow-hidden nav-drawer"
        style={{
          maxHeight: menuOpen ? "720px" : 0,
          opacity: menuOpen ? 1 : 0,
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
                  fontFamily: ARIAL,
                  fontSize: 16,
                  fontWeight: 600,
                  color: active ? "var(--navy)" : "var(--ink)",
                  borderBottom: "1px solid var(--site-border, #E7E8F2)",
                }}
              >
                {link.label}
              </Link>
            );
          })}

          <div
            style={{
              fontFamily: ARIAL,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#4A4E6B",
              paddingTop: 18,
              paddingBottom: 8,
            }}
          >
            Accesos clientes
          </div>

          <a
            href={CONSULTANET}
            target="_blank"
            rel="noopener noreferrer"
            className="py-3"
            style={{
              fontFamily: ARIAL,
              fontSize: 15,
              fontWeight: 600,
              color: "var(--gold-deep)",
              borderBottom: "1px solid var(--site-border, #E7E8F2)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Consultanet
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M3 9L9 3M9 3H4M9 3V8" />
            </svg>
          </a>

          <Link
            href="/contacto"
            className="ui-btn ui-btn-primary mt-4"
            style={{ justifyContent: "center" }}
          >
            Agendá una reunión
          </Link>
        </div>
      </div>

      <style>{`
        .nav-root {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          height: var(--nav-h);
          transition: background 240ms ease, box-shadow 240ms ease, border-color 240ms ease;
          border-bottom: 1px solid transparent;
        }
        /* En la página del fondo, FondoNav desplaza este navbar hacia arriba
           (transform inline sobre este nodo) para que se meta detrás de su
           sub-navbar. Mientras se desliza apagamos el backdrop-filter: animar el
           blur por frame es lo que fundía la máquina. Al deslizarse queda oculto
           detrás de la sub-navbar, así que la pérdida del glass no se percibe. */
        .nav-root.nav-tucking {
          -webkit-backdrop-filter: none !important;
          backdrop-filter: none !important;
          box-shadow: none !important;
          will-change: transform;
        }
        /* Modo claro: barra liquid-glass al scrollear
           (blur alto + saturación, brillo especular en el borde superior) */
        .nav-root[data-mode="light"] {
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.62) 0%,
            rgba(248, 249, 255, 0.48) 100%
          );
          -webkit-backdrop-filter: blur(22px) saturate(180%);
          backdrop-filter: blur(22px) saturate(180%);
          border-bottom-color: rgba(215, 217, 232, 0.45);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.85),
            0 8px 32px rgba(3, 6, 94, 0.07);
        }
        /* Modo oscuro: flotante transparente sobre el hero */
        .nav-root[data-mode="dark"] {
          background: transparent;
        }

        .nav-logo {
          height: 28px;
          width: auto;
          transition: filter 240ms ease;
        }
        .nav-root[data-mode="dark"] .nav-logo {
          filter: brightness(0) invert(1);
        }

        .nav-link {
          font-size: 15px;
          font-weight: 600;
          padding-bottom: 4px;
          border-bottom: 2px solid transparent;
          transition: color 180ms ease, border-color 180ms ease;
        }
        .nav-root[data-mode="dark"] .nav-link { color: rgba(255, 255, 255, 0.82); }
        .nav-root[data-mode="dark"] .nav-link:hover { color: #fff; }
        .nav-root[data-mode="dark"] .nav-link[data-active="1"] {
          color: #fff;
          border-bottom-color: var(--gold-soft);
        }
        .nav-root[data-mode="light"] .nav-link { color: #4A4E6B; }
        .nav-root[data-mode="light"] .nav-link:hover { color: var(--navy); }
        .nav-root[data-mode="light"] .nav-link[data-active="1"] {
          color: var(--ink);
          border-bottom-color: var(--navy);
        }

        /* Layout interno de la cápsula glass (el material vive en .lqg*) */
        .nav-capsule-row {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 6px 5px 16px;
        }

        /* La pill Contacto también responde al tacto */
        .nav-cta { transition: background 180ms ease, color 180ms ease, transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1); }
        .nav-cta:active { transform: scale(0.95); }
        @media (prefers-reduced-motion: reduce) {
          .nav-cta:active { transform: none; }
        }

        .nav-consultanet {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 14px;
          font-weight: 600;
          padding-right: 14px;
          transition: color 180ms ease;
        }
        .nav-root[data-mode="dark"] .nav-consultanet { color: var(--gold-soft); }
        .nav-root[data-mode="dark"] .nav-consultanet:hover { color: #fff; }
        .nav-root[data-mode="light"] .nav-consultanet { color: var(--gold-deep); }
        .nav-root[data-mode="light"] .nav-consultanet:hover { color: var(--navy); }

        .nav-cta {
          display: inline-flex;
          align-items: center;
          padding: 9px 20px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 600;
          transition: background 180ms ease, color 180ms ease;
        }
        /* Sobre el hero: pill blanca (como el "Learn more" de Fey) */
        .nav-root[data-mode="dark"] .nav-cta {
          background: #fff;
          color: var(--navy);
        }
        .nav-root[data-mode="dark"] .nav-cta:hover { background: var(--gold-soft); }
        .nav-root[data-mode="light"] .nav-cta {
          background: var(--navy);
          color: #fff;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
        }
        .nav-root[data-mode="light"] .nav-cta:hover { background: var(--navy-700); }

        .nav-burger { color: var(--ink); }
        .nav-root[data-mode="dark"] .nav-burger { color: #fff; }

        .nav-drawer {
          background: #FFFFFF;
          border-top: 1px solid var(--site-border, #E7E8F2);
          transition: max-height 260ms ease, opacity 200ms ease;
        }
      `}</style>
    </nav>
  );
}
