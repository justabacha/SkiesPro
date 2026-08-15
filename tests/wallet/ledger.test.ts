import { WalletService } from '../../src/modules/wallet/services/walletService';
import { pgPool } from '../../src/config/database';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

describe('Wallet & Ledger Service', () => {
  let walletService: WalletService;
  let testUserId: string;

  beforeAll(async () => {
    walletService = new WalletService();
    // Create a test user in app_auth.users
    const email = `test-wallet-${Date.now()}@example.com`;
    const res = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status) VALUES ($1, 'hash', 'Test Wallet', 'active', 'verified') RETURNING id",
      [email]
    );
    testUserId = res.rows[0].id;
  });

  afterAll(async () => {
    await pgPool.query('DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)', [testUserId]);
    await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = $1', [testUserId]);
    await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [testUserId]);
  });

  it('should create a wallet for a new user', async () => {
    const wallet = await walletService.createWallet(testUserId, 'KES');
    expect(wallet.user_id).toBe(testUserId);
    expect(new Decimal(wallet.balance).isZero()).toBe(true);
  });

  it('should credit a wallet and record a ledger entry', async () => {
    const amount = new Decimal('1000.5000');
    const wallet = await walletService.credit(testUserId, amount, 'deposit', uuidv4(), 'Test deposit');

    expect(new Decimal(wallet.balance).equals(amount)).toBe(true);

    const ledgerRes = await pgPool.query('SELECT * FROM wallet.ledger_entries WHERE wallet_id = $1', [wallet.id]);
    expect(ledgerRes.rowCount).toBe(1);
    expect(ledgerRes.rows[0].entry_type).toBe('credit');
    expect(new Decimal(ledgerRes.rows[0].amount).equals(amount)).toBe(true);
  });

  it('should debit a wallet and record a ledger entry', async () => {
    const debitAmount = new Decimal('500.2500');
    const wallet = await walletService.debit(testUserId, debitAmount, 'withdrawal', uuidv4(), 'Test withdrawal');

    expect(new Decimal(wallet.balance).equals(new Decimal('500.2500'))).toBe(true);

    const ledgerRes = await pgPool.query('SELECT * FROM wallet.ledger_entries WHERE wallet_id = $1 AND entry_type = \'debit\'', [wallet.id]);
    expect(ledgerRes.rowCount).toBe(1);
  });

  it('should fail to debit more than available balance', async () => {
    const excessiveAmount = new Decimal('1000000');
    await expect(walletService.debit(testUserId, excessiveAmount, 'withdrawal')).rejects.toThrow('Insufficient funds');
  });

  it('should lock and unlock funds correctly', async () => {
    const lockAmount = new Decimal('100.0000');
    let wallet = await walletService.lockFunds(testUserId, lockAmount, 'trade_stake');

    expect(new Decimal(wallet.locked_balance).equals(lockAmount)).toBe(true);
    expect(new Decimal(wallet.available_balance).equals(new Decimal('400.2500'))).toBe(true);

    wallet = await walletService.unlockFunds(testUserId, lockAmount);
    expect(new Decimal(wallet.locked_balance).isZero()).toBe(true);
    expect(new Decimal(wallet.available_balance).equals(new Decimal('500.2500'))).toBe(true);
  });
});
