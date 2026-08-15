import { PaymentService } from '../../src/modules/payments/services/paymentService';
import { WalletService } from '../../src/modules/wallet/services/walletService';
import { pgPool } from '../../src/config/database';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

describe('M-Pesa Callback Integration', () => {
  let paymentService: PaymentService;
  let walletService: WalletService;
  let testUserId: string;

  beforeAll(async () => {
    paymentService = new PaymentService();
    walletService = new WalletService();

    // Create a test user
    const email = `callback-test-${Date.now()}@example.com`;
    const res = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status) VALUES ($1, 'hash', 'Callback Test', 'active', 'unverified') RETURNING id",
      [email]
    );
    testUserId = res.rows[0].id;
    await walletService.createWallet(testUserId, 'KES');
  });

  afterAll(async () => {
    await pgPool.query('DELETE FROM payments.deposits WHERE user_id = $1', [testUserId]);
    await pgPool.query('DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)', [testUserId]);
    await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = $1', [testUserId]);
    await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [testUserId]);
  });

  it('should credit wallet on successful M-Pesa callback', async () => {
    const checkoutRequestId = uuidv4();
    const amount = '1000.0000';

    const ik = uuidv4();
    await pgPool.query(
      'INSERT INTO payments.idempotency_keys (key, response) VALUES ($1, $2)',
      [ik, JSON.stringify({ status: 'processing' })]
    );

    // 1. Manually insert a pending deposit
    await pgPool.query(
      `INSERT INTO payments.deposits (user_id, gateway_id, gateway_reference, amount, fee, net_amount, currency, status, idempotency_key)
       VALUES ($1, 1, $2, $3, 0, $3, 'KES', 'pending', $4)`,
      [testUserId, checkoutRequestId, amount, ik]
    );

    // 2. Simulate M-Pesa callback
    const callbackPayload = {
      Body: {
        stkCallback: {
          MerchantRequestID: uuidv4(),
          CheckoutRequestID: checkoutRequestId,
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.'
        }
      }
    };

    await paymentService.handleMpesaCallback(callbackPayload);

    // 3. Verify deposit is completed
    const depRes = await pgPool.query('SELECT status FROM payments.deposits WHERE gateway_reference = $1', [checkoutRequestId]);
    expect(depRes.rows[0].status).toBe('completed');

    // 4. Verify wallet balance
    const wallet = await walletService.getBalance(testUserId);
    expect(new Decimal(wallet.balance).equals(new Decimal(amount))).toBe(true);
  });

  it('should prevent double credit on concurrent successful callbacks', async () => {
    const checkoutRequestId = uuidv4();
    const amount = '1000.0000';
    const ik = uuidv4();

    await pgPool.query(
      'INSERT INTO payments.idempotency_keys (key, response) VALUES ($1, $2)',
      [ik, JSON.stringify({ status: 'processing' })]
    );

    await pgPool.query(
      `INSERT INTO payments.deposits (user_id, gateway_id, gateway_reference, amount, fee, net_amount, currency, status, idempotency_key)
       VALUES ($1, 1, $2, $3, 0, $3, 'KES', 'pending', $4)`,
      [testUserId, checkoutRequestId, amount, ik]
    );

    const callbackPayload = {
      Body: {
        stkCallback: {
          MerchantRequestID: uuidv4(),
          CheckoutRequestID: checkoutRequestId,
          ResultCode: 0,
          ResultDesc: 'Success'
        }
      }
    };

    // Trigger two callbacks concurrently
    await Promise.all([
      paymentService.handleMpesaCallback(callbackPayload),
      paymentService.handleMpesaCallback(callbackPayload)
    ]);

    // Wallet should only be credited once.
    // Previous balance was 1000. New balance should be 2000, NOT 3000.
    const wallet = await walletService.getBalance(testUserId);
    expect(new Decimal(wallet.balance).equals(new Decimal('2000.0000'))).toBe(true);

    // Ledger entries should only show two deposits total
    const ledgerRes = await pgPool.query('SELECT count(*) FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)', [testUserId]);
    expect(parseInt(ledgerRes.rows[0].count)).toBe(2);
  });

  it('should mark deposit as failed on unsuccessful M-Pesa callback', async () => {
    const checkoutRequestId = uuidv4();
    const amount = '500.0000';
    const ik = uuidv4();

    await pgPool.query(
      'INSERT INTO payments.idempotency_keys (key, response) VALUES ($1, $2)',
      [ik, JSON.stringify({ status: 'processing' })]
    );

    await pgPool.query(
      `INSERT INTO payments.deposits (user_id, gateway_id, gateway_reference, amount, fee, net_amount, currency, status, idempotency_key)
       VALUES ($1, 1, $2, $3, 0, $3, 'KES', 'pending', $4)`,
      [testUserId, checkoutRequestId, amount, ik]
    );

    const callbackPayload = {
      Body: {
        stkCallback: {
          MerchantRequestID: uuidv4(),
          CheckoutRequestID: checkoutRequestId,
          ResultCode: 1032,
          ResultDesc: 'Request cancelled by user.'
        }
      }
    };

    await paymentService.handleMpesaCallback(callbackPayload);

    const depRes = await pgPool.query('SELECT status FROM payments.deposits WHERE gateway_reference = $1', [checkoutRequestId]);
    expect(depRes.rows[0].status).toBe('failed');
  });
});
