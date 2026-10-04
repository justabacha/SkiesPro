import { pgPool } from '../../src/config/database.js';
import { createHash } from 'node:crypto';
import { normalizeSymbol } from '../../src/modules/pricing/utils/symbolNormalizer.js';
import { UserRepository } from '../../src/modules/auth/repositories/userRepository.js';
import { AssetConfigRepository } from '../../src/modules/trading/repositories/assetConfigRepository.js';
import { AssetRepository } from '../../src/modules/trading/repositories/assetRepository.js';
import { ContractRepository } from '../../src/modules/trading/repositories/contractRepository.js';
import { DemoTradingService } from '../../src/modules/trading/services/demoTradingService.js';
import type { DemoPriceFeedService } from '../../src/modules/pricing/services/DemoPriceFeedService.js';

jest.mock('../../src/config/database.js', () => ({
  pgPool: { query: jest.fn(), connect: jest.fn() },
}));
jest.mock('../../src/modules/auth/repositories/userRepository.js');
jest.mock('../../src/modules/trading/repositories/assetConfigRepository.js');
jest.mock('../../src/modules/trading/repositories/assetRepository.js');
jest.mock('../../src/modules/trading/repositories/contractRepository.js');
jest.mock('../../src/modules/wallet/services/walletService.js');
jest.mock('../../src/modules/auth/repositories/outboxRepository.js');
jest.mock('../../src/infrastructure/message-queue/MessageQueueClient.js');

