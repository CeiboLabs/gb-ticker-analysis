import { FAQ } from "@/components/institucional/FAQ";
import { ContactForm } from "@/components/institucional/ContactForm";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { Phone, Mail, Message, Pin } from "@/components/institucional/icons";

export const metadata: Metadata = {
  title: "Contacto · Bengochea & Cía.",
  description:
    "Agendá una reunión con la mesa de Bengochea & Cía. Oficina en WTC Montevideo, Uruguay.",
};

const CONTACTO_DATA: { icon: ReactNode; label: string; value: string; href: string }[] = [
  { icon: <Phone />, label: "Teléfono", value: "+598 2628 6447", href: "tel:+59826286447" },
  { icon: <Mail />, label: "Email general", value: "info@gbengochea.com.uy", href: "mailto:info@gbengochea.com.uy" },
  { icon: <Message />, label: "Reclamos", value: "reclamos@gbengochea.com.uy", href: "mailto:reclamos@gbengochea.com.uy" },
  { icon: <Pin />, label: "Dirección", value: "Luis A. de Herrera 1248 · WTC Torre I, Of. 707 · Montevideo", href: "https://maps.google.com/?q=World+Trade+Center+Montevideo+Torre+1" },
];

const HORARIOS = [
  ["Lunes a viernes", "9 : 00 — 18 : 00"],
  ["Sábados", "Cerrado"],
  ["Domingos y feriados", "Cerrado"],
];

export default function ContactoPage() {
  return (
    <main className="site">
      {/* Hero split — contenido + imagen */}
      <div className="hero-split">
        <Reveal as="div" className="hero-copy">
          <div className="kicker" style={{ color: "var(--gold-soft)" }}>
            Contacto · Montevideo
          </div>

          <h1 className="t-display" style={{ marginTop: 20, color: "#fff" }}>
            La mejor respuesta sigue siendo una conversación.
          </h1>

          <p className="t-lead" style={{ marginTop: 24, color: "rgba(255,255,255,0.86)" }}>
            Agendá una reunión, sin compromiso, con un asesor de la casa y recibí asesoramiento personalizado
            de acuerdo a tu perfil de inversor y necesidades particulares. En oficina o por videollamada.
          </p>
        </Reveal>
        <div className="hero-figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero/contacto.jpg" alt="Torres de oficinas de vidrio" />
        </div>
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
                {CONTACTO_DATA.map(({ icon, label, value, href }) => (
                  <StaggerItem as="div" key={label}>
                    <a
                      href={href}
                      target={href.startsWith("http") ? "_blank" : undefined}
                      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="ui-list-row"
                    >
                      <span style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                        <span className="list-icon" aria-hidden>{icon}</span>
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
              src="https://maps.google.com/maps?q=Luis+Alberto+de+Herrera+1248,+World+Trade+Center+Montevideo&z=16&hl=es&output=embed"
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
