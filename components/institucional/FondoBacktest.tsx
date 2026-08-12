"use client";

// ⚠️ PENDIENTE DE CONFIRMACIÓN: la referencia del backtest es la columna
// `BM_6040` del Excel del cliente, y acá se publica como el benchmark del Fondo
// (60% MSCI ACWI · 40% Bloomberg Global Aggregate). El Excel no dice de qué está
// hecha: lo tomamos del RUNBOOK, que la documenta como «el mismo 60/40 de
// referencia», y de la decisión del cliente del 11-ago-2026 de nombrarla.
// Lo que hay que chequear con el cliente es el tramo de renta variable: la
// definición del benchmark cambió de MSCI World a ACWI recién en jul-2026, así
// que un Excel armado antes podría estar corriendo contra World. Si fuera así,
// cambia el nombre acá y en el pie de FondoPerformance — no el cálculo.
import { BENCHMARK } from "@/lib/fondo";
import { rotuloAnio, ultimoAnioParcial, BACKTEST_MAX, type Backtest } from "@/lib/fondoBacktest";
import { fmtPct, fmtFechaLarga } from "@/lib/useFondo";
import { css } from "@/lib/css";

// Backtest de la estrategia — las dos piezas que rodean al gráfico cuando el
// selector de serie del módulo de performance está en «Backtest».
//
// Son dos componentes y no uno porque van a lugares distintos del módulo: el
// encuadre vive DENTRO del marco del gráfico (arriba de la leyenda) y la tabla
// va DEBAJO del marco. El gráfico en sí lo dibuja FondoPerformance con el mismo
// <FondoChart> que usa para el valor cuota — es un solo gráfico que cambia de
// serie, no dos gráficos que se alternan.
//
// ⚠️ LEER ANTES DE TOCAR NADA ACÁ.
//
// Esta es la tercera vez que la página muestra una curva que NO es el valor
// cuota, y las dos anteriores se revirtieron:
//
//   · jul → 3-ago-2026: el benchmark solo, expresado como una cuota hipotética
//     de 1.000 en USD. Se sacó porque una curva que sube de 1.000 a 1.300 con el
//     eje en dólares se lee como el track record del fondo por más que cuatro
//     avisos digan lo contrario (ver el comentario largo en FondoPerformance);
//   · la calculadora con el retorno fijado en el promedio del fondo —y sin serie
//     propia, en un 8% anual de referencia—, que era performance simulada de un
//     producto que todavía no comenzó a funcionar (ver la sección Calculadora
//     en la página).
//
// Lo que hace admisible a ESTE bloque, y que hay que preservar entero:
//
//   1. NUNCA usa las unidades del Fondo. Eje en índice base 100, jamás en USD ni
//      en «valor cuota». Ese fue el error exacto de la primera reversión.
//   2. NUNCA usa el navy con sombra proyectada, que es la firma visual del valor
//      cuota. La línea va en el tono subordinado (lineKind="sim").
//   3. La palabra «simulada» está EN LA LEYENDA DEL GRÁFICO, no sólo en la letra
//      chica. Es la única parte que sobrevive a una captura de pantalla, y las
//      capturas de un gráfico son exactamente lo que circula por WhatsApp.
//   4. El encuadre —qué es esto y qué no es— va en cuerpo de LECTURA y nunca en
//      un pie de 12px, y ENTRE el selector de serie y el marco del gráfico. Esa
//      posición es la que lo ata a la serie que se está mirando: aparece y
//      desaparece con la opción elegida, así que no puede confundirse con la
//      otra. (Estuvo adentro del marco un día; se sacó porque leía como una caja
//      dentro de otra — ver BacktestCaption.)
//
// Si alguna de esas cuatro se cae, esto vuelve a ser el problema que ya se
// revirtió dos veces.

/**
 * Encuadre de la simulación — la tira que va ENTRE el selector de serie y el
 * marco del gráfico.
 *
 * Estuvo un rato ADENTRO del marco, arriba de la leyenda, y se sacó
 * (11-ago-2026): tres renglones de texto dentro de la caja la volvían una caja
 * dentro de otra y empujaban la curva hacia abajo. Afuera y justo debajo del
 * selector, el orden de lectura hace el mismo trabajo sin el peso visual —
 * elegís «Backtest», leés qué es eso, mirás la curva—, y queda inequívocamente
 * atado a la opción elegida y no a la otra serie del selector.
 *
 * Las fechas del período se fueron a la nota al pie de la tabla, que es donde
 * viven los supuestos: acá quedó sólo el qualifier, que es lo que no se puede
 * perder de vista.
 */
