import Link from "next/link";
import type { Metadata } from "next";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ArrowRight, Calendar, Clock } from "@/components/institucional/icons";
import { CarpetaInformes } from "@/components/institucional/CarpetaInformes";
import { VideoEmbed } from "@/components/institucional/VideoEmbed";
import { NewsletterSignup } from "@/components/institucional/NewsletterSignup";
import { VideosDeLaCasa } from "@/components/institucional/VideosDeLaCasa";
import { INFORMES, AUTORES } from "@/lib/informes";
import { tieneArticulo } from "@/lib/informeContenido";
import { getMetricsDb } from "@/lib/metrics";
import { readInformesLive } from "@/lib/informesStore";

export const metadata: Metadata = {
  title: "Informes · Bengochea & Cía.",
  description:
    "Informes mensuales y semanales de mercado de Gastón Bengochea CB. Recomendaciones, lectura macro y oportunidades de inversión.",
};

// La lista vive en la base (la administra el panel de empleados): la página se
// renderiza por request en el server — publicar u ocultar un informe pega acá
// sin redeploy. Sin binding cae al seed hardcodeado de lib/informes.
export const dynamic = "force-dynamic";

export default async function InformesPage() {
  const db = getMetricsDb();
  const informes = db ? await readInformesLive(db) : INFORMES;
  const destacado = informes[0] ?? null;
  const destacadoTieneArticulo = destacado ? tieneArticulo(destacado.slug) : false;

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
            {destacado && (
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
            )}
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
            {informes.map((it) => {
              const conArticulo = tieneArticulo(it.slug);

              // Mensual con su video de presentación → fila enriquecida con el
              // video embebido (SOLO mensuales; los semanales no llevan video).
              // El video es ese mismo informe, presentado en el canal de la casa:
              // cuerpo (meta + título + acceso al documento) a la izquierda,
              // video 16:9 a la derecha.
              if (it.categoria === "Mensual" && it.videoId) {
                return (
                  <StaggerItem as="div" key={it.slug}>
                    <div className="ui-list-row informe-row--video">
                      <div className="ivid-body">
                        <span className="informe-meta">
                          <span className="t-small informe-fecha">{it.fechaTexto.split(",")[0]}</span>
                          <span className="ui-tag">{it.categoria}</span>
                        </span>
                        <span className="row-title" style={{ display: "block", marginTop: 8 }}>{it.titulo}</span>
                        {conArticulo ? (
                          <Link href={`/informes/${it.slug}`} className="link-arrow" style={{ marginTop: 18 }}>
                            Leer el informe <ArrowRight />
                          </Link>
                        ) : (
                          <a
                            href={`/informes/${it.slug}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link-arrow"
                            style={{ marginTop: 18 }}
                          >
                            Ver el informe en PDF <ArrowRight />
                          </a>
                        )}
                      </div>
                      <div className="ivid-media">
                        <VideoEmbed videoId={it.videoId} title={`Presentación · ${it.titulo}`} />
                      </div>
                    </div>
                  </StaggerItem>
                );
              }

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

      {/* Newsletter — callout card navy (patrón "colored callout card" pre-footer,
          ejecutado en el navy de la casa; referencia del cliente). Va acá, apenas
          termina el Archivo (intención pico: se acaban de escanear los informes),
          y FLOTA sobre blanco (sin banda gris), MÁS ANCHO que la columna de texto
          — rompe el wrap de 1200 a min(96vw, 1480px), como los breakouts navy de
          la guía. Puesto aquí —y no al pie— para no apilar tres navies al cierre
          (card + Asesoramiento + footer): el CTA navy de Asesoramiento queda como
          único cierre. Pitch izq + form der; oro sólo acento (kicker, foco
          superior-derecho, hover). Etapa 1 = sólo recolección en D1
          (/api/newsletter); el envío se enchufa después. */}
      <section className="band site-section">
        <div className="nl-card-wrap">
          <Reveal as="div" className="nl-card">
            <div>
              <span className="nl-kicker">Suscripción</span>
              <h2 className="nl-card-title">Recibí cada informe en tu correo.</h2>
              <p className="nl-card-lead">
                La lectura de la mesa, apenas se publica. El semanal cada viernes y el
                mensual al cierre — sin ruido.
              </p>
            </div>
            <div>
              <div className="nl-card-formlabel">Al día con la mesa</div>
              <NewsletterSignup tone="navy" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Autores — quién firma cada informe. MUTED: el card de suscripción quedó
          en banda blanca (arriba, pegado al Archivo también blanco; el card navy
          disimula esa costura). Autores toma el turno gris del ABAB para que el
          ritmo alterne otra vez y el card aterrice sobre una banda diferenciada. */}
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

      {/* Videos de la casa — la misma lectura, en otro soporte. Gateado por el
          flag `videos_casa` del panel: /api/youtube devuelve vacío con el flag
          apagado y el módulo no se monta (default OFF: nada cambia hasta que
          un empleado lo prenda en /admin/secciones). */}
      <VideosDeLaCasa variant="band-muted" />

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
           libro (arriba-derecha). Escala con el viewport y se achica en laptops
           (guarda de abajo) para no pisar el párrafo. */
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
          -webkit-user-drag: none;
          user-select: none;
        }
        /* Guarda de laptop: de 861 a 1700 el gutter izquierdo es angosto (el
           copy se corre a la derecha de su columna). La lapicera se achica y se
           recuesta más a la izquierda para que la punta quede siempre en el
           margen y no toque el párrafo. Arriba de 1700 rige la base (1920+). */
        @media (min-width: 861px) and (max-width: 1700px) {
          .hero-pen {
            width: clamp(280px, 22vw, 380px);
            transform: translateX(-62%);
          }
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
          /* padding-right chico: la caja de texto (anclada a la derecha de su
             columna) se corre hacia el centro/libro y aprovecha el hueco del
             medio, en vez de quedar apilada a la izquierda. */
          .hero-split .hero-copy { padding-right: clamp(16px, 2vw, 40px); }
          .hero-split .hero-copy-inner {
            width: fit-content;
            max-width: 36rem;
            align-self: flex-end;
          }
        }
        .hero-split .hero-figure.hero-figure--carpeta { background: #ffffff; }
        @media (max-width: 860px) {
          /* Banda alta (escala con el ancho) para que la carpeta entre ENTERA
             y se lea como objeto, no como un bloque navy recortado. */
          .hero-split .hero-figure.hero-figure--carpeta { min-height: min(108vw, 440px); }
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
        /* Ícono-acento del bloque de newsletter: sobre en oro (gold-deep sobre
           claro), único toque de color de la sección — el oro es acento, jamás
           superficie. */
        /* Contenedor del card: rompe el wrap de 1200 a un ancho mayor
           (min(96vw, 1480px)) para darle más presencia — el card sale más ancho
           que el cuerpo de texto de arriba y abajo. */
        .nl-card-wrap { width: min(96vw, 1480px); margin-inline: auto; }
        /* Callout card de suscripción: objeto navy que flota sobre la banda
           blanca, pitch (izq) + form (der). El navy es el color de cierre de la
           casa; el oro entra sólo como acento (kicker, foco superior, botón). */
        .nl-card {
          position: relative;
          overflow: hidden;
          background: var(--navy);
          border-radius: 20px;
          padding: clamp(32px, 4vw, 60px);
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr);
          gap: clamp(32px, 5vw, 72px);
          align-items: center;
        }
        /* Foco dorado superior-derecho — el motivo de iluminación cálida de la
           casa sobre cada superficie navy. */
        .nl-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(120% 130% at 88% 8%, rgba(201, 168, 76, 0.18), transparent 52%);
        }
        .nl-card > * { position: relative; }
        /* Scope bajo .nl-card: gana a la regla global .site h2 (tinta oscura),
           que si no pinta el título de navy sobre navy. */
        .nl-kicker {
          display: inline-flex;
          align-items: center;
          gap: 11px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--gold-soft);
        }
        .nl-kicker::before { content: ""; width: 22px; height: 2px; background: var(--gold-soft); }
        .nl-card .nl-card-title {
          margin-top: 18px;
          font-size: clamp(28px, 3.2vw, 44px);
          font-weight: 400;
          line-height: 1.12;
          letter-spacing: -0.02em;
          color: #fff;
          max-width: 15em;
        }
        .nl-card .nl-card-lead {
          margin-top: 16px;
          font-size: 17px;
          line-height: 1.55;
          color: rgba(255, 255, 255, 0.78);
          max-width: 34em;
        }
        .nl-card-formlabel { font-size: 13px; color: rgba(255, 255, 255, 0.55); margin-bottom: 12px; }
        @media (max-width: 820px) {
          .nl-card { grid-template-columns: 1fr; gap: 28px; }
        }
        .informe-meta { display: inline-flex; align-items: center; gap: 14px; }
        .informe-fecha { font-weight: 600; color: var(--gold-deep); letter-spacing: 0.02em; }
        .informe-cta { pointer-events: none; flex: none; }
        @media (max-width: 640px) {
          .informe-row { flex-direction: column; align-items: flex-start; gap: 14px; }
        }
        /* Fila del mensual con su video de presentación embebido: cuerpo
           (meta + título + acceso al PDF) a la izquierda, video 16:9 a la
           derecha. Los semanales siguen como filas hairline simples. */
        .informe-row--video {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
          gap: clamp(20px, 3vw, 48px);
          align-items: center;
        }
        .informe-row--video .ivid-body { display: flex; flex-direction: column; min-width: 0; }
        @media (max-width: 720px) {
          .informe-row--video { grid-template-columns: 1fr; gap: 18px; }
        }
      `}</style>
    </main>
  );
}
