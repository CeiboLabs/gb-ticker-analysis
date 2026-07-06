"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Glass } from "@/components/institucional/LiquidGlass";
import { Carpeta3D } from "@/components/institucional/Carpeta3D";

type NavItem = { label: string; href: string; desc: string };
type Featured = {
  kind: "tile" | "doc" | "carpeta";
  zoneLabel: string;   // eyebrow de la zona (Destacado / Archivo / En contexto)
  eyebrow: string;     // eyebrow interno del objeto (El fondo / Research / La casa)
  title: string;
  note: string;
  href: string;
  cta: string;
  img?: string;        // sólo kind="doc"
};
type NavGroup = {
  label: string;
  thesis: { text: string; gold?: string };
  hint: string;
  listEyebrow: string;
  items: NavItem[];
  featured: Featured;
};

/**
 * Tres grupos (La casa · Invertir · Research) que abren un panel editorial AL
 * RAS de la barra — no una tarjeta flotante. La estructura es la convención
 * medida en la banca premium (Marex, Morgan Stanley, Schroders, J.P. Morgan
 * Private Bank): panel full-bleed, radius 0, SIN sombra, hairlines como
 * estructura, tres zonas (tesis serif · lista · destacado). El oro se raciona
 * al tick del trigger activo y al objeto destacado (única sombra permitida:
 * objeto-documento). El destacado no inventa datos.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "La casa",
    thesis: { text: "Una casa de bolsa, desde 1967." },
    hint: "Quiénes somos, de dónde venimos y quiénes lo hacen.",
    listEyebrow: "Secciones",
    items: [
      { label: "Nosotros", href: "/nosotros", desc: "Quiénes somos y cómo trabajamos" },
      { label: "Historia", href: "/historia", desc: "Seis décadas en el mercado" },
      { label: "Equipo", href: "/equipo", desc: "Las personas de la mesa" },
    ],
    featured: {
      kind: "tile",
      zoneLabel: "En contexto",
      eyebrow: "La casa",
      title: "Corredores de bolsa desde 1967.",
      note: "Trayectoria y regulación",
      href: "/nosotros",
      cta: "Conocé la casa",
    },
  },
  {
    label: "Invertir",
    thesis: { text: "Dos maneras de estar en el mercado." },
    hint: "Un vehículo que resuelve todo, o el mercado a medida desde la mesa.",
    listEyebrow: "Vías",
    items: [
      { label: "BNG Selección Global", href: "/bng-seleccion-global", desc: "El fondo de la casa · el mundo en una sola posición" },
      { label: "Ecosistema", href: "/servicios", desc: "Mercado local e internacional · instrumentos a medida" },
    ],
    featured: {
      kind: "tile",
      zoneLabel: "Destacado",
      eyebrow: "El fondo",
      title: "El mundo, en una sola posición.",
      note: "BNG Selección Global · desde la casa",
      href: "/bng-seleccion-global",
      cta: "Ver el fondo",
    },
  },
  {
    label: "Research",
    thesis: { text: "Cómo leemos", gold: "el mercado." },
    hint: "Lectura periódica de la mesa y una herramienta para mirar cualquier acción.",
    listEyebrow: "Secciones",
    items: [
      { label: "Informes", href: "/informes", desc: "Lectura semanal y mensual del mercado" },
      { label: "Análisis", href: "/analisis", desc: "Herramienta de análisis de acciones" },
    ],
    featured: {
      kind: "carpeta",
      zoneLabel: "Archivo",
      eyebrow: "Research",
      title: "Lecturas de la mesa.",
      note: "Semanal y mensual",
      href: "/informes",
      cta: "Ver informes",
    },
  },
];

const CONSULTANET = "https://consultanet.gbengochea.com.uy/HBValores/wplogin.aspx";

const ARIAL = 'Arial, "Helvetica Neue", Helvetica, system-ui, sans-serif';

const isItemActive = (pathname: string, href: string) =>
  pathname === href || (href !== "/" && pathname.startsWith(href));

// Flecha de línea para los CTAs del destacado.
function Arrow() {
  return (
    <svg width="14" height="10" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M1 6h13M10 1l5 5-5 5" />
    </svg>
  );
}

/**
 * Navbar adaptativo: logo a la izquierda, tres grupos con mega-panel editorial,
 * y a la derecha una cápsula glass con Consultanet + pill "Contacto".
 * Oscuro/transparente sobre los heros navy; glass claro al scrollear.
 */
