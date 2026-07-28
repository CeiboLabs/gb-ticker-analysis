import { Reveal } from "@/components/motion";
import { ArrowRight } from "@/components/institucional/icons";

// Partes intervinientes del Fondo — la ficha de contrapartes que en la plaza
// uruguaya acompaña a la documentación. Va al pie de Documentos, que es donde
// ya vive el aparato legal: separa quién administra, quién gestiona, quién
// custodia y quién controla.
//
// Formato TIRA DE LOGOS por pedido del cliente (2026-07-27), siguiendo el
// único comparable local que publica esto en la web (Fondos Centenario:
// logo + rol + nombre, con el gestor incluido en la fila). El rol va SIEMPRE
// debajo del logo: "VALO" o "EY" solos no dicen qué hacen.
//
// Tres de las cuatro filas salen de documentos que la página ya publica para
// descarga — el Reglamento aprobado por el BCU (literales (a), (l) y (m) del
// "Resumen de las características del Fondo") y la Resolución RR-SSF-2026-434
// del 7-jul-2026, que autoriza la contratación del auditor. La cuarta (asesor
// legal) es un dato que aportó el cliente; ver la nota en su fila.
//
// NO INVENTAR una parte: si no está en los documentos ni la confirmó el cliente,
// no entra. Eso NO es lo mismo que exigir que cada rol figure en el Reglamento
// —el Reglamento sólo designa a quienes asumen obligaciones frente al Fondo—,
// distinción que costó una fila borrada de más.
//
// ⚠️ NO poner el logo del BCU: el logo del regulador en una tira se lee como
// aval del producto. La autorización se cuenta en texto, con su leyenda de
// alcance, y eso vive UNA sola vez: en «Información legal», al pie de la página.
//
// ⚠️ Los logos de terceros necesitan OK ESCRITO de cada firma antes de
// publicar. EY además exige que su logo vaya sin alterar (Off Black + beam
// EY Yellow): no pasarlos a gris ni teñirlos con la paleta del sitio.
//
// El auditor se publica como DATO DE FICHA, no como sello de confianza: nunca
// "auditado por EY" en tono de respaldo — EY audita los estados contables, no
// avala el vehículo ni su desempeño.

type Parte = {
  rol: string;
  nombre: string;
  /** Sin logo todavía: la celda cae al nombre en tipografía del sitio. Es un
   *  hueco visible a propósito — así se nota qué archivo falta pedir. */
  logo?: string;
  corto?: string;
  /** Altura del logo en px: se normaliza a OJO, no por caja — cada marca
   *  tiene su propia proporción y peso de trazo. */
  alto?: number;
  href?: string;
};

const PARTES: Parte[] = [
  {
    rol: "Sociedad administradora",
    nombre: "Valores Administradora de Fondos de Inversión y Fideicomisos S.A.",
    logo: "/logos/valores-afisa.svg",
    alto: 30,
    href: "https://valo.uy/",
  },
  {
    rol: "Gestor del Portafolio",
    nombre: "Gastón Bengochea y Compañía Corredor de Bolsa S.A.",
    // Pedido: el logo de logo-bengochea.svg (el del acento dorado en
    // "INVERSIONES"). Ese archivo es la versión para fondo OSCURO —el texto es
    // blanco y sobre la tira desaparecería—, así que acá va la misma pieza con
    // el texto en navy y el oro intacto.
    logo: "/logos/bengochea-tira.svg",
    alto: 24,
  },
  {
    rol: "Auditor externo",
    nombre: "Ernst & Young Uy S.A.S.",
    logo: "/logos/ey.svg",
    alto: 42,
    href: "https://www.ey.com/es_uy",
  },
  {
    // ⚠️ NO SACAR ESTA FILA por no encontrarla en el Reglamento. Se sacó una vez
    // (auditoría legal del 27-jul-2026) aplicando la regla de arriba, y fue un
    // error: (1) es un DATO DEL CLIENTE, no una parte inventada —la regla existe
    // para frenar invenciones—; (2) un asesor legal casi nunca figura en un
    // reglamento de gestión, que designa a quienes asumen obligaciones frente al
    // Fondo (administradora, gestor, auditor, custodios): el estudio que
    // estructura el vehículo se revela en material de oferta, así que su
    // ausencia ahí es lo normal y no una señal de alarma; (3) el comparable local
    // que fundó este formato lo lista — Fondos Centenario muestra Gletir, Valo,
    // Fitch, Deloitte y GUYER (el estudio jurídico), y encima sin rotular los
    // roles, cosa que esta tira sí hace.
    //
    // PENDIENTE de confirmar con el cliente: si Rocca es asesor legal PERMANENTE
    // del Fondo o asesoró su ESTRUCTURACIÓN. Son compromisos distintos y el rol
    // debería decir cuál.
    rol: "Asesor legal",
    nombre: "Estudio Rocca",
    // Derivado del logo que publica el estudio (sólo tienen versión blanca,
    // para fondo oscuro): se pasó la letra a tinta y el escudo dorado quedó
    // como está. Reemplazar por su positivo oficial cuando lo manden.
    logo: "/logos/estudio-rocca.png",
    // 44 y no 34: el escudo sobresale por arriba de la caja, así que la
    // palabra queda más chica que en los otros tres a igual altura de imagen.
    alto: 44,
    href: "https://estudiorocca.com.uy/",
  },
];

