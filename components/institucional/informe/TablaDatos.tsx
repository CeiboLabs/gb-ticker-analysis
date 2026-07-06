import type { Columna } from "@/lib/informeContenido/tipos";
import { fmtNum, fmtPct, colorDelta } from "./formato";

// Tabla de datos del informe, sobre la .fin-table institucional (mono tabular,
// hairlines, sin cajas). Las columnas marcadas `delta` formatean el valor con
// signo y "%", y lo colorean verde/oxblood. Los estilos viven en ArticuloInforme.

function celda(valor: string | number, col: Columna) {
  if (typeof valor === "number") {
    if (col.delta) {
      return <span style={{ color: colorDelta(valor) }}>{fmtPct(valor)}</span>;
    }
    // Nivel numérico: coma decimal + sufijo opcional (ej. " %"). Entero sin decimales.
    const dec = Number.isInteger(valor) ? 0 : 2;
    return `${fmtNum(valor, dec)}${col.sufijo ?? ""}`;
  }
  return valor;
}

export function TablaDatos({
  titulo,
  columnas,
  filas,
  nota,
}: {
  titulo?: string;
  columnas: Columna[];
  filas: (string | number)[][];
  nota?: string;
}) {
  return (
    <figure className="inf-tabla inf-data">
      {titulo && <figcaption className="inf-datacap">{titulo}</figcaption>}
      <div className="inf-tabla-scroll">
        <table className="fin-table">
          <thead>
            <tr>
              {columnas.map((c) => (
                <th key={c.titulo}>{c.titulo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, i) => (
              <tr key={i}>
                {fila.map((valor, j) => (
                  <td key={j}>{celda(valor, columnas[j])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nota && <p className="inf-datanota">{nota}</p>}
    </figure>
  );
}
