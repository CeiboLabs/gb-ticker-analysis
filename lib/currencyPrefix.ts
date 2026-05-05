/**
 * Returns the display prefix for a given ISO currency code.
 * USD → "$"  |  EUR → "€"  |  GBP → "£"  |  JPY → "¥"  |  ARS → "ARS "
 * Symbol forms are used for the Big-5 globally-recognizable currencies; the
 * rest fall back to "<CODE> " so the unit stays unambiguous.
 */
const SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
};

export function currencyPrefix(currency: string | null | undefined): string {
  if (!currency) return "$";
  const code = currency.toUpperCase();
  return SYMBOL[code] ?? `${code} `;
}
