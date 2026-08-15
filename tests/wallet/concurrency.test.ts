import { WalletService } from '../../src/modules/wallet/services/walletService';
import { pgPool } from '../../src/config/database';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

describe('Wallet Concurrency', () => {
  let walletService: WalletService;
  let testUserId: string;

  beforeAll(async () => {
    walletService = new WalletService();
    const email = `concurrency-${Date.now()}@example.com`;
    const res = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status) VALUES ($1, 'hash', 'Concurrency Test', 'active', 'verified') RETURNING id",
      [email]
    );
    testUserId = res.rows[0].id;
    await walletService.createWallet(testUserId, 'KES');
    await walletService.credit(testUserId, new Decimal('100'), 'admin_adjustment', uuidv4(), 'Initial funding');
  });

  afterAll(async () => {
    await pgPool.query('DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)', [testUserId]);
    await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = $1', [testUserId]);
    await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [testUserId]);
  });

  it('should prevent over-debiting with 10 parallel requests', async () => {
    // Total balance is 100.
    // Try to debit 20 ten times. Only 5 should succeed.
    const debitAmount = new Decimal('20');
    const requests = Array(10).fill(null).map(() =>
      walletService.debit(testUserId, debitAmount, 'withdrawal', uuidv4())
    );

    const results = await Promise.allSettled(requests);

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    expect(succeeded).toBe(5);
    expect(failed).toBe(5);

    const wallet = await walletService.getBalance(testUserId);
    expect(new Decimal(wallet.balance).isZero()).toBe(true);
  }, 30000);
});
