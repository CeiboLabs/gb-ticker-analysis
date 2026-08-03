import { CalculadoraSim } from "@/components/institucional/Calculadora";

// Calculadora de la página del fondo: el mismo simulador de /calculadora, con
// los defaults que le hacen sentido a esta audiencia.
//
// ⚠️ LA TASA ES UN SUPUESTO DEL LECTOR, NO EL RETORNO DEL FONDO.
// Hasta el 27-jul-2026 esto fijaba el retorno anual (rateLocked) en
// `stats.annualizedSI` —el CAGR del valor cuota— y, mientras el fondo no
// acumulara un año de serie, en una "referencia" del 8 % anual: veinte años de
// interés compuesto sobre un rendimiento inventado, en la página de un fondo
// inscripto para oferta pública que todavía no comenzó a funcionar, con el
// aviso genérico apagado (omitGenericLegal). Eso es performance simulada y no
// se publica. La tasa vuelve a ser editable, arranca en un valor neutro y en
// ningún lado se presenta como rendimiento esperado del Fondo.
//
// COMISIÓN — Reglamento cláusula 12 y literal (s) del resumen: se cobra AL
// FONDO (mensualmente, devengada a diario, hasta 1,5 % anual del patrimonio
// neto, IVA incluido), así que el valor cuota ya nace neto de ella. Acá se
// descuenta porque la tasa que pone el lector es un rendimiento BRUTO de
// mercado. ⚠️ El día que esta calculadora vuelva a leer la serie real del
// fondo, netear la comisión otra vez la contaría DOS VECES.
//
// Tampoco es el único costo: la cláusula 12.2 permite trasladar gastos al Fondo
// con tope anual del 2 % de los activos (sin tope durante el primer año de
// funcionamiento) y la 12.3 pone a cargo del cuotapartista los tributos sobre
// los rendimientos. El pie del simulador lo dice.
const FEE = { annualPct: 0.015 } as const;

// Banda del rendimiento del simulador en esta página: 6 % a 8 % anual, de a 0,25.
//
// ⚠️ LOS 6–8 SON PEDIDO EXPLÍCITO DEL CLIENTE (3-ago-2026, vía el usuario). NO
// LOS ENSANCHES. Ya pasó una vez el mismo día: en la revisión legal previa al
// lanzamiento la banda se abrió a 2 %–12 % por el razonamiento de abajo, y hubo
// que revertirla. El razonamiento sigue siendo cierto y por eso queda escrito —
// pero es una objeción ya planteada y ya resuelta por quien decide, no un bug
// esperando arreglo.
//
// El razonamiento, para que quien lo lea sepa qué está sosteniendo: el valor lo
// elige el lector, sí, pero el MENÚ lo elegimos nosotros. Un slider que sólo se
// mueve entre 6 y 8, rotulado "Rendimiento anual promedio", en la página de un
// fondo inscripto para oferta pública que todavía no comenzó a funcionar, se lee
// como "la casa dice que esto rinde entre 6 y 8" — no hay aviso que lo desarme
// del todo, porque el aviso habla y el control demuestra.
//
// Lo que SÍ sigue disponible para mitigar sin tocar la banda (el cliente pidió el
// rango, no el rótulo): volver el slider a "Rendimiento anual SUPUESTO", que es
// como se llamaba hasta el 28-jul-2026. Es una palabra y mueve bastante la
// lectura. Ofrecido al usuario el 3-ago-2026.
//
// El default arranca en 6, el extremo BAJO: es el número que la página muestra
// sin que nadie toque nada, así que conviene que sea el menos prometedor de la
// banda. No lo subas.
//
// Reglas que siguen en pie: no presentarlo como rendimiento del Fondo y no
// sacar el "lo elegís vos" del copy de la sección.
const RATE_RANGE = { min: 6, max: 8, step: 0.25 } as const;

export function FondoCalculadora() {
  return (
    <CalculadoraSim
      defaults={{ initial: 10_000, years: 20, rate: 6 }}
      fees={FEE}
      rateRange={RATE_RANGE}
    />
  );
}
