import { SettlementWorker } from '../../../src/modules/trading/workers/settlementWorker.js';
import { TradingService } from '../../../src/modules/trading/services/tradingService.js';
import { PricingService } from '../../../src/modules/pricing/services/pricingService.js';
import { pgPool } from '../../../src/config/database.js';
import { WalletService } from '../../../src/modules/wallet/services/walletService.js';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import { localCache } from '../../../src/infrastructure/cache/memoryCache.js';
import { priceCacheKey } from '../../../src/modules/pricing/utils/symbolNormalizer.js';
import { PriceFeedIngestionService } from '../../../src/modules/pricing/services/PriceFeedIngestionService.js';

// Mock MessageQueueClient to avoid real RabbitMQ dependency during tests
jest.mock('../../../src/infrastructure/message-queue/MessageQueueClient.js', () => ({
  messageQueueClient: {
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('Trade Settlement Integration', () => {
  let settlementWorker: SettlementWorker;
  let tradingService: TradingService;
  let mockPricingService: jest.Mocked<PricingService>;
  let walletService: WalletService;

  const testUserId = uuidv4();
  const testSymbol = 'EUR/USD';

  beforeAll(async () => {
    mockPricingService = {
      getMarketStatus: jest.fn(),
      getLatestPrice: jest.fn(),
    } as any;

    settlementWorker = new SettlementWorker();
    tradingService = new TradingService(mockPricingService);
    walletService = new WalletService();

    // Clean up
    await pgPool.query('DELETE FROM events.event_outbox WHERE aggregate_id IN (SELECT id FROM trading.binary_contracts WHERE user_id = $1)', [testUserId]);
    await pgPool.query('DELETE FROM trading.contract_events WHERE contract_id IN (SELECT id FROM trading.binary_contracts WHERE user_id = $1)', [testUserId]);
    await pgPool.query('DELETE FROM trading.binary_contracts WHERE user_id = $1', [testUserId]);
    await pgPool.query('DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)', [testUserId]);
    await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = $1', [testUserId]);
    await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [testUserId]);

    // Create a test user
    const testReferralCode = uuidv4().split('-')[0].toUpperCase();
    await pgPool.query(
      `INSERT INTO app_auth.users (id, email, password_hash, display_name, referral_code, status, kyc_status)
       VALUES ($1, $2, 'hash', 'Test Settler', $3, 'active', 'verified')`,
      [testUserId, `test-settle-${testUserId}@example.com`, testReferralCode]
    );

    // Create wallet with balance
    await walletService.createWallet(testUserId, 'KES');
    await walletService.credit(testUserId, new Decimal('100000'), 'deposit', undefined, 'Initial balance');

    // Ensure asset config exists
    await pgPool.query(
      `INSERT INTO trading.asset_config (asset_symbol, min_stake, max_stake_per_trade, min_duration_seconds, max_duration_seconds, payout_rate, is_active, max_exposure)
       VALUES ($1, '100', '50000', 60, 3600, '0.60', TRUE, '1000000')
       ON CONFLICT (asset_symbol) DO UPDATE SET is_active = TRUE`,
      [testSymbol]
    );
  });

  afterAll(async () => {
    await pgPool.query('DELETE FROM events.event_outbox WHERE aggregate_id IN (SELECT id FROM trading.binary_contracts WHERE user_id = $1)', [testUserId]);
    await pgPool.query('DELETE FROM trading.contract_events WHERE contract_id IN (SELECT id FROM trading.binary_contracts WHERE user_id = $1)', [testUserId]);
    await pgPool.query('DELETE FROM trading.binary_contracts WHERE user_id = $1', [testUserId]);
    await pgPool.query('DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)', [testUserId]);
    await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = $1', [testUserId]);
    await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [testUserId]);
  });

  beforeEach(() => {
    PriceFeedIngestionService.currentTier = 'tier1_kraken';
    PriceFeedIngestionService.tier3StartedAt = null;
    process.env.MAX_ORACLE_GAP_MS = '10000';
  });

  const placeTestTrade = async (strike: string, contractType: 'higher' | 'lower' = 'higher') => {
    const quote = {
      symbol: testSymbol,
      bid: strike,
      ask: strike,
      mid: strike,
      time: new Date().toISOString(),
    };
    localCache.set(priceCacheKey(testSymbol), quote);
    mockPricingService.getMarketStatus.mockResolvedValue({ is_open: true } as any);
    mockPricingService.getLatestPrice.mockResolvedValue({
      symbol: testSymbol,
      bid: strike,
      ask: strike,
      mid: strike,
      tick_time: quote.time,
    } as any);

    const tradeRequest = {
      assetSymbol: testSymbol,
      contractType,
      stake: '1000',
      expirySeconds: 60
    };

    return await tradingService.placeTrade(testUserId, tradeRequest);
  };

  test('SET-001: should settle a winning contract and credit user', async () => {
    const contract = await placeTestTrade('1.10000');

    await pgPool.query(
      `INSERT INTO pricing.price_ticks (symbol, bid_price, ask_price, mid_price, tick_time)
       VALUES ($1, '1.10500', '1.10500', '1.10500', $2)`,
      [testSymbol, contract.expiryTime]
    );

    await settlementWorker.settle(contract.id!);

    const { rows: contracts } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(contracts[0].status).toBe('won');

    const wallet = await walletService.getBalance(testUserId);
    expect(new Decimal(wallet.available_balance).toNumber()).toBe(100600);

    const { rows: outbox } = await pgPool.query("SELECT * FROM events.event_outbox WHERE aggregate_id = $1 AND event_type = 'TradeSettled'", [contract.id]);
    expect(outbox.length).toBeGreaterThan(0);
    const payload = typeof outbox[0].payload === 'string' ? JSON.parse(outbox[0].payload) : outbox[0].payload;
    expect(payload.outcome).toBe('won');
  });

  test('SET-002: should settle a losing contract and NOT credit user', async () => {
    const contract = await placeTestTrade('1.10000');

    await pgPool.query(
      `INSERT INTO pricing.price_ticks (symbol, bid_price, ask_price, mid_price, tick_time)
       VALUES ($1, '1.09500', '1.09500', '1.09500', $2)`,
      [testSymbol, contract.expiryTime]
    );

    const balanceBefore = new Decimal((await walletService.getBalance(testUserId)).available_balance);
    await settlementWorker.settle(contract.id!);

    const { rows: contracts } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(contracts[0].status).toBe('lost');

    const balanceAfter = new Decimal((await walletService.getBalance(testUserId)).available_balance);
    expect(balanceAfter.toNumber()).toBe(balanceBefore.toNumber());
  });

  test('SET-003: should settle a draw contract and refund stake', async () => {
    const contract = await placeTestTrade('1.10000');

    await pgPool.query(
      `INSERT INTO pricing.price_ticks (symbol, bid_price, ask_price, mid_price, tick_time)
       VALUES ($1, '1.10000', '1.10000', '1.10000', $2)`,
      [testSymbol, contract.expiryTime]
    );

    const balanceBefore = new Decimal((await walletService.getBalance(testUserId)).available_balance);
    await settlementWorker.settle(contract.id!);

    const { rows: contracts } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(contracts[0].status).toBe('draw');

    const balanceAfter = new Decimal((await walletService.getBalance(testUserId)).available_balance);
    expect(balanceAfter.toNumber()).toBe(balanceBefore.plus(1000).toNumber());
  });

  test('SET-004: should settle a winning Lower contract', async () => {
    const contract = await placeTestTrade('1.10000', 'lower');

    await pgPool.query(
      `INSERT INTO pricing.price_ticks (symbol, bid_price, ask_price, mid_price, tick_time)
       VALUES ($1, '1.09500', '1.09500', '1.09500', $2)`,
      [testSymbol, contract.expiryTime]
    );

    await settlementWorker.settle(contract.id!);
    const { rows: contracts } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(contracts[0].status).toBe('won');
  });

  test('SET-005: should settle a losing Lower contract', async () => {
    const contract = await placeTestTrade('1.10000', 'lower');

    await pgPool.query(
      `INSERT INTO pricing.price_ticks (symbol, bid_price, ask_price, mid_price, tick_time)
       VALUES ($1, '1.10500', '1.10500', '1.10500', $2)`,
      [testSymbol, contract.expiryTime]
    );

    await settlementWorker.settle(contract.id!);
    const { rows: contracts } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(contracts[0].status).toBe('lost');
  });

  test('SET-006: should refund if price tick is missing (Oracle Gap)', async () => {
    process.env.MAX_ORACLE_GAP_MS = '1000';
    const contract = await placeTestTrade('1.10000');

    const staleTickTime = new Date(contract.expiryTime.getTime() - 5000);
    await pgPool.query(
      `INSERT INTO pricing.price_ticks (symbol, bid_price, ask_price, mid_price, tick_time)
       VALUES ($1, '1.10500', '1.10500', '1.10500', $2)`,
      [testSymbol, staleTickTime]
    );

    const balanceBefore = new Decimal((await walletService.getBalance(testUserId)).available_balance);
    await settlementWorker.settle(contract.id!);

    const { rows: contracts } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(contracts[0].status).toBe('cancelled');

    const balanceAfter = new Decimal((await walletService.getBalance(testUserId)).available_balance);
    expect(balanceAfter.toNumber()).toBe(balanceBefore.plus(1000).toNumber());
  });

  test('SET-007: simultaneous settlements of same contract (CAS Proof)', async () => {
    const contract = await placeTestTrade('1.10000');

    await pgPool.query(
      `INSERT INTO pricing.price_ticks (symbol, bid_price, ask_price, mid_price, tick_time)
       VALUES ($1, '1.10500', '1.10500', '1.10500', $2)`,
      [testSymbol, contract.expiryTime]
    );

    // Try to settle the same contract 10 times in parallel
    const settlePromises = Array.from({ length: 10 }).map(() => settlementWorker.settle(contract.id!));
    await Promise.all(settlePromises);

    // Verify it is settled exactly once (won status)
    const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(rows[0].status).toBe('won');

    // Verify only one credit entry in ledger
    const { rows: ledger } = await pgPool.query("SELECT * FROM wallet.ledger_entries WHERE reference_id = $1 AND reference_type = 'trade_win'", [contract.id]);
    expect(ledger.length).toBe(1);
  });

  test('SET-008: should handle missing price tick with error (to trigger retry)', async () => {
    const contract = await placeTestTrade('1.10000');

    // Ensure no ticks exist in the database for any symbol
    await pgPool.query('DELETE FROM pricing.price_ticks');

    const tickRepo = (settlementWorker as any).tickRepo;
    const originalGetPriceAt = tickRepo.getPriceAt;
    tickRepo.getPriceAt = jest.fn().mockResolvedValue(null);
    try {
      await expect(settlementWorker.settle(contract.id!)).rejects.toThrow('Price tick not found');

      const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
      expect(rows[0].status).toBe('active');
    } finally {
      tickRepo.getPriceAt = originalGetPriceAt;
    }
  });

  test('SET-009: should revert to active on unexpected error (Crash Simulation)', async () => {
    const contract = await placeTestTrade('1.10000');

    const originalFindById = (settlementWorker as any).contractRepo.findById;
    (settlementWorker as any).contractRepo.findById = jest.fn().mockRejectedValue(new Error('Unexpected Crash'));

    await expect(settlementWorker.settle(contract.id!)).rejects.toThrow('Unexpected Crash');

    const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(rows[0].status).toBe('active');

    (settlementWorker as any).contractRepo.findById = originalFindById;
    await pgPool.query(
      `INSERT INTO pricing.price_ticks (symbol, bid_price, ask_price, mid_price, tick_time)
       VALUES ($1, '1.10500', '1.10500', '1.10500', $2)`,
      [testSymbol, contract.expiryTime]
    );

    await settlementWorker.settle(contract.id!);
    const { rows: rowsAfter } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(rowsAfter[0].status).toBe('won');
  });
});
