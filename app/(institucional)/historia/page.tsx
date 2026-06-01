import Link from "next/link";
import type { Metadata } from "next";
import { HistoriaTimeline } from "@/components/institucional/HistoriaTimeline";

export const metadata: Metadata = {
  title: "Historia · Bengochea & Cía.",
  description:
    "Sesenta años de confianza e idoneidad. Hitos de Gastón Bengochea CB desde 1967 hasta hoy.",
};

const TIMELINE = [
  {
    year: "1967",
    title: "Fundación",
    body: "Gastón Bengochea se incorpora como miembro de la Bolsa de Valores de Montevideo. Una estructura empresarial horizontal que permite a los colaboradores trabajar de forma integrada.",
  },
  {
    year: "1980s",
    title: "Primer broker local en fondos mutuos",
    body: "Acuerdo de distribución de Fondos Mutuos con Fidelity Investments. Bengochea se convierte en el primer broker local en incorporar fondos mutuos a su menú.",
  },
  {
    year: "2003",
    title: "Acuerdos con custodios internacionales",
    body: "Se establecen acuerdos directos con custodios y contrapartes internacionales, ampliando el alcance operativo fuera de fronteras.",
  },
  {
    year: "2005",
    title: "Apertura de cuentas en el exterior",
    body: "Lanzamiento del servicio de apertura de cuentas de inversión en el exterior para clientes uruguayos.",
  },
  {
    year: "2008",
    title: "Consultanet · e-banking",
    body: "Se incorpora CONSULTANET, la plataforma de consulta online de cuentas con información actualizada a diario.",
  },
  {
    year: "2013",
    title: "Matriz energética del Uruguay",
    body: "Participación en estructuras de financiamiento para parques eólicos, contribuyendo a la transformación de la matriz energética uruguaya.",
  },
  {
    year: "2015",
    title: "Clearstream Banking",
    body: "Acuerdo con Clearstream Banking para servicios post-trade y custodia global de activos.",
  },
  {
    year: "2016",
    title: "Reestructura de deuda",
    body: "Trabajos de reestructura de deuda con empresas e intendencias departamentales. Oferta de oportunidades de deuda securitizada.",
  },
  {
    year: "2018",
    title: "Mudanza al World Trade Center",
    body: "La firma traslada sus oficinas al World Trade Center de Montevideo, en la Torre I.",
  },
  {
    year: "2019",
    title: "Código de Ética CFA",
    body: "Adhesión al Código de Ética y Normas de Conducta Profesional del Instituto CFA.",
  },
  {
    year: "2020",
    title: "Principios de empoderamiento de la mujer",
    body: "Suscripción a la iniciativa de principios de empoderamiento de la mujer de Naciones Unidas (UN Women).",
  },
  {
    year: "2021",
    title: "Bank of New York · BNY Asset Servicing",
    body: "Acuerdo institucional con Bank of New York BNY para servicios de custodia y administración de activos.",
  },
];

export default function HistoriaPage() {
  return (
    <main className="site">
      {/* Hero full-bleed */}
      <div className="hero-media">
        <div className="media-ph" aria-hidden />
        <div className="scrim" aria-hidden />

        <div className="site-wrap hero-content">
          <div className="kicker" style={{ color: "var(--gold-soft)" }}>
            La casa · Historia
          </div>
          <h1 className="t-display" style={{ marginTop: 20, maxWidth: "16ch", color: "#fff" }}>
            Sesenta años de confianza e idoneidad.
          </h1>
          <p className="t-lead" style={{ maxWidth: "42em", marginTop: 24, color: "rgba(255,255,255,0.86)" }}>
            Gastón Bengochea CB es miembro de la Bolsa de Valores de Montevideo desde 1967. Una sola firma,
            sin discontinuidades, atravesando ciclos económicos, regímenes regulatorios y crisis cambiarias.
          </p>
        </div>
      </div>

      {/* Origen */}
      <section className="band site-section">
        <div className="site-wrap">
          <div className="split-label">
            <div className="eyebrow-sm">Origen</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "16em" }}>Una casa fundada con estructura horizontal.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "36em" }}>
                La compañía fue fundada por Gastón Bengochea con una estructura empresarial horizontal,
                permitiendo a sus colaboradores trabajar de forma integrada. Esa lógica fundacional —oficio
                compartido, decisiones discutidas en la mesa— se mantiene intacta seis décadas después.
              </p>
              <p className="t-body" style={{ marginTop: 16, maxWidth: "36em" }}>
                En la década del ochenta, Bengochea firmó un acuerdo de distribución de Fondos Mutuos con
                Fidelity Investments y se convirtió en el primer broker local en incorporar fondos mutuos a su
                catálogo. La apertura internacional empezó allí.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline — lista vertical minimal: año grande a la izquierda + título + texto, hairlines */}
      <section className="band-muted site-section">
        <div className="site-wrap">
          <div className="split-label">
            <div className="eyebrow-sm">A través de los años</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "14em" }}>Doce hitos que cuentan la trayectoria.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                De la fundación a los acuerdos institucionales con custodios globales. Sin saltos.
              </p>
            </div>
          </div>

          <HistoriaTimeline items={TIMELINE} />
        </div>
      </section>

      {/* Cierre — banda navy */}
      <section className="band-navy site-section">
        <div className="site-wrap">
          <div className="split">
            <div>
              <div className="eyebrow-sm">2026 · hoy</div>
              <h2 className="t-h2" style={{ marginTop: 16, maxWidth: "14em" }}>
                La misma lectura prudente que abrió la casa en 1967.
              </h2>
            </div>
            <div>
              <p className="t-lead" style={{ margin: 0 }}>
                Hoy operamos ocho mercados desde Montevideo con un equipo que conserva la lógica fundadora:
                cuentas a nombre del cliente, asesoramiento de la casa y decisiones que se discuten en la mesa.
              </p>
              <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
                <Link href="/equipo" className="ui-btn ui-btn-on-navy-ghost">Conocé el equipo</Link>
                <Link href="/contacto" className="ui-btn ui-btn-on-navy">Agendá una reunión</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
