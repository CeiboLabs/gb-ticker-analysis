"use client";

import { useRef, useState } from "react";
import { ArrowRight } from "@/components/institucional/icons";
import { NEWSLETTER_CONSENT_TEXT } from "@/lib/newsletterConsent";
import { suggestEmailTypo } from "@/lib/emailValidation";

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
//
// Es el ÚNICO punto de captura de mails del sitio: lo usan el bloque de
// /informes y el gate de /analisis (que pasa source="analisis" y se queda con
// el éxito vía onSuccess para desbloquear el análisis en vez de mostrar el
// cartel de suscripción). Por eso la validación de dirección vive acá y la
// heredan los dos: el corrector de typos es local (lib/emailValidation.ts, puro)
// y el rechazo por desechable/MX lo hace la ruta.
export function NewsletterSignup({
  tone = "light",
  source = "informes",
  ctaLabel = "Suscribirme",
  sendingLabel = "Suscribiendo…",
  onSuccess,
}: {
  tone?: "light" | "navy";
  source?: string;
  ctaLabel?: string;
  sendingLabel?: string;
  /** Si viene, reemplaza el estado de éxito propio: decide el caller. */
  onSuccess?: () => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Corrección propuesta ("¿quisiste decir …?"). Es una SUGERENCIA: frena el
  // envío una sola vez y, si la persona vuelve a apretar, su dirección pasa tal
  // cual. Un dominio raro pero real —el corporativo de un cliente— no puede
  // quedar bloqueado por un corrector.
  const [sugerencia, setSugerencia] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navy = tone === "navy";

  async function enviar(email: string, consent: boolean, form: HTMLFormElement) {
    setStatus("sending");
    setErrorMsg(null);
    setSugerencia(null);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent, source }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        setErrorMsg(json?.error ?? "No pudimos anotarte. Probá de nuevo.");
        setStatus("error");
        return;
      }
      form.reset();
      setStatus("ok");
      // El alta ya dejó la cookie del gate (Set-Cookie en /api/newsletter), así
      // que el caller puede reintentar la acción bloqueada de inmediato.
      onSuccess?.();
    } catch {
      setErrorMsg("No pudimos anotarte. Probá de nuevo.");
      setStatus("error");
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const email = String(fd.get("email") ?? "").trim();
    const consent = fd.get("consent") === "on";

    // Primer intento: si el dominio parece mal tipeado, se propone la corrección
    // en vez de mandar. El segundo submit ya pasa de largo (sugerencia !== null).
    if (!sugerencia) {
      const propuesta = suggestEmailTypo(email);
      if (propuesta && propuesta.toLowerCase() !== email.toLowerCase()) {
        setSugerencia(propuesta);
        setErrorMsg(null);
        return;
      }
    }
    void enviar(email, consent, form);
  }

  /** Acepta la corrección: escribe el valor en el campo y manda. */
  function aceptarSugerencia() {
    const form = inputRef.current?.form;
    if (!sugerencia || !form || !inputRef.current) return;
    inputRef.current.value = sugerencia;
    const consent = (form.elements.namedItem("consent") as HTMLInputElement | null)?.checked ?? false;
    void enviar(sugerencia, consent, form);
  }

  if (status === "ok" && !onSuccess) {
    return (
      <div className={`nl-done${navy ? " nl-done--navy" : ""}`} role="status" aria-live="polite">
        <h3 className="t-h3" style={{ fontSize: 22 }}>Listo, quedaste suscripto.</h3>
        <p className="t-lead" style={{ marginTop: 12, marginBottom: 0 }}>
          Te vamos a escribir con cada nuevo informe y nuestras novedades.
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
          ref={inputRef}
          onChange={() => sugerencia && setSugerencia(null)}
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className={`ui-btn nl-submit ${navy ? "ui-btn-on-navy" : "ui-btn-primary"}`}
          style={{ opacity: status === "sending" ? 0.6 : 1 }}
        >
          {status === "sending" ? sendingLabel : ctaLabel}
          <ArrowRight />
        </button>
      </div>

      <label className="nl-consent-row">
        <input type="checkbox" name="consent" required className="nl-check" />
        <span className="nl-consent-text">{NEWSLETTER_CONSENT_TEXT}</span>
      </label>

      {/* Sugerencia de corrección. `aria-live` para que un lector de pantalla la
          anuncie: aparece sin que la persona haya cambiado de foco. */}
      {sugerencia && (
        <p className="nl-suggest" role="status" aria-live="polite">
          ¿Quisiste decir{" "}
          <button type="button" className="nl-suggest-btn" onClick={aceptarSugerencia}>
            {sugerencia}
          </button>
          ? Si no, apretá de nuevo y lo mandamos como lo escribiste.
        </p>
      )}

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
        .nl-suggest { margin: 0; font-size: 13px; line-height: 1.5; color: var(--site-ink-2); }
        .nl-suggest-btn {
          all: unset;
          cursor: pointer;
          font-weight: 700;
          color: var(--gold-deep);
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .nl-suggest-btn:hover { color: var(--site-ink); }
        .nl-form--navy .nl-suggest { color: rgba(255,255,255,0.78); }
        .nl-form--navy .nl-suggest-btn { color: var(--gold-soft); }
        .nl-form--navy .nl-suggest-btn:hover { color: #fff; }

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
