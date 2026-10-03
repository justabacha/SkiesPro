export function getPriceDecimalPlaces(
  symbol: string,
  configuredPlaces?: number,
  price = 0
): number {
  const normalizedSymbol = symbol.replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (normalizedSymbol.endsWith('JPY')) return 3;
  if (normalizedSymbol.startsWith('XAU') || normalizedSymbol.includes('GOLD')) return 2;
  if (normalizedSymbol.startsWith('WTI')) return 3;
  if (normalizedSymbol.startsWith('BTC') || normalizedSymbol.startsWith('ETH')) return 2;
  return configuredPlaces ?? (price > 100 ? 2 : 5);
}

export function getPipSize(symbol: string, configuredPlaces?: number, price = 0): number {
  const places = getPriceDecimalPlaces(symbol, configuredPlaces, price);
  return places >= 4 ? 10 ** (1 - places) : 10 ** -places;
}
