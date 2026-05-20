import type { Metadata } from "next";
import Link from "next/link";

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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export default function EquipoPage() {
  const total = AREAS.reduce((acc, a) => acc + a.people.length, 0);

  return (
    <main>
      {/* Hero */}
      <section className="section-navy" style={{ position: "relative", overflow: "hidden" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(50% 70% at 80% 30%, rgba(201,168,76,0.08), transparent 60%)",
          }}
        />
        <div
          className="wrap"
          style={{
            paddingTop: "calc(var(--nav-h) + var(--space-7))",
            paddingBottom: "var(--space-7)",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(255,255,255,0.18)",
              paddingBottom: "var(--space-3)",
              marginBottom: "var(--space-6)",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <span className="cap" style={{ color: "rgba(255,255,255,0.55)" }}>La casa · Equipo</span>
            <span className="cap mono" style={{ color: "rgba(255,255,255,0.55)" }}>WTC Montevideo · {total} colaboradores</span>
          </div>

          <h1
            className="serif"
            style={{
              fontWeight: 300,
              fontSize: "clamp(40px, 6vw, 84px)",
              lineHeight: 1,
              letterSpacing: "-0.025em",
              margin: 0,
              color: "var(--ivory)",
              maxWidth: "18ch",
            }}
          >
            La mesa, en su{" "}
            <em style={{ fontStyle: "italic", color: "var(--gold-soft)", fontWeight: 300 }}>
              composición.
            </em>
          </h1>

          <p
            className="lede"
            style={{
              maxWidth: "40em",
              color: "rgba(255,255,255,0.82)",
              marginTop: "var(--space-5)",
            }}
          >
            Cinco áreas, un único oficio. Cada cliente sabe con quién habla, sabe quién ejecuta y sabe quién firma. Estos son los nombres detrás de cada portafolio.
          </p>

          {/* Index */}
          <nav
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 24,
              marginTop: "var(--space-6)",
              paddingTop: "var(--space-4)",
              borderTop: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            {AREAS.map((a, i) => (
              <a
                key={a.id}
                href={`#${a.id}`}
                className="mono"
                style={{
                  fontSize: 11.5,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.65)",
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 8,
                }}
              >
                <span style={{ color: "var(--gold-soft)" }}>0{i + 1}</span>
                {a.title}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* Áreas */}
      {AREAS.map((area, idx) => (
        <section key={area.id} id={area.id} className="section">
          <div className="wrap">
            <div className="sec-head">
              <div>
                <div className="sec-num">{String(idx + 1).padStart(2, "0")} / {String(AREAS.length).padStart(2, "0")}</div>
                <div className="cap-gold" style={{ marginTop: 8 }}>{area.title}</div>
              </div>
              <div>
                <h2>{area.title}.</h2>
                <p className="dek">{area.lede}</p>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                borderTop: "1px solid var(--ink)",
                borderLeft: "1px solid var(--rule)",
              }}
              className="team-grid"
            >
              {area.people.map((p) => (
                <article
                  key={p.name}
                  style={{
                    padding: "var(--space-5)",
                    borderRight: "1px solid var(--rule)",
                    borderBottom: "1px solid var(--rule)",
                    background: "var(--paper)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-4)",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      aspectRatio: "1 / 1",
                      border: "1px solid var(--rule-strong)",
                      background: "var(--ivory)",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.photo}
                      alt={p.name}
                      loading="lazy"
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: "center top",
                        filter: "grayscale(35%) contrast(0.98)",
                      }}
                    />
                    <span
                      aria-hidden
                      className="serif"
                      style={{
                        fontSize: 28,
                        fontWeight: 400,
                        letterSpacing: "-0.02em",
                        color: "var(--ink-3)",
                        opacity: 0.25,
                      }}
                    >
                      {initials(p.name)}
                    </span>
                    {/* Esquina dorada decorativa */}
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        width: 14,
                        height: 14,
                        borderTop: "1px solid var(--gold)",
                        borderRight: "1px solid var(--gold)",
                      }}
                    />
                  </div>
                  <div>
                    <h3
                      className="serif"
                      style={{
                        fontWeight: 400,
                        fontSize: 18,
                        lineHeight: 1.2,
                        margin: 0,
                        letterSpacing: "-0.015em",
                      }}
                    >
                      {p.name}
                    </h3>
                    <div
                      className="cap-gold"
                      style={{
                        marginTop: 6,
                        fontSize: 10.5,
                      }}
                    >
                      {p.role}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <style>{`
            @media (max-width: 1000px) {
              .team-grid { grid-template-columns: repeat(3, 1fr) !important; }
            }
            @media (max-width: 720px) {
              .team-grid { grid-template-columns: repeat(2, 1fr) !important; }
            }
            @media (max-width: 480px) {
              .team-grid { grid-template-columns: 1fr !important; }
            }
          `}</style>
        </section>
      ))}

      {/* Cierre */}
      <section className="section">
        <div className="wrap-narrow" style={{ paddingTop: "var(--space-7)", paddingBottom: "var(--space-7)", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-5)" }}>
          <div className="cap-gold">Trabajá con la casa</div>
          <p
            className="serif"
            style={{
              fontWeight: 300,
              fontSize: "clamp(28px, 3.6vw, 44px)",
              lineHeight: 1.2,
              letterSpacing: "-0.015em",
              margin: 0,
              maxWidth: "22ch",
            }}
          >
            Cada portafolio se discute{" "}
            <em className="serif-i" style={{ color: "var(--gold-deep)" }}>
              entre todos.
            </em>
          </p>
          <p className="body-lead" style={{ margin: 0, maxWidth: "42em" }}>
            La recomendación al cliente no es la opinión aislada de un canal: es una conversación entre Directorio, Asesores, Mesa y Compliance.
          </p>
          <Link href="/contacto" className="btn btn-primary">
            Agendá una reunión <span className="arrow" />
          </Link>
        </div>
      </section>
    </main>
  );
}
