import { Decimal } from 'decimal.js';
import { logger } from '../../../shared/middleware/logger';

export class PriceValidationService {
  private lastPrices: Map<string, { price: Decimal; time: Date }> = new Map();
  private readonly thresholdPct: number;
  private readonly staleThresholdMs: number;

  constructor() {
    this.thresholdPct = parseFloat(process.env.PRICE_VALIDATION_THRESHOLD_PCT || '0.05');
    this.staleThresholdMs = parseInt(process.env.STALE_PRICE_THRESHOLD_SEC || '30') * 1000;
  }

  validate(symbol: string, newPrice: string, time: Date): boolean {
    const last = this.lastPrices.get(symbol);
    const price = new Decimal(newPrice);

    // If first tick, just store and return true
    if (!last) {
      this.lastPrices.set(symbol, { price, time });
      return true;
    }

    // Check for stale price (time travel or extremely delayed ticks)
    if (time.getTime() < last.time.getTime()) {
      logger.warn(
        `Stale tick detected for ${symbol}: tick time ${time.toISOString()} is older than last tick ${last.time.toISOString()}`
      );
      return false;
    }

    // 5% deviation rule
    const deviation = price.minus(last.price).abs().div(last.price);
    if (deviation.greaterThan(this.thresholdPct)) {
      logger.error(
        `Abnormal price deviation for ${symbol}: ${deviation.mul(100).toFixed(2)}% (last: ${last.price}, new: ${price})`
      );
      return false;
    }

    // Update last price
    this.lastPrices.set(symbol, { price, time });
    return true;
  }

  isStale(symbol: string): boolean {
    const last = this.lastPrices.get(symbol);
    if (!last) return true;

    const now = new Date();
    return now.getTime() - last.time.getTime() > this.staleThresholdMs;
  }
}
