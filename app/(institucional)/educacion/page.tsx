import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import {
  GLOSARIO,
  GLOSARIO_CATEGORIAS,
  GUIAS,
  FAQ_EDUCACION,
} from "@/lib/educacion";
import { pageMetadata } from "@/lib/seo";
import { estaOculta } from "@/lib/paginasOcultas";

export const metadata: Metadata = pageMetadata({
  title: "Educación",
  description:
    "Centro educativo de Gastón Bengochea: glosario del mercado, guías para empezar a invertir y preguntas frecuentes, en lenguaje claro.",
  path: "/educacion",
});

export default function EducacionPage() {
  // 404 con el not-found de la casa mientras la sección siga listada en
  // lib/paginasOcultas.ts. Publicada = la guarda queda inerte.
  if (estaOculta("/educacion")) notFound();

  const glosarioPorCat = GLOSARIO_CATEGORIAS.map((cat) => ({
    categoria: cat,
    terminos: GLOSARIO.filter((t) => t.categoria === cat),
  })).filter((g) => g.terminos.length > 0);

  return (
    <main className="site">
      {/* Masthead editorial blanco — el navbar arranca claro sobre él (ver Navbar). */}
      <section className="band edu-hero">
        <div className="site-wrap">
          <Reveal as="div">
            <div className="kicker" style={{ color: "var(--gold-deep)" }}>Educación</div>
            <h1 className="t-display" style={{ marginTop: 20, color: "var(--site-ink)" }}>
              Invertir empieza por entender.
            </h1>
            <p className="t-lead" style={{ marginTop: 24, color: "var(--site-ink-2)", maxWidth: "34em" }}>
              Un glosario, algunas guías y las preguntas de siempre. Los conceptos del
              mercado en lenguaje claro — sin promesas ni jerga.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Glosario — definiciones sobre hairlines, agrupadas por categoría. */}
      <section id="glosario" className="band-muted site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Glosario</div>
            <div>
              <h2 className="t-h2">Los términos, en una línea.</h2>
              <p className="t-lead" style={{ marginTop: 16, maxWidth: "36em" }}>
                Los conceptos que más aparecen al invertir, definidos en simple. De la renta
                fija a la operativa de una casa de bolsa.
              </p>
            </div>
          </Reveal>

          <div className="edu-glosario">
            {glosarioPorCat.map((grupo) => (
              <div key={grupo.categoria} className="edu-cat">
                <h3 className="edu-cat-head">{grupo.categoria}</h3>
                <Stagger as="div" className="edu-terminos">
                  {grupo.terminos.map((t) => (
                    <StaggerItem as="div" key={t.termino} className="edu-termino">
                      <div className="edu-term-t">{t.termino}</div>
                      <div className="edu-term-d">{t.definicion}</div>
                    </StaggerItem>
                  ))}
                </Stagger>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Guías — lecturas cortas para empezar. */}
      <section className="band site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Guías</div>
            <div>
              <h2 className="t-h2">Tres lecturas para empezar.</h2>
              <p className="t-lead" style={{ marginTop: 16, maxWidth: "36em" }}>
                Lo esencial antes de dar el primer paso, contado sin vueltas.
              </p>
            </div>
          </Reveal>

          <div className="edu-guias">
            {GUIAS.map((g, i) => (
              <Reveal as="article" key={g.titulo} className="edu-guia" delay={i * 0.05}>
                <span className="edu-guia-num">{String(i + 1).padStart(2, "0")}</span>
                <div className="edu-guia-body">
                  <h3 className="t-h3">{g.titulo}</h3>
                  {g.cuerpo.map((p, j) => (
                    <p key={j} className="t-body" style={{ marginTop: j === 0 ? 16 : 12, marginBottom: 0 }}>
                      {p}
                    </p>
                  ))}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ — acordeón nativo <details>, sin JS de cliente. */}
      <section className="band-muted site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Preguntas frecuentes</div>
            <div>
              <h2 className="t-h2">Lo que se pregunta seguido.</h2>
              <p className="t-lead" style={{ marginTop: 16, maxWidth: "36em" }}>
                Las dudas más comunes de quien está empezando. Si la tuya no está acá,
                escribinos.
              </p>
            </div>
          </Reveal>

          <div className="edu-faq">
            {FAQ_EDUCACION.map((f) => (
              <details key={f.pregunta} className="edu-faq-item">
                <summary className="edu-faq-q">
                  <span>{f.pregunta}</span>
                  <span className="edu-faq-mark" aria-hidden="true" />
                </summary>
                <div className="edu-faq-a">
                  <p className="t-body" style={{ margin: 0, maxWidth: "48em" }}>{f.respuesta}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA de cierre — banda navy. */}
      <section className="band-navy site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Asesoramiento</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "15em" }}>
                Entender es el principio. Después, una conversación.
              </h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "38em" }}>
                El glosario y las guías son un punto de partida general. Para tu caso concreto,
                la mejor respuesta sigue siendo hablar con un asesor nuestro.
              </p>
              <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
                <Link href="/contacto" className="ui-btn ui-btn-on-navy">Agendá una reunión</Link>
                <Link href="/informes" className="ui-btn ui-btn-on-navy-ghost">Leé los informes</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <style>{`
        .edu-hero {
          padding-top: calc(var(--nav-h) + clamp(44px, 7vw, 92px));
          padding-bottom: clamp(40px, 5vw, 68px);
        }

        /* Glosario: cada categoría abre con una regla fuerte (masthead) y su
           nombre; debajo, term | definición sobre hairlines. */
        .edu-glosario { margin-top: clamp(48px, 6vw, 80px); }
        .edu-cat + .edu-cat { margin-top: clamp(40px, 5vw, 64px); }
        .edu-cat-head {
          font-size: clamp(15px, 1.6vw, 17px);
          font-weight: 600;
          letter-spacing: 0.01em;
          color: var(--site-ink);
          margin: 0 0 4px;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--ink);
        }
        .edu-termino {
          display: grid;
          grid-template-columns: minmax(160px, 260px) minmax(0, 1fr);
          gap: clamp(16px, 3vw, 48px);
          padding: 20px 0;
          align-items: baseline;
        }
        .edu-terminos > div + div { border-top: 1px solid var(--site-border); }
        .edu-term-t {
          font-size: 16px;
          font-weight: 600;
          letter-spacing: -0.005em;
          color: var(--site-ink);
        }
        .edu-term-d {
          margin: 0;
          font-size: 15.5px;
          line-height: 1.55;
          color: var(--site-ink-2);
        }

        /* Guías: fila con número dorado callado + cuerpo, hairline entre guías. */
        .edu-guias { margin-top: clamp(48px, 6vw, 80px); }
        .edu-guia {
          display: grid;
          grid-template-columns: 64px minmax(0, 1fr);
          gap: clamp(16px, 3vw, 40px);
          padding: clamp(28px, 3.5vw, 40px) 0;
          align-items: start;
        }
        .edu-guia + .edu-guia { border-top: 1px solid var(--site-border); }
        .edu-guia:first-child { padding-top: 0; }
        .edu-guia-num {
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--gold-deep);
          font-variant-numeric: tabular-nums;
          padding-top: 6px;
        }
        .edu-guia-body { max-width: 46em; }

        /* FAQ: acordeón nativo. Hairline entre ítems, chevron que rota al abrir. */
        .edu-faq {
          margin-top: clamp(48px, 6vw, 80px);
          border-top: 1px solid var(--ink);
        }
        .edu-faq-item { border-bottom: 1px solid var(--site-border); }
        .edu-faq-q {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 22px 0;
          cursor: pointer;
          list-style: none;
          font-size: clamp(16px, 1.9vw, 19px);
          font-weight: 500;
          letter-spacing: -0.01em;
          color: var(--site-ink);
        }
        .edu-faq-q::-webkit-details-marker { display: none; }
        .edu-faq-q:hover { color: var(--navy); }
        .edu-faq-mark {
          position: relative;
          flex: none;
          width: 14px;
          height: 14px;
        }
        /* Cruz → guión: el trazo vertical se desvanece al abrir (＋ pasa a −). */
        .edu-faq-mark::before,
        .edu-faq-mark::after {
          content: "";
          position: absolute;
          background: var(--gold-deep);
          transition: opacity 200ms ease, transform 200ms ease;
        }
        .edu-faq-mark::before { top: 6px; left: 0; width: 14px; height: 1.5px; }
        .edu-faq-mark::after { left: 6px; top: 0; width: 1.5px; height: 14px; }
        .edu-faq-item[open] .edu-faq-mark::after { opacity: 0; transform: scaleY(0); }
        .edu-faq-a { padding: 0 0 24px; }
        .edu-faq-a .t-body { color: var(--site-ink-2); }

        @media (prefers-reduced-motion: reduce) {
          .edu-faq-mark::before, .edu-faq-mark::after { transition: none; }
        }

        @media (max-width: 720px) {
          .edu-termino { grid-template-columns: 1fr; gap: 6px; padding: 18px 0; }
          .edu-guia { grid-template-columns: 1fr; gap: 8px; }
          .edu-guia-num { padding-top: 0; }
        }
      `}</style>
    </main>
  );
}
