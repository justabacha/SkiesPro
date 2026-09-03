import { PayoutService } from '../../../src/modules/trading/services/payoutService.js';
import { BinaryContract } from '../../../src/modules/trading/repositories/contractRepository.js';
import { Decimal } from 'decimal.js';

describe('PayoutService (SET-UNIT-001 to 003)', () => {
  let payoutService: PayoutService;

  beforeEach(() => {
    payoutService = new PayoutService();
  });

  const baseContract: BinaryContract = {
    id: 'contract-123',
    userId: 'user-123',
    assetSymbol: 'EUR/USD',
    contractType: 'higher',
    stake: '1000',
    payoutRate: '0.60',
    potentialPayout: '1600',
    status: 'active',
    strikePrice: '1.10000',
    purchaseTime: new Date(),
    expiryTime: new Date()
  };

  test('SET-UNIT-001: should return won outcome when price is higher for higher contract', () => {
    const settlementPrice = new Decimal('1.10001'); // Just above tolerance
    const result = payoutService.calculatePayout(baseContract, settlementPrice);

    expect(result.outcome).toBe('won');
    expect(result.payoutAmount.toString()).toBe('1600');
    expect(result.description).toContain('Trade won');
  });

  test('SET-UNIT-002: should return lost outcome when price is lower for higher contract', () => {
    const settlementPrice = new Decimal('1.09999'); // Just below tolerance
    const result = payoutService.calculatePayout(baseContract, settlementPrice);

    expect(result.outcome).toBe('lost');
    expect(result.payoutAmount.toString()).toBe('0');
    expect(result.description).toContain('Trade lost');
  });

  test('SET-UNIT-003: should return draw outcome when price is within tolerance', () => {
    const settlementPrice = new Decimal('1.100005'); // Within 0.00001 tolerance
    const result = payoutService.calculatePayout(baseContract, settlementPrice);

    expect(result.outcome).toBe('draw');
    expect(result.payoutAmount.toString()).toBe('1000'); // Refund stake
    expect(result.description).toContain('Trade draw');
  });

  test('should return won outcome when price is lower for lower contract', () => {
    const lowerContract = { ...baseContract, contractType: 'lower' as const };
    const settlementPrice = new Decimal('1.09999');
    const result = payoutService.calculatePayout(lowerContract, settlementPrice);

    expect(result.outcome).toBe('won');
    expect(result.payoutAmount.toString()).toBe('1600');
  });

  test('should return lost outcome when price is higher for lower contract', () => {
    const lowerContract = { ...baseContract, contractType: 'lower' as const };
    const settlementPrice = new Decimal('1.10001');
    const result = payoutService.calculatePayout(lowerContract, settlementPrice);

    expect(result.outcome).toBe('lost');
    expect(result.payoutAmount.toString()).toBe('0');
  });

  test('getCancelResult: should return cancelled outcome with stake refund', () => {
    const result = payoutService.getCancelResult(baseContract, 'Oracle Gap');

    expect(result.outcome).toBe('cancelled');
    expect(result.payoutAmount.toString()).toBe('1000');
    expect(result.description).toContain('Trade cancelled');
  });
});
