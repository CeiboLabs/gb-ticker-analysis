import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { Informe } from "@/lib/informes";
import type { Bloque, ContenidoInforme } from "@/lib/informeContenido/tipos";
import { FileDown } from "@/components/institucional/icons";
import { BarrasRetorno } from "./BarrasRetorno";
import { TablaDatos } from "./TablaDatos";

// Artículo de un informe, en el sistema `.site` (Arial · navy + oro mínimo),
// con la ESTRUCTURA de research que usan los referentes de la industria
// (BlackRock, GS): hero navy con "at a glance" (la semana en tres líneas) y un
// gráfico de la semana protagonista, y luego el cuerpo en una columna de
// artículo con breakouts de datos — no el spine de landing del fondo. El serif
// se raciona al titular del hero (.t-serif-display), como el hero del fondo.
// Server component puro. El hero navy hace que el navbar abra en modo oscuro y
// flipee al pasarlo (detecta `.informe-hero`).

export type Vecino = { titulo: string; categoria: Informe["categoria"]; href: string };

type Seccion = Extract<Bloque, { tipo: "seccion" }>;
type Grupo = { seccion: Seccion; bloques: Bloque[] };

function agruparSecciones(bloques: Bloque[]): Grupo[] {
  const grupos: Grupo[] = [];
  let actual: Grupo | null = null;
  for (const b of bloques) {
    if (b.tipo === "seccion") {
      actual = { seccion: b, bloques: [] };
      grupos.push(actual);
    } else if (actual) {
      actual.bloques.push(b);
    }
  }
  return grupos;
}

const palabras = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Minutos de lectura estimados (~180 palabras/min sobre prosa, resumen y citas). */
function tiempoLectura(c: ContenidoInforme): number {
  let n = palabras(c.bajada) + c.resumen.reduce((a, r) => a + palabras(r.texto), 0);
  for (const b of c.bloques) {
    if (b.tipo === "parrafo") n += palabras(b.md);
    else if (b.tipo === "lista") n += b.items.reduce((a, it) => a + palabras(it), 0);
    else if (b.tipo === "cita") n += palabras(b.texto);
  }
  return Math.max(1, Math.round(n / 180));
}

function BloquesSeccion({ bloques, esPrimeraSeccion }: { bloques: Bloque[]; esPrimeraSeccion?: boolean }) {
  const primerParrafo = bloques.findIndex((b) => b.tipo === "parrafo");
  return (
    <>
      {bloques.map((b, i) => {
        switch (b.tipo) {
          case "parrafo": {
            const esLead = i === primerParrafo;
            // Capitular dorada solo en el primer párrafo del artículo (toque editorial).
            const clase =
              "inf-prosa" +
              (esLead ? " inf-prosa-lead" : "") +
              (esLead && esPrimeraSeccion ? " inf-dropcap" : "");
            return (
              <div className={clase} key={i}>
                <ReactMarkdown>{b.md}</ReactMarkdown>
              </div>
            );
          }
          case "subtitulo":
            return (
              <h3 className={b.volanta ? "inf-sub inf-sub--tema" : "inf-sub inf-sub--pais"} key={i}>
                <span className="inf-sub-tit">{b.titulo}</span>
                {b.volanta && <span className="inf-sub-vol"> — {b.volanta}</span>}
              </h3>
            );
          case "lista":
            return (
              <ul className="inf-lista" key={i}>
                {b.items.map((it, k) => (
                  <li key={k}>{it}</li>
                ))}
              </ul>
            );
          case "cita":
            return (
              <blockquote className="inf-cita" key={i}>
                <p>{b.texto}</p>
                {b.fuente && <cite>{b.fuente}</cite>}
              </blockquote>
            );
          case "tabla":
            return (
              <TablaDatos key={i} titulo={b.titulo} columnas={b.columnas} filas={b.filas} nota={b.nota} />
            );
          case "barras":
            return <BarrasRetorno key={i} titulo={b.titulo} grupos={b.grupos} nota={b.nota} />;
          default:
            return null;
        }
      })}
    </>
  );
}

