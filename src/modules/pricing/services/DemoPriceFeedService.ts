import { Decimal } from 'decimal.js';
import { cacheClient } from '../../../infrastructure/cache/index.js';
import { logger } from '../../../shared/middleware/logger.js';
import { MockPriceAdapter } from '../adapters/mockPriceAdapter.js';
import { TickRepository, TickRow } from '../repositories/tickRepository.js';
import { PriceValidationService } from './priceValidationService.js';
import { normalizeSymbol, normalizeCacheSymbol } from '../utils/symbolNormalizer.js';

type PendingDemoTick = Omit<TickRow, 'id' | 'created_at'>;
const FLUSH_RETRY_BACKOFF_MS = [5000, 10000, 20000, 40000, 60000];

export class DemoPriceFeedService {
  private readonly adapter: MockPriceAdapter;
  private readonly tickRepository: TickRepository;
  private readonly validationService: PriceValidationService;
  private readonly tickBuffer: PendingDemoTick[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private retentionTimer: NodeJS.Timeout | null = null;
  private readonly bufferLimit = 50;
  private readonly maxBufferSize = 1000;
  private readonly flushIntervalMs = 5000;
  private flushInProgress = false;
  private bufferDropWarningActive = false;
  private consecutiveFlushFailures = 0;
  private nextFlushAt = 0;

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
    void this.pruneExpiredTicks();
    this.flushTimer = setInterval(() => {
      void this.flushTicks();
    }, this.flushIntervalMs);
    this.flushTimer.unref?.();

    this.retentionTimer = setInterval(
      () => {
        void this.pruneExpiredTicks();
      },
      60 * 60 * 1000
    );
    this.retentionTimer.unref?.();
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
    if (this.tickBuffer.length > this.maxBufferSize) {
      const droppedCount = this.tickBuffer.length - this.maxBufferSize;
      this.tickBuffer.splice(0, droppedCount);
      if (!this.bufferDropWarningActive) {
        logger.warn('Dropped oldest demo ticks because the persistence buffer is full', {
          droppedCount,
          maxBufferSize: this.maxBufferSize,
        });
        this.bufferDropWarningActive = true;
      }
    }

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
    if (this.tickBuffer.length === 0 || this.flushInProgress || Date.now() < this.nextFlushAt) {
      return;
    }
    const batch = this.tickBuffer.splice(0, this.tickBuffer.length);
    this.bufferDropWarningActive = false;
    this.flushInProgress = true;
    try {
      await this.tickRepository.saveBatch(batch);
      this.consecutiveFlushFailures = 0;
      this.nextFlushAt = 0;
    } catch (error) {
      this.consecutiveFlushFailures = Math.min(
        this.consecutiveFlushFailures + 1,
        FLUSH_RETRY_BACKOFF_MS.length
      );
      const retryDelayMs = FLUSH_RETRY_BACKOFF_MS[this.consecutiveFlushFailures - 1];
      this.nextFlushAt = Date.now() + retryDelayMs;
      logger.error('Failed to persist demo ticks', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        count: batch.length,
        dropped: true,
        retryDelayMs,
      });
    } finally {
      this.flushInProgress = false;
    }
  }

  private async pruneExpiredTicks(): Promise<void> {
    try {
      const retentionDays = Number(process.env.DEMO_TICK_RETENTION_DAYS || '30');
      if (!Number.isInteger(retentionDays) || retentionDays < 1) {
        throw new Error('DEMO_TICK_RETENTION_DAYS must be a positive integer');
      }
      const deletedCount = await this.tickRepository.pruneExpiredDemoTicks(retentionDays);
      logger.info('Pruned expired demo price ticks', { deletedCount, retentionDays });
    } catch (error) {
      logger.error('Failed to prune expired demo price ticks', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const demoPriceFeedService = new DemoPriceFeedService();
