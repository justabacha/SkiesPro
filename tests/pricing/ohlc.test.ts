import { OHLCService } from '../../src/modules/pricing/services/OHLCService';

describe('OHLCService', () => {
  let service: OHLCService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      upsert: jest.fn().mockResolvedValue({})
    };
    service = new OHLCService(mockRepo);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T10:00:10Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should aggregate ticks into a 1-minute candle', async () => {
    const symbol = 'EUR/USD';
    const baseTime = new Date('2026-01-01T10:00:05Z');

    await service.processTick(symbol, '1.1000', '100', baseTime);
    await service.processTick(symbol, '1.1100', '200', new Date(baseTime.getTime() + 1000));
    await service.processTick(symbol, '1.0900', '150', new Date(baseTime.getTime() + 2000));
    await service.processTick(symbol, '1.1050', '50', new Date(baseTime.getTime() + 3000));

    // Move "now" to next minute and process a tick to trigger auto-save of previous candle
    jest.setSystemTime(new Date('2026-01-01T10:01:05Z'));
    const nextMinute = new Date('2026-01-01T10:01:05Z');
    await service.processTick(symbol, '1.1200', '100', nextMinute);

    expect(mockRepo.upsert).toHaveBeenCalledWith(expect.objectContaining({
      symbol,
      granularity_seconds: 60,
      open_price: '1.1',
      high_price: '1.11',
      low_price: '1.09',
      close_price: '1.105',
      volume: '500'
    }));
  });

  it('should flush finished candles', async () => {
    const symbol = 'EUR/USD';
    const baseTime = new Date('2026-01-01T10:00:05Z');

    await service.processTick(symbol, '1.1000', '100', baseTime);

    // Manual flush should not save if current time is in the same minute
    await service.flush();
    expect(mockRepo.upsert).not.toHaveBeenCalled();

    // Mock Date.now to next minute for flush
    jest.setSystemTime(new Date('2026-01-01T10:01:00Z'));

    await service.flush();
    expect(mockRepo.upsert).toHaveBeenCalled();
  });
});