export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    // El modo oscuro dura mientras el hero (oscuro) esté detrás de la barra:
    // recién al pasarlo flipea a claro. Sin hero que participe (p.ej. /analyze,
    // o el fondo, que flipea apenas arranca el scroll) → claro casi de entrada.
    const heroBottom = () => {
      const hero = document.querySelector(".hero-media, .hero-split, .dossier-hero, .informe-hero");
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

  // Cerrar todo al navegar.
  useEffect(() => {
    setMenuOpen(false);
    setOpenGroup(null);
  }, [pathname]);

  // Con un panel abierto: Escape cierra, y un click fuera del navbar cierra.
  useEffect(() => {
    if (!openGroup) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenGroup(null); };
    const onDocClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.(".nav-root, .nav-mega-layer")) setOpenGroup(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onDocClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onDocClick);
    };
  }, [openGroup]);

  // Apertura por CLICK (patrón disclosure — NN/g 2024 / W3C APG): el hover NO
  // abre. Se abre al clickear el trigger y se cierra al reclickearlo, al
  // clickear afuera, con Escape, o al navegar.

  // /analyze y la LISTA de informes (/informes) → navbar claro/glass. El ARTÍCULO
  // de un informe abre con hero navy → oscuro que flipea a claro (.informe-hero).
  // Abrir un dropdown TAMBIÉN fuerza el modo claro (logo/triggers oscuros) y, vía
  // data-panel-open, le da fondo BLANCO sólido a la barra, para que barra + panel
  // lean como una sola superficie blanca — incl. al tope de la home.
  const light = scrolled || menuOpen || openGroup !== null || pathname.startsWith("/analyze") || pathname === "/informes";
  const mode = light ? "light" : "dark";
  // El fondo del dropdown es SIEMPRE claro (pedido del usuario), aunque la barra
  // esté en modo oscuro sobre el hero. Los estilos .nav-mega.is-dark quedan
  // dormidos por si más adelante se quisiera volver al panel oscuro.
  const megaTone = "is-light";

  return (
    <>
      <nav className="site nav-root" data-mode={mode} data-panel-open={openGroup ? "1" : "0"}>
      <div className="mx-auto max-w-[1440px] px-6 sm:px-8 h-full flex items-center gap-10">
        {/* Wordmark */}
        <Link href="/" className="flex items-center shrink-0 cursor-pointer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-bengochea-light.svg?v=1" alt="Gastón Bengochea" className="nav-logo" />
        </Link>

        {/* Grupos + mega-panel editorial al ras */}
        <div className="hidden lg:flex items-stretch h-full gap-7">
          {NAV_GROUPS.map((group, gi) => {
            const panelId = `nav-panel-${gi}`;
            const isOpen = openGroup === group.label;
            const groupActive = group.items.some((it) => isItemActive(pathname, it.href));
            return (
              <div key={group.label} className="nav-group">
                <button
                  type="button"
                  id={`nav-trigger-${gi}`}
                  className="nav-trigger"
                  data-active={groupActive ? "1" : "0"}
                  data-open={isOpen ? "1" : "0"}
                  aria-haspopup="true"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  style={{ fontFamily: ARIAL }}
                  onClick={() => setOpenGroup(isOpen ? null : group.label)}
                  onKeyDown={(e) => {
                    // Enter/Espacio ya togglean vía el click nativo del botón.
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setOpenGroup(group.label);
                      requestAnimationFrame(() => document.getElementById(panelId)?.querySelector<HTMLElement>(".nav-item")?.focus());
                    } else if (e.key === "Escape") {
                      setOpenGroup(null);
                    }
                  }}
                >
                  {group.label}
                  <svg className="nav-caret" width="9" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M1 1l4 4 4-4" />
                  </svg>
                </button>
              </div>
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
          maxHeight: menuOpen ? "820px" : 0,
          opacity: menuOpen ? 1 : 0,
        }}
      >
        <div className="px-6 py-5 flex flex-col gap-1">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  fontFamily: ARIAL,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#4A4E6B",
                  paddingTop: 16,
                  paddingBottom: 6,
                }}
              >
                {group.label}
              </div>
              {group.items.map((it) => {
                const active = isItemActive(pathname, it.href);
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className="py-3"
                    style={{
                      fontFamily: ARIAL,
                      fontSize: 16,
                      fontWeight: 600,
                      color: active ? "var(--navy)" : "var(--ink)",
                      borderBottom: "1px solid var(--site-border, #E7E8F2)",
                    }}
                  >
                    {it.label}
                  </Link>
                );
              })}
            </div>
          ))}

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
      </nav>

      {/* Paneles: capa HERMANA del <nav> — al NO estar anidados dentro de su
          backdrop-filter, su propio glass difumina la página igual que la barra
          (el mismo vidrio de verdad, no un blur comprometido). */}
      <div className="nav-mega-layer hidden lg:block">
        {NAV_GROUPS.map((group, gi) => {
          const panelId = `nav-panel-${gi}`;
          const isOpen = openGroup === group.label;
          const f = group.featured;
          const escClose = (e: React.KeyboardEvent) => {
            if (e.key === "Escape") {
              setOpenGroup(null);
              document.getElementById(`nav-trigger-${gi}`)?.focus();
            }
          };
          return (
            <div key={group.label} className="nav-mega-wrap" data-open={isOpen ? "1" : "0"}>
              <div id={panelId} className={`nav-mega ${megaTone}`} role="region" aria-label={group.label}>
                <div className="nav-mega-inner">
                  {/* Zona 1 · tesis */}
                  <div className="nav-zone nav-zone-thesis">
                    <div className="nav-eb">{group.label}</div>
                    <div className="nav-thesis">
                      {group.thesis.text}
                      {group.thesis.gold ? <> <span className="nav-thesis-gold">{group.thesis.gold}</span></> : null}
                    </div>
                    <div className="nav-hint">{group.hint}</div>
                  </div>

                  {/* Zona 2 · lista */}
                  <div className="nav-zone nav-zone-list">
                    <div className="nav-eb">{group.listEyebrow}</div>
                    {group.items.map((it) => {
                      const active = isItemActive(pathname, it.href);
                      return (
                        <Link
                          key={it.href}
                          href={it.href}
                          className="nav-item"
                          data-active={active ? "1" : "0"}
                          tabIndex={isOpen ? 0 : -1}
                          onKeyDown={escClose}
                        >
                          <span className="nav-item-t" style={{ fontFamily: ARIAL }}>{it.label}</span>
                          <span className="nav-item-d" style={{ fontFamily: ARIAL }}>{it.desc}</span>
                        </Link>
                      );
                    })}
                  </div>

                  {/* Zona 3 · destacado (objeto-documento: única sombra permitida) */}
                  <div className="nav-zone nav-zone-feat">
                    <div className="nav-eb">{f.zoneLabel}</div>
                    <Link href={f.href} className="nav-feat-link" tabIndex={isOpen ? 0 : -1} onKeyDown={escClose}>
                      {f.kind === "tile" ? (
                        <div className="nav-feat-tile">
                          <div className="nav-feat-eb">{f.eyebrow}</div>
                          <div className="nav-feat-title">{f.title}</div>
                          <div className="nav-feat-note">{f.note}</div>
                          <div className="nav-feat-cta">{f.cta} <Arrow /></div>
                        </div>
                      ) : f.kind === "carpeta" ? (
                        <div className="nav-feat-doc nav-feat-doc--carpeta">
                          <div className="nav-feat-carpeta">
                            <Carpeta3D scale={0.34} interactive={false} animate={false} />
                          </div>
                          <div>
                            <div className="nav-feat-doc-eb">{f.eyebrow}</div>
                            <div className="nav-feat-doc-title">{f.title}</div>
                            <div className="nav-feat-doc-note">{f.note}</div>
                            <div className="nav-feat-doc-cta">{f.cta} <Arrow /></div>
                          </div>
                        </div>
                      ) : (
                        <div className="nav-feat-doc">
                          <div className="nav-feat-cover">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={f.img} alt="" />
                          </div>
                          <div>
                            <div className="nav-feat-doc-eb">{f.eyebrow}</div>
                            <div className="nav-feat-doc-title">{f.title}</div>
                            <div className="nav-feat-doc-note">{f.note}</div>
                            <div className="nav-feat-doc-cta">{f.cta} <Arrow /></div>
                          </div>
                        </div>
                      )}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
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
           blur por frame es lo que fundía la máquina. */
        .nav-root.nav-tucking {
          -webkit-backdrop-filter: none !important;
          backdrop-filter: none !important;
          box-shadow: none !important;
          will-change: transform;
        }
        /* Modo claro: barra liquid-glass al scrollear */
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
        /* Con un dropdown abierto la barra toma fondo BLANCO SÓLIDO (matchea el
           panel blanco), incl. al tope de la home donde si no sería transparente
           sobre el hero. Va después de los data-mode para ganar por orden de fuente. */
        .nav-root[data-panel-open="1"] {
          background: #fff;
          -webkit-backdrop-filter: none;
          backdrop-filter: none;
          border-bottom-color: transparent;
          box-shadow: none;
        }

        .nav-logo {
          height: 28px;
          width: auto;
          transition: filter 240ms ease;
        }
        .nav-root[data-mode="dark"] .nav-logo {
          filter: brightness(0) invert(1);
        }

        /* ---- Triggers ---- */
        .nav-group {
          position: relative;
          display: flex;
          align-items: center;
        }
        .nav-trigger {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 15px;
          font-weight: 600;
          line-height: 1;
          padding: 0 0 4px;
          margin: 0;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          transition: color 180ms ease, border-color 180ms ease;
        }
        .nav-caret { transition: transform 200ms ease; }
        .nav-trigger[data-open="1"] .nav-caret { transform: rotate(180deg); }

        /* Estados del subrayado del trigger:
           · hover / abierto  → NEGRO (--ink; en modo oscuro sobre el hero: blanco,
             porque el negro no se vería)
           · página actual (activo) → ORO (acento de la casa). Va último → gana
             sobre el hover: la página actual no cambia de color al pasar por encima. */
        .nav-root[data-mode="dark"] .nav-trigger { color: rgba(255, 255, 255, 0.82); }
        .nav-root[data-mode="dark"] .nav-trigger:hover,
        .nav-root[data-mode="dark"] .nav-trigger[data-open="1"] {
          color: #fff;
          border-bottom-color: #fff;
        }
        .nav-root[data-mode="dark"] .nav-trigger[data-active="1"] {
          color: #fff;
          border-bottom-color: var(--gold-soft);
        }
        .nav-root[data-mode="light"] .nav-trigger { color: #4A4E6B; }
        .nav-root[data-mode="light"] .nav-trigger:hover,
        .nav-root[data-mode="light"] .nav-trigger[data-open="1"] {
          color: var(--ink);
          border-bottom-color: var(--ink);
        }
        .nav-root[data-mode="light"] .nav-trigger[data-active="1"] {
          color: var(--ink);
          border-bottom-color: var(--gold-deep);
        }
        .nav-trigger:focus-visible {
          outline: 2px solid var(--gold-soft);
          outline-offset: 3px;
          border-radius: 3px;
        }

        /* ---- Mega-panel editorial al ras ----
           Medido en 13 referentes: radius 0, sombra none. La estructura sale de
           hairlines (regla-masthead arriba + hairline abajo + verticales entre
           zonas), nunca de una tarjeta flotante. */
        .nav-mega-wrap {
          position: fixed;
          top: var(--nav-h);
          left: 0;
          right: 0;
          z-index: 49;
          opacity: 0;
          transform: translateY(-6px);
          visibility: hidden;
          pointer-events: none;
          transition: opacity 180ms ease, transform 180ms ease, visibility 0s linear 180ms;
        }
        .nav-mega-wrap[data-open="1"] {
          opacity: 1;
          transform: translateY(0);
          visibility: visible;
          pointer-events: auto;
          transition: opacity 200ms ease, transform 200ms ease;
        }
        .nav-mega {
          border-top: 1px solid transparent;
          border-bottom: 1px solid transparent;
        }
        /* Panel = MISMA receta glass que la barra al scrollear (.nav-root
           [data-mode="light"]): blur 22 · opacidad 0.62 · brillo especular
           superior. Así barra y panel son exactamente el mismo vidrio. */
        .nav-mega.is-light {
          background: #fff;
          border-top-color: var(--ink);
          border-bottom-color: var(--site-border);
        }
        .nav-mega.is-dark {
          background:
            radial-gradient(60% 130% at 86% -8%, rgba(201, 168, 76, 0.10), transparent 58%),
            linear-gradient(180deg, #12274a, #0b1a36);
          border-top-color: var(--gold-soft);
          border-bottom-color: rgba(255, 255, 255, 0.12);
        }
        .nav-mega-inner {
          max-width: 1440px;
          margin: 0 auto;
          padding: 30px 32px 40px;
          display: grid;
          grid-template-columns: 256px 1fr 372px;
        }
        .nav-zone { padding: 2px 44px; min-width: 0; }
        .nav-zone-thesis { padding-left: 0; }
        .nav-zone-list { border-left: 1px solid var(--site-border); }
        .nav-zone-feat { border-left: 1px solid var(--site-border); padding-right: 0; }
        .nav-mega.is-dark .nav-zone-list,
        .nav-mega.is-dark .nav-zone-feat { border-left-color: rgba(255, 255, 255, 0.12); }

        .nav-eb {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-bottom: 16px;
        }
        .nav-mega.is-light .nav-eb { color: var(--site-ink-3); }
        .nav-mega.is-dark .nav-eb { color: rgba(255, 255, 255, 0.5); }

        .nav-thesis {
          font-family: var(--font-serif), "Newsreader", Georgia, serif;
          font-weight: 300;
          font-size: 27px;
          line-height: 1.18;
          letter-spacing: -0.015em;
          max-width: 9em;
        }
        .nav-mega.is-light .nav-thesis { color: var(--ink); }
        .nav-mega.is-dark .nav-thesis { color: #fff; }
        .nav-thesis-gold { font-style: normal; }
        .nav-mega.is-light .nav-thesis-gold { color: var(--gold-deep); }
        .nav-mega.is-dark .nav-thesis-gold { color: var(--gold-soft); }
        .nav-hint { margin-top: 18px; font-size: 13px; line-height: 1.5; max-width: 16em; }
        .nav-mega.is-light .nav-hint { color: var(--site-ink-3); }
        .nav-mega.is-dark .nav-hint { color: rgba(255, 255, 255, 0.55); }

        .nav-item {
          display: block;
          padding: 13px 0 14px;
          border-left: 2px solid transparent;
          padding-left: 0;
          transition: padding-left 180ms ease, border-color 160ms ease;
        }
        .nav-item + .nav-item { border-top: 1px solid var(--site-border); }
        .nav-mega.is-dark .nav-item + .nav-item { border-top-color: rgba(255, 255, 255, 0.1); }
        .nav-item-t { display: block; font-size: 16px; font-weight: 600; letter-spacing: -0.005em; }
        .nav-item-d { display: block; font-size: 13px; line-height: 1.4; margin-top: 4px; }
        .nav-mega.is-light .nav-item-t { color: var(--site-ink); }
        .nav-mega.is-light .nav-item-d { color: var(--site-ink-3); }
        .nav-mega.is-dark .nav-item-t { color: #fff; }
        .nav-mega.is-dark .nav-item-d { color: rgba(255, 255, 255, 0.55); }
        .nav-item:hover, .nav-item:focus-visible, .nav-item[data-active="1"] {
          padding-left: 16px;
          outline: none;
        }
        .nav-mega.is-light .nav-item:hover,
        .nav-mega.is-light .nav-item:focus-visible,
        .nav-mega.is-light .nav-item[data-active="1"] { border-left-color: var(--gold-deep); }
        .nav-mega.is-dark .nav-item:hover,
        .nav-mega.is-dark .nav-item:focus-visible,
        .nav-mega.is-dark .nav-item[data-active="1"] { border-left-color: var(--gold-soft); }
        .nav-mega.is-light .nav-item:hover .nav-item-t,
        .nav-mega.is-light .nav-item:focus-visible .nav-item-t,
        .nav-mega.is-light .nav-item[data-active="1"] .nav-item-t { color: var(--navy); }
        .nav-mega.is-dark .nav-item:hover .nav-item-t,
        .nav-mega.is-dark .nav-item:focus-visible .nav-item-t,
        .nav-mega.is-dark .nav-item[data-active="1"] .nav-item-t { color: var(--gold-soft); }

        /* Zona destacada */
        .nav-feat-link { display: block; }
        .nav-feat-link:focus-visible { outline: 2px solid var(--gold-soft); outline-offset: 3px; border-radius: 12px; }
        .nav-feat-tile {
          position: relative;
          overflow: hidden;
          border-radius: 10px;
          padding: 22px 22px 20px;
          min-height: 188px;
          display: flex;
          flex-direction: column;
          background:
            radial-gradient(72% 100% at 88% 0%, rgba(201, 168, 76, 0.16), transparent 60%),
            linear-gradient(155deg, #16305f, #0c1c3e);
          box-shadow: 0 16px 30px -14px rgba(2, 8, 32, 0.5);
          transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .nav-mega.is-dark .nav-feat-tile {
          background:
            radial-gradient(72% 100% at 88% 0%, rgba(201, 168, 76, 0.2), transparent 60%),
            linear-gradient(155deg, rgba(31, 54, 101, 0.92), rgba(9, 20, 46, 0.92));
          border: 1px solid rgba(242, 227, 176, 0.22);
          box-shadow: none;
        }
        .nav-feat-link:hover .nav-feat-tile { transform: translateY(-2px); }
        .nav-feat-eb { font-size: 10.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gold-soft); }
        .nav-feat-title {
          font-family: var(--font-serif), "Newsreader", Georgia, serif;
          font-weight: 300; font-size: 23px; line-height: 1.2; letter-spacing: -0.01em;
          color: #fff; margin-top: 12px;
        }
        .nav-feat-note { font-size: 12.5px; color: rgba(255, 255, 255, 0.6); margin-top: 8px; }
        .nav-feat-cta { margin-top: auto; padding-top: 16px; font-size: 13.5px; font-weight: 600; color: var(--gold-soft); display: inline-flex; align-items: center; gap: 7px; }
        .nav-feat-link:hover .nav-feat-cta { gap: 10px; }
        .nav-feat-cta { transition: gap 200ms ease; }

        .nav-feat-doc { display: flex; gap: 16px; align-items: flex-start; }
        .nav-feat-cover {
          width: 90px; height: 118px; flex: 0 0 auto;
          border-radius: 3px; overflow: hidden;
          box-shadow: 0 10px 22px -8px rgba(3, 6, 94, 0.4);
          border: 1px solid rgba(0, 0, 0, 0.08);
        }
        .nav-mega.is-dark .nav-feat-cover { border-color: rgba(255, 255, 255, 0.14); }
        .nav-feat-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
        /* Variante con la carpeta 3D en lugar de la tapa-foto: el objeto trae su
           propia sombra/volumen, así que va SIN el marco de .nav-feat-cover.
           Centrado vertical contra el bloque de texto y con un respiro a los
           lados para que la flotación no toque el borde de la zona. */
        .nav-feat-doc--carpeta { align-items: center; gap: 10px; }
        .nav-feat-carpeta { flex: 0 0 auto; margin: -8px 2px -8px -6px; }
        .nav-feat-doc-eb { font-size: 10.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
        .nav-mega.is-light .nav-feat-doc-eb { color: var(--gold-deep); }
        .nav-mega.is-dark .nav-feat-doc-eb { color: var(--gold-soft); }
        .nav-feat-doc-title {
          font-family: var(--font-serif), "Newsreader", Georgia, serif;
          font-weight: 300; font-size: 21px; line-height: 1.2; letter-spacing: -0.01em; margin-top: 8px;
        }
        .nav-mega.is-light .nav-feat-doc-title { color: var(--ink); }
        .nav-mega.is-dark .nav-feat-doc-title { color: #fff; }
        .nav-feat-doc-note { font-size: 12px; margin-top: 8px; }
        .nav-mega.is-light .nav-feat-doc-note { color: var(--site-ink-3); }
        .nav-mega.is-dark .nav-feat-doc-note { color: rgba(255, 255, 255, 0.55); }
        .nav-feat-doc-cta { margin-top: 14px; font-size: 13.5px; font-weight: 600; display: inline-flex; align-items: center; gap: 7px; transition: gap 200ms ease; }
        .nav-feat-link:hover .nav-feat-doc-cta { gap: 10px; }
        .nav-mega.is-light .nav-feat-doc-cta { color: var(--gold-deep); }
        .nav-mega.is-dark .nav-feat-doc-cta { color: var(--gold-soft); }

        /* Layout interno de la cápsula glass (el material vive en .lqg*) */
        .nav-capsule-row {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 6px 5px 16px;
        }

        .nav-cta { transition: background 180ms ease, color 180ms ease, transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1); }
        .nav-cta:active { transform: scale(0.95); }
        @media (prefers-reduced-motion: reduce) {
          .nav-cta:active { transform: none; }
          .nav-caret { transition: none; }
          .nav-item { transition: border-color 160ms ease; }
          .nav-feat-tile, .nav-feat-cta, .nav-feat-doc-cta { transition: none; }
          .nav-mega-wrap { transition: opacity 120ms ease, visibility 0s linear 120ms; transform: none; }
          .nav-mega-wrap[data-open="1"] { transform: none; transition: opacity 120ms ease; }
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
    </>
  );
}
