import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/seo";
import { getMetricsDb } from "@/lib/metrics";
import { readFlag } from "@/lib/flags";
import { readRecord, cell, targetAccuracy, type RecordSnapshot, type Rating } from "@/lib/recordStore";

// Se arma por request: lee los agregados de D1. Es barato (dos SELECT sobre
// tablas de decenas de filas) y así el número publicado es el del último
// recómputo sin tener que invalidar un cache estático.
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "El récord del analizador",
  description:
    "Cuánto le ganó al S&P 500 cada calificación de nuestro análisis de acciones, con sus límites declarados: precisión del precio objetivo, tamaño de la muestra y regla de acierto.",
  path: "/analisis/record",
});

const RATINGS: Rating[] = ["BUY", "HOLD", "AVOID"];

const RATING_DEK: Record<Rating, string> = {
  BUY: "Le vemos recorrido. Acierta si le ganó al índice.",
  HOLD: "Ni comprar ni vender. Acierta si se movió con el mercado.",
  AVOID: "Preferimos no estar. Acierta si le perdió al índice.",
};

function pct(v: number | null, dec = 1): string {
  if (v == null) return "s/d";
  return `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(dec)} %`;
}

function pctPlano(v: number | null, dec = 0): string {
  return v == null ? "s/d" : `${(v * 100).toFixed(dec)} %`;
}

function fecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${Number(d)} ${MESES[Number(m) - 1]} ${y}`;
}

export default async function RecordPage() {
  const db = getMetricsDb();

  // Flag de publicación, default OFF. Apagado ⇒ 404 de verdad (no una página
  // vacía): la decisión de publicar el récord es del cliente, y hasta que la
  // tome esta ruta no existe. Mismo criterio que lib/paginasOcultas.ts.
  if (!(await readFlag(db, "record_publico"))) notFound();

  const snap: RecordSnapshot | null = db ? await readRecord(db) : null;
  const seis = snap ? cell(snap, "6m", "ALL") : null;

  // Sin recómputo todavía no hay nada honesto que mostrar. Antes que publicar
  // ceros, se dice que falta correrlo.
  if (!snap || !seis || seis.n === 0) {
    return (
      <main className="site">
        <section className="band site-section">
          <div className="site-wrap">
            <div className="eyebrow-sm">Récord</div>
            <h1 className="t-h2" style={{ marginTop: 16, maxWidth: "20em" }}>
              El récord todavía no está calculado.
            </h1>
            <p className="t-lead" style={{ marginTop: 20, maxWidth: "38em" }}>
              La medición se recalcula desde el archivo de calificaciones. Volvé en un rato.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const t6 = targetAccuracy(snap, "6m");
  const t12 = targetAccuracy(snap, "12m");

  // ── Escala del gráfico ──────────────────────────────────────────────────
  // UNA sola escala para los dos lados. Tener un factor por lado (más ancho a la
  // derecha porque los excesos positivos son mayores) parece razonable y es un
  // eje roto: un −6,4 % dibujado con otro factor que un +6,6 % da dos barras de
  // largo distinto para magnitudes casi iguales, y el ojo compara largos. El
  // factor lo fija el lado que primero se queda sin carril.
  const excesos = RATINGS.map((r) => cell(snap, "6m", r)?.excessMed ?? 0);
  const maxPos = Math.max(...excesos.filter((v) => v > 0), 0.0001);
  const maxNeg = Math.max(...excesos.filter((v) => v < 0).map(Math.abs), 0.0001);

  // La línea del índice al 46 % del carril: deja 52 % a la derecha y 44 % a la
  // izquierda, y el resto del ancho lo ocupan las etiquetas de valor, que salen
  // por fuera de la barra.
  const CERO_PCT = 46;
  const DISPONIBLE_DER = 52;
  const DISPONIBLE_IZQ = 44;
  const escala = Math.min(DISPONIBLE_DER / maxPos, DISPONIBLE_IZQ / maxNeg);

  return (
    <main
      className="site rec-root"
      style={{ "--rec-cero": `${CERO_PCT}%` } as React.CSSProperties}
    >
      {/* ── Apertura ─────────────────────────────────────────── */}
      <section className="band-navy site-section">
        <div className="site-wrap">
          <div className="split-label">
            <div className="eyebrow-sm">Récord del analizador</div>
            <div>
              <h1 className="t-h2" style={{ maxWidth: "20em" }}>
                Publicamos cuánto acertó nuestro análisis. También dónde falla.
              </h1>
              <p className="t-lead" style={{ marginTop: 22, maxWidth: "40em" }}>
                Cada análisis que genera esta herramienta queda archivado con su calificación y el
                precio de ese día. Acá medimos qué pasó después: cuánto le ganó —o le perdió— al
                S&amp;P 500 cada calificación, en la misma ventana de tiempo.
              </p>
              <p className="t-small" style={{ marginTop: 18, marginBottom: 0 }}>
                {seis.n + seis.nOpen} calificaciones sobre {snap.tickers} empresas ·{" "}
                {fecha(snap.desde)} – {fecha(snap.hasta)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── El gráfico ───────────────────────────────────────── */}
      <section className="band site-section">
        <div className="site-wrap">
          <div className="split-label">
            <div className="eyebrow-sm">Contra el índice</div>
            <div>
              <h2 className="t-h2">El orden se sostiene.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "38em" }}>
                Medimos exceso, no retorno: cuánto se movió la acción por encima o por debajo del
                S&amp;P 500 en el mismo período. Con el mercado en alza, decir «subió» no significa
                nada — lo que importa es si le ganó al índice.
              </p>
            </div>
          </div>

          <figure className="rec-fig">
            <figcaption>
              <div className="rec-fig-t">Exceso sobre el S&amp;P 500 a 6 meses</div>
              <div className="rec-fig-s">
                Mediana por calificación · la línea vertical es el índice · sólo ventanas cerradas
              </div>
            </figcaption>

            <div className="rec-chart">
              {RATINGS.map((r) => {
                const c = cell(snap, "6m", r);
                const ex = c?.excessMed ?? null;
                const positivo = (ex ?? 0) >= 0;
                const ancho = ex == null ? 0 : Math.abs(ex) * escala;
                return (
                  <div className="rec-row" key={r}>
                    <span className="rec-row-lbl">{r}</span>
                    <div className="rec-track">
                      {/* .rec-plot existe para reservar canaletas: las etiquetas
                          de valor salen POR FUERA de la barra, y sin un área de
                          dibujo más angosta que el carril la etiqueta de la barra
                          más larga se iba 27 px fuera de la pantalla en mobile
                          (medido). Las barras se posicionan contra el plot; las
                          etiquetas invaden los márgenes. */}
                      <div className="rec-plot">
                        <span className="rec-zero" aria-hidden="true" />
                        {ex != null && (
                          <div
                            className={`rec-bar ${positivo ? "is-pos" : "is-neg"}`}
                            style={{ width: `${ancho}%` }}
                            role="img"
                            aria-label={`${r}: ${pct(ex)} contra el índice a 6 meses, ${c?.n ?? 0} calificaciones`}
                          >
                            <span className="rec-bar-val">{pct(ex)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="rec-axis">
                <span />
                <div className="rec-axis-line">
                  {/* Mismo plot que las barras: si la etiqueta del eje se
                      posicionara contra el carril entero no caería sobre la línea. */}
                  <div className="rec-plot"><span>S&amp;P 500</span></div>
                </div>
              </div>
            </div>
          </figure>

          {/* Tabla: los mismos datos, legibles sin ver el gráfico. */}
          <div className="rec-tw">
            <table className="rec-table">
              <thead>
                <tr>
                  <th>Calificación</th>
                  <th className="r">Medidas</th>
                  <th className="r">Abiertas</th>
                  <th className="r">6 m · mediana</th>
                  <th className="r">12 m · mediana</th>
                  <th className="r">Acierto 6 m</th>
                </tr>
              </thead>
              <tbody>
                {RATINGS.map((r) => {
                  const c6 = cell(snap, "6m", r);
                  const c12 = cell(snap, "12m", r);
                  return (
                    <tr key={r}>
                      <td>
                        <span className="rec-rating">{r}</span>
                        <span className="rec-rating-dek">{RATING_DEK[r]}</span>
                      </td>
                      <td className="r">{c6?.n ?? 0}</td>
                      <td className="r">{c6?.nOpen ?? 0}</td>
                      <td className="r">{pct(c6?.excessMed ?? null)}</td>
                      <td className="r">{pct(c12?.excessMed ?? null)}</td>
                      <td className="r">{pctPlano(c6?.winRate ?? null)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="t-small" style={{ marginTop: 14, marginBottom: 0, maxWidth: "72ch" }}>
            «Abiertas» son las calificaciones cuya ventana todavía no se cerró: se siguen midiendo,
            pero no entran a los números de arriba. Contarlas sería inflar la muestra con
            pronósticos a los que no les llegó el plazo.
          </p>
        </div>
      </section>

      {/* ── Los límites ──────────────────────────────────────── */}
      <section className="band-muted site-section">
        <div className="site-wrap">
          <div className="split-label">
            <div className="eyebrow-sm">Dónde falla</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "22em" }}>
                El precio objetivo no le acierta. Lo decimos nosotros.
              </h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "40em" }}>
                La calificación funciona; el número puntual del precio objetivo, no. Y no está
                cerca: acierta la dirección del movimiento <b>menos</b> que el pronóstico más tonto
                posible, que es suponer que toda acción sube.
              </p>
            </div>
          </div>

          <div className="rec-lim">
            {[
              { h: "6 meses", t: t6 },
              { h: "12 meses", t: t12 },
            ].map(({ h, t }) => (
              <div className="rec-lim-col" key={h}>
                <div className="rec-lim-h">{h}</div>
                <div className="rec-lim-rows">
                  <div className="rec-lim-row">
                    <span>Error medio del objetivo</span>
                    <span className="rec-num">{t?.mae == null ? "s/d" : pctPlano(t.mae, 1)}</span>
                  </div>
                  <div className="rec-lim-row">
                    <span>Acierta la dirección</span>
                    <span className="rec-num">{pctPlano(t?.dirRate ?? null)}</span>
                  </div>
                  <div className="rec-lim-row is-baseline">
                    <span>Suponer que siempre sube</span>
                    <span className="rec-num">{pctPlano(t?.baselineDirRate ?? null)}</span>
                  </div>
                  <div className="rec-lim-row">
                    <span>Precio real dentro del rango</span>
                    <span className="rec-num">{pctPlano(t?.inRangeRate ?? null)}</span>
                  </div>
                </div>
                <p className="rec-lim-n">Sobre {t?.n ?? 0} calificaciones con ventana cerrada.</p>
              </div>
            ))}
          </div>

          <p className="t-body" style={{ marginTop: 32, maxWidth: "62ch" }}>
            Por eso en el informe el precio objetivo va como referencia dentro del rango de
            escenarios y nunca como pronóstico suelto. La lectura útil es la calificación y el
            argumento que la sostiene, no el número.
          </p>
        </div>
      </section>

      {/* ── Método ───────────────────────────────────────────── */}
      <section className="band site-section">
        <div className="site-wrap">
          <div className="split-label">
            <div className="eyebrow-sm">Método</div>
            <div>
              <h2 className="t-h2">Cómo se cuenta un acierto.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "38em" }}>
                Una regla de acierto sin declarar es la forma más barata de publicar un récord que
                no significa nada. Estas son las nuestras, y no cambian según convenga.
              </p>
            </div>
          </div>

          <div className="rec-metodo">
            {[
              ["Retorno total, no precio", "Se usa la serie ajustada por dividendos: si la empresa pagó, cuenta. Comparar sólo el precio castigaría a las que reparten."],
              ["Contra el índice, misma ventana", "El S&P 500 en exactamente el mismo período calendario. Nunca contra un índice elegido después."],
              ["Ventana cerrada", "Sólo entran las calificaciones a las que ya les pasó el plazo. Las abiertas se declaran aparte."],
              ["Acierto declarado por calificación", "BUY acierta si le ganó al índice. AVOID, si le perdió. HOLD, si se movió con el mercado (±15 puntos de exceso): un HOLD que le ganó por 40 puntos no fue un buen HOLD."],
              ["Todo el archivo, sin descartes", "Entran todas las calificaciones emitidas, no una selección. El archivo no admite borrado ni corrección."],
              ["La muestra es la que es", "Cientos de calificaciones sobre decenas de empresas, no miles. Alcanza para ver un orden; no para afirmar precisión."],
            ].map(([t, b]) => (
              <div className="rec-metodo-item" key={t}>
                <div className="rec-metodo-t">{t}</div>
                <p className="rec-metodo-b">{b}</p>
              </div>
            ))}
          </div>

          <p className="t-small" style={{ marginTop: 32, marginBottom: 0 }}>
            Última medición: {snap.computedAt ? new Date(snap.computedAt).toLocaleDateString("es-UY", { day: "numeric", month: "long", year: "numeric" }) : "—"}.
            El análisis lo genera un modelo de lenguaje sobre datos públicos y no lo revisa un
            analista antes de publicarse. Rendimientos pasados no garantizan resultados futuros.
            Esto es material general, no asesoramiento de inversión.
          </p>
        </div>
      </section>

      {/* ── Cierre ───────────────────────────────────────────── */}
      <section className="band-navy site-section">
        <div className="site-wrap">
          <div className="split-label">
            <div className="eyebrow-sm">Probalo</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "16em" }}>
                Cargá una acción y mirá qué dice.
              </h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "36em" }}>
                El análisis es gratis y no pedimos nada para leer uno ya hecho. Y si te interesa una
                acción, podés seguirla: te avisamos cuando cambie la calificación.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
                <Link href="/analisis" className="ui-btn ui-btn-on-navy">Analizar una acción</Link>
                <Link href="/contacto" className="ui-btn ui-btn-on-navy-ghost">Agendar una reunión</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        /* Tokens del gráfico, propios de esta página y NO los --pos/--neg de la
           casa. Motivo medido: el verde y el rojo institucionales dan una
           separación de 4,2 en deuteranopía (escala OKLab x100, piso recomendado
           8) — dos barras indistinguibles para buena parte de los varones. Este
           par teal/ladrillo da 11,7 y pasa banda de luminosidad, piso de croma y
           contraste. No se toca la paleta global: ahí el verde/rojo sí funciona
           porque nunca hay que distinguir dos colores entre si, sólo leer uno.
           El color es ADEMAS redundante: el lado de la línea del índice y el
           signo del número dicen lo mismo. */
        .rec-root {
          --rec-pos: #008B7A;
          --rec-neg: #AF2E20;
          /* Fallback: la posición real la inyecta el componente desde CERO_PCT,
             que es el mismo número con el que calcula la escala de las barras.
             Si alguna vez divergen, la línea del índice deja de coincidir con el
             origen de las barras — por eso sale de una sola constante. */
          --rec-cero: 46%;
        }

        .rec-fig { margin: 56px 0 0; }
        .rec-fig-t {
          font-family: var(--site-font); font-size: 17px; font-weight: 700;
          color: var(--site-ink);
        }
        .rec-fig-s {
          font-family: var(--site-font); font-size: 14px; color: var(--site-ink-3);
          margin-top: 5px;
        }
        .rec-chart { margin-top: 26px; display: flex; flex-direction: column; gap: 2px; }
        .rec-row {
          display: grid; grid-template-columns: 84px minmax(0, 1fr);
          align-items: center; gap: 16px;
        }
        .rec-row-lbl {
          font-family: var(--font-mono), monospace; font-size: 13px; letter-spacing: 0.06em;
          color: var(--site-ink); text-align: right;
        }
        .rec-track { position: relative; height: 34px; }
        /* Canaleta para las etiquetas de valor, a los dos lados del area de
           dibujo. Angosta en mobile, donde el carril entero mide ~320px. */
        .rec-plot { position: absolute; inset: 0 66px; }
        .rec-zero {
          position: absolute; left: var(--rec-cero); top: -3px; bottom: -3px; width: 1px;
          background: var(--site-border-2);
        }
        .rec-bar { position: absolute; top: 5px; height: 24px; }
        .rec-bar.is-pos { left: var(--rec-cero); background: var(--rec-pos); border-radius: 0 4px 4px 0; }
        .rec-bar.is-neg { right: calc(100% - var(--rec-cero)); background: var(--rec-neg); border-radius: 4px 0 0 4px; }
        .rec-bar-val {
          position: absolute; top: 50%; transform: translateY(-50%);
          font-family: var(--font-mono), monospace; font-size: 13.5px;
          font-variant-numeric: tabular-nums; color: var(--site-ink-2); white-space: nowrap;
        }
        .rec-bar.is-pos .rec-bar-val { left: calc(100% + 10px); }
        .rec-bar.is-neg .rec-bar-val { right: calc(100% + 10px); }
        .rec-axis { display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 16px; margin-top: 8px; }
        .rec-axis-line { position: relative; height: 18px; }
        .rec-axis-line .rec-plot { inset: 0 66px; }
        .rec-axis-line span {
          position: absolute; left: var(--rec-cero); transform: translateX(-50%);
          font-family: var(--font-mono), monospace; font-size: 11px; letter-spacing: 0.08em;
          text-transform: uppercase; color: var(--site-ink-3); white-space: nowrap;
        }

        .rec-tw { margin-top: 52px; overflow-x: auto; border-top: 1.5px solid var(--site-ink); }
        .rec-table { width: 100%; border-collapse: collapse; min-width: 640px; }
        .rec-table th {
          text-align: left; padding: 12px 14px 12px 0; font-family: var(--site-font);
          font-size: 12.5px; font-weight: 600; color: var(--site-ink-3);
          border-bottom: 1px solid var(--site-border); white-space: nowrap;
        }
        .rec-table th.r, .rec-table td.r {
          text-align: right; padding-right: 0; padding-left: 14px;
          font-family: var(--font-mono), monospace; font-variant-numeric: tabular-nums;
        }
        .rec-table td {
          padding: 16px 14px 16px 0; border-bottom: 1px solid var(--site-border);
          vertical-align: top; font-size: 14.5px; color: var(--site-ink-2);
        }
        .rec-rating {
          display: block; font-family: var(--font-mono), monospace; font-size: 14px;
          letter-spacing: 0.06em; color: var(--site-ink); font-weight: 600;
        }
        .rec-rating-dek {
          display: block; font-family: var(--site-font); font-size: 13px;
          color: var(--site-ink-3); margin-top: 4px; max-width: 34em;
        }

        .rec-lim {
          margin-top: 52px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0; border-top: 1px solid var(--site-border); border-left: 1px solid var(--site-border);
        }
        .rec-lim-col {
          padding: 26px 28px 28px; border-right: 1px solid var(--site-border);
          border-bottom: 1px solid var(--site-border);
        }
        .rec-lim-h {
          font-family: var(--font-mono), monospace; font-size: 11px; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--gold-deep);
        }
        .rec-lim-rows { margin-top: 18px; border-top: 1px solid var(--site-border); }
        .rec-lim-row {
          display: flex; justify-content: space-between; align-items: baseline; gap: 16px;
          padding: 11px 0; border-bottom: 1px solid var(--site-border);
          font-family: var(--site-font); font-size: 14.5px; color: var(--site-ink-2);
        }
        /* El baseline se lee como lo que es: la vara contra la que el objetivo
           pierde. Va en oro para que el ojo lo compare con el renglón de arriba. */
        .rec-lim-row.is-baseline { color: var(--gold-deep); }
        .rec-lim-row.is-baseline .rec-num { color: var(--gold-deep); }
        .rec-num {
          font-family: var(--font-mono), monospace; font-variant-numeric: tabular-nums;
          font-size: 15px; color: var(--site-ink);
        }
        .rec-lim-n { font-family: var(--site-font); font-size: 12.5px; color: var(--site-ink-3); margin: 14px 0 0; }

        .rec-metodo {
          margin-top: 52px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
          border-top: 1px solid var(--site-border); border-left: 1px solid var(--site-border);
        }
        .rec-metodo-item {
          padding: 24px 26px 26px; border-right: 1px solid var(--site-border);
          border-bottom: 1px solid var(--site-border);
        }
        .rec-metodo-t { font-family: var(--site-font); font-size: 15px; font-weight: 700; color: var(--site-ink); }
        .rec-metodo-b {
          font-family: var(--site-font); font-size: 14px; line-height: 1.6;
          color: var(--site-ink-2); margin: 8px 0 0;
        }

        @media (max-width: 900px) {
          .rec-metodo { grid-template-columns: 1fr; }
          .rec-lim { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .rec-row, .rec-axis { grid-template-columns: 52px minmax(0, 1fr); gap: 8px; }
          .rec-bar-val { font-size: 12px; }
          .rec-plot, .rec-axis-line .rec-plot { inset: 0 50px; }
        }
      `}</style>
    </main>
  );
}
