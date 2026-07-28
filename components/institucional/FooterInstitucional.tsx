import Link from "next/link";
import { HAY_PRENSA } from "@/lib/prensa";

type FooterLink = { label: string; href: string; external?: boolean };

const NAV_GROUPS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Nosotros",
    links: [
      { label: "Nosotros", href: "/nosotros" },
      { label: "Historia", href: "/historia" },
      { label: "Equipo", href: "/equipo" },
      // Aparece solo cuando hay apariciones cargadas (ver lib/prensa · HAY_PRENSA).
      ...(HAY_PRENSA ? [{ label: "Prensa", href: "/prensa" }] : []),
      { label: "Contacto", href: "/contacto" },
    ],
  },
  {
    title: "Ecosistema",
    links: [
      { label: "Mercado local", href: "/servicios#local" },
      { label: "Mercado internacional", href: "/servicios#internacional" },
      { label: "BNG Selección Global", href: "/bng-seleccion-global" },
      { label: "Proceso de inversión", href: "/servicios#proceso" },
      { label: "Calculadora", href: "/calculadora" },
      { label: "Análisis de acciones", href: "/analisis" },
      { label: "Educación", href: "/educacion" },
    ],
  },
  {
    title: "Accesos",
    links: [
      { label: "Consultanet", href: "https://consultanet.gbengochea.com.uy/HBValores/wplogin.aspx", external: true },
      { label: "Informes", href: "/informes" },
      { label: "Instructivo Consultanet", href: "https://www.youtube.com/watch?v=HtIjF2N9i-0", external: true },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Tarifario", href: "https://gbengochea.com.uy/files/servicios-y-costos-2025.pdf", external: true },
      { label: "Código de Ética", href: "https://gbengochea.com.uy/files/codigo-de-etica-2025.pdf", external: true },
      { label: "Código de Buenas Prácticas", href: "https://gbengochea.com.uy/files/codigo-de-buenas-practicas-2025.pdf", external: true },
      { label: "Certificado BVM", href: "https://gbengochea.com.uy/files/certificado-de-la-bvm.pdf", external: true },
      { label: "Inscripción en BCU", href: "https://gbengochea.com.uy/files/comunicacion-de-alta-en-bcu.jpg", external: true },
      { label: "Formulario de reclamos", href: "https://gbengochea.com.uy/files/formulario-de-reclamos-bengochea.pdf", external: true },
    ],
  },
];

// Igual que el navbar: el pie lista el mapa COMPLETO, secciones sin publicar
// incluidas (`lib/paginasOcultas.ts`). Esas rutas devuelven 404.

const SOCIAL = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/gaston-bengochea-cia-corredor-de-bolsa-s-a/",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/bengochea_inversiones/",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
    ),
  },
  {
    label: "X",
    href: "https://x.com/BENGOCHEA_SB",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
    ),
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/p/Gaston-Bengochea-100068421873890/",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://youtube.com/@gastonbengocheaciacbs.acor7376",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
    ),
  },
];

export function FooterInstitucional() {
  return (
    <footer className="site band-navy mt-auto">
      <div className="site-wrap" style={{ paddingTop: 80, paddingBottom: 40 }}>
        {/* Marca + columnas de navegación */}
        <div className="footer-main">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-bengochea.svg?v=2"
              alt="Gastón Bengochea"
              style={{ height: 38, width: "auto", display: "block" }}
            />
            <p className="t-small" style={{ marginTop: 20, maxWidth: "26em" }}>
              Sociedad de Bolsa regulada por el Banco Central del Uruguay. Miembro de la Bolsa de Valores
              de Montevideo desde 1967.
            </p>
          </div>

          <div className="footer-grid">
            {NAV_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="footer-col-title">{group.title}</div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                  {group.links.map((l) => (
                    <li key={l.href}>
                      {l.external ? (
                        <a href={l.href} target="_blank" rel="noopener noreferrer" className="footer-link">
                          {l.label}
                        </a>
                      ) : (
                        <Link href={l.href} className="footer-link">{l.label}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs grandes con flecha (estilo Marex) */}
        <div className="footer-cta">
          <Link href="/contacto" className="footer-big-link">
            <span>Agendá una reunión</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
          <Link href="/analisis" className="footer-big-link">
            <span>Analizá una acción</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
        </div>

        {/* Colofón */}
        <div className="footer-bottom">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div className="t-small" style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
              <span>© {new Date().getFullYear()} Gastón Bengochea &amp; Cía.</span>
              <a href="tel:+59826286447" className="footer-link">+598 2628 6447</a>
              <a href="mailto:info@gbengochea.com.uy" className="footer-link">info@gbengochea.com.uy</a>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {SOCIAL.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="footer-social">
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          <p className="t-small" style={{ margin: "20px 0 0", maxWidth: "62em", lineHeight: 1.6, opacity: 0.7 }}>
            La información publicada en este sitio tiene fines informativos y no constituye asesoramiento
            personalizado de inversión. Las decisiones de inversión son responsabilidad del cliente.
            Desarrollado por{" "}
            <a href="https://ceibolabs.dev" target="_blank" rel="noopener noreferrer" className="footer-link" style={{ textDecoration: "underline" }}>ceibolabs</a>.
          </p>
        </div>
      </div>

      <style>{`
        .footer-main {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.7fr);
          gap: 48px;
          padding-bottom: 56px;
        }
        .footer-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 32px;
        }
        .footer-col-title {
          font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--gold-soft); margin-bottom: 18px;
        }
        .footer-link {
          color: rgba(255,255,255,0.72);
          font-size: 15px;
          text-decoration: none;
          transition: color 160ms ease;
        }
        .footer-link:hover { color: var(--gold-soft); }

        .footer-cta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
          border-top: 1px solid rgba(255,255,255,0.16);
          border-bottom: 1px solid rgba(255,255,255,0.16);
        }
        .footer-big-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 36px 32px 36px 0;
          font-size: clamp(24px, 3vw, 36px);
          font-weight: 400;
          letter-spacing: -0.02em;
          color: #fff;
          text-decoration: none;
          transition: padding-left 200ms ease, color 160ms ease;
        }
        .footer-big-link:first-child { border-right: 1px solid rgba(255,255,255,0.16); padding-right: 32px; }
        .footer-big-link:last-child { padding-left: 32px; }
        .footer-big-link svg { width: 30px; height: 30px; flex: none; transition: transform 200ms ease; opacity: 0.7; }
        .footer-big-link:hover { color: var(--gold-soft); }
        .footer-big-link:hover svg { transform: translateX(6px); opacity: 1; }

        .footer-bottom { padding-top: 36px; }
        .footer-social {
          width: 38px; height: 38px; border-radius: 8px;
          display: inline-flex; align-items: center; justify-content: center;
          border: 1px solid rgba(255,255,255,0.18);
          color: rgba(255,255,255,0.65);
          transition: color 160ms ease, border-color 160ms ease, background-color 160ms ease;
        }
        .footer-social:hover { color: #fff; border-color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.06); }

        @media (max-width: 900px) {
          .footer-main { grid-template-columns: 1fr; gap: 40px; }
          .footer-grid { grid-template-columns: 1fr 1fr; gap: 28px; }
        }
        @media (max-width: 620px) {
          .footer-cta { grid-template-columns: 1fr; }
          .footer-big-link:first-child { border-right: 0; border-bottom: 1px solid rgba(255,255,255,0.16); padding-right: 0; }
          .footer-big-link:last-child { padding-left: 0; }
        }
        @media (max-width: 520px) {
          .footer-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </footer>
  );
}
