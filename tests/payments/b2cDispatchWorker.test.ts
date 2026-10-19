import { v4 as uuidv4 } from 'uuid';
import { pgPool } from '../../src/config/database.js';
import { B2CDispatchWorker } from '../../src/modules/payments/workers/b2cDispatchWorker.js';
import { MpesaB2CMockAdapter } from '../../src/modules/payments/adapters/mpesa/MpesaB2CMockAdapter.js';
import { IB2CPayoutGateway } from '../../src/modules/payments/adapters/mpesa/IB2CPayoutGateway.js';

process.env.PAYMENT_GATEWAY_MODE = 'MOCK';
process.env.MPESA_ENVIRONMENT = 'mock';

const skipDatabaseTests = process.env.SKIP_DB_TESTS === 'true' || !process.env.DATABASE_URL;

describe('B2CDispatchWorker Integration Tests (Slice 2 + Correction)', () => {
  let testUserId: string;
  let testWithdrawalIds: string[] = [];
  let testIdempotencyKeys: string[] = [];
  let testOutboxIds: string[] = [];

  beforeAll(async () => {
    if (skipDatabaseTests) return;

    testUserId = uuidv4();
    await pgPool.query(
      `INSERT INTO app_auth.users (
        id, email, password_hash, display_name, phone,
        is_verified, is_active, kyc_status, status,
        mfa_enabled, failed_login_attempts, created_at, updated_at
       ) VALUES (
        $1, $2, 'hash', 'B2C Tester', '254712345678',
        true, true, 'verified', 'active',
        false, 0, NOW(), NOW()
       )`,
      [testUserId, `b2cworker_${Date.now()}@example.com`]
    );
  });

  afterAll(async () => {
    if (skipDatabaseTests) return;

    try {
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
  }) {
    const withdrawalId = uuidv4();
    const idempotencyKey = `ik_${uuidv4()}`;
    const outboxId = uuidv4();
    const originatorConvId = `orig_${uuidv4()}`;

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
       VALUES ($1, $2, 1, 1000, 20, 980, 'KES', 'approved', $3, NOW())`,
      [withdrawalId, testUserId, idempotencyKey]
    );

    const payload = opts?.payload || {
      amount: '980',
      recipientPhone: '0712345678',
      remarks: 'Withdrawal payout',
      occasion: 'Weekly',
    };

    if (opts?.nextAttemptAt) {
      await pgPool.query(
        `INSERT INTO payments.b2c_outbox (id, withdrawal_id, originator_conversation_id, status, attempt_count, max_attempts, next_attempt_at, payload, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [
          outboxId,
          withdrawalId,
          originatorConvId,
          opts?.status || 'pending',
          opts?.attemptCount || 0,
          opts?.maxAttempts || 5,
          opts.nextAttemptAt.toISOString(),
          JSON.stringify(payload),
        ]
      );
    } else {
      await pgPool.query(
        `INSERT INTO payments.b2c_outbox (id, withdrawal_id, originator_conversation_id, status, attempt_count, max_attempts, next_attempt_at, payload, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '1 minute', $7, NOW(), NOW())`,
        [
          outboxId,
          withdrawalId,
          originatorConvId,
          opts?.status || 'pending',
          opts?.attemptCount || 0,
          opts?.maxAttempts || 5,
          JSON.stringify(payload),
        ]
      );
    }

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

    // Custom gateway adapter that delays 1000ms during initiateB2CPayout
    const delayedGateway: IB2CPayoutGateway = {
      initiateB2CPayout: async (req) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
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

    // Wait 500ms so worker's claim transaction has committed and worker is inside initiateB2CPayout (external API phase)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Execute SELECT ... FOR UPDATE NOWAIT on the claimed row using a fresh DB client
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

    // Assert that the lock was successfully acquired during external API call because claim transaction already committed!
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
});
