import { HeroInstitucional } from "@/components/institucional/HeroInstitucional";
import { InstagramFeed } from "@/components/institucional/InstagramFeed";
import { TrayectoriaScene } from "@/components/institucional/TrayectoriaScene";
import { MercadosGlobal } from "@/components/institucional/MercadosGlobal";
import { EquipoHome } from "@/components/institucional/EquipoHome";
import { Industrias } from "@/components/institucional/Industrias";
import { ReportPreviewMini } from "@/components/institucional/ReportPreviewMini";
import { Reveal } from "@/components/motion";
import { SplitText, ParallaxLayer } from "@/components/scroll";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Columns, Globe, Scales, Lock, Waveform, Compass } from "@/components/institucional/icons";

const PILARES: { icon: ReactNode; title: string; body: string }[] = [
  { icon: <Columns />, title: "Presencia y experiencia", body: "Gestionamos el patrimonio de miles de uruguayos y extranjeros por seis décadas. Miembros de la Bolsa de Valores de Montevideo desde 1967." },
  { icon: <Globe />, title: "Una mirada global", body: "Locales con foco global. Invertimos en el mundo desde Uruguay, con acceso al mercado local y al internacional." },
  { icon: <Scales />, title: "Regulación", body: "Operamos como compañía regulada por el Banco Central del Uruguay y como miembros activos de la Bolsa de Valores de Montevideo." },
  { icon: <Lock />, title: "Seguridad", body: "Cuentas segregadas a nombre del cliente. El inversor es el propietario legal de los activos en su cuenta, separados del patrimonio de la firma." },
  { icon: <Waveform />, title: "Escucha activa", body: "Te escuchamos antes de hablar. Entender qué buscás —y qué preferís evitar— viene antes que cualquier propuesta." },
  { icon: <Compass />, title: "Dedicación", body: "Explicamos el funcionamiento del mercado y de cada activo en el que invertís, y por qué creemos que debe formar parte de tu cartera." },
];

const PROCESO: [string, string, string][] = [
  ["01", "Escucha activa", "Entendemos tus objetivos y restricciones antes de proponer."],
  ["02", "Propuesta a medida", "Diseñamos una cartera individual alineada a tu perfil."],
  ["03", "Ejecución directa", "Operamos las plazas locales e internacionales por vos."],
  ["04", "Seguimiento", "Explicamos cada activo y acompañamos la evolución de tu cartera."],
];

export default function HomePage() {
  return (
    <main className="site">
      <HeroInstitucional />

      {/* Nuestra casa — escena pinned: palabras serif sobre panel navy que
          se expande y revela la declaración de la casa */}
      <TrayectoriaScene />

      {/* Por qué GB */}
      <section className="band-muted site-section">
        <div className="site-wrap">
          <Reveal className="split-label">
            <div className="eyebrow-sm">¿Por qué GB?</div>
            <div>
              <SplitText
                text="Seis décadas de confianza, en seis principios."
                as="h2"
                className="t-h2"
              />
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "36em" }}>
                Los atributos no se proclaman: se ejecutan. Estos son los que sostienen la relación con cada cliente.
              </p>
            </div>
          </Reveal>

          <div className="pilar-grid">
            {PILARES.map(({ icon, title, body }) => (
              <div key={title} className="pilar-item">
                <span className="feat-icon" aria-hidden>{icon}</span>
                <h3 className="t-h4">{title}</h3>
                <p className="t-body" style={{ marginTop: 10, marginBottom: 0 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mercados — editorial sin pin: mapa mundial + los dos accesos de la mesa */}
      <MercadosGlobal />

      {/* Industrias — sectores invertibles con video */}
      <Industrias />

      {/* Proceso — cómo trabajamos */}
      <section className="band site-section">
        <div className="site-wrap">
          <Reveal>
            <div className="eyebrow-sm">Cómo trabajamos</div>
            <SplitText
              text="Un proceso de inversión cercano, paso a paso."
              as="h2"
              className="t-h2"
              style={{ marginTop: 16, maxWidth: "16em" }}
            />
          </Reveal>

          <div className="proceso-grid">
            {PROCESO.map(([num, title, desc], i) => (
              <div key={num} style={{ position: "relative" }}>
                {i < PROCESO.length - 1 && (
                  <span className="proceso-arrow" aria-hidden><ArrowRight /></span>
                )}
                <div className="proceso-step">
                  <span className="proceso-num">{num}</span>
                  <h3 className="t-h4" style={{ marginTop: 18 }}>{title}</h3>
                  <p className="t-small" style={{ marginTop: 8, marginBottom: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* La casa — el momento humano: los cinco socios con foto real */}
      <EquipoHome />

      {/* Análisis — split con media: la "prueba interactiva", última parada
          antes de los CTAs del footer */}
      <section className="band site-section">
        <div className="site-wrap">
          <div className="split">
            <Reveal>
              <div className="eyebrow-sm">Análisis · herramienta</div>
              <SplitText
                text="Equity research a pedido, en segundos."
                as="h2"
                className="t-h2"
                style={{ marginTop: 16 }}
              />
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "32em" }}>
                Cargá un ticker y obtené un reporte con veredicto BUY · HOLD · AVOID, doce KPIs, Sankey del
                estado de resultados, consenso de Wall Street y exportación a PDF.
              </p>
              <Link href="/analisis" className="link-arrow" style={{ marginTop: 28 }}>
                Probar el análisis <ArrowRight />
              </Link>
            </Reveal>

            <ParallaxLayer offset={50}>
              <ReportPreviewMini />
            </ParallaxLayer>
          </div>
        </div>
      </section>

      {/* Novedades de Instagram — gateado por el flag `instagram_feed` del
          panel (default OFF: /api/instagram devuelve vacío y el módulo no se
          monta; nada cambia hasta prenderlo en /admin/secciones con el worker
          desplegado). Banda muted tras la banda blanca. */}
      <InstagramFeed variant="band-muted" />

      <style>{`
        .pilar-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0;
          margin-top: 56px;
          border-top: 1px solid var(--site-border);
        }
        .pilar-item {
          padding: 32px;
          border-bottom: 1px solid var(--site-border);
          border-right: 1px solid var(--site-border);
        }
        .pilar-item:nth-child(3n+1) { padding-left: 0; }
        .pilar-item:nth-child(3n) { border-right: 0; padding-right: 0; }
        @media (max-width: 900px) {
          .pilar-grid { grid-template-columns: 1fr 1fr; }
          .pilar-item:nth-child(3n+1) { padding-left: 32px; }
          .pilar-item:nth-child(3n) { border-right: 1px solid var(--site-border); padding-right: 32px; }
          .pilar-item:nth-child(2n+1) { padding-left: 0; }
          .pilar-item:nth-child(2n) { border-right: 0; padding-right: 0; }
        }
        @media (max-width: 560px) {
          .pilar-grid { grid-template-columns: 1fr; }
          .pilar-item,
          .pilar-item:nth-child(3n+1),
          .pilar-item:nth-child(3n),
          .pilar-item:nth-child(2n+1),
          .pilar-item:nth-child(2n) { padding-left: 0; padding-right: 0; border-right: 0; }
        }
      `}</style>
    </main>
  );
}