// La CUSTODIA no tiene fila propia: el Reglamento habilita un conjunto de
// instituciones sin designar una, y decir "las previstas en el Reglamento" no
// le informa nada a nadie. Cuando se confirme el custodio efectivo, entra como
// una casilla más de la tira — no como línea de pie.
//
// La CALIFICACIÓN sí se dice, pero en «Información legal» al pie: es la única
// línea que habla de algo que el Fondo no tiene, y con label propio le competía
// a los logos. Callarla no es opción — el comparable local abre su tira con la
// calificadora, y el lector que compara nota el hueco.

export function FondoPartes() {
  return (
    <Reveal as="div" className="partes">
      <div className="eyebrow-sm partes-title">Partes intervinientes</div>

      <div className="partes-tira">
        {PARTES.map((p) => {
          const cuerpo = (
            <>
              <span className="partes-logo">
                {p.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.logo} alt={p.nombre} style={{ height: p.alto }} loading="lazy" />
                ) : (
                  <span className="partes-logo-txt">{p.corto ?? p.nombre}</span>
                )}
              </span>
              <span className="partes-rol">{p.rol}</span>
              <span className="partes-nombre">{p.nombre}</span>
            </>
          );
          return p.href ? (
            <a key={p.rol} className="partes-celda" href={p.href} target="_blank" rel="noopener noreferrer">
              {cuerpo}
            </a>
          ) : (
            <div key={p.rol} className="partes-celda">{cuerpo}</div>
          );
        })}
      </div>

      {/* La leyenda de autorización del BCU vivía acá Y otra vez, palabra por
          palabra, al pie: dos bloques de legal largo en la misma página. Ahora
          va una sola vez, en «Información legal» (#legal), que es donde la
          industria pone el bloque largo —Itaú UY lo titula "Condiciones
          generales para la contratación de Fondos de inversión"; SPDR, Vanguard
          y Schroders cierran igual—, y desde acá se llega con este enlace.
          La tira de logos se queda: no es un aviso legal, es información de
          quién es quién, y Documentos es donde el lector la busca. */}
      <a className="link-arrow partes-legal" href="#legal">
        Autorización del Banco Central e información legal <ArrowRight />
      </a>

      <style>{`
        .partes { margin-top: 72px; }
        .partes-title { margin-bottom: 24px; }

        /* Retícula de la tira: mismo idioma que .cifras-row (hairlines que
           encierran cada celda), para que no lea como banner de sponsors. */
        .partes-tira {
          display: grid;
          /* auto-fit para que la fila se acomode sola cuando entren el
             custodio y las que falten (3 → 4 → 5 casillas). */
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          border-top: 1px solid var(--site-border);
          border-left: 1px solid var(--site-border);
        }
        .partes-celda {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 32px 28px 28px 24px;
          border-right: 1px solid var(--site-border);
          border-bottom: 1px solid var(--site-border);
          text-decoration: none;
          color: inherit;
          transition: background-color 200ms ease;
        }
        a.partes-celda:hover { background: var(--surface-muted); }

        /* Alto fijo para todos los slots: los logos se alinean por su base
           óptica aunque cada uno tenga su propia proporción. */
        .partes-logo {
          display: flex;
          align-items: flex-end;
          min-height: 46px;
          margin-bottom: 22px;
        }
        .partes-logo img { display: block; width: auto; max-width: 100%; }
        .partes-logo-txt {
          font-size: 20px;
          letter-spacing: -0.01em;
          color: var(--navy);
        }

        .partes-rol {
          font-size: 12.5px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--site-ink-3);
        }
        .partes-nombre {
          margin-top: 8px;
          font-size: 14px;
          line-height: 1.45;
          color: var(--site-ink);
        }


        /* El enlace al bloque legal del pie: mismo peso que el resto de los
           link-arrow de la página, un poco más chico porque cierra una ficha. */
        .partes-legal { margin: 24px 0 0 4px; font-size: 14px; }

        @media (max-width: 880px) {
          .partes-tira { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 620px) {
          .partes { margin-top: 56px; }
          .partes-tira { grid-template-columns: 1fr; }
          .partes-celda { padding: 24px 20px 22px; }
          .partes-logo { min-height: 0; margin-bottom: 18px; }
        }
      `}</style>
    </Reveal>
  );
}
