import type { Metadata } from "next";
import Link from "next/link";
import { Reveal, Stagger, StaggerItem, Counter } from "@/components/motion";

export const metadata: Metadata = {
  title: "Equipo · Bengochea & Cía.",
  description:
    "Directorio, administración, asesoramiento, mesa de operaciones y compliance de Gastón Bengochea CB.",
};

type Person = { name: string; role: string; photo: string };
type Area = { id: string; title: string; lede: string; people: Person[] };

const AREAS: Area[] = [
  {
    id: "directorio",
    title: "Directorio",
    lede: "Cinco socios definen la estrategia y la operativa diaria de la casa.",
    people: [
      { name: "Gastón Bengochea", role: "Presidente", photo: "/equipo/gaston-bengochea.jpg" },
      { name: "Alejandro Lavista", role: "Socio · Director", photo: "/equipo/alejandro-lavista.png" },
      { name: "Diego Rodriguez", role: "Socio · Director", photo: "/equipo/diego-rodriguez.png" },
      { name: "Eduardo Piqueras", role: "Socio · Director", photo: "/equipo/eduardo-piqueras.png" },
      { name: "Oscar Gilberti", role: "Socio · Director", photo: "/equipo/oscar-gilberti.png" },
    ],
  },
  {
    id: "asesores",
    title: "Asesores",
    lede: "El equipo que escucha al cliente y construye la cartera. Cada inversor tiene un asesor principal.",
    people: [
      { name: "Andrea Stolowicz", role: "Asesor Financiero", photo: "/equipo/andrea-stolowicz.png" },
      { name: "Gabriel Angiolini", role: "Asesor Financiero", photo: "/equipo/gabriel-angiolini.png" },
      { name: "Graciana Noya", role: "Asesor Financiero", photo: "/equipo/graciana-noya.png" },
      { name: "Hernán Castro", role: "Asesor Financiero", photo: "/equipo/hernan-castro.png" },
      { name: "Lucia Arias", role: "Asesor Financiero", photo: "/equipo/lucia-arias.png" },
      { name: "Francisco Echegoyen", role: "Asesor Financiero", photo: "/equipo/francisco-echegoyen.png" },
      { name: "Facundo Gonzalez", role: "Asesor Financiero", photo: "/equipo/facundo-gonzalez.png" },
      { name: "Daniela Nardo", role: "Asistente", photo: "/equipo/daniela-nardo.png" },
    ],
  },
  {
    id: "mesa",
    title: "Mesa de Operaciones",
    lede: "Los traders que ejecutan en las plazas locales e internacionales.",
    people: [
      { name: "Isabel Freiria", role: "Trader", photo: "/equipo/isabel-freiria.png" },
      { name: "Adrián Moreira", role: "Trader", photo: "/equipo/adrian-moreira.jpeg" },
    ],
  },
  {
    id: "administracion",
    title: "Administración",
    lede: "Back office, facturación y contabilidad: la infraestructura que sostiene la operativa.",
    people: [
      { name: "Gimena Paladino", role: "Administración y Facturación", photo: "/equipo/gimena-paladino.png" },
      { name: "Florencia Cotignola", role: "Contadora Pública", photo: "/equipo/florencia-cotignola.png" },
      { name: "Camila Machado", role: "Auxiliar Contable", photo: "/equipo/camila-machado.png" },
      { name: "Lorena Piegas", role: "Backoffice", photo: "/equipo/lorena-piegas.png" },
    ],
  },
  {
    id: "compliance",
    title: "Compliance",
    lede: "Cumplimiento normativo, prevención y reporte regulatorio ante BCU.",
    people: [
      { name: "Matías Ranieri", role: "Oficial de Cumplimiento", photo: "/equipo/matias-ranieri.jpg" },
      { name: "Federica Pascuali", role: "Asistente", photo: "/equipo/federica-pascuali.png" },
    ],
  },
];

