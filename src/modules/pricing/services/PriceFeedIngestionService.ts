import { KrakenAdapter } from '../adapters/krakenAdapter.js';
import { MockPriceAdapter } from '../adapters/mockPriceAdapter.js';
import { PriceValidationService } from './priceValidationService.js';
import { TickRepository, TickRow } from '../repositories/tickRepository.js';
import { PriceDistributionService } from './priceDistributionService.js';
import { OHLCService } from './OHLCService.js';
import { Decimal } from 'decimal.js';
import { logger } from '../../../shared/middleware/logger.js';

export class PriceFeedIngestionService {
  private adapter: KrakenAdapter | MockPriceAdapter;
  private isUsingMock: boolean = false;
  private tickBuffer: Omit<TickRow, 'id' | 'created_at'>[] = [];
  private readonly batchSize = 50;
  private readonly flushInterval = 1000; // 1 second

  constructor(
    private validationService: PriceValidationService,
    private tickRepo: TickRepository,
    private distributionService: PriceDistributionService,
    private ohlcService: OHLCService,
    private useMockFallback: boolean = false
  ) {
    if (this.useMockFallback) {
      this.adapter = new MockPriceAdapter(this.handleTick.bind(this));
      this.isUsingMock = true;
    } else {
      this.adapter = new KrakenAdapter(
        this.handleTick.bind(this),
        this.handleKrakenError.bind(this)
      );
    }
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

  private handleKrakenError(error: any) {
    if (!this.isUsingMock) {
      logger.warn('Kraken connection failed, falling back to mock prices', {
        error: error.message,
      });
      this.switchToMock();
    }
  }

  private switchToMock() {
    this.isUsingMock = true;
    // Disconnect old adapter if it was Kraken
    if (this.adapter instanceof KrakenAdapter) {
      try {
        this.adapter.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    }

    this.adapter = new MockPriceAdapter(this.handleTick.bind(this));
    this.adapter.connect();
    logger.info('Switched to Mock Price Adapter');
  }

  private async flushTicks() {
    if (this.tickBuffer.length === 0) return;

    const ticksToSave = [...this.tickBuffer];
    this.tickBuffer = [];

    try {
      await this.tickRepo.saveBatch(ticksToSave);
    } catch (error: any) {
      logger.error('Failed to save tick batch', {
        error: error.message,
        count: ticksToSave.length,
      });
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
