import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion";
import { SplitText } from "@/components/scroll";
import {
  Scales, Layers, Waveform, Shield, FileDown, ArrowRight,
} from "@/components/institucional/icons";
import { FondoHero } from "@/components/institucional/FondoHero";
import { FondoNav } from "@/components/institucional/FondoNav";
import { FondoMundo } from "@/components/institucional/FondoMundo";
import { FondoCasa } from "@/components/institucional/FondoCasa";
import { FondoDiferencia } from "@/components/institucional/FondoDiferencia";
import { FondoCartera } from "@/components/institucional/FondoCartera";
import { FondoPerformance } from "@/components/institucional/FondoPerformance";
import { FondoCalculadora } from "@/components/institucional/FondoCalculadora";
import { FondoFAQ } from "@/components/institucional/FondoFAQ";
import { FondoTenencias } from "@/components/institucional/FondoTenencias";
import { FondoGeografia } from "@/components/institucional/FondoGeografia";

export const metadata: Metadata = {
  title: "BNG Selección Global · Bengochea & Cía.",
  description:
    "BNG Selección Global: estrategia diversificada, con exposición a renta variable y fija a nivel global, domiciliada en Uruguay. Estrategia, performance y documentos.",
};

// Estrategia · "Cómo invierte" — las 4 piezas son MECANISMO, no repetición del
// claim. "Exposición global" y "domicilio en Uruguay" ya viven en el hero, el
// globo (Resumen) y La casa; acá no se repiten para que la sección haga avanzar
// el argumento en vez de reafirmarlo.
const ESTRATEGIA: { icon: ReactNode; title: string; body: string }[] = [
  { icon: <Scales />, title: "Cartera balanceada", body: "Combina renta variable y renta fija en un mismo vehículo, buscando un equilibrio entre crecimiento y estabilidad según el contexto de mercado." },
  { icon: <Layers />, title: "Selección de fondos", body: "Invierte a través de una selección de fondos gestionados por managers especializados, sumando diversificación y gestión profesional en cada clase de activo." },
  { icon: <Waveform />, title: "Gestión activa", body: "El peso entre renta variable y renta fija no es fijo: se ajusta de forma activa según cómo evoluciona el mercado a lo largo del ciclo." },
  { icon: <Shield />, title: "Diversificación amplia", body: "El riesgo se reparte por clase de activo, por manager y por región — no depende de un solo instrumento ni de una sola apuesta." },
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

      {/* ── Resumen: el mundo en un mapa de puntos (diagonal, sangra a la derecha) ─ */}
      <section id="resumen" className="band site-section resumen-sec">
        <div className="resumen-map" aria-hidden>
          <FondoMundo />
        </div>
        <div className="site-wrap">
          <Reveal as="div" className="resumen-copy">
            <div className="eyebrow-sm">El fondo, de un vistazo</div>
            <h2 className="t-h2">El mundo, en una sola posición.</h2>
            <p className="t-lead">
              Replicar esta diversificación por cuenta propia exige decenas de instrumentos y
              rebalanceos permanentes. El fondo la reúne en una sola posición — balanceada, global
              y operada desde Uruguay.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Estrategia · cómo invierte (mecanismo) ────────────────────── */}
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
              <div key={it.title} className="estrategia-cell">
                <span className="feat-icon" aria-hidden>{it.icon}</span>
                <h3 className="t-h4" style={{ marginTop: 18 }}>{it.title}</h3>
                <p className="t-body" style={{ marginTop: 10, marginBottom: 0 }}>{it.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cartera · de qué se compone (cualitativo → concreto) ───────── */}
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

          <FondoCartera />

          {/* Mayores tenencias — composición ilustrativa (datos ilustrativos) */}
          <FondoTenencias />

          {/* Exposición geográfica — choropleth de puntos (datos ilustrativos) */}
          <FondoGeografia />
        </div>
      </section>

      {/* ── La casa · credibilidad (sustituye el track record ausente) ── */}
      <section id="casa" className="band-muted site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">La casa</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "14em" }}>Detrás del fondo, seis décadas de casa.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "36em" }}>
                BNG Selección Global lo gestiona Gastón Bengochea & Cía. —sociedad de bolsa en la
                plaza uruguaya desde 1967—, con Adrián Moreira al frente de la gestión del fondo.
              </p>
            </div>
          </Reveal>
          <div style={{ marginTop: 48 }}><FondoCasa /></div>
        </div>
      </section>

      {/* ── Diferenciación · por qué este enfoque y no armarlo solo ──── */}
      <section id="diferencia" className="band site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Qué lo distingue</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "14em" }}>Una cartera global no se arma sola.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                Buscar esta diversificación por tu cuenta es posible. La diferencia está en todo lo
                que el fondo resuelve por vos — y en quién lo hace.
              </p>
            </div>
          </Reveal>
          <FondoDiferencia />
        </div>
      </section>

      {/* ── Performance ───────────────────────────────────────────── */}
      <section id="performance" className="band-muted site-section">
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
      <section id="calculadora" className="band site-section">
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

        /* ── Resumen (mapa de puntos en diagonal) ── */
        .resumen-sec { position: relative; overflow: hidden; min-height: clamp(460px, 56vh, 620px); }
        .resumen-sec .site-wrap { position: relative; z-index: 2; }
        .resumen-copy { max-width: 33em; }
        .resumen-copy .t-h2 { max-width: 11em; }
        .resumen-copy .t-lead { margin-top: 20px; max-width: 30em; }

        /* Mapa: pinned a la derecha, sangra fuera y se disuelve hacia el texto. */
        .resumen-map {
          position: absolute; top: 0; right: 0; bottom: 0;
          width: min(64%, 820px); z-index: 1; pointer-events: none;
          -webkit-mask-image: radial-gradient(125% 125% at 80% 42%, #000 36%, transparent 76%);
          mask-image: radial-gradient(125% 125% at 80% 42%, #000 36%, transparent 76%);
        }
        .resumen-map .fmapa { width: 100%; height: 100%; display: block; }

        /* ── Estrategia grid ── */
        .estrategia-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 0;
          margin-top: 56px; border-top: 1px solid var(--site-border);
        }
        .estrategia-cell {
          padding: 34px 36px 34px 0; border-bottom: 1px solid var(--site-border); border-right: 1px solid var(--site-border);
        }
        .estrategia-cell:nth-child(2n) { padding-right: 0; padding-left: 36px; border-right: 0; }

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

        @media (max-width: 880px) {
          .resumen-sec { min-height: 0; }
          .resumen-copy { max-width: none; }
          /* El mapa pasa detrás del texto, tenue y a todo el ancho. */
          .resumen-map {
            width: 100%; opacity: 0.14;
            -webkit-mask-image: none; mask-image: none;
          }
        }
        @media (max-width: 760px) {
          .estrategia-grid { grid-template-columns: 1fr; }
          .estrategia-cell, .estrategia-cell:nth-child(2n) {
            padding: 28px 0; border-right: 0; padding-left: 0; padding-right: 0;
          }
        }
        @media (max-width: 640px) {
          .fondo-doc-row { flex-direction: column; align-items: flex-start; gap: 12px; }
        }
      `}</style>
    </main>
  );
}
