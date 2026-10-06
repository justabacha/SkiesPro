import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import { pgPool } from '../../src/config/database.js';
import { ContractRepository } from '../../src/modules/trading/repositories/contractRepository.js';
import { DemoTradingService } from '../../src/modules/trading/services/demoTradingService.js';
import { DemoWalletService } from '../../src/modules/wallet/services/demoWalletService.js';
import { WalletService } from '../../src/modules/wallet/services/walletService.js';
import { SettlementWorker } from '../../src/modules/trading/workers/settlementWorker.js';
import { TickRepository } from '../../src/modules/pricing/repositories/tickRepository.js';

describe('Demo wallet isolation integration', () => {
  const userId = uuidv4();
  const demoWalletService = new DemoWalletService();
  const walletService = new WalletService();
  const contractRepository = new ContractRepository();
  const originalInitialBalance = process.env.DEMO_INITIAL_BALANCE_KES;

  beforeAll(async () => {
    process.env.DEMO_INITIAL_BALANCE_KES = '100000';
    const referralCode = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
    await pgPool.query(
      `INSERT INTO app_auth.users
         (id, email, password_hash, display_name, referral_code, status, kyc_status)
       VALUES ($1, $2, 'hash', 'Demo Isolation Test', $3, 'active', 'verified')`,
      [userId, `demo-isolation-${userId}@example.com`, referralCode]
    );
    await walletService.createWallet(userId, 'real', 'KES');
    await walletService.credit(
      userId,
      'real',
      new Decimal('10000'),
      'admin_adjustment',
      undefined,
      'Demo isolation fixture'
    );
  });

  afterAll(async () => {
    await pgPool.query('DELETE FROM trading.demo_trade_idempotency WHERE user_id = $1', [userId]);
    await pgPool.query('DELETE FROM wallet.demo_wallet_reset_events WHERE user_id = $1', [userId]);
    await pgPool.query(
      'DELETE FROM trading.contract_events WHERE contract_id IN (SELECT id FROM trading.binary_contracts WHERE user_id = $1)',
      [userId]
    );
    await pgPool.query('DELETE FROM trading.binary_contracts WHERE user_id = $1', [userId]);
    await pgPool.query(
      'DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)',
      [userId]
    );
    await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = $1', [userId]);
    await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [userId]);
    if (originalInitialBalance === undefined) {
      delete process.env.DEMO_INITIAL_BALANCE_KES;
    } else {
      process.env.DEMO_INITIAL_BALANCE_KES = originalInitialBalance;
    }
  });

  it('creates exactly one funded demo wallet without changing the real wallet', async () => {
    const wallets = await Promise.all(
      Array.from({ length: 5 }, () => demoWalletService.getBalance(userId))
    );
    const realWallet = await walletService.getBalance(userId, 'real');
    const demoWallet = await walletService.getBalance(userId, 'demo');
    const funding = await pgPool.query(
      `SELECT COUNT(*)::int AS count
         FROM wallet.ledger_entries
        WHERE wallet_id = $1 AND reference_type = 'demo_funding'`,
      [demoWallet.id]
    );

    expect(new Set(wallets.map((wallet) => wallet.id)).size).toBe(1);
    expect(demoWallet.balance).toBe('100000.0000');
    expect(realWallet.balance).toBe('10000.0000');
    expect(funding.rows[0].count).toBe(1);
  });

  it('rejects cross-mode ledger references and preserves the real balance', async () => {
    const demoWallet = await demoWalletService.getBalance(userId);
    await expect(
      walletService.credit(
        userId,
        'real',
        new Decimal('1'),
        'demo_reset',
        undefined,
        'Must be rejected by the database guard'
      )
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      walletService.credit(
        userId,
        'demo',
        new Decimal('1'),
        'deposit',
        undefined,
        'Must also be rejected by the database guard'
      )
    ).rejects.toMatchObject({ code: '23514' });

    const realWallet = await walletService.getBalance(userId, 'real');
    const demoAfter = await walletService.getBalance(userId, 'demo');
    expect(realWallet.balance).toBe('10000.0000');
    expect(demoAfter.balance).toBe(demoWallet.balance);
  });

  it('debits only demo funds and replays demo trades idempotently', async () => {
    const now = new Date().toISOString();
    const demoPriceFeed = {
      getQuote: jest.fn().mockResolvedValue({
        symbol: 'EUR/USD',
        bid: '1.10000',
        ask: '1.10010',
        mid: '1.10005',
        time: now,
      }),
    };
    const demoTradingService = new DemoTradingService(demoPriceFeed);
    const idempotencyKey = uuidv4();
    const realBefore = await walletService.getBalance(userId, 'real');
    const demoBefore = await demoWalletService.getBalance(userId);
    let firstContractId: string | undefined;

    try {
      const [first, replay] = await Promise.all([
        demoTradingService.placeDemoTrade(
          userId,
          {
            assetSymbol: 'EUR/USD',
            contractType: 'higher',
            stake: '100',
            expirySeconds: 60,
          },
          idempotencyKey
        ),
        demoTradingService.placeDemoTrade(
          userId,
          {
            assetSymbol: 'EUR/USD',
            contractType: 'higher',
            stake: '100',
            expirySeconds: 60,
          },
          idempotencyKey
        ),
      ]);
      firstContractId = first.id;
      expect(replay.id).toBe(first.id);

      const realAfter = await walletService.getBalance(userId, 'real');
      const demoAfter = await demoWalletService.getBalance(userId);
      const stakeEntries = await pgPool.query(
        `SELECT COUNT(*)::int AS count
           FROM wallet.ledger_entries
          WHERE wallet_id = $1 AND reference_type = 'demo_trade_stake'`,
        [demoAfter.id]
      );
      expect(realAfter.balance).toBe(realBefore.balance);
      expect(new Decimal(demoAfter.balance).toString()).toBe(
        new Decimal(demoBefore.balance).minus(100).toString()
      );
      expect(stakeEntries.rows[0].count).toBe(1);
    } finally {
      if (firstContractId) {
        await pgPool.query('DELETE FROM events.event_outbox WHERE aggregate_id = $1', [
          firstContractId,
        ]);
        await pgPool.query('DELETE FROM trading.contract_events WHERE contract_id = $1', [
          firstContractId,
        ]);
        await pgPool.query('DELETE FROM trading.binary_contracts WHERE id = $1', [firstContractId]);
      }
      await pgPool.query(
        'DELETE FROM trading.demo_trade_idempotency WHERE user_id = $1 AND idempotency_key = $2',
        [userId, idempotencyKey]
      );
    }
  });

  it('replays demo resets idempotently and enforces the five-per-hour quota', async () => {
    await demoWalletService.getBalance(userId);
    await walletService.debit(
      userId,
      'demo',
      new Decimal('500'),
      'demo_trade_stake',
      undefined,
      'Reset test debit'
    );

    const replayKey = uuidv4();
    const firstResult = await demoWalletService.reset(userId, replayKey);
    const replayResult = await demoWalletService.reset(userId, replayKey);
    expect(replayResult).toEqual(firstResult);
    expect(firstResult.balance).toBe('100000.0000');

    for (let i = 0; i < 4; i += 1) {
      await demoWalletService.reset(userId, uuidv4());
    }
    await expect(demoWalletService.reset(userId, uuidv4())).rejects.toMatchObject({
      code: 'DEMO_RESET_RATE_LIMITED',
    });

    const eventCount = await pgPool.query(
      'SELECT COUNT(*)::int AS count FROM wallet.demo_wallet_reset_events WHERE user_id = $1',
      [userId]
    );
    expect(eventCount.rows[0].count).toBe(5);
  });

  it('refuses reset while a demo contract is active', async () => {
    await demoWalletService.getBalance(userId);
    const contract = await contractRepository.create({
      userId,
      accountType: 'demo',
      assetSymbol: 'EUR/USD',
      stake: '100',
      contractType: 'higher',
      strikePrice: '1.10000',
      payoutRate: '0.60',
      potentialPayout: '160',
      purchaseTime: new Date(),
      expiryTime: new Date(Date.now() + 60_000),
      status: 'active',
    });

    try {
      await expect(demoWalletService.reset(userId, uuidv4())).rejects.toMatchObject({
        code: 'DEMO_TRADES_OPEN',
      });
    } finally {
      await pgPool.query('DELETE FROM trading.contract_events WHERE contract_id = $1', [
        contract.id,
      ]);
      await pgPool.query('DELETE FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    }
  });

  it('settles from demo ticks and credits only the demo wallet', async () => {
    await demoWalletService.getBalance(userId);
    const realBefore = await walletService.getBalance(userId, 'real');
    const demoWallet = await walletService.getBalance(userId, 'demo');
    const stake = new Decimal('100');
    await walletService.debit(
      userId,
      'demo',
      stake,
      'demo_trade_stake',
      undefined,
      'Settlement isolation fixture stake'
    );

    const expiryTime = new Date(Date.now() - 1000);
    const contract = await contractRepository.create({
      userId,
      accountType: 'demo',
      assetSymbol: 'EUR/USD',
      stake: stake.toString(),
      contractType: 'higher',
      strikePrice: '1.10000',
      payoutRate: '0.60',
      potentialPayout: '160',
      purchaseTime: new Date(expiryTime.getTime() - 60_000),
      expiryTime,
      status: 'active',
    });
    const insertedTicks = await pgPool.query<{ id: string }>(
      `INSERT INTO pricing.price_ticks
         (symbol, tick_time, bid_price, ask_price, mid_price, volume, source)
       VALUES
         ('EUR/USD', $1, '1.09000', '1.09000', '1.09000', '0', 'live'),
         ('EUR/USD', $2, '1.10100', '1.10100', '1.10100', '0', 'demo')
       RETURNING id`,
      [expiryTime, new Date(expiryTime.getTime() - 1)]
    );

    try {
      await new SettlementWorker().settle(contract.id!);
      const settledContract = await contractRepository.findById(contract.id!, 'demo');
      const demoAfter = await walletService.getBalance(userId, 'demo');
      const realAfter = await walletService.getBalance(userId, 'real');
      const payout = await pgPool.query(
        `SELECT COUNT(*)::int AS count
           FROM wallet.ledger_entries
          WHERE wallet_id = $1 AND reference_id = $2
            AND reference_type = 'demo_trade_payout'`,
        [demoWallet.id, contract.id]
      );

      expect(settledContract?.status).toBe('won');
      expect(new Decimal(demoAfter.balance).toString()).toBe(
        new Decimal(demoWallet.balance).plus(60).toString()
      );
      expect(realAfter.balance).toBe(realBefore.balance);
      expect(payout.rows[0].count).toBe(1);
    } finally {
      await pgPool.query('DELETE FROM events.event_outbox WHERE aggregate_id = $1', [contract.id]);
      await pgPool.query('DELETE FROM trading.contract_events WHERE contract_id = $1', [
        contract.id,
      ]);
      await pgPool.query('DELETE FROM wallet.ledger_entries WHERE reference_id = $1', [
        contract.id,
      ]);
      await pgPool.query('DELETE FROM trading.binary_contracts WHERE id = $1', [contract.id]);
      await pgPool.query('DELETE FROM pricing.price_ticks WHERE id = ANY($1::bigint[])', [
        insertedTicks.rows.map((row) => row.id),
      ]);
    }
  });

  it('keeps both reporting materialized views scoped to real contracts', async () => {
    const views = await pgPool.query<{ matviewname: string; definition: string }>(
      `SELECT matviewname, definition
         FROM pg_matviews
        WHERE schemaname = 'reporting'
          AND matviewname IN ('daily_trade_summary', 'daily_revenue_summary')`
    );
    expect(views.rows).toHaveLength(2);
    for (const view of views.rows) {
      expect(view.definition).toMatch(/account_type[\s\S]*?'real'/i);
    }
    const revenueColumns = await pgPool.query<{ column_name: string }>(
      `SELECT attr.attname AS column_name
         FROM pg_class rel
         JOIN pg_namespace ns ON ns.oid = rel.relnamespace
         JOIN pg_attribute attr ON attr.attrelid = rel.oid
        WHERE ns.nspname = 'reporting'
          AND rel.relname = 'daily_revenue_summary'
          AND attr.attnum > 0
          AND NOT attr.attisdropped`
    );
    expect(revenueColumns.rows.map((row) => row.column_name)).toEqual(
      expect.arrayContaining([
        'total_deposits',
        'total_withdrawals',
        'total_trade_volume',
        'platform_revenue',
        'trade_count',
        'active_users',
        'new_users',
      ])
    );
  });

  it('prunes only demo ticks beyond the configured retention window', async () => {
    const oldTickTime = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const recentTickTime = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    const inserted = await pgPool.query<{ id: string; source: string }>(
      `INSERT INTO pricing.price_ticks
         (symbol, tick_time, bid_price, ask_price, mid_price, volume, source)
       VALUES
         ('BTC/USD', $1, '50000.00', '50010.00', '50005.00', '0', 'demo'),
         ('BTC/USD', $1, '50000.00', '50010.00', '50005.00', '0', 'live'),
         ('BTC/USD', $2, '50000.00', '50010.00', '50005.00', '0', 'demo')
       RETURNING id, source`,
      [oldTickTime, recentTickTime]
    );
    const ledgerBefore = await pgPool.query(
      'SELECT COUNT(*)::int AS count FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)',
      [userId]
    );
    const contractsBefore = await pgPool.query(
      'SELECT COUNT(*)::int AS count FROM trading.binary_contracts WHERE user_id = $1',
      [userId]
    );

    try {
      const deleted = await new TickRepository().pruneExpiredDemoTicks(30);
      const remaining = await pgPool.query<{ id: string }>(
        'SELECT id FROM pricing.price_ticks WHERE id = ANY($1::bigint[])',
        [inserted.rows.map((row) => row.id)]
      );
      const ledgerAfter = await pgPool.query(
        'SELECT COUNT(*)::int AS count FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)',
        [userId]
      );
      const contractsAfter = await pgPool.query(
        'SELECT COUNT(*)::int AS count FROM trading.binary_contracts WHERE user_id = $1',
        [userId]
      );

      expect(deleted).toBe(1);
      expect(remaining.rows.map((row) => row.id)).toEqual(
        expect.arrayContaining(inserted.rows.slice(1).map((row) => row.id))
      );
      expect(remaining.rows.map((row) => row.id)).not.toContain(inserted.rows[0].id);
      expect(ledgerAfter.rows[0].count).toBe(ledgerBefore.rows[0].count);
      expect(contractsAfter.rows[0].count).toBe(contractsBefore.rows[0].count);
    } finally {
      await pgPool.query('DELETE FROM pricing.price_ticks WHERE id = ANY($1::bigint[])', [
        inserted.rows.map((row) => row.id),
      ]);
    }
  });
});
