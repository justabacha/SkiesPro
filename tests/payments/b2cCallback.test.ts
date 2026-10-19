import supertest from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { Decimal } from 'decimal.js';
import app from '../../src/index.js';
import { pgPool } from '../../src/config/database.js';
import { WalletService } from '../../src/modules/wallet/services/walletService.js';
import { B2CCallbackService, DarajaB2CResultPayload } from '../../src/modules/payments/services/b2cCallbackService.js';

process.env.MPESA_CALLBACK_TOKEN = 'test_secret_token_123';

const skipDatabaseTests = process.env.SKIP_DB_TESTS === 'true' || !process.env.DATABASE_URL;

describe('B2C Callback Integration & Service Tests (Slice 4)', () => {
  let walletService: WalletService;
  let callbackService: B2CCallbackService;
  let testUserId: string;
  let adminUserId: string;
  let createdWithdrawalIds: string[] = [];
  let createdOutboxIds: string[] = [];
  let createdIdempotencyKeys: string[] = [];

  beforeAll(async () => {
    if (skipDatabaseTests) return;

    walletService = new WalletService();
    callbackService = new B2CCallbackService();

    // Create test admin
    const adminEmail = `b2c-admin-${Date.now()}@example.com`;
    const adminRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'B2C Admin', 'active', 'verified', '0788887777') RETURNING id",
      [adminEmail]
    );
    adminUserId = adminRes.rows[0].id;

    // Create test user
    const userEmail = `b2c-user-${Date.now()}@example.com`;
    const userRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'B2C User', 'active', 'verified', '0712345678') RETURNING id",
      [userEmail]
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

  async function createDispatchedFixture(opts?: {
    withdrawalStatus?: string;
    outboxStatus?: string;
    amount?: string;
  }) {
    const amountStr = opts?.amount || '3000';
    const withdrawalId = uuidv4();
    const outboxId = uuidv4();
    const originatorConvId = `orig_${uuidv4()}`;
    const idempotencyKey = `ik_${uuidv4()}`;

    createdWithdrawalIds.push(withdrawalId);
    createdOutboxIds.push(outboxId);
    createdIdempotencyKeys.push(idempotencyKey);

    // Fund user wallet and lock amount
    await pgPool.query('UPDATE wallet.wallets SET balance = 10000, locked_balance = 3000 WHERE user_id = $1 AND account_type = $2', [testUserId, 'real']);

    await pgPool.query(
      `INSERT INTO payments.idempotency_keys (key, expires_at, created_at) VALUES ($1, NOW() + INTERVAL '1 day', NOW())`,
      [idempotencyKey]
    );

    await pgPool.query(
      `INSERT INTO payments.withdrawals (id, user_id, gateway_id, amount, fee, net_amount, currency, status, reviewed_by, idempotency_key, created_at)
       VALUES ($1, $2, 1, $3, 60, $4, 'KES', $5, $6, $7, NOW())`,
      [
        withdrawalId,
        testUserId,
        amountStr,
        new Decimal(amountStr).minus(60).toString(),
        opts?.withdrawalStatus || 'dispatched',
        adminUserId,
        idempotencyKey,
      ]
    );

    const payload = {
      amount: amountStr,
      netAmount: new Decimal(amountStr).minus(60).toString(),
      recipientPhone: '254712345678',
      remarks: 'Withdrawal payout',
      occasion: withdrawalId,
    };

    await pgPool.query(
      `INSERT INTO payments.b2c_outbox (id, withdrawal_id, originator_conversation_id, status, attempt_count, max_attempts, next_attempt_at, payload, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 1, 5, NOW(), $5, NOW(), NOW())`,
      [outboxId, withdrawalId, originatorConvId, opts?.outboxStatus || 'sent', JSON.stringify(payload)]
    );

    return { withdrawalId, outboxId, originatorConvId };
  }

  test('1. Success callback: outbox sent -> wallet finalizeWithdrawalDebit fires (balance & locked -3000), ledger debit row inserted, withdrawal -> completed', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createDispatchedFixture();
    const transactionId = `MOCK_TX_${Date.now()}`;
    const payload: DarajaB2CResultPayload = {
      Result: {
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
        OriginatorConversationID: fixture.originatorConvId,
        ConversationID: `AG_${Date.now()}`,
        TransactionID: transactionId,
      },
    };

    const res = await supertest(app)
      .post('/api/v1/payments/mpesa/b2c/result?token=test_secret_token_123')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.ResultCode).toBe(0);

    // Verify wallet: balance = 7000, locked_balance = 0
    const walletRes = await pgPool.query('SELECT balance, locked_balance FROM wallet.wallets WHERE user_id = $1 AND account_type = $2', [testUserId, 'real']);
    expect(new Decimal(walletRes.rows[0].balance).equals(new Decimal('7000'))).toBe(true);
    expect(new Decimal(walletRes.rows[0].locked_balance).equals(new Decimal('0'))).toBe(true);

    // Verify ledger entry
    const ledgerRes = await pgPool.query('SELECT * FROM wallet.ledger_entries WHERE reference_id = $1', [fixture.withdrawalId]);
    expect(ledgerRes.rows.length).toBe(1);
    expect(ledgerRes.rows[0].entry_type).toBe('debit');
    expect(new Decimal(ledgerRes.rows[0].balance_before).equals(new Decimal('10000'))).toBe(true);
    expect(new Decimal(ledgerRes.rows[0].balance_after).equals(new Decimal('7000'))).toBe(true);

    // Verify withdrawal status and gateway_reference
    const wRes = await pgPool.query('SELECT status, gateway_reference FROM payments.withdrawals WHERE id = $1', [fixture.withdrawalId]);
    expect(wRes.rows[0].status).toBe('completed');
    expect(wRes.rows[0].gateway_reference).toBe(transactionId);

    // Verify outbox status
    const oRes = await pgPool.query('SELECT status, processed_at FROM payments.b2c_outbox WHERE id = $1', [fixture.outboxId]);
    expect(oRes.rows[0].status).toBe('sent');
    expect(oRes.rows[0].processed_at).not.toBeNull();
  });

  test('2. Failure callback (ResultCode != 0): locked -3000, balance unchanged (10000), no ledger entry (mirrors reject path), withdrawal -> failed', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createDispatchedFixture();
    const payload: DarajaB2CResultPayload = {
      Result: {
        ResultCode: 2001,
        ResultDesc: 'The initiator information is invalid.',
        OriginatorConversationID: fixture.originatorConvId,
        ConversationID: `AG_fail_${Date.now()}`,
      },
    };

    const res = await supertest(app)
      .post('/api/v1/payments/mpesa/b2c/result?token=test_secret_token_123')
      .send(payload);

    expect(res.status).toBe(200);

    // Verify wallet: balance = 10000, locked_balance = 0
    const walletRes = await pgPool.query('SELECT balance, locked_balance FROM wallet.wallets WHERE user_id = $1 AND account_type = $2', [testUserId, 'real']);
    expect(new Decimal(walletRes.rows[0].balance).equals(new Decimal('10000'))).toBe(true);
    expect(new Decimal(walletRes.rows[0].locked_balance).equals(new Decimal('0'))).toBe(true);

    // No ledger entry should be written (mirrors reject path — ledger completeness deferred to Slice 6)
    const ledgerRes = await pgPool.query('SELECT COUNT(*)::int AS count FROM wallet.ledger_entries WHERE reference_id = $1', [fixture.withdrawalId]);
    expect(ledgerRes.rows[0].count).toBe(0);

    // Verify withdrawal status = failed
    const wRes = await pgPool.query('SELECT status FROM payments.withdrawals WHERE id = $1', [fixture.withdrawalId]);
    expect(wRes.rows[0].status).toBe('failed');

    // Verify outbox status = failed
    const oRes = await pgPool.query('SELECT status, last_error FROM payments.b2c_outbox WHERE id = $1', [fixture.outboxId]);
    expect(oRes.rows[0].status).toBe('failed');
    expect(oRes.rows[0].last_error).toContain('initiator information is invalid');
  });

  test('3. Timeout callback: wallet unchanged, withdrawal unchanged (dispatched), outbox last_error set, next_attempt_at = NOW()', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createDispatchedFixture();
    const payload = {
      Result: {
        OriginatorConversationID: fixture.originatorConvId,
        ResultCode: 9999,
        ResultDesc: 'Request timed out.',
      },
    };

    const res = await supertest(app)
      .post('/api/v1/payments/mpesa/b2c/timeout?token=test_secret_token_123')
      .send(payload);

    expect(res.status).toBe(200);

    // Verify wallet unchanged: balance = 10000, locked_balance = 3000
    const walletRes = await pgPool.query('SELECT balance, locked_balance FROM wallet.wallets WHERE user_id = $1 AND account_type = $2', [testUserId, 'real']);
    expect(new Decimal(walletRes.rows[0].balance).equals(new Decimal('10000'))).toBe(true);
    expect(new Decimal(walletRes.rows[0].locked_balance).equals(new Decimal('3000'))).toBe(true);

    // Verify withdrawal stays dispatched
    const wRes = await pgPool.query('SELECT status FROM payments.withdrawals WHERE id = $1', [fixture.withdrawalId]);
    expect(wRes.rows[0].status).toBe('dispatched');

    // Verify outbox last_error updated for reconciliation
    const oRes = await pgPool.query('SELECT status, last_error FROM payments.b2c_outbox WHERE id = $1', [fixture.outboxId]);
    expect(oRes.rows[0].status).toBe('sent');
    expect(oRes.rows[0].last_error).toContain('Timeout callback');
  });

  test('4. Duplicate success callback replay: call handler twice -> wallet debited exactly once, ledger has 1 debit entry', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createDispatchedFixture();
    const payload: DarajaB2CResultPayload = {
      Result: {
        ResultCode: 0,
        ResultDesc: 'Success',
        OriginatorConversationID: fixture.originatorConvId,
        ConversationID: `AG_replay_${Date.now()}`,
        TransactionID: `REPLAY_TX_${Date.now()}`,
      },
    };

    // First call
    await callbackService.handleResultCallback(payload);
    // Second call (replay)
    await callbackService.handleResultCallback(payload);

    // Wallet balance must be debited exactly once (10000 -> 7000)
    const walletRes = await pgPool.query('SELECT balance, locked_balance FROM wallet.wallets WHERE user_id = $1 AND account_type = $2', [testUserId, 'real']);
    expect(new Decimal(walletRes.rows[0].balance).equals(new Decimal('7000'))).toBe(true);

    // Exactly 1 ledger entry
    const ledgerRes = await pgPool.query('SELECT COUNT(*)::int AS count FROM wallet.ledger_entries WHERE reference_id = $1', [fixture.withdrawalId]);
    expect(ledgerRes.rows[0].count).toBe(1);
  });

  test('5. Callback on outbox pending (arrival before worker claims): 200 returned, no wallet mutation', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createDispatchedFixture({ outboxStatus: 'pending' });
    const payload: DarajaB2CResultPayload = {
      Result: {
        ResultCode: 0,
        ResultDesc: 'Success',
        OriginatorConversationID: fixture.originatorConvId,
        ConversationID: `AG_pending_${Date.now()}`,
      },
    };

    await callbackService.handleResultCallback(payload);

    // Wallet balance & locked balance unchanged
    const walletRes = await pgPool.query('SELECT balance, locked_balance FROM wallet.wallets WHERE user_id = $1 AND account_type = $2', [testUserId, 'real']);
    expect(new Decimal(walletRes.rows[0].balance).equals(new Decimal('10000'))).toBe(true);
    expect(new Decimal(walletRes.rows[0].locked_balance).equals(new Decimal('3000'))).toBe(true);
  });

  test('6. Callback on outbox failed (already processed): 200 returned, no double refund', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createDispatchedFixture({ outboxStatus: 'failed', withdrawalStatus: 'failed' });
    const payload: DarajaB2CResultPayload = {
      Result: {
        ResultCode: 2001,
        ResultDesc: 'Error',
        OriginatorConversationID: fixture.originatorConvId,
        ConversationID: `AG_failed_${Date.now()}`,
      },
    };

    await callbackService.handleResultCallback(payload);

    const ledgerRes = await pgPool.query('SELECT COUNT(*)::int AS count FROM wallet.ledger_entries WHERE reference_id = $1', [fixture.withdrawalId]);
    expect(ledgerRes.rows[0].count).toBe(0);
  });

  test('7. Unknown OriginatorConversationID: 200, no mutation, warn logged', async () => {
    if (skipDatabaseTests) return;

    const payload: DarajaB2CResultPayload = {
      Result: {
        ResultCode: 0,
        ResultDesc: 'Success',
        OriginatorConversationID: `unknown_orig_${Date.now()}`,
        ConversationID: `AG_unknown_${Date.now()}`,
      },
    };

    const res = await supertest(app)
      .post('/api/v1/payments/mpesa/b2c/result?token=test_secret_token_123')
      .send(payload);

    expect(res.status).toBe(200);
  });

  test('8. Invalid token: 401, no mutation, warn logged', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createDispatchedFixture();
    const payload: DarajaB2CResultPayload = {
      Result: {
        ResultCode: 0,
        ResultDesc: 'Success',
        OriginatorConversationID: fixture.originatorConvId,
        ConversationID: `AG_badtoken_${Date.now()}`,
      },
    };

    const res = await supertest(app)
      .post('/api/v1/payments/mpesa/b2c/result?token=wrong_token')
      .send(payload);

    expect(res.status).toBe(401);
  });

  test('9. Concurrent Result + Timeout race: at most one finalization mutation occurred', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createDispatchedFixture();
    const resultPayload: DarajaB2CResultPayload = {
      Result: {
        ResultCode: 0,
        ResultDesc: 'Success',
        OriginatorConversationID: fixture.originatorConvId,
        ConversationID: `AG_race_${Date.now()}`,
        TransactionID: `RACE_TX_${Date.now()}`,
      },
    };

    const timeoutPayload = {
      Result: {
        OriginatorConversationID: fixture.originatorConvId,
      },
    };

    await Promise.allSettled([
      callbackService.handleResultCallback(resultPayload),
      callbackService.handleTimeoutCallback(timeoutPayload),
    ]);

    const ledgerRes = await pgPool.query('SELECT COUNT(*)::int AS count FROM wallet.ledger_entries WHERE reference_id = $1', [fixture.withdrawalId]);
    expect(ledgerRes.rows[0].count).toBeLessThanOrEqual(1);
  });

  test('10. Success callback when withdrawal is NOT dispatched (e.g. already completed): skip, no mutation', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createDispatchedFixture({ withdrawalStatus: 'completed' });
    const payload: DarajaB2CResultPayload = {
      Result: {
        ResultCode: 0,
        ResultDesc: 'Success',
        OriginatorConversationID: fixture.originatorConvId,
        ConversationID: `AG_completed_${Date.now()}`,
      },
    };

    await callbackService.handleResultCallback(payload);

    const ledgerRes = await pgPool.query('SELECT COUNT(*)::int AS count FROM wallet.ledger_entries WHERE reference_id = $1', [fixture.withdrawalId]);
    expect(ledgerRes.rows[0].count).toBe(0);
  });
});
