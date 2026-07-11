import type { GrupoDatos } from "@/lib/informeContenido/tipos";
import { fmtPct } from "./formato";

// Grilla de retornos como heatmap verde/oxblood, fiel a las tablas "Retornos
// Semanales" del PDF (grupos Monedas/Índices/América/Europa/Asia). El valor va
// en una celda tintada por signo (pos-soft / neg-soft); la etiqueta en mono.
// Server puro; estilos .inf-ret centralizados en ArticuloInforme. Las barras
// (BarrasRetorno) quedan para el hero; el heatmap para las grillas densas.

function GrupoRetornos({ grupo }: { grupo: GrupoDatos }) {
  return (
    <div className="inf-ret-grupo">
      {grupo.nombre && <div className="inf-ret-nombre">{grupo.nombre}</div>}
      <div className="inf-ret-rows">
        {grupo.datos.map((d) => (
          <div className="inf-ret-row" key={d.etiqueta}>
            <span className="inf-ret-tk">{d.etiqueta}</span>
            <span className="inf-ret-val" data-dir={d.valor > 0 ? "pos" : d.valor < 0 ? "neg" : "neu"}>
              {fmtPct(d.valor)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RetornosGrid({
  titulo,
  grupos,
  nota,
}: {
  titulo?: string;
  grupos: GrupoDatos[];
  nota?: string;
}) {
  return (
    <figure className="inf-retornos inf-data">
      {titulo && <figcaption className="inf-datacap">{titulo}</figcaption>}
      <div className="inf-ret-grid">
        {grupos.map((g) => (
          <GrupoRetornos key={g.nombre} grupo={g} />
        ))}
      </div>
      {nota && <p className="inf-datanota">{nota}</p>}
    </figure>
  );
}
