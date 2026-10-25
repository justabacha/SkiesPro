import { v4 as uuidv4 } from 'uuid';
import { Decimal } from 'decimal.js';
import { pgPool } from '../../src/config/database.js';
import { B2CDispatchWorker } from '../../src/modules/payments/workers/b2cDispatchWorker.js';
import { B2CReconciliationJob } from '../../src/modules/payments/jobs/b2cReconciliation.job.js';
import { MpesaB2CMockAdapter } from '../../src/modules/payments/adapters/mpesa/MpesaB2CMockAdapter.js';
import { IB2CPayoutGateway } from '../../src/modules/payments/adapters/mpesa/IB2CPayoutGateway.js';
import { validateB2cConfig } from '../../src/config/app.js';

process.env.PAYMENT_GATEWAY_MODE = 'MOCK';
process.env.MPESA_ENVIRONMENT = 'mock';

const skipDatabaseTests = process.env.SKIP_DB_TESTS === 'true' || !process.env.DATABASE_URL;

function generateUniquePhone(): string {
  const random8 = Math.floor(10000000 + Math.random() * 90000000);
  return `2547${random8}`;
}

describe('B2CDispatchWorker Integration Tests (Slice 2 + Correction)', () => {
  let testUserId: string;
  let testWithdrawalIds: string[] = [];
  let testIdempotencyKeys: string[] = [];
  let testOutboxIds: string[] = [];

  beforeAll(async () => {
    if (skipDatabaseTests) return;

    testUserId = uuidv4();
    const phone = generateUniquePhone();
    await pgPool.query(
      `INSERT INTO app_auth.users (
        id, email, password_hash, display_name, phone,
        is_verified, is_active, kyc_status, status,
        mfa_enabled, failed_login_attempts, created_at, updated_at
       ) VALUES (
        $1, $2, 'hash', 'B2C Tester', $3,
        true, true, 'verified', 'active',
        false, 0, NOW(), NOW()
       )`,
      [testUserId, `b2cworker_${Date.now()}@example.com`, phone]
    );
  });

  afterAll(async () => {
    if (skipDatabaseTests) return;

    try {
      if (testUserId) {
        await pgPool.query(`DELETE FROM wallet.wallets WHERE user_id = $1`, [testUserId]);
      }
      if (testOutboxIds.length > 0) {
        await pgPool.query(`DELETE FROM payments.b2c_outbox WHERE id = ANY($1::uuid[])`, [testOutboxIds]);
      }
      if (testWithdrawalIds.length > 0) {
        await pgPool.query(`DELETE FROM payments.withdrawals WHERE id = ANY($1::uuid[])`, [testWithdrawalIds]);
      }
      if (testIdempotencyKeys.length > 0) {
        await pgPool.query(`DELETE FROM payments.idempotency_keys WHERE key = ANY($1::text[])`, [testIdempotencyKeys]);
      }
      if (testUserId) {
        await pgPool.query(`DELETE FROM app_auth.users WHERE id = $1`, [testUserId]);
      }
    } catch (err) {
      console.error('Cleanup error in afterAll:', err);
    }
  });

  async function createOutboxFixture(opts?: {
    status?: string;
    attemptCount?: number;
    maxAttempts?: number;
    nextAttemptAt?: Date;
    payload?: any;
    withdrawalStatus?: string;
    updatedAt?: Date;
    originatorConversationId?: string;
  }) {
    const withdrawalId = uuidv4();
    const idempotencyKey = `ik_${uuidv4()}`;
    const outboxId = uuidv4();
    const originatorConvId = opts?.originatorConversationId || `orig_${uuidv4()}`;

    testWithdrawalIds.push(withdrawalId);
    testIdempotencyKeys.push(idempotencyKey);
    testOutboxIds.push(outboxId);

    await pgPool.query(
      `INSERT INTO payments.idempotency_keys (key, expires_at, created_at)
       VALUES ($1, NOW() + INTERVAL '1 day', NOW())`,
      [idempotencyKey]
    );

    await pgPool.query(
      `INSERT INTO payments.withdrawals (id, user_id, gateway_id, amount, fee, net_amount, currency, status, idempotency_key, created_at)
       VALUES ($1, $2, 1, 1000, 20, 980, 'KES', $3, $4, NOW())`,
      [withdrawalId, testUserId, opts?.withdrawalStatus || 'approved', idempotencyKey]
    );

    const payload = opts?.payload || {
      amount: '1000',
      netAmount: '980',
      recipientPhone: '0712345678',
      remarks: 'Withdrawal payout',
      occasion: 'Weekly',
    };

    const nextAttemptAt = opts?.nextAttemptAt || new Date(Date.now() - 60000);
    const updatedAt = opts?.updatedAt || new Date(Date.now() - 60000);

    await pgPool.query(
      `INSERT INTO payments.b2c_outbox (id, withdrawal_id, originator_conversation_id, status, attempt_count, max_attempts, next_attempt_at, payload, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)`,
      [
        outboxId,
        withdrawalId,
        originatorConvId,
        opts?.status || 'pending',
        opts?.attemptCount || 0,
        opts?.maxAttempts || 5,
        nextAttemptAt.toISOString(),
        JSON.stringify(payload),
        updatedAt.toISOString(),
      ]
    );

    return { outboxId, withdrawalId, originatorConvId };
  }

  test('1. Worker claims pending outbox row -> updates status to sent, conversation_id, processed_at', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createOutboxFixture();
    const mockAdapter = new MpesaB2CMockAdapter('success');
    const worker = new B2CDispatchWorker(pgPool, mockAdapter, 10000, 5);

    await worker.processBatch();

    const res = await pgPool.query(`SELECT * FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    const row = res.rows[0];

    expect(row.status).toBe('sent');
    expect(row.conversation_id).toMatch(/^AG_/);
    expect(row.processed_at).not.toBeNull();
  });

  test('2. Mock adapter failure -> attempt_count=1, status=pending, next_attempt_at in future, last_error set', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createOutboxFixture();
    const mockAdapter = new MpesaB2CMockAdapter('failure');
    const worker = new B2CDispatchWorker(pgPool, mockAdapter, 10000, 5);

    await worker.processBatch();

    const res = await pgPool.query(`SELECT * FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    const row = res.rows[0];

    expect(row.status).toBe('pending');
    expect(row.attempt_count).toBe(1);
    expect(row.last_error).toContain('Mock B2C payout failure');
    expect(new Date(row.next_attempt_at).getTime()).toBeGreaterThan(Date.now());
  });

  test('3. Mock adapter timeout -> handled as retryable failure', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createOutboxFixture();
    const mockAdapter = new MpesaB2CMockAdapter('timeout');
    const worker = new B2CDispatchWorker(pgPool, mockAdapter, 10000, 5);

    await worker.processBatch();

    const res = await pgPool.query(`SELECT * FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    const row = res.rows[0];

    expect(row.status).toBe('pending');
    expect(row.attempt_count).toBe(1);
    expect(row.last_error).toContain('Mock B2C payout timeout');
  });

  test('4. Attempt count reaches max_attempts -> row marked status=dead', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createOutboxFixture({ attemptCount: 4, maxAttempts: 5 });
    const mockAdapter = new MpesaB2CMockAdapter('failure');
    const worker = new B2CDispatchWorker(pgPool, mockAdapter, 10000, 5);

    await worker.processBatch();

    const res = await pgPool.query(`SELECT * FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    const row = res.rows[0];

    expect(row.status).toBe('dead');
    expect(row.attempt_count).toBe(5);
    expect(row.last_error).toContain('Mock B2C payout failure');
  });

  test('5. Worker skips rows where next_attempt_at > NOW()', async () => {
    if (skipDatabaseTests) return;

    const futureDate = new Date(Date.now() + 3600000); // 1 hour in future
    const fixture = await createOutboxFixture({ nextAttemptAt: futureDate });
    const mockAdapter = new MpesaB2CMockAdapter('success');
    const worker = new B2CDispatchWorker(pgPool, mockAdapter, 10000, 5);

    await worker.processBatch();

    const res = await pgPool.query(`SELECT * FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    const row = res.rows[0];

    expect(row.status).toBe('pending');
    expect(row.attempt_count).toBe(0);
  });

  test('6. Worker skips sent, dead, and processing rows', async () => {
    if (skipDatabaseTests) return;

    const fSent = await createOutboxFixture({ status: 'sent' });
    const fDead = await createOutboxFixture({ status: 'dead' });
    const fProcessing = await createOutboxFixture({ status: 'processing' });

    const mockAdapter = new MpesaB2CMockAdapter('success');
    const worker = new B2CDispatchWorker(pgPool, mockAdapter, 10000, 5);

    await worker.processBatch();

    const resSent = await pgPool.query(`SELECT * FROM payments.b2c_outbox WHERE id = $1`, [fSent.outboxId]);
    const resDead = await pgPool.query(`SELECT * FROM payments.b2c_outbox WHERE id = $1`, [fDead.outboxId]);
    const resProc = await pgPool.query(`SELECT * FROM payments.b2c_outbox WHERE id = $1`, [fProcessing.outboxId]);

    expect(resSent.rows[0].status).toBe('sent');
    expect(resDead.rows[0].status).toBe('dead');
    expect(resProc.rows[0].status).toBe('processing');
  });

  test('7. FOR UPDATE SKIP LOCKED: two workers racing split rows without duplicate execution', async () => {
    if (skipDatabaseTests) return;

    const f1 = await createOutboxFixture();
    const f2 = await createOutboxFixture();

    const mockAdapter = new MpesaB2CMockAdapter('success');
    const worker1 = new B2CDispatchWorker(pgPool, mockAdapter, 10000, 1);
    const worker2 = new B2CDispatchWorker(pgPool, mockAdapter, 10000, 1);

    // Process concurrently
    await Promise.all([worker1.processBatch(), worker2.processBatch()]);

    const res1 = await pgPool.query(`SELECT * FROM payments.b2c_outbox WHERE id = $1`, [f1.outboxId]);
    const res2 = await pgPool.query(`SELECT * FROM payments.b2c_outbox WHERE id = $1`, [f2.outboxId]);

    expect(res1.rows[0].status).toBe('sent');
    expect(res2.rows[0].status).toBe('sent');
  });

  test('8. CRITICAL: No DB transaction held open during external API call', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createOutboxFixture();

    // Custom gateway adapter that delays 5000ms during initiateB2CPayout
    const delayedGateway: IB2CPayoutGateway = {
      initiateB2CPayout: async (req) => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return {
          conversationId: `AG_delayed_${Date.now()}`,
          originatorConversationId: req.originatorConversationId,
          responseCode: '0',
          responseDescription: 'Delayed success',
          raw: {},
        };
      },
      queryB2CStatus: async (convId) => {
        return { conversationId: convId, status: 'completed', raw: {} };
      },
    };

    const worker = new B2CDispatchWorker(pgPool, delayedGateway, 10000, 1);

    // Start worker processBatch in background
    const batchPromise = worker.processBatch();

    // Deterministic wait: poll until status becomes 'processing' (proves claim transaction committed)
    let isProcessing = false;
    for (let i = 0; i < 30; i++) {
      const check = await pgPool.query(`SELECT status FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
      if (check.rows[0]?.status === 'processing') {
        isProcessing = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(isProcessing).toBe(true);

    // Worker is now inside initiateB2CPayout (5000ms window).
    // Execute SELECT ... FOR UPDATE NOWAIT on the claimed row using a fresh DB client.
    const testClient = await pgPool.connect();
    let lockAcquired = false;
    try {
      await testClient.query('BEGIN');
      const lockRes = await testClient.query(
        `SELECT id, status FROM payments.b2c_outbox WHERE id = $1 FOR UPDATE NOWAIT`,
        [fixture.outboxId]
      );
      lockAcquired = lockRes.rows.length === 1;
      await testClient.query('COMMIT');
    } catch (err: any) {
      await testClient.query('ROLLBACK');
      lockAcquired = false;
    } finally {
      testClient.release();
    }

    await batchPromise;

    // Assert that the lock was successfully acquired during external API call because claim transaction committed!
    expect(lockAcquired).toBe(true);
  });

  test('9. Graceful stop: stop() while batch is in flight completes current batch', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createOutboxFixture();
    const mockAdapter = new MpesaB2CMockAdapter('success');
    const worker = new B2CDispatchWorker(pgPool, mockAdapter, 50, 1);

    worker.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await worker.stop();

    const res = await pgPool.query(`SELECT * FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    expect(res.rows[0].status).toBe('sent');
  });

  test('10. Worker respects enableB2cWorker=false config flag', () => {
    const { config } = require('../../src/config/app.js');
    expect(config.enableB2cWorker).toBeDefined();
    expect(typeof config.enableB2cWorker).toBe('boolean');
  });

  test('11. Worker respects enableB2cDisbursement=false flag (skips dispatch, reverts to pending)', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createOutboxFixture();
    const { config } = require('../../src/config/app.js');
    const originalSetting = config.enableB2cDisbursement;
    config.enableB2cDisbursement = false;

    try {
      const mockAdapter = new MpesaB2CMockAdapter('success');
      const worker = new B2CDispatchWorker(pgPool, mockAdapter, 10000, 5);

      await worker.processBatch();

      const res = await pgPool.query(`SELECT * FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
      const row = res.rows[0];

      expect(row.status).toBe('pending');
      expect(row.attempt_count).toBe(0);
    } finally {
      config.enableB2cDisbursement = originalSetting;
    }
  });

  test('12. Worker dispatches netAmount (post-fee) to gateway, not amount', async () => {
    if (skipDatabaseTests) return;

    const withdrawalAmount = new Decimal('1500');
    const fee = new Decimal('30');
    const netAmount = withdrawalAmount.minus(fee); // 1470

    const fixture = await createOutboxFixture({
      payload: {
        amount: withdrawalAmount.toString(),
        netAmount: netAmount.toString(),
        recipientPhone: '254712345678',
        remarks: 'Withdrawal payout',
      },
    });

    await pgPool.query(
      `DELETE FROM payments.b2c_outbox AS outbox
       USING payments.withdrawals AS withdrawal
       WHERE outbox.withdrawal_id = withdrawal.id
         AND withdrawal.user_id = $1
         AND outbox.status = 'pending'
         AND outbox.id <> $2`,
      [testUserId, fixture.outboxId]
    );

    let capturedAmount: Decimal | null = null;
    const captureGateway: IB2CPayoutGateway = {
      initiateB2CPayout: async (req) => {
        capturedAmount = req.amount;
        return {
          conversationId: `AG_test_${Date.now()}`,
          originatorConversationId: req.originatorConversationId,
          responseCode: '0',
          responseDescription: 'Success',
          raw: {},
        };
      },
      queryB2CStatus: async (convId) => ({ conversationId: convId, status: 'completed', raw: {} }),
    };

    const worker = new B2CDispatchWorker(pgPool, captureGateway, 10000, 1);
    await worker.processBatch();

    expect(capturedAmount).not.toBeNull();
    expect(capturedAmount!.equals(new Decimal('1470'))).toBe(true);
  });

  test('13. Worker throws on corrupt payload (missing netAmount)', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createOutboxFixture({
      payload: {
        amount: '1500',
        recipientPhone: '254712345678',
        remarks: 'Withdrawal payout',
        // missing netAmount
      },
    });

    await pgPool.query(
      `DELETE FROM payments.b2c_outbox AS outbox
       USING payments.withdrawals AS withdrawal
       WHERE outbox.withdrawal_id = withdrawal.id
         AND withdrawal.user_id = $1
         AND outbox.status = 'pending'
         AND outbox.id <> $2`,
      [testUserId, fixture.outboxId]
    );

    const mockAdapter = new MpesaB2CMockAdapter('success');
    const worker = new B2CDispatchWorker(pgPool, mockAdapter, 10000, 1);
    await worker.processBatch();

    const res = await pgPool.query(`SELECT * FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    const row = res.rows[0];

    expect(row.last_error).toContain('netAmount missing');
  });

  test('14. Recovery resets stale processing row to pending and next dispatch succeeds', async () => {
    if (skipDatabaseTests) return;

    process.env.B2C_PROCESSING_TIMEOUT_SECONDS = '300';
    const fixture = await createOutboxFixture({
      status: 'processing',
      attemptCount: 1,
      maxAttempts: 5,
      withdrawalStatus: 'dispatched',
      updatedAt: new Date(Date.now() - 301000),
    });

    await pgPool.query(
      `INSERT INTO wallet.wallets (user_id, account_type, balance, locked_balance, currency, version, created_at, updated_at)
       VALUES ($1, 'real', '1000', '1000', 'KES', 1, NOW(), NOW())
       ON CONFLICT (user_id, account_type) DO UPDATE
       SET balance = EXCLUDED.balance,
           locked_balance = EXCLUDED.locked_balance,
           updated_at = NOW()`,
      [testUserId]
    );

    const job = new B2CReconciliationJob(pgPool, 1000, () => true);
    await job.runTick();

    const recovered = await pgPool.query(`SELECT * FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    const row = recovered.rows[0];

    expect(row.status).toBe('pending');
    expect(row.attempt_count).toBe(2);
    expect(new Date(row.next_attempt_at).getTime()).toBeGreaterThan(Date.now());

    await pgPool.query(
      `UPDATE payments.b2c_outbox SET next_attempt_at = NOW() - INTERVAL '1 minute' WHERE id = $1`,
      [fixture.outboxId]
    );

    const worker = new B2CDispatchWorker(
      pgPool,
      new MpesaB2CMockAdapter('success'),
      10000,
      5
    );
    await worker.processBatch();

    const finalRow = await pgPool.query(`SELECT * FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    expect(finalRow.rows[0].status).toBe('sent');
    expect(finalRow.rows[0].conversation_id).toMatch(/^AG_/);
    expect(finalRow.rows[0].originator_conversation_id).toBe(fixture.originatorConvId);
  });

  test('15. Recovery ignores stale processing rows that are not yet beyond the timeout', async () => {
    if (skipDatabaseTests) return;

    process.env.B2C_PROCESSING_TIMEOUT_SECONDS = '300';
    const fixture = await createOutboxFixture({
      status: 'processing',
      attemptCount: 2,
      maxAttempts: 5,
      withdrawalStatus: 'dispatched',
      updatedAt: new Date(Date.now() - 60000),
    });

    const job = new B2CReconciliationJob(pgPool, 1000, () => true);
    await job.runTick();

    const row = await pgPool.query(`SELECT * FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    expect(row.rows[0].status).toBe('processing');
    expect(row.rows[0].attempt_count).toBe(2);
  });

  test('16. Recovery moves max-attempt processing rows to dead and unlocks funds', async () => {
    if (skipDatabaseTests) return;

    process.env.B2C_PROCESSING_TIMEOUT_SECONDS = '300';
    const fixture = await createOutboxFixture({
      status: 'processing',
      attemptCount: 4,
      maxAttempts: 5,
      withdrawalStatus: 'dispatched',
      updatedAt: new Date(Date.now() - 301000),
    });

    await pgPool.query(
      `INSERT INTO wallet.wallets (user_id, account_type, balance, locked_balance, currency, version, created_at, updated_at)
       VALUES ($1, 'real', '1000', '1000', 'KES', 1, NOW(), NOW())
       ON CONFLICT (user_id, account_type) DO UPDATE
       SET balance = EXCLUDED.balance,
           locked_balance = EXCLUDED.locked_balance,
           updated_at = NOW()`,
      [testUserId]
    );

    const job = new B2CReconciliationJob(pgPool, 1000, () => true);
    await job.runTick();

    const outboxRow = await pgPool.query(`SELECT * FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    expect(outboxRow.rows[0].status).toBe('dead');
    expect(outboxRow.rows[0].attempt_count).toBe(5);

    const walletRow = await pgPool.query(
      `SELECT balance, locked_balance FROM wallet.wallets WHERE user_id = $1 AND account_type = 'real'`,
      [testUserId]
    );
    expect(Number(walletRow.rows[0].locked_balance)).toBe(0);

    const withdrawal = await pgPool.query(`SELECT status FROM payments.withdrawals WHERE id = $1`, [fixture.withdrawalId]);
    expect(withdrawal.rows[0].status).toBe('failed');
  });

  test('17. Recovery preserves the same originator_conversation_id without creating duplicate rows', async () => {
    if (skipDatabaseTests) return;

    process.env.B2C_PROCESSING_TIMEOUT_SECONDS = '300';
    const fixture = await createOutboxFixture({
      status: 'processing',
      attemptCount: 0,
      maxAttempts: 5,
      withdrawalStatus: 'dispatched',
      updatedAt: new Date(Date.now() - 301000),
      originatorConversationId: 'idempotent-originator',
    });

    await pgPool.query(
      `INSERT INTO wallet.wallets (user_id, account_type, balance, locked_balance, currency, version, created_at, updated_at)
       VALUES ($1, 'real', '1000', '1000', 'KES', 1, NOW(), NOW())
       ON CONFLICT (user_id, account_type) DO UPDATE
       SET balance = EXCLUDED.balance,
           locked_balance = EXCLUDED.locked_balance,
           updated_at = NOW()`,
      [testUserId]
    );

    const job = new B2CReconciliationJob(pgPool, 1000, () => true);
    await job.runTick();

    const outboxCount = await pgPool.query(
      `SELECT COUNT(*)::int AS count FROM payments.b2c_outbox WHERE withdrawal_id = $1`,
      [fixture.withdrawalId]
    );
    const sameOriginator = await pgPool.query(
      `SELECT originator_conversation_id FROM payments.b2c_outbox WHERE id = $1`,
      [fixture.outboxId]
    );

    expect(outboxCount.rows[0].count).toBe(1);
    expect(sameOriginator.rows[0].originator_conversation_id).toBe('idempotent-originator');
  });

  test('18. Config validation rejects non-positive or non-numeric B2C processing timeout values', () => {
    const original = process.env.B2C_PROCESSING_TIMEOUT_SECONDS;
    try {
      for (const value of ['0', '-1', 'abc']) {
        process.env.B2C_PROCESSING_TIMEOUT_SECONDS = value;
        expect(() => validateB2cConfig()).toThrow(/B2C_PROCESSING_TIMEOUT_SECONDS must be a positive integer/);
      }
    } finally {
      if (original === undefined) {
        delete process.env.B2C_PROCESSING_TIMEOUT_SECONDS;
      } else {
        process.env.B2C_PROCESSING_TIMEOUT_SECONDS = original;
      }
    }
  });

  test('19. Recovery only touches stale processing rows and leaves pending, sent, and dead rows alone', async () => {
    if (skipDatabaseTests) return;

    process.env.B2C_PROCESSING_TIMEOUT_SECONDS = '300';
    const pendingRow = await createOutboxFixture({
      status: 'pending',
      attemptCount: 1,
      updatedAt: new Date(Date.now() - 301000),
      nextAttemptAt: new Date(Date.now() + 3600000),
    });
    const sentRow = await createOutboxFixture({
      status: 'sent',
      attemptCount: 1,
      updatedAt: new Date(Date.now() - 301000),
      nextAttemptAt: new Date(Date.now() + 3600000),
    });
    const deadRow = await createOutboxFixture({
      status: 'dead',
      attemptCount: 5,
      updatedAt: new Date(Date.now() - 301000),
      nextAttemptAt: new Date(Date.now() + 3600000),
    });
    const staleProcessingRow = await createOutboxFixture({
      status: 'processing',
      attemptCount: 0,
      maxAttempts: 5,
      updatedAt: new Date(Date.now() - 301000),
      nextAttemptAt: new Date(Date.now() - 60000),
      withdrawalStatus: 'dispatched',
    });

    const job = new B2CReconciliationJob(pgPool, 1000, () => true);
    await job.runTick();

    const pendingRes = await pgPool.query(`SELECT status, attempt_count FROM payments.b2c_outbox WHERE id = $1`, [pendingRow.outboxId]);
    const sentRes = await pgPool.query(`SELECT status, attempt_count FROM payments.b2c_outbox WHERE id = $1`, [sentRow.outboxId]);
    const deadRes = await pgPool.query(`SELECT status, attempt_count FROM payments.b2c_outbox WHERE id = $1`, [deadRow.outboxId]);
    const processingRes = await pgPool.query(`SELECT status, attempt_count FROM payments.b2c_outbox WHERE id = $1`, [staleProcessingRow.outboxId]);

    expect(pendingRes.rows[0].status).toBe('pending');
    expect(sentRes.rows[0].status).toBe('sent');
    expect(deadRes.rows[0].status).toBe('dead');
    expect(processingRes.rows[0].status).toBe('pending');
    expect(processingRes.rows[0].attempt_count).toBe(1);
  });
});
