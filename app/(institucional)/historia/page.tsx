import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Reveal } from "@/components/motion";
import { HistoriaTimeline, type Era } from "@/components/institucional/HistoriaTimeline";
import { pageMetadata } from "@/lib/seo";
import { estaOculta } from "@/lib/paginasOcultas";
import { RUTA_FONDO } from "@/lib/sitios";

export const metadata: Metadata = pageMetadata({
  title: "Historia",
  description:
    "Sesenta años de confianza e idoneidad. La trayectoria de Gastón Bengochea CB, año por año.",
  path: "/historia",
});

// Cronología agrupada en capítulos con nombre. Cada hito traza a la fuente
// oficial (gbengochea.com.uy/historia.php), incluidos los dos claims verificados
// de "primer corredor de bolsa local" y el origen en Ciudad Vieja.
const ERAS: Era[] = [
  {
    id: "fundacion",
    kicker: "Los fundadores",
    range: "1967",
    items: [
      {
        year: "1967",
        title: "Fundación",
        body: "Gastón Bengochea se incorpora como miembro de la Bolsa de Valores de Montevideo. Desde el primer día define una estructura empresarial horizontal: los colaboradores trabajan de forma integrada y las decisiones se discuten en la mesa.",
      },
    ],
  },
  {
    id: "apertura",
    kicker: "Apertura internacional",
    range: "1980 — 2005",
    items: [
      {
        year: "Años 80",
        title: "Fondos mutuos con Fidelity",
        body: "Acuerdo de distribución de Fondos Mutuos con Fidelity Investments. Fuimos el primer corredor de bolsa local en incorporar fondos mutuos a las carteras de nuestros clientes.",
      },
      {
        year: "2003",
        title: "Custodios internacionales",
        body: "Entre los primeros en establecer acuerdos directos con custodios y contrapartes internacionales: la ejecución y el acceso a los mercados globales, resueltos desde Montevideo.",
      },
      {
        year: "2005",
        title: "Cuentas en el exterior",
        body: "Abrimos el servicio de apertura de cuentas de inversión en el exterior, complementario a la cuenta local en Uruguay.",
      },
    ],
  },
  {
    id: "infraestructura",
    kicker: "Infraestructura y mercado",
    range: "2008 — 2016",
    items: [
      {
        year: "2008",
        title: "Consultanet · e-banking",
        body: "Plataforma de consulta on-line: el cliente ve sus cuentas al día, con detalle diario de movimientos de efectivo y valores.",
      },
      {
        year: "2013",
        title: "Matriz energética del Uruguay",
        body: "Estructuración de financiamiento privado para la construcción de parques de energía eólica, contribuyendo al desarrollo de la matriz energética uruguaya.",
      },
      {
        year: "2015",
        title: "Clearstream Banking",
        body: "Acuerdo con Clearstream Banking —del grupo Deutsche Börse, uno de los dos depositarios centrales de valores del mundo— para custodia global de activos. Primer corredor de bolsa local en lograr un acuerdo de este alcance.",
      },
      {
        year: "2016",
        title: "Reestructura de deuda",
        body: "Trabajo con empresas y gobiernos departamentales en la reestructuración de pasivos, abriendo a los clientes oportunidades en títulos de deuda securitizada bajo fideicomisos financieros.",
      },
    ],
  },
  {
    id: "estandar",
    kicker: "Estándar institucional",
    range: "2018 — 2021",
    items: [
      {
        year: "2018",
        title: "Mudanza al World Trade Center",
        body: "La firma traslada sus oficinas desde Ciudad Vieja al World Trade Center de Montevideo, Torre I.",
      },
      {
        year: "2019",
        title: "Código de Ética CFA",
        body: "Adhesión al Código de Ética y Normas de Conducta Profesional del Instituto CFA, el estándar más alto de la industria financiera global.",
      },
      {
        year: "2020",
        title: "Empoderamiento de la mujer",
        body: "Suscripción a los Principios para el Empoderamiento de las Mujeres de ONU Mujeres y el Pacto Mundial de la ONU.",
      },
      {
        year: "2021",
        title: "Bank of New York · BNY",
        body: "Acuerdo institucional con Bank of New York (BNY) — Asset Servicing para servicios de custodia y administración de activos.",
      },
    ],
  },
];

const SPRINGBOARD = [
  {
    // El fondo es OTRO sitio de la casa (lib/sitios.ts): se sale con <a>, no
    // con <Link>. Path relativo — en producción el 307 de next.config.ts lo
    // manda a su dominio.
    href: RUTA_FONDO,
    otroSitio: true,
    title: "BNG Selección Global",
    desc: "Nuestro fondo: una cartera global gestionada desde Montevideo.",
  },
  {
    href: "/informes",
    title: "Informes y research",
    desc: "La lectura de los mercados que orienta cada cartera.",
  },
  {
    href: "/contacto",
    title: "Conversemos",
    desc: "Una reunión para conocer tu perfil y cómo trabajamos.",
  },
];

