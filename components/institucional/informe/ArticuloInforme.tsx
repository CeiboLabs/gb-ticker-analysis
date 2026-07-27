import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { Informe } from "@/lib/informes";
import type { Bloque, ContenidoInforme } from "@/lib/informeContenido/tipos";
import { BarrasRetorno } from "./BarrasRetorno";
import { TablaDatos } from "./TablaDatos";
import { LineaTiempo } from "./LineaTiempo";
import { RetornosGrid } from "./RetornosGrid";
import { ImagenBloque } from "./ImagenBloque";

// Artículo de un informe, en el sistema `.site` (Arial · oro mínimo). Una sola
// superficie editorial BLANCA, en familia con el hub /informes y con el cuerpo:
// masthead tranquilo (kicker oro · titular serif · bajada · byline con hairline
// · PDF como link discreto), seguido de una apertura liviana — "la semana en
// tres líneas" + el gráfico de la semana sobre hairlines de dos pesos — y luego
// el cuerpo en columna de artículo con breakouts de datos. El serif se raciona
// al titular (.t-serif-display). Server component puro. Sin hero navy: el navbar
// arranca claro en todo /informes (ver Navbar.tsx, `pathname.startsWith`).

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

function BloquesSeccion({ bloques }: { bloques: Bloque[] }) {
  const primerParrafo = bloques.findIndex((b) => b.tipo === "parrafo");
  return (
    <>
      {bloques.map((b, i) => {
        switch (b.tipo) {
          case "parrafo": {
            const esLead = i === primerParrafo;
            // El primer párrafo entra un punto más grande; sin capitular (registro
            // institucional calmo, no revista).
            const clase = "inf-prosa" + (esLead ? " inf-prosa-lead" : "");
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
          case "serie":
            return (
              <LineaTiempo key={i} titulo={b.titulo} subtitulo={b.subtitulo} lineas={b.lineas} nota={b.nota} />
            );
          case "retornos":
            return <RetornosGrid key={i} titulo={b.titulo} grupos={b.grupos} nota={b.nota} />;
          case "imagen":
            return <ImagenBloque key={i} src={b.src} alt={b.alt} titulo={b.titulo} fuente={b.fuente} />;
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
    <main className="site inf-article">
      {/* ── Masthead editorial (blanco) — reemplaza el hero navy: una sola
          superficie de artículo, en familia con el hub /informes ── */}
      <header className="inf-mast">
        <div className="site-wrap-narrow">
          <div className="kicker inf-mast-kicker">{volanta}</div>
          <h1 className="t-serif-display inf-mast-title">{titular}</h1>
          <p className="inf-mast-dek">{bajada}</p>

          <div className="inf-mast-byline">
            <span className="inf-mast-by">
              <span className="inf-mast-autor">Por {autor}</span>
              <span className="inf-mast-meta">
                {informe.fechaTexto} · {minutos} min de lectura
              </span>
            </span>
          </div>
        </div>
      </header>

      {/* ── Apertura — la semana en tres líneas + gráfico, sobre blanco ── */}
      <div className="site-wrap-narrow inf-opener">
        <section className="inf-glance-block" aria-label="La semana en tres líneas">
          <div className="inf-glance-cap">La semana en tres líneas</div>
          <div className="inf-glance">
            {resumen.map((r) => (
              <div className="inf-glance-item" key={r.etiqueta}>
                <span className="inf-glance-tag">{r.etiqueta}</span>
                <span className="inf-glance-txt">{r.texto}</span>
              </div>
            ))}
          </div>
        </section>

        {graficoSemana && (
          <section className="inf-weekchart" aria-label="Gráfico de la semana">
            <div className="inf-glance-cap">Gráfico de la semana</div>
            <div className="inf-weekchart-title">{graficoSemana.titulo}</div>
            {graficoSemana.subtitulo && (
              <div className="inf-weekchart-sub">{graficoSemana.subtitulo}</div>
            )}
            <BarrasRetorno grupos={[{ nombre: "", datos: graficoSemana.datos }]} nota={graficoSemana.nota} />
          </section>
        )}
      </div>

      {/* ── Cuerpo — columna de artículo ─────────────────────────── */}
      <div className="inf-body">
        <div className="site-wrap-narrow">
          {grupos.map((g) => (
            <section className="inf-sec" key={g.seccion.numero}>
              <div className="inf-sec-head">
                <div className="inf-sec-kicker">
                  <span className="inf-sec-num">{g.seccion.numero}</span>
                  {g.seccion.eyebrow && <span> · {g.seccion.eyebrow}</span>}
                </div>
                <h2 className="inf-sec-title">{g.seccion.titulo}</h2>
              </div>
              <BloquesSeccion bloques={g.bloques} />
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

            {/* Salidas — el lector que llegó por un link compartido no cae en un
                callejón: research, el fondo, o hablar con la casa. */}
            <section className="inf-mas" aria-label="Seguí en Bengochea">
              <div className="inf-mas-cap">Seguí en Bengochea</div>
              <div className="inf-mas-grid">
                <Link href="/informes" className="inf-mas-item">
                  <span className="inf-mas-k">Más research</span>
                  <span className="inf-mas-d">Todos los informes de la mesa, semana a semana.</span>
                </Link>
                <Link href="/bng-seleccion-global" className="inf-mas-item">
                  <span className="inf-mas-k">El fondo</span>
                  <span className="inf-mas-d">BNG Selección Global — nosotros, en un solo vehículo.</span>
                </Link>
                <Link href="/contacto" className="inf-mas-item">
                  <span className="inf-mas-k">Hablar con un asesor</span>
                  <span className="inf-mas-d">Tu cartera no cabe en un informe general.</span>
                </Link>
              </div>
            </section>

            <div className="inf-volver">
              <Link href="/informes" className="link-arrow inf-volver-link">
                ← Todos los informes
              </Link>
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
        /* ── Masthead editorial (blanco) ── */
        .inf-mast {
          padding-top: calc(var(--nav-h) + clamp(44px, 6vw, 84px));
          padding-bottom: clamp(30px, 3.6vw, 46px);
        }
        .inf-mast-kicker { color: var(--gold-deep); }
        .inf-mast-title {
          font-size: clamp(33px, 5.1vw, 60px);
          line-height: 1.05;
          letter-spacing: -0.02em;
          color: var(--site-ink);
          margin: clamp(18px, 2.2vw, 26px) 0 0;
          max-width: 15em;
        }
        .inf-mast-dek {
          font-size: clamp(18.5px, 1.7vw, 23px);
          line-height: 1.5;
          color: var(--site-ink-2);
          max-width: 34em;
          margin: clamp(20px, 2.3vw, 27px) 0 0;
        }
        .inf-mast-byline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px 24px;
          margin-top: clamp(26px, 3.2vw, 38px);
          padding-top: 16px;
          border-top: 1px solid var(--site-border);
        }
        .inf-mast-by { display: flex; flex-direction: column; gap: 3px; }
        .inf-mast-autor { font-size: 14.5px; font-weight: 700; color: var(--site-ink); }
        .inf-mast-meta {
          font-family: var(--font-mono), monospace;
          font-size: 11.5px;
          letter-spacing: 0.04em;
          color: var(--site-ink-3);
          font-variant-numeric: tabular-nums;
        }
        /* ── Apertura — resumen + gráfico de la semana, sobre blanco ── */
        .inf-opener {
          display: grid;
          gap: clamp(34px, 4.5vw, 58px);
          padding-bottom: clamp(16px, 2.4vw, 30px);
        }
        .inf-glance-cap {
          font-family: var(--font-sans), sans-serif;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 11px;
          font-weight: 600;
          color: var(--gold-deep);
          margin-bottom: 16px;
        }
        /* Regla de dos pesos: apertura fuerte (ink) sobre divisores suaves. */
        .inf-glance { border-top: 1px solid var(--site-ink); }
        .inf-glance-item {
          display: grid;
          grid-template-columns: minmax(88px, 128px) 1fr;
          gap: clamp(16px, 3vw, 44px);
          padding: 16px 0;
          border-top: 1px solid var(--site-border);
          align-items: baseline;
        }
        .inf-glance-item:first-of-type { border-top: 0; }
        .inf-glance-tag {
          font-family: var(--font-sans), sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--site-ink);
        }
        .inf-glance-txt { font-size: 16px; line-height: 1.55; color: var(--site-ink-2); }

        /* Gráfico de la semana (un solo grupo → columna única a ancho completo) */
        .inf-weekchart { max-width: 640px; }
        .inf-weekchart .inf-barras-grid { grid-template-columns: 1fr; }
        .inf-weekchart-title {
          font-size: clamp(20px, 2vw, 24px);
          font-weight: 400;
          letter-spacing: -0.01em;
          color: var(--site-ink);
        }
        .inf-weekchart-sub {
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          letter-spacing: 0.02em;
          color: var(--site-ink-3);
          margin: 6px 0 18px;
        }

        /* ── Cuerpo ── */
        .inf-body {
          padding-top: clamp(30px, 4vw, 54px);
          padding-bottom: clamp(64px, 9vw, 120px);
        }

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
        .inf-sec-title {
          font-size: clamp(23px, 2.5vw, 31px);
          font-weight: 400;
          line-height: 1.16;
          letter-spacing: -0.018em;
          color: var(--site-ink);
          margin-top: 11px;
          max-width: 16em;
        }

        /* Prosa */
        .inf-prosa {
          font-size: 17.5px;
          line-height: 1.75;
          color: var(--site-ink-2);
          max-width: 40em;
          margin: 0 0 clamp(20px, 2.3vw, 27px);
        }
        .inf-prosa p { margin: 0; }
        .inf-prosa-lead { font-size: 19px; line-height: 1.68; color: var(--site-ink); }
        .inf-prosa strong { color: var(--site-ink); font-weight: 700; }
        .inf-prosa a { color: var(--navy-500); font-weight: 600; border-bottom: 1px solid var(--gold); }

        /* Subtítulos — dos niveles quietos, sin barra de color (país › tema) */
        .inf-sub { max-width: 42em; }
        .inf-sub--pais {
          margin: clamp(34px, 4.6vw, 50px) 0 var(--space-3, 14px);
          font-size: clamp(18px, 1.9vw, 22px); font-weight: 500; line-height: 1.25; letter-spacing: -0.012em;
          color: var(--site-ink);
        }
        .inf-sub--tema {
          margin: clamp(24px, 3.2vw, 32px) 0 var(--space-3, 14px);
          font-size: 16.5px; font-weight: 600; line-height: 1.4; letter-spacing: 0;
          color: var(--site-ink);
        }
        .inf-sub--tema .inf-sub-vol { font-weight: 400; color: var(--site-ink-3); }

        /* Lista */
        .inf-lista { list-style: none; margin: 0 0 var(--space-4, 24px); padding: 0; max-width: 42em; }
        .inf-lista li {
          position: relative; padding-left: 24px; margin-bottom: 12px;
          font-size: 17px; line-height: 1.6; color: var(--site-ink-2);
        }
        .inf-lista li::before {
          content: ""; position: absolute; left: 0; top: 0.8em; width: 8px; height: 1.5px; background: var(--site-ink-4);
        }

        /* Cita — pull-quote quieto: hairline a la izquierda, serif contenido, sin comilla gigante */
        .inf-cita {
          margin: clamp(30px, 4.2vw, 46px) 0;
          padding-left: clamp(20px, 3vw, 30px);
          border-left: 2px solid var(--site-ink-4);
          max-width: 36em;
        }
        .inf-cita p {
          font-family: var(--font-serif), Georgia, serif;
          font-style: italic;
          font-weight: 300;
          font-size: clamp(18.5px, 1.9vw, 23px);
          line-height: 1.45;
          letter-spacing: -0.005em;
          color: var(--site-ink);
          margin: 0;
        }
        .inf-cita cite {
          display: block; margin-top: 14px; font-family: var(--font-mono), monospace; font-style: normal;
          font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--site-ink-3);
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

        /* ── Serie temporal (gráfico de línea, SVG server-side) ── */
        .inf-serie { margin: clamp(34px, 5vw, 52px) 0; }
        .inf-serie-sub {
          font-family: var(--font-mono), monospace; font-size: 11px; letter-spacing: 0.02em;
          color: var(--site-ink-3); margin: 2px 0 14px;
        }
        .inf-serie-legend { display: flex; gap: 18px; flex-wrap: wrap; margin-bottom: 12px; }
        .inf-serie-leg {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: var(--font-mono), monospace; font-size: 11px; color: var(--site-ink-2);
        }
        .inf-serie-leg-line { width: 16px; border-top: 2px solid var(--navy); }
        .inf-serie-leg-line[data-kind="sec"] { border-top-color: var(--navy-300); }
        .inf-serie-plot {
          position: relative;
          height: clamp(200px, 34vw, 300px);
          border-top: 1.5px solid var(--navy);
        }
        .inf-serie-svg { display: block; width: 100%; height: 100%; }
        .inf-serie-grid { stroke: var(--site-border); stroke-width: 1; vector-effect: non-scaling-stroke; }
        .inf-serie-line {
          fill: none; stroke-width: 1.6; stroke-linejoin: round; stroke-linecap: round;
          vector-effect: non-scaling-stroke;
        }
        .inf-serie-line[data-kind="prim"] { stroke: var(--navy); }
        .inf-serie-line[data-kind="sec"] { stroke: var(--navy-300); }
        .inf-serie-ylab {
          position: absolute; left: 0; width: 38px; text-align: right; padding-right: 7px;
          transform: translateY(-50%);
          font-family: var(--font-mono), monospace; font-size: 10.5px; line-height: 1;
          color: var(--site-ink-3); font-variant-numeric: tabular-nums;
        }
        .inf-serie-xlab {
          position: absolute; bottom: 0; transform: translateX(-50%);
          font-family: var(--font-mono), monospace; font-size: 10.5px; line-height: 1;
          color: var(--site-ink-3); font-variant-numeric: tabular-nums; white-space: nowrap;
        }

        /* ── Retornos (heatmap verde/oxblood, fiel al PDF) ── */
        .inf-retornos { margin: clamp(34px, 5vw, 52px) 0; }
        .inf-ret-grid {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: clamp(20px, 3vw, 34px) clamp(28px, 4.5vw, 56px);
          border-top: 1.5px solid var(--navy); padding-top: var(--space-4, 24px);
        }
        .inf-ret-grupo { min-width: 0; }
        .inf-ret-nombre {
          font-family: var(--font-sans), sans-serif; font-size: 10.5px; font-weight: 600; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--site-ink-3); padding-bottom: 10px; margin-bottom: 8px;
          border-bottom: 1px solid var(--site-border);
        }
        .inf-ret-rows { display: flex; flex-direction: column; gap: 3px; }
        .inf-ret-row {
          display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px; height: 26px;
        }
        .inf-ret-tk {
          font-family: var(--font-mono), monospace; font-size: 11px; color: var(--site-ink-2);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .inf-ret-val {
          font-family: var(--font-mono), monospace; font-size: 11px; font-variant-numeric: tabular-nums;
          text-align: right; padding: 3px 8px; border-radius: 2px; min-width: 84px;
        }
        .inf-ret-val[data-dir="pos"] { background: var(--pos-soft); color: var(--pos); }
        .inf-ret-val[data-dir="neg"] { background: var(--neg-soft); color: var(--neg); }
        .inf-ret-val[data-dir="neu"] { background: var(--neu-soft); color: var(--neu); }
        @media (max-width: 560px) { .inf-ret-grid { grid-template-columns: 1fr; } }

        /* ── Imagen embebida (gráficos de terceros del mensual) ── */
        .inf-imagen { margin: clamp(34px, 5vw, 52px) 0; }
        .inf-imagen-img {
          display: block; width: 100%; height: auto;
          border: 1px solid var(--site-border); border-radius: 2px;
        }

        /* ── Pie ── */
        .inf-footer { margin-top: clamp(48px, 7vw, 84px); }

        /* Salidas al pie — onward discovery (research · fondo · asesor) */
        .inf-mas {
          border-top: 1px solid var(--site-ink);
          padding-top: clamp(24px, 3vw, 32px);
          margin-bottom: clamp(30px, 4vw, 44px);
        }
        .inf-mas-cap {
          font-family: var(--font-sans), sans-serif; text-transform: uppercase; letter-spacing: 0.14em;
          font-size: 11px; font-weight: 600; color: var(--gold-deep); margin-bottom: 20px;
        }
        .inf-mas-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(20px, 3vw, 40px); }
        .inf-mas-item {
          display: flex; flex-direction: column; gap: 8px;
          padding-top: 16px; border-top: 1px solid var(--site-border);
          transition: opacity 160ms ease;
        }
        .inf-mas-item:hover { opacity: 0.6; }
        .inf-mas-k {
          font-size: clamp(17px, 1.7vw, 20px); font-weight: 400; letter-spacing: -0.01em; line-height: 1.2;
          color: var(--site-ink);
        }
        .inf-mas-k::after { content: " →"; color: var(--gold-deep); }
        .inf-mas-d { font-size: 14px; line-height: 1.5; color: var(--site-ink-3); }
        @media (max-width: 640px) { .inf-mas-grid { grid-template-columns: 1fr; } }
        .inf-vecinos {
          display: grid; grid-template-columns: 1fr 1fr; gap: clamp(24px, 4vw, 48px);
          border-top: 1px solid var(--site-ink);
          margin-bottom: clamp(32px, 4vw, 44px);
        }
        .inf-vecino {
          display: flex; flex-direction: column; gap: 8px;
          padding: clamp(18px, 2.4vw, 24px) 0 0;
          transition: opacity 160ms ease;
        }
        .inf-vecino:hover { opacity: 0.6; }
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
