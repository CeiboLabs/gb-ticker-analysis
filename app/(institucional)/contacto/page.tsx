import { FAQ } from "@/components/institucional/FAQ";
import { ContactForm } from "@/components/institucional/ContactForm";
import type { Metadata } from "next";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";

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
    <main className="site">
      {/* Hero full-bleed */}
      <div className="hero-media">
        <div className="media-ph" aria-hidden />
        <div className="scrim" aria-hidden />

        <Reveal as="div" className="site-wrap hero-content">
          <div className="kicker" style={{ color: "var(--gold-soft)" }}>
            Contacto · Montevideo
          </div>

          <h1 className="t-display" style={{ marginTop: 20, maxWidth: "16ch", color: "#fff" }}>
            La mejor respuesta sigue siendo una conversación.
          </h1>

          <p className="t-lead" style={{ maxWidth: "38em", marginTop: 24, color: "rgba(255,255,255,0.86)" }}>
            Agendá una reunión, sin compromiso, con un asesor de la casa. En oficina, por videollamada o donde corresponda.
          </p>
        </Reveal>
      </div>

      {/* Info + Form */}
      <section className="band site-section">
        <div className="site-wrap">
          <div className="split">
            {/* Datos de la casa */}
            <div>
              <Reveal as="div">
                <div className="eyebrow-sm">Datos de la casa</div>
                <h2 className="t-h2" style={{ marginTop: 16, maxWidth: "12em" }}>
                  Cuatro maneras de llegar a nosotros.
                </h2>
                <p className="t-lead" style={{ marginTop: 20, maxWidth: "30em" }}>
                  Cualquiera funciona. La oficina recibe con cita previa.
                </p>
              </Reveal>

              <Stagger as="div" className="ui-list" style={{ marginTop: 32 }}>
                {CONTACTO_DATA.map(([label, value, href]) => (
                  <StaggerItem as="div" key={label}>
                    <a
                      href={href}
                      target={href.startsWith("http") ? "_blank" : undefined}
                      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="ui-list-row"
                    >
                      <span>
                        <span className="eyebrow-sm" style={{ display: "block" }}>{label}</span>
                        <span
                          style={{
                            display: "block",
                            marginTop: 6,
                            fontSize: 18,
                            fontWeight: 400,
                            letterSpacing: "-0.01em",
                            color: "var(--site-ink)",
                          }}
                        >
                          {value}
                        </span>
                      </span>
                    </a>
                  </StaggerItem>
                ))}
              </Stagger>

              {/* Horarios en hairline-rows */}
              <Reveal as="div" style={{ marginTop: 40 }}>
                <div className="eyebrow-sm">Horario de atención</div>
                <div style={{ marginTop: 18, borderTop: "1px solid var(--site-border)" }}>
                  {HORARIOS.map(([dia, hora]) => (
                    <div
                      key={dia}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: 16,
                        padding: "16px 0",
                        borderBottom: "1px solid var(--site-border)",
                      }}
                    >
                      <span className="t-body" style={{ margin: 0, color: "var(--site-ink)" }}>{dia}</span>
                      <span
                        className="t-body"
                        style={{
                          margin: 0,
                          fontWeight: 400,
                          color: hora === "Cerrado" ? "var(--site-ink-3)" : "var(--navy-500)",
                        }}
                      >
                        {hora}
                      </span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            <Reveal as="div">
              <ContactForm />
            </Reveal>
          </div>
        </div>
      </section>

      {/* Mapa */}
      <section className="band-muted site-section">
        <div className="site-wrap">
          <Reveal as="div" className="split-label">
            <div className="eyebrow-sm">Ubicación</div>
            <div>
              <h2 className="t-h2" style={{ maxWidth: "14em" }}>World Trade Center · Montevideo.</h2>
              <p className="t-lead" style={{ marginTop: 20, maxWidth: "34em" }}>
                Torre I, oficina 707. A cinco minutos del puerto y a diez de Pocitos.
              </p>
            </div>
          </Reveal>

          <div
            style={{
              marginTop: 56,
              border: "1px solid var(--site-border)",
              overflow: "hidden",
            }}
          >
            <iframe
              title="Ubicación Bengochea & Cía."
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3272.1!2d-56.1585!3d-34.8941!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x959f802b6f48fa4d%3A0x2c9b7d94b0e8c9f!2sWorld%20Trade%20Center%20Montevideo!5e0!3m2!1ses!2suy!4v1"
              width="100%"
              height="420"
              style={{ border: 0, display: "block", filter: "grayscale(60%) contrast(0.98)" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <Reveal as="div">
        <FAQ />
      </Reveal>
    </main>
  );
}
