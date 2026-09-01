import { TradingService } from '../../../src/modules/trading/services/tradingService.js';
import { SettlementWorker } from '../../../src/modules/trading/workers/settlementWorker.js';
import { PricingService } from '../../../src/modules/pricing/services/pricingService.js';
import { MarketStatusService } from '../../../src/modules/pricing/services/MarketStatusService.js';
import { PriceValidationService } from '../../../src/modules/pricing/services/priceValidationService.js';
import { WalletService } from '../../../src/modules/wallet/services/walletService.js';
import { TickRepository } from '../../../src/modules/pricing/repositories/tickRepository.js';
import { pgPool } from '../../../src/config/database.js';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

describe('Trade Settlement Integration', () => {
  let tradingService: TradingService;
  let settlementWorker: SettlementWorker;
  let pricingService: PricingService;
  let walletService: WalletService;
  let tickRepo: TickRepository;
  let testUserId: string;

  beforeAll(async () => {
    process.env.LATENCY_THRESHOLD_MS = '5000'; // Increase for tests
    const validationService = new PriceValidationService();
    const marketStatusService = new MarketStatusService(validationService);
    pricingService = new PricingService(marketStatusService);
    tradingService = new TradingService(pricingService);
    settlementWorker = new SettlementWorker();
    walletService = new WalletService();
    tickRepo = new TickRepository();

    // Create a test user
    const email = `settle-test-${Date.now()}@example.com`;
    const res = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status) VALUES ($1, 'hash', 'Settle Test', 'active', 'unverified') RETURNING id",
      [email]
    );
    testUserId = res.rows[0].id;
    await walletService.createWallet(testUserId, 'KES');
  });

  afterAll(async () => {
    await pgPool.query('DELETE FROM trading.binary_contracts WHERE user_id = $1', [testUserId]);
    await pgPool.query('DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)', [testUserId]);
    await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = $1', [testUserId]);
    await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [testUserId]);
  });

  it('should settle a winning contract and credit user', async () => {
    // 1. Setup asset config and price
    const symbol = 'BTC/USD';
    await pgPool.query("DELETE FROM trading.asset_config WHERE asset_symbol = $1", [symbol]);
    await pgPool.query(
      "INSERT INTO trading.asset_config (asset_symbol, min_stake, max_stake_per_trade, min_duration_seconds, max_duration_seconds, payout_rate, is_active, max_exposure) VALUES ($1, 100, 50000, 10, 3600, 0.60, TRUE, 1000000)",
      [symbol]
    );

    const strikePrice = '50000.00';
    const settlementPrice = '51000.00';

    // Save strike tick
    await tickRepo.save({
      symbol,
      tick_time: new Date(),
      bid_price: strikePrice,
      ask_price: strikePrice,
      mid_price: strikePrice,
      volume: '1'
    });

    // 2. Fund user
    await walletService.credit(testUserId, new Decimal('1000'), 'deposit', uuidv4(), 'Funding');

    // 3. Place trade
    const tradeRequest = {
      assetSymbol: symbol,
      contractType: 'higher' as const,
      stake: '100',
      expirySeconds: 60
    };

    const contract = await tradingService.placeTrade(testUserId, tradeRequest, Date.now());
    expect(contract.status).toBe('active');

    // 4. Save settlement tick (using exact expiry time from contract)
    await tickRepo.save({
      symbol,
      tick_time: contract.expiryTime,
      bid_price: settlementPrice,
      ask_price: settlementPrice,
      mid_price: settlementPrice,
      volume: '1'
    });

    // 5. Trigger settlement manually
    await settlementWorker.settle(contract.id!);

    // 6. Verify outcomes
    const updatedContract = await pgPool.query("SELECT * FROM trading.binary_contracts WHERE id = $1", [contract.id]);
    expect(updatedContract.rows[0].status).toBe('won');
    expect(parseFloat(updatedContract.rows[0].expiry_price)).toBe(51000.00);

    const wallet = await walletService.getBalance(testUserId);
    // Initial 1000 - 100 (stake) + 160 (payout) = 1060
    expect(new Decimal(wallet.balance).equals(new Decimal('1060'))).toBe(true);
  });

  it('should settle a losing contract and NOT credit user', async () => {
    const symbol = 'ETH/USD';
    await pgPool.query("DELETE FROM trading.asset_config WHERE asset_symbol = $1", [symbol]);
    await pgPool.query(
      "INSERT INTO trading.asset_config (asset_symbol, min_stake, max_stake_per_trade, min_duration_seconds, max_duration_seconds, payout_rate, is_active, max_exposure) VALUES ($1, 100, 50000, 10, 3600, 0.60, TRUE, 1000000)",
      [symbol]
    );

    const strikePrice = '3000.00';
    const settlementPrice = '2900.00';

    await tickRepo.save({
      symbol,
      tick_time: new Date(),
      bid_price: strikePrice,
      ask_price: strikePrice,
      mid_price: strikePrice,
      volume: '1'
    });

    const tradeRequest = {
      assetSymbol: symbol,
      contractType: 'higher' as const,
      stake: '100',
      expirySeconds: 60
    };

    const contract = await tradingService.placeTrade(testUserId, tradeRequest, Date.now());

    await tickRepo.save({
      symbol,
      tick_time: contract.expiryTime,
      bid_price: settlementPrice,
      ask_price: settlementPrice,
      mid_price: settlementPrice,
      volume: '1'
    });

    const balanceBefore = (await walletService.getBalance(testUserId)).balance;

    await settlementWorker.settle(contract.id!);

    const updatedContract = await pgPool.query("SELECT * FROM trading.binary_contracts WHERE id = $1", [contract.id]);
    expect(updatedContract.rows[0].status).toBe('lost');

    const balanceAfter = (await walletService.getBalance(testUserId)).balance;
    expect(balanceAfter).toBe(balanceBefore); // No change after loss because stake was already debited
  });
});
