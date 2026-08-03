"use client";

// Seguimiento de acciones dentro del informe: el control, el aviso de cambio y
// la lista de seguidos.
//
// LA PRUEBA DE FUEGO de estas piezas: si les sacás la captación de datos, ¿el
// lector las extraña? Sí — seguir una acción y enterarse de que la calificación
// cambió es una función que la gente busca en otras plataformas. Que además
// necesite un correo para funcionar es una consecuencia, no el objetivo. Eso es
// lo que las separa de un CTA.

import { useCallback, useEffect, useState } from "react";
import { NewsletterSignup } from "@/components/institucional/NewsletterSignup";

type EstadoFollow = {
  identificado: boolean;
  siguiendo: boolean;
  esCliente?: boolean;
};

export type SeguidoUI = {
  ticker: string;
  desde: number;
  vistoEl: number | null;
  cambio: {
    verdictoAntes: string | null;
    verdictoAhora: string | null;
    precioAntes: number | null;
    precioAhora: number | null;
    variacion: number | null;
    cambioVerdicto: boolean;
  } | null;
};

const Check = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

async function postFollow(body: Record<string, unknown>): Promise<Response> {
  return fetch("/api/follow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/* ══════════════════════════════════════════════════════════════
   Celda de la ficha técnica
   ══════════════════════════════════════════════════════════════ */

export function FollowCell({ ticker }: { ticker: string }) {
  const [estado, setEstado] = useState<EstadoFollow | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // Se pregunta UNA vez, en el momento de seguir: es el único punto donde el dato
  // no interrumpe nada. A un cliente de la casa no se le ofrece abrir una cuenta
  // que ya tiene — su aviso va a su asesor.
  const [soyCliente, setSoyCliente] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/follow?ticker=${encodeURIComponent(ticker)}`, {
        headers: { Accept: "application/json" },
      });
      if (r.ok) setEstado(await r.json());
    } catch {
      // sin estado el control no se dibuja: es una función de más, no del informe
    }
  }, [ticker]);

  // Sin resets al cambiar de ticker: el padre monta esta celda con key={ticker},
  // así que un ticker nuevo es un componente nuevo con estado limpio. Resetear
  // acá además viola la regla de no llamar setState sincrónico en un effect.
  useEffect(() => {
    if (!ticker) return;
    queueMicrotask(() => void cargar());
  }, [ticker, cargar]);

  // Al entrar a un informe que YA se sigue, se sella lo que la persona está
  // viendo: es lo que apaga el aviso de cambio recién cuando efectivamente lo leyó.
  useEffect(() => {
    if (estado?.identificado && estado.siguiendo) {
      void postFollow({ ticker, accion: "visto" }).catch(() => {});
    }
  }, [estado?.identificado, estado?.siguiendo, ticker]);

  async function seguir() {
    if (!estado) return;
    if (!estado.identificado) { setAbierto(true); return; }
    setEnviando(true);
    try {
      await postFollow({ ticker, accion: "seguir", esCliente: soyCliente });
      await cargar();
      setAbierto(false);
    } finally {
      setEnviando(false);
    }
  }

  async function dejar() {
    setEnviando(true);
    try {
      await postFollow({ ticker, accion: "dejar" });
      await cargar();
    } finally {
      setEnviando(false);
    }
  }

  // Mientras no sabemos el estado, la celda queda vacía en lugar de parpadear
  // entre "Seguir" y "Siguiendo".
  if (!estado) return <div className="cell sg-cell" aria-hidden />;

  return (
    <div className="cell sg-cell">
      <div className="label">Seguimiento</div>
      {estado.siguiendo ? (
        <div className="sg-on">
          <span className="sg-on-t"><Check /> Siguiendo</span>
          <button type="button" className="sg-drop" onClick={dejar} disabled={enviando}>
            dejar
          </button>
        </div>
      ) : (
        <button type="button" className="sg-btn" onClick={seguir} disabled={enviando}>
          <span className="sg-dot" aria-hidden />
          {enviando ? "…" : `Seguir ${ticker}`}
        </button>
      )}

      {abierto && !estado.identificado && (
        <div className="sg-panel" role="dialog" aria-label="Seguir esta acción">
          <div className="sg-panel-t">Te avisamos cuando cambie.</div>
          <p className="sg-panel-b">
            Si la casa cambia la calificación de {ticker}, o cuando la empresa presente resultados,
            te llega un aviso. Dejanos tu correo.
          </p>
          {/* El MISMO punto de captura del resto del sitio: un solo formulario, un
              solo consentimiento, un solo lugar donde vive la validación. Al
              volver con éxito ya está la cookie, así que se sigue de inmediato. */}
          <NewsletterSignup
            source="analisis-seguir"
            ctaLabel="Seguir"
            sendingLabel="Anotando…"
            onSuccess={() => { void seguir(); }}
          />
          <label className="sg-check">
            <input type="checkbox" checked={soyCliente} onChange={(e) => setSoyCliente(e.target.checked)} />
            <span>Ya soy cliente de Bengochea &amp; Cía.</span>
          </label>
          <button type="button" className="sg-cerrar" onClick={() => setAbierto(false)}>Cancelar</button>
        </div>
      )}

      <style>{`
        .sg-cell { position: relative; }
        .sg-btn, .sg-drop, .sg-cerrar {
          font-family: var(--site-font); cursor: pointer; background: none;
          line-height: 1.2; padding: 0;
        }
        .sg-btn {
          display: inline-flex; align-items: center; gap: 7px; margin-top: 4px;
          font-size: 13px; font-weight: 700; color: var(--navy);
          border: 1px solid var(--rule-strong); border-radius: 3px; padding: 5px 11px;
          white-space: nowrap; transition: border-color 0.16s ease;
        }
        .sg-btn:hover:not(:disabled) { border-color: var(--navy); }
        .sg-btn:disabled { opacity: 0.55; cursor: default; }
        .sg-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--gold-deep); flex: none; }
        .sg-on { display: flex; align-items: baseline; gap: 10px; margin-top: 5px; flex-wrap: wrap; }
        .sg-on-t {
          display: inline-flex; align-items: center; gap: 5px; font-family: var(--site-font);
          font-size: 13.5px; font-weight: 700; color: var(--pos);
        }
        .sg-drop { font-size: 12px; color: var(--ink-3); text-decoration: underline; text-underline-offset: 2px; border: 0; }
        .sg-drop:hover:not(:disabled) { color: var(--ink); }
        .sg-drop:disabled { opacity: 0.5; cursor: default; }

        /* Panel anclado a la celda. Absoluto para no empujar la ficha —que es una
           grilla de hairlines y se descuadra si una celda crece— y alineado a la
           derecha porque es la última columna. */
        .sg-panel {
          position: absolute; top: calc(100% + 8px); right: 0; z-index: 6;
          width: min(340px, calc(100vw - 40px)); box-sizing: border-box;
          background: var(--surface); border: 1px solid var(--rule);
          border-top: 1px solid var(--ink); border-radius: 3px;
          padding: 18px 18px 16px; box-shadow: 0 18px 44px rgba(3, 6, 94, 0.12);
          text-align: left;
        }
        .sg-panel-t { font-family: var(--site-font); font-size: 16px; font-weight: 700; color: var(--ink); }
        .sg-panel-b {
          font-family: var(--site-font); font-size: 13px; line-height: 1.55;
          color: var(--ink-2); margin: 8px 0 0;
        }
        .sg-panel .nl-form { margin-top: 14px; gap: 12px; }
        .sg-panel .ui-input { font-size: 13.5px; border-radius: 3px; padding: 9px 11px; }
        .sg-panel .ui-btn { font-size: 13px; font-weight: 500; border-radius: 3px; padding: 9px 16px; box-shadow: none; }
        .sg-panel .nl-consent-text { font-size: 11.5px; }
        .sg-check {
          display: flex; align-items: flex-start; gap: 8px; margin-top: 14px;
          padding-top: 12px; border-top: 1px solid var(--rule);
          font-family: var(--site-font); font-size: 12px; color: var(--ink-2); cursor: pointer;
        }
        .sg-check input { margin-top: 2px; flex: none; }
        .sg-cerrar {
          margin-top: 12px; font-size: 12px; color: var(--ink-3);
          border: 0; text-decoration: underline; text-underline-offset: 2px;
        }
        .sg-cerrar:hover { color: var(--ink); }
        @media (max-width: 640px) {
          .sg-panel { right: auto; left: 0; }
        }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Aviso de cambio + lista de seguidos
   ══════════════════════════════════════════════════════════════ */

/**
 * Tira sobre el informe con lo que se movió en las acciones que la persona sigue.
 *
 * FUNCIONA SIN CORREO: el diff sale de comparar el veredicto que vio con el
 * vigente, las dos cosas en la base. Cuando exista el envío de mails, lee esto
 * mismo y no hay que rehacer nada.
 *
 * Se pide UNA vez al montar y no se refresca: es un resumen de "qué pasó mientras
 * no estabas", no un ticker en vivo.
 */
export function SeguidosStrip({ tickerActual, onSelect }: { tickerActual: string; onSelect: (t: string) => void }) {
  const [seguidos, setSeguidos] = useState<SeguidoUI[] | null>(null);

  useEffect(() => {
    let cancelado = false;
    queueMicrotask(() => {
      fetch("/api/follow", { headers: { Accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { identificado?: boolean; seguidos?: SeguidoUI[] } | null) => {
          if (!cancelado && j?.identificado && Array.isArray(j.seguidos)) setSeguidos(j.seguidos);
        })
        .catch(() => {});
    });
    return () => { cancelado = true; };
  }, []);

  if (!seguidos || seguidos.length === 0) return null;

  // Los cambios de calificación van primero: es la única señal que merece
  // interrumpir. El resto de la lista es navegación.
  const conCambio = seguidos.filter((s) => s.cambio?.cambioVerdicto && s.ticker !== tickerActual);

  return (
    <div className="sgs-root">
      <div className="site-wrap sgs-wrap">
        <span className="sgs-lbl">Seguís</span>
        <div className="sgs-list">
          {seguidos.map((s) => {
            const cambio = s.cambio?.cambioVerdicto && s.ticker !== tickerActual;
            const activo = s.ticker === tickerActual;
            return (
              <button
                key={s.ticker}
                type="button"
                className={`sgs-tk${activo ? " is-activo" : ""}${cambio ? " is-cambio" : ""}`}
                onClick={() => onSelect(s.ticker)}
                title={
                  cambio
                    ? `Cambió de ${s.cambio?.verdictoAntes} a ${s.cambio?.verdictoAhora} desde tu última visita`
                    : undefined
                }
              >
                {s.ticker}
                {cambio && <span className="sgs-punto" aria-hidden />}
              </button>
            );
          })}
        </div>
        {conCambio.length > 0 && (
          <span className="sgs-aviso">
            {conCambio.length === 1
              ? `${conCambio[0].ticker} pasó de ${conCambio[0].cambio?.verdictoAntes} a ${conCambio[0].cambio?.verdictoAhora}`
              : `${conCambio.length} cambiaron de calificación desde tu última visita`}
          </span>
        )}
      </div>

      <style>{`
        .sgs-root { background: var(--surface-muted); border-bottom: 1px solid var(--rule); }
        .sgs-wrap {
          display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
          padding-top: 10px; padding-bottom: 10px;
        }
        .sgs-lbl {
          font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--ink-3); flex: none;
        }
        .sgs-list { display: flex; gap: 6px; flex-wrap: wrap; }
        .sgs-tk {
          position: relative; font-family: var(--font-mono); font-size: 11.5px;
          letter-spacing: 0.04em; padding: 3px 8px; border: 1px solid var(--rule-strong);
          border-radius: 3px; background: var(--surface); color: var(--ink-2);
          cursor: pointer; white-space: nowrap; line-height: 1.3;
        }
        .sgs-tk:hover { border-color: var(--navy); color: var(--navy); }
        .sgs-tk.is-activo { border-color: var(--ink); color: var(--ink); font-weight: 600; }
        .sgs-tk.is-cambio { border-color: var(--gold-deep); color: var(--ink); }
        /* El punto marca "esto se movió": el color solo no alcanza, así que el
           tooltip y el aviso de al lado dicen QUÉ cambió. */
        .sgs-punto {
          position: absolute; top: -3px; right: -3px; width: 6px; height: 6px;
          border-radius: 999px; background: var(--gold-deep);
          box-shadow: 0 0 0 2px var(--surface-muted);
        }
        .sgs-aviso { font-family: var(--site-font); font-size: 12.5px; color: var(--ink-2); }
      `}</style>
    </div>
  );
}
