import { PriceFeedIngestionService } from '../../src/modules/pricing/services/PriceFeedIngestionService.js';
import { PriceValidationService } from '../../src/modules/pricing/services/priceValidationService.js';
import { TickRepository } from '../../src/modules/pricing/repositories/tickRepository.js';
import { PriceDistributionService } from '../../src/modules/pricing/services/priceDistributionService.js';
import { OHLCService } from '../../src/modules/pricing/services/OHLCService.js';

describe('PriceFeedIngestionService Buffer Resilience', () => {
  let service: PriceFeedIngestionService;
  let validationService: jest.Mocked<PriceValidationService>;
  let tickRepo: jest.Mocked<TickRepository>;
  let distributionService: jest.Mocked<PriceDistributionService>;
  let ohlcService: jest.Mocked<OHLCService>;

  beforeEach(() => {
    validationService = {
      validate: jest.fn().mockReturnValue(true),
    } as any;
    tickRepo = {
      saveBatch: jest.fn(),
    } as any;
    distributionService = {
      distributeTick: jest.fn().mockResolvedValue(undefined),
    } as any;
    ohlcService = {
      processTick: jest.fn().mockResolvedValue(undefined),
      flush: jest.fn().mockResolvedValue(undefined),
    } as any;

    service = new PriceFeedIngestionService(
      validationService,
      tickRepo,
      distributionService,
      ohlcService,
      true // useMockFallback
    );
  });

  afterEach(() => {
    service.stop();
  });

  test('retains ticks in buffer when tickRepo.saveBatch throws a DB error', async () => {
    // Simulate DB saveBatch failure
    tickRepo.saveBatch.mockRejectedValue(new Error('DB Connection Failed'));

    // Inject ticks into the internal buffer
    const tickTime = new Date();
    for (let i = 0; i < 10; i++) {
      await (service as any).handleTick('EUR/USD', '1.1000', '1.1002', tickTime);
    }

    // Flush should fail but keep buffer intact
    await (service as any).flushTicks();

    expect(tickRepo.saveBatch).toHaveBeenCalled();
    expect((service as any).tickBuffer.length).toBeGreaterThan(0);

    // On second flush when DB recovers, saveBatch succeeds and clears buffer
    tickRepo.saveBatch.mockResolvedValue(undefined);
    await (service as any).flushTicks();

    expect((service as any).tickBuffer.length).toBe(0);
  });
});
