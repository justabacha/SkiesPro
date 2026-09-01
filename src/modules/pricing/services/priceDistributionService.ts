import { cacheClient } from '../../../infrastructure/cache/index.js';

export class PriceDistributionService {
  private readonly cluster = 'pricing';

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

    const message = JSON.stringify(tickData);

    // 1. Update Latest Price Cache
    await cacheClient.set(this.cluster, `latest_price:${symbol}`, message);

    // 2. Publish to Pub/Sub
    await cacheClient.publish(this.cluster, `ticks:${symbol}`, message);
    await cacheClient.publish(this.cluster, 'ticks:all', message);
  }

  async getLatestPrice(symbol: string): Promise<any | null> {
    const data = await cacheClient.get(this.cluster, `latest_price:${symbol}`);
    return data ? JSON.parse(data) : null;
  }
}
