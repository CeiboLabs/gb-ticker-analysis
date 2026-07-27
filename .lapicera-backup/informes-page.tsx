import Link from "next/link";
import type { Metadata } from "next";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ArrowRight, Calendar, Clock } from "@/components/institucional/icons";
import { CarpetaInformes } from "@/components/institucional/CarpetaInformes";
import { INFORMES, AUTORES } from "@/lib/informes";
import { tieneArticulo } from "@/lib/informeContenido";

export const metadata: Metadata = {
  title: "Informes · Bengochea & Cía.",
  description:
    "Informes mensuales y semanales de mercado de Gastón Bengochea CB. Recomendaciones, lectura macro y oportunidades de inversión.",
};

export default function InformesPage() {
  const destacado = INFORMES[0];
  const destacadoTieneArticulo = tieneArticulo(destacado.slug);

  return (
    <main className="site">
      {/* Hero split — contenido + imagen */}
      <div className="hero-split">
        {/* Lapicera de marca entrando desde el borde izquierdo: media lapicera
            a la vista, la otra media sale de cuadro. Sobre blanco contrasta
            sola; sombra de contacto para asentarla. Se oculta en mobile (el
            copy pasa a ocupar todo el ancho). */}
        <div aria-hidden className="hero-pen">
          <div className="hero-pen-rot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/lapicera-bengochea.png"
              alt=""
              width={1600}
              height={166}
              decoding="async"
              draggable={false}
            />
          </div>
        </div>
        <Reveal as="div" className="hero-copy">
          <div className="hero-copy-inner">
            <div className="kicker" style={{ color: "var(--gold-deep)" }}>
              Recomendaciones · Informes
            </div>
            <h1 className="t-display" style={{ marginTop: 20, color: "var(--site-ink)" }}>
              Lectura semanal y mensual del mercado.
            </h1>
            <p className="t-lead" style={{ marginTop: 24, color: "var(--site-ink-2)" }}>
              Nuestros informes recogen la lectura de la mesa: macro internacional, renta fija uruguaya,
              equity global y las oportunidades de cada cierre de mercado.
            </p>
            <div className="hero-cta-wrap" style={{ marginTop: 32 }}>
              {destacadoTieneArticulo ? (
                <Link href={`/informes/${destacado.slug}`} className="ui-btn ui-btn-primary">
                  Leer último informe
                </Link>
              ) : (
                <a
                  href={`/informes/${destacado.slug}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ui-btn ui-btn-primary"
                >
                  Ver último informe
                </a>
              )}
            </div>
          </div>
        </Reveal>
        <div className="hero-figure hero-figure--carpeta">
          <CarpetaInformes />
        </div>
      </div>

      {/* Cifras — cobertura editorial */}
      <section className="band-muted site-section-sm">
        <div className="site-wrap">
          <div className="cifras-row">
            <div className="cifra">
              <span className="cifra-num">Semanal</span>
              <span className="cifra-label">Lectura del cierre de cada semana</span>
            </div>
            <div className="cifra">
              <span className="cifra-num">Mensual</span>
              <span className="cifra-label">Visión macro y de cartera</span>
            </div>
            <div className="cifra">
              <span className="cifra-num">2</span>
              <span className="cifra-label">Autores que firman las ediciones</span>
            </div>
            <div className="cifra">
              <span className="cifra-num">PDF</span>
              <span className="cifra-label">Cada informe, libre para descarga</span>
            </div>
          </div>
        </div>
      </section>

      {/* Archivo — lista de filas con hairlines */}
      <section className="band site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Archivo</div>
            <div>
              <h2 className="t-h2">Ediciones recientes.</h2>
              <p className="t-lead" style={{ marginTop: 16, maxWidth: "36em" }}>
                Lectura de cada cierre, con comentarios sobre los movimientos relevantes de la semana
                y del mes. Disponibles para descarga en PDF.
              </p>
            </div>
          </Reveal>

          <Stagger as="div" className="ui-list" style={{ marginTop: 56 }}>
            {INFORMES.map((it) => {
              const conArticulo = tieneArticulo(it.slug);
              // Fila: el contenido es idéntico; sólo cambia el envoltorio. Con
              // artículo → navegación interna a /informes/[slug]. Sin él (aún) →
              // el PDF en el visor nativo, servido desde nuestro dominio vía el
              // proxy (no salta a gbengochea).
              const inner = (
                <>
                  <span style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <span className="list-icon" aria-hidden>
                      {it.categoria === "Mensual" ? <Calendar /> : <Clock />}
                    </span>
                    <span className="informe-main">
                      <span className="informe-meta">
                        <span className="t-small informe-fecha">{it.fechaTexto.split(",")[0]}</span>
                        <span className="ui-tag">{it.categoria}</span>
                      </span>
                      <span className="row-title" style={{ display: "block", marginTop: 8 }}>{it.titulo}</span>
                    </span>
                  </span>
                  <span className="link-arrow informe-cta">
                    {conArticulo ? "Leer informe" : "Ver PDF"} <ArrowRight />
                  </span>
                </>
              );
              return (
                <StaggerItem as="div" key={it.slug}>
                  {conArticulo ? (
                    <Link href={`/informes/${it.slug}`} className="ui-list-row informe-row">
                      {inner}
                    </Link>
                  ) : (
                    <a
                      href={`/informes/${it.slug}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ui-list-row informe-row"
                    >
                      {inner}
                    </a>
                  )}
                </StaggerItem>
              );
            })}
          </Stagger>
        </div>
      </section>

      {/* Autores — quién firma cada informe */}
      <section className="band-muted site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Autores</div>
            <div>
              <h2 className="t-h2">Quién firma cada informe.</h2>
              <p className="t-lead" style={{ marginTop: 16, maxWidth: "38em" }}>
                Dos lecturas, dos plumas de la casa. El mensual ordena la visión macro y de cartera;
                el semanal sigue cada cierre de mercado.
              </p>
            </div>
          </Reveal>

          <Stagger as="div" className="autor-grid">
            {AUTORES.map((a) => (
              <StaggerItem as="div" key={a.nombre} className="autor">
                <div className={a.foto ? "autor-photo" : "autor-photo autor-photo--placeholder"}>
                  {a.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.foto} alt={a.nombre} loading="lazy" />
                  ) : (
                    <span className="autor-photo-fallback">{a.nombre}</span>
                  )}
                </div>
                <span className="autor-cadencia">{a.cadencia}</span>
                <h3 className="t-h3" style={{ marginTop: 12 }}>{a.nombre}</h3>
                <p className="t-body" style={{ marginTop: 18, marginBottom: 0, maxWidth: "34em" }}>{a.bio}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* CTA — banda navy */}
      <section className="band-navy site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Asesoramiento</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "16em" }}>
                Las recomendaciones a medida no caben en un PDF.
              </h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "38em" }}>
                Los informes son una lectura general. Para tu cartera, hace falta una conversación.
                Agendá una reunión con un asesor de la casa.
              </p>
              <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
                <Link href="/contacto" className="ui-btn ui-btn-on-navy">
                  Agendá una reunión
                </Link>
                <Link href="/servicios" className="ui-btn ui-btn-on-navy-ghost">
                  Ver el ecosistema
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <style>{`
        /* Hero de /informes: TODO blanco (como GRAFIJA). El panel izquierdo
           (copy) y el derecho (figure) del mismo blanco que el fondo de la
           foto del libro → header uniforme, libro integrado sin costura. */
        .hero-split { background: #ffffff; position: relative; overflow: hidden; }
        /* Lapicera: entra desde el borde inferior-izquierdo, ~mitad visible.
           Abajo a la izquierda es el único hueco libre de copy; balancea el
           libro (arriba-derecha). */
        .hero-pen {
          position: absolute;
          z-index: 2;
          bottom: 8%;
          left: 0;
          width: min(460px, 34vw);
          pointer-events: none;
          transform: translateX(-48%);
          /* Sombra realista: el drop-shadow lee el alfa del PNG, así sigue la
             silueta exacta de la lapicera. Va acá (contenedor externo, sin
             rotar) y no en la imagen, para que se proyecte en una dirección
             de luz FIJA (arriba-izquierda → abajo-derecha), independiente del
             rotate. Tres capas — contacto, media y ambiente — para un
             desvanecido natural en vez de un blur plano. */
          filter:
            drop-shadow(1px 2px 3px rgba(15, 34, 73, 0.62))
            drop-shadow(6px 11px 12px rgba(15, 34, 73, 0.36))
            drop-shadow(17px 32px 40px rgba(15, 34, 73, 0.20));
        }
        .hero-pen-rot {
          transform: rotate(-55deg);
        }
        .hero-pen img {
          display: block;
          width: 100%;
          height: auto;
        }
        @media (max-width: 860px) {
          .hero-pen { display: none; }
        }
        .hero-split .hero-copy { background: #ffffff; color: var(--site-ink); }
        /* El copy se agrupa en una caja que se encoge al ancho del texto
           (fit-content) y se ancla al borde derecho de su columna → cerca del
           libro. Adentro, todo (kicker, título, lead y botón) queda alineado a
           la izquierda de esa caja, así el botón comparte el borde del texto. */
        @media (min-width: 861px) {
          .hero-split .hero-copy { padding-right: clamp(76px, 8vw, 128px); }
          .hero-split .hero-copy-inner {
            width: fit-content;
            max-width: 36rem;
            align-self: flex-end;
          }
        }
        .hero-split .hero-figure.hero-figure--carpeta { background: #ffffff; }
        @media (max-width: 860px) {
          .hero-split .hero-figure.hero-figure--carpeta { min-height: 320px; }
        }
        .autor-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: clamp(48px, 8vw, 120px);
          margin-top: clamp(56px, 7vw, 88px);
        }
        .autor { max-width: 38em; }
        .autor-photo {
          position: relative;
          width: 100%;
          max-width: 280px;
          aspect-ratio: 4 / 5;
          border-radius: 8px;
          overflow: hidden;
          background: var(--surface-muted);
          margin-bottom: clamp(24px, 2.6vw, 32px);
        }
        .autor-photo img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center top;
          filter: grayscale(1);
          transition: filter 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .autor:hover .autor-photo img { filter: grayscale(0); }
        .autor-photo--placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: #fff;
          border: 1px solid var(--site-border, rgba(15,34,73,0.12));
        }
        .autor-photo-fallback {
          font-size: clamp(15px, 1.5vw, 18px);
          font-weight: 600;
          letter-spacing: 0.01em;
          color: var(--ink-soft, rgba(15,34,73,0.55));
          text-align: center;
        }
        .autor-cadencia {
          display: block;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--gold-deep);
        }
        @media (prefers-reduced-motion: reduce) {
          .autor-photo img { transition: none; }
        }
        @media (max-width: 860px) {
          .autor-grid { grid-template-columns: 1fr; gap: clamp(48px, 12vw, 72px); }
        }
        .informe-meta { display: inline-flex; align-items: center; gap: 14px; }
        .informe-fecha { font-weight: 600; color: var(--gold-deep); letter-spacing: 0.02em; }
        .informe-cta { pointer-events: none; flex: none; }
        @media (max-width: 640px) {
          .informe-row { flex-direction: column; align-items: flex-start; gap: 14px; }
        }
      `}</style>
    </main>
  );
}
