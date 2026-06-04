import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ArrowRight } from "@/components/institucional/icons";
import { SECTORES, SECTOR_SLUGS, SECTOR_TOTAL } from "./data";

type Params = { params: Promise<{ sector: string }> };

export function generateStaticParams() {
  return SECTOR_SLUGS.map((sector) => ({ sector }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { sector } = await params;
  const s = SECTORES[sector];
  if (!s) return {};
  return {
    title: `${s.label} · Oportunidades · Bengochea & Cía.`,
    description: s.standfirst,
  };
}

const total = String(SECTOR_TOTAL).padStart(2, "0");

/** Encabezado de sección del dossier — índice + eyebrow a la izquierda, título + dek a la derecha. */
function SectionHead({ num, kicker, title, dek }: { num: string; kicker: string; title: string; dek: string }) {
  return (
    <Reveal as="div" className="dsec-head">
      <div className="dsec-head-l">
        <span className="mono dsec-num">{num} / {total}</span>
        <span className="cap-gold">{kicker}</span>
      </div>
      <div className="dsec-head-r">
        <h2 className="t-h2">{title}</h2>
        <p className="t-lead dsec-dek">{dek}</p>
      </div>
    </Reveal>
  );
}

export default async function SectorPage({ params }: Params) {
  const { sector } = await params;
  const s = SECTORES[sector];
  if (!s) notFound();

  const otros = SECTOR_SLUGS.filter((k) => k !== sector).map((k) => SECTORES[k]);

  return (
    <main className="site dossier">
      {/* ── Masthead ─────────────────────────────────────────── */}
      <header className="band-navy dossier-hero">
        <div className="site-wrap">
          <div className="dossier-hero-grid">
            <Reveal as="div" className="dossier-hero-copy">
              <div className="dossier-index mono">
                <span>Oportunidades</span>
                <span className="dossier-index-dot" aria-hidden />
                <span>Sector {s.num} / {total}</span>
              </div>

              <h1 className="t-display dossier-title">{s.title}</h1>

              <p className="t-lead dossier-standfirst">{s.standfirst}</p>

              <div className="dossier-cta">
                <Link href="/contacto" className="ui-btn ui-btn-on-navy">Agendá una reunión</Link>
                <a href="#tesis" className="ui-btn ui-btn-on-navy-ghost">Leer la tesis</a>
              </div>
            </Reveal>

            <Reveal as="div" className="dossier-hero-fig" delay={0.12}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.hero} alt={`Sector ${s.label}`} />
              <span className="dossier-fig-tag mono">{s.label}</span>
            </Reveal>
          </div>

          {/* Ficha — datos cualitativos del sector */}
          <Stagger as="dl" className="dossier-ficha">
            {s.ficha.map(([label, value]) => (
              <StaggerItem as="div" key={label} className="dossier-ficha-cell">
                <dt className="cap dossier-ficha-label">{label}</dt>
                <dd className="dossier-ficha-value">{value}</dd>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </header>

      {/* ── 01 · La tesis ────────────────────────────────────── */}
      <section id="tesis" className="band site-section">
        <div className="site-wrap dossier-thesis">
          <div className="dossier-thesis-aside">
            <Reveal as="div">
              <span className="cap-gold">La tesis</span>
              <span className="dossier-bignum">{s.num}</span>
            </Reveal>
          </div>

          <Reveal as="div" className="dossier-thesis-body">
            <p className="dossier-dek">{s.tesis.dek}</p>
            {s.tesis.paras.map((p, i) => (
              <p key={i} className={i === 0 ? "dossier-prose dossier-prose-lead" : "dossier-prose"}>{p}</p>
            ))}

            <blockquote className="dossier-quote">
              <p>{s.tesis.quote}</p>
              <footer className="cap-gold">La mesa de Bengochea &amp; Cía.</footer>
            </blockquote>
          </Reveal>
        </div>
      </section>

      {/* ── 02 · Fuerzas estructurales ──────────────────────── */}
      <section className="band-muted site-section">
        <div className="site-wrap">
          <SectionHead num="02" kicker="Fuerzas estructurales" title="Qué mueve al sector." dek={s.drivers.dek} />

          <Stagger as="ol" className="dossier-forces">
            {s.drivers.items.map((it, i) => (
              <StaggerItem as="li" key={it.title} className="dossier-force">
                <span className="mono dossier-force-num">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="t-h3 dossier-force-title">{it.title}</h3>
                <p className="t-body dossier-force-body">{it.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ── 03 · El universo invertible ─────────────────────── */}
      <section className="band site-section">
        <div className="site-wrap">
          <SectionHead num="03" kicker="El universo invertible" title="Dónde está el valor del sector." dek={s.segmentos.dek} />

          <Stagger as="div" className="dossier-segments">
            {s.segmentos.items.map((seg, i) => (
              <StaggerItem as="div" key={seg.name} className="dossier-seg">
                <span className="mono dossier-seg-idx">S.{String(i + 1).padStart(2, "0")}</span>
                <h3 className="t-h4 dossier-seg-name">{seg.name}</h3>
                <p className="t-small dossier-seg-body">{seg.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ── 04 · Cómo se accede ─────────────────────────────── */}
      <section className="band-muted site-section">
        <div className="site-wrap">
          <div className="split">
            <div className="dossier-sticky">
              <Reveal as="div">
                <span className="mono dsec-num">04 / {total}</span>
                <span className="cap-gold" style={{ display: "block", marginTop: 10 }}>Cómo se accede</span>
                <h2 className="t-h2" style={{ marginTop: 18 }}>Los vehículos, desde Montevideo.</h2>
                <p className="t-lead" style={{ marginTop: 18, maxWidth: "30em" }}>{s.vehiculos.dek}</p>
                <Link href="/servicios" className="link-arrow" style={{ marginTop: 28 }}>
                  Ver el ecosistema completo <ArrowRight />
                </Link>
              </Reveal>
            </div>

            <Reveal as="div" className="ui-list">
              {s.vehiculos.items.map((it) => (
                <div key={it.title} className="ui-list-row">
                  <span style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <span className="list-icon" aria-hidden>{it.icon}</span>
                    <span>
                      <span className="row-title">{it.title}</span>
                      <span className="row-desc" style={{ display: "block" }}>{it.body}</span>
                    </span>
                  </span>
                </div>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 05 · Lo que conviene mirar + cierre ─────────────── */}
      <section className="band-navy site-section">
        <div className="site-wrap">
          <SectionHead num="05" kicker="A tener en cuenta" title="Lo que ponemos sobre la mesa." dek={s.consideraciones.dek} />

          <Stagger as="div" className="dossier-risks">
            {s.consideraciones.items.map((it, i) => (
              <StaggerItem as="div" key={it.title} className="dossier-risk">
                <span className="mono dossier-risk-num">R.{String(i + 1).padStart(2, "0")}</span>
                <h3 className="t-h4" style={{ marginTop: 14 }}>{it.title}</h3>
                <p className="t-body" style={{ marginTop: 10, marginBottom: 0 }}>{it.body}</p>
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal as="div" className="dossier-close">
            <hr className="rule-on-navy" />
            <div className="dossier-close-grid">
              <p className="t-h3 dossier-close-line">
                La visión de la mesa, aplicada a tu cartera.
              </p>
              <div className="dossier-close-cta">
                <Link href="/contacto" className="ui-btn ui-btn-on-navy">Conversemos sobre tu cartera</Link>
              </div>
            </div>
            <p className="t-small dossier-disclaimer">
              Esta información tiene fines educativos y no constituye una recomendación de inversión.
              Toda decisión se evalúa caso a caso en función de los objetivos, el horizonte y el perfil
              de riesgo de cada inversor.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Otros sectores ──────────────────────────────────── */}
      <section className="band site-section">
        <div className="site-wrap">
          <Reveal as="div" className="dsec-head">
            <div className="dsec-head-l">
              <span className="mono dsec-num">Índice</span>
              <span className="cap-gold">Otros sectores</span>
            </div>
            <div className="dsec-head-r">
              <h2 className="t-h2">Seguí explorando dónde invertir.</h2>
            </div>
          </Reveal>

          <Stagger as="div" className="dossier-index-list">
            {otros.map((o) => (
              <StaggerItem as="div" key={o.slug}>
                <Link href={`/oportunidades/${o.slug}`} className="dossier-index-row">
                  <span className="mono dossier-index-row-num">{o.num}</span>
                  <span className="dossier-index-row-name t-h3">{o.label}</span>
                  <span className="dossier-index-row-desc t-small">{o.standfirst}</span>
                  <span className="dossier-index-row-arrow" aria-hidden><ArrowRight /></span>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <style>{`
        .dossier { --dossier-gold: var(--gold-soft); }

        /* ── Masthead ── */
        .dossier-hero {
          padding-top: calc(var(--nav-h) + clamp(48px, 7vw, 96px));
          padding-bottom: clamp(40px, 5vw, 64px);
        }
        .dossier-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
          gap: clamp(28px, 5vw, 72px);
          align-items: end;
        }
        .dossier-index {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--gold-soft);
        }
        .dossier-index-dot {
          width: 4px; height: 4px; border-radius: 999px;
          background: var(--gold);
        }
        .dossier-title {
          margin-top: 26px;
          color: #fff;
          max-width: 13ch;
        }
        .dossier-standfirst {
          margin-top: 26px;
          max-width: 34em;
          color: rgba(255,255,255,0.82) !important;
        }
        .dossier-cta { display: flex; gap: 12px; margin-top: 34px; flex-wrap: wrap; }
        .dossier-hero-fig {
          position: relative;
          aspect-ratio: 4 / 5;
          border-radius: var(--r-card);
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.14);
          isolation: isolate;
        }
        .dossier-hero-fig img {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;
        }
        .dossier-hero-fig::after {
          content: "";
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(15,34,73,0.05) 0%, transparent 45%, rgba(15,34,73,0.55) 100%);
        }
        .dossier-fig-tag {
          position: absolute;
          left: 16px; bottom: 14px;
          z-index: 2;
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #fff;
        }

        /* Ficha */
        .dossier-ficha {
          margin: clamp(44px, 5vw, 68px) 0 0;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-top: 1px solid rgba(255,255,255,0.22);
        }
        .dossier-ficha-cell {
          padding: 22px 24px 4px 0;
          border-right: 1px solid rgba(255,255,255,0.14);
        }
        .dossier-ficha-cell:last-child { border-right: 0; }
        .dossier-ficha-label { color: rgba(255,255,255,0.5) !important; }
        .dossier-ficha-value {
          margin: 10px 0 0;
          font-size: clamp(18px, 1.7vw, 22px);
          font-weight: 400;
          letter-spacing: -0.01em;
          color: #fff;
        }

        /* ── La tesis ── */
        .dossier-thesis {
          display: grid;
          grid-template-columns: minmax(0, 0.36fr) minmax(0, 1fr);
          gap: clamp(28px, 5vw, 80px);
          align-items: start;
        }
        .dossier-thesis-aside { position: sticky; top: calc(var(--nav-h) + 28px); }
        .dossier-bignum {
          display: block;
          margin-top: 12px;
          font-size: clamp(72px, 11vw, 132px);
          line-height: 0.9;
          font-weight: 300;
          letter-spacing: -0.04em;
          color: var(--site-border-2);
        }
        .dossier-dek {
          font-size: clamp(22px, 2.6vw, 32px);
          line-height: 1.28;
          letter-spacing: -0.02em;
          color: var(--site-ink);
          margin: 0 0 28px;
          max-width: 20ch;
          font-weight: 400;
        }
        .dossier-prose {
          font-size: 17px;
          line-height: 1.72;
          color: var(--site-ink-2);
          margin: 0 0 20px;
          max-width: 40em;
        }
        .dossier-prose-lead {
          font-size: 19px;
          color: var(--site-ink);
        }
        .dossier-quote {
          margin: 38px 0 0;
          padding: 4px 0 4px 28px;
          border-left: 2px solid var(--gold);
          max-width: 34em;
        }
        .dossier-quote p {
          font-size: clamp(19px, 2vw, 24px);
          line-height: 1.4;
          letter-spacing: -0.015em;
          color: var(--site-ink);
          margin: 0;
        }
        .dossier-quote footer { margin-top: 16px; }

        /* ── Encabezado de sección ── */
        .dsec-head {
          display: grid;
          grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.5fr);
          gap: clamp(24px, 5vw, 72px);
          align-items: start;
        }
        .dsec-head-l { display: flex; flex-direction: column; gap: 12px; }
        .dsec-num {
          font-size: 12px;
          letter-spacing: 0.1em;
          color: var(--site-ink-3);
        }
        .band-navy .dsec-num { color: rgba(255,255,255,0.5); }
        .dsec-dek { margin-top: 18px; max-width: 34em; }

        /* ── Fuerzas estructurales ── */
        .dossier-forces {
          list-style: none;
          margin: clamp(40px, 5vw, 60px) 0 0;
          padding: 0;
          border-top: 1px solid var(--site-border);
        }
        .dossier-force {
          display: grid;
          grid-template-columns: 64px minmax(0, 0.9fr) minmax(0, 1.4fr);
          gap: clamp(16px, 3vw, 40px);
          align-items: baseline;
          padding: clamp(24px, 3vw, 36px) 0;
          border-bottom: 1px solid var(--site-border);
        }
        .dossier-force-num { font-size: 14px; color: var(--gold-deep); padding-top: 4px; }
        .dossier-force-title { margin: 0; }
        .dossier-force-body { margin: 0; }

        /* ── Universo invertible ── */
        .dossier-segments {
          margin: clamp(40px, 5vw, 60px) 0 0;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border-top: 1px solid var(--site-border);
          border-left: 1px solid var(--site-border);
        }
        .dossier-seg {
          padding: 28px 26px 32px;
          border-right: 1px solid var(--site-border);
          border-bottom: 1px solid var(--site-border);
        }
        .dossier-seg-idx { font-size: 12px; color: var(--gold-deep); letter-spacing: 0.08em; }
        .dossier-seg-name { margin: 14px 0 0; }
        .dossier-seg-body { margin: 10px 0 0; }

        /* ── Cómo se accede ── */
        .dossier-sticky { position: sticky; top: calc(var(--nav-h) + 24px); align-self: start; }

        /* ── Riesgos + cierre (navy) ── */
        .dossier-risks {
          margin: clamp(40px, 5vw, 56px) 0 0;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .dossier-risk {
          padding: 28px 26px 30px;
          border: 1px solid rgba(255,255,255,0.16);
          border-radius: var(--r-card);
        }
        .dossier-risk-num { font-size: 12px; color: var(--gold-soft); letter-spacing: 0.08em; }
        .dossier-close { margin-top: clamp(48px, 6vw, 72px); }
        .dossier-close-grid {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 28px;
          flex-wrap: wrap;
          margin-top: 32px;
        }
        .dossier-close-line { color: #fff; margin: 0; max-width: 16ch; }
        .dossier-disclaimer { margin-top: 32px; max-width: 46em; color: rgba(255,255,255,0.55) !important; }

        /* ── Otros sectores ── */
        .dossier-index-list {
          margin-top: clamp(36px, 4vw, 52px);
          border-top: 1px solid var(--site-border);
        }
        .dossier-index-row {
          display: grid;
          grid-template-columns: 56px minmax(0, 0.7fr) minmax(0, 1.4fr) auto;
          gap: clamp(16px, 3vw, 36px);
          align-items: center;
          padding: clamp(22px, 2.6vw, 32px) 8px;
          border-bottom: 1px solid var(--site-border);
          transition: background 0.4s ease, padding-left 0.4s cubic-bezier(0.16,1,0.3,1);
        }
        .dossier-index-row:hover {
          background: var(--surface-muted);
          padding-left: 18px;
        }
        .dossier-index-row-num { font-size: 13px; color: var(--gold-deep); }
        .dossier-index-row-name { margin: 0; }
        .dossier-index-row-desc { margin: 0; }
        .dossier-index-row-arrow { color: var(--site-ink-3); display: inline-flex; }
        .dossier-index-row:hover .dossier-index-row-arrow { color: var(--gold-deep); }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .dossier-hero-grid { grid-template-columns: 1fr; align-items: start; }
          .dossier-hero-fig { aspect-ratio: 16 / 10; order: -1; }
          .dossier-ficha { grid-template-columns: 1fr 1fr; }
          .dossier-ficha-cell:nth-child(2) { border-right: 0; }
          .dossier-thesis { grid-template-columns: 1fr; }
          .dossier-thesis-aside { position: static; display: flex; align-items: baseline; gap: 20px; }
          .dossier-bignum { margin-top: 0; font-size: 72px; }
          .dsec-head { grid-template-columns: 1fr; gap: 20px; }
          .dossier-force { grid-template-columns: 40px 1fr; }
          .dossier-force-body { grid-column: 2; }
          .dossier-segments { grid-template-columns: 1fr 1fr; }
          .dossier-risks { grid-template-columns: 1fr; }
          .dossier-index-row { grid-template-columns: 40px 1fr auto; }
          .dossier-index-row-desc { display: none; }
        }
        @media (max-width: 560px) {
          .dossier-ficha { grid-template-columns: 1fr; }
          .dossier-ficha-cell { border-right: 0; border-bottom: 1px solid rgba(255,255,255,0.14); padding-right: 0; }
          .dossier-segments { grid-template-columns: 1fr; }
          .dossier-close-grid { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </main>
  );
}