const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export default function HistoriaPage() {
  // 404 con el not-found de la casa mientras la sección siga listada en
  // lib/paginasOcultas.ts. Publicada = la guarda queda inerte.
  if (estaOculta("/historia")) notFound();

  return (
    <main className="site">
      {/* Hero split — contenido + imagen */}
      <div className="hero-split">
        <div className="hero-copy">
          <div className="kicker" style={{ color: "var(--gold-soft)" }}>
            Nosotros · Historia
          </div>
          <h1 className="t-display" style={{ marginTop: 20, color: "#fff" }}>
            Sesenta años de confianza e idoneidad.
          </h1>
          <p className="t-lead" style={{ marginTop: 24, color: "rgba(255,255,255,0.86)" }}>
            Gastón Bengochea CB es miembro de la Bolsa de Valores de Montevideo desde 1967. Una sola firma,
            independiente, sin discontinuidades, atravesando ciclos económicos, regímenes regulatorios y
            crisis cambiarias.
          </p>
        </div>
        <div className="hero-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero/historia.jpg" alt="Columnas neoclásicas de un edificio institucional" />
        </div>
      </div>

      {/* Stat band — credibilidad, banda clara y aireada tras el hero */}
      <section className="band-muted site-section-sm">
        <div className="site-wrap">
          <div className="cifras-row">
            <div className="cifra">
              <span className="cifra-num">~60</span>
              <span className="cifra-label">Años de trayectoria sin discontinuidades</span>
            </div>
            <div className="cifra">
              <span className="cifra-num">BVM</span>
              <span className="cifra-label">Miembros de la Bolsa de Valores de Montevideo desde 1967</span>
            </div>
            <div className="cifra">
              <span className="cifra-num">BCU</span>
              <span className="cifra-label">Regulados por el Banco Central del Uruguay</span>
            </div>
            <div className="cifra">
              <span className="cifra-num" style={{ fontSize: "clamp(22px, 2.4vw, 30px)" }}>
                Independiente
              </span>
              <span className="cifra-label">Asesoramiento profesional, sin un grupo financiero detrás</span>
            </div>
          </div>
        </div>
      </section>

      {/* Origen — apertura editorial, mucho aire */}
      <section className="band site-section">
        <div className="site-wrap-narrow">
          <Reveal as="div">
            <div className="eyebrow-sm" style={{ color: "var(--gold-deep)" }}>Origen</div>
            <h2 className="t-h2" style={{ marginTop: 18, maxWidth: "15em" }}>
              Una casa fundada con estructura horizontal.
            </h2>
            <p className="t-lead" style={{ marginTop: 24, maxWidth: "34em" }}>
              Gastón Bengochea fundó la compañía con una estructura empresarial horizontal, donde los
              colaboradores trabajan de forma integrada. Esa lógica fundacional —oficio compartido,
              decisiones discutidas en la mesa— se mantiene intacta seis décadas después.
            </p>
            <p className="t-body" style={{ marginTop: 18, maxWidth: "34em" }}>
              Llevamos el nombre de nuestro fundador y Gastón Bengochea nos preside hoy, junto a cuatro
              socios-directores. Una sola firma, independiente, que nunca cambió de oficio.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Trayectoria — lista refinada año por año */}
      <section className="band-muted site-section">
        <div className="site-wrap-narrow">
          <Reveal as="div">
            <div className="eyebrow-sm" style={{ color: "var(--gold-deep)" }}>A través de los años</div>
            <h2 className="t-h2" style={{ marginTop: 18, maxWidth: "13em" }}>La trayectoria, año por año.</h2>
            <p className="t-lead" style={{ marginTop: 20, maxWidth: "32em" }}>
              Seis décadas sin discontinuidades, de la Bolsa de Valores de Montevideo a los acuerdos con
              los custodios globales.
            </p>
          </Reveal>

          <HistoriaTimeline eras={ERAS} />
        </div>
      </section>

      {/* Continuidad — el directorio real */}
      <section className="band site-section">
        <div className="site-wrap-narrow">
          <Reveal as="div">
            <div className="eyebrow-sm" style={{ color: "var(--gold-deep)" }}>Continuidad</div>
            <h2 className="t-h2" style={{ marginTop: 18, maxWidth: "13em" }}>La misma mesa que abrió la firma.</h2>
            <p className="t-lead" style={{ marginTop: 24, maxWidth: "34em" }}>
              Gastón Bengochea preside la firma; cinco socios la dirigen y un equipo en una sola mesa la
              opera. La estructura horizontal del primer día sigue siendo la forma de trabajar.
            </p>
            <p className="t-small" style={{ marginTop: 18, maxWidth: "34em" }}>
              Directorio: Gastón Bengochea (Presidente) · Alejandro Lavista · Diego Rodríguez · Eduardo
              Piqueras · Oscar Gilberti.
            </p>
            <div style={{ marginTop: 26 }}>
              <Link href="/equipo" className="link-arrow">
                Conocé el equipo completo <ArrowRight />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Cierre — trampolín claro, hairlines */}
      <section className="band-muted site-section">
        <div className="site-wrap-narrow">
          <Reveal as="div">
            <div className="eyebrow-sm" style={{ color: "var(--gold-deep)" }}>Hoy</div>
            <h2 className="t-h2" style={{ marginTop: 18, maxWidth: "14em" }}>
              La misma lectura prudente con la que empezamos.
            </h2>
            <p className="t-lead" style={{ marginTop: 24, maxWidth: "34em" }}>
              Invertimos en el mundo desde Montevideo: cuentas a nombre del cliente, asesoramiento de la
              casa y decisiones que se discuten en la mesa.
            </p>
            <div className="ui-list" style={{ marginTop: 40 }}>
              {SPRINGBOARD.map((s) => {
                const Tag = s.otroSitio ? "a" : Link;
                return (
                  <Tag key={s.href} href={s.href} className="ui-list-row">
                    <div>
                      <div className="row-title">{s.title}</div>
                      <div className="row-desc">{s.desc}</div>
                    </div>
                    <span className="list-icon"><ArrowRight /></span>
                  </Tag>
                );
              })}
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
