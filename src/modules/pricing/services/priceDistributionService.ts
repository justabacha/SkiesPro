import { cacheClient } from '../../../infrastructure/cache/index.js';
import { DEFAULT_PRICE_TTL_MS, localCache } from '../../../infrastructure/cache/memoryCache.js';
import { normalizeSymbol, priceCacheKey } from '../utils/symbolNormalizer.js';

export class PriceDistributionService {
  private readonly cluster = 'pricing';

  async distributeTick(
    symbol: string,
    bid: string,
    ask: string,
    mid: string,
    time: Date
  ): Promise<void> {
    const normalizedSymbol = normalizeSymbol(symbol);
    const tickData = {
      symbol: normalizedSymbol,
      bid,
      ask,
      mid,
      time: time.toISOString(),
    };

    localCache.set(priceCacheKey(normalizedSymbol), tickData, DEFAULT_PRICE_TTL_MS);

    const message = JSON.stringify(tickData);

    await cacheClient.publish(this.cluster, `ticks:${normalizedSymbol}`, message);
    await cacheClient.publish(this.cluster, 'ticks:all', message);
  }

  async getLatestPrice(symbol: string): Promise<any | null> {
    return localCache.get(priceCacheKey(symbol)) || null;
  }
}