const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export default function EquipoPage() {
  const total = AREAS.reduce((acc, a) => acc + a.people.length, 0);

  return (
    <main className="site">
      {/* Hero split — contenido + imagen */}
      <div className="hero-split">
        <Reveal as="div" className="hero-copy">
          <div className="kicker" style={{ color: "var(--gold-soft)" }}>
            La casa · Equipo
          </div>
          <h1 className="t-display" style={{ marginTop: 20, color: "#fff" }}>
            La mesa, en su composición.
          </h1>
          <p className="t-lead" style={{ marginTop: 24, color: "rgba(255,255,255,0.86)" }}>
            Cinco áreas, un único oficio. Cada cliente sabe con quién habla, sabe quién ejecuta y sabe
            quién firma. Estos son los nombres detrás de cada portafolio.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 32 }}>
            {AREAS.map((a) => (
              <a key={a.id} href={`#${a.id}`} className="ui-btn ui-btn-on-navy-ghost">
                {a.title}
              </a>
            ))}
          </div>
        </Reveal>
        <div className="hero-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero/equipo.jpg" alt="Profesionales de la casa en una reunión de trabajo" />
        </div>
      </div>

      {/* Cifras — composición de la mesa */}
      <section className="band-muted site-section-sm">
        <div className="site-wrap">
          <div className="cifras-row">
            <div className="cifra">
              <span className="cifra-num">{total}</span>
              <span className="cifra-label">Profesionales en una sola mesa</span>
            </div>
            <div className="cifra">
              <span className="cifra-num">5</span>
              <span className="cifra-label">Áreas que trabajan integradas</span>
            </div>
            <div className="cifra">
              <span className="cifra-num">WTC</span>
              <span className="cifra-label">Nuestra sede, en Montevideo</span>
            </div>
            <div className="cifra">
              <span className="cifra-num">BCU</span>
              <span className="cifra-label">Bajo supervisión del Banco Central</span>
            </div>
          </div>
        </div>
      </section>

      {/* Áreas — grilla limpia de personas, sin tarjetas */}
      {AREAS.map((area, idx) => (
        <section
          key={area.id}
          id={area.id}
          className={idx % 2 === 0 ? "band site-section" : "band-muted site-section"}
        >
          <div className="site-wrap">
            <Reveal as="div" className="split-label">
              <div className="eyebrow-sm">{area.title}</div>
              <div>
                <h2 className="t-h2">{area.title}</h2>
                <p className="t-lead" style={{ marginTop: 16, maxWidth: "36em" }}>{area.lede}</p>
              </div>
            </Reveal>

            <Stagger as="div" className="team-grid">
              {area.people.map((p) => (
                <StaggerItem key={p.name} as="div" className="person">
                  <div className="person-photo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.photo} alt={p.name} loading="lazy" />
                  </div>
                  <h3 className="t-h4" style={{ marginTop: 16 }}>{p.name}</h3>
                  <div className="t-small" style={{ marginTop: 4 }}>{p.role}</div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>
      ))}

      {/* Cierre — banda navy */}
      <section className="band-navy site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Trabajá con la casa</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "16em" }}>
                Cada portafolio se discute entre todos.
              </h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "42em" }}>
                La recomendación al cliente no es la opinión aislada de un canal: es una conversación
                entre Directorio, Asesores, Mesa y Compliance. Hoy somos{" "}
                <Counter to={total} /> colaboradores en el WTC de Montevideo.
              </p>
              <Link href="/contacto" className="link-arrow" style={{ marginTop: 28 }}>
                Agendá una reunión <ArrowRight />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <style>{`
        .team-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: clamp(28px, 3vw, 44px) clamp(24px, 3vw, 40px);
          margin-top: 56px;
        }
        .person {
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .person:hover {
          transform: translateY(-4px);
        }
        .person:hover .t-small {
          color: var(--navy);
          transition: color 0.4s ease;
        }
        .person .t-small {
          transition: color 0.4s ease;
        }
        .person-photo {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 5;
          border-radius: 6px;
          overflow: hidden;
          background: var(--surface-muted);
        }
        .person-photo img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center top;
          filter: grayscale(1);
          transition: filter 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .person:hover .person-photo img {
          filter: grayscale(0);
        }
        @media (prefers-reduced-motion: reduce) {
          .person, .person-photo img, .person .t-small { transition: none; }
        }
        .band-navy .person-photo { background: rgba(255,255,255,0.06); }
        @media (max-width: 1000px) {
          .team-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 720px) {
          .team-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 460px) {
          .team-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </main>
  );
}
