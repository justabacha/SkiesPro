export function getPriceDecimalPlaces(
  symbol: string | null | undefined,
  configuredPlaces?: number,
  price = 0
): number {
  const normalizedSymbol = (symbol ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (normalizedSymbol.endsWith('JPY')) return 3;
  if (normalizedSymbol.startsWith('XAU') || normalizedSymbol.includes('GOLD')) return 2;
  if (normalizedSymbol.startsWith('WTI')) return 3;
  if (normalizedSymbol.startsWith('BTC') || normalizedSymbol.startsWith('ETH')) return 2;
  return configuredPlaces ?? (price > 100 ? 2 : 5);
}

export function getPipSize(
  symbol: string | null | undefined,
  configuredPlaces?: number,
  price = 0
): number {
  const places = getPriceDecimalPlaces(symbol, configuredPlaces, price);
  return places >= 4 ? 10 ** (1 - places) : 10 ** -places;
}

export function isCryptoOrCommodity(symbol: string | null | undefined): boolean {
  const normalized = (symbol ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  return (
    normalized.startsWith('BTC') ||
    normalized.startsWith('ETH') ||
    normalized.startsWith('XAU') ||
    normalized.includes('GOLD') ||
    normalized.startsWith('WTI')
  );
}

export function formatPriceDelta(
  symbol: string | null | undefined,
  rawDiff: number,
  pipPlaces = 5,
  price = 0
): string {
  if (isCryptoOrCommodity(symbol)) {
    const sign = rawDiff >= 0 ? '+' : '-';
    return `${sign}$${Math.abs(rawDiff).toFixed(2)}`;
  }
  const pipSize = getPipSize(symbol, pipPlaces, price);
  const pips = rawDiff / pipSize;
  const sign = pips >= 0 ? '+' : '';
  return `${sign}${pips.toFixed(1)} Pips`;
}
