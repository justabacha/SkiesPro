import { TradingService } from '../../../src/modules/trading/services/tradingService.js';
import { PricingService } from '../../../src/modules/pricing/services/pricingService.js';
import { pgPool } from '../../../src/config/database.js';
import { WalletService } from '../../../src/modules/wallet/services/walletService.js';
import { messageQueueClient } from '../../../src/infrastructure/message-queue/MessageQueueClient.js';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

jest.mock('../../../src/infrastructure/message-queue/MessageQueueClient.js', () => ({
  messageQueueClient: {
    publish: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('Trading Engine Integration', () => {
  let tradingService: TradingService;
  let mockPricingService: jest.Mocked<PricingService>;
  let walletService: WalletService;

  const testUserId = uuidv4();
  const testSymbol = 'EUR/USD';

  beforeAll(async () => {
    process.env.LATENCY_THRESHOLD_MS = '5000';
    mockPricingService = {
      getMarketStatus: jest.fn(),
      getLatestPrice: jest.fn(),
    } as any;

    tradingService = new TradingService(mockPricingService);
    walletService = new WalletService();

    // Clean up potentially existing data
    await pgPool.query('DELETE FROM trading.binary_contracts WHERE user_id = $1', [testUserId]);
    await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = $1', [testUserId]);
    await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [testUserId]);

    // Create a test user
    const testReferralCode = uuidv4().split('-')[0].toUpperCase();
    await pgPool.query(
      `INSERT INTO app_auth.users (id, email, password_hash, display_name, referral_code, status, kyc_status)
       VALUES ($1, $2, 'hash', 'Test Trader', $3, 'active', 'verified')`,
      [testUserId, `test-${testUserId}@example.com`, testReferralCode]
    );

    // Create wallet with balance
    await walletService.createWallet(testUserId, 'KES');
    await walletService.credit(testUserId, new Decimal('10000'), 'deposit', undefined, 'Initial balance');

    // Ensure asset config exists
    await pgPool.query(
      `INSERT INTO trading.asset_config (asset_symbol, min_stake, max_stake_per_trade, min_duration_seconds, max_duration_seconds, payout_rate, is_active, max_exposure)
       VALUES ($1, 100, 50000, 60, 3600, 0.60, TRUE, 1000000)
       ON CONFLICT (asset_symbol) DO UPDATE SET
        is_active = TRUE,
        max_exposure = 1000000,
        payout_rate = 0.60,
        min_stake = 100,
        max_stake_per_trade = 50000`,
      [testSymbol]
    );
  });

  afterAll(async () => {
    await pgPool.query('DELETE FROM trading.contract_events WHERE contract_id IN (SELECT id FROM trading.binary_contracts WHERE user_id = $1)', [testUserId]);
    await pgPool.query('DELETE FROM trading.binary_contracts WHERE user_id = $1', [testUserId]);
    await pgPool.query('DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)', [testUserId]);
    await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = $1', [testUserId]);
    await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [testUserId]);
  });

  test('should successfully place a trade', async () => {
    mockPricingService.getMarketStatus.mockResolvedValue({ is_open: true } as any);
    mockPricingService.getLatestPrice.mockResolvedValue({
      symbol: testSymbol,
      bid: '1.1000',
      ask: '1.1002',
      mid: '1.1001',
      time: new Date().toISOString()
    } as any);

    const request = {
      assetSymbol: testSymbol,
      contractType: 'higher' as const,
      stake: '500',
      expirySeconds: 300
    };

    const contract = await tradingService.placeTrade(testUserId, request);

    expect(contract).toBeDefined();
    expect(contract.status).toBe('active');
    expect(new Decimal(contract.stake).toNumber()).toBe(500);
    expect(contract.contractType).toBe('higher');
    expect(new Decimal(contract.strikePrice).toNumber()).toBe(1.1002); // ask for 'higher'
    expect(new Decimal(contract.payoutRate).toNumber()).toBe(0.60);

    // Verify wallet balance
    const wallet = await walletService.getBalance(testUserId);
    expect(new Decimal(wallet.available_balance).toNumber()).toBe(9500);
    expect(new Decimal(wallet.balance).toNumber()).toBe(9500);
    expect(new Decimal(wallet.locked_balance).toNumber()).toBe(0);

    // Verify contract in DB
    const { rows } = await pgPool.query('SELECT * FROM trading.binary_contracts WHERE id = $1', [contract.id]);
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('active');

    // Verify event recorded
    const { rows: events } = await pgPool.query('SELECT * FROM trading.contract_events WHERE contract_id = $1', [contract.id]);
    expect(events.length).toBe(1);
    expect(events[0].event_type).toBe('created');

    // Verify queue message
    expect(messageQueueClient.publish).toHaveBeenCalledWith(
      'trade.expiry',
      expect.objectContaining({ contractId: contract.id }),
      expect.anything()
    );
  });

  test('should fail if insufficient balance', async () => {
    mockPricingService.getMarketStatus.mockResolvedValue({ is_open: true } as any);

    const request = {
      assetSymbol: testSymbol,
      contractType: 'lower' as const,
      stake: '20000', // More than available
      expirySeconds: 60
    };

    await expect(tradingService.placeTrade(testUserId, request)).rejects.toThrow('Insufficient available balance');
  });

  test('should fail if stake below minimum', async () => {
    const request = {
      assetSymbol: testSymbol,
      contractType: 'higher' as const,
      stake: '50', // Min is 100
      expirySeconds: 60
    };

    await expect(tradingService.placeTrade(testUserId, request)).rejects.toThrow('below minimum');
  });
});
