// Formato numérico rioplatense para los datos de los informes: coma decimal,
// punto de miles, y el signo menos tipográfico real (−, U+2212) en vez del
// guion. Compartido por las barras y las tablas del artículo.

/** Número con coma decimal y punto de miles. `1234.5` → "1.234,5". */
export function fmtNum(n: number, dec = 2): string {
  const fixed = n.toFixed(dec);
  const [whole, frac] = fixed.split(".");
  const withSep = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return frac ? `${withSep},${frac}` : withSep;
}

/**
 * Retorno con signo y "%". `1.8` → "+1,80 %", `-0.33` → "−0,33 %",
 * `0` → "0,00 %" (neutro, sin signo). Usa − tipográfico para alinear en mono.
 */
export function fmtPct(n: number, dec = 2): string {
  if (n === 0) return `${fmtNum(0, dec)} %`;
  const sign = n > 0 ? "+" : "−";
  return `${sign}${fmtNum(Math.abs(n), dec)} %`;
}

/**
 * Color semántico de un retorno: verde bosque / oxblood / pizarra en el cero.
 * Sobre navy usa las variantes brillantes (lenguaje-visual §1.4): los tonos
 * profundos se apagan contra el azul oscuro.
 */
export function colorDelta(n: number, navy = false): string {
  if (n > 0) return navy ? "#7BC9A0" : "var(--pos)";
  if (n < 0) return navy ? "#E9999A" : "var(--neg)";
  return navy ? "rgba(255,255,255,0.5)" : "var(--neu)";
}
