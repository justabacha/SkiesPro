import { PoolClient } from 'pg';
import { CandleRepository } from '../../src/modules/pricing/repositories/candleRepository.js';
import { PricingService } from '../../src/modules/pricing/services/pricingService.js';
import { MarketStatusService } from '../../src/modules/pricing/services/MarketStatusService.js';
import { PriceValidationService } from '../../src/modules/pricing/services/priceValidationService.js';

describe('CandleRepository and PricingService (WP-08 Candle Fixes)', () => {
  let mockClient: { query: jest.Mock };
  let repo: CandleRepository;

  beforeEach(() => {
    mockClient = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    repo = new CandleRepository(mockClient as unknown as PoolClient);
  });

  describe('CandleRepository', () => {
    it('upserts candles using the source-inclusive unique constraint', async () => {
      const candle = {
        symbol: 'EUR/USD',
        granularity_seconds: 60,
        open_time: new Date('2026-10-04T12:00:00Z'),
        close_time: new Date('2026-10-04T12:00:59.999Z'),
        open_price: '1.1245',
        high_price: '1.1250',
        low_price: '1.1240',
        close_price: '1.1248',
        volume: '0',
        source: 'live',
      };

      await repo.upsert(candle);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(
          /volume, source\s*\)\s*VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10\)\s*ON CONFLICT \(symbol, granularity_seconds, open_time, source\)/i
        ),
        [
          candle.symbol,
          candle.granularity_seconds,
          candle.open_time,
          candle.close_time,
          candle.open_price,
          candle.high_price,
          candle.low_price,
          candle.close_price,
          candle.volume,
          candle.source,
        ]
      );
    });

    it('getCandles queries newest N candles and returns ASC order', async () => {
      const from = new Date('2026-10-04T00:00:00Z');
      const to = new Date('2026-10-04T12:00:00Z');

      await repo.getCandles('EUR/USD', 60, from, to, 200);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(/ORDER BY open_time DESC\s+LIMIT \$5[\s\S]*ORDER BY open_time ASC/i),
        ['EUR/USD', 60, from, to, 200]
      );
    });

    it('getAggregatedCandles aggregates 60s candles into buckets for granularity > 60', async () => {
      const from = new Date('2026-10-04T00:00:00Z');
      const to = new Date('2026-10-04T12:00:00Z');

      await repo.getAggregatedCandles('EUR/USD', 300, from, to, 100);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(/GROUP BY floor\(extract\(epoch from open_time\) \/ \$2\)/i),
        ['EUR/USD', 300, from, to, 100]
      );
    });
  });

  describe('PricingService.getCandles', () => {
    let pricingService: PricingService;

    beforeEach(() => {
      const validationService = new PriceValidationService();
      const marketStatus = new MarketStatusService(validationService);
      pricingService = new PricingService(marketStatus);
      // Replace repo instance with mock
      (pricingService as any).candleRepo = repo;
    });

    it('routes 60s granularity to getCandles and scales default from date', async () => {
      const spy = jest.spyOn(repo, 'getCandles').mockResolvedValue([
        {
          id: '1',
          symbol: 'EUR/USD',
          granularity_seconds: 60,
          open_time: new Date('2026-10-04T12:00:00Z'),
          close_time: new Date('2026-10-04T12:00:59.999Z'),
          open_price: '1.1245',
          high_price: '1.1250',
          low_price: '1.1240',
          close_price: '1.1248',
          volume: '0',
          source: 'live',
          created_at: new Date('2026-10-04T12:01:00Z'),
        },
      ]);

      const to = new Date('2026-10-04T12:00:00Z');
      const res = await pricingService.getCandles({
        symbol: 'EUR/USD',
        granularity: 60,
        limit: 200,
        to: to.toISOString(),
      });

      expect(spy).toHaveBeenCalledWith(
        'EUR/USD',
        60,
        expect.any(Date),
        to,
        200
      );

      // Check scaled from calculation: 60 * 200 * 1000 * 1.2 = 14400000ms = 4 hours prior
      const passedFrom = spy.mock.calls[0][2];
      expect(to.getTime() - passedFrom.getTime()).toBe(14400000);

      expect(res).toHaveLength(1);
      expect(res[0].open).toBe('1.1245');
      expect(res[0].close).toBe('1.1248');
    });

    it('routes granularity > 60 to getAggregatedCandles', async () => {
      const spy = jest.spyOn(repo, 'getAggregatedCandles').mockResolvedValue([]);

      const to = new Date('2026-10-04T12:00:00Z');
      const res = await pricingService.getCandles({
        symbol: 'EUR/USD',
        granularity: 3600,
        limit: 50,
        to: to.toISOString(),
      });

      expect(spy).toHaveBeenCalledWith(
        'EUR/USD',
        3600,
        expect.any(Date),
        to,
        50
      );
      expect(res).toEqual([]);
    });

    it('enforces limit cap at 1000', async () => {
      const spy = jest.spyOn(repo, 'getCandles').mockResolvedValue([]);

      await pricingService.getCandles({
        symbol: 'EUR/USD',
        granularity: 60,
        limit: 5000,
      });

      expect(spy).toHaveBeenCalledWith(
        'EUR/USD',
        60,
        expect.any(Date),
        expect.any(Date),
        1000
      );
    });
  });
});
