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
// Reglas que siguen en pie: no presentarlo como rendimiento del Fondo y no
// sacar el "lo elegís vos" del copy de la sección.
const RATE_RANGE = { min: 6, max: 8, step: 0.25 } as const;

// Punto de partida del simulador — pedido del cliente (5-ago-2026, vía el
// usuario, con captura): 200 K iniciales, 30 K de aporte ANUAL, 7 % y 30 años.
// Antes eran 10 K / 500 mensuales / 6 % / 20 años.
//
// Dos cosas que cambiaron de criterio y conviene que queden dichas, para que
// nadie las "corrija" de vuelta creyendo que son un descuido:
//
//  · La tasa arranca en 7, el MEDIO de la banda 6–8. Hasta el 3-ago el default
//    era 6 —el extremo bajo, deliberadamente el menos prometedor de los que la
//    página muestra sin que nadie toque nada—. 7 es una decisión de quien
//    decide, no un olvido; el aviso de que la tasa la elige el lector y no es
//    una proyección del Fondo sigue puesto (ver el copy de la sección y el pie
//    del simulador).
//  · El aporte arranca en ANUAL. La conversión al togglear a mensual es exacta
//    (÷12 = 2.500), así que nadie cae en un monto redondeado raro.
const DEFAULTS = {
  initial: 200_000,
  aporte: 30_000,
  freq: "anual",
  rate: 7,
  years: 30,
} as const;

export function FondoCalculadora() {
  return <CalculadoraSim defaults={DEFAULTS} fees={FEE} rateRange={RATE_RANGE} />;
}
