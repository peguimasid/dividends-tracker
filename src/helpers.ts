/**
 * Parse a Brazilian decimal string ("0,21630429188") into a number.
 */
export function parseBrazilianDecimal(value: string): number {
  return Number.parseFloat(value.replace(",", "."));
}

/**
 * Extract the issuing company code from a full ticker.
 * Example: "PETR4" → "PETR", "BBAS3" → "BBAS"
 */
export function extractIssuingCompany(ticker: string): string {
  return ticker.replace(/\d+$/, "").toUpperCase();
}

/**
 * Format a Brazilian decimal value to a fixed number of decimal places.
 */
export function formatBRL(value: number, decimals = 8): string {
  return `R$ ${value.toFixed(decimals)}`;
}
