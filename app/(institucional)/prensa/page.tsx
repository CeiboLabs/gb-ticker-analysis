import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import {
  PRENSA,
  HAY_PRENSA,
  PRENSA_TIPO_LABEL,
  prensaPorAnio,
  type PrensaItem,
} from "@/lib/prensa";
import { pageMetadata } from "@/lib/seo";
import { estaOculta } from "@/lib/paginasOcultas";

// noindex: la sección está vacía / "próximamente" y no está en el nav. Quitar el
// noindex al poblarla (y sumarla al sitemap). Ver docs/SEO-plan.md.
export const metadata: Metadata = pageMetadata({
  title: "Prensa",
  description:
    "Nosotros en los medios: apariciones, columnas y entrevistas de la mesa de Gastón Bengochea en la prensa uruguaya e internacional.",
  path: "/prensa",
  noindex: true,
});

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

/** "2026-03-12" → "12 mar 2026" · "2026-03" → "mar 2026" · "2026" → "2026". */
function formatearFecha(fecha: string): string {
  const [y, m, d] = fecha.split("-");
  if (!m) return y;
  const mes = MESES[parseInt(m, 10) - 1] ?? "";
  if (!d) return `${mes} ${y}`;
  return `${parseInt(d, 10)} ${mes} ${y}`;
}

// Flecha diagonal para las apariciones con enlace externo.
function FlechaExterna() {
  return (
    <svg className="prensa-arrow" width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <path d="M3 9L9 3M9 3H4M9 3V8" />
    </svg>
  );
}

// Una aparición. Con enlace es un <a> externo (con hover + flecha); sin enlace,
// un <div> quieto — se lista con el mismo cuidado, sólo que no navega a ningún lado.
function FilaPrensa({ item }: { item: PrensaItem }) {
  const tipo = PRENSA_TIPO_LABEL[item.tipo ?? "mencion"];
  const cuerpo = (
    <>
      <div className="prensa-meta">
        <span className="prensa-medio">{item.medio}</span>
        <span className="prensa-fecha">{formatearFecha(item.fecha)}</span>
      </div>
      <div className="prensa-main">
        <span className="prensa-titulo">{item.titulo}</span>
        {item.quien && <span className="prensa-quien">{item.quien}</span>}
        {item.nota && <span className="prensa-nota">{item.nota}</span>}
      </div>
      <div className="prensa-tail">
        <span className="prensa-tipo">{tipo}</span>
        {item.url ? <FlechaExterna /> : null}
      </div>
    </>
  );

  return item.url ? (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="prensa-row" data-link="1">
      {cuerpo}
    </a>
  ) : (
    <div className="prensa-row">{cuerpo}</div>
  );
}

