import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página no encontrada — Gastón Bengochea & Cía.",
  description: "La página que buscás no existe o cambió de lugar.",
};

/**
 * 404 global (captura cualquier URL sin ruta). Sobrio y mínimo: número liviano,
 * una línea, y el camino de vuelta. Entrada en CSS puro (estado final visible)
 * para que se lea con JS apagado y con reduced-motion.
 *
 * ⚠️ ESTA PÁGINA NO MONTA EL NAVBAR NI EL PIE DE LA CASA, Y ES A PROPÓSITO.
 *
 * El `not-found` RAÍZ entra en el grafo de cliente de TODAS las rutas de la app
 * —cualquier ruta puede caer acá en runtime—, así que lo que importe se descarga
 * en todas. Con el mega-panel adentro eso eran 47,9 KB de JS (más su copy
 * entero: "Agendá una reunión", "Las personas de la mesa"…) que el sitio del
 * fondo bajaba en cada visita y ejecutaba en un 0,4 %: es el mapa de OTRO sitio,
 * y su propia cáscara (app/(fondo)/layout.tsx) dice que no lo monta.
 * Medido en docs/rendimiento-fondo.md §4.
 *
 * Lo que queda es lo que un 404 necesita: identidad y una salida. La marca
 * linkea a la home y el cuerpo ya ofrece los dos caminos. Un mega-panel de
 * navegación en una página de error es justamente donde menos sirve.
 *
 * Si algún día hace falta un 404 CON la cáscara institucional para los
 * `notFound()` que se lanzan dentro de ese sitio (los de `estaOculta`, por
 * ejemplo), va en `app/(institucional)/not-found.tsx` — ahí sólo lo carga ese
 * subárbol y no vuelve a colarse en el bundle del fondo.
 */
export default function NotFound() {
  return (
    <>
      <main className="site band-navy nf-root">
        {/* ⚠️ LA MARCA VA EN TEXTO, NO EN IMAGEN, Y TAMPOCO ES CASUALIDAD.
            Este subárbol se renderiza en el SERVER y viaja en el payload RSC de
            TODAS las rutas (es el límite de error del segmento raíz). React
            levanta los recursos de lo que renderiza, así que un elemento de
            imagen acá le agrega un `<link rel="preload" as="image">` al head de
            cada página del sitio — verificado: con el logo puesto, la página del
            fondo precargaba y bajaba logo-bengochea-light.svg sin mostrarlo
            nunca. Un 404 no puede cobrarle un asset a las páginas que sí existen. */}
        <Link href="/" className="nf-marca">Gastón Bengochea &amp; Cía.</Link>

        <div className="nf-box">
          <div className="nf-code" aria-hidden>404</div>
          <h1 className="nf-head">No encontramos esta página.</h1>
          <p className="nf-lead">La página que buscás no existe o cambió de lugar.</p>
          <div className="nf-actions">
            <Link href="/" className="ui-btn ui-btn-on-navy">Volver al inicio</Link>
            <Link href="/contacto" className="nf-secondary">Contacto</Link>
          </div>
        </div>
      </main>

      <style>{`
        .nf-root {
          position: relative;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          background: var(--navy);
          padding: calc(var(--nav-h) + clamp(48px, 8vh, 96px)) 24px clamp(64px, 10vh, 112px);
        }
        /* La marca hace de barra: es lo único que queda del navbar y alcanza
           —identifica la casa y es el camino de vuelta—. Absoluta contra el
           propio main, que ya reserva el alto de la barra en su padding. */
        .nf-marca {
          position: absolute;
          top: clamp(20px, 3vh, 34px);
          left: clamp(20px, 4vw, 48px);
          font-family: var(--site-font);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.72);
          transition: color 160ms ease;
        }
        .nf-marca:hover { color: #FFFFFF; }
        .nf-box {
          max-width: 34em;
          animation: nf-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes nf-in {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: none; }
        }

        .nf-code {
          font-family: var(--site-font);
          font-size: clamp(72px, 13vw, 140px);
          font-weight: 400;
          line-height: 1;
          letter-spacing: -0.04em;
          color: #FFFFFF;
          font-variant-numeric: tabular-nums;
        }
        .nf-head {
          margin-top: clamp(18px, 2.4vw, 28px);
          font-size: clamp(23px, 3vw, 33px);
          font-weight: 400;
          line-height: 1.2;
          letter-spacing: -0.02em;
          color: #FFFFFF;
        }
        .nf-lead {
          margin-top: 14px;
          font-size: clamp(16px, 1.5vw, 18px);
          line-height: 1.55;
          color: rgba(255,255,255,0.68);
        }

        .nf-actions {
          margin-top: clamp(28px, 4vw, 40px);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 26px;
          flex-wrap: wrap;
        }
        .nf-secondary {
          font-size: 15px;
          font-weight: 600;
          color: var(--gold-soft);
          text-decoration: none;
          transition: color 160ms ease;
        }
        .nf-secondary:hover { color: #FFFFFF; }

        @media (prefers-reduced-motion: reduce) {
          .nf-box { animation: none; }
        }
      `}</style>
    </>
  );
}
