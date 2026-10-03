import { cacheClient } from '../../../infrastructure/cache/index.js';

export class PriceDistributionService {
  private readonly cluster = 'pricing';
  private static inMemoryTicks: Map<string, any> = new Map();

  async distributeTick(
    symbol: string,
    bid: string,
    ask: string,
    mid: string,
    time: Date
  ): Promise<void> {
    const tickData = {
      symbol,
      bid,
      ask,
      mid,
      time: time.toISOString(),
    };

    // Store in-memory for fallback when Redis is unavailable or quota-exceeded
    PriceDistributionService.inMemoryTicks.set(symbol, tickData);

    const message = JSON.stringify(tickData);

    try {
      // 1. Update Latest Price Cache
      await cacheClient.set(this.cluster, `latest_price:${symbol}`, message);

      // 2. Publish to Pub/Sub
      await cacheClient.publish(this.cluster, `ticks:${symbol}`, message);
      await cacheClient.publish(this.cluster, 'ticks:all', message);
    } catch (error) {
      // Cache operations failed or were bypassed; in-memory fallback is active
    }
  }

  async getLatestPrice(symbol: string): Promise<any | null> {
    try {
      const data = await cacheClient.get(this.cluster, `latest_price:${symbol}`);
      if (data) {
        return typeof data === 'string' ? JSON.parse(data) : data;
      }
    } catch (error) {
      // Redis error, fall through to in-memory store
    }

    return PriceDistributionService.inMemoryTicks.get(symbol) || null;
  }
}