export function BacktestCaption() {
  return (
    <p className="btcap">
      {/* Micro-label duro del sistema (uppercase 11,5px / 700 / 0.14em). NO va
          en oro: el oro es identidad de la casa y acá marcaría un dato, no un
          estado — y además el aviso de «Próximamente», que ocupa este mismo
          lugar en la otra serie, ya usa el oro. */}
      <span className="btcap-tag">Simulación histórica</span>
      {/* El encuadre, en cuerpo de LECTURA y no en un pie de 12px.
          Acá abría un «Resultado simulado, a título ilustrativo.» en negrita
          —la frase textual del audio del responsable del fondo— y se sacó por
          pedido suyo (11-ago-2026). Lo que queda dice lo mismo pero en hechos
          concretos en lugar de una fórmula, que es más difícil de saltear
          leyendo: el Fondo no operó, nadie ganó esto. El rótulo «SIMULACIÓN
          HISTÓRICA» de al lado y el «(simulada)» de la leyenda del gráfico
          siguen nombrando qué es, y «ilustrativo» sigue en el bloque de
          limitaciones al pie del módulo. */}
      La estrategia de hoy aplicada hacia atrás sobre precios de mercado: el Fondo no
      operó en este período y ningún inversor obtuvo estos rendimientos.

      <style>{css`
        /* Al RAS del marco del gráfico y de la tabla —los tres arrancan en el
           mismo x—, sin filete ni sangría. Se probó con un filete al costado y
           16px de sangría: sin el trazo (ver abajo) la sangría se leía como una
           desalineación, y con él la tira pesaba más que la nota que es. Lo que
           la señala es su posición —aparece y desaparece con el selector— y el
           rótulo en versalitas.
           ⚠️ Ese filete iba en --site-ink-4, QUE NO EXISTE: bajo .site sólo hay
           site-ink, -2 y -3 (--ink-4, con ese nombre, es de la paleta
           editorial). Con la variable indefinida la declaración entera queda
           inválida y el borde cae a none — no falla ruidosamente, simplemente
           no se dibuja. Y sin backticks acá: este bloque es un template literal
           y uno suelto lo termina, dejando el archivo entero roto. */
        .btcap {
          margin: 0 0 16px;
          font-size: 14px; line-height: 1.55; color: var(--site-ink-2);
          max-width: var(--medida-legal);
        }
        .btcap-tag {
          display: inline-block; font-size: 11.5px; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--site-ink); margin-right: 10px;
        }
        @media (max-width: 560px) {
          .btcap { font-size: 13.5px; }
          /* En el teléfono el rótulo se lleva su propio renglón: en línea con el
             texto partía la primera frase en dos pedazos ilegibles. */
          .btcap-tag { display: block; margin: 0 0 4px; }
        }
      `}</style>
    </p>
  );
}

/**
 * Rentabilidad simulada por año calendario — el «año a año» que pidió el
 * cliente. Va DEBAJO del marco del gráfico. Misma tabla plana de ficha técnica
 * que usa el módulo del fondo (regla de apertura, filas hairline, sin
 * verticales ni cajas), con su gemela transpuesta para mobile.
 */
