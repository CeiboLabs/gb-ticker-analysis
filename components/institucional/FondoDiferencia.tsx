// "Qué lo distingue" — beat de DIFERENCIACIÓN del fondo. Cualitativo y de
// ENFOQUE, nunca de resultados: el fondo no tiene track record y la casa es
// regulada por el BCU, así que no se promete outperformance ni se nombra a
// ningún competidor. El contraste es contra la alternativa más honesta y
// universal: armar la misma cartera global por cuenta propia. Cada par sale de
// hechos ya confirmados del producto (una posición, gestión activa del peso,
// selección de fondos de terceros, asesoría de la casa). Ver "Claims verificables".

const PARES: [string, string][] = [
  ["Elegir y comprar decenas de instrumentos", "Una sola posición, una sola decisión"],
  ["Rebalancear a mano cuando el mercado se mueve", "El peso entre clases se ajusta de forma activa"],
  ["Investigar y seguir cada fondo por tu cuenta", "Una selección de managers especializados, ya resuelta"],
  ["Decidir en soledad", "El respaldo y la asesoría de una casa regulada por el BCU"],
];

function Dash() {
  return (
    <svg className="dif-ic dif-ic-a" width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <line x1="3.5" y1="8" x2="12.5" y2="8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function Check() {
  return (
    <svg className="dif-ic dif-ic-b" width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M3 8.6l3.1 3.1L13 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FondoDiferencia() {
  return (
    <div className="dif">
      <div className="dif-heads" aria-hidden>
        <span className="dif-head dif-head-a">Por tu cuenta</span>
        <span className="dif-head dif-head-b">Con el fondo</span>
      </div>

      {PARES.map(([a, b], i) => (
        <div key={i} className="dif-fila">
          <div className="dif-cell dif-cell-a">
            <Dash />
            <div className="dif-body"><span className="dif-tag">Por tu cuenta</span><span>{a}</span></div>
          </div>
          <div className="dif-cell dif-cell-b">
            <Check />
            <div className="dif-body"><span className="dif-tag">Con el fondo</span><span>{b}</span></div>
          </div>
        </div>
      ))}

      <style>{`
        .dif { margin-top: 48px; border-top: 1px solid var(--site-border); }
        .dif-heads { display: grid; grid-template-columns: 1fr 1fr; }
        .dif-head {
          padding: 16px 26px; font-size: 12px; font-weight: 700;
          letter-spacing: 0.13em; text-transform: uppercase;
        }
        .dif-head-a { color: var(--site-ink-3); }
        .dif-head-b { color: var(--navy); border-left: 1px solid var(--site-border); }

        .dif-fila { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--site-border); }
        .dif-cell {
          display: flex; align-items: flex-start; gap: 13px;
          padding: 22px 26px; font-size: 15px; line-height: 1.45;
        }
        .dif-cell-a { color: var(--site-ink-3); }
        .dif-cell-b {
          color: var(--site-ink); font-weight: 500;
          border-left: 1px solid var(--site-border);
          background: linear-gradient(180deg, rgba(160,124,40,0.045), rgba(160,124,40,0));
        }
        .dif-ic { flex: none; margin-top: 1px; }
        .dif-ic-a { color: var(--site-ink-3); opacity: 0.55; }
        .dif-ic-b { color: var(--gold-deep); }
        .dif-body { display: flex; flex-direction: column; }
        /* La etiqueta por celda sólo aparece en móvil (apilado); en desktop la
           columna ya la rotula el header. */
        .dif-tag { display: none; }

        @media (max-width: 700px) {
          .dif-heads { display: none; }
          .dif-fila { grid-template-columns: 1fr; }
          .dif-cell-a { border-bottom: 1px dashed var(--site-border); }
          .dif-cell-b { border-left: 0; }
          .dif-tag {
            display: block; margin-bottom: 4px;
            font-size: 10.5px; font-weight: 700; letter-spacing: 0.12em;
            text-transform: uppercase; color: var(--site-ink-3);
          }
          .dif-cell-b .dif-tag { color: var(--gold-deep); }
        }
      `}</style>
    </div>
  );
}