export default function PrensaPage() {
  // 404 con el not-found de la casa mientras la sección siga listada en
  // lib/paginasOcultas.ts. Publicada = la guarda queda inerte.
  if (estaOculta("/prensa")) notFound();

  const grupos = prensaPorAnio(PRENSA);

  return (
    <main className="site">
      {/* Masthead editorial blanco — el navbar arranca claro sobre él (ver Navbar). */}
      <section className="band prensa-hero">
        <div className="site-wrap">
          <Reveal as="div" className="prensa-masthead">
            <div className="kicker" style={{ color: "var(--gold-deep)" }}>Prensa</div>
            <h1 className="t-display" style={{ marginTop: 20, color: "var(--site-ink)" }}>
              Nosotros, en los medios.
            </h1>
            <p className="t-lead" style={{ marginTop: 24, color: "var(--site-ink-2)", maxWidth: "34em" }}>
              Un registro de las apariciones de la mesa en la prensa: menciones en medios,
              columnas propias y entrevistas. Lo que decimos sobre el mercado, y dónde.
            </p>
          </Reveal>
        </div>
      </section>

      {HAY_PRENSA ? (
        // ── Archivo poblado: una fila-espina por año (número a la izquierda,
        //    apariciones sobre hairlines a la derecha). ──
        <section className="band-muted site-section">
          <div className="site-wrap">
            <Reveal as="div" className="split-label">
              <div className="eyebrow-sm">Archivo</div>
              <div>
                <h2 className="t-h2">Apariciones recientes.</h2>
                <p className="t-lead" style={{ marginTop: 16, maxWidth: "36em" }}>
                  Ordenadas de lo más reciente a lo más antiguo. Las que están online abren la
                  nota original; las de papel se listan igual, como registro.
                </p>
              </div>
            </Reveal>

            <div className="prensa-archivo">
              {grupos.map((g) => (
                <div key={g.anio} className="prensa-anio">
                  <div className="prensa-anio-num">{g.anio}</div>
                  <Stagger as="div" className="prensa-lista">
                    {g.items.map((item, i) => (
                      <StaggerItem as="div" key={`${item.medio}-${item.fecha}-${i}`}>
                        <FilaPrensa item={item} />
                      </StaggerItem>
                    ))}
                  </Stagger>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        // ── Estado vacío honesto (estado diseñado, no un error): la sección
        //    existe y está lista; simplemente todavía no hay material cargado. ──
        <section className="band-muted site-section">
          <div className="site-wrap">
            <Reveal as="div" className="prensa-proximamente">
              <div className="eyebrow-sm" style={{ color: "var(--gold-deep)" }}>Próximamente</div>
              <p className="prensa-prox-lead">
                Estamos reuniendo nuestro archivo de prensa. Muy pronto vas a
                encontrar acá nuestras apariciones en medios, columnas y entrevistas.
              </p>
              <p className="prensa-prox-sub">
                Mientras tanto, la lectura de la mesa vive en{" "}
                <Link href="/informes" className="prensa-inline-link">los informes</Link>.
              </p>
            </Reveal>
          </div>
        </section>
      )}

      {/* CTA de cierre — banda navy (único momento oscuro de la página).
          Orientado a prensa: invita a periodistas y medios a contactar la mesa. */}
      <section className="band-navy site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Consultas de prensa</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "15em" }}>
                Para periodistas y medios, la mesa está disponible.
              </h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "38em" }}>
                Comentarios de mercado, entrevistas y columnas sobre renta fija uruguaya,
                macro y equity global. Escribinos y coordinamos.
              </p>
              <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
                <Link href="/contacto" className="ui-btn ui-btn-on-navy">Escribinos</Link>
                <Link href="/informes" className="ui-btn ui-btn-on-navy-ghost">Ver los informes</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <style>{`
        /* Masthead: despeja el navbar fijo (72px) y respira. */
        .prensa-hero {
          padding-top: calc(var(--nav-h) + clamp(44px, 7vw, 92px));
          padding-bottom: clamp(40px, 5vw, 68px);
        }

        /* Estado vacío honesto — grande, sereno, con una regla fuerte arriba
           (masthead editorial). Nunca finge contenido. */
        .prensa-proximamente {
          border-top: 1px solid var(--ink);
          padding-top: clamp(28px, 3.5vw, 44px);
          max-width: 30em;
        }
        .prensa-prox-lead {
          margin-top: 18px;
          font-size: clamp(20px, 2.4vw, 28px);
          font-weight: 400;
          line-height: 1.32;
          letter-spacing: -0.015em;
          color: var(--site-ink);
        }
        .prensa-prox-sub {
          margin-top: 20px;
          font-size: 16px;
          line-height: 1.55;
          color: var(--site-ink-3);
        }
        .prensa-inline-link {
          color: var(--gold-deep);
          text-decoration: none;
          border-bottom: 1px solid color-mix(in srgb, var(--gold-deep) 40%, transparent);
          transition: border-color 160ms ease;
        }
        .prensa-inline-link:hover { border-bottom-color: var(--gold-deep); }

        /* Archivo: espina por año (número callado a la izquierda, filas a la derecha),
           misma columna-firma que el resto del sitio. */
        .prensa-archivo { margin-top: clamp(48px, 6vw, 80px); }
        .prensa-anio {
          display: grid;
          grid-template-columns: 96px minmax(0, 1fr);
          gap: clamp(20px, 4vw, 64px);
        }
        .prensa-anio + .prensa-anio {
          margin-top: clamp(32px, 4vw, 52px);
          padding-top: clamp(32px, 4vw, 52px);
          border-top: 1px solid var(--site-border);
        }
        .prensa-anio-num {
          font-size: 22px;
          font-weight: 400;
          letter-spacing: -0.01em;
          color: var(--site-ink-4);
          font-variant-numeric: tabular-nums;
          position: sticky;
          top: calc(var(--nav-h) + 20px);
          align-self: start;
        }

        /* Fila de aparición: meta (medio + fecha) · título · etiqueta+flecha,
           sobre hairlines (nunca tarjetas). */
        .prensa-row {
          display: grid;
          grid-template-columns: minmax(150px, 210px) minmax(0, 1fr) auto;
          gap: clamp(16px, 2.5vw, 40px);
          align-items: baseline;
          padding: 22px 0;
          text-decoration: none;
          border-left: 2px solid transparent;
          padding-left: 0;
          transition: padding-left 180ms ease, border-color 160ms ease;
        }
        /* Hairline entre filas: sobre el wrapper de cada StaggerItem (full-width,
           no se corre con el hover del .prensa-row interno). */
        .prensa-lista > div + div { border-top: 1px solid var(--site-border); }
        .prensa-medio {
          display: block;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.005em;
          color: var(--site-ink);
        }
        .prensa-fecha {
          display: block;
          margin-top: 5px;
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: 12.5px;
          letter-spacing: 0.02em;
          color: var(--site-ink-3);
          font-variant-numeric: tabular-nums;
        }
        .prensa-titulo {
          display: block;
          font-size: 17px;
          line-height: 1.4;
          color: var(--site-ink);
        }
        .prensa-quien {
          display: block;
          margin-top: 6px;
          font-size: 13px;
          color: var(--site-ink-3);
        }
        .prensa-nota {
          display: block;
          margin-top: 6px;
          font-size: 12.5px;
          font-style: italic;
          color: var(--site-ink-4);
        }
        .prensa-tail {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          justify-content: flex-end;
          white-space: nowrap;
        }
        .prensa-tipo {
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          color: var(--site-ink-3);
        }
        .prensa-arrow { color: var(--gold-deep); flex: none; transition: transform 200ms ease; }

        /* Hover SOLO en filas con enlace: desliza, acento dorado, título a navy. */
        .prensa-row[data-link="1"]:hover,
        .prensa-row[data-link="1"]:focus-visible {
          padding-left: 16px;
          border-left-color: var(--gold-deep);
          outline: none;
        }
        .prensa-row[data-link="1"]:hover .prensa-titulo,
        .prensa-row[data-link="1"]:focus-visible .prensa-titulo { color: var(--navy); }
        .prensa-row[data-link="1"]:hover .prensa-arrow,
        .prensa-row[data-link="1"]:focus-visible .prensa-arrow { transform: translate(2px, -2px); }

        @media (prefers-reduced-motion: reduce) {
          .prensa-row, .prensa-arrow, .prensa-inline-link { transition: none; }
        }

        @media (max-width: 720px) {
          .prensa-anio {
            grid-template-columns: 1fr;
            gap: 4px;
          }
          .prensa-anio-num { position: static; }
          .prensa-row {
            grid-template-columns: 1fr;
            gap: 6px;
            align-items: start;
          }
          .prensa-tail { justify-content: flex-start; margin-top: 4px; }
        }
      `}</style>
    </main>
  );
}
