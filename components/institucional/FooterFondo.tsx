import { REDES } from "@/components/institucional/redes";

/**
 * Pie del SITIO DEL FONDO (ver `lib/sitios.ts`) — "la placa de cierre".
 *
 * ── QUÉ TRABAJO HACE ──────────────────────────────────────────────────────
 * NO es un segundo CTA. Dos bandas más arriba la página ya pregunta "¿Te
 * interesa BNG Selección Global?" con sus dos botones, y entre medio va el
 * bloque de Información legal: un tercer pedido acá, a menos de dos pantallas
 * del anterior, sólo le sacaría fuerza. Por eso este pie no copia los CTAs
 * gigantes estilo Marex del pie de la casa (`FooterInstitucional`) aunque sean
 * el patrón firma de la marca: ahí cierran un SITIO de muchas páginas, acá
 * cerrarían una página que ya cerró.
 *
 * Lo que hace es lo que hace el colofón de un prospecto impreso: identificar al
 * gestor, dejar a mano las anclas de la página, y abrir los canales por los que
 * se llega a una persona —teléfono, correo, oficina y las redes de la casa—.
 *
 * ── DE DÓNDE SALE LA FORMA ────────────────────────────────────────────────
 * Del propio lenguaje de esta página, no del pie institucional:
 *   · una REGLA FUERTE abre la placa y las divisiones internas son hairlines
 *     suaves — la "regla de dos pesos" de `docs/lenguaje-visual.md`;
 *   · esa regla fuerte es de ORO y se apaga hacia la derecha: el horizonte
 *     dorado que cruza el wordmark del hero vuelve, en fino, a cerrar la
 *     página. Es el único color del pie (el oro es acento, jamás superficie);
 *   · las tres columnas viven en una GRILLA REGLADA cuyas verticales sangran
 *     al borde del contenedor —el mismo idioma que la grilla de Estrategia,
 *     los tres verbos del Perfil y la ficha de Performance—, en vez de las
 *     columnas sueltas del pie de la casa. El sitio del fondo habla en
 *     hairlines de punta a punta; el pie era lo único que no.
 *
 * ── LO QUE NO LLEVA, Y POR QUÉ ────────────────────────────────────────────
 * · NO repite el aviso legal. El bloque largo —autorización del BCU, partes,
 *   riesgos, adhesión al Reglamento— vive al pie de la PÁGINA, titulado y con
 *   ancla (#legal), que es la convención medida en la industria (ver
 *   `reference_avisos_legales_dos_niveles`): una nota corta pegada a cada dato
 *   y UN solo bloque largo al final. Bajarlo también acá lo diluiría. Este pie
 *   sólo identifica al gestor en una línea y apunta al bloque.
 * · NO repite las partes intervinientes: eso es la sección `FondoPartes`.
 * · NO lleva columna "La casa" — salió por pedido (2-ago-2026), y con ella el
 *   último acceso a Consultanet que quedaba en este sitio. Es deliberado: el
 *   visitante de un microsite de producto todavía está decidiendo si invierte,
 *   y el home banking del cliente YA cliente no le habla. La vuelta al sitio
 *   institucional sigue estando en la barra de arriba (`NavbarFondo`): el logo
 *   y su link. Por eso este componente ya no recibe el origen de la casa y el
 *   subárbol del fondo se puede prerenderizar sin mirar el request.
 *
 * ⚠️ Teléfono y correo están escritos acá y también en `FooterInstitucional` y
 * en `/contacto` (que además es la fuente de la dirección). Si algún día cambia
 * un dato de contacto de la casa hay que tocar los tres.
 */

const SECCIONES = [
  { label: "Estrategia", href: "#estrategia" },
  { label: "Cartera", href: "#cartera" },
  { label: "Performance", href: "#performance" },
  { label: "Documentos", href: "#documentos" },
  { label: "Preguntas frecuentes", href: "#faq" },
  { label: "Información legal", href: "#legal" },
];

