import type { GrupoDatos } from "@/lib/informeContenido/tipos";
import { fmtPct, colorDelta } from "./formato";

// Gráfico de retornos recreado on-brand (editorial v2): barras horizontales
// desde un eje-cero, verde/oxblood por signo, etiquetas y valores en mono
// tabular, cero chrome. Reemplaza las tablas-imagen "Retornos Semanales" de los
// PDFs. Componente puro (server-side, sin JS de cliente ni animación de
// entrada — "los datos aparecen en estado final", lenguaje-visual §4).
// Los estilos .inf-* viven centralizados en ArticuloInforme.

function GrupoBarras({ grupo, enNavy }: { grupo: GrupoDatos; enNavy?: boolean }) {
  const maxAbs = Math.max(...grupo.datos.map((d) => Math.abs(d.valor)), 0.01);
  const hayNeg = grupo.datos.some((d) => d.valor < 0);
  // Eje cero: al medio si hay negativos, pegado a la izquierda si todo es positivo.
  const zero = hayNeg ? 50 : 0;
  const semi = hayNeg ? 50 : 100;

  return (
    <div className="inf-grupo">
      {grupo.nombre && <div className="inf-grupo-nombre">{grupo.nombre}</div>}
      <div className="inf-rows">
        {grupo.datos.map((d) => {
          const ancho = (Math.abs(d.valor) / maxAbs) * semi;
          const left = d.valor >= 0 ? zero : zero - ancho;
          return (
            <div className="inf-row" key={d.etiqueta}>
              <span className="inf-row-label">{d.etiqueta}</span>
              <span className="inf-track">
                <span className="inf-zero" style={{ left: `${zero}%` }} aria-hidden />
                {d.valor === 0 ? (
                  <span className="inf-nub" style={{ left: `${zero}%` }} aria-hidden />
                ) : (
                  <span
                    className="inf-fill"
                    style={{ left: `${left}%`, width: `${ancho}%`, background: colorDelta(d.valor, enNavy) }}
                    aria-hidden
                  />
                )}
              </span>
              <span className="inf-row-val" style={{ color: colorDelta(d.valor, enNavy) }}>
                {fmtPct(d.valor)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BarrasRetorno({
  titulo,
  grupos,
  nota,
  enNavy,
}: {
  titulo?: string;
  grupos: GrupoDatos[];
  nota?: string;
  /** Variante sobre fondo navy: barras y valores en tonos brillantes. */
  enNavy?: boolean;
}) {
  return (
    <figure className={`inf-barras inf-data${enNavy ? " inf-barras--navy" : ""}`}>
      {titulo && <figcaption className="inf-datacap">{titulo}</figcaption>}
      <div className="inf-barras-grid">
        {grupos.map((g) => (
          <GrupoBarras key={g.nombre} grupo={g} enNavy={enNavy} />
        ))}
      </div>
      {nota && <p className="inf-datanota">{nota}</p>}
    </figure>
  );
}
