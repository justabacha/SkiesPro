import { PriceValidationService } from '../../src/modules/pricing/services/priceValidationService.js';

describe('PriceValidationService', () => {
  let service: PriceValidationService;

  beforeEach(() => {
    process.env.PRICE_VALIDATION_THRESHOLD_PCT = '0.05';
    process.env.STALE_PRICE_THRESHOLD_SEC = '30';
    service = new PriceValidationService();
  });

  it('should validate first tick successfully', () => {
    const isValid = service.validate('EUR/USD', '1.1000', new Date());
    expect(isValid).toBe(true);
  });

  it('should validate tick within 5% successfully', () => {
    service.validate('EUR/USD', '1.1000', new Date());
    const isValid = service.validate('EUR/USD', '1.1200', new Date()); // ~1.8% change
    expect(isValid).toBe(true);
  });

  it('should reject tick with > 5% deviation', () => {
    service.validate('EUR/USD', '1.1000', new Date());
    const isValid = service.validate('EUR/USD', '1.2000', new Date()); // ~9% change
    expect(isValid).toBe(false);
  });

  it('should reject stale (older) tick', () => {
    const now = new Date();
    service.validate('EUR/USD', '1.1000', now);
    const isValid = service.validate('EUR/USD', '1.1005', new Date(now.getTime() - 1000));
    expect(isValid).toBe(false);
  });

  it('should detect stale price based on threshold', () => {
    const oldTime = new Date(Date.now() - 40000); // 40s ago
    service.validate('EUR/USD', '1.1000', oldTime);
    expect(service.isStale('EUR/USD')).toBe(true);
  });

  it('should not mark fresh price as stale', () => {
    service.validate('EUR/USD', '1.1000', new Date());
    expect(service.isStale('EUR/USD')).toBe(false);
  });
});
