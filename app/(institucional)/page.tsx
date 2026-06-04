import { HeroInstitucional } from "@/components/institucional/HeroInstitucional";
import { Industrias } from "@/components/institucional/Industrias";
import { ReportPreviewMini } from "@/components/institucional/ReportPreviewMini";
import { Reveal, Stagger, StaggerItem, Parallax } from "@/components/motion";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Columns, Globe, Scales, Lock, Waveform, Compass } from "@/components/institucional/icons";

const PILARES: { icon: ReactNode; title: string; body: string }[] = [
  { icon: <Columns />, title: "Presencia y experiencia", body: "Gestionamos el patrimonio de miles de uruguayos y extranjeros por casi seis décadas. Miembros de la Bolsa de Valores de Montevideo desde 1967." },
  { icon: <Globe />, title: "Una mirada global", body: "Locales con foco global. Invertimos en los mercados del mundo desde Uruguay, con acceso directo a las principales plazas internacionales." },
  { icon: <Scales />, title: "Regulación", body: "Operamos como compañía regulada por el Banco Central del Uruguay y como miembros activos de la Bolsa de Valores de Montevideo." },
  { icon: <Lock />, title: "Seguridad", body: "Cuentas segregadas a nombre del cliente. El inversor es el propietario legal de los activos en su cuenta, separados del patrimonio de la firma." },
  { icon: <Waveform />, title: "Escucha activa", body: "Te escuchamos antes de hablar. Proponemos una cartera individual alineada a los objetivos y restricciones de cada inversor." },
  { icon: <Compass />, title: "Dedicación", body: "Explicamos el funcionamiento del mercado y de cada activo en el que invertís, y por qué creemos que debe formar parte de tu cartera." },
];

const PROCESO: [string, string, string][] = [
  ["01", "Escucha activa", "Entendemos tus objetivos y restricciones antes de proponer."],
  ["02", "Propuesta a medida", "Diseñamos una cartera individual alineada a tu perfil."],
  ["03", "Ejecución directa", "Operamos las plazas locales e internacionales por vos."],
  ["04", "Seguimiento", "Explicamos cada activo y acompañamos la evolución de tu cartera."],
];

const ECOSISTEMA: [string, string, string][] = [
  ["Mercado local", "Bonos globales uruguayos, Notas en UI, fideicomisos, LRM y obligaciones negociables.", "/servicios#local"],
  ["Mercado internacional", "Renta fija soberana y corporativa, acciones, fondos y derivados globales.", "/servicios#internacional"],
  ["Proceso de inversión", "Una cartera individual, construida con escucha activa y asesoramiento de la casa.", "/servicios#proceso"],
  ["Análisis de acciones", "Equity research a pedido: veredicto, KPIs y consenso en segundos.", "/analisis"],
];

const MERCADOS = ["NYSE", "NASDAQ", "LSE", "Euronext", "XETRA", "BVM", "BYMA", "B3"];

