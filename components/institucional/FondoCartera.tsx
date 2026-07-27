// "Cartera · cómo está construida" — un solo bloque (la cartera) partido por
// costuras internas en sus TRES clases de activo. La forma hace el argumento del
// título: la cartera es UN objeto de partes complementarias, no cards sueltas.
//
// Reglas de marca respetadas:
//  · SIN pesos ni porcentajes — las tres partes van a ancho igual por LAYOUT,
//    no como barra de proporción (son paneles, no una barra medida). El peso
//    real es activo y se informa en la ficha; lo dice la nota.
//  · SIN serial inventado ("Clase de activo · 01/03"): cada clase se rotula por
//    su ROL real. Ver "Sin chrome editorial decorativo".
//  · La firma de línea carga el significado (crecimiento · estabilidad · baja
//    correlación) sin un solo número.

import { FONDO } from "@/lib/fondo";

// Firma de línea ascendente y con volatilidad: el motor de crecimiento (acciones).
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

// Firma de línea serena y casi plana: la estabilidad del bloque defensivo (bonos).
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

// Firma en contrafase: oscila distinto al resto — la baja/negativa correlación
// de los activos alternativos (sube donde los otros bajan).
function FirmaAlternativos() {
  return (
    <svg className="cart-firma cart-firma-alt" viewBox="0 0 132 44" fill="none" aria-hidden>
      <path
        d="M2 14 L24 30 L46 16 L68 31 L90 15 L112 28 L130 18"
        stroke="#7E869C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="130" cy="18" r="2.6" fill="#7E869C" />
    </svg>
  );
}

const FIRMAS = [<FirmaCrecimiento key="acc" />, <FirmaEstabilidad key="bon" />, <FirmaAlternativos key="alt" />];
// Sufijo de clase por posición, en el MISMO orden que FONDO.cartera.sleeves.
const KIND = ["acc", "bon", "alt"] as const;

export function FondoCartera() {
  const { sleeves, nota } = FONDO.cartera;

  return (
    <div className="cart">
      <div className="cart-clases">
        {sleeves.map((s, i) => (
          <div key={s.clave} className={`cart-panel cart-panel-${KIND[i]}`}>
            <div className="cart-rol">{s.rol}</div>
            <h3 className="cart-clave">{s.clave}</h3>
            {FIRMAS[i]}
            <p className="cart-desc">{s.desc}</p>
          </div>
        ))}
      </div>

      <p className="cart-nota">{nota}</p>

      <style>{`
        .cart { margin-top: 48px; }

        /* Un solo bloque, tres paneles, costuras internas. */
        .cart-clases {
          display: grid; grid-template-columns: repeat(3, 1fr);
          border: 1px solid var(--site-border); border-radius: 18px;
          background: #fff; overflow: hidden;
        }
        .cart-panel { padding: 36px 30px 40px; position: relative; }
        /* Costura vertical entre clases. */
        .cart-panel + .cart-panel { border-left: 1px solid var(--site-border); }
        /* Cada clase lleva un lavado tenue por rol: oro (crecimiento), navy
           (defensivo) y slate (alternativos). Refuerza el rol sin gritar. */
        .cart-panel-acc { background: linear-gradient(180deg, rgba(160,124,40,0.05), rgba(160,124,40,0) 62%); }
        .cart-panel-bon { background: linear-gradient(180deg, rgba(15,34,73,0.045), rgba(15,34,73,0) 62%); }
        .cart-panel-alt { background: linear-gradient(180deg, rgba(126,134,156,0.06), rgba(126,134,156,0) 62%); }

        .cart-rol {
          font-size: 11px; font-weight: 700; letter-spacing: 0.13em;
          text-transform: uppercase;
        }
        .cart-panel-acc .cart-rol { color: var(--gold-deep); }
        .cart-panel-bon .cart-rol { color: var(--navy-300); }
        .cart-panel-alt .cart-rol { color: #6b7280; }

        .cart-clave {
          font-size: clamp(21px, 2.2vw, 27px); line-height: 1.1;
          margin: 12px 0 0; color: var(--site-ink);
        }
        .cart-firma { width: 120px; height: 40px; display: block; margin: 20px 0 4px; }

        .cart-desc {
          font-size: 14.5px; line-height: 1.6; color: var(--site-ink-2);
          margin: 16px 0 0; max-width: 30em;
        }

        .cart-nota {
          margin: 24px 0 0; padding-top: 20px; border-top: 1px solid var(--site-border);
          font-size: 13.5px; line-height: 1.65; color: var(--site-ink-3); max-width: 60em;
        }

        /* Tablet: dos arriba + una abajo entra apretado; se apila entero. */
        @media (max-width: 860px) {
          .cart-clases { grid-template-columns: 1fr; }
          .cart-panel { padding: 30px 26px 32px; }
          /* Las costuras se vuelven horizontales al apilar. */
          .cart-panel + .cart-panel { border-left: 0; border-top: 1px solid var(--site-border); }
        }
      `}</style>
    </div>
  );
}
