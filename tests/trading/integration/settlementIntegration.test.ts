import { SettlementWorker } from '../../../src/modules/trading/workers/settlementWorker.js';
import { TradingService } from '../../../src/modules/trading/services/tradingService.js';
import { PricingService } from '../../../src/modules/pricing/services/pricingService.js';
import { pgPool } from '../../../src/config/database.js';
import { WalletService } from '../../../src/modules/wallet/services/walletService.js';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

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
    await pgPool.query('DELETE FROM trading.binary_contracts WHERE user_id = $1', [testUserId]);
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
    await walletService.credit(testUserId, new Decimal('10000'), 'deposit', undefined, 'Initial balance');

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

  const placeTestTrade = async (strike: string) => {
    mockPricingService.getMarketStatus.mockResolvedValue({ is_open: true } as any);
    mockPricingService.getLatestPrice.mockResolvedValue({
      symbol: testSymbol,
      bid: strike,
      ask: strike,
      mid: strike,
      tick_time: new Date().toISOString()
    } as any);

    const tradeRequest = {
      assetSymbol: testSymbol,
      contractType: 'higher' as const,
      stake: '1000',
      expirySeconds: 60
    };

    return await tradingService.placeTrade(testUserId, tradeRequest);
  };

  test('SET-001: should settle a winning contract and credit user', async () => {
    const contract = await placeTestTrade('1.10000');

    // Seed the settlement price in price_ticks
    const expiryTickTime = contract.expiryTime;
    await pgPool.query(
      `INSERT INTO pricing.price_ticks (symbol, bid_price, ask_price, mid_price, tick_time)
       VALUES ($1, '1.10500', '1.10500', '1.10500', $2)`,
      [testSymbol, expiryTickTime]
    );

    await settlementWorker.settle(contract.id!);

    // Verify status
    const { rows: contracts } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(contracts[0].status).toBe('won');

    // Verify balance: 10000 - 1000 (stake) + 1600 (payout) = 10600
    const wallet = await walletService.getBalance(testUserId);
    expect(new Decimal(wallet.available_balance).toNumber()).toBe(10600);

    // Verify outbox event
    const { rows: outbox } = await pgPool.query("SELECT * FROM events.event_outbox WHERE aggregate_id = $1 AND event_type = 'TradeSettled'", [contract.id]);
    expect(outbox.length).toBeGreaterThan(0);

    const payload = typeof outbox[0].payload === 'string' ? JSON.parse(outbox[0].payload) : outbox[0].payload;
    expect(payload.outcome).toBe('won');
  });

  test('SET-002: should settle a losing contract and NOT credit user', async () => {
    const contract = await placeTestTrade('1.10000');

    // Seed the settlement price (lower than strike)
    const expiryTickTime = contract.expiryTime;
    await pgPool.query(
      `INSERT INTO pricing.price_ticks (symbol, bid_price, ask_price, mid_price, tick_time)
       VALUES ($1, '1.09500', '1.09500', '1.09500', $2)`,
      [testSymbol, expiryTickTime]
    );

    // Get balance before settlement
    const balanceBefore = new Decimal((await walletService.getBalance(testUserId)).available_balance);

    await settlementWorker.settle(contract.id!);

    // Verify status
    const { rows: contracts } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(contracts[0].status).toBe('lost');

    // Verify balance: should not change from balanceBefore
    const balanceAfter = new Decimal((await walletService.getBalance(testUserId)).available_balance);
    expect(balanceAfter.toNumber()).toBe(balanceBefore.toNumber());
  });

  test('SET-003: should settle a draw contract and refund stake', async () => {
    const contract = await placeTestTrade('1.10000');

    // Seed the settlement price (exactly strike)
    const expiryTickTime = contract.expiryTime;
    await pgPool.query(
      `INSERT INTO pricing.price_ticks (symbol, bid_price, ask_price, mid_price, tick_time)
       VALUES ($1, '1.10000', '1.10000', '1.10000', $2)`,
      [testSymbol, expiryTickTime]
    );

    const balanceBefore = new Decimal((await walletService.getBalance(testUserId)).available_balance);

    await settlementWorker.settle(contract.id!);

    // Verify status
    const { rows: contracts } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(contracts[0].status).toBe('draw');

    // Verify balance: balanceBefore + 1000 (refund)
    const balanceAfter = new Decimal((await walletService.getBalance(testUserId)).available_balance);
    expect(balanceAfter.toNumber()).toBe(balanceBefore.plus(1000).toNumber());
    test('SET-004: should settle a winning Lower contract', async () => {
    mockPricingService.getMarketStatus.mockResolvedValue({ is_open: true } as any);
    mockPricingService.getLatestPrice.mockResolvedValue({
      symbol: testSymbol,
      bid: '1.10000',
      ask: '1.10000',
      mid: '1.10000',
      tick_time: new Date().toISOString()
    } as any);

    const contract = await tradingService.placeTrade(testUserId, {
      assetSymbol: testSymbol,
      contractType: 'lower',
      stake: '1000',
      expirySeconds: 60
    });

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
    mockPricingService.getMarketStatus.mockResolvedValue({ is_open: true } as any);
    mockPricingService.getLatestPrice.mockResolvedValue({
      symbol: testSymbol,
      bid: '1.10000',
      ask: '1.10000',
      mid: '1.10000',
      tick_time: new Date().toISOString()
    } as any);

    const contract = await tradingService.placeTrade(testUserId, {
      assetSymbol: testSymbol,
      contractType: 'lower',
      stake: '1000',
      expirySeconds: 60
    });

    await pgPool.query(
      `INSERT INTO pricing.price_ticks (symbol, bid_price, ask_price, mid_price, tick_time)
       VALUES ($1, '1.10500', '1.10500', '1.10500', $2)`,
      [testSymbol, contract.expiryTime]
    );

    await settlementWorker.settle(contract.id!);
    const { rows: contracts } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(contracts[0].status).toBe('lost');
  });

  test('SET-007: 10 simultaneous settlements (Concurrency)', async () => {
    // We'll create 10 contracts and try to settle them multiple times in parallel
    const contractPromises = Array.from({ length: 10 }).map(() => placeTestTrade('1.10000'));
    const contracts = await Promise.all(contractPromises);

    for (const contract of contracts) {
      await pgPool.query(
        `INSERT INTO pricing.price_ticks (symbol, bid_price, ask_price, mid_price, tick_time)
         VALUES ($1, '1.10500', '1.10500', '1.10500', $2)`,
        [testSymbol, contract.expiryTime]
      );
    }

    // Try to settle each contract 3 times in parallel
    const settlePromises = contracts.flatMap(c => [
      settlementWorker.settle(c.id!),
      settlementWorker.settle(c.id!),
      settlementWorker.settle(c.id!)
    ]);

    await Promise.all(settlePromises);

    // Verify each is settled exactly once (won status)
    for (const contract of contracts) {
      const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
      expect(rows[0].status).toBe('won');
    }
    test('SET-009: should revert to active on unexpected error (Crash Simulation)', async () => {
    const contract = await placeTestTrade('1.10000');

    // Force findById to throw once to simulate a crash/error
    const originalFindById = (settlementWorker as any).contractRepo.findById;
    (settlementWorker as any).contractRepo.findById = jest.fn().mockRejectedValue(new Error('Unexpected Crash'));

    await expect(settlementWorker.settle(contract.id!)).rejects.toThrow('Unexpected Crash');

    const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(rows[0].status).toBe('active');

    // Restore and verify it can now settle
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

  test('SET-008: should handle missing price tick with error (to trigger retry)', async () => {
    const contract = await placeTestTrade('1.10000');
    // No tick seeded
    await expect(settlementWorker.settle(contract.id!)).rejects.toThrow('Price tick not found');

    const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(rows[0].status).toBe('active'); // Reverted from 'settling'
    test('SET-009: should revert to active on unexpected error (Crash Simulation)', async () => {
    const contract = await placeTestTrade('1.10000');

    // Force findById to throw once to simulate a crash/error
    const originalFindById = (settlementWorker as any).contractRepo.findById;
    (settlementWorker as any).contractRepo.findById = jest.fn().mockRejectedValue(new Error('Unexpected Crash'));

    await expect(settlementWorker.settle(contract.id!)).rejects.toThrow('Unexpected Crash');

    const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(rows[0].status).toBe('active');

    // Restore and verify it can now settle
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

  test('SET-006: should refund if price tick is missing (Oracle Gap)', async () => {
    process.env.MAX_ORACLE_GAP_MS = '1000'; // Tight gap for test
    const contract = await placeTestTrade('1.10000');

    // Seed a price tick that is too old (e.g., 5 seconds before expiry)
    const staleTickTime = new Date(contract.expiryTime.getTime() - 5000);
    await pgPool.query(
      `INSERT INTO pricing.price_ticks (symbol, bid_price, ask_price, mid_price, tick_time)
       VALUES ($1, '1.10500', '1.10500', '1.10500', $2)`,
      [testSymbol, staleTickTime]
    );

    const balanceBefore = new Decimal((await walletService.getBalance(testUserId)).available_balance);

    await settlementWorker.settle(contract.id!);

    // Verify status
    const { rows: contracts } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(contracts[0].status).toBe('cancelled');

    // Verify refund
    const balanceAfter = new Decimal((await walletService.getBalance(testUserId)).available_balance);
    expect(balanceAfter.toNumber()).toBe(balanceBefore.plus(1000).toNumber());
    test('SET-004: should settle a winning Lower contract', async () => {
    mockPricingService.getMarketStatus.mockResolvedValue({ is_open: true } as any);
    mockPricingService.getLatestPrice.mockResolvedValue({
      symbol: testSymbol,
      bid: '1.10000',
      ask: '1.10000',
      mid: '1.10000',
      tick_time: new Date().toISOString()
    } as any);

    const contract = await tradingService.placeTrade(testUserId, {
      assetSymbol: testSymbol,
      contractType: 'lower',
      stake: '1000',
      expirySeconds: 60
      test('SET-009: should revert to active on unexpected error (Crash Simulation)', async () => {
    const contract = await placeTestTrade('1.10000');

    // Force findById to throw once to simulate a crash/error
    const originalFindById = (settlementWorker as any).contractRepo.findById;
    (settlementWorker as any).contractRepo.findById = jest.fn().mockRejectedValue(new Error('Unexpected Crash'));

    await expect(settlementWorker.settle(contract.id!)).rejects.toThrow('Unexpected Crash');

    const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(rows[0].status).toBe('active');

    // Restore and verify it can now settle
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

    await pgPool.query(
      `INSERT INTO pricing.price_ticks (symbol, bid_price, ask_price, mid_price, tick_time)
       VALUES ($1, '1.09500', '1.09500', '1.09500', $2)`,
      [testSymbol, contract.expiryTime]
    );

    await settlementWorker.settle(contract.id!);
    const { rows: contracts } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(contracts[0].status).toBe('won');
    test('SET-009: should revert to active on unexpected error (Crash Simulation)', async () => {
    const contract = await placeTestTrade('1.10000');

    // Force findById to throw once to simulate a crash/error
    const originalFindById = (settlementWorker as any).contractRepo.findById;
    (settlementWorker as any).contractRepo.findById = jest.fn().mockRejectedValue(new Error('Unexpected Crash'));

    await expect(settlementWorker.settle(contract.id!)).rejects.toThrow('Unexpected Crash');

    const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(rows[0].status).toBe('active');

    // Restore and verify it can now settle
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

  test('SET-005: should settle a losing Lower contract', async () => {
    mockPricingService.getMarketStatus.mockResolvedValue({ is_open: true } as any);
    mockPricingService.getLatestPrice.mockResolvedValue({
      symbol: testSymbol,
      bid: '1.10000',
      ask: '1.10000',
      mid: '1.10000',
      tick_time: new Date().toISOString()
    } as any);

    const contract = await tradingService.placeTrade(testUserId, {
      assetSymbol: testSymbol,
      contractType: 'lower',
      stake: '1000',
      expirySeconds: 60
      test('SET-009: should revert to active on unexpected error (Crash Simulation)', async () => {
    const contract = await placeTestTrade('1.10000');

    // Force findById to throw once to simulate a crash/error
    const originalFindById = (settlementWorker as any).contractRepo.findById;
    (settlementWorker as any).contractRepo.findById = jest.fn().mockRejectedValue(new Error('Unexpected Crash'));

    await expect(settlementWorker.settle(contract.id!)).rejects.toThrow('Unexpected Crash');

    const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(rows[0].status).toBe('active');

    // Restore and verify it can now settle
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

    await pgPool.query(
      `INSERT INTO pricing.price_ticks (symbol, bid_price, ask_price, mid_price, tick_time)
       VALUES ($1, '1.10500', '1.10500', '1.10500', $2)`,
      [testSymbol, contract.expiryTime]
    );

    await settlementWorker.settle(contract.id!);
    const { rows: contracts } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(contracts[0].status).toBe('lost');
    test('SET-009: should revert to active on unexpected error (Crash Simulation)', async () => {
    const contract = await placeTestTrade('1.10000');

    // Force findById to throw once to simulate a crash/error
    const originalFindById = (settlementWorker as any).contractRepo.findById;
    (settlementWorker as any).contractRepo.findById = jest.fn().mockRejectedValue(new Error('Unexpected Crash'));

    await expect(settlementWorker.settle(contract.id!)).rejects.toThrow('Unexpected Crash');

    const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(rows[0].status).toBe('active');

    // Restore and verify it can now settle
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

  test('SET-007: 10 simultaneous settlements (Concurrency)', async () => {
    // We'll create 10 contracts and try to settle them multiple times in parallel
    const contractPromises = Array.from({ length: 10 }).map(() => placeTestTrade('1.10000'));
    const contracts = await Promise.all(contractPromises);

    for (const contract of contracts) {
      await pgPool.query(
        `INSERT INTO pricing.price_ticks (symbol, bid_price, ask_price, mid_price, tick_time)
         VALUES ($1, '1.10500', '1.10500', '1.10500', $2)`,
        [testSymbol, contract.expiryTime]
      );
    }

    // Try to settle each contract 3 times in parallel
    const settlePromises = contracts.flatMap(c => [
      settlementWorker.settle(c.id!),
      settlementWorker.settle(c.id!),
      settlementWorker.settle(c.id!)
    ]);

    await Promise.all(settlePromises);

    // Verify each is settled exactly once (won status)
    for (const contract of contracts) {
      const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
      expect(rows[0].status).toBe('won');
    }
    test('SET-009: should revert to active on unexpected error (Crash Simulation)', async () => {
    const contract = await placeTestTrade('1.10000');

    // Force findById to throw once to simulate a crash/error
    const originalFindById = (settlementWorker as any).contractRepo.findById;
    (settlementWorker as any).contractRepo.findById = jest.fn().mockRejectedValue(new Error('Unexpected Crash'));

    await expect(settlementWorker.settle(contract.id!)).rejects.toThrow('Unexpected Crash');

    const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(rows[0].status).toBe('active');

    // Restore and verify it can now settle
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

  test('SET-008: should handle missing price tick with error (to trigger retry)', async () => {
    const contract = await placeTestTrade('1.10000');
    // No tick seeded
    await expect(settlementWorker.settle(contract.id!)).rejects.toThrow('Price tick not found');

    const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(rows[0].status).toBe('active'); // Reverted from 'settling'
    test('SET-009: should revert to active on unexpected error (Crash Simulation)', async () => {
    const contract = await placeTestTrade('1.10000');

    // Force findById to throw once to simulate a crash/error
    const originalFindById = (settlementWorker as any).contractRepo.findById;
    (settlementWorker as any).contractRepo.findById = jest.fn().mockRejectedValue(new Error('Unexpected Crash'));

    await expect(settlementWorker.settle(contract.id!)).rejects.toThrow('Unexpected Crash');

    const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(rows[0].status).toBe('active');

    // Restore and verify it can now settle
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
  test('SET-004: should settle a winning Lower contract', async () => {
    mockPricingService.getMarketStatus.mockResolvedValue({ is_open: true } as any);
    mockPricingService.getLatestPrice.mockResolvedValue({
      symbol: testSymbol,
      bid: '1.10000',
      ask: '1.10000',
      mid: '1.10000',
      tick_time: new Date().toISOString()
    } as any);

    const contract = await tradingService.placeTrade(testUserId, {
      assetSymbol: testSymbol,
      contractType: 'lower',
      stake: '1000',
      expirySeconds: 60
      test('SET-009: should revert to active on unexpected error (Crash Simulation)', async () => {
    const contract = await placeTestTrade('1.10000');

    // Force findById to throw once to simulate a crash/error
    const originalFindById = (settlementWorker as any).contractRepo.findById;
    (settlementWorker as any).contractRepo.findById = jest.fn().mockRejectedValue(new Error('Unexpected Crash'));

    await expect(settlementWorker.settle(contract.id!)).rejects.toThrow('Unexpected Crash');

    const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(rows[0].status).toBe('active');

    // Restore and verify it can now settle
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

    await pgPool.query(
      `INSERT INTO pricing.price_ticks (symbol, bid_price, ask_price, mid_price, tick_time)
       VALUES ($1, '1.09500', '1.09500', '1.09500', $2)`,
      [testSymbol, contract.expiryTime]
    );

    await settlementWorker.settle(contract.id!);
    const { rows: contracts } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(contracts[0].status).toBe('won');
    test('SET-009: should revert to active on unexpected error (Crash Simulation)', async () => {
    const contract = await placeTestTrade('1.10000');

    // Force findById to throw once to simulate a crash/error
    const originalFindById = (settlementWorker as any).contractRepo.findById;
    (settlementWorker as any).contractRepo.findById = jest.fn().mockRejectedValue(new Error('Unexpected Crash'));

    await expect(settlementWorker.settle(contract.id!)).rejects.toThrow('Unexpected Crash');

    const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(rows[0].status).toBe('active');

    // Restore and verify it can now settle
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

  test('SET-005: should settle a losing Lower contract', async () => {
    mockPricingService.getMarketStatus.mockResolvedValue({ is_open: true } as any);
    mockPricingService.getLatestPrice.mockResolvedValue({
      symbol: testSymbol,
      bid: '1.10000',
      ask: '1.10000',
      mid: '1.10000',
      tick_time: new Date().toISOString()
    } as any);

    const contract = await tradingService.placeTrade(testUserId, {
      assetSymbol: testSymbol,
      contractType: 'lower',
      stake: '1000',
      expirySeconds: 60
      test('SET-009: should revert to active on unexpected error (Crash Simulation)', async () => {
    const contract = await placeTestTrade('1.10000');

    // Force findById to throw once to simulate a crash/error
    const originalFindById = (settlementWorker as any).contractRepo.findById;
    (settlementWorker as any).contractRepo.findById = jest.fn().mockRejectedValue(new Error('Unexpected Crash'));

    await expect(settlementWorker.settle(contract.id!)).rejects.toThrow('Unexpected Crash');

    const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(rows[0].status).toBe('active');

    // Restore and verify it can now settle
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

    await pgPool.query(
      `INSERT INTO pricing.price_ticks (symbol, bid_price, ask_price, mid_price, tick_time)
       VALUES ($1, '1.10500', '1.10500', '1.10500', $2)`,
      [testSymbol, contract.expiryTime]
    );

    await settlementWorker.settle(contract.id!);
    const { rows: contracts } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(contracts[0].status).toBe('lost');
    test('SET-009: should revert to active on unexpected error (Crash Simulation)', async () => {
    const contract = await placeTestTrade('1.10000');

    // Force findById to throw once to simulate a crash/error
    const originalFindById = (settlementWorker as any).contractRepo.findById;
    (settlementWorker as any).contractRepo.findById = jest.fn().mockRejectedValue(new Error('Unexpected Crash'));

    await expect(settlementWorker.settle(contract.id!)).rejects.toThrow('Unexpected Crash');

    const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(rows[0].status).toBe('active');

    // Restore and verify it can now settle
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

  test('SET-007: 10 simultaneous settlements (Concurrency)', async () => {
    // We'll create 10 contracts and try to settle them multiple times in parallel
    const contractPromises = Array.from({ length: 10 }).map(() => placeTestTrade('1.10000'));
    const contracts = await Promise.all(contractPromises);

    for (const contract of contracts) {
      await pgPool.query(
        `INSERT INTO pricing.price_ticks (symbol, bid_price, ask_price, mid_price, tick_time)
         VALUES ($1, '1.10500', '1.10500', '1.10500', $2)`,
        [testSymbol, contract.expiryTime]
      );
    }

    // Try to settle each contract 3 times in parallel
    const settlePromises = contracts.flatMap(c => [
      settlementWorker.settle(c.id!),
      settlementWorker.settle(c.id!),
      settlementWorker.settle(c.id!)
    ]);

    await Promise.all(settlePromises);

    // Verify each is settled exactly once (won status)
    for (const contract of contracts) {
      const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
      expect(rows[0].status).toBe('won');
    }
    test('SET-009: should revert to active on unexpected error (Crash Simulation)', async () => {
    const contract = await placeTestTrade('1.10000');

    // Force findById to throw once to simulate a crash/error
    const originalFindById = (settlementWorker as any).contractRepo.findById;
    (settlementWorker as any).contractRepo.findById = jest.fn().mockRejectedValue(new Error('Unexpected Crash'));

    await expect(settlementWorker.settle(contract.id!)).rejects.toThrow('Unexpected Crash');

    const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(rows[0].status).toBe('active');

    // Restore and verify it can now settle
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

  test('SET-008: should handle missing price tick with error (to trigger retry)', async () => {
    const contract = await placeTestTrade('1.10000');
    // No tick seeded
    await expect(settlementWorker.settle(contract.id!)).rejects.toThrow('Price tick not found');

    const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(rows[0].status).toBe('active'); // Reverted from 'settling'
    test('SET-009: should revert to active on unexpected error (Crash Simulation)', async () => {
    const contract = await placeTestTrade('1.10000');

    // Force findById to throw once to simulate a crash/error
    const originalFindById = (settlementWorker as any).contractRepo.findById;
    (settlementWorker as any).contractRepo.findById = jest.fn().mockRejectedValue(new Error('Unexpected Crash'));

    await expect(settlementWorker.settle(contract.id!)).rejects.toThrow('Unexpected Crash');

    const { rows } = await pgPool.query('SELECT status FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(rows[0].status).toBe('active');

    // Restore and verify it can now settle
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
