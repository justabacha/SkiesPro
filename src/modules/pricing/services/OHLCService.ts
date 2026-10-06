import { Decimal } from 'decimal.js';
import { CandleRepository } from '../repositories/candleRepository.js';

export class OHLCService {
  private currentCandles: Map<
    string,
    {
      symbol: string;
      open: Decimal;
      high: Decimal;
      low: Decimal;
      close: Decimal;
      volume: bigint;
      openTime: Date;
      source: string;
    }
  > = new Map();

  constructor(private candleRepo: CandleRepository) {}

  async processTick(
    symbol: string,
    price: string,
    volume: string,
    time: Date,
    source: string
  ): Promise<void> {
    const granularity = 60; // 1-minute candles
    const openTimeMs = Math.floor(time.getTime() / (granularity * 1000)) * (granularity * 1000);
    const openTime = new Date(openTimeMs);
    const key = `${symbol}:${source}:${granularity}`;

    const current = this.currentCandles.get(key);
    const priceDec = new Decimal(price);
    const volBig = BigInt(Math.floor(parseFloat(volume)));

    if (current && current.openTime.getTime() === openTimeMs) {
      // Update existing candle
      current.high = Decimal.max(current.high, priceDec);
      current.low = Decimal.min(current.low, priceDec);
      current.close = priceDec;
      current.volume += volBig;
    } else {
      // If there was a previous candle, save it
      if (current) {
        await this.saveCandle(current, granularity, source);
      }

      // Start new candle
      this.currentCandles.set(key, {
        symbol,
        open: priceDec,
        high: priceDec,
        low: priceDec,
        close: priceDec,
        volume: volBig,
        openTime,
        source,
      });
    }
  }

  private async saveCandle(
    candle: {
      symbol: string;
      open: Decimal;
      high: Decimal;
      low: Decimal;
      close: Decimal;
      volume: bigint;
      openTime: Date;
    },
    granularity: number,
    source: string
  ): Promise<void> {
    await this.candleRepo.upsert({
      symbol: candle.symbol,
      granularity_seconds: granularity,
      open_time: candle.openTime,
      close_time: new Date(candle.openTime.getTime() + granularity * 1000 - 1),
      open_price: candle.open.toString(),
      high_price: candle.high.toString(),
      low_price: candle.low.toString(),
      close_price: candle.close.toString(),
      volume: candle.volume.toString(),
      source,
    });
  }

  // Called periodically to flush finished candles
  async flush(): Promise<void> {
    const now = new Date();
    const granularity = 60;
    const currentOpenTimeMs =
      Math.floor(now.getTime() / (granularity * 1000)) * (granularity * 1000);

    for (const [key, candle] of this.currentCandles.entries()) {
      if (candle.openTime.getTime() < currentOpenTimeMs) {
        await this.saveCandle(candle, granularity, candle.source);
        this.currentCandles.delete(key);
      }
    }
  }
}
