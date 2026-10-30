import { TradingService } from '../../../src/modules/trading/services/tradingService.js';
import { PricingService } from '../../../src/modules/pricing/services/pricingService.js';
import { WalletService } from '../../../src/modules/wallet/services/walletService.js';
import { AssetRepository } from '../../../src/modules/trading/repositories/assetRepository.js';
import { AssetConfigRepository } from '../../../src/modules/trading/repositories/assetConfigRepository.js';
import { ContractRepository } from '../../../src/modules/trading/repositories/contractRepository.js';
import { UserRepository } from '../../../src/modules/auth/repositories/userRepository.js';
import { PriceFeedIngestionService } from '../../../src/modules/pricing/services/PriceFeedIngestionService.js';
import { localCache } from '../../../src/infrastructure/cache/memoryCache.js';
import { SettingsService } from '../../../src/shared/services/settingsService.js';
import { pgPool } from '../../../src/config/database.js';
import { messageQueueClient } from '../../../src/infrastructure/message-queue/MessageQueueClient.js';
import type { PoolClient } from 'pg';

class TestSettingsService extends SettingsService {
  overrides: Record<string, unknown> = {};

  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    return (key in this.overrides ? this.overrides[key] : defaultValue) as T;
  }
}

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
  let settingsService: TestSettingsService;

  beforeEach(() => {
    localCache.flush();
    PriceFeedIngestionService.currentTier = 'tier1_kraken';
    mockPricingService = {
      getMarketStatus: jest.fn(),
      getLatestPrice: jest.fn()
    } as any;
    settingsService = new TestSettingsService();
    tradingService = new TradingService(mockPricingService, settingsService);
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

  test('should reject a client strike exceeding max percentage slippage from server mid', async () => {
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
      strikePrice: 1.115, // 1.36% difference, exceeds 0.5% max slippage
    })).rejects.toThrow('PRICE_SLIPPAGE_EXCEEDED');
  });

  test('uses the platform payout ratio only when the asset payout rate is missing', async () => {
    const { UserRepository } = require('../../../src/modules/auth/repositories/userRepository');
    const { AssetConfigRepository } = require('../../../src/modules/trading/repositories/assetConfigRepository');
    const { WalletService } = require('../../../src/modules/wallet/services/walletService');
    const { ContractRepository } = require('../../../src/modules/trading/repositories/contractRepository');
    (UserRepository.prototype.findById as jest.Mock).mockResolvedValue({
      status: 'active',
      kyc_status: 'verified',
      self_excluded_until: null,
    });
    mockPricingService.getMarketStatus.mockResolvedValue({ is_open: true } as any);
    (AssetConfigRepository.prototype.findBySymbol as jest.Mock).mockResolvedValue({
      minStake: '100',
      maxStake: '50000',
      minDurationSeconds: 60,
      maxDurationSeconds: 3600,
      payoutRate: null,
      maxExposure: '100000',
    });
    (WalletService.prototype.getBalance as jest.Mock).mockResolvedValue({
      available_balance: '1000',
    });
    (WalletService.prototype.debit as jest.Mock).mockResolvedValue({});
    (ContractRepository.prototype.getActiveExposure as jest.Mock).mockResolvedValue('0');
    (ContractRepository.prototype.create as jest.Mock).mockImplementation(async (contract: unknown) => ({
      ...(contract as object),
      id: 'contract-test',
    }));
    settingsService.overrides['trade.default_payout_ratio'] = 0.75;
    localCache.set('price:EURUSD', {
      bid: '1.10000',
      ask: '1.10002',
      mid: '1.10001',
      time: new Date().toISOString(),
    });

    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    const connect = jest
      .spyOn(pgPool, 'connect')
      .mockImplementation(async () => client as unknown as PoolClient);
    const publish = jest.spyOn(messageQueueClient, 'publish').mockResolvedValue();
    try {
      const contract = await tradingService.placeTrade('user1', {
        assetSymbol: 'EUR/USD',
        contractType: 'higher',
        stake: '100',
        expirySeconds: 60,
      });

      expect(settingsService.overrides['trade.default_payout_ratio']).toBe(0.75);
      expect(contract.payoutRate).toBe('0.75');
      expect(contract.potentialPayout).toBe('175');
    } finally {
      connect.mockRestore();
      publish.mockRestore();
    }
  });

  test('allows a BTC/USD trade with a 0.1% price difference without throwing PRICE_SLIPPAGE_EXCEEDED', async () => {
    (UserRepository.prototype.findById as jest.Mock).mockResolvedValue({
      status: 'active',
      kyc_status: 'verified',
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
      available_balance: '10000',
    });
    (WalletService.prototype.debit as jest.Mock).mockResolvedValue({});
    (ContractRepository.prototype.getActiveExposure as jest.Mock).mockResolvedValue('0');
    (ContractRepository.prototype.create as jest.Mock).mockImplementation(async (contract: unknown) => ({
      ...(contract as object),
      id: 'btc-contract-test',
    }));
    localCache.set('price:BTCUSD', {
      bid: '89995',
      ask: '90005',
      mid: '90000',
      time: new Date().toISOString(),
    });

    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    const connect = jest
      .spyOn(pgPool, 'connect')
      .mockImplementation(async () => client as unknown as PoolClient);
    const publish = jest.spyOn(messageQueueClient, 'publish').mockResolvedValue();

    try {
      // 0.1% of $90,000 is $90. Client strike $90,090 is a 0.1% difference, well within 0.5% max limit.
      const contract = await tradingService.placeTrade('user1', {
        assetSymbol: 'BTC/USD',
        contractType: 'higher',
        stake: '100',
        expirySeconds: 60,
        strikePrice: 90090,
      });

      expect(contract).toBeDefined();
      expect(contract.id).toBe('btc-contract-test');
    } finally {
      connect.mockRestore();
      publish.mockRestore();
    }
  });
});
