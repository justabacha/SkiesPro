import { TradingService } from '../../../src/modules/trading/services/tradingService.js';
import { PricingService } from '../../../src/modules/pricing/services/pricingService.js';

// Mock dependencies
jest.mock('../../../src/modules/auth/repositories/userRepository');
jest.mock('../../../src/modules/wallet/services/walletService');
jest.mock('../../../src/modules/pricing/services/pricingService');
jest.mock('../../../src/modules/pricing/services/MarketStatusService');
jest.mock('../../../src/modules/trading/repositories/contractRepository');
jest.mock('../../../src/modules/trading/repositories/assetConfigRepository');
jest.mock('../../../src/infrastructure/message-queue/MessageQueueClient');

describe('TradingService', () => {
  let tradingService: TradingService;
  let mockPricingService: jest.Mocked<PricingService>;

  beforeEach(() => {
    mockPricingService = {
      getMarketStatus: jest.fn(),
      getLatestPrice: jest.fn()
    } as any;
    tradingService = new TradingService(mockPricingService);
  });

  test('should fail if user is not active', async () => {
    const { UserRepository } = require('../../../src/modules/auth/repositories/userRepository');
    UserRepository.prototype.findById.mockResolvedValue({ status: 'suspended' });

    await expect(tradingService.placeTrade('user1', {
      assetSymbol: 'EUR/USD',
      contractType: 'higher',
      stake: '100',
      expirySeconds: 60
    })).rejects.toThrow('suspended');
  });

  test('should fail if market is closed', async () => {
    const { UserRepository } = require('../../../src/modules/auth/repositories/userRepository');
    UserRepository.prototype.findById.mockResolvedValue({ status: 'active', self_excluded_until: null });

    mockPricingService.getMarketStatus.mockResolvedValue({ is_open: false } as any);

    await expect(tradingService.placeTrade('user1', {
      assetSymbol: 'EUR/USD',
      contractType: 'higher',
      stake: '100',
      expirySeconds: 60
    })).rejects.toThrow('closed');
  });
});
