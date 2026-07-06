"use client";

import { useFondo, fmtPct } from "@/lib/useFondo";
import { CalculadoraSim } from "@/components/institucional/Calculadora";

// Calculadora de la página del fondo: el mismo simulador de /calculadora,
// pero con el retorno anual fijo (sin slider) en el retorno anualizado del
// fondo desde su inicio (stats.annualizedSI, CAGR de la serie de valor
// cuota). Si todavía no hay historia suficiente (pre-lanzamiento o < 1 año
// de serie), cae a una referencia del 8%. El key fuerza el remontaje cuando
// llega el dato: CalculadoraSim sólo lee defaults al montar.

// Único costo del fondo: comisión de administración de 1,5 % anual sobre el
// valor de la inversión (se toma como valor final, IVA incluido). No aplica el
// Tarifario general de Gastón Bengochea —ni compraventa ni mantenimiento—: esta
// comisión los reemplaza. El valor cuota del fondo es bruto de la comisión —se
// cobra a la cuenta del cliente, no se descuenta de la cuota— así que netearla
// en la proyección no la cuenta dos veces.
const FEE = { annualPct: 0.015 } as const;

export function FondoCalculadora() {
  const state = useFondo();
  const avg = state.kind === "ready" ? state.data.stats.annualizedSI : null;

  return (
    <div>
      <CalculadoraSim
        key={state.kind === "loading" ? "init" : "ready"}
        defaults={{ initial: 10_000, years: 20, rate: avg ?? 8 }}
        rateLocked
        fees={FEE}
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
