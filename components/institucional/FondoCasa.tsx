import Link from "next/link";
import { ArrowRight } from "@/components/institucional/icons";

// "La casa" — beat de CREDIBILIDAD del fondo. En pre-lanzamiento no hay track
// record propio, así que la prueba no son rendimientos sino la casa que lo
// gestiona: Gastón Bengochea & Cía. Por eso este beat va ANTES de Performance.
// Todas las CIFRAS son verificables y ya se publican en /nosotros (1967, BVM,
// BCU, cuentas segregadas) — no inventar nuevas acá (ver "Claims verificables").
//
// JERARQUÍA: el protagonista es la CASA (las cifras cargan el "lo gestiona
// Bengochea"). El portfolio manager, Adrián Moreira, va en registro DISCRETO:
// una firma al pie (avatar chico + nombre + cargo) que comparte línea con los
// accesos — no un retrato grande ni una tarjeta aparte. Doble rol: en /equipo
// sigue como Trader · Mesa de Operaciones (no se toca); acá es "Portfolio
// Manager". Foto reusada de /equipo (verificable, sin bio inventada).

const CIFRAS: [string, string][] = [
  ["1967", "Miembros de la Bolsa de Valores de Montevideo"],
  ["6 décadas", "Gestionando patrimonios de uruguayos y extranjeros"],
  ["BCU", "Sociedad de bolsa regulada por el Banco Central del Uruguay"],
  ["Segregadas", "Las cuentas están siempre a nombre del cliente"],
];

export function FondoCasa() {
  return (
    <div className="casa-fondo">
      {/* Protagonista: las cifras de la casa */}
      <div className="cifras-row">
        {CIFRAS.map(([num, label]) => (
          <div key={label} className="cifra">
            <span className="cifra-num">{num}</span>
            <span className="cifra-label">{label}</span>
          </div>
        ))}
      </div>

      {/* Pie: firma discreta del gestor (izq) + accesos (der) */}
      <div className="casa-foot">
        <div className="casa-pm">
          <span className="casa-pm-avatar">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/equipo/adrian-moreira.jpg" alt="Adrián Moreira" loading="lazy" />
          </span>
          <span className="casa-pm-text">
            <span className="casa-pm-name">Adrián Moreira, CFA</span>
            <span className="casa-pm-role">Portfolio Manager</span>
          </span>
        </div>

        <div className="casa-cta-row">
          <Link href="/nosotros" className="link-arrow">Conocenos <ArrowRight /></Link>
          <Link href="/equipo" className="link-arrow">Conocé al equipo <ArrowRight /></Link>
        </div>
      </div>

      <style>{`
        /* Pie de la casa: firma del gestor a la izquierda, accesos a la derecha */
        .casa-foot {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 22px 40px;
          margin-top: 36px;
        }

        /* ── Firma discreta del gestor ── */
        .casa-pm { display: flex; align-items: center; gap: 14px; }
        .casa-pm-avatar {
          flex: none;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          overflow: hidden;
          border: 1px solid var(--site-border);
          background: var(--surface-muted);
        }
        .casa-pm-avatar img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 20%;
          filter: grayscale(1);
          transition: filter 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .casa-pm:hover .casa-pm-avatar img { filter: grayscale(0); }
        .casa-pm-text { display: flex; flex-direction: column; line-height: 1.25; }
        .casa-pm-name { font-size: 15px; font-weight: 600; color: var(--navy); }
        .casa-pm-role { margin-top: 2px; font-size: 13px; color: var(--site-ink-3); }

        .casa-cta-row { display: flex; flex-wrap: wrap; gap: 28px; }

        @media (prefers-reduced-motion: reduce) {
          .casa-pm-avatar img { transition: none; }
        }
        @media (max-width: 560px) {
          .casa-foot { gap: 20px; }
        }
      `}</style>
    </div>
  );
}
