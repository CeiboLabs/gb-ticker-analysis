import { css } from "@/lib/css";
/**
 * Barra de marca del SITIO DEL FONDO (ver `lib/sitios.ts`).
 *
 * Es la fila de arriba de la cáscara del fondo, y su único trabajo es institucional:
 * decir de quién es este fondo y dar la vuelta al sitio de la casa. La navegación
 * de la página —las secciones y el CTA— es la barra sticky de abajo (`FondoNav`),
 * que sí acompaña el scroll. Es el reparto de las fichas de producto de la banca
 * (Vontobel, SSGA, Schroders): fila corporativa arriba, sub-nav del producto pegada.
 *
 * No repite el nombre del fondo: eso ya lo dice el wordmark del hero ("BNG ·
 * SELECCIÓN GLOBAL", atravesado por el horizonte dorado) y, cuando el hero se va,
 * lo toma la barra sticky. Acá abajo tampoco hay CTA: el de la sticky está a un
 * scroll de distancia y duplicarlo sólo restaría peso al otro.
 *
 * ⚠️ POSICIÓN: `absolute` SIN ancestro posicionado, o sea contra el bloque
 * contenedor inicial. Eso la deja arriba del documento, encima del hero navy
 * (que es lo que pide un hero a sangre: la barra flota sobre la imagen) y
 * scrolleando con la página en vez de quedarse fija. No es `fixed` a propósito —
 * al irse el hero, la que queda arriba es la sticky de secciones.
 */
export function NavbarFondo({ casa }: { casa: string }) {
  return (
    <header className="site fbrand">
      <div className="site-wrap fbrand-row">
        {/* El logo ES el camino de vuelta al sitio institucional (convención de
            microsite de producto). `casa` viene vacío cuando los dos sitios
            comparten hostname —dev y home server—, y ahí `/` es la home de la
            casa igual. */}
        <a href={`${casa}/`} className="fbrand-logo" aria-label="Gastón Bengochea &amp; Cía. — ir al sitio institucional">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-bengochea.svg?v=2" alt="Gastón Bengochea &amp; Cía." />
        </a>

        {/* Un solo acceso, y es la vuelta a la casa. Consultanet salió de acá por
            pedido (30-jul-2026): es el home banking del cliente YA cliente, y en
            la barra de un microsite de producto —donde el visitante todavía está
            decidiendo si invierte— competía con el único CTA de la página. Desde
            el 2-ago-2026 tampoco está en el pie (se fue la columna "La casa"): el
            portal NO se ofrece en el sitio del fondo, se entra por el de la casa. */}
        <nav className="fbrand-links" aria-label="Sitio institucional">
          <a href={`${casa}/`} className="fbrand-link">
            Sitio institucional
            <Externo />
          </a>
        </nav>
      </div>

      <style>{css`
        .fbrand {
          position: absolute; top: 0; left: 0; right: 0; z-index: 55;
          height: var(--nav-h);
          display: flex; align-items: center;
          color: #fff;
        }
        .fbrand-row { display: flex; align-items: center; justify-content: space-between; gap: 24px; width: 100%; }
        .fbrand-logo { display: block; flex: none; }
        .fbrand-logo img { height: 26px; width: auto; display: block; }
        .fbrand-links { display: flex; align-items: center; gap: 26px; }
        .fbrand-link {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 500; letter-spacing: 0.01em;
          color: rgba(255,255,255,0.72); text-decoration: none;
          transition: color 160ms ease;
        }
        .fbrand-link:hover { color: #fff; }
        /* En el teléfono queda sólo el logo: el hero necesita el aire, y la
           vuelta a la casa sigue estando en el logo y en el pie. */
        @media (max-width: 640px) {
          .fbrand-links { display: none; }
          .fbrand-logo img { height: 22px; }
        }
      `}</style>
    </header>
  );
}

/** Cuña de "esto sale de este sitio" — el mismo gesto que usa el navbar de la casa. */
function Externo() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
      <path d="M3 9L9 3M9 3H4M9 3V8" />
    </svg>
  );
}
