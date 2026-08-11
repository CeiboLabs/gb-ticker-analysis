"use client";

// Seguimiento de acciones dentro del informe: el control, el aviso de cambio y
// la lista de seguidos.
//
// LA PRUEBA DE FUEGO de estas piezas: si les sacás la captación de datos, ¿el
// lector las extraña? Sí — seguir una acción y enterarse de que la calificación
// cambió es una función que la gente busca en otras plataformas. Que además
// necesite un correo para funcionar es una consecuencia, no el objetivo. Eso es
// lo que las separa de un CTA.
//
// DÓNDE VA EL CONTROL, y por qué se movió. Vivía como una SEXTA celda de la
// ficha técnica (Reporte ID · Mesa · Cobertura · Horizonte · Generado), y estaba
// mal por dos razones:
//   · La ficha describe el DOCUMENTO. Seguir es una acción sobre la ACCIÓN y un
//     estado del LECTOR: otra categoría. Por eso se leía pegado con cinta.
//   · `.hairline-row` es `repeat(5, 1fr)`: la sexta celda caía sola a una
//     segunda fila, sin borde derecho y más alta que las de arriba.
// Ahora va en la barra de acciones del masthead, colgando de la identidad de la
// acción —que es lo que se sigue—, junto a Exportar PDF y Actualizar análisis y
// con su mismo vestido (.am-btn). Es la convención de la industria: Morningstar
// lo cuelga del menú de la cabecera del ticker, y Seeking Alpha rehizo lo mismo
// al mover sus avisos al lado del dato que avisan.

import { useCallback, useEffect, useRef, useState } from "react";
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

