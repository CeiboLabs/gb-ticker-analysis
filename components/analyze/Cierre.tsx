"use client";

// El cierre del informe, ruteado por quién lo está leyendo.
//
// ESTO REEMPLAZA la banda de apertura de cuenta al pie, que se construyó y se
// descartó. El problema de aquélla no era el copy: era pedir lo más grande —abrir
// una cuenta— en el momento de menor compromiso, al final de un documento de
// 8.000 píxeles que casi nadie termina, sin dar nada a cambio. Se podía borrar y
// el informe quedaba igual, que es la definición de no estar integrado.
//
// LA REGLA, y no se negocia: al ANÓNIMO no se le menciona la cuenta. Ni una vez.
// Abrir cuenta es alta fricción (KYC, documentación, mover plata) y no se decide
// leyendo sobre una acción: se decide semanas después, cuando aparece un
// disparador. El trabajo del informe no es cerrar, es seguir estando ahí. Así que
// primero la herramienta se gana la visita de vuelta, y la conversación aparece
// recién cuando la persona ya demostró que le importa — y entonces no interrumpe:
// contesta.
//
// LA SEGUNDA REGLA: segmentar por comportamiento está bien; DECIRLE A LA PERSONA
// QUE LA SEGMENTAMOS es lo que asecha. La versión anterior le devolvía la cuenta
// en el titular ("venís siguiendo 26 análisis") y eso convertía un
// reconocimiento en un expediente: el número no le servía al lector, servía para
// justificar nuestra oferta, y esa asimetría es la definición de sentirse
// vigilado. El umbral sigue existiendo y sigue decidiendo qué se muestra — pero
// es silencioso. Si alguna vez un número tiene que aparecer, aparece como
// herramienta del lector (la tira de seguidos, que él usa para navegar), nunca
// como prueba a favor nuestro.
//
// Y AL CLIENTE, JAMÁS UNA APERTURA. Ya la tiene. Ofrecérsela es la señal más
// clara de que el sitio no sabe quién es. Va a su asesor, que es además la ruta
// que puede terminar en una orden esta semana en vez de una apertura en meses.

import { useEffect, useState } from "react";
import Link from "next/link";

type Lector = {
  email: string | null;
  estado: "anonimo" | "conocido" | "recurrente" | "cliente";
  esCliente: boolean;
  analisis: number;
  siguiendo: number;
  nombre: string | null;
};

