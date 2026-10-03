import { KrakenAdapter } from '../adapters/krakenAdapter.js';
import { CoinbaseAdapter } from '../adapters/coinbaseAdapter.js';
import { MockPriceAdapter } from '../adapters/mockPriceAdapter.js';
import { PriceValidationService } from './priceValidationService.js';
import { TickRepository, TickRow } from '../repositories/tickRepository.js';
import { PriceDistributionService } from './priceDistributionService.js';
import { OHLCService } from './OHLCService.js';
import { Decimal } from 'decimal.js';
import { logger } from '../../../shared/middleware/logger.js';
import { normalizeSymbol } from '../utils/symbolNormalizer.js';

export type PriceFeedTier = 'tier1_kraken' | 'tier2_coinbase' | 'tier3_mock';

export class PriceFeedIngestionService {
  public static currentTier: PriceFeedTier = 'tier1_kraken';
  public static tier3StartedAt: number | null = null;

  private krakenAdapter: KrakenAdapter;
  private coinbaseAdapter: CoinbaseAdapter;
  private mockAdapter: MockPriceAdapter;

  private lastTier1TickTime: number = 0;
  private lastTier2TickTime: number = 0;

  private heartbeatInterval: NodeJS.Timeout | null = null;
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
    this.krakenAdapter = new KrakenAdapter(
      (symbol, bid, ask, time) => this.handleAdapterTick('tier1_kraken', symbol, bid, ask, time),
      this.handleKrakenError.bind(this)
    );

    this.coinbaseAdapter = new CoinbaseAdapter(
      (symbol, bid, ask, time) => this.handleAdapterTick('tier2_coinbase', symbol, bid, ask, time),
      this.handleCoinbaseError.bind(this)
    );

    this.mockAdapter = new MockPriceAdapter((symbol, bid, ask, time) =>
      this.handleAdapterTick('tier3_mock', symbol, bid, ask, time)
    );

    if (this.useMockFallback) {
      PriceFeedIngestionService.currentTier = 'tier3_mock';
      PriceFeedIngestionService.tier3StartedAt = Date.now();
    } else {
      PriceFeedIngestionService.currentTier = 'tier1_kraken';
      PriceFeedIngestionService.tier3StartedAt = null;
    }
  }

  start() {
    if (this.useMockFallback) {
      this.mockAdapter.connect();
    } else {
      this.krakenAdapter.connect();
      this.coinbaseAdapter.connect();
    }

    // Start heartbeat watchdog (runs every 1 second)
    this.heartbeatInterval = setInterval(() => {
      this.checkFeedHeartbeat();
    }, 1000);

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
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.krakenAdapter.disconnect();
    this.coinbaseAdapter.disconnect();
    this.mockAdapter.disconnect();
  }

  private handleKrakenError(error: any) {
    logger.warn('Kraken WS error (background reconnection active)', {
      error: error?.message || error,
    });
  }

  private handleCoinbaseError(error: any) {
    logger.warn('Coinbase WS error (background reconnection active)', {
      error: error?.message || error,
    });
  }

  private handleAdapterTick(
    sourceTier: PriceFeedTier,
    symbol: string,
    bid: string,
    ask: string,
    time: Date
  ) {
    const now = Date.now();

    if (sourceTier === 'tier1_kraken') {
      this.lastTier1TickTime = now;
      // Auto-recovery: If Tier 1 receives ticks again while on Tier 2 or 3, promote to Tier 1
      if (PriceFeedIngestionService.currentTier !== 'tier1_kraken' && !this.useMockFallback) {
        logger.info('Primary price feed (Kraken) recovered. Promoting feed to Tier 1.');
        PriceFeedIngestionService.currentTier = 'tier1_kraken';
        PriceFeedIngestionService.tier3StartedAt = null;
        this.mockAdapter.disconnect();
      }
    } else if (sourceTier === 'tier2_coinbase') {
      this.lastTier2TickTime = now;
    }

    // Process tick only if it matches the current active tier
    if (sourceTier === PriceFeedIngestionService.currentTier) {
      this.handleTick(symbol, bid, ask, time);
    }
  }

  private checkFeedHeartbeat() {
    if (this.useMockFallback) return;

    const now = Date.now();
    const dt1 = this.lastTier1TickTime === 0 ? Infinity : now - this.lastTier1TickTime;
    const dt2 = this.lastTier2TickTime === 0 ? Infinity : now - this.lastTier2TickTime;

    const currentTier = PriceFeedIngestionService.currentTier;

    // 1. Primary (Tier 1 Kraken) healthy (ticks within 3s)
    if (dt1 <= 3000) {
      if (currentTier !== 'tier1_kraken') {
        logger.info('Tier 1 (Kraken) ticks resumed. Promoting to Tier 1.');
        PriceFeedIngestionService.currentTier = 'tier1_kraken';
        PriceFeedIngestionService.tier3StartedAt = null;
        this.mockAdapter.disconnect();
      }
      return;
    }

    // 2. Primary stale (>3s). Check Secondary (Tier 2 Coinbase)
    if (dt2 <= 10000) {
      if (currentTier !== 'tier2_coinbase') {
        logger.warn('Tier 1 (Kraken) silent >3s. Failing over to Tier 2 (Coinbase).');
        PriceFeedIngestionService.currentTier = 'tier2_coinbase';
        PriceFeedIngestionService.tier3StartedAt = null;
        this.mockAdapter.disconnect();
      }
      return;
    }

    // 3. Both Primary (>10s) and Secondary (>10s) stale -> Tier 3 Mock fallback
    if (dt1 > 10000 && dt2 > 10000) {
      if (currentTier !== 'tier3_mock') {
        logger.error(
          'Both Primary (Kraken) and Secondary (Coinbase) price feeds silent >10s. Activating Tier 3 (Mock) fallback.'
        );
        PriceFeedIngestionService.currentTier = 'tier3_mock';
        if (!PriceFeedIngestionService.tier3StartedAt) {
          PriceFeedIngestionService.tier3StartedAt = now;
        }
        this.mockAdapter.connect();
      }
    }
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
    const normalizedSymbol = normalizeSymbol(symbol);
    const mid = new Decimal(bid).plus(ask).div(2).toString();

    // 1. Validate
    if (!this.validationService.validate(normalizedSymbol, mid, time)) {
      return;
    }

    try {
      // 2. Add to persistence buffer
      this.tickBuffer.push({
        symbol: normalizedSymbol,
        tick_time: time,
        bid_price: bid,
        ask_price: ask,
        mid_price: mid,
        volume: '0',
      });

      // 3. Distribute (Cache + Pub/Sub) - REALTIME
      await this.distributionService.distributeTick(normalizedSymbol, bid, ask, mid, time);

      // 4. Process for OHLC
      await this.ohlcService.processTick(normalizedSymbol, mid, '0', time);

      // 5. Check if buffer full
      if (this.tickBuffer.length >= this.batchSize) {
        await this.flushTicks();
      }
    } catch (error: any) {
      logger.error(`Error handling tick for ${normalizedSymbol}`, { error: error.message });
    }
  }
}
