import { TradingService } from '../../../src/modules/trading/services/tradingService.js';
import { PricingService } from '../../../src/modules/pricing/services/pricingService.js';
import { WalletService } from '../../../src/modules/wallet/services/walletService.js';
import { AssetRepository } from '../../../src/modules/trading/repositories/assetRepository.js';
import { AssetConfigRepository } from '../../../src/modules/trading/repositories/assetConfigRepository.js';
import { ContractRepository } from '../../../src/modules/trading/repositories/contractRepository.js';
import { UserRepository } from '../../../src/modules/auth/repositories/userRepository.js';
import { PriceFeedIngestionService } from '../../../src/modules/pricing/services/PriceFeedIngestionService.js';
import { localCache } from '../../../src/infrastructure/cache/memoryCache.js';

// Mock dependencies
jest.mock('../../../src/modules/auth/repositories/userRepository');
jest.mock('../../../src/modules/wallet/services/walletService');
jest.mock('../../../src/modules/pricing/services/pricingService');
jest.mock('../../../src/modules/pricing/services/MarketStatusService');
jest.mock('../../../src/modules/trading/repositories/contractRepository');
jest.mock('../../../src/modules/trading/repositories/assetConfigRepository');
jest.mock('../../../src/modules/trading/repositories/assetRepository');
jest.mock('../../../src/infrastructure/message-queue/MessageQueueClient');

describe('TradingService', () => {
  let tradingService: TradingService;
  let mockPricingService: jest.Mocked<PricingService>;

  beforeEach(() => {
    localCache.flush();
    PriceFeedIngestionService.currentTier = 'tier1_kraken';
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

  test('should reject trade placement when the local live tick is unavailable', async () => {
    (UserRepository.prototype.findById as jest.Mock).mockResolvedValue({
      status: 'active',
      self_excluded_until: null,
    });
    mockPricingService.getMarketStatus.mockResolvedValue({ is_open: true } as any);
    (AssetConfigRepository.prototype.findBySymbol as jest.Mock).mockResolvedValue({
      minStake: '100',
      maxStake: '50000',
      minDurationSeconds: 60,
      maxDurationSeconds: 3600,
      payoutRate: '0.6',
      maxExposure: '100000',
    });
    (WalletService.prototype.getBalance as jest.Mock).mockResolvedValue({
      available_balance: '1000',
    });
    (ContractRepository.prototype.getActiveExposure as jest.Mock).mockResolvedValue('0');

    await expect(tradingService.placeTrade('user1', {
      assetSymbol: 'eurusd',
      contractType: 'higher',
      stake: '100',
      expirySeconds: 60,
      strikePrice: 1.1,
    })).rejects.toThrow('MARKET_DATA_UNAVAILABLE');
  });

  test('should reject a client strike more than five symbol pips from server mid', async () => {
    (UserRepository.prototype.findById as jest.Mock).mockResolvedValue({
      status: 'active',
      self_excluded_until: null,
    });
    mockPricingService.getMarketStatus.mockResolvedValue({ is_open: true } as any);
    (AssetConfigRepository.prototype.findBySymbol as jest.Mock).mockResolvedValue({
      minStake: '100',
      maxStake: '50000',
      minDurationSeconds: 60,
      maxDurationSeconds: 3600,
      payoutRate: '0.6',
      maxExposure: '100000',
    });
    (WalletService.prototype.getBalance as jest.Mock).mockResolvedValue({
      available_balance: '1000',
    });
    (ContractRepository.prototype.getActiveExposure as jest.Mock).mockResolvedValue('0');
    (AssetRepository.prototype.findBySymbol as jest.Mock).mockResolvedValue({
      pipDecimalPlaces: 5,
    });
    localCache.set('price:EURUSD', {
      bid: '1.10000',
      ask: '1.10002',
      mid: '1.10001',
      time: new Date().toISOString(),
    });

    await expect(tradingService.placeTrade('user1', {
      assetSymbol: 'EUR/USD',
      contractType: 'higher',
      stake: '100',
      expirySeconds: 60,
      strikePrice: 1.101,
    })).rejects.toThrow('PRICE_SLIPPAGE_EXCEEDED');
  });
});
