/**
 * Symbol Normalization Utility
 *
 * Normalizes incoming symbol strings to match the database format.
 * Converts 6-character forex/crypto pairs (e.g., "EURUSD", "BTCUSD")
 * to the standard format with slash (e.g., "EUR/USD", "BTC/USD").
 *
 * Known patterns:
 * - 6-char pairs: First 3 chars + "/" + Last 3 chars
 * - Examples: EURUSD → EUR/USD, GBPUSD → GBP/USD, BTCUSD → BTC/USD, ETHUSD → ETH/USD
 */

export function normalizeSymbol(symbol: string): string {
  if (!symbol) return '';

  // If already contains a slash, return as-is
  if (symbol.includes('/')) {
    return symbol.toUpperCase();
  }

  // If exactly 6 characters, assume it's a forex/crypto pair and insert slash
  if (symbol.length === 6) {
    const base = symbol.substring(0, 3).toUpperCase();
    const quote = symbol.substring(3, 6).toUpperCase();
    return `${base}/${quote}`;
  }

  // For other lengths, return uppercase as-is
  return symbol.toUpperCase();
}

/**
 * Attempts to find a valid symbol by trying the original and normalized versions.
 * Returns the first valid symbol found, or null if none match.
 */
export async function findValidSymbol(
  originalSymbol: string,
  symbolValidator: (symbol: string) => Promise<boolean>
): Promise<string | null> {
  const normalized = normalizeSymbol(originalSymbol);

  // Try original first (in case it's already correct)
  if (originalSymbol !== normalized) {
    if (await symbolValidator(originalSymbol)) {
      return originalSymbol;
    }
  }

  // Try normalized version
  if (await symbolValidator(normalized)) {
    return normalized;
  }

  return null;
}
