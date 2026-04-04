import { FAQ } from "@/components/institucional/FAQ";
import { ContactForm } from "@/components/institucional/ContactForm";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contacto | Gastón Bengochea",
  description: "Contactanos para comenzar a invertir. Oficinas en World Trade Center, Montevideo.",
};

const CONTACTO_INFO = [
  {
    title: "Teléfono",
    value: "+598 2628 6447",
    href: "tel:+59826286447",
    color: "from-blue-500 to-blue-600",
    icon: "📞",
  },
  {
    title: "Email",
    value: "info@gbengochea.com.uy",
    href: "mailto:info@gbengochea.com.uy",
    color: "from-emerald-500 to-emerald-600",
    icon: "✉️",
  },
  {
    title: "Reclamos",
    value: "reclamos@gbengochea.com.uy",
    href: "mailto:reclamos@gbengochea.com.uy",
    color: "from-amber-500 to-amber-600",
    icon: "💬",
  },
  {
    title: "Dirección",
    value: "Luis A. de Herrera 1248, WTC Torre I, Of. 707, Montevideo",
    href: "https://maps.google.com/?q=World+Trade+Center+Montevideo+Torre+1",
    color: "from-violet-500 to-violet-600",
    icon: "📍",
  },
];

const HORARIOS = [
  { dia: "Lunes a Viernes", horario: "9:00 - 18:00" },
  { dia: "Sábados", horario: "Cerrado" },
  { dia: "Domingos y Feriados", horario: "Cerrado" },
];

export default function ContactoPage() {
  return (
    <main className="pt-20">
      {/* Hero */}
      <section className="relative py-24 sm:py-32 px-6 overflow-hidden" style={{ background: "linear-gradient(135deg, #03065E 0%, #0a0f6e 50%, #03065E 100%)" }}>
        <div
          className="absolute top-[-10%] right-[5%] w-[500px] h-[500px] rounded-full animate-float-slow pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(201,168,76,0.1) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute bottom-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full animate-float-slow pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
            filter: "blur(70px)",
            animationDelay: "-6s",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="max-w-3xl mx-auto text-center relative">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-6 leading-[1.1]">
            Estamos para{" "}
            <span className="gradient-text">ayudarte</span>
          </h1>
          <p className="text-base sm:text-lg text-white/45 max-w-lg mx-auto leading-relaxed">
            Nuestro equipo está disponible para responder tus consultas y
            acompañarte en tus decisiones de inversión.
          </p>
        </div>
      </section>

      {/* Contact info + form */}
      <section className="bg-[#F8F9FF] py-16 sm:py-24 px-6 relative overflow-hidden">
        <div
          className="absolute top-[20%] right-[-5%] w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div className="max-w-5xl mx-auto relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Info */}
            <div>
              <h2 className="text-xl font-bold text-[#03065E] mb-8">
                Información de Contacto
              </h2>

              <div className="space-y-4 mb-10">
                {CONTACTO_INFO.map((c, i) => (
                  <a
                    key={c.title}
                    href={c.href}
                    target={c.href.startsWith("http") ? "_blank" : undefined}
                    rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="group flex items-start gap-4 glass-light rounded-xl p-4 glow-card transition-all duration-500 cursor-pointer"
                    style={{ transitionDelay: `${i * 60}ms` }}
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                      {c.icon}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#03065E]/40 mb-0.5">
                        {c.title}
                      </p>
                      <p className="text-sm text-[#03065E] group-hover:text-[#C9A84C] transition-colors">
                        {c.value}
                      </p>
                    </div>
                  </a>
                ))}
              </div>

              {/* Horarios */}
              <div className="glass-light rounded-2xl p-6 gradient-border">
                <h3 className="text-sm font-semibold text-[#03065E] mb-4">
                  Horario de Atención
                </h3>
                <div className="space-y-3">
                  {HORARIOS.map((h) => (
                    <div key={h.dia} className="flex justify-between items-center">
                      <span className="text-sm text-[#03065E]/50">
                        {h.dia}
                      </span>
                      <span className={`text-sm font-medium px-3 py-1 rounded-full ${h.horario === "Cerrado" ? "bg-red-50 text-red-400" : "bg-emerald-50 text-emerald-600"}`}>
                        {h.horario}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Contact form */}
            <ContactForm />
          </div>
        </div>
      </section>

      {/* Map */}
      <section className="relative py-16 px-6 overflow-hidden" style={{ background: "linear-gradient(135deg, #03065E 0%, #080d5a 100%)" }}>
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="max-w-5xl mx-auto relative">
          <div className="glass rounded-2xl overflow-hidden glow-gold">
            <iframe
              title="Ubicación Gastón Bengochea"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3272.1!2d-56.1585!3d-34.8941!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x959f802b6f48fa4d%3A0x2c9b7d94b0e8c9f!2sWorld%20Trade%20Center%20Montevideo!5e0!3m2!1ses!2suy!4v1"
              width="100%"
              height="350"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="opacity-80"
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <ScrollReveal>
        <FAQ />
      </ScrollReveal>
    </main>
  );
}
