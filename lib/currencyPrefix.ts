/**
 * Returns the display prefix for a given ISO currency code.
 * USD → "$"  |  ARS → "ARS "  |  others → "<CODE> "
 */
export function currencyPrefix(currency: string | null | undefined): string {
  if (!currency || currency === "USD") return "$";
  return `${currency} `;
}
