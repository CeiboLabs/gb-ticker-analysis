import { FAQ } from "@/components/institucional/FAQ";
import { ContactForm } from "@/components/institucional/ContactForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contacto · Bengochea & Cía.",
  description:
    "Agendá una reunión con la mesa de Bengochea & Cía. Oficina en WTC Montevideo, Uruguay.",
};

const CONTACTO_DATA = [
  ["Teléfono", "+598 2628 6447", "tel:+59826286447"],
  ["Email general", "info@gbengochea.com.uy", "mailto:info@gbengochea.com.uy"],
  ["Reclamos", "reclamos@gbengochea.com.uy", "mailto:reclamos@gbengochea.com.uy"],
  ["Dirección", "Luis A. de Herrera 1248 · WTC Torre I, Of. 707 · Montevideo", "https://maps.google.com/?q=World+Trade+Center+Montevideo+Torre+1"],
];

const HORARIOS = [
  ["Lunes a viernes", "9 : 00 — 18 : 00"],
  ["Sábados", "Cerrado"],
  ["Domingos y feriados", "Cerrado"],
];

export default function ContactoPage() {
  return (
    <main>
      {/* Hero */}
      <section className="section-navy" style={{ position: "relative", overflow: "hidden" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(50% 70% at 10% 10%, rgba(201,168,76,0.08), transparent 60%)",
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
            <span className="cap" style={{ color: "rgba(255,255,255,0.55)" }}>Contacto · Montevideo</span>
            <span className="cap mono" style={{ color: "rgba(255,255,255,0.55)" }}>WTC · Torre I · Of. 707</span>
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
            La mejor respuesta sigue siendo{" "}
            <em style={{ fontStyle: "italic", color: "var(--gold-soft)", fontWeight: 300 }}>
              una conversación.
            </em>
          </h1>

          <p
            className="lede"
            style={{
              maxWidth: "38em",
              color: "rgba(255,255,255,0.82)",
              marginTop: "var(--space-5)",
            }}
          >
            Agendá una reunión, sin compromiso, con un asesor de la casa. En oficina, por videollamada o donde corresponda.
          </p>
        </div>
      </section>

      {/* Info + Form */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">01 / 03</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>Datos de la casa</div>
            </div>
            <div>
              <h2>Cuatro maneras de llegar a nosotros.</h2>
              <p className="dek">
                Cualquiera funciona. La oficina recibe con cita previa.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)",
              gap: "var(--space-7)",
              alignItems: "start",
            }}
            className="contacto-grid"
          >
            <div>
              <ol style={{ listStyle: "none", padding: 0, margin: 0, borderTop: "1px solid var(--ink)" }}>
                {CONTACTO_DATA.map(([label, value, href]) => (
                  <li
                    key={label}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(120px, 160px) 1fr",
                      gap: "var(--space-4)",
                      padding: "var(--space-4) 0",
                      borderBottom: "1px solid var(--rule)",
                      alignItems: "baseline",
                    }}
                  >
                    <span className="cap" style={{ color: "var(--ink-2)" }}>{label}</span>
                    <a
                      href={href}
                      target={href.startsWith("http") ? "_blank" : undefined}
                      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="body-base contacto-link"
                      style={{ color: "var(--ink)" }}
                    >
                      {value}
                    </a>
                  </li>
                ))}
              </ol>

              {/* Horarios */}
              <div style={{ marginTop: "var(--space-6)" }}>
                <div className="cap-gold" style={{ marginBottom: "var(--space-2)" }}>Horario de atención</div>
                <table className="fin-table" style={{ marginTop: "var(--space-2)" }}>
                  <tbody>
                    {HORARIOS.map(([dia, hora]) => (
                      <tr key={dia}>
                        <td style={{ fontFamily: "var(--font-sans)" }}>{dia}</td>
                        <td className={hora === "Cerrado" ? "neg-fg" : "pos-fg"}>{hora}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <ContactForm />
          </div>
        </div>

        <style>{`
          .contacto-link {
            border-bottom: 1px solid transparent;
            transition: border-color 160ms ease;
          }
          .contacto-link:hover { border-bottom-color: var(--gold); }

          @media (max-width: 900px) {
            .contacto-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </section>

      {/* Mapa */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="sec-num">02 / 03</div>
              <div className="cap-gold" style={{ marginTop: 8 }}>Ubicación</div>
            </div>
            <div>
              <h2>World Trade Center · Montevideo.</h2>
              <p className="dek">
                Torre I, oficina 707. A cinco minutos del puerto y a diez de Pocitos.
              </p>
            </div>
          </div>

          <div style={{ border: "1px solid var(--ink)" }}>
            <iframe
              title="Ubicación Bengochea & Cía."
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3272.1!2d-56.1585!3d-34.8941!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x959f802b6f48fa4d%3A0x2c9b7d94b0e8c9f!2sWorld%20Trade%20Center%20Montevideo!5e0!3m2!1ses!2suy!4v1"
              width="100%"
              height="380"
              style={{ border: 0, display: "block", filter: "grayscale(80%) contrast(0.95)" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FAQ />
    </main>
  );
}
