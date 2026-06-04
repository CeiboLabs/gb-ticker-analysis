"use client";

const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export function ContactForm() {
  return (
    <div className="site">
      <div className="eyebrow-sm">Escribinos</div>
      <h2 className="t-h3" style={{ marginTop: 16 }}>Envianos un mensaje.</h2>
      <p className="t-lead" style={{ marginTop: 16, marginBottom: 36, maxWidth: "30em" }}>
        Completá el formulario y un asesor de la casa te responde a la brevedad.
      </p>

      <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <label className="ui-label">Nombre</label>
            <input type="text" placeholder="Tu nombre" className="ui-input" />
          </div>
          <div>
            <label className="ui-label">Apellido</label>
            <input type="text" placeholder="Tu apellido" className="ui-input" />
          </div>
        </div>

        <div>
          <label className="ui-label">Email</label>
          <input type="email" placeholder="tu@email.com" className="ui-input" />
        </div>

        <div>
          <label className="ui-label">Teléfono</label>
          <input type="tel" placeholder="+598 99 123 456" className="ui-input" />
        </div>

        <div>
          <label className="ui-label">Motivo</label>
          <select className="ui-input">
            <option value="">Seleccioná una opción</option>
            <option value="cuenta-personal">Abrir una cuenta personal</option>
            <option value="cuenta-empresa">Abrir una cuenta empresa</option>
            <option value="asesoria">Asesoramiento financiero</option>
            <option value="productos">Información de productos</option>
            <option value="otro">Otra consulta</option>
          </select>
        </div>

        <div>
          <label className="ui-label">Mensaje</label>
          <textarea
            placeholder="Contanos sobre tu consulta…"
            rows={4}
            className="ui-input"
            style={{ resize: "vertical" }}
          />
        </div>

        <button
          type="submit"
          className="ui-btn ui-btn-primary"
          style={{ alignSelf: "flex-start", marginTop: 4, display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          Enviar mensaje
          <span style={{ width: 18, height: 18, display: "inline-flex" }}><ArrowRight /></span>
        </button>
      </form>

      <style>{`
        @media (max-width: 640px) {
          .form-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