export function CierreSegunLector({ ticker }: { ticker: string }) {
  const [lector, setLector] = useState<Lector | null>(null);

  useEffect(() => {
    let cancelado = false;
    queueMicrotask(() => {
      fetch("/api/lead/me", { headers: { Accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: Lector | null) => { if (!cancelado && j) setLector(j); })
        .catch(() => {});
    });
    return () => { cancelado = true; };
  }, []);

  // Sin estado resuelto no se dibuja nada. Y el ANÓNIMO tampoco ve cierre: su
  // informe termina en el aviso legal, como corresponde.
  if (!lector || lector.estado === "anonimo") return null;

  if (lector.estado === "cliente") return <CierreCliente ticker={ticker} nombre={lector.nombre} />;
  if (lector.estado === "recurrente") return <CierreRecurrente ticker={ticker} />;
  return <CierreConocido ticker={ticker} />;
}

/* ── Conocido: dejó el correo, todavía no es un hábito ─────────── */
// No se pide nada nuevo. Se ofrece la función que hace volver, porque la métrica
// que importa acá es la visita de vuelta y no el formulario.
function CierreConocido({ ticker }: { ticker: string }) {
  return (
    <section className="cr-root band-muted">
      <div className="site-wrap cr-wrap">
        <div className="cr-side">
          <div className="eyebrow-sm">Para no perderlo de vista</div>
        </div>
        <div>
          <h2 className="cr-t">Este informe tiene fecha de <em>vencimiento</em>.</h2>
          <p className="cr-b">
            Los precios se mueven, las empresas reportan y la calificación cambia. Si seguís{" "}
            {ticker} arriba, te avisamos cuando pase — y cuando vuelvas, el informe te muestra qué
            cambió desde la última vez.
          </p>
          <p className="cr-fine">
            Mientras tanto podés mirar otra acción, o leer el{" "}
            <Link href="/analisis/record" className="cr-link">récord de nuestras calificaciones</Link>.
          </p>
        </div>
      </div>
      <EstilosCierre />
    </section>
  );
}

/* ── Recurrente: ya demostró que le importa ────────────────────── */
// Recién ACÁ aparece la apertura de cuenta, y es el único lugar del sitio donde
// va: al anónimo nunca, al cliente jamás (ya la tiene).
//
// EL MOTIVO QUE SE LE DA NO ES SU HISTORIAL: es el límite del documento que acaba
// de leer. Ese límite es real —el informe se escribe igual para todos y no conoce
// a nadie— y es el mismo que nos mantiene del lado del research general. Sirve
// mejor que la cuenta de informes leídos porque es cierto, porque el lector ya lo
// viene sintiendo, y porque abre diciendo lo que el sitio NO sabe de él, que es
// exactamente lo contrario de recitarle lo que sí.
//
// Y LA INVITACIÓN NO PUEDE COLGAR DEL VEREDICTO. "AAPL es BUY, abrí una cuenta y
// compralo" es promoción de un valor extranjero no inscripto en el RMV: se cae de
// research general a oferta pública. Por eso el pedido va a nivel CARTERA y sin
// nombrar la acción. El ticker sólo aparece arriba, describiendo qué puede y qué
// no puede decir el informe.
//
// TAMPOCO VA "sin costo" acá. Colgado de una apertura hace pensar en costos justo
// en el peor momento, y la casa cobra comisiones: es una promesa que no queremos
// suelta al lado del botón.
function CierreRecurrente({ ticker }: { ticker: string }) {
  return (
    <section className="cr-root band-navy">
      <div className="site-wrap cr-wrap">
        <div className="cr-side">
          <div className="eyebrow-sm">La parte que falta</div>
        </div>
        <div>
          <h2 className="cr-t">
            Este informe no conoce tu <em>cartera</em>.
          </h2>
          <p className="cr-b">
            Está escrito igual para todo el mundo: no sabe qué tenés, en qué plazo invertís ni
            cuánto riesgo te sirve. Puede decirte cómo viene {ticker}; no puede decirte si tiene
            lugar en lo tuyo. Esa parte la mira una persona.
          </p>
          <p className="cr-b" style={{ marginTop: 14 }}>
            Abrí una cuenta en Bengochea Inversiones y empecemos a armar tu cartera con un asesor de
            la casa: alguien que ve el conjunto y no una acción por vez.
          </p>
          <div className="cr-acciones">
            <Link href="/contacto" className="ui-btn ui-btn-on-navy">Abrir una cuenta</Link>
            <Link href="/analisis/record" className="ui-btn ui-btn-on-navy-ghost">Ver nuestro récord</Link>
          </div>
        </div>
      </div>
      <EstilosCierre />
    </section>
  );
}

/* ── Cliente: no se le vende nada ──────────────────────────────── */
function CierreCliente({ ticker, nombre }: { ticker: string; nombre: string | null }) {
  return (
    <section className="cr-root band-muted">
      <div className="site-wrap cr-wrap">
        <div className="cr-side">
          <div className="eyebrow-sm">Sos cliente de la casa</div>
        </div>
        <div>
          <h2 className="cr-t">
            {nombre ? `${nombre}, esto lo podés ` : "Esto lo podés "}conversar con tu <em>asesor</em>.
          </h2>
          <p className="cr-b">
            Si estás pensando en {ticker}, tu asesor conoce tu cartera y puede decirte cómo encaja —
            o si conviene esperar. Escribinos y te ponemos en contacto con quien te atiende.
          </p>
          <div className="cr-acciones">
            <Link href="/contacto" className="ui-btn ui-btn-primary">Hablar con mi asesor</Link>
            <a
              href="https://consultanet.gbengochea.com.uy/HBValores/wplogin.aspx"
              target="_blank"
              rel="noreferrer"
              className="ui-btn ui-btn-secondary"
            >
              Ver mi cartera
            </a>
          </div>
        </div>
      </div>
      <EstilosCierre />
    </section>
  );
}

/* ── Estilos compartidos ───────────────────────────────────────── */
// Un solo bloque para las tres variantes: son la misma pieza con distinto texto y
// distinta banda, y duplicar el CSS es la forma más segura de que se desalineen.
function EstilosCierre() {
  return (
    <style>{`
      .cr-root { padding: clamp(44px, 4.5vw, 68px) 0; }
      .cr-wrap {
        display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.5fr);
        gap: clamp(24px, 5vw, 72px); align-items: start;
      }
      .cr-t {
        font-family: var(--site-font); font-size: clamp(24px, 2.5vw, 32px); font-weight: 400;
        line-height: 1.14; letter-spacing: -0.02em; margin: 0; max-width: 18em;
        text-wrap: balance; color: var(--ink);
      }
      .cr-t em { font-style: normal; color: var(--gold-deep); }
      .cr-b {
        font-family: var(--site-font); font-size: 15.5px; line-height: 1.65;
        color: var(--ink-2); margin: 18px 0 0; max-width: 56ch;
      }
      .cr-fine {
        font-family: var(--site-font); font-size: 13px; line-height: 1.6;
        color: var(--ink-3); margin: 16px 0 0;
      }
      .cr-link { color: var(--gold-deep); text-decoration: underline; text-underline-offset: 2px; }
      .cr-link:hover { color: var(--navy); }
      .cr-acciones { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }

      /* Sobre navy la rampa de texto se invierte. Va acotado a .cr-root para no
         pisar las reglas generales de .band-navy del sitio. */
      .cr-root.band-navy .cr-t { color: #fff; }
      .cr-root.band-navy .cr-t em { color: var(--gold-soft); }
      .cr-root.band-navy .cr-b { color: rgba(255,255,255,0.78); }
      .cr-root.band-navy .cr-fine { color: rgba(255,255,255,0.6); }
      .cr-root.band-navy .cr-link { color: var(--gold-soft); }

      @media (max-width: 900px) {
        .cr-wrap { grid-template-columns: 1fr; gap: 20px; }
      }
    `}</style>
  );
}
