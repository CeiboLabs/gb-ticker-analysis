import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/institucional/Navbar";
import { FooterInstitucional } from "@/components/institucional/FooterInstitucional";

export const metadata: Metadata = {
  title: "Página no encontrada — Gastón Bengochea & Cía.",
  description: "La página que buscás no existe o cambió de lugar.",
};

/**
 * 404 global (captura cualquier URL sin ruta). Sobrio y mínimo: número liviano,
 * una línea, y el camino de vuelta. Entrada en CSS puro (estado final visible)
 * para que se lea con JS apagado y con reduced-motion.
 */
export default function NotFound() {
  return (
    <>
      <Navbar />

      <main className="site band-navy nf-root">
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

      <FooterInstitucional />

      <style>{`
        .nf-root {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          background: var(--navy);
          padding: calc(var(--nav-h) + clamp(48px, 8vh, 96px)) 24px clamp(64px, 10vh, 112px);
        }
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