export function BacktestTabla({ data }: { data: Backtest }) {
  const { agregados, anios } = data;
  const porAnio = new Map(agregados.calendar.map((c) => [c.year, c.pct]));
  const refPorAnio = new Map(agregados.benchCalendar.map((c) => [c.year, c.pct]));

  // Columnas: los años + el total del período. Mismo rótulo que los chips del
  // selector —el último año parcial se llama «YTD» en los dos lados—, para que
  // el selector y la tabla se lean como un solo objeto.
  const columnas = [
    ...anios.map((a) => ({
      id: String(a),
      titulo: rotuloAnio(data, a),
      estrategia: porAnio.get(a) ?? null,
      referencia: refPorAnio.get(a) ?? null,
    })),
    {
      id: BACKTEST_MAX,
      titulo: "Total",
      estrategia: agregados.returns.find((r) => r.key === "SI")?.pct ?? null,
      referencia: agregados.benchReturns.find((r) => r.key === "SI")?.pct ?? null,
    },
  ];

  const acento = (v: number | null) => (v == null ? "" : v >= 0 ? "up" : "down");

  return (
    <div className="bt">
      <div className="bt-tabla-scroll">
        <table className="bt-grid">
          <thead>
            <tr>
              <th scope="col" aria-label="Serie" />
              {columnas.map((c) => (
                <th key={c.id} scope="col">{c.titulo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Estrategia</th>
              {columnas.map((c) => (
                <td key={c.id} data-accent={acento(c.estrategia)}>{fmtPct(c.estrategia)}</td>
              ))}
            </tr>
            <tr className="bt-ref">
              <th scope="row">{BENCHMARK.corto}</th>
              {columnas.map((c) => (
                <td key={c.id} data-accent={acento(c.referencia)}>{fmtPct(c.referencia)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile: transpuesta (años en filas) para entrar sin scroll horizontal. */}
      <table className="bt-grid bt-grid--mobile">
        <thead>
          <tr>
            <th scope="col" aria-label="Año" />
            <th scope="col">Estrategia</th>
            <th scope="col">{BENCHMARK.corto}</th>
          </tr>
        </thead>
        <tbody>
          {columnas.map((c) => (
            <tr key={c.id}>
              <th scope="row">{c.titulo}</th>
              <td data-accent={acento(c.estrategia)}>{fmtPct(c.estrategia)}</td>
              <td className="bt-ref-cell" data-accent={acento(c.referencia)}>
                {fmtPct(c.referencia)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Nivel 1 del aviso: la nota corta PEGADA al dato — supuestos y vigencia.
          El bloque largo de limitaciones va una sola vez al pie del módulo
          (.perf-disclaimer en FondoPerformance), no repartido por acá. */}
      <p className="bt-nota">
        {/* El período de la simulación vive acá desde que el encuadre de arriba
            se achicó a una tira: es un supuesto del cálculo, y los supuestos van
            al pie del dato, no en el rótulo.
            VA PRIMERO para que el YTD pueda referirse a su fecha de cierre en
            vez de repetirla: antes la nota decía «1 de julio de 2026» dos veces
            en dos renglones. */}
        Simulación entre {fmtFechaLarga(data.desde)} y {fmtFechaLarga(data.hasta)}, en base 100
        al primer día, en dólares y con rebalanceo trimestral.
        {/* Qué ventana cubre exactamente el YTD. Es lo que el rótulo NO dice, y
            hace falta decirlo acá porque la serie no llega hasta hoy: corta en
            el último cierre simulado. */}
        {ultimoAnioParcial(data) && <> YTD es el año en curso, del 1 de enero a esa última fecha.</>}
        {/* Qué ES la segunda línea. La leyenda y la tabla la llaman «Benchmark»
            —el mismo rótulo que en las otras vistas del gráfico—, que dice su
            papel pero no contra qué se está midiendo: la composición y los
            índices van acá, pegados al dato, que es donde los pone cualquier
            ficha. El «dentro de la misma simulación» no es glosa: distingue
            este cómputo del valor oficial de los índices. */}{" "}
        El benchmark es el compuesto 60/40 del Fondo ({BENCHMARK.nombre}), calculado dentro de la
        misma simulación.
      </p>

      <style>{css`
        .bt { margin-top: 26px; }
        .bt-tabla-scroll { overflow-x: auto; }
        .bt-grid--mobile { display: none; }
        .bt-grid {
          width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums;
          border-top: 1px solid var(--site-border);
        }
        .bt-grid thead th {
          text-align: right; font-size: 12px; font-weight: 600; color: var(--site-ink-3);
          padding: 11px 0 11px 28px; border-bottom: 1px solid var(--site-border); white-space: nowrap;
        }
        .bt-grid thead th:first-child { padding-left: 0; }
        .bt-grid tbody tr { border-bottom: 1px solid var(--site-border); }
        .bt-grid tbody tr:last-child { border-bottom: 0; }
        .bt-grid tbody th {
          text-align: left; font-weight: 500; color: var(--site-ink); font-size: 14.5px;
          padding: 14px 0; white-space: nowrap;
        }
        .bt-grid tbody td {
          text-align: right; font-weight: 500; color: var(--site-ink); font-size: 15px;
          padding: 14px 0 14px 28px; white-space: nowrap;
        }
        .bt-grid td[data-accent="up"] { color: var(--pos); }
        .bt-grid td[data-accent="down"] { color: var(--neg); }
        .bt-grid tr.bt-ref th { color: var(--site-ink-2); font-weight: 400; }
        .bt-grid tr.bt-ref td { font-weight: 400; }
        /* Se probó marcar con un wash la columna del año elegido en el selector,
           para atar los dos controles. Se sacó: las celdas van alineadas a la
           derecha con 28px de padding izquierdo, así que el relleno de una
           columna se mete debajo del número de la anterior y quedan dos años
           pareciendo seleccionados. Además el thumb del selector ya dice cuál
           está activo, y un bloque de fondo pleno en una tabla plana de
           hairlines es justo lo que el sistema no hace. */

        .bt-nota {
          margin: 12px 0 0; font-size: 12px; line-height: 1.5; color: var(--site-ink-3);
          max-width: var(--medida-legal);
        }

        @media (max-width: 560px) {
          .bt-tabla-scroll { display: none; }
          .bt-grid--mobile { display: table; }
          .bt-grid thead th, .bt-grid tbody td { padding-left: 18px; }
          .bt-grid--mobile .bt-ref-cell { color: var(--site-ink-2); font-weight: 400; }
          .bt-grid--mobile .bt-ref-cell[data-accent="up"] { color: var(--pos); }
          .bt-grid--mobile .bt-ref-cell[data-accent="down"] { color: var(--neg); }
        }
      `}</style>
    </div>
  );
}
