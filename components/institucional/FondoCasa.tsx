import Link from "next/link";
import { ArrowRight } from "@/components/institucional/icons";

// "La casa" — beat de CREDIBILIDAD del fondo. En pre-lanzamiento no hay track
// record propio, así que la prueba no son rendimientos sino la casa que lo
// gestiona: Gastón Bengochea & Cía. Por eso este beat va ANTES de Performance.
// Todas las CIFRAS son verificables: 1967/BVM, BCU y las cuentas segregadas ya
// se publican en /nosotros y en la home; los fondos mutuos con Fidelity, en
// /historia (años 80) — no inventar nuevas acá (ver "Claims verificables").
//
// Las tres primeras prueban LEGITIMIDAD (la casa existe, está regulada, los
// activos del cliente no se mezclan con los suyos). La cuarta es la única que
// prueba COMPETENCIA en la disciplina de este producto: el Fondo invierte
// predominantemente en ETFs y fondos mutuos (lib/fondo.ts, Reglamento 3.3.1) y
// la casa selecciona fondos mutuos de terceros desde los 80.
// Sin ella, las cuatro dicen lo mismo — que fue el problema del par
// 1967 + "6 décadas" que había acá (el h2 ya dice "seis décadas").
//
// NO poner acá el nombre de un custodio/socio de la casa (BNY, Clearstream,
// Fidelity) en el slot grande: en la página de un fondo se lee como si ese
// tercero respaldara ESTE vehículo, y esos acuerdos son de la casa.
//
// El token dice "Criterio" y no "Selección" por dos razones: "Selección" rima
// de forma con "Segregadas" en la misma fila, y repetía el nombre del producto
// dentro de su propia prueba.
//
// JERARQUÍA: el protagonista es la CASA (las cifras cargan el "lo gestiona
// Bengochea"). El portfolio manager, Adrián Moreira, va en registro DISCRETO:
// una firma al pie (avatar chico + nombre + cargo) que comparte línea con los
// accesos — no un retrato grande ni una tarjeta aparte. Doble rol: en /equipo
// sigue como Trader · Mesa de Operaciones (no se toca); acá es "Portfolio
// Manager". Foto reusada de /equipo (verificable, sin bio inventada).

// ⚠️ "Segregadas — Cuentas siempre a nombre del cliente" es la cifra tal cual
// vive en /nosotros: es una prueba de LA CASA (esta sección se llama "La
// Institución", igual que 1967 / BCU / Criterio), no del vehículo. Pedido
// expreso del usuario (2026-07-28), que revierte la baja del 2026-07-27.
// El matiz que motivó aquella baja sigue en pie y hay que tenerlo a mano si
// vuelve el tema: el cuotapartista NO tiene una cuenta a su nombre —es
// copropietario de un patrimonio de afectación, con cuotapartes escriturales
// en el registro que lleva la Sociedad Administradora (Reglamento 2.2, 2.3 y
// literal (f))—, así que esta cifra no debe leerse como si describiera al
// Fondo. Si alguna vez hay que reformularla sin perder el hecho, el sustituto
// correcto es "El patrimonio del Fondo está separado del de la Administradora
// y del Gestor". No cambiarla por iniciativa propia: es decisión del usuario.
const CIFRAS: [string, string][] = [
  ["1967", "Miembros de la Bolsa de Valores de Montevideo"],
  ["BCU", "Sociedad de bolsa regulada por el Banco Central del Uruguay"],
  ["Segregadas", "Cuentas siempre a nombre del cliente"],
  ["Criterio", "Elegimos fondos mutuos para las carteras de nuestros clientes desde los años 80"],
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
            <span className="casa-pm-name">Adrián Moreira</span>
            <span className="casa-pm-role">Portfolio Manager</span>
          </span>
        </div>

        {/* "Conocenos" apuntaba a /nosotros, que está en lib/paginasOcultas.ts
            y devuelve 404: se saca hasta que esa sección se publique. */}
        <div className="casa-cta-row">
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
