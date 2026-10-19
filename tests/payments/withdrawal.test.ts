import { PaymentService } from '../../src/modules/payments/services/paymentService.js';
import { WalletService } from '../../src/modules/wallet/services/walletService.js';
import { AdminComplianceService } from '../../src/modules/admin/services/AdminComplianceService.js';
import { pgPool } from '../../src/config/database.js';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

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
    const adminRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Test Admin', 'active', 'verified', '0788888888') RETURNING id",
      [adminEmail]
    );
    adminUserId = adminRes.rows[0].id;

    // Create a test user with verified KYC and valid phone
    const email = `test-withdrawal-${Date.now()}@example.com`;
    const res = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Test Withdrawal', 'active', 'verified', '0712345678') RETURNING id",
      [email]
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
    const res = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Unverified', 'active', 'unverified', '0799999999') RETURNING id",
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
    expect(new Decimal(result.fee).equals(new Decimal('40'))).toBe(true);
    expect(new Decimal(result.net_amount).equals(new Decimal('1960'))).toBe(true);
  });

  it('should approve withdrawal successfully (Slice 3: sets status to dispatched, enqueues b2c_outbox, leaves wallet unchanged)', async () => {
    const amount = '2000';
    const idempotencyKey = uuidv4();
    usedKeys.push(idempotencyKey);

    const withdrawalReq = await paymentService.requestWithdrawal(testUserId, {
      amount,
      currency: 'KES',
      gateway_id: 1,
      phone: '+254700000000'
    }, idempotencyKey);

    const walletBefore = await walletService.getBalance(testUserId, 'real');

    const approvalRes = await adminService.approveWithdrawal(withdrawalReq.id, adminUserId, 'Approved for payout');
    expect(approvalRes.status).toBe('dispatched');

    // Verify withdrawal status is dispatched
    const wCheck = await pgPool.query('SELECT status FROM payments.withdrawals WHERE id = $1', [withdrawalReq.id]);
    expect(wCheck.rows[0].status).toBe('dispatched');

    // Verify wallet balance and locked_balance UNCHANGED from before approve
    const walletAfter = await walletService.getBalance(testUserId, 'real');
    expect(new Decimal(walletAfter.balance).equals(new Decimal(walletBefore.balance))).toBe(true);
    expect(new Decimal(walletAfter.locked_balance).equals(new Decimal(walletBefore.locked_balance))).toBe(true);

    // Verify one new b2c_outbox row created with correct payload
    const outboxRes = await pgPool.query('SELECT * FROM payments.b2c_outbox WHERE withdrawal_id = $1', [withdrawalReq.id]);
    expect(outboxRes.rows.length).toBe(1);
    const outboxRow = outboxRes.rows[0];
    expect(outboxRow.status).toBe('pending');
    const payload = typeof outboxRow.payload === 'string' ? JSON.parse(outboxRow.payload) : outboxRow.payload;
    expect(payload.amount).toBe('2000');
    expect(payload.netAmount).toBe('1960');
    expect(payload.recipientPhone).toBe('254712345678');
  });

  it('should enforce idempotency on sequential approve calls', async () => {
    const amount = '2000';
    const ik = uuidv4();
    usedKeys.push(ik);

    const wReq = await paymentService.requestWithdrawal(testUserId, {
      amount,
      currency: 'KES',
      gateway_id: 1,
      phone: '+254700000000'
    }, ik);

    await adminService.approveWithdrawal(wReq.id, adminUserId, 'First approve');

    // Second approve should throw because status is no longer 'pending'
    await expect(adminService.approveWithdrawal(wReq.id, adminUserId, 'Second approve')).rejects.toThrow(/status 'dispatched'/);

    // Still exactly one outbox row
    const outboxRes = await pgPool.query('SELECT COUNT(*)::int AS count FROM payments.b2c_outbox WHERE withdrawal_id = $1', [wReq.id]);
    expect(outboxRes.rows[0].count).toBe(1);
  });

  it('should handle concurrent racy approve calls cleanly (only one succeeds, exactly one outbox row)', async () => {
    const amount = '2000';
    const ik = uuidv4();
    usedKeys.push(ik);

    const wReq = await paymentService.requestWithdrawal(testUserId, {
      amount,
      currency: 'KES',
      gateway_id: 1,
      phone: '+254700000000'
    }, ik);

    // Trigger two concurrent approve calls on the same withdrawal ID
    const results = await Promise.allSettled([
      adminService.approveWithdrawal(wReq.id, adminUserId, 'Concurrent 1'),
      adminService.approveWithdrawal(wReq.id, adminUserId, 'Concurrent 2'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

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
    const amount = '2000';
    const ik = uuidv4();
    usedKeys.push(ik);

    const wReq = await paymentService.requestWithdrawal(testUserId, {
      amount,
      currency: 'KES',
      gateway_id: 1,
      phone: '+254700000000'
    }, ik);

    // Artificially set fee = 2000 on the withdrawal row (making netAmount = 0)
    await pgPool.query('UPDATE payments.withdrawals SET fee = 2000, net_amount = 0 WHERE id = $1', [wReq.id]);

    await expect(adminService.approveWithdrawal(wReq.id, adminUserId, 'Zero net amount test')).rejects.toThrow(
      'Invalid withdrawal fee configuration (net amount must be positive)'
    );

    // Verify status remains 'pending'
    const wCheck = await pgPool.query('SELECT status FROM payments.withdrawals WHERE id = $1', [wReq.id]);
    expect(wCheck.rows[0].status).toBe('pending');

    // Verify no outbox row created
    const outboxRes = await pgPool.query('SELECT COUNT(*)::int AS count FROM payments.b2c_outbox WHERE withdrawal_id = $1', [wReq.id]);
    expect(outboxRes.rows[0].count).toBe(0);
  });

  it('should fail approval if locked_balance is less than withdrawal amount', async () => {
    const amount = '2000';
    const ik = uuidv4();
    usedKeys.push(ik);

    const wReq = await paymentService.requestWithdrawal(testUserId, {
      amount,
      currency: 'KES',
      gateway_id: 1,
      phone: '+254700000000'
    }, ik);

    // Get current locked balance
    const currentWallet = await walletService.getBalance(testUserId, 'real');
    const actualLocked = new Decimal(currentWallet.locked_balance);

    // Artificially set wallet locked_balance to 0
    await pgPool.query('UPDATE wallet.wallets SET locked_balance = 0 WHERE user_id = $1 AND account_type = $2', [testUserId, 'real']);

    await expect(adminService.approveWithdrawal(wReq.id, adminUserId, 'Insufficient locked test')).rejects.toThrow(
      'Locked balance is less than withdrawal amount'
    );

    // Verify status remains 'pending'
    const wCheck = await pgPool.query('SELECT status FROM payments.withdrawals WHERE id = $1', [wReq.id]);
    expect(wCheck.rows[0].status).toBe('pending');

    // Verify no outbox row created
    const outboxRes = await pgPool.query('SELECT COUNT(*)::int AS count FROM payments.b2c_outbox WHERE withdrawal_id = $1', [wReq.id]);
    expect(outboxRes.rows[0].count).toBe(0);

    // Restore locked_balance to actualLocked for clean state
    await pgPool.query('UPDATE wallet.wallets SET locked_balance = $1 WHERE user_id = $2 AND account_type = $3', [actualLocked.toString(), testUserId, 'real']);
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

  it('should process withdrawal rejection correctly (refund + ledger + status rejected)', async () => {
    const amount = '2000';
    const ik = uuidv4();
    usedKeys.push(ik);

    const wReq = await paymentService.requestWithdrawal(testUserId, {
      amount,
      currency: 'KES',
      gateway_id: 1,
      phone: '+254700000000'
    }, ik);

    const walletBefore = await walletService.getBalance(testUserId, 'real');

    const rejectRes = await adminService.rejectWithdrawal(wReq.id, adminUserId, 'Rejected by compliance');
    expect(rejectRes.status).toBe('rejected');

    const wCheck = await pgPool.query('SELECT status FROM payments.withdrawals WHERE id = $1', [wReq.id]);
    expect(wCheck.rows[0].status).toBe('rejected');

    const walletAfter = await walletService.getBalance(testUserId, 'real');
    expect(new Decimal(walletAfter.available_balance).equals(new Decimal(walletBefore.available_balance).plus(amount))).toBe(true);
  });
});
