"use client";

import { useState } from "react";
import { ArrowRight } from "@/components/institucional/icons";
import { NEWSLETTER_CONSENT_TEXT } from "@/lib/newsletterConsent";

type Status = "idle" | "sending" | "ok" | "error";

// Sólo la parte interactiva del bloque de newsletter: el campo de mail + la
// casilla de consentimiento. El encabezado (kicker, título, lead) lo pone la
// página, server-rendered, para no engordar el bundle cliente ni romper el ritmo
// de secciones. Etapa 1 = sólo recolección: el alta va a /api/newsletter → D1;
// todavía no se manda ningún mail, así que el éxito no promete confirmación
// inmediata, sino la próxima edición.
//
// `tone="navy"` = variante para el callout card navy (campo translúcido, botón
// blanco→oro, textos claros). Default "light" (sobre superficies claras).
export function NewsletterSignup({ tone = "light" }: { tone?: "light" | "navy" }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navy = tone === "navy";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    setStatus("sending");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: fd.get("email"),
          consent: fd.get("consent") === "on",
          source: "informes",
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        setErrorMsg(json?.error ?? "No pudimos anotarte. Probá de nuevo.");
        setStatus("error");
        return;
      }
      form.reset();
      setStatus("ok");
    } catch {
      setErrorMsg("No pudimos anotarte. Probá de nuevo.");
      setStatus("error");
    }
  }

  if (status === "ok") {
    return (
      <div className={`nl-done${navy ? " nl-done--navy" : ""}`} role="status" aria-live="polite">
        <h3 className="t-h3" style={{ fontSize: 22 }}>Listo, quedaste suscripto.</h3>
        <p className="t-lead" style={{ marginTop: 12, marginBottom: 0 }}>
          Te vamos a escribir con cada nuevo informe y las novedades de la casa.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`nl-form${navy ? " nl-form--navy" : ""}`}>
      <div className="nl-row">
        <input
          type="email"
          name="email"
          required
          maxLength={200}
          placeholder="tu@correo.com"
          aria-label="Tu correo"
          autoComplete="email"
          className="ui-input nl-email"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className={`ui-btn nl-submit ${navy ? "ui-btn-on-navy" : "ui-btn-primary"}`}
          style={{ opacity: status === "sending" ? 0.6 : 1 }}
        >
          {status === "sending" ? "Suscribiendo…" : "Suscribirme"}
          <ArrowRight />
        </button>
      </div>

      <label className="nl-consent-row">
        <input type="checkbox" name="consent" required className="nl-check" />
        <span className="nl-consent-text">{NEWSLETTER_CONSENT_TEXT}</span>
      </label>

      {status === "error" && errorMsg && <p className="nl-error">{errorMsg}</p>}

      <style>{`
        .nl-form { display: flex; flex-direction: column; gap: 16px; max-width: 34em; margin-top: 32px; }
        /* align-items: stretch → el botón toma el alto natural del input, así la
           fila inline queda pareja sin fijar alturas a mano. */
        .nl-row { display: flex; gap: 12px; align-items: stretch; }
        .nl-email { flex: 1 1 auto; min-width: 0; }
        .nl-submit { flex: none; }
        .nl-consent-row { display: flex; gap: 10px; align-items: flex-start; cursor: pointer; }
        .nl-check {
          margin-top: 3px;
          width: 16px; height: 16px;
          flex: none;
          accent-color: var(--navy);
          cursor: pointer;
        }
        .nl-consent-text { font-size: 12.5px; line-height: 1.5; color: var(--site-ink-3); }
        .nl-error { color: #b91c1c; font-size: 14px; margin: 0; }

        /* ── Variante sobre navy (callout card) ── */
        /* En el card el form vive en la columna derecha: sin margen superior y a
           todo el ancho. Campo translúcido + textos claros; el botón usa
           ui-btn-on-navy (blanco → oro en hover). */
        .nl-form--navy { margin-top: 0; max-width: none; }
        .nl-form--navy .nl-email {
          color: #fff;
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.22);
        }
        .nl-form--navy .nl-email::placeholder { color: rgba(255,255,255,0.5); }
        .nl-form--navy .nl-email:focus {
          border-color: rgba(255,255,255,0.6);
          box-shadow: 0 0 0 3px rgba(255,255,255,0.10);
        }
        .nl-form--navy .nl-consent-text { color: rgba(255,255,255,0.62); }
        .nl-form--navy .nl-check { accent-color: var(--gold-soft); }
        .nl-done--navy .t-h3 { color: #fff; }
        .nl-done--navy .t-lead { color: rgba(255,255,255,0.80); }

        @media (max-width: 520px) {
          .nl-row { flex-direction: column; align-items: stretch; }
        }
      `}</style>
    </form>
  );
}
