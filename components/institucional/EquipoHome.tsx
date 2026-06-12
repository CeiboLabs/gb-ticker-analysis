import Link from "next/link";
import { Reveal } from "@/components/motion";
import { Glass } from "@/components/institucional/LiquidGlass";

/* ⚠️ TODO(cliente): /hero/equipo.jpg es STOCK — sirve de placeholder de
   layout, pero NO puede salir a producción acá: esta sección presenta la
   foto como "la casa" y las caras deben ser las reales (ver
   feedback_claims_verificables). Brief de la foto definitiva:
   - El equipo real alrededor de la mesa de operaciones en el WTC, en
     conversación de trabajo (no posando en fila mirando a cámara).
   - Horizontal, ancha (mín. ~2400px), aire alrededor de la escena: el
     recorte es panorámico (~16:7) y el texto va centrado encima.
   - Luz natural de la oficina; el tratamiento duotono navy lo aplica el
     CSS, no hace falta editar la foto. */

/**
 * S7 — La casa. El momento humano del home: UNA foto coral del equipo en
 * la mesa, tratada en duotono navy, con la declaración real de /equipo
 * encima. Rima visual con TrayectoriaScene (panel letterboxed + serif
 * blanca + CTA glass): aquella abre con la promesa abstracta, esta la
 * resuelve con las personas concretas.
 */
export function EquipoHome() {
  return (
    <section className="band-muted site-section">
      <Reveal as="div" className="casa-panel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="casa-photo"
          src="/hero/equipo.jpg"
          alt="El equipo de la casa en una reunión de trabajo"
          loading="lazy"
        />
        <div className="casa-tint" aria-hidden />
        <div className="casa-scrim" aria-hidden />

        <div className="casa-copy">
          <div className="eyebrow-sm casa-eyebrow">La casa</div>
          <p className="casa-lede">
            Cada portafolio se discute <em>entre todos</em>.
          </p>
          <p className="casa-sub">
            Directorio, asesores, mesa y compliance — y un asesor principal
            que conoce tus objetivos por nombre.
          </p>
          <Glass interactive>
            <Link href="/equipo" className="lqg-btn">
              Conocé al equipo <span aria-hidden>→</span>
            </Link>
          </Glass>
        </div>

        <div className="casa-caption" aria-hidden>WTC · Montevideo</div>
      </Reveal>

      <style>{`
        .casa-panel {
          position: relative;
          width: min(96vw, 1480px);
          margin: 0 auto;
          min-height: min(80dvh, 720px);
          display: grid;
          place-items: center;
          overflow: hidden;
          background: var(--navy);
        }
        .casa-photo {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: grayscale(1) contrast(1.05);
        }
        /* Duotono: navy multiplicado sobre la foto en gris + acento dorado */
        .casa-tint {
          position: absolute;
          inset: 0;
          background: linear-gradient(118deg, #16294f 0%, #2C3194 100%);
          mix-blend-mode: multiply;
          opacity: 0.85;
        }
        .casa-scrim {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(120% 100% at 78% 10%, rgba(201,168,76,0.12), transparent 55%),
            radial-gradient(90% 80% at 50% 62%, rgba(2,4,40,0.42), transparent 100%);
        }
        .casa-copy {
          position: relative;
          z-index: 1;
          max-width: 44em;
          padding: clamp(48px, 8vh, 96px) 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
        }
        .casa-eyebrow { color: var(--gold-soft); }
        .casa-lede {
          margin: 22px 0 0;
          font-family: var(--font-serif), "Newsreader", Georgia, serif;
          font-weight: 300;
          font-size: clamp(30px, 4vw, 54px);
          line-height: 1.2;
          letter-spacing: -0.01em;
          color: #fff;
        }
        /* Énfasis moderno: dorado sin itálica (pedido del cliente — nada
           de cursivas decorativas) */
        .casa-lede em {
          font-style: normal;
          font-weight: 400;
          color: var(--gold-soft);
        }
        .casa-sub {
          margin: 18px 0 34px;
          max-width: 36em;
          font-size: clamp(15px, 1.3vw, 18px);
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.78);
        }
        .casa-caption {
          position: absolute;
          left: clamp(20px, 3vw, 40px);
          bottom: clamp(16px, 2.6vw, 32px);
          z-index: 1;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.55);
        }
        @media (max-width: 760px) {
          .casa-panel { min-height: 70dvh; }
        }
      `}</style>
    </section>
  );
}
