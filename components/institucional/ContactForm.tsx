"use client";

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "0",
  borderBottom: "1px solid var(--rule)",
  background: "transparent",
  padding: "10px 0",
  fontFamily: "var(--font-sans)",
  fontSize: 15,
  color: "var(--ink)",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  fontSize: 11,
  fontWeight: 500,
  color: "var(--ink-3)",
  display: "block",
  marginBottom: 4,
};

export function ContactForm() {
  return (
    <div style={{ borderTop: "1px solid var(--ink)", paddingTop: "var(--space-5)" }}>
      <div className="cap-gold" style={{ marginBottom: 6 }}>Escribinos</div>
      <h2
        className="serif"
        style={{
          fontWeight: 400,
          fontSize: 32,
          lineHeight: 1.1,
          margin: "0 0 var(--space-2)",
          letterSpacing: "-0.015em",
        }}
      >
        Envianos un mensaje.
      </h2>
      <p className="body-base" style={{ marginBottom: "var(--space-5)" }}>
        Completá el formulario y un asesor de la casa te responde a la brevedad.
      </p>

      <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }} className="form-row">
          <div>
            <label style={labelStyle}>Nombre</label>
            <input type="text" placeholder="Tu nombre" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Apellido</label>
            <input type="text" placeholder="Tu apellido" style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Email</label>
          <input type="email" placeholder="tu@email.com" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Teléfono</label>
          <input type="tel" placeholder="+598 99 123 456" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Motivo</label>
          <select style={inputStyle}>
            <option value="">Seleccioná una opción</option>
            <option value="cuenta">Abrir una cuenta</option>
            <option value="asesoria">Asesoramiento financiero</option>
            <option value="productos">Información de productos</option>
            <option value="otro">Otra consulta</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>Mensaje</label>
          <textarea
            placeholder="Contanos sobre tu consulta…"
            rows={4}
            style={{ ...inputStyle, resize: "none", padding: "10px 0", borderBottom: "1px solid var(--rule)" }}
          />
        </div>

        <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start", marginTop: "var(--space-2)" }}>
          Enviar mensaje <span className="arrow" />
        </button>
      </form>

      <style>{`
        .form-row { grid-template-columns: 1fr 1fr; }
        @media (max-width: 560px) {
          .form-row { grid-template-columns: 1fr !important; }
        }
        input:focus, select:focus, textarea:focus {
          border-bottom-color: var(--ink) !important;
        }
        input::placeholder, textarea::placeholder {
          color: var(--ink-3);
        }
      `}</style>
    </div>
  );
}
