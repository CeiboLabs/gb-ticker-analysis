import Link from "next/link";
import { HAY_PRENSA } from "@/lib/prensa";
import { RUTA_FONDO } from "@/lib/sitios";
// Las cuentas de la casa: mismas cinco en los dos sitios (ver redes.tsx).
import { REDES } from "@/components/institucional/redes";

type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
  /**
   * El otro sitio de la casa (el del fondo, ver lib/sitios.ts): <a> en la misma
   * pestaña, href relativo. En producción el 307 de next.config.ts lo lleva al
   * dominio del fondo; donde los dos sitios comparten hostname (dev, home
   * server) entra derecho por el path. No es `external` — eso abre pestaña.
   */
  otroSitio?: boolean;
};

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
      { label: "BNG Selección Global", href: RUTA_FONDO, otroSitio: true },
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
      // Pegado a Consultanet a propósito: todo cliente de la casa pasa por acá
      // cuando va a ver su cartera, y la herramienta de análisis está a un clic
      // sin que nadie se lo diga. Es el canal de distribución más grande que
      // tiene, ya existe y es gratis.
      { label: "Analizar una acción", href: "/analisis" },
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
                      ) : l.otroSitio ? (
                        <a href={l.href} className="footer-link">{l.label}</a>
                      ) : (
                        // Sin prefetch, por lo mismo que el navbar: el footer
                        // está en todas las páginas y al entrar en viewport
                        // prefetcheaba cada sección — y con las rutas estáticas
                        // eso arrastra el preload de sus heroes. Ver la nota de
                        // SIN_PREFETCH en Navbar.tsx.
                        <Link href={l.href} className="footer-link" prefetch={false}>{l.label}</Link>
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
          <Link href="/contacto" className="footer-big-link" prefetch={false}>
            <span>Agendá una reunión</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
          <Link href="/analisis" className="footer-big-link" prefetch={false}>
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
              {REDES.map((s) => (
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
            <a href="https://www.linkedin.com/in/emiliano-rodriguez-uy/" target="_blank" rel="noopener noreferrer" className="footer-link" style={{ textDecoration: "underline" }}>Emiliano Rodríguez</a>.
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