export function ArticuloInforme({
  informe,
  contenido,
  anterior,
  siguiente,
}: {
  informe: Informe;
  contenido: ContenidoInforme;
  anterior?: Vecino;
  siguiente?: Vecino;
}) {
  const { volanta, titular, bajada, autor, resumen, graficoSemana } = contenido;
  const grupos = agruparSecciones(contenido.bloques);
  const minutos = tiempoLectura(contenido);

  return (
    <main className="site">
      {/* ── Hero navy — meta, titular, at-a-glance y gráfico de la semana ── */}
      <header className="informe-hero band-navy">
        <div className="site-wrap inf-hero-wrap">
          <div className="inf-hero-kicker">
            {volanta} · {informe.fechaTexto} · {minutos} min de lectura
          </div>
          <h1 className="t-serif-display inf-hero-title">{titular}</h1>
          <p className="t-lead inf-hero-dek">{bajada}</p>

          <div className="inf-hero-grid">
            <div className="inf-glance">
              <div className="inf-glance-cap">La semana en tres líneas</div>
              {resumen.map((r) => (
                <div className="inf-glance-item" key={r.etiqueta}>
                  <span className="inf-glance-tag">{r.etiqueta}</span>
                  <span className="inf-glance-txt">{r.texto}</span>
                </div>
              ))}
            </div>

            {graficoSemana && (
              <div className="inf-herochart">
                <div className="inf-glance-cap">Gráfico de la semana</div>
                <div className="inf-herochart-title">{graficoSemana.titulo}</div>
                {graficoSemana.subtitulo && (
                  <div className="inf-herochart-sub">{graficoSemana.subtitulo}</div>
                )}
                <BarrasRetorno grupos={[{ nombre: "", datos: graficoSemana.datos }]} nota={graficoSemana.nota} enNavy />
              </div>
            )}
          </div>

          <div className="inf-hero-byline">
            <span className="inf-hero-autor">Por {autor}</span>
            <a
              className="ui-btn ui-btn-on-navy inf-hero-pdf"
              href={`/informes/${informe.slug}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileDown /> Descargar PDF
            </a>
          </div>
        </div>
      </header>

      {/* ── Cuerpo — columna de artículo ─────────────────────────── */}
      <div className="band site-section">
        <div className="site-wrap-narrow">
          {grupos.map((g, gi) => (
            <section className="inf-sec" key={g.seccion.numero}>
              <div className="inf-sec-head">
                <div className="inf-sec-kicker">
                  <span className="inf-sec-num">{g.seccion.numero}</span>
                  {g.seccion.eyebrow && <span> · {g.seccion.eyebrow}</span>}
                </div>
                <h2 className="t-h2 inf-sec-title">{g.seccion.titulo}</h2>
              </div>
              <BloquesSeccion bloques={g.bloques} esPrimeraSeccion={gi === 0} />
            </section>
          ))}

          {/* ── Pie ── */}
          <footer className="inf-footer">
            {(anterior || siguiente) && (
              <nav className="inf-vecinos" aria-label="Otros informes">
                {anterior ? (
                  <Link href={anterior.href} className="inf-vecino inf-vecino--prev">
                    <span className="inf-vecino-dir">← Anterior</span>
                    <span className="inf-vecino-tit">{anterior.titulo}</span>
                  </Link>
                ) : (
                  <span />
                )}
                {siguiente ? (
                  <Link href={siguiente.href} className="inf-vecino inf-vecino--next">
                    <span className="inf-vecino-dir">Siguiente →</span>
                    <span className="inf-vecino-tit">{siguiente.titulo}</span>
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}

            <div className="inf-volver">
              <Link href="/informes" className="link-arrow inf-volver-link">
                ← Todos los informes
              </Link>
              <a
                href={`/informes/${informe.slug}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="link-arrow inf-volver-link"
              >
                Descargar PDF ↓
              </a>
            </div>

            <div className="inf-disclosure">
              <p>
                Este informe fue elaborado por Bengochea &amp; Cía. Sociedad de Bolsa con fines
                exclusivamente informativos. No constituye asesoramiento de inversión ni una
                recomendación de compra o venta de valores. Las opiniones reflejan el criterio del
                autor a la fecha de publicación y están sujetas a cambios sin previo aviso.
              </p>
              <p>
                Bengochea &amp; Cía. es una sociedad de bolsa regulada por el Banco Central del
                Uruguay conforme a la Ley N.º 18.627 de Mercado de Valores.
              </p>
              <p className="inf-copy">© {new Date().getFullYear()} Bengochea &amp; Cía. Sociedad de Bolsa</p>
            </div>
          </footer>
        </div>
      </div>

      <style>{`
        /* ── Hero navy ── */
        .informe-hero {
          padding-top: calc(var(--nav-h) + clamp(40px, 6vw, 72px));
          padding-bottom: clamp(44px, 6vw, 72px);
          position: relative;
          isolation: isolate;
        }
        /* Foco cálido superior-derecho (motivo de iluminación de la casa) */
        .informe-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(60% 50% at 82% 8%, rgba(201,168,76,0.12), transparent 60%);
          pointer-events: none;
          z-index: 0;
        }
        .inf-hero-wrap { position: relative; z-index: 1; }
        .inf-hero-kicker {
          font-family: var(--font-mono), monospace;
          font-size: 11.5px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--gold-soft);
          font-variant-numeric: tabular-nums;
        }
        .inf-hero-title {
          font-size: clamp(34px, 5.2vw, 60px);
          line-height: 1.05;
          color: #fff;
          margin: clamp(16px, 2vw, 22px) 0 0;
          max-width: 17em;
        }
        .inf-hero-dek {
          margin: clamp(18px, 2.2vw, 24px) 0 0;
          max-width: 40em;
          color: rgba(255,255,255,0.82) !important;
        }
        .inf-hero-grid {
          display: grid;
          grid-template-columns: 0.92fr 1.08fr;
          gap: clamp(32px, 5vw, 68px);
          margin-top: clamp(34px, 4.5vw, 52px);
          padding-top: clamp(30px, 4vw, 42px);
          border-top: 1px solid rgba(255,255,255,0.18);
        }
        @media (max-width: 860px) {
          .inf-hero-grid { grid-template-columns: 1fr; gap: clamp(32px, 8vw, 48px); }
        }

        /* At a glance — la semana en tres líneas */
        .inf-glance-cap {
          font-family: var(--font-sans), sans-serif;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-size: 11px;
          font-weight: 600;
          color: var(--gold-soft);
          margin-bottom: 18px;
        }
        .inf-glance-item {
          display: grid;
          grid-template-columns: minmax(84px, auto) 1fr;
          gap: 16px;
          padding: 15px 0;
          border-top: 1px solid rgba(255,255,255,0.12);
          align-items: baseline;
        }
        .inf-glance-item:first-of-type { border-top: 0; padding-top: 0; }
        .inf-glance-tag {
          font-family: var(--font-sans), sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--gold-soft);
        }
        .inf-glance-txt { font-size: 15.5px; line-height: 1.5; color: rgba(255,255,255,0.9); }

        /* Gráfico de la semana */
        .inf-herochart-title {
          font-size: clamp(19px, 2vw, 23px);
          font-weight: 400;
          letter-spacing: -0.01em;
          color: #fff;
          margin-top: 2px;
        }
        .inf-herochart-sub {
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          letter-spacing: 0.02em;
          color: rgba(255,255,255,0.6);
          margin: 6px 0 18px;
        }

        /* Byline del hero */
        .inf-hero-byline {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          margin-top: clamp(32px, 4vw, 44px);
        }
        .inf-hero-autor { font-size: 15px; font-weight: 700; color: #fff; }
        .inf-hero-pdf { margin-left: auto; padding: 11px 18px; font-size: 13px; }
        .inf-hero-pdf svg { width: 15px; height: 15px; }
        @media (max-width: 560px) { .inf-hero-pdf { margin-left: 0; } }

        /* ── Cuerpo · secciones de artículo ── */
        .inf-sec {
          border-top: 1px solid var(--site-border);
          padding-top: clamp(32px, 4vw, 46px);
          margin-top: clamp(52px, 7vw, 82px);
        }
        .inf-sec:first-of-type { margin-top: 0; }
        .inf-sec-head { margin-bottom: clamp(22px, 3vw, 30px); }
        .inf-sec-kicker {
          font-family: var(--font-sans), sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--gold-deep);
        }
        .inf-sec-num { font-family: var(--font-mono), monospace; font-variant-numeric: tabular-nums; }
        .inf-sec-title { margin-top: 12px; max-width: 16em; }

        /* Prosa */
        .inf-prosa {
          font-size: 17.5px;
          line-height: 1.75;
          color: var(--site-ink-2);
          max-width: 40em;
          margin: 0 0 clamp(20px, 2.3vw, 27px);
        }
        .inf-prosa p { margin: 0; }
        .inf-prosa-lead { font-size: 20px; line-height: 1.62; color: var(--site-ink); }
        .inf-prosa strong { color: var(--site-ink); font-weight: 700; }
        .inf-prosa a { color: var(--navy-500); font-weight: 600; border-bottom: 1px solid var(--gold); }
        /* Capitular dorada — apertura del artículo (toque editorial, único serif del cuerpo) */
        .inf-dropcap > p:first-of-type::first-letter {
          font-family: var(--font-serif), Georgia, serif;
          font-weight: 500;
          font-size: 3.3em;
          float: left;
          line-height: 0.8;
          margin: 0.03em 0.11em 0 0;
          color: var(--gold-deep);
        }

        /* Subtítulos */
        .inf-sub { max-width: 42em; }
        .inf-sub--tema {
          margin: clamp(26px, 3.4vw, 34px) 0 var(--space-3, 16px);
          font-size: 18px; font-weight: 600; line-height: 1.35; letter-spacing: -0.01em;
          color: var(--site-ink);
        }
        .inf-sub--tema .inf-sub-vol { font-weight: 400; color: var(--site-ink-3); }
        .inf-sub--pais {
          margin: clamp(36px, 5vw, 52px) 0 var(--space-3, 16px);
          padding-left: 16px; position: relative;
          font-size: clamp(20px, 2.1vw, 26px); font-weight: 400; line-height: 1.2; letter-spacing: -0.015em;
          color: var(--site-ink);
        }
        .inf-sub--pais::before {
          content: ""; position: absolute; left: 0; top: 0.16em; bottom: 0.16em; width: 2px; background: var(--gold);
        }

        /* Lista */
        .inf-lista { list-style: none; margin: 0 0 var(--space-4, 24px); padding: 0; max-width: 42em; }
        .inf-lista li {
          position: relative; padding-left: 24px; margin-bottom: 12px;
          font-size: 17px; line-height: 1.6; color: var(--site-ink-2);
        }
        .inf-lista li::before {
          content: ""; position: absolute; left: 0; top: 0.72em; width: 9px; height: 2px; background: var(--gold-deep);
        }

        /* Cita */
        /* Pull-quote editorial — serif itálica con comilla de oro colgada */
        .inf-cita {
          position: relative;
          margin: clamp(38px, 5vw, 58px) 0;
          padding-left: clamp(32px, 4.5vw, 50px);
          max-width: 33em;
        }
        .inf-cita::before {
          content: '“';
          position: absolute;
          left: -4px;
          top: -0.04em;
          font-family: var(--font-serif), Georgia, serif;
          font-size: clamp(54px, 6.5vw, 82px);
          line-height: 1;
          color: var(--gold);
        }
        .inf-cita p {
          font-family: var(--font-serif), Georgia, serif;
          font-style: italic;
          font-weight: 300;
          font-size: clamp(21px, 2.5vw, 30px);
          line-height: 1.36;
          letter-spacing: -0.01em;
          color: var(--site-ink);
          margin: 0;
        }
        .inf-cita cite {
          display: block; margin-top: 16px; font-family: var(--font-mono), monospace; font-style: normal;
          font-size: 11.5px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--site-ink-3);
        }

        /* ── Bloques de datos (tabla + barras) ── */
        .inf-data { margin: clamp(34px, 5vw, 52px) 0; }
        .inf-tabla-scroll { overflow-x: auto; }
        .inf-tabla-scroll .fin-table { min-width: 320px; }
        .inf-datacap {
          font-family: var(--font-sans), sans-serif; text-transform: uppercase; letter-spacing: 0.14em;
          font-size: 11px; font-weight: 600; color: var(--site-ink-3); margin: 0 0 var(--space-3, 16px);
        }
        .inf-datanota {
          font-family: var(--font-mono), monospace; font-size: 10.5px; letter-spacing: 0.02em;
          color: var(--site-ink-3); margin: var(--space-3, 16px) 0 0;
        }

        .inf-barras-grid {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: clamp(24px, 3.2vw, 40px) clamp(32px, 5vw, 64px);
          border-top: 1.5px solid var(--navy); padding-top: var(--space-4, 24px);
        }
        .inf-grupo { min-width: 0; }
        .inf-grupo-nombre {
          font-family: var(--font-sans), sans-serif; font-size: 10.5px; font-weight: 600; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--site-ink-3); padding-bottom: 10px; margin-bottom: 8px;
          border-bottom: 1px solid var(--site-border);
        }
        .inf-rows { display: flex; flex-direction: column; }
        .inf-row {
          display: grid; grid-template-columns: minmax(64px, auto) 1fr minmax(60px, auto);
          align-items: center; gap: 12px; height: 29px;
        }
        .inf-row-label {
          font-family: var(--font-mono), monospace; font-size: 11px; color: var(--site-ink-2);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .inf-track { position: relative; height: 100%; min-width: 0; }
        .inf-zero { position: absolute; top: 6px; bottom: 6px; width: 1px; background: var(--site-border-2); transform: translateX(-0.5px); }
        .inf-fill { position: absolute; top: 50%; height: 9px; transform: translateY(-50%); border-radius: 1px; min-width: 2px; }
        .inf-nub { position: absolute; top: 50%; width: 4px; height: 4px; border-radius: 50%; background: var(--neu); transform: translate(-50%, -50%); }
        .inf-row-val {
          font-family: var(--font-mono), monospace; font-size: 12px; font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum" 1, "zero" 1; text-align: right; white-space: nowrap;
        }
        @media (max-width: 560px) { .inf-barras-grid { grid-template-columns: 1fr; } }

        /* Variante navy (gráfico de la semana en el hero) */
        .inf-barras--navy .inf-barras-grid {
          grid-template-columns: 1fr;
          border-top-color: rgba(255,255,255,0.22);
        }
        .inf-barras--navy .inf-row-label { color: rgba(255,255,255,0.74); }
        .inf-barras--navy .inf-zero { background: rgba(255,255,255,0.28); }
        .inf-barras--navy .inf-datanota { color: rgba(255,255,255,0.55); }

        /* ── Pie ── */
        .inf-footer { margin-top: clamp(48px, 7vw, 84px); }
        .inf-vecinos {
          display: grid; grid-template-columns: 1fr 1fr; gap: 1px;
          background: var(--site-border); border: 1px solid var(--site-border);
          border-radius: var(--r-card); overflow: hidden; margin-bottom: clamp(32px, 4vw, 44px);
        }
        .inf-vecino {
          display: flex; flex-direction: column; gap: 8px; padding: clamp(20px, 2.6vw, 26px);
          background: var(--surface); transition: background-color 180ms ease;
        }
        .inf-vecino:hover { background: var(--surface-muted); }
        .inf-vecino--next { text-align: right; }
        .inf-vecino-dir {
          font-family: var(--font-mono), monospace; font-size: 11px; letter-spacing: 0.05em;
          text-transform: uppercase; color: var(--gold-deep);
        }
        .inf-vecino-tit {
          font-size: clamp(18px, 1.8vw, 22px); font-weight: 400; letter-spacing: -0.015em; line-height: 1.25;
          color: var(--site-ink);
        }
        .inf-volver {
          display: flex; justify-content: space-between; flex-wrap: wrap; gap: 16px;
          padding-bottom: clamp(24px, 3vw, 32px); margin-bottom: clamp(24px, 3vw, 32px);
          border-bottom: 1px solid var(--site-border);
        }
        .inf-volver-link { font-size: 15px; font-weight: 600; color: var(--site-ink); }
        .inf-disclosure { display: flex; flex-direction: column; gap: 9px; max-width: 54em; }
        .inf-disclosure p { font-size: 13px; line-height: 1.55; color: var(--site-ink-3); margin: 0; }
        .inf-copy { font-family: var(--font-mono), monospace; letter-spacing: 0.02em; margin-top: 6px !important; }

        @media (max-width: 560px) {
          .inf-vecinos { grid-template-columns: 1fr; }
          .inf-vecino--next { text-align: left; }
        }
      `}</style>
    </main>
  );
}
