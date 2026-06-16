import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion";
import { SplitText, ClipReveal } from "@/components/scroll";
import {
  Scales, Layers, Globe, Building, TrendingUp, FileDown, ArrowRight,
} from "@/components/institucional/icons";
import { FondoHero } from "@/components/institucional/FondoHero";
import { FondoNav } from "@/components/institucional/FondoNav";
import { FondoPerformance } from "@/components/institucional/FondoPerformance";
import { FondoCalculadora } from "@/components/institucional/FondoCalculadora";
import { FondoFAQ } from "@/components/institucional/FondoFAQ";
import { FondoTenencias } from "@/components/institucional/FondoTenencias";
import { FondoGeografia } from "@/components/institucional/FondoGeografia";
import { FONDO } from "@/lib/fondo";

export const metadata: Metadata = {
  title: "BNG Selección Global · Bengochea & Cía.",
  description:
    "BNG Selección Global: estrategia diversificada, con exposición a renta variable y fija a nivel global, domiciliada en Uruguay. Estrategia, performance y documentos.",
};

const Check = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const CARACTERISTICAS: string[] = [
  "Una sola posición para una cartera diversificada y global.",
  "Combina renta variable y renta fija en un perfil balanceado.",
  "Invierte a través de fondos gestionados por managers especializados.",
  "Estructurado en Uruguay y operado por una sociedad de bolsa regulada por el BCU.",
];

const ESTRATEGIA: { icon: ReactNode; title: string; body: string }[] = [
  { icon: <Scales />, title: "Cartera balanceada", body: "Combina renta variable y renta fija en un mismo vehículo, buscando un equilibrio entre crecimiento y estabilidad según el contexto de mercado." },
  { icon: <Layers />, title: "Selección de fondos", body: "Invierte a través de una selección de fondos gestionados por managers especializados, sumando diversificación y gestión profesional en cada clase de activo." },
  { icon: <Globe />, title: "Exposición global", body: "Acceso a mercados de todo el mundo desde un solo producto, sin tener que seleccionar y rebalancear instrumentos uno por uno." },
  { icon: <Building />, title: "Domiciliado en Uruguay", body: "Estructurado localmente y operado por Gastón Bengochea, sociedad de bolsa regulada por el Banco Central del Uruguay." },
];

const DOCUMENTOS: { titulo: string; desc: string }[] = [
  { titulo: "Ficha técnica", desc: "Resumen mensual del fondo: objetivo, cartera y datos clave." },
  { titulo: "Datos fundamentales para el inversor", desc: "Documento con el perfil de riesgo, costos y características esenciales." },
  { titulo: "Reglamento de gestión", desc: "Marco legal del fondo: política de inversión, suscripción y rescate." },
  { titulo: "Informe de cartera", desc: "Composición de la cartera y comentario de gestión del período." },
];

