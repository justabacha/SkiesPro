import { cacheClient } from '../../src/infrastructure/cache/index.js';
import { MockPriceAdapter } from '../../src/modules/pricing/adapters/mockPriceAdapter.js';
import { TickRepository } from '../../src/modules/pricing/repositories/tickRepository.js';
import { DemoPriceFeedService } from '../../src/modules/pricing/services/DemoPriceFeedService.js';
import { PriceValidationService } from '../../src/modules/pricing/services/priceValidationService.js';

describe('DemoPriceFeedService', () => {
  const originalRetention = process.env.DEMO_TICK_RETENTION_DAYS;
  let repository: jest.Mocked<TickRepository>;
  let validation: jest.Mocked<PriceValidationService>;
  let service: DemoPriceFeedService;
  let connect: jest.SpyInstance;
  let disconnect: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = {
      saveBatch: jest.fn().mockResolvedValue(undefined),
      pruneExpiredDemoTicks: jest.fn().mockResolvedValue(2),
    } as unknown as jest.Mocked<TickRepository>;
    validation = {
      validate: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<PriceValidationService>;
    service = new DemoPriceFeedService(repository, validation);
    connect = jest.spyOn(MockPriceAdapter.prototype, 'connect').mockImplementation(() => {});
    disconnect = jest.spyOn(MockPriceAdapter.prototype, 'disconnect').mockImplementation(() => {});
    jest.spyOn(cacheClient, 'get').mockResolvedValue(null);
    jest.spyOn(cacheClient, 'set').mockResolvedValue(undefined);
    jest.spyOn(cacheClient, 'publish').mockResolvedValue(undefined);
    process.env.DEMO_TICK_RETENTION_DAYS = '30';
  });

  afterEach(async () => {
    await service.stop();
    jest.restoreAllMocks();
    if (originalRetention === undefined) {
      delete process.env.DEMO_TICK_RETENTION_DAYS;
    } else {
      process.env.DEMO_TICK_RETENTION_DAYS = originalRetention;
    }
  });

  it('returns only the normalized cached demo quote', async () => {
    (cacheClient.get as jest.Mock).mockResolvedValueOnce({
      symbol: 'EUR/USD',
      bid: '1.10000',
      ask: '1.10010',
      mid: '1.10005',
      time: new Date().toISOString(),
    });
    expect(await service.getQuote('eurusd')).toMatchObject({ symbol: 'EUR/USD' });
    (cacheClient.get as jest.Mock).mockResolvedValueOnce(null);
    expect(await service.getQuote('EUR/USD')).toBeNull();
  });

  it('publishes validated demo ticks to demo-only cache channels and persists them', async () => {
    await (
      service as unknown as {
        handleTick: (symbol: string, bid: string, ask: string, time: Date) => Promise<void>;
      }
    ).handleTick('EUR/USD', '1.10000', '1.10010', new Date());

    expect(cacheClient.set).toHaveBeenCalledWith(
      'pricing',
      'demo:price:EURUSD',
      expect.objectContaining({ source: 'demo' }),
      10
    );
    expect(cacheClient.publish).toHaveBeenCalledWith(
      'pricing',
      'demo:ticks:EURUSD',
      expect.stringContaining('"source":"demo"')
    );
    expect(cacheClient.publish).toHaveBeenCalledWith(
      'pricing',
      'demo:ticks:all',
      expect.stringContaining('"source":"demo"')
    );

    await (service as unknown as { flushTicks: () => Promise<void> }).flushTicks();
    expect(repository.saveBatch).toHaveBeenCalledWith([
      expect.objectContaining({ source: 'demo', symbol: 'EUR/USD' }),
    ]);
  });

  it('discards ticks rejected by price validation', async () => {
    validation.validate.mockReturnValue(false);
    await (
      service as unknown as {
        handleTick: (symbol: string, bid: string, ask: string, time: Date) => Promise<void>;
      }
    ).handleTick('EUR/USD', '1.10000', '1.10010', new Date());

    expect(cacheClient.publish).not.toHaveBeenCalled();
    expect(repository.saveBatch).not.toHaveBeenCalled();
  });

  it('requeues ticks after a persistence failure and retries them', async () => {
    repository.saveBatch.mockRejectedValueOnce(new Error('temporary database failure'));
    await (
      service as unknown as {
        handleTick: (symbol: string, bid: string, ask: string, time: Date) => Promise<void>;
      }
    ).handleTick('EUR/USD', '1.10000', '1.10010', new Date());

    const flush = (service as unknown as { flushTicks: () => Promise<void> }).flushTicks;
    await flush.call(service);
    await flush.call(service);

    expect(repository.saveBatch).toHaveBeenCalledTimes(2);
  });

  it('runs immediate and scheduled retention cleanup with the configured 30-day window', async () => {
    service.start();
    service.start();
    await new Promise((resolve) => setImmediate(resolve));

    expect(connect).toHaveBeenCalledTimes(1);
    expect(repository.pruneExpiredDemoTicks).toHaveBeenCalledWith(30);

    await service.stop();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
