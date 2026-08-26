import { BinanceAdapter } from '../adapters/binanceAdapter';
import { PriceValidationService } from './priceValidationService';
import { TickRepository, TickRow } from '../repositories/tickRepository';
import { PriceDistributionService } from './priceDistributionService';
import { OHLCService } from './OHLCService';
import { Decimal } from 'decimal.js';
import { logger } from '../../../shared/middleware/logger';

export class PriceFeedIngestionService {
  private adapter: BinanceAdapter;
  private tickBuffer: Omit<TickRow, 'id' | 'created_at'>[] = [];
  private readonly batchSize = 50;
  private readonly flushInterval = 1000; // 1 second

  constructor(
    private validationService: PriceValidationService,
    private tickRepo: TickRepository,
    private distributionService: PriceDistributionService,
    private ohlcService: OHLCService
  ) {
    this.adapter = new BinanceAdapter(this.handleTick.bind(this));
  }

  start() {
    this.adapter.connect();

    // Periodically flush ticks buffer to DB
    setInterval(() => {
      this.flushTicks().catch((err) => {
        logger.error('Error flushing ticks', { error: err.message });
      });
    }, this.flushInterval);

    // Periodically flush candles
    setInterval(() => {
      this.ohlcService.flush().catch((err) => {
        logger.error('Error flushing candles', { error: err.message });
      });
    }, 10000);
  }

  stop() {
    this.adapter.disconnect();
  }

  private async flushTicks() {
    if (this.tickBuffer.length === 0) return;

    const ticksToSave = [...this.tickBuffer];
    this.tickBuffer = [];

    try {
      await this.tickRepo.saveBatch(ticksToSave);
      // logger.debug(`Saved batch of ${ticksToSave.length} ticks`);
    } catch (error: any) {
      logger.error('Failed to save tick batch', {
        error: error.message,
        count: ticksToSave.length,
      });
      // Re-add to buffer if failed? risky if it's a persistent error.
      // For now just log.
    }
  }

  private async handleTick(symbol: string, bid: string, ask: string, time: Date) {
    const mid = new Decimal(bid).plus(ask).div(2).toString();

    // 1. Validate
    if (!this.validationService.validate(symbol, mid, time)) {
      return;
    }

    try {
      // 2. Add to persistence buffer
      this.tickBuffer.push({
        symbol,
        tick_time: time,
        bid_price: bid,
        ask_price: ask,
        mid_price: mid,
        volume: '0',
      });

      // 3. Distribute (Cache + Pub/Sub) - REALTIME
      await this.distributionService.distributeTick(symbol, bid, ask, mid, time);

      // 4. Process for OHLC
      await this.ohlcService.processTick(symbol, mid, '0', time);

      // 5. Check if buffer full
      if (this.tickBuffer.length >= this.batchSize) {
        await this.flushTicks();
      }
    } catch (error: any) {
      logger.error(`Error handling tick for ${symbol}`, { error: error.message });
    }
  }
}
