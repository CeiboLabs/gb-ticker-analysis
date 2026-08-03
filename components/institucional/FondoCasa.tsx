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

// ⚠️ LA TERCERA CIFRA ES "SEGREGADAS" Y SE QUEDA ASÍ. Van tres intentos de
// cambiarla y tres reversiones del usuario (27-jul, 3-ago mañana, 3-ago tarde):
// antes de tocarla otra vez, leé por qué el argumento legal NO gana acá.
//
// El argumento legal, que es correcto pero incompleto: "Cuentas siempre a nombre
// del cliente" describe a LA CASA, y del FONDO sería falso — el cuotapartista no
// tiene una cuenta a su nombre, es copropietario indiviso de un patrimonio de
// afectación con cuotapartes escriturales en el registro que lleva la Sociedad
// Administradora (Reglamento 2.2, 2.3 y literal (f)), y la custodia la contrata
// la Administradora en instituciones que incluyen a la propia Bengochea (4.1).
//
// Lo que le falta a ese argumento —y es el motivo de la última reversión, con
// palabras del usuario— es que ESTA SECCIÓN NO HABLA DEL FONDO. Se llama "La
// Institución", su titular es "Detrás de la estrategia, seis décadas de
// historia", su bajada presenta a Bengochea Inversiones, y las otras TRES cifras
// (1967 · BCU · Criterio) son todas de la casa. En ese contexto la cifra no se
// lee como una propiedad del vehículo: se lee como lo que es, una prueba de la
// casa que lo gestiona. Meter ahí "El patrimonio del Fondo es independiente…"
// —que fue el reemplazo del 3-ago— rompía el registro: tres pruebas de la casa
// y una del producto, en la misma tira de cuatro.
//
// Y el hecho legal no se pierde: el patrimonio de afectación está dicho donde
// corresponde, en «Información legal» al pie ("El Fondo no está garantizado ni
// constituye un depósito u otra obligación de la Sociedad Administradora, del
// Gestor del Fondo…"), que es el bloque que sí habla del vehículo.
//
// Si algún día hay que endurecerla sin romper el registro, la salida es anclarla
// a la casa en primera persona —"Las cuentas de nuestros clientes están siempre
// a su nombre", que además rima con la cuarta cifra— y NO mudarla al Fondo. Pero
// desincroniza el texto de /nosotros, de donde sale tal cual: ofrecido al
// usuario el 3-ago-2026, sin respuesta. No lo apliques por tu cuenta.
const CIFRAS: [string, string][] = [
  ["1967", "Miembros de la Bolsa de Valores de Montevideo"],
  ["BCU", "Sociedad de bolsa regulada por el Banco Central del Uruguay"],
  ["Segregadas", "Cuentas siempre a nombre del cliente"],
  ["Criterio", "Elegimos fondos mutuos para las carteras de nuestros clientes desde los años 80"],
];

/** `casa`: ver lib/sitios.ts — /equipo vive en el sitio institucional. */
export function FondoCasa({ casa }: { casa: string }) {
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
            {/* Avatares propios 1x/2x/3x: el retrato de /equipo es 1000×1250 /
                164 KB y acá entra a 46 px — ~130× los bytes necesarios, y el
                navegador igual decodifica el JPEG entero (~5 MB de bitmap).

                Los tamaños son 46/92/138 y no 48/96/144 porque la caja mide 48
                px con box-sizing: border-box y el borde de 1px le come 2: el
                contenido son 46 px. Clavarlos ahí los deja 1:1 en cada densidad
                y le saca al navegador el reescalado intermedio (con 144 en una
                caja de 138 la foto caía al 57% de nitidez).

                El recorte cuadrado (cover + center 20%) viene horneado, así que
                el object-position de abajo queda en no-op. Regenerar con:
                sharp("public/equipo/adrian-moreira.jpg")
                  .extract({ left: 0, top: 50, width: 1000, height: 1000 })
                  .resize(px, px).sharpen({ sigma })      // 46:0.9  92:0.9  138:0.7
                  .jpeg({ quality: 90, mozjpeg: true })
                El sharpen no es cosmético: sin él el downscale de ~10× deja la
                foto en un tercio de la nitidez que rendereaba el original; con
                él queda en 91/95/104% según densidad. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/equipo/adrian-moreira-avatar-92.jpg"
              srcSet="/equipo/adrian-moreira-avatar-46.jpg 1x, /equipo/adrian-moreira-avatar-92.jpg 2x, /equipo/adrian-moreira-avatar-138.jpg 3x"
              alt="Adrián Moreira"
              width={46}
              height={46}
              loading="lazy"
            />
          </span>
          <span className="casa-pm-text">
            <span className="casa-pm-name">Adrián Moreira, CFA</span>
            <span className="casa-pm-role">Portfolio Manager</span>
          </span>
        </div>

        {/* "Conocenos" apuntaba a /nosotros, que está en lib/paginasOcultas.ts
            y devuelve 404: se saca hasta que esa sección se publique. */}
        <div className="casa-cta-row">
          <a href={`${casa}/equipo`} className="link-arrow">Conocé al equipo <ArrowRight /></a>
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
