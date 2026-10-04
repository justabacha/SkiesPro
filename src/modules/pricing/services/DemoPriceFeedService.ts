import { Decimal } from 'decimal.js';
import { cacheClient } from '../../../infrastructure/cache/index.js';
import { logger } from '../../../shared/middleware/logger.js';
import { MockPriceAdapter } from '../adapters/mockPriceAdapter.js';
import { TickRepository, TickRow } from '../repositories/tickRepository.js';
import { PriceValidationService } from './priceValidationService.js';
import { normalizeSymbol, normalizeCacheSymbol } from '../utils/symbolNormalizer.js';

type PendingDemoTick = Omit<TickRow, 'id' | 'created_at'>;

export class DemoPriceFeedService {
  private readonly adapter: MockPriceAdapter;
  private readonly tickRepository: TickRepository;
  private readonly validationService: PriceValidationService;
  private readonly tickBuffer: PendingDemoTick[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private retentionTimer: NodeJS.Timeout | null = null;
  private readonly bufferLimit = 50;

  constructor(
    tickRepository = new TickRepository(),
    validationService = new PriceValidationService()
  ) {
    this.tickRepository = tickRepository;
    this.validationService = validationService;
    this.adapter = new MockPriceAdapter((symbol, bid, ask, tickTime) => {
      void this.handleTick(symbol, bid, ask, tickTime).catch((error: unknown) => {
        logger.error('Failed to process demo price tick', {
          error: error instanceof Error ? error.message : 'Unknown error',
          symbol,
        });
      });
    });
  }

  start(): void {
    if (this.flushTimer || this.retentionTimer) return;
    this.adapter.connect();
    this.flushTimer = setInterval(() => {
      void this.flushTicks();
    }, 1000);
    this.retentionTimer = setInterval(
      () => {
        void this.pruneExpiredTicks();
      },
      60 * 60 * 1000
    );
  }

  async stop(): Promise<void> {
    this.adapter.disconnect();
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.retentionTimer) clearInterval(this.retentionTimer);
    this.flushTimer = null;
    this.retentionTimer = null;
    await this.flushTicks();
  }

  async getQuote(symbol: string): Promise<{
    symbol: string;
    bid: string;
    ask: string;
    mid: string;
    time: string;
  } | null> {
    const key = `demo:price:${normalizeCacheSymbol(normalizeSymbol(symbol))}`;
    const quote = await cacheClient.get('pricing', key);
    if (!quote || typeof quote !== 'object') return null;
    return quote;
  }

  private async handleTick(symbol: string, bid: string, ask: string, time: Date): Promise<void> {
    const normalizedSymbol = normalizeSymbol(symbol);
    const mid = new Decimal(bid).plus(ask).div(2).toString();
    if (!this.validationService.validate(normalizedSymbol, mid, time)) return;

    const tick: PendingDemoTick = {
      symbol: normalizedSymbol,
      tick_time: time,
      bid_price: bid,
      ask_price: ask,
      mid_price: mid,
      volume: '0',
      source: 'demo',
    };
    this.tickBuffer.push(tick);

    const message = JSON.stringify({
      symbol: normalizedSymbol,
      bid,
      ask,
      mid,
      time: time.toISOString(),
      source: 'demo',
    });
    const key = `demo:price:${normalizeCacheSymbol(normalizedSymbol)}`;

    await cacheClient.set('pricing', key, JSON.parse(message), 10);
    await cacheClient.publish(
      'pricing',
      `demo:ticks:${normalizeCacheSymbol(normalizedSymbol)}`,
      message
    );
    await cacheClient.publish('pricing', 'demo:ticks:all', message);

    if (this.tickBuffer.length >= this.bufferLimit) await this.flushTicks();
  }

  private async flushTicks(): Promise<void> {
    if (this.tickBuffer.length === 0) return;
    const batch = this.tickBuffer.splice(0, this.tickBuffer.length);
    try {
      await this.tickRepository.saveBatch(batch);
    } catch (error) {
      this.tickBuffer.unshift(...batch);
      logger.error('Failed to persist demo ticks', {
        error: error instanceof Error ? error.message : 'Unknown error',
        count: batch.length,
      });
    }
  }

  private async pruneExpiredTicks(): Promise<void> {
    try {
      const result = await this.tickRepository.pruneExpiredDemoTicks();
      logger.info('Pruned expired demo price ticks', { deletedCount: result });
    } catch (error) {
      logger.error('Failed to prune expired demo price ticks', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const demoPriceFeedService = new DemoPriceFeedService();