export default function FondoPage() {
  return (
    <main className="site fondo-page">
      {/* ── Header data-rich: claim editorial + cotización viva ───────── */}
      <FondoHero />

      {/* ── Nav interna sticky con anclas (patrón Vontobel/SSGA) ──────── */}
      <FondoNav />

      {/* ── Resumen: estrategia + características ─────────────────────── */}
      <section id="resumen" className="band site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Estrategia de inversión</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "16em" }}>
                Una estrategia global y diversificada, en un solo vehículo.
              </h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "36em" }}>{FONDO.objetivo}</p>
            </div>
          </Reveal>
          <Reveal as="div" style={{ marginTop: 44 }}>
            <ul className="resumen-feats">
              {CARACTERISTICAS.map((c) => (
                <li key={c}>
                  <span className="resumen-check" aria-hidden><Check /></span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ── Estrategia ────────────────────────────────────────────── */}
      <section id="estrategia" className="band-muted site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Cómo invierte</div>
            <div>
              <SplitText text="Muchos fondos. Una sola cartera." as="h2" className="t-h2" style={{ maxWidth: "16em" }} />
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                El fondo selecciona y combina fondos de managers especializados: piezas distintas
                que encajan en una única cartera diversificada y global.
              </p>
            </div>
          </Reveal>

          <div className="estrategia-grid">
            {ESTRATEGIA.map((it) => (
              <ClipReveal key={it.title} from="bottom" className="estrategia-cell">
                <span className="feat-icon" aria-hidden>{it.icon}</span>
                <h3 className="t-h4" style={{ marginTop: 18 }}>{it.title}</h3>
                <p className="t-body" style={{ marginTop: 10, marginBottom: 0 }}>{it.body}</p>
              </ClipReveal>
            ))}
          </div>

          {/* Mayores tenencias — comparación de estilo (datos ilustrativos) */}
          <FondoTenencias />

          {/* Exposición geográfica — choropleth de puntos (datos ilustrativos) */}
          <FondoGeografia />
        </div>
      </section>

      {/* ── Performance ───────────────────────────────────────────── */}
      <section id="performance" className="band site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Rendimientos</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "16em" }}>El estado del fondo, al día.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                Valor cuota, rendimientos acumulados, por año calendario y estadísticas de la serie,
                con actualización diaria.
              </p>
            </div>
          </Reveal>
          <div style={{ marginTop: 48 }}><FondoPerformance /></div>
        </div>
      </section>

      {/* ── Calculadora de inversión ──────────────────────────────── */}
      <section id="calculadora" className="band-muted site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Calculadora</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "16em" }}>Proyectá una inversión en el tiempo.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                Configurá monto inicial, aporte periódico y horizonte para ver el efecto del
                interés compuesto, aplicando el retorno promedio del fondo desde su inicio.
                Las cifras son indicativas y asumen rendimiento constante — no una promesa
                del fondo.
              </p>
            </div>
          </Reveal>
          <div style={{ marginTop: 48 }}>
            <FondoCalculadora />
          </div>
        </div>
      </section>

      {/* ── Cartera · estructura (cualitativa, sin cifras inventadas) ── */}
      <section id="cartera" className="band site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Cartera</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "16em" }}>Cómo está construida.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                Un fondo balanceado combina dos clases de activo. Cada una se accede a través de
                una selección de fondos de terceros.
              </p>
            </div>
          </Reveal>

          <div className="cartera-grid">
            {FONDO.cartera.sleeves.map((s, i) => (
              <ClipReveal key={s.clave} from="bottom" className="cartera-cell">
                <div className="cartera-cell-top">
                  <span className="feat-icon" aria-hidden>{i === 0 ? <TrendingUp /> : <Scales />}</span>
                  <span className="cartera-tag">Clase de activo · {String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="t-h4" style={{ marginTop: 18 }}>{s.clave}</h3>
                <p className="t-body" style={{ marginTop: 10, marginBottom: 0 }}>{s.desc}</p>
              </ClipReveal>
            ))}
          </div>
          <p className="cartera-nota">{FONDO.cartera.nota}</p>
        </div>
      </section>

      {/* ── Perfil del inversor (compacto) ────────────────────────── */}
      <section id="perfil" className="band-muted site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Perfil del inversor</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "16em" }}>¿Para quién tiene sentido?</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "38em" }}>
                Es un producto pensado para quien busca una cartera diversificada y global en un solo
                vehículo, prefiere delegar la gestión y tiene un horizonte de mediano a largo plazo.
                Si te identificás con esto, vale la pena una conversación.
              </p>
              <ul className="perfil-chips">
                <li>Diversificación global</li>
                <li>Gestión delegada</li>
                <li>Horizonte mediano-largo</li>
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Documentos ────────────────────────────────────────────── */}
      <section id="documentos" className="band site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Documentos</div>
            <div>
              <h2 className="t-h2">Documentación del fondo.</h2>
              <p className="t-lead" style={{ marginTop: 16, maxWidth: "36em" }}>
                Ficha técnica, reglamento e informes del fondo. Solicitá la documentación a un asesor de la casa
                y te la hacemos llegar.
              </p>
            </div>
          </Reveal>
          <div className="ui-list" style={{ marginTop: 48 }}>
            {DOCUMENTOS.map((doc) => (
              <Link key={doc.titulo} href="/contacto" className="ui-list-row fondo-doc-row">
                <span style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <span className="list-icon" aria-hidden><FileDown /></span>
                  <span>
                    <span className="row-title">{doc.titulo}</span>
                    <span className="row-desc" style={{ display: "block" }}>{doc.desc}</span>
                  </span>
                </span>
                <span className="link-arrow fondo-doc-tag" style={{ pointerEvents: "none" }}>
                  Solicitar <ArrowRight />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section id="faq" className="band-muted site-section">
        <div className="site-wrap">
          <div className="split-label">
            <div className="eyebrow-sm">Preguntas frecuentes</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "14em" }}>Lo que conviene saber del fondo.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                Si tu pregunta no está acá, escribinos. La mejor respuesta sigue siendo una conversación.
              </p>
            </div>
          </div>
          <div style={{ marginTop: 56 }}><FondoFAQ /></div>
        </div>
      </section>

      {/* ── CTA (único momento navy tras el hero) ─────────────────── */}
      <section className="band-navy site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Más información</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "16em" }}>¿Te interesa BNG Selección Global?</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "38em" }}>
                Un asesor de la casa te explica el producto en detalle y evalúa si encaja con tus objetivos.
                Sin compromiso.
              </p>
              <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
                <Link href="/contacto" className="ui-btn ui-btn-on-navy">Hablar con un asesor</Link>
                <Link href="/servicios" className="ui-btn ui-btn-on-navy-ghost">Ver el ecosistema</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Disclaimer ────────────────────────────────────────────── */}
      <section className="band site-section-sm">
        <div className="site-wrap">
          <p className="fondo-disclaimer">
            Esta página tiene fines exclusivamente informativos y no constituye asesoramiento de inversión,
            oferta ni recomendación de compra o suscripción. Las inversiones están sujetas a riesgos, incluida
            la posible pérdida del capital invertido; los rendimientos pasados no garantizan resultados futuros.
            Antes de invertir, leé la documentación del fondo y consultá con un asesor. Gastón Bengochea & Cía.
            Corredor de Bolsa S.A. es una sociedad regulada y supervisada por el Banco Central del Uruguay.
          </p>
        </div>
      </section>

      <style>{`
        /* Anclas de la nav interna: el tope de cada sección queda por debajo
           del navbar fijo + la barra sticky del fondo. */
        .fondo-page section[id] { scroll-margin-top: calc(var(--nav-h) + 56px); }

        /* ── Resumen ── */
        .resumen-feats {
          list-style: none; margin: 0; padding: 0;
          display: grid; grid-template-columns: 1fr 1fr; gap: 0 clamp(32px, 5vw, 72px);
          border-top: 1px solid var(--site-border);
        }
        .resumen-feats li {
          display: flex; gap: 14px; align-items: flex-start; padding: 18px 0;
          border-bottom: 1px solid var(--site-border); font-size: 17px; line-height: 1.5; color: var(--site-ink-2);
        }
        .resumen-check {
          flex: none; width: 28px; height: 28px; border-radius: 999px; display: inline-flex;
          align-items: center; justify-content: center; background: rgba(176,141,87,0.14); color: var(--gold-deep);
        }

        /* ── Estrategia grid ── */
        .estrategia-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 0;
          margin-top: 56px; border-top: 1px solid var(--site-border);
        }
        .estrategia-cell {
          padding: 34px 36px 34px 0; border-bottom: 1px solid var(--site-border); border-right: 1px solid var(--site-border);
        }
        .estrategia-cell:nth-child(2n) { padding-right: 0; padding-left: 36px; border-right: 0; }

        /* ── Cartera · estructura ── */
        .cartera-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 48px; }
        .cartera-cell {
          border: 1px solid var(--site-border); border-radius: 16px; padding: 28px 28px 30px;
          background: linear-gradient(180deg, #ffffff 0%, #fbfbfe 100%);
          box-shadow: 0 1px 0 rgba(255,255,255,0.9) inset, 0 18px 48px -32px rgba(3,6,94,0.22);
        }
        .cartera-cell-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .cartera-tag {
          font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--site-ink-3); font-variant-numeric: tabular-nums;
        }
        .cartera-nota {
          margin: 24px 0 0; padding-top: 20px; border-top: 1px solid var(--site-border);
          font-size: 13.5px; line-height: 1.65; color: var(--site-ink-3); max-width: 60em;
        }

        /* ── Perfil (chips) ── */
        .perfil-chips {
          list-style: none; margin: 28px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 10px;
        }
        .perfil-chips li {
          font-size: 14px; font-weight: 500; color: var(--site-ink-2);
          padding: 9px 16px; border-radius: 999px;
          border: 1px solid var(--site-border); background: #fff;
        }

        /* ── Documentos ── */
        .fondo-doc-row { justify-content: space-between; align-items: center; }
        .fondo-doc-tag { flex: none; }

        /* ── Disclaimer ── */
        .fondo-disclaimer {
          font-size: 12.5px; line-height: 1.7; color: var(--site-ink-3); max-width: 70em; margin: 0;
          padding-top: 24px; border-top: 1px solid var(--site-border);
        }

        @media (max-width: 760px) {
          .resumen-feats { grid-template-columns: 1fr; }
          .estrategia-grid { grid-template-columns: 1fr; }
          .estrategia-cell, .estrategia-cell:nth-child(2n) {
            padding: 28px 0; border-right: 0; padding-left: 0; padding-right: 0;
          }
          .cartera-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .fondo-doc-row { flex-direction: column; align-items: flex-start; gap: 12px; }
        }
      `}</style>
    </main>
  );
}
