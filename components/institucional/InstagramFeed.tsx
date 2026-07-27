"use client";

import { Reveal } from "@/components/motion";
import { ArrowRight } from "@/components/institucional/icons";
import { useInstagram, fmtFechaPost } from "@/lib/useInstagram";

// Módulo "Novedades" — los últimos posteos de @bengochea_inversiones traídos por
// /api/instagram, presentados como una LISTA DE NOTICIAS (filas editoriales:
// miniatura + titular + fecha + flecha, sobre hairlines) en el lenguaje de la
// casa, calcando el archivo de /informes. No es una galería social. Si todavía
// no hay posteos cacheados, el módulo NO aparece (estado vacío honesto). Pensado
// para vivir dentro de una página `.site`.

const PROFILE_URL = "https://www.instagram.com/bengochea_inversiones/";
const HANDLE = "@bengochea_inversiones";

/* Mismo glifo que FooterInstitucional, para que el ícono social sea uno solo. */
function IgGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

/** Titular = primera línea no vacía del epígrafe (los captions suelen abrir con el título). */
function headlineOf(caption: string | null): string {
  if (!caption) return "Publicación en Instagram";
  const first = caption.split("\n").map((s) => s.trim()).find(Boolean);
  return first || "Publicación en Instagram";
}

export function InstagramFeed({
  count = 3,
  variant = "band",
  hideWhenEmpty = true,
}: {
  count?: number;
  /** Banda de la sección, para alternar ABAB según dónde se monte. */
  variant?: "band" | "band-muted";
  /** true (default): el módulo desaparece si no hay posteos (para embeber en otra
   *  página). false: muestra el encabezado siempre + un estado vacío honesto
   *  (para la página dedicada /novedades). */
  hideWhenEmpty?: boolean;
}) {
  const state = useInstagram();
  const posts = state.kind === "ready" ? state.posts.slice(0, count) : [];
  const hasPosts = posts.length > 0;

  // Embebido: si no hay posteos, el módulo no aparece. En la página dedicada
  // (hideWhenEmpty=false) el encabezado queda y mostramos un vacío honesto.
  if (!hasPosts && hideWhenEmpty) return null;

  return (
    <section className={`${variant} site-section`}>
      <div className="site-wrap">
        <Reveal className="split-label">
          <div className="eyebrow-sm">Novedades</div>
          <div>
            <h2 className="t-h2">Nuestro día a día.</h2>
            <p className="t-lead" style={{ marginTop: 20, maxWidth: "32em" }}>
              Lo último que compartimos en{" "}
              <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" className="ig-handle">
                {HANDLE}
              </a>
              .
            </p>
            <a
              href={PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="link-arrow"
              style={{ marginTop: 24 }}
            >
              <span className="ig-follow-glyph"><IgGlyph /></span>
              Seguinos en Instagram <ArrowRight />
            </a>
          </div>
        </Reveal>

        {hasPosts ? (
          <div className="ig-news">
            {posts.map((p) => {
              const title = headlineOf(p.caption);
              const fecha = p.takenAt ? fmtFechaPost(p.takenAt) : "";
              return (
                <a
                  key={p.id}
                  href={p.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ig-news-row"
                  aria-label={`Leer en Instagram: ${title}`}
                >
                  <span className="ig-news-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image} alt="" loading="lazy" decoding="async" />
                  </span>
                  <span className="ig-news-body">
                    <span className="ig-news-title">{title}</span>
                    {fecha ? <span className="ig-news-date">{fecha}</span> : null}
                  </span>
                  <span className="ig-news-arrow" aria-hidden><ArrowRight /></span>
                </a>
              );
            })}
          </div>
        ) : state.kind === "loading" ? null : (
          <p className="ig-news-empty">
            Todavía no hay novedades para mostrar acá. Seguinos en{" "}
            <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" className="ig-handle">Instagram</a>{" "}
            y no te perdés nada.
          </p>
        )}
      </div>

      <style>{`
        .ig-handle { color: var(--gold-deep); font-style: normal; text-decoration: none; }
        .ig-handle:hover { text-decoration: underline; text-underline-offset: 3px; }
        .ig-follow-glyph { display: inline-flex; align-items: center; color: var(--gold-deep); margin-right: 9px; }

        /* Lista de novedades: apertura con regla fuerte + divisores hairline
           (regla de dos pesos), como el archivo de /informes. */
        .ig-news {
          margin-top: clamp(32px, 4vw, 52px);
          border-top: 1px solid var(--site-ink);
        }
        .ig-news-row {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: clamp(18px, 2.4vw, 32px);
          padding: clamp(18px, 2.2vw, 26px) 0;
          border-bottom: 1px solid var(--site-border);
          text-decoration: none;
          color: inherit;
        }
        .ig-news-thumb {
          width: clamp(76px, 9vw, 108px);
          aspect-ratio: 1 / 1;
          overflow: hidden;
          border: 1px solid var(--site-border);
          background: var(--ivory-warm);
          transition: border-color 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ig-news-thumb img {
          width: 100%; height: 100%; object-fit: cover; display: block;
          transform: scale(1.001);
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ig-news-body { min-width: 0; }
        .ig-news-title {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          font-size: clamp(17px, 1.55vw, 21px);
          line-height: 1.35;
          letter-spacing: -0.01em;
          color: var(--site-ink);
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ig-news-date {
          display: block;
          margin-top: 10px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--site-ink-3);
        }
        .ig-news-arrow {
          color: var(--gold-deep);
          display: inline-flex;
          align-items: center;
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ig-news-row:hover .ig-news-title { transform: translateX(6px); }
        .ig-news-row:hover .ig-news-arrow { transform: translateX(4px); }
        .ig-news-row:hover .ig-news-thumb { border-color: var(--gold-deep); }
        .ig-news-row:hover .ig-news-thumb img { transform: scale(1.05); }

        .ig-news-empty {
          margin-top: clamp(28px, 4vw, 44px);
          padding-top: 22px;
          border-top: 1px solid var(--site-ink);
          font-size: clamp(17px, 1.4vw, 20px);
          line-height: 1.6;
          color: var(--site-ink-2);
          max-width: 34em;
        }

        @media (max-width: 560px) {
          .ig-news-row { gap: 16px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ig-news-title, .ig-news-arrow, .ig-news-thumb, .ig-news-thumb img { transition: none; }
          .ig-news-row:hover .ig-news-title,
          .ig-news-row:hover .ig-news-arrow { transform: none; }
          .ig-news-row:hover .ig-news-thumb img { transform: none; }
        }
      `}</style>
    </section>
  );
}
