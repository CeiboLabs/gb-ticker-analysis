"use client";

import { useFondo, fmtPct } from "@/lib/useFondo";
import { CalculadoraSim } from "@/components/institucional/Calculadora";

// Calculadora de la página del fondo: el mismo simulador de /calculadora,
// pero con el retorno anual fijo (sin slider) en el retorno anualizado del
// fondo desde su inicio (stats.annualizedSI, CAGR de la serie de valor
// cuota). Si todavía no hay historia suficiente (pre-lanzamiento o < 1 año
// de serie), cae a una referencia del 8%. El key fuerza el remontaje cuando
// llega el dato: CalculadoraSim sólo lee defaults al montar.

// Costos del Tarifario de Gastón Bengochea (servicios-y-costos-2025.pdf,
// vigente 01/04/2025): comisión de compraventa de valores (mínimo 0,75 % + IVA)
// y costo de mantenimiento (0,10 % + IVA anual sobre valores en cartera, cobro
// semestral). IVA estándar de Uruguay = 22 %. El valor cuota del fondo es bruto
// de estos costos —se cobran a la cuenta del cliente, no se descuentan de la
// cuota— así que netearlos acá no los cuenta dos veces. Se omiten el cargo de
// administración sobre intereses/dividendos (la simulación no separa el
// rendimiento por componente) y los tickets fijos por operación.
const FEES = { buyPct: 0.0075, maintAnnualPct: 0.001, iva: 0.22 } as const;

export function FondoCalculadora() {
  const state = useFondo();
  const avg = state.kind === "ready" ? state.data.stats.annualizedSI : null;

  return (
    <div>
      <CalculadoraSim
        key={state.kind === "loading" ? "init" : "ready"}
        defaults={{ initial: 10_000, years: 20, rate: avg ?? 8 }}
        rateLocked
        fees={FEES}
        omitGenericLegal
      />
      <p className="t-small" style={{ marginTop: 14, maxWidth: "44em" }}>
        {avg != null
          ? `El retorno anual está fijado en el promedio anualizado del fondo desde su inicio (${fmtPct(avg, false)} anual).`
          : "El retorno anual usa una referencia del 8% anual mientras el fondo no acumule un año de historia."}
      </p>
    </div>
  );
}