export default function HomePage() {
  return (
    <main className="site">
      <HeroInstitucional />

      {/* Declaración */}
      <section className="band site-section">
        <div className="site-wrap">
          <Reveal className="split-label">
            <div className="eyebrow-sm">Nuestra casa</div>
            <div>
              <p className="t-h2" style={{ maxWidth: "18em" }}>
                Desde 1967 monitoreamos el mercado en búsqueda de las mejores oportunidades de inversión.
                La confianza de nuestros clientes siempre fue nuestro norte.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Por qué GB */}
      <section className="band-muted site-section">
        <div className="site-wrap">
          <Reveal className="split-label">
            <div className="eyebrow-sm">¿Por qué GB?</div>
            <div>
              <h2 className="t-h2">Casi seis décadas de confianza, en seis principios.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "36em" }}>
                Los atributos no se proclaman: se ejecutan. Estos son los que sostienen la relación con cada cliente.
              </p>
            </div>
          </Reveal>

          <Stagger className="pilar-grid" as="div">
            {PILARES.map(({ icon, title, body }) => (
              <StaggerItem key={title} className="pilar-item" as="div">
                <span className="feat-icon" aria-hidden>{icon}</span>
                <h3 className="t-h4">{title}</h3>
                <p className="t-body" style={{ marginTop: 10, marginBottom: 0 }}>{body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Ecosistema — split con lista de filas */}
      <section className="band site-section">
        <div className="site-wrap">
          <div className="split">
            <Reveal>
              <div className="eyebrow-sm">Ecosistema</div>
              <h2 className="t-h2" style={{ marginTop: 16 }}>Accedé a nuestro amplio ecosistema de inversiones.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "32em" }}>
                Operativa local con la plaza uruguaya e internacional con las principales bolsas del mundo. Una sola mesa para ambas.
              </p>
              <Link href="/servicios" className="link-arrow" style={{ marginTop: 28 }}>
                Ver el ecosistema completo <ArrowRight />
              </Link>
            </Reveal>

            <Reveal className="ui-list" delay={0.1}>
              {ECOSISTEMA.map(([title, desc, href]) => (
                <Link key={title} href={href} className="ui-list-row">
                  <span>
                    <span className="row-title">{title}</span>
                    <span className="row-desc" style={{ display: "block" }}>{desc}</span>
                  </span>
                  <span className="link-arrow" style={{ pointerEvents: "none" }}><ArrowRight /></span>
                </Link>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      {/* Proceso — cómo trabajamos */}
      <section className="band-muted site-section">
        <div className="site-wrap">
          <Reveal>
            <div className="eyebrow-sm">Cómo trabajamos</div>
            <h2 className="t-h2" style={{ marginTop: 16, maxWidth: "16em" }}>
              Un proceso de inversión cercano, paso a paso.
            </h2>
          </Reveal>

          <Stagger className="proceso-grid" as="div">
            {PROCESO.map(([num, title, desc], i) => (
              <StaggerItem key={num} className="proceso-step" as="div">
                <span className="proceso-num">{num}</span>
                {i < PROCESO.length - 1 && (
                  <span className="proceso-arrow" aria-hidden><ArrowRight /></span>
                )}
                <h3 className="t-h4" style={{ marginTop: 18 }}>{title}</h3>
                <p className="t-small" style={{ marginTop: 8, marginBottom: 0 }}>{desc}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Plazas — banda navy minimal */}
      <section className="band-navy site-section">
        <div className="site-wrap">
          <Reveal className="split-label">
            <div className="eyebrow-sm">Plazas</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "14em" }}>Invertimos en el mundo desde Uruguay.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                Desde Montevideo operamos las principales bolsas globales y la plaza local con ejecución directa.
              </p>
            </div>
          </Reveal>

          <Stagger className="mercados-row" as="div">
            {MERCADOS.map((m) => (
              <StaggerItem key={m} className="mercado-cell" as="div">{m}</StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Industrias — sectores invertibles con video */}
      <Industrias />

      {/* Análisis — split con media */}
      <section className="band-muted site-section">
        <div className="site-wrap">
          <div className="split">
            <Reveal>
              <div className="eyebrow-sm">Análisis · herramienta</div>
              <h2 className="t-h2" style={{ marginTop: 16 }}>Equity research a pedido, en segundos.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "32em" }}>
                Cargá un ticker y obtené un reporte con veredicto BUY · HOLD · AVOID, doce KPIs, Sankey del
                estado de resultados, consenso de Wall Street y exportación a PDF.
              </p>
              <Link href="/analisis" className="link-arrow" style={{ marginTop: 28 }}>
                Probar el análisis <ArrowRight />
              </Link>
            </Reveal>

            <Parallax offset={50}>
              <ReportPreviewMini />
            </Parallax>
          </div>
        </div>
      </section>

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
        .mercados-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          margin-top: 56px;
          border-top: 1px solid rgba(255,255,255,0.16);
          border-left: 1px solid rgba(255,255,255,0.16);
        }
        .mercado-cell {
          padding: 28px 24px;
          border-right: 1px solid rgba(255,255,255,0.16);
          border-bottom: 1px solid rgba(255,255,255,0.16);
          font-size: 22px;
          font-weight: 400;
          letter-spacing: 0.01em;
          color: #fff;
        }
        @media (max-width: 900px) {
          .pilar-grid { grid-template-columns: 1fr 1fr; }
          .pilar-item:nth-child(3n+1) { padding-left: 32px; }
          .pilar-item:nth-child(3n) { border-right: 1px solid var(--site-border); padding-right: 32px; }
          .pilar-item:nth-child(2n+1) { padding-left: 0; }
          .pilar-item:nth-child(2n) { border-right: 0; padding-right: 0; }
          .mercados-row { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 560px) {
          .pilar-grid { grid-template-columns: 1fr; }
          .pilar-item,
          .pilar-item:nth-child(3n+1),
          .pilar-item:nth-child(3n),
          .pilar-item:nth-child(2n+1),
          .pilar-item:nth-child(2n) { padding-left: 0; padding-right: 0; border-right: 0; }
          .mercados-row { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </main>
  );
}