// Marcador de línea, en el mismo dibujo geométrico que los íconos del masthead
// (viewBox 24, trazo fino, sin relleno). Relleno sólo cuando ya se sigue: ahí el
// oro marca un ESTADO real, que es el único uso que la guía le concede además de
// la palabra del titular. En reposo el botón no lleva ni una gota de color.
const Marcador = ({ activo }: { activo: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill={activo ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M6 3h12v18l-6-4.5L6 21z" />
  </svg>
);

async function postFollow(body: Record<string, unknown>): Promise<void> {
  const r = await fetch("/api/follow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // El 429 y el 503 son los que antes se tragaba el `.catch(() => {})`: el botón
  // quedaba mudo y parecía roto. Ahora vuelven como error y el control lo dice.
  if (!r.ok) {
    const msg = r.status === 429
      ? "Demasiados intentos. Probá en unos minutos."
      : "No se pudo guardar. Probá de nuevo.";
    throw new Error(msg);
  }
}

/* ══════════════════════════════════════════════════════════════
   Control en la barra de acciones del masthead
   ══════════════════════════════════════════════════════════════ */

export function FollowButton({ ticker }: { ticker: string }) {
  const [estado, setEstado] = useState<EstadoFollow | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Se pregunta UNA vez, en el momento de seguir: es el único punto donde el dato
  // no interrumpe nada. A un cliente de la casa no se le ofrece abrir una cuenta
  // que ya tiene — su aviso va a su asesor.
  const [soyCliente, setSoyCliente] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);

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

  // Sin resets al cambiar de ticker: el padre monta este control con key={ticker},
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

  // El panel es un popover en la cabecera: se cierra con Escape y con un click
  // afuera, como cualquier otro. Antes sólo tenía "Cancelar" porque vivía
  // incrustado en la ficha técnica y no tapaba nada.
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    const onDown = (e: MouseEvent) => {
      if (!raizRef.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [abierto]);

  async function seguir() {
    if (!estado) return;
    if (!estado.identificado) { setAbierto(true); return; }
    setEnviando(true);
    setError(null);
    try {
      await postFollow({ ticker, accion: "seguir", esCliente: soyCliente });
      await cargar();
      setAbierto(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setEnviando(false);
    }
  }

  async function dejar() {
    setEnviando(true);
    setError(null);
    try {
      await postFollow({ ticker, accion: "dejar" });
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setEnviando(false);
    }
  }

  // Mientras no sabemos el estado no se dibuja nada: el botón parpadearía entre
  // "Seguir" y "Siguiendo". Sin reservar hueco — la barra de acciones es flex y
  // los otros dos botones no se mueven de lugar al aparecer éste a su izquierda.
  if (!estado) return null;

  const siguiendo = estado.siguiendo;

  return (
    <div className="sg-root" ref={raizRef}>
      <button
        type="button"
        className={`am-btn sg-btn${siguiendo ? " is-on" : ""}`}
        onClick={siguiendo ? dejar : seguir}
        disabled={enviando}
        aria-pressed={siguiendo}
        title={siguiendo ? `Dejar de seguir ${ticker}` : `Seguir ${ticker} y recibir un aviso si cambia la calificación`}
      >
        <Marcador activo={siguiendo} />
        {siguiendo ? "Siguiendo" : "Seguir"}
      </button>

      {error && <div className="sg-err" role="status">{error}</div>}

      {abierto && !estado.identificado && (
        <div className="sg-panel" role="dialog" aria-label={`Seguir ${ticker}`}>
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
        .sg-root { position: relative; display: inline-flex; flex-direction: column; align-items: flex-end; }
        /* El botón hereda .am-btn entero (hairline 1px, radio 3, 12.5px, sin
           sombra) para que Seguir · Exportar PDF · Actualizar se lean como tres
           piezas del mismo instrumento. Acá sólo va lo que cambia al estar ON. */
        .sg-btn.is-on { color: var(--ink); border-color: var(--rule-strong); }
        #masthead .sg-btn.is-on svg { color: var(--gold-deep); }
        /* Absoluto y no en flujo: el mensaje es más ancho que el botón y, como
           hijo de un flex item dentro de .am-actions (justificado a la derecha),
           ensanchaba .sg-root y corría toda la barra de acciones al aparecer.
           Un error no debe mover el control que lo produjo. */
        .sg-err {
          position: absolute; top: calc(100% + 6px); right: 0;
          width: max-content; max-width: 22em;
          font-family: var(--site-font); font-size: 11.5px; line-height: 1.4;
          color: var(--neg); text-align: right;
        }

        /* Panel anclado al botón. Absoluto para no empujar la barra de acciones
           —que comparte fila con el estado de mercado— y alineado a la derecha,
           que es el borde por el que crece la columna de acciones. */
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
          background: none; border: 0; padding: 0; cursor: pointer;
          font-family: var(--site-font);
          text-decoration: underline; text-underline-offset: 2px;
        }
        .sg-cerrar:hover { color: var(--ink); }
        /* Debajo de 640px la barra de acciones se alinea a la izquierda (ver la
           regla de .am-actions en el masthead), así que el panel y el error la
           siguen en vez de colgar de un borde derecho que ya no existe. */
        @media (max-width: 640px) {
          .sg-root { align-items: flex-start; }
          .sg-panel { right: auto; left: 0; }
          .sg-err { right: auto; left: 0; text-align: left; }
        }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Aviso de cambio + lista de seguidos
   ══════════════════════════════════════════════════════════════ */

/**
 * Fila con lo que se movió en las acciones que la persona sigue.
 *
 * VA DENTRO DEL MASTHEAD, arriba del buscador. Antes era una banda full-bleed
 * montada como primer hijo de `main`: quedaba en `y 0–44` con el navbar fijo
 * ocupando `0–72`, o sea TAPADA SIEMPRE. Lo único que producía era 44px de aire
 * inexplicable sobre la cabecera, y el pago de seguir una acción —"AAPL pasó de
 * BUY a HOLD desde tu última visita"— no lo veía nadie. Acá comparte el bloque
 * de navegación con el buscador: buscar una acción nueva y volver a las que ya
 * seguís son la misma tarea.
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
    <div className="sgs-row">
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

      <style>{`
        /* Sin banda ni fondo propio: es una fila del masthead, no un app bar. La
           hairline que separa el bloque de navegación de la identidad ya la pone
           .am-search abajo — meter otra acá dejaría dos reglas seguidas. */
        .sgs-row {
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .sgs-lbl {
          font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--ink-3); flex: none;
        }
        .sgs-list { display: flex; gap: 6px; flex-wrap: wrap; }
        .sgs-tk {
          position: relative; font-family: var(--font-mono); font-size: 11.5px;
          letter-spacing: 0.04em; padding: 3px 8px; border: 1px solid var(--rule-strong);
          border-radius: 3px; background: var(--paper); color: var(--ink-2);
          cursor: pointer; white-space: nowrap; line-height: 1.3;
          transition: border-color .16s ease, color .16s ease;
        }
        .sgs-tk:hover { border-color: var(--navy); color: var(--navy); }
        .sgs-tk.is-activo { border-color: var(--ink); color: var(--ink); font-weight: 600; }
        .sgs-tk.is-cambio { border-color: var(--gold-deep); color: var(--ink); }
        /* El punto marca "esto se movió": el color solo no alcanza, así que el
           tooltip y el aviso de al lado dicen QUÉ cambió. */
        .sgs-punto {
          position: absolute; top: -3px; right: -3px; width: 6px; height: 6px;
          border-radius: 999px; background: var(--gold-deep);
          box-shadow: 0 0 0 2px var(--paper);
        }
        .sgs-aviso { font-family: var(--site-font); font-size: 12.5px; color: var(--ink-2); }
      `}</style>
    </div>
  );
}