describe('DemoTradingService validation and mode scoping', () => {
  const validRequest = {
    assetSymbol: 'EUR/USD',
    contractType: 'higher' as const,
    stake: '100',
    expirySeconds: 60,
  };
  const config = {
    minStake: '100',
    maxStake: '50000',
    minDurationSeconds: 60,
    maxDurationSeconds: 3600,
    payoutRate: '0.60',
    maxExposure: '100000',
  };
  const demoWallet = {
    getBalance: jest.fn().mockResolvedValue({ available_balance: '1000' }),
  };
  const feed = {
    getQuote: jest.fn().mockResolvedValue({
      symbol: 'EUR/USD',
      bid: '1.10000',
      ask: '1.10010',
      mid: '1.10005',
      time: new Date().toISOString(),
    }),
  };

  const makeService = () =>
    new DemoTradingService(feed as Pick<DemoPriceFeedService, 'getQuote'>, demoWallet as never);

  beforeEach(() => {
    jest.clearAllMocks();
    (pgPool.query as jest.Mock).mockResolvedValue({ rows: [] });
    (UserRepository.prototype.findById as jest.Mock).mockResolvedValue({ status: 'active' });
    (AssetConfigRepository.prototype.findBySymbol as jest.Mock).mockResolvedValue(config);
    (ContractRepository.prototype.getActiveExposure as jest.Mock).mockResolvedValue('0');
    demoWallet.getBalance.mockResolvedValue({ available_balance: '1000' });
    feed.getQuote.mockResolvedValue({
      symbol: 'EUR/USD',
      bid: '1.10000',
      ask: '1.10010',
      mid: '1.10005',
      time: new Date().toISOString(),
    });
  });

  it('requires a bounded idempotency key', async () => {
    await expect(makeService().placeDemoTrade('user-1', validRequest, '')).rejects.toThrow(
      'Idempotency-Key'
    );
    await expect(
      makeService().placeDemoTrade('user-1', validRequest, 'x'.repeat(256))
    ).rejects.toThrow('Idempotency-Key');
  });

  it('rejects mismatched idempotency replays and returns matching replays', async () => {
    (pgPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ request_hash: 'different-request', response_payload: {} }],
    });
    await expect(makeService().placeDemoTrade('user-1', validRequest, 'key-1')).rejects.toThrow(
      'already used with a different request'
    );

    const replay = {
      id: 'contract-1',
      purchaseTime: '2026-10-04T10:00:00.000Z',
      expiryTime: '2026-10-04T10:01:00.000Z',
    };
    const service = makeService();
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          assetSymbol: normalizeSymbol(validRequest.assetSymbol),
          contractType: validRequest.contractType,
          stake: validRequest.stake,
          expirySeconds: validRequest.expirySeconds,
          strikePrice: null,
        })
      )
      .digest('hex');
    (pgPool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ request_hash: requestHash, response_payload: replay }],
    });

    const result = await service.placeDemoTrade('user-1', validRequest, 'key-2');
    expect(result.purchaseTime).toEqual(new Date(replay.purchaseTime));
    expect(result.expiryTime).toEqual(new Date(replay.expiryTime));
    expect(UserRepository.prototype.findById).not.toHaveBeenCalled();
  });

  it('rejects inactive users and missing asset configuration', async () => {
    (UserRepository.prototype.findById as jest.Mock).mockResolvedValueOnce({
      status: 'suspended',
    });
    await expect(makeService().placeDemoTrade('user-1', validRequest, 'key-1')).rejects.toThrow(
      'not active'
    );

    (AssetConfigRepository.prototype.findBySymbol as jest.Mock).mockResolvedValueOnce(null);
    await expect(makeService().placeDemoTrade('user-1', validRequest, 'key-2')).rejects.toThrow(
      'No configuration'
    );
  });

  it('rejects invalid stake, duration, and insufficient demo funds', async () => {
    await expect(
      makeService().placeDemoTrade('user-1', { ...validRequest, stake: '99' }, 'key-1')
    ).rejects.toThrow();
    await expect(
      makeService().placeDemoTrade('user-1', { ...validRequest, expirySeconds: 30 }, 'key-2')
    ).rejects.toThrow();

    demoWallet.getBalance.mockResolvedValueOnce({ available_balance: '99' });
    await expect(makeService().placeDemoTrade('user-1', validRequest, 'key-3')).rejects.toThrow(
      'Insufficient available balance'
    );
  });

  it('rejects exposure beyond the configured maximum', async () => {
    (AssetConfigRepository.prototype.findBySymbol as jest.Mock).mockResolvedValueOnce({
      ...config,
      maxExposure: '150',
    });
    (ContractRepository.prototype.getActiveExposure as jest.Mock).mockResolvedValueOnce('100');
    await expect(makeService().placeDemoTrade('user-1', validRequest, 'key-1')).rejects.toThrow(
      'Maximum demo exposure'
    );
  });

  it('rejects missing, stale, or invalid demo quotes', async () => {
    feed.getQuote.mockResolvedValueOnce(null);
    await expect(makeService().placeDemoTrade('user-1', validRequest, 'key-1')).rejects.toThrow(
      'DEMO_MARKET_DATA_UNAVAILABLE'
    );

    feed.getQuote.mockResolvedValueOnce({
      symbol: 'EUR/USD',
      bid: '1.10000',
      ask: '1.10010',
      mid: '1.10005',
      time: new Date(Date.now() - 20_000).toISOString(),
    });
    await expect(makeService().placeDemoTrade('user-1', validRequest, 'key-2')).rejects.toThrow(
      'DEMO_MARKET_DATA_UNAVAILABLE'
    );

    feed.getQuote.mockResolvedValueOnce({
      symbol: 'EUR/USD',
      bid: '-1',
      ask: '1.10010',
      mid: '1.10005',
      time: new Date().toISOString(),
    });
    await expect(makeService().placeDemoTrade('user-1', validRequest, 'key-3')).rejects.toThrow(
      'DEMO_MARKET_DATA_UNAVAILABLE'
    );
  });

  it('rejects invalid client strikes and excessive slippage', async () => {
    await expect(
      makeService().placeDemoTrade('user-1', { ...validRequest, strikePrice: Number.NaN }, 'key-1')
    ).rejects.toThrow('INVALID_STRIKE_PRICE');

    (AssetRepository.prototype.findBySymbol as jest.Mock).mockResolvedValueOnce({
      pipDecimalPlaces: 5,
    });
    await expect(
      makeService().placeDemoTrade('user-1', { ...validRequest, strikePrice: 1.101 }, 'key-2')
    ).rejects.toThrow('PRICE_SLIPPAGE_EXCEEDED');
  });

  it('scopes demo history and active-contract queries to demo mode', async () => {
    const service = makeService();
    await service.getTradeHistory('user-1', { limit: 10 });
    await service.getActiveTrades('user-1');

    expect(ContractRepository.prototype.listByUser).toHaveBeenCalledWith('user-1', 'demo', {
      limit: 10,
    });
    expect(ContractRepository.prototype.getActiveByUser).toHaveBeenCalledWith('user-1', 'demo');
  });
});
