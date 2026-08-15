import { PaymentService } from '../../src/modules/payments/services/paymentService';
import { WalletService } from '../../src/modules/wallet/services/walletService';
import { pgPool } from '../../src/config/database';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

describe('Payment Service - Withdrawals', () => {
  let paymentService: PaymentService;
  let walletService: WalletService;
  let testUserId: string;
  const usedKeys: string[] = [];

  beforeAll(async () => {
    paymentService = new PaymentService();
    walletService = new WalletService();

    // Create a test user with verified KYC
    const email = `test-payment-${Date.now()}@example.com`;
    const res = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status) VALUES ($1, 'hash', 'Test Payment', 'active', 'verified') RETURNING id",
      [email]
    );
    testUserId = res.rows[0].id;

    await walletService.createWallet(testUserId, 'KES');
    // Fund the wallet
    await walletService.credit(testUserId, new Decimal('5000'), 'admin_adjustment', uuidv4(), 'Funding for tests');
  });

  afterAll(async () => {
    await pgPool.query('DELETE FROM payments.withdrawals WHERE user_id = $1', [testUserId]);
    if (usedKeys.length > 0) {
      await pgPool.query('DELETE FROM payments.idempotency_keys WHERE key = ANY($1)', [usedKeys]);
    }
    await pgPool.query('DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)', [testUserId]);
    await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = $1', [testUserId]);
    await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [testUserId]);
  });

  it('should fail if KYC is not verified', async () => {
    const unverifiedEmail = `unverified-${Date.now()}@example.com`;
    const res = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status) VALUES ($1, 'hash', 'Unverified', 'active', 'unverified') RETURNING id",
      [unverifiedEmail]
    );
    const unverifiedId = res.rows[0].id;

    const ik = uuidv4();
    usedKeys.push(ik);

    try {
      await paymentService.requestWithdrawal(unverifiedId, {
        amount: '2000',
        currency: 'KES',
        gateway_id: 1,
        phone: '+254700000000'
      }, ik);
      throw new Error('Should have thrown KYC error');
    } catch (error: any) {
      expect(error.message).toContain('KYC verification required');
    } finally {
      await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [unverifiedId]);
    }
  });

  it('should process a valid withdrawal request and lock funds with 2% fee', async () => {
    const amount = '2000';
    const idempotencyKey = uuidv4();
    usedKeys.push(idempotencyKey);

    const result = await paymentService.requestWithdrawal(testUserId, {
      amount,
      currency: 'KES',
      gateway_id: 1,
      phone: '+254700000000'
    }, idempotencyKey);

    expect(result.status).toBe('pending');

    // 2% of 2000 is 40
    expect(new Decimal(result.fee).equals(new Decimal('40'))).toBe(true);
    expect(new Decimal(result.net_amount).equals(new Decimal('1960'))).toBe(true);

    const wallet = await walletService.getBalance(testUserId);
    expect(new Decimal(wallet.locked_balance).equals(new Decimal(amount))).toBe(true);
    expect(new Decimal(wallet.available_balance).equals(new Decimal('3000'))).toBe(true);
  });

  it('should fail if amount is below minimum (1500 KES)', async () => {
    const amount = '1000';
    const ik = uuidv4();
    usedKeys.push(ik);

    await expect(paymentService.requestWithdrawal(testUserId, {
      amount,
      currency: 'KES',
      gateway_id: 1,
      phone: '+254700000000'
    }, ik)).rejects.toThrow('Minimum withdrawal is 1500 KES');
  });

  it('should fail if amount exceeds maximum (60000 KES)', async () => {
    const amount = '70000';
    const ik = uuidv4();
    usedKeys.push(ik);

    await expect(paymentService.requestWithdrawal(testUserId, {
      amount,
      currency: 'KES',
      gateway_id: 1,
      phone: '+254700000000'
    }, ik)).rejects.toThrow('Maximum daily withdrawal is 60000 KES');
  });
});
