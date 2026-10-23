import { PaymentService } from '../../src/modules/payments/services/paymentService.js';
import { WalletService } from '../../src/modules/wallet/services/walletService.js';
import { AdminComplianceService } from '../../src/modules/admin/services/AdminComplianceService.js';
import { pgPool } from '../../src/config/database.js';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import { SettingsService } from '../../src/shared/services/settingsService.js';

function generateUniquePhone(): string {
  const random8 = Math.floor(10000000 + Math.random() * 90000000);
  return `07${random8}`;
}

describe('Payment Service & Admin Compliance - Withdrawals (Slice 3)', () => {
  let paymentService: PaymentService;
  let walletService: WalletService;
  let adminService: AdminComplianceService;
  let testUserId: string;
  let adminUserId: string;
  const usedKeys: string[] = [];

  beforeAll(async () => {
    paymentService = new PaymentService();
    walletService = new WalletService();
    adminService = new AdminComplianceService();

    // Create a test admin user for reviewed_by FK constraint
    const adminEmail = `test-admin-${Date.now()}@example.com`;
    const adminPhone = generateUniquePhone();
    const adminRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Test Admin', 'active', 'verified', $2) RETURNING id",
      [adminEmail, adminPhone]
    );
    adminUserId = adminRes.rows[0].id;

    // Create a test user with verified KYC and valid phone
    const email = `test-withdrawal-${Date.now()}@example.com`;
    const userPhone = generateUniquePhone();
    const res = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Test Withdrawal', 'active', 'verified', $2) RETURNING id",
      [email, userPhone]
    );
    testUserId = res.rows[0].id;

    await walletService.createWallet(testUserId, 'real', 'KES');
    // Fund the wallet with 50,000 KES
    await walletService.credit(testUserId, 'real', new Decimal('50000'), 'admin_adjustment', uuidv4(), 'Funding for tests');
  });

  afterAll(async () => {
    await pgPool.query('DELETE FROM payments.b2c_outbox WHERE withdrawal_id IN (SELECT id FROM payments.withdrawals WHERE user_id = $1)', [testUserId]);
    await pgPool.query('DELETE FROM payments.withdrawals WHERE user_id = $1', [testUserId]);
    if (usedKeys.length > 0) {
      await pgPool.query('DELETE FROM payments.idempotency_keys WHERE key = ANY($1)', [usedKeys]);
    }
    await pgPool.query('DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)', [testUserId]);
    await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = $1', [testUserId]);
    await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [testUserId]);
    await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [adminUserId]);
  });

  it('should fail if KYC is not verified', async () => {
    const unverifiedEmail = `unverified-${Date.now()}@example.com`;
    const unverifiedPhone = generateUniquePhone();
    const res = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Unverified', 'active', 'unverified', $2) RETURNING id",
      [unverifiedEmail, unverifiedPhone]
    );
    const unverifiedId = res.rows[0].id;

    const ik = uuidv4();
    usedKeys.push(ik);

    await expect(
      paymentService.requestWithdrawal(unverifiedId, {
        amount: '2000',
        currency: 'KES',
        gateway_id: 1,
        phone: '+254712345678'
      }, ik)
    ).rejects.toThrow('KYC verification required for withdrawals');

    await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [unverifiedId]);
  });

  it('should process a valid withdrawal request and lock funds with 2% fee', async () => {
    const ik = uuidv4();
    usedKeys.push(ik);

    const withdrawal = await paymentService.requestWithdrawal(testUserId, {
      amount: '5000',
      currency: 'KES',
      gateway_id: 1,
      phone: '+254712345678'
    }, ik);

    expect(withdrawal).toBeDefined();
    expect(withdrawal.status).toBe('pending');
    expect(withdrawal.amount).toBe('5000.0000');
    expect(withdrawal.fee).toBe('100.0000');
    expect(withdrawal.net_amount).toBe('4900.0000');

    // Verify wallet balances: 50k balance, 5k locked, 45k available
    const wallet = await walletService.getBalance(testUserId, 'real');
    expect(new Decimal(wallet.balance).toNumber()).toBe(50000);
    expect(new Decimal(wallet.locked_balance).toNumber()).toBe(5000);
    expect(new Decimal(wallet.available_balance).toNumber()).toBe(45000);

    // Verify no ledger entry created on pending withdrawal
    const ledger = await pgPool.query('SELECT * FROM wallet.ledger_entries WHERE reference_id = $1', [withdrawal.id]);
    expect(ledger.rows.length).toBe(0);
  });

  it('should approve withdrawal successfully (Slice 3: sets status to dispatched, enqueues b2c_outbox, leaves wallet unchanged)', async () => {
    const ik = uuidv4();
    usedKeys.push(ik);

    const wReq = await paymentService.requestWithdrawal(testUserId, {
      amount: '3000',
      currency: 'KES',
      gateway_id: 1,
      phone: '+254712345678'
    }, ik);

    const walletBefore = await walletService.getBalance(testUserId, 'real');

    const approveRes = await adminService.approveWithdrawal(wReq.id, adminUserId, 'Approval test');

    expect(approveRes.status).toBe('dispatched');
    expect(approveRes.reviewedBy).toBe(adminUserId);

    // Verify withdrawal status in DB
    const wCheck = await pgPool.query('SELECT * FROM payments.withdrawals WHERE id = $1', [wReq.id]);
    expect(wCheck.rows[0].status).toBe('dispatched');
    expect(wCheck.rows[0].reviewed_by).toBe(adminUserId);
    expect(wCheck.rows[0].review_note).toBe('Approval test');

    // Verify outbox entry created
    const outboxCheck = await pgPool.query('SELECT * FROM payments.b2c_outbox WHERE withdrawal_id = $1', [wReq.id]);
    expect(outboxCheck.rows.length).toBe(1);
    expect(outboxCheck.rows[0].status).toBe('pending');
    expect(outboxCheck.rows[0].attempt_count).toBe(0);
    expect(outboxCheck.rows[0].payload).toBeDefined();

    const payload = typeof outboxCheck.rows[0].payload === 'string'
      ? JSON.parse(outboxCheck.rows[0].payload)
      : outboxCheck.rows[0].payload;
    expect(payload.amount).toBe('3000');
    expect(payload.netAmount).toBe('2940');
    expect(payload.recipientPhone).toBeDefined();

    // Verify wallet unchanged (funds stay locked until callback/completion)
    const walletAfter = await walletService.getBalance(testUserId, 'real');
    expect(walletAfter.balance).toBe(walletBefore.balance);
    expect(walletAfter.locked_balance).toBe(walletBefore.locked_balance);
    expect(walletAfter.available_balance).toBe(walletBefore.available_balance);

    // Verify no debit ledger entry yet
    const ledger = await pgPool.query('SELECT * FROM wallet.ledger_entries WHERE reference_id = $1', [wReq.id]);
    expect(ledger.rows.length).toBe(0);
  });

  it('should enforce idempotency on sequential approve calls', async () => {
    const ik = uuidv4();
    usedKeys.push(ik);

    const wReq = await paymentService.requestWithdrawal(testUserId, {
      amount: '2000',
      currency: 'KES',
      gateway_id: 1,
      phone: '+254712345678'
    }, ik);

    // First approval succeeds
    const res1 = await adminService.approveWithdrawal(wReq.id, adminUserId, 'First call');
    expect(res1.status).toBe('dispatched');

    // Second approval throws (already resolved / dispatched)
    await expect(adminService.approveWithdrawal(wReq.id, adminUserId, 'Second call'))
      .rejects.toThrow("Cannot approve withdrawal with status 'dispatched'");

    // Verify exactly one outbox row
    const outboxRes = await pgPool.query('SELECT COUNT(*)::int AS count FROM payments.b2c_outbox WHERE withdrawal_id = $1', [wReq.id]);
    expect(outboxRes.rows[0].count).toBe(1);
  });

  it('should handle concurrent racy approve calls cleanly (only one succeeds, exactly one outbox row)', async () => {
    const ik = uuidv4();
    usedKeys.push(ik);

    const wReq = await paymentService.requestWithdrawal(testUserId, {
      amount: '2500',
      currency: 'KES',
      gateway_id: 1,
      phone: '+254712345678'
    }, ik);

    const results = await Promise.allSettled([
      adminService.approveWithdrawal(wReq.id, adminUserId, 'Race 1'),
      adminService.approveWithdrawal(wReq.id, adminUserId, 'Race 2')
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Verify withdrawal status is dispatched
    const wCheck = await pgPool.query('SELECT status FROM payments.withdrawals WHERE id = $1', [wReq.id]);
    expect(wCheck.rows[0].status).toBe('dispatched');

    // Verify exactly one outbox row
    const outboxRes = await pgPool.query('SELECT COUNT(*)::int AS count FROM payments.b2c_outbox WHERE withdrawal_id = $1', [wReq.id]);
    expect(outboxRes.rows[0].count).toBe(1);
  });

  it('should fail approval if user phone is missing', async () => {
    const noPhoneUserEmail = `nophone-${Date.now()}@example.com`;
    const userRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'No Phone', 'active', 'verified', NULL) RETURNING id",
      [noPhoneUserEmail]
    );
    const noPhoneUserId = userRes.rows[0].id;
    await walletService.createWallet(noPhoneUserId, 'real', 'KES');
    await walletService.credit(noPhoneUserId, 'real', new Decimal('5000'), 'admin_adjustment', uuidv4(), 'Funding');

    const ik = uuidv4();
    usedKeys.push(ik);

    const wReq = await paymentService.requestWithdrawal(noPhoneUserId, {
      amount: '2000',
      currency: 'KES',
      gateway_id: 1,
      phone: '+254700000000'
    }, ik);

    await expect(adminService.approveWithdrawal(wReq.id, adminUserId, 'Should fail')).rejects.toThrow('User phone number is missing or not configured');

    const wCheck = await pgPool.query('SELECT status FROM payments.withdrawals WHERE id = $1', [wReq.id]);
    expect(wCheck.rows[0].status).toBe('pending');

    await pgPool.query('DELETE FROM payments.withdrawals WHERE user_id = $1', [noPhoneUserId]);
    await pgPool.query('DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)', [noPhoneUserId]);
    await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = $1', [noPhoneUserId]);
    await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [noPhoneUserId]);
  });

  it('should fail approval if user phone format is invalid', async () => {
    const badPhoneUserEmail = `badphone-${Date.now()}@example.com`;
    const badPhone = `abc${Date.now()}`;
    const userRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Bad Phone', 'active', 'verified', $2) RETURNING id",
      [badPhoneUserEmail, badPhone]
    );
    const badPhoneUserId = userRes.rows[0].id;
    await walletService.createWallet(badPhoneUserId, 'real', 'KES');
    await walletService.credit(badPhoneUserId, 'real', new Decimal('5000'), 'admin_adjustment', uuidv4(), 'Funding');

    const ik = uuidv4();
    usedKeys.push(ik);

    const wReq = await paymentService.requestWithdrawal(badPhoneUserId, {
      amount: '2000',
      currency: 'KES',
      gateway_id: 1,
      phone: '+254700000000'
    }, ik);

    await expect(adminService.approveWithdrawal(wReq.id, adminUserId, 'Should fail')).rejects.toThrow('Invalid user phone number format');

    const wCheck = await pgPool.query('SELECT status FROM payments.withdrawals WHERE id = $1', [wReq.id]);
    expect(wCheck.rows[0].status).toBe('pending');

    await pgPool.query('DELETE FROM payments.withdrawals WHERE user_id = $1', [badPhoneUserId]);
    await pgPool.query('DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)', [badPhoneUserId]);
    await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = $1', [badPhoneUserId]);
    await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [badPhoneUserId]);
  });

  it('should fail approval if netAmount is less than or equal to zero (fee >= amount)', async () => {
    const zeroFeeUserEmail = `zerofee-${Date.now()}@example.com`;
    const zeroPhone = generateUniquePhone();
    const userRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Zero Net', 'active', 'verified', $2) RETURNING id",
      [zeroFeeUserEmail, zeroPhone]
    );
    const zeroUserId = userRes.rows[0].id;
    await walletService.createWallet(zeroUserId, 'real', 'KES');
    await walletService.credit(zeroUserId, 'real', new Decimal('1000'), 'admin_adjustment', uuidv4(), 'Funding');

    const ik = uuidv4();
    usedKeys.push(ik);
    await pgPool.query("INSERT INTO payments.idempotency_keys (key, response) VALUES ($1, '{}'::jsonb) ON CONFLICT DO NOTHING", [ik]);

    // Insert dummy withdrawal directly with fee equal to amount
    const wRes = await pgPool.query(
      "INSERT INTO payments.withdrawals (user_id, gateway_id, amount, fee, net_amount, currency, status, idempotency_key) VALUES ($1, 1, 100, 100, 0, 'KES', 'pending', $2) RETURNING id",
      [zeroUserId, ik]
    );
    const zeroWId = wRes.rows[0].id;

    await expect(adminService.approveWithdrawal(zeroWId, adminUserId, 'Should fail')).rejects.toThrow('Invalid withdrawal fee configuration');

    await pgPool.query('DELETE FROM payments.withdrawals WHERE id = $1', [zeroWId]);
    await pgPool.query('DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)', [zeroUserId]);
    await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = $1', [zeroUserId]);
    await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [zeroUserId]);
  });

  it('should fail approval if locked_balance is less than withdrawal amount', async () => {
    const lowLockEmail = `lowlock-${Date.now()}@example.com`;
    const lowLockPhone = generateUniquePhone();
    const userRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Low Lock', 'active', 'verified', $2) RETURNING id",
      [lowLockEmail, lowLockPhone]
    );
    const lowLockUserId = userRes.rows[0].id;
    await walletService.createWallet(lowLockUserId, 'real', 'KES');

    const ik = uuidv4();
    usedKeys.push(ik);
    await pgPool.query("INSERT INTO payments.idempotency_keys (key, response) VALUES ($1, '{}'::jsonb) ON CONFLICT DO NOTHING", [ik]);

    // Insert dummy withdrawal directly without locking funds in wallet
    const wRes = await pgPool.query(
      "INSERT INTO payments.withdrawals (user_id, gateway_id, amount, fee, net_amount, currency, status, idempotency_key) VALUES ($1, 1, 2000, 40, 1960, 'KES', 'pending', $2) RETURNING id",
      [lowLockUserId, ik]
    );
    const lowLockWId = wRes.rows[0].id;

    await expect(adminService.approveWithdrawal(lowLockWId, adminUserId, 'Should fail')).rejects.toThrow('Locked balance is less than withdrawal amount');

    await pgPool.query('DELETE FROM payments.withdrawals WHERE id = $1', [lowLockWId]);
    await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = $1', [lowLockUserId]);
    await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [lowLockUserId]);
  });

  it('should fail if amount is below minimum (1500 KES)', async () => {
    const ik = uuidv4();
    usedKeys.push(ik);
    const minimum = await new SettingsService().getSetting(
      'withdrawal.min_amount',
      Number(process.env.MIN_WITHDRAWAL_KES || '1500')
    );

    await expect(
      paymentService.requestWithdrawal(testUserId, {
        amount: new Decimal(minimum).minus(1).toString(),
        currency: 'KES',
        gateway_id: 1,
        phone: '+254712345678'
      }, ik)
    ).rejects.toThrow(`Minimum withdrawal is ${minimum} KES`);
  });

  it('should fail if amount exceeds maximum (60000 KES)', async () => {
    const ik = uuidv4();
    usedKeys.push(ik);
    const maximum = await new SettingsService().getSetting(
      'withdrawal.max_amount',
      Number(process.env.MAX_WITHDRAWAL_KES || '60000')
    );

    await expect(
      paymentService.requestWithdrawal(testUserId, {
        amount: new Decimal(maximum).plus(1).toString(),
        currency: 'KES',
        gateway_id: 1,
        phone: '+254712345678'
      }, ik)
    ).rejects.toThrow(`Maximum daily withdrawal is ${maximum} KES`);
  });

  it('should process withdrawal rejection correctly (refund + ledger + status rejected)', async () => {
    const ik = uuidv4();
    usedKeys.push(ik);

    const withdrawal = await paymentService.requestWithdrawal(testUserId, {
      amount: '4000',
      currency: 'KES',
      gateway_id: 1,
      phone: '+254712345678'
    }, ik);

    const walletBefore = await walletService.getBalance(testUserId, 'real');

    // Reject the withdrawal
    await adminService.rejectWithdrawal(withdrawal.id, adminUserId, 'Insufficient documentation');

    // Verify withdrawal status
    const wCheck = await pgPool.query('SELECT status, review_note, reviewed_by FROM payments.withdrawals WHERE id = $1', [withdrawal.id]);
    expect(wCheck.rows[0].status).toBe('rejected');
    expect(wCheck.rows[0].review_note).toBe('Insufficient documentation');
    expect(wCheck.rows[0].reviewed_by).toBe(adminUserId);

    // Verify wallet funds unlocked (locked_balance decreased, available_balance increased)
    const walletAfter = await walletService.getBalance(testUserId, 'real');
    expect(new Decimal(walletAfter.balance).toNumber()).toBe(new Decimal(walletBefore.balance).toNumber());
    expect(new Decimal(walletAfter.locked_balance).toNumber()).toBe(new Decimal(walletBefore.locked_balance).minus(4000).toNumber());
    expect(new Decimal(walletAfter.available_balance).toNumber()).toBe(new Decimal(walletBefore.available_balance).plus(4000).toNumber());
  });
});
