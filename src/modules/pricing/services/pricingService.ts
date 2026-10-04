import { pgPool } from '../../../config/database.js';
import { CandleRepository } from '../repositories/candleRepository.js';
import { PriceDistributionService } from './priceDistributionService.js';
import { MarketStatusService } from './MarketStatusService.js';
import {
  PriceResponseDto,
  CandleRequestDto,
  AssetResponseDto,
  MarketStatusResponseDto,
} from '../dto/pricing.dto.js';
import { normalizeSymbol } from '../utils/symbolNormalizer.js';

export class PricingService {
  private candleRepo: CandleRepository;
  private distributionService: PriceDistributionService;
  private marketStatusService: MarketStatusService;

  constructor(marketStatusService: MarketStatusService) {
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

    const tick = await this.distributionService.getLatestPrice(normalizedSymbol);
    if (!tick) throw new Error('MARKET_DATA_UNAVAILABLE');

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
    const limit = Math.min(Math.max(query.limit || 500, 1), 1000);
    const to = query.to ? new Date(query.to) : new Date();

    const bufferFactor = 1.2;
    const rangeMs = Math.ceil(granularity * limit * 1000 * bufferFactor);
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - rangeMs);

    const candles =
      granularity === 60
        ? await this.candleRepo.getCandles(normalizedSymbol, granularity, from, to, limit)
        : await this.candleRepo.getAggregatedCandles(
            normalizedSymbol,
            granularity,
            from,
            to,
            limit
          );

    return candles.map((c) => ({
      symbol: c.symbol,
      granularity_seconds: c.granularity_seconds,
      open_time: c.open_time instanceof Date ? c.open_time.toISOString() : new Date(c.open_time).toISOString(),
      close_time: c.close_time instanceof Date ? c.close_time.toISOString() : new Date(c.close_time).toISOString(),
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
