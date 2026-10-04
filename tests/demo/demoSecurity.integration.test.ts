import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import { pgPool } from '../../src/config/database.js';
import { PaymentService } from '../../src/modules/payments/services/paymentService.js';
import { DemoWalletService } from '../../src/modules/wallet/services/demoWalletService.js';
import { WalletService } from '../../src/modules/wallet/services/walletService.js';

describe('WP-21 demo security boundaries', () => {
  const userId = uuidv4();
  const paymentService = new PaymentService();
  const walletService = new WalletService();
  const demoWalletService = new DemoWalletService();
  const idempotencyKeys: string[] = [];
  const originalInitialBalance = process.env.DEMO_INITIAL_BALANCE_KES;

  beforeAll(async () => {
    process.env.DEMO_INITIAL_BALANCE_KES = '100000';
    const referralCode = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
    await pgPool.query(
      `INSERT INTO app_auth.users
         (id, email, password_hash, display_name, referral_code, status, kyc_status)
       VALUES ($1, $2, 'hash', 'Demo Security Test', $3, 'active', 'verified')`,
      [userId, `demo-security-${userId}@example.com`, referralCode]
    );
    await walletService.createWallet(userId, 'real', 'KES');
    await walletService.credit(
      userId,
      'real',
      new Decimal('10000'),
      'admin_adjustment',
      undefined,
      'Security test funding'
    );
    await demoWalletService.getBalance(userId);
  });

  afterAll(async () => {
    await pgPool.query('DELETE FROM payments.deposits WHERE user_id = $1', [userId]);
    await pgPool.query('DELETE FROM payments.withdrawals WHERE user_id = $1', [userId]);
    if (idempotencyKeys.length) {
      await pgPool.query('DELETE FROM payments.idempotency_keys WHERE key = ANY($1::text[])', [
        idempotencyKeys,
      ]);
    }
    await pgPool.query('DELETE FROM wallet.demo_wallet_reset_events WHERE user_id = $1', [userId]);
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

  it('DEMO-SEC-001: rejects cross-mode wallet mutations', async () => {
    const realBefore = await walletService.getBalance(userId, 'real');
    const demoBefore = await walletService.getBalance(userId, 'demo');

    await expect(
      walletService.credit(
        userId,
        'real',
        new Decimal('1'),
        'demo_reset',
        undefined,
        'Cross-mode security assertion'
      )
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      walletService.credit(
        userId,
        'demo',
        new Decimal('1'),
        'deposit',
        undefined,
        'Cross-mode security assertion'
      )
    ).rejects.toMatchObject({ code: '23514' });

    expect((await walletService.getBalance(userId, 'real')).balance).toBe(realBefore.balance);
    expect((await walletService.getBalance(userId, 'demo')).balance).toBe(demoBefore.balance);
  });

  it('DEMO-SEC-002: M-Pesa callbacks and withdrawals mutate only the real wallet', async () => {
    const realBefore = await walletService.getBalance(userId, 'real');
    const demoBefore = await walletService.getBalance(userId, 'demo');
    const checkoutReference = uuidv4();
    const depositKey = uuidv4();
    idempotencyKeys.push(depositKey);
    await pgPool.query('INSERT INTO payments.idempotency_keys (key, response) VALUES ($1, $2)', [
      depositKey,
      JSON.stringify({ status: 'processing' }),
    ]);
    await pgPool.query(
      `INSERT INTO payments.deposits
         (user_id, gateway_id, gateway_reference, amount, fee, net_amount, currency, status, idempotency_key)
       VALUES ($1, 1, $2, '500.0000', 0, '500.0000', 'KES', 'pending', $3)`,
      [userId, checkoutReference, depositKey]
    );

    await paymentService.handleMpesaCallback({
      Body: {
        stkCallback: {
          MerchantRequestID: uuidv4(),
          CheckoutRequestID: checkoutReference,
          ResultCode: 0,
          ResultDesc: 'Success',
        },
      },
    });

    const withdrawalKey = uuidv4();
    idempotencyKeys.push(withdrawalKey);
    await paymentService.requestWithdrawal(
      userId,
      {
        amount: '2000',
        currency: 'KES',
        gateway_id: 1,
        phone: '+254700000000',
      },
      withdrawalKey
    );

    const realAfter = await walletService.getBalance(userId, 'real');
    const demoAfter = await walletService.getBalance(userId, 'demo');
    expect(new Decimal(realAfter.balance).eq(new Decimal(realBefore.balance).plus(500))).toBe(true);
    expect(realAfter.locked_balance).toBe('2000.0000');
    expect(demoAfter.balance).toBe(demoBefore.balance);
    expect(demoAfter.locked_balance).toBe(demoBefore.locked_balance);
  });
});
