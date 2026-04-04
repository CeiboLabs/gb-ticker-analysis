import Link from "next/link";

export function FooterInstitucional() {
  return (
    <footer className="bg-[#020440] py-14 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Company */}
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-bengochea.svg"
              alt="Gastón Bengochea"
              className="h-7 w-auto mb-4"
              style={{ filter: "brightness(0) invert(1)", opacity: 0.6 }}
            />
            <p className="text-xs text-white/30 leading-relaxed">
              Corredor de Bolsa. Miembro de la Bolsa de Valores de Montevideo
              desde 1967.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-4">
              Navegación
            </h4>
            <div className="flex flex-col gap-2">
              <Link href="/" className="text-xs text-white/30 hover:text-white/60 transition-colors">Inicio</Link>
              <Link href="/servicios" className="text-xs text-white/30 hover:text-white/60 transition-colors">Servicios</Link>
              <Link href="/nosotros" className="text-xs text-white/30 hover:text-white/60 transition-colors">Nosotros</Link>
              <Link href="/equipo" className="text-xs text-white/30 hover:text-white/60 transition-colors">Equipo</Link>
              <Link href="/calculadora" className="text-xs text-white/30 hover:text-white/60 transition-colors">Calculadora</Link>
              <Link href="/analisis" className="text-xs text-white/30 hover:text-white/60 transition-colors">Análisis de Acciones</Link>
              <Link href="/contacto" className="text-xs text-white/30 hover:text-white/60 transition-colors">Contacto</Link>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-4">
              Contacto
            </h4>
            <div className="flex flex-col gap-2">
              <a href="tel:+59826286447" className="text-xs text-white/30 hover:text-white/60 transition-colors">
                +598 2628 6447
              </a>
              <a href="mailto:info@gbengochea.com.uy" className="text-xs text-white/30 hover:text-white/60 transition-colors">
                info@gbengochea.com.uy
              </a>
              <p className="text-xs text-white/30">
                Luis A. de Herrera 1248
                <br />
                WTC Torre I, Of. 707
                <br />
                Montevideo, Uruguay
              </p>
            </div>
          </div>

          {/* Social */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-4">
              Redes Sociales
            </h4>
            <div className="flex gap-3">
              <a
                href="https://www.linkedin.com/company/gaston-bengochea-cia-corredor-de-bolsa-s-a/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/10 transition-all"
                aria-label="LinkedIn"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              <a
                href="https://www.instagram.com/bengochea_inversiones/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/10 transition-all"
                aria-label="Instagram"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                </svg>
              </a>
              <a
                href="https://www.facebook.com/p/Gaston-Bengochea-100068421873890/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/10 transition-all"
                aria-label="Facebook"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <a
                href="https://x.com/BENGOCHEA_SB"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/10 transition-all"
                aria-label="X"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 pt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-white/20">
              © {new Date().getFullYear()} Gastón Bengochea — Corredor de
              Bolsa. Todos los derechos reservados.
            </p>
            <p className="text-xs text-white/20">
              Regulado por el Banco Central del Uruguay
            </p>
          </div>
          <p className="text-xs text-white/15 mt-4 text-center max-w-2xl mx-auto">
            La información proporcionada no constituye asesoramiento
            financiero. Consultá a tu asesor antes de tomar decisiones de
            inversión.
          </p>
          <p className="text-[10px] text-white/10 mt-6 text-center">
            Desarrollado por{" "}
            <a
              href="https://ceibolabs.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white/25 transition-colors"
            >
              ceibolabs
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
