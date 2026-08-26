import { pgPool } from '../../../config/database';
import { TickRepository } from '../repositories/tickRepository';
import { CandleRepository } from '../repositories/candleRepository';
import { PriceDistributionService } from './priceDistributionService';
import { MarketStatusService } from './MarketStatusService';
import {
  PriceResponseDto,
  CandleRequestDto,
  AssetResponseDto,
  MarketStatusResponseDto,
} from '../dto/pricing.dto';
import { normalizeSymbol } from '../utils/symbolNormalizer';

export class PricingService {
  private tickRepo: TickRepository;
  private candleRepo: CandleRepository;
  private distributionService: PriceDistributionService;
  private marketStatusService: MarketStatusService;

  constructor(marketStatusService: MarketStatusService) {
    this.tickRepo = new TickRepository();
    this.candleRepo = new CandleRepository();
    this.distributionService = new PriceDistributionService();
    this.marketStatusService = marketStatusService;
  }

  async getActiveAssets(): Promise<AssetResponseDto[]> {
    const result = await pgPool.query(
      `SELECT symbol, name, asset_type, is_active FROM trading.assets WHERE is_active = TRUE`
    );
    return result.rows;
  }

  async getLatestPrice(symbol: string): Promise<PriceResponseDto> {
    const normalizedSymbol = normalizeSymbol(symbol);

    // Try cache first
    let tick = await this.distributionService.getLatestPrice(normalizedSymbol);

    if (!tick) {
      // Fallback to DB
      const dbTick = await this.tickRepo.getLatest(normalizedSymbol);
      if (!dbTick) throw new Error(`No price data available for ${normalizedSymbol}`);
      tick = {
        symbol: dbTick.symbol,
        bid: dbTick.bid_price,
        ask: dbTick.ask_price,
        mid: dbTick.mid_price,
        time: dbTick.tick_time.toISOString(),
      };
    }

    return {
      symbol: tick.symbol,
      bid: tick.bid,
      ask: tick.ask,
      mid: tick.mid,
      tick_time: tick.time,
    };
  }

  async getCandles(query: CandleRequestDto) {
    const normalizedSymbol = normalizeSymbol(query.symbol);
    const granularity = query.granularity || 60;
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - 24 * 60 * 60 * 1000);
    const limit = query.limit || 500;

    const candles = await this.candleRepo.getCandles(
      normalizedSymbol,
      granularity,
      from,
      to,
      limit
    );

    return candles.map((c) => ({
      symbol: c.symbol,
      granularity_seconds: c.granularity_seconds,
      open_time: c.open_time.toISOString(),
      close_time: c.close_time.toISOString(),
      open: c.open_price,
      high: c.high_price,
      low: c.low_price,
      close: c.close_price,
      volume: c.volume,
    }));
  }

  async getMarketStatus(symbol: string): Promise<MarketStatusResponseDto> {
    const normalizedSymbol = normalizeSymbol(symbol);
    const isOpen = await this.marketStatusService.isMarketOpen(normalizedSymbol);
    const hours = await this.marketStatusService.getMarketHours(normalizedSymbol);

    return {
      symbol: normalizedSymbol,
      is_open: isOpen,
      opens_at: hours?.opens_at || '00:00:00',
      closes_at: hours?.closes_at || '23:59:59',
      timezone: hours?.timezone || 'UTC',
    };
  }
}
