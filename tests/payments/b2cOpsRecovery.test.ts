import { v4 as uuidv4 } from 'uuid';
import { Decimal } from 'decimal.js';
import { pgPool } from '../../src/config/database.js';
import { WalletService } from '../../src/modules/wallet/services/walletService.js';
import { AdminComplianceService } from '../../src/modules/admin/services/AdminComplianceService.js';

const skipDatabaseTests = process.env.SKIP_DB_TESTS === 'true' || !process.env.DATABASE_URL;

function generateUniquePhone(): string {
  const random8 = Math.floor(10000000 + Math.random() * 90000000);
  return `07${random8}`;
}

describe('B2C Ops Recovery Service Tests (Slice 5C & 5D)', () => {
  let walletService: WalletService;
  let complianceService: AdminComplianceService;
  let testUserId: string;
  let adminUserId: string;
  let createdWithdrawalIds: string[] = [];
  let createdOutboxIds: string[] = [];
  let createdIdempotencyKeys: string[] = [];

  beforeAll(async () => {
    if (skipDatabaseTests) return;

    walletService = new WalletService();
    complianceService = new AdminComplianceService();

    // Create test admin
    const adminEmail = `ops-admin-${Date.now()}@example.com`;
    const adminPhone = generateUniquePhone();
    const adminRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Ops Admin', 'active', 'verified', $2) RETURNING id",
      [adminEmail, adminPhone]
    );
    adminUserId = adminRes.rows[0].id;

    // Create test user
    const userEmail = `ops-user-${Date.now()}@example.com`;
    const userPhone = generateUniquePhone();
    const userRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Ops User', 'active', 'verified', $2) RETURNING id",
      [userEmail, userPhone]
    );
    testUserId = userRes.rows[0].id;

    await walletService.createWallet(testUserId, 'real', 'KES');
  });

  afterAll(async () => {
    if (skipDatabaseTests) return;

    if (createdOutboxIds.length > 0) {
      await pgPool.query('DELETE FROM payments.b2c_outbox WHERE id = ANY($1::uuid[])', [createdOutboxIds]);
    }
    if (createdWithdrawalIds.length > 0) {
      await pgPool.query('DELETE FROM payments.withdrawals WHERE id = ANY($1::uuid[])', [createdWithdrawalIds]);
    }
    if (createdIdempotencyKeys.length > 0) {
      await pgPool.query('DELETE FROM payments.idempotency_keys WHERE key = ANY($1::text[])', [createdIdempotencyKeys]);
    }
    if (testUserId) {
      await pgPool.query('DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)', [testUserId]);
      await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = $1', [testUserId]);
      await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [testUserId]);
    }
    if (adminUserId) {
      await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [adminUserId]);
    }
  });

  const setupWalletBalance = async (balance: number, locked: number) => {
    await pgPool.query(
      `UPDATE wallet.wallets
       SET balance = $1, locked_balance = $2, updated_at = NOW()
       WHERE user_id = $3 AND account_type = 'real'`,
      [balance, locked, testUserId]
    );
  };

  const seedWithdrawalAndOutbox = async (
    amount: number,
    status: string,
    outboxStatus: string,
    retryCount: number = 0,
    needsReview: boolean = false
  ) => {
    const idempKey = `idemp-${uuidv4()}`;
    await pgPool.query(
      "INSERT INTO payments.idempotency_keys (key, response) VALUES ($1, '{}'::jsonb) ON CONFLICT DO NOTHING",
      [idempKey]
    );
    createdIdempotencyKeys.push(idempKey);

    const wRes = await pgPool.query(
      `INSERT INTO payments.withdrawals (user_id, gateway_id, amount, fee, net_amount, currency, status, idempotency_key)
       VALUES ($1, 1, $2, 50, $3, 'KES', $4, $5)
       RETURNING id`,
      [testUserId, amount, amount - 50, status, idempKey]
    );
    const withdrawalId = wRes.rows[0].id;
    createdWithdrawalIds.push(withdrawalId);

    const origId = uuidv4();
    const payload = { amount: String(amount), netAmount: String(amount - 50), recipientPhone: '254712345678' };
    const oRes = await pgPool.query(
      `INSERT INTO payments.b2c_outbox (withdrawal_id, originator_conversation_id, status, retry_count, needs_manual_review, payload, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())
       RETURNING id`,
      [withdrawalId, origId, outboxStatus, retryCount, needsReview, JSON.stringify(payload)]
    );
    const outboxId = oRes.rows[0].id;
    createdOutboxIds.push(outboxId);

    return { withdrawalId, outboxId, origId };
  };

  describe('Retry Withdrawal', () => {
    test('successful retry re-locks funds and resets outbox to pending', async () => {
      if (skipDatabaseTests) return;

      // Available 7000, locked 0, balance 7000. Withdrawal 3000.
      await setupWalletBalance(7000, 0);
      const { withdrawalId, outboxId, origId } = await seedWithdrawalAndOutbox(3000, 'failed', 'failed', 0);

      const result = await complianceService.retryWithdrawal(withdrawalId, adminUserId);

      expect(result.status).toBe('dispatched');
      expect(result.retryCount).toBe(1);

      // Verify wallet: available 4000, locked 3000, total balance 7000
      const wallet = await walletService.getBalance(testUserId, 'real');
      expect(new Decimal(wallet.available_balance).toNumber()).toBe(4000);
      expect(new Decimal(wallet.locked_balance).toNumber()).toBe(3000);
      expect(new Decimal(wallet.balance).toNumber()).toBe(7000);

      // Verify outbox reset
      const outboxRes = await pgPool.query('SELECT * FROM payments.b2c_outbox WHERE id = $1', [outboxId]);
      const outboxRow = outboxRes.rows[0];
      expect(outboxRow.status).toBe('pending');
      expect(outboxRow.retry_count).toBe(1);
      expect(outboxRow.originator_conversation_id).not.toBe(origId);
      expect(outboxRow.needs_manual_review).toBe(false);
    });

    test('retry throws when status is pending or completed', async () => {
      if (skipDatabaseTests) return;

      await setupWalletBalance(5000, 1000);
      const { withdrawalId: pendingId } = await seedWithdrawalAndOutbox(1000, 'pending', 'pending');
      await expect(complianceService.retryWithdrawal(pendingId, adminUserId)).rejects.toThrow('Cannot retry withdrawal');

      const { withdrawalId: completedId } = await seedWithdrawalAndOutbox(1000, 'completed', 'sent');
      await expect(complianceService.retryWithdrawal(completedId, adminUserId)).rejects.toThrow('Cannot retry withdrawal');
    });

    test('retry throws when retry_count >= 3', async () => {
      if (skipDatabaseTests) return;

      await setupWalletBalance(5000, 0);
      const { withdrawalId } = await seedWithdrawalAndOutbox(1000, 'failed', 'failed', 3);

      await expect(complianceService.retryWithdrawal(withdrawalId, adminUserId)).rejects.toThrow('Maximum retry limit (3) reached');
    });

    test('retry throws when user available balance is insufficient', async () => {
      if (skipDatabaseTests) return;

      // Available 500 KES, trying to retry 3000 KES
      await setupWalletBalance(500, 0);
      const { withdrawalId } = await seedWithdrawalAndOutbox(3000, 'failed', 'failed', 0);

      await expect(complianceService.retryWithdrawal(withdrawalId, adminUserId)).rejects.toThrow('Insufficient available balance');
    });
  });

  describe('Force Complete Withdrawal', () => {
    test('force-complete from dispatched finalizes debit and sets receipt', async () => {
      if (skipDatabaseTests) return;

      // Balance 5000, locked 2000 (withdrawal amount 2000). Available 3000.
      await setupWalletBalance(5000, 2000);
      const { withdrawalId, outboxId } = await seedWithdrawalAndOutbox(2000, 'dispatched', 'sent', 0, true);

      const mpesaReceipt = 'QGH782103K';
      const result = await complianceService.forceCompleteWithdrawal(withdrawalId, adminUserId, mpesaReceipt, 'Ops verified payout');

      expect(result.status).toBe('completed');
      expect(result.mpesaReceipt).toBe(mpesaReceipt);

      // Wallet check: balance 3000, locked 0, available 3000
      const wallet = await walletService.getBalance(testUserId, 'real');
      expect(new Decimal(wallet.balance).toNumber()).toBe(3000);
      expect(new Decimal(wallet.locked_balance).toNumber()).toBe(0);
      expect(new Decimal(wallet.available_balance).toNumber()).toBe(3000);

      // Withdrawal check
      const wRes = await pgPool.query('SELECT * FROM payments.withdrawals WHERE id = $1', [withdrawalId]);
      expect(wRes.rows[0].status).toBe('completed');
      expect(wRes.rows[0].gateway_reference).toBe(mpesaReceipt);

      // Outbox check
      const oRes = await pgPool.query('SELECT * FROM payments.b2c_outbox WHERE id = $1', [outboxId]);
      expect(oRes.rows[0].needs_manual_review).toBe(false);
      expect(oRes.rows[0].processed_at).not.toBeNull();
    });

    test('force-complete throws when status is not dispatched', async () => {
      if (skipDatabaseTests) return;

      const { withdrawalId } = await seedWithdrawalAndOutbox(1000, 'pending', 'pending');
      await expect(complianceService.forceCompleteWithdrawal(withdrawalId, adminUserId, 'REC123456789')).rejects.toThrow('Cannot force-complete');
    });
  });

  describe('Force Refund Withdrawal', () => {
    test('force-refund unlocks funds and marks withdrawal failed', async () => {
      if (skipDatabaseTests) return;

      // Balance 5000, locked 2000. Available 3000.
      await setupWalletBalance(5000, 2000);
      const { withdrawalId, outboxId } = await seedWithdrawalAndOutbox(2000, 'dispatched', 'sent', 0, true);

      const reason = 'Daraja system error confirmed by support';
      const result = await complianceService.forceRefundWithdrawal(withdrawalId, adminUserId, reason);

      expect(result.status).toBe('failed');
      expect(result.reason).toBe(reason);

      // Wallet check: balance 5000, locked 0, available 5000
      const wallet = await walletService.getBalance(testUserId, 'real');
      expect(new Decimal(wallet.balance).toNumber()).toBe(5000);
      expect(new Decimal(wallet.locked_balance).toNumber()).toBe(0);
      expect(new Decimal(wallet.available_balance).toNumber()).toBe(5000);

      // Withdrawal check
      const wRes = await pgPool.query('SELECT * FROM payments.withdrawals WHERE id = $1', [withdrawalId]);
      expect(wRes.rows[0].status).toBe('failed');

      // Outbox check
      const oRes = await pgPool.query('SELECT * FROM payments.b2c_outbox WHERE id = $1', [outboxId]);
      expect(oRes.rows[0].status).toBe('failed');
      expect(oRes.rows[0].last_error).toBe(reason);
      expect(oRes.rows[0].needs_manual_review).toBe(false);
    });

    test('force-refund throws when status is not dispatched', async () => {
      if (skipDatabaseTests) return;

      const { withdrawalId } = await seedWithdrawalAndOutbox(1000, 'failed', 'failed');
      await expect(complianceService.forceRefundWithdrawal(withdrawalId, adminUserId, 'Reason')).rejects.toThrow('Cannot force-refund');
    });
  });
});
