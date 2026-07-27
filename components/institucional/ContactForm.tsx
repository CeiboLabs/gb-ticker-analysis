"use client";

import { useState } from "react";

const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

type Status = "idle" | "sending" | "ok" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    setStatus("sending");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: fd.get("nombre"),
          apellido: fd.get("apellido"),
          email: fd.get("email"),
          telefono: fd.get("telefono") || "",
          motivo: fd.get("motivo"),
          mensaje: fd.get("mensaje"),
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        setErrorMsg(json?.error ?? "No pudimos enviar tu mensaje. Intentá de nuevo.");
        setStatus("error");
        return;
      }
      form.reset();
      setStatus("ok");
    } catch {
      setErrorMsg("No pudimos enviar tu mensaje. Intentá de nuevo.");
      setStatus("error");
    }
  }

  return (
    <div className="site">
      <div className="eyebrow-sm">Escribinos</div>
      <h2 className="t-h3" style={{ marginTop: 16 }}>Envianos un mensaje.</h2>
      <p className="t-lead" style={{ marginTop: 16, marginBottom: 36, maxWidth: "30em" }}>
        Completá el formulario y un asesor nuestro te responde a la brevedad.
      </p>

      {status === "ok" ? (
        <div style={{ maxWidth: "34em" }}>
          <h3 className="t-h3" style={{ fontSize: 22 }}>Mensaje enviado.</h3>
          <p className="t-lead" style={{ marginTop: 12 }}>
            Gracias por escribirnos. Un asesor nuestro se va a poner en
            contacto a la brevedad.
          </p>
        </div>
      ) : (
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <label className="ui-label">Nombre</label>
            <input type="text" name="nombre" required minLength={2} maxLength={100} placeholder="Tu nombre" className="ui-input" />
          </div>
          <div>
            <label className="ui-label">Apellido</label>
            <input type="text" name="apellido" required minLength={2} maxLength={100} placeholder="Tu apellido" className="ui-input" />
          </div>
        </div>

        <div>
          <label className="ui-label">Email</label>
          <input type="email" name="email" required maxLength={200} placeholder="tu@email.com" className="ui-input" />
        </div>

        <div>
          <label className="ui-label">Teléfono</label>
          <input type="tel" name="telefono" maxLength={40} placeholder="+598 99 123 456" className="ui-input" />
        </div>

        <div>
          <label className="ui-label">Motivo</label>
          <select name="motivo" required defaultValue="" className="ui-input">
            <option value="" disabled>Seleccioná una opción</option>
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
            name="mensaje"
            required
            minLength={10}
            maxLength={2000}
            placeholder="Contanos sobre tu consulta…"
            rows={4}
            className="ui-input"
            style={{ resize: "vertical" }}
          />
        </div>

        {errorMsg && (
          <p style={{ color: "#b91c1c", fontSize: 14, margin: 0 }}>{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={status === "sending"}
          className="ui-btn ui-btn-primary"
          style={{ alignSelf: "flex-start", marginTop: 4, display: "inline-flex", alignItems: "center", gap: 8, opacity: status === "sending" ? 0.6 : 1 }}
        >
          {status === "sending" ? "Enviando…" : "Enviar mensaje"}
          <span style={{ width: 18, height: 18, display: "inline-flex" }}><ArrowRight /></span>
        </button>
      </form>
      )}

      <style>{`
        @media (max-width: 640px) {
          .form-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
