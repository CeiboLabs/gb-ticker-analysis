import Link from "next/link";

type FooterLink = { label: string; href: string; external?: boolean };

const NAV_GROUPS: { title: string; links: FooterLink[] }[] = [
  {
    title: "La casa",
    links: [
      { label: "Nosotros", href: "/nosotros" },
      { label: "Historia", href: "/historia" },
      { label: "Equipo", href: "/equipo" },
      { label: "Contacto", href: "/contacto" },
    ],
  },
  {
    title: "Ecosistema",
    links: [
      { label: "Mercado local", href: "/servicios#local" },
      { label: "Mercado internacional", href: "/servicios#internacional" },
      { label: "Proceso de inversión", href: "/servicios#proceso" },
      { label: "Calculadora", href: "/calculadora" },
      { label: "Análisis de acciones", href: "/analisis" },
    ],
  },
  {
    title: "Accesos",
    links: [
      { label: "Cuenta Activa", href: "https://cuentaactiva.gbengochea.com.uy/", external: true },
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
];

export function FooterInstitucional() {
  return (
    <footer className="section-navy mt-auto">
      <div className="wrap" style={{ paddingTop: "var(--space-7)", paddingBottom: "var(--space-5)" }}>
        {/* Manifesto editorial */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "var(--space-6)",
            paddingBottom: "var(--space-7)",
            borderBottom: "1px solid rgba(255,255,255,0.18)",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)", gap: "var(--space-6)" }} className="footer-manifesto">
            <div>
              <div className="cap-gold-on-navy cap">Casa de bolsa · Montevideo · 1967</div>
              <h2
                className="serif"
                style={{
                  fontStyle: "italic",
                  fontWeight: 300,
                  fontSize: "clamp(28px, 4vw, 44px)",
                  lineHeight: 1.1,
                  margin: "var(--space-3) 0 0",
                  maxWidth: "16em",
                  color: "var(--gold-soft)",
                  letterSpacing: "-0.01em",
                }}
              >
                Cincuenta y siete años invirtiendo con criterio uruguayo en los mercados del mundo.
              </h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: "var(--space-3)" }}>
              <p className="lede" style={{ color: "rgba(255,255,255,0.78)", maxWidth: "32em", margin: 0 }}>
                Sociedad de bolsa regulada por el Banco Central del Uruguay, con cuentas segregadas a nombre del cliente y asesoramiento de la casa.
              </p>
              <div style={{ display: "flex", gap: 12, marginTop: "var(--space-3)" }}>
                <Link href="/contacto" className="btn btn-on-navy-primary">
                  Agendá una reunión <span className="arrow" />
                </Link>
                <Link href="/analisis" className="btn btn-on-navy-secondary">
                  Analizar una acción
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Marca + contacto */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: "var(--space-6)",
            paddingTop: "var(--space-6)",
            paddingBottom: "var(--space-6)",
            borderBottom: "1px solid rgba(255,255,255,0.18)",
          }}
          className="footer-brand-row"
        >
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-bengochea.svg?v=2"
              alt="Gastón Bengochea"
              style={{ height: 32, width: "auto", display: "block" }}
            />

            <div
              className="mono"
              style={{
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.55)",
                marginTop: 6,
              }}
            >
              Sociedad de Bolsa · Miembro BVM desde 1967
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }} className="footer-contact">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="cap-on-navy cap">Contacto</span>
              <a href="tel:+59826286447" className="body-small footer-link" style={{ color: "rgba(255,255,255,0.85)" }}>
                +598 2628 6447
              </a>
              <a href="mailto:info@gbengochea.com.uy" className="body-small footer-link" style={{ color: "rgba(255,255,255,0.85)" }}>
                info@gbengochea.com.uy
              </a>
              <a href="mailto:reclamos@gbengochea.com.uy" className="body-small footer-link" style={{ color: "rgba(255,255,255,0.85)" }}>
                reclamos@gbengochea.com.uy
              </a>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="cap-on-navy cap">Oficina</span>
              <p className="body-small" style={{ color: "rgba(255,255,255,0.72)", margin: 0, lineHeight: 1.55 }}>
                Luis A. de Herrera 1248<br />
                World Trade Center<br />
                Torre I · Oficina 707<br />
                Montevideo, Uruguay
              </p>
            </div>
          </div>
        </div>

        {/* Cuatro columnas de navegación */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "var(--space-6)",
            paddingTop: "var(--space-6)",
          }}
          className="footer-grid"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="cap-on-navy cap" style={{ marginBottom: "var(--space-3)" }}>
                {group.title}
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {group.links.map((l) => (
                  <li key={l.href}>
                    {l.external ? (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="footer-link body-base"
                        style={{ fontSize: 13.5, display: "inline-flex", alignItems: "center", gap: 6 }}
                      >
                        {l.label}
                        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.5 }}>
                          <path d="M3 9L9 3M9 3H4M9 3V8" />
                        </svg>
                      </a>
                    ) : (
                      <Link
                        href={l.href}
                        className="footer-link body-base"
                        style={{ fontSize: 13.5 }}
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Social + colofón */}
        <div
          style={{
            marginTop: "var(--space-7)",
            paddingTop: "var(--space-4)",
            borderTop: "1px solid rgba(255,255,255,0.18)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div className="mono" style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: "0.04em" }}>
              © {new Date().getFullYear()} Gastón Bengochea &amp; Cía. · Sociedad de Bolsa
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              {SOCIAL.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="footer-social"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          <p className="mono" style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: 0, maxWidth: "44em", lineHeight: 1.6 }}>
            Regulado por el Banco Central del Uruguay. La información publicada en este sitio tiene fines informativos y no constituye asesoramiento personalizado de inversión. Las decisiones de inversión son responsabilidad del cliente.
          </p>

          <div className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>
            Desarrollado por{" "}
            <a href="https://ceibolabs.dev" target="_blank" rel="noopener noreferrer" style={{ borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
              ceibolabs
            </a>
          </div>
        </div>
      </div>

      <style>{`
        .footer-link {
          color: rgba(255,255,255,0.75);
          transition: color 160ms ease;
        }
        .footer-link:hover { color: var(--gold-soft); }

        .footer-social {
          width: 32px;
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,255,255,0.18);
          color: rgba(255,255,255,0.6);
          transition: color 160ms ease, border-color 160ms ease;
        }
        .footer-social:hover {
          color: var(--gold-soft);
          border-color: var(--gold-soft);
        }

        @media (max-width: 900px) {
          .footer-manifesto { grid-template-columns: 1fr !important; }
          .footer-brand-row { grid-template-columns: 1fr !important; gap: var(--space-5) !important; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; gap: var(--space-5) !important; }
        }
        @media (max-width: 600px) {
          .footer-contact { grid-template-columns: 1fr !important; }
          .footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </footer>
  );
}