const MAPS_URL =
  "https://www.google.com/maps/place/Gast%C3%B3n+Bengochea+CB/@-34.9043598,-56.1360758,1434m/data=!3m2!1e3!4b1!4m6!3m5!1s0x959f811e524a3fe9:0x397e7b1dcf825247!8m2!3d-34.9043598!4d-56.1360758!16s%2Fg%2F11smqv30hx";

export function FooterFondo() {
  return (
    <footer className="site band-navy ffoot mt-auto">
      {/* El horizonte: va a SANGRE, en el borde mismo donde la banda blanca de
          Información legal se vuelve navy. Dentro del wrap flotaba a media
          altura y se leía como un adorno; acá es la costura de la página. */}
      <div className="ffoot-horizonte" aria-hidden="true" />

      <div className="site-wrap ffoot-in">
        <div className="ffoot-plate">
          {/* ── Identidad ── */}
          <div className="ffoot-cell">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-bengochea.svg?v=2" alt="Gastón Bengochea &amp; Cía." className="ffoot-logo" />
            {/* Nombre LEGAL, no el comercial: acá se identifica a la parte, no se
                escribe prosa editorial. La Sociedad Administradora y el resto de
                las partes se identifican completas en #legal y en la sección
                Partes intervinientes. */}
            <p className="t-small ffoot-nota">
              «Fondo BNG Selección Global, Fondo de Inversión» es gestionado por Gastón Bengochea y
              Compañía Corredor de Bolsa S.A., sociedad de bolsa regulada y supervisada por el Banco
              Central del Uruguay. Autorizado por el BCU e inscripto en el Registro del Mercado de
              Valores — <a href="#legal" className="ffoot-link ffoot-link-u">información legal completa</a>.
            </p>
          </div>

          {/* ── Anclas de la página ── */}
          <div className="ffoot-cell">
            <div className="ffoot-col-t">El fondo</div>
            <ul className="ffoot-list">
              {SECCIONES.map((s) => (
                <li key={s.href}><a href={s.href} className="ffoot-link">{s.label}</a></li>
              ))}
            </ul>
          </div>

          {/* ── Canales: los tres directos y, debajo, las redes de la casa ── */}
          <div className="ffoot-cell">
            <div className="ffoot-col-t">Contacto</div>
            <ul className="ffoot-list">
              <li><a href="tel:+59826286447" className="ffoot-link">+598 2628 6447</a></li>
              <li><a href="mailto:info@gbengochea.com.uy" className="ffoot-link">info@gbengochea.com.uy</a></li>
              <li>
                <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" className="ffoot-link ffoot-dir">
                  Luis A. de Herrera 1248<br />WTC Torre I, Of. 707 · Montevideo
                </a>
              </li>
            </ul>
            {/* Sin rótulo propio: un segundo título dorado en la misma celda
                pelearía con "Contacto", y las marcas ya se leen solas. Van acá
                —y no en el colofón, como en el pie de la casa— porque son otra
                forma de llegar a la misma gente, y porque emparejan el alto de
                esta columna con las seis anclas de la de al lado. */}
            <div className="ffoot-redes">
              {REDES.map((r) => (
                <a
                  key={r.label}
                  href={r.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={r.label}
                  className="ffoot-red"
                >
                  {r.icon}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="ffoot-bottom">
          <span className="t-small">© {new Date().getFullYear()} Gastón Bengochea &amp; Cía.</span>
          <p className="t-small ffoot-credito">
            Desarrollado por{" "}
            <a href="https://www.linkedin.com/in/emiliano-rodriguez-uy/" target="_blank" rel="noopener noreferrer" className="ffoot-link ffoot-link-u">Emiliano Rodríguez</a>.
          </p>
        </div>
      </div>

      <style>{`
        .ffoot-in { padding-bottom: 36px; }

        /* La línea fuerte del pie —"regla de dos pesos": ésta manda, las
           divisiones internas son hairlines blancas al 16%. Es de ORO y va a
           sangre: el horizonte dorado que cruza el wordmark del hero vuelve en
           1px a cerrar la página. Único color del pie. */
        .ffoot-horizonte { height: 1px; background: var(--gold); }

        /* Placa reglada. Dos cosas la hacen leer como tabla y no como columnas
           sueltas (que es lo que hace el pie de la casa):
             · las verticales corren SIN CORTES del horizonte dorado a la regla
               del colofón — por eso el aire de arriba y de abajo es padding de
               las CELDAS y no del contenedor: así el borde las acompaña y las
               líneas empalman con las horizontales en vez de quedar colgando;
             · SANGRAN al borde del wrap — la primera celda no tiene padding
               izquierdo y la última no tiene derecho, así el texto se alinea
               con el resto de la página.
           Mismo gesto que .estrategia-grid y .perfil-verbos. */
        .ffoot-plate {
          display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr);
        }
        .ffoot-cell { padding: 60px 44px 44px 0; }
        .ffoot-cell + .ffoot-cell {
          border-left: 1px solid rgba(255,255,255,0.16); padding-left: 44px;
        }
        .ffoot-cell:last-child { padding-right: 0; }

        .ffoot-logo { height: 32px; width: auto; display: block; }
        /* A tres columnas la celda ya la angosta, pero abajo de 1000px esta
           nota se lleva el ancho entero del wrap: sin tope corría a ~110
           caracteres por renglón. El tope va acá y no en la celda porque ch se
           resuelve contra el font-size del propio elemento (14px de .t-small). */
        .ffoot-nota { margin: 22px 0 0; max-width: var(--medida-legal); }

        .ffoot-col-t {
          font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--gold-soft); margin-bottom: 18px;
        }
        .ffoot-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
        .ffoot-link {
          color: rgba(255,255,255,0.72); font-size: 15px; text-decoration: none;
          transition: color 160ms ease;
        }
        .ffoot-link:hover { color: var(--gold-soft); }
        .ffoot-link-u { text-decoration: underline; font-size: inherit; }
        .ffoot-dir { display: inline-block; line-height: 1.5; }

        .ffoot-redes { display: flex; gap: 8px; margin-top: 26px; }
        .ffoot-red {
          width: 34px; height: 34px; border-radius: var(--r-btn);
          display: inline-flex; align-items: center; justify-content: center;
          border: 1px solid rgba(255,255,255,0.18);
          color: rgba(255,255,255,0.65);
          transition: color 160ms ease, border-color 160ms ease, background-color 160ms ease;
        }
        .ffoot-red:hover { color: #fff; border-color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.06); }

        .ffoot-bottom {
          padding-top: 26px; border-top: 1px solid rgba(255,255,255,0.16);
          display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap;
        }
        .ffoot-credito { margin: 0; opacity: 0.7; }

        /* La identidad se lleva su propia fila y las dos columnas de links se
           reparten la de abajo: a tres columnas, la nota del gestor entra en
           renglones de cuatro palabras. La regla que las separa es la misma
           hairline, ahora horizontal. */
        @media (max-width: 1000px) {
          .ffoot-plate { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
          .ffoot-cell:first-child {
            grid-column: 1 / -1; padding: 56px 0 34px;
            border-bottom: 1px solid rgba(255,255,255,0.16);
          }
          .ffoot-cell:nth-child(n + 2) { padding-top: 34px; }
          .ffoot-cell:nth-child(2) { border-left: 0; padding-left: 0; }
        }
        /* Apiladas: todas las verticales se vuelven horizontales. */
        @media (max-width: 620px) {
          .ffoot-plate { grid-template-columns: 1fr; }
          .ffoot-cell:first-child { padding: 52px 0 30px; border-bottom: 0; }
          .ffoot-cell + .ffoot-cell {
            border-left: 0; padding: 30px 0;
            border-top: 1px solid rgba(255,255,255,0.16);
          }
          .ffoot-cell:last-child { padding-bottom: 40px; }
        }
      `}</style>
    </footer>
  );
}
