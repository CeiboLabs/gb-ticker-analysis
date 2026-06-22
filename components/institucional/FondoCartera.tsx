// "Cartera · cómo está construida" — díptico CONECTADO: un solo bloque (la
// cartera) partido por una costura central en sus dos clases de activo. La
// forma hace el argumento del título: la cartera es UN objeto de dos partes
// complementarias, no dos cards sueltas.
//
// Reglas de marca respetadas:
//  · SIN pesos ni porcentajes — las dos mitades van a ancho igual por LAYOUT,
//    no como barra de proporción 50/50 (son dos paneles, no una barra medida).
//    El peso real es activo y se informa en la ficha; lo dice la nota.
//  · SIN serial inventado ("Clase de activo · 01/02"): se reemplaza por el rol
//    real de cada clase. Ver "Sin chrome editorial decorativo".
//  · La firma de línea carga el significado (crecimiento vs estabilidad) sin un
//    solo número.

import { FONDO } from "@/lib/fondo";

// Rol de cada clase dentro del balanceado, en el MISMO orden que
// FONDO.cartera.sleeves (RV primero, RF después). Sale del propio copy del
// fondo ("motor de crecimiento" / "modera la volatilidad").
const ROLES = ["Motor de crecimiento", "Aporta estabilidad"] as const;

// Firma de línea ascendente y con volatilidad: el motor de crecimiento.
function FirmaCrecimiento() {
  return (
    <svg className="cart-firma" viewBox="0 0 132 44" fill="none" aria-hidden>
      <path
        d="M2 38 L20 30 L33 34 L48 21 L64 26 L80 13 L96 17 L114 6 L130 9"
        stroke="var(--gold-deep)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="130" cy="9" r="2.6" fill="var(--gold-deep)" />
    </svg>
  );
}

// Firma de línea serena y casi plana: la estabilidad de la renta fija.
function FirmaEstabilidad() {
  return (
    <svg className="cart-firma cart-firma-rf" viewBox="0 0 132 44" fill="none" aria-hidden>
      <path
        d="M2 24 Q33 18 66 23 T130 22"
        stroke="var(--navy-300)" strokeWidth="1.8" strokeLinecap="round"
      />
      <circle cx="130" cy="22" r="2.6" fill="var(--navy-300)" />
    </svg>
  );
}

const FIRMAS = [<FirmaCrecimiento key="rv" />, <FirmaEstabilidad key="rf" />];

export function FondoCartera() {
  const { sleeves, nota } = FONDO.cartera;

  return (
    <div className="cart">
      <div className="cart-diptico">
        {sleeves.map((s, i) => (
          <div key={s.clave} className={`cart-panel cart-panel-${i === 0 ? "rv" : "rf"}`}>
            <div className="cart-rol">{ROLES[i]}</div>
            <h3 className="cart-clave">{s.clave}</h3>
            {FIRMAS[i]}
            <p className="cart-desc">{s.desc}</p>
          </div>
        ))}
        {/* Nodo de la costura: marca que las dos mitades son UN solo vehículo. */}
        <span className="cart-nodo" aria-hidden />
      </div>

      <p className="cart-nota">{nota}</p>

      <style>{`
        .cart { margin-top: 48px; }

        /* Díptico: un solo bloque, dos paneles, costura central. */
        .cart-diptico {
          position: relative;
          display: grid; grid-template-columns: 1fr 1fr;
          border: 1px solid var(--site-border); border-radius: 18px;
          background: #fff; overflow: hidden;
        }
        .cart-panel { padding: 38px 40px 42px; position: relative; }
        /* Costura vertical entre las dos clases. */
        .cart-panel-rf { border-left: 1px solid var(--site-border); }
        /* La mitad de crecimiento lleva un lavado dorado tenue; la de renta
           fija, uno navy igual de tenue. Refuerza el rol sin gritar. */
        .cart-panel-rv { background: linear-gradient(180deg, rgba(160,124,40,0.05), rgba(160,124,40,0) 62%); }
        .cart-panel-rf { background: linear-gradient(180deg, rgba(15,34,73,0.045), rgba(15,34,73,0) 62%); }

        .cart-rol {
          font-size: 11px; font-weight: 700; letter-spacing: 0.13em;
          text-transform: uppercase;
        }
        .cart-panel-rv .cart-rol { color: var(--gold-deep); }
        .cart-panel-rf .cart-rol { color: var(--navy-300); }

        .cart-clave {
          font-size: clamp(22px, 2.4vw, 28px); line-height: 1.1;
          margin: 12px 0 0; color: var(--site-ink);
        }
        .cart-firma { width: 132px; height: 44px; display: block; margin: 22px 0 4px; }

        .cart-desc {
          font-size: 15px; line-height: 1.6; color: var(--site-ink-2);
          margin: 18px 0 0; max-width: 30em;
        }

        /* Nodo central sobre la costura: las dos mitades, un solo vehículo. */
        .cart-nodo {
          position: absolute; top: 50%; left: 50%;
          width: 11px; height: 11px; border-radius: 999px;
          transform: translate(-50%, -50%);
          background: #fff; border: 1px solid var(--site-border);
          box-shadow: 0 0 0 5px #fff;
        }

        .cart-nota {
          margin: 24px 0 0; padding-top: 20px; border-top: 1px solid var(--site-border);
          font-size: 13.5px; line-height: 1.65; color: var(--site-ink-3); max-width: 60em;
        }

        @media (max-width: 760px) {
          .cart-diptico { grid-template-columns: 1fr; }
          .cart-panel { padding: 30px 26px 32px; }
          /* La costura se vuelve horizontal al apilar. */
          .cart-panel-rf { border-left: 0; border-top: 1px solid var(--site-border); }
          /* El nodo se reposiciona sobre la nueva costura horizontal. */
          .cart-nodo { top: 50%; left: 50%; }
        }
      `}</style>
    </div>
  );
}
