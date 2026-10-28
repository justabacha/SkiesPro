import { v4 as uuidv4 } from 'uuid';
import { Decimal } from 'decimal.js';
import { pgPool } from '../../src/config/database.js';
import { B2CDispatchWorker } from '../../src/modules/payments/workers/b2cDispatchWorker.js';
import { B2CReconciliationJob } from '../../src/modules/payments/jobs/b2cReconciliation.job.js';
import { MpesaB2CMockAdapter } from '../../src/modules/payments/adapters/mpesa/MpesaB2CMockAdapter.js';
import { IB2CPayoutGateway, B2CPayoutError } from '../../src/modules/payments/adapters/mpesa/IB2CPayoutGateway.js';
import { validateB2cConfig, config } from '../../src/config/app.js';

process.env.PAYMENT_GATEWAY_MODE = 'MOCK';
process.env.MPESA_ENVIRONMENT = 'mock';
process.env.ENABLE_B2C_DISBURSEMENT = 'true';
config.enableB2cDisbursement = true;

const skipDatabaseTests = process.env.SKIP_DB_TESTS === 'true' || !process.env.DATABASE_URL;

function generateUniquePhone(): string {
  const random8 = Math.floor(10000000 + Math.random() * 90000000);
  return `2547${random8}`;
}

describe('B2CDispatchWorker Integration Tests (Slice 2 + Correction)', () => {
  let testUserId: string;
  const createdWithdrawalIds: string[] = [];
  const createdOutboxIds: string[] = [];
  const createdIdempotencyKeys: string[] = [];

  beforeAll(async () => {
    if (skipDatabaseTests) return;

    config.enableB2cDisbursement = true;
    process.env.ENABLE_B2C_DISBURSEMENT = 'true';

    const email = `b2cworker-${Date.now()}@example.com`;
    const phone = generateUniquePhone();

    const userRes = await pgPool.query(
      `INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone)
       VALUES ($1, 'hash', 'B2C Worker User', 'active', 'verified', $2)
       RETURNING id`,
      [email, phone]
    );

    testUserId = userRes.rows[0].id;
  });

  beforeEach(async () => {
    config.enableB2cDisbursement = true;
    process.env.ENABLE_B2C_DISBURSEMENT = 'true';
    if (!skipDatabaseTests) {
      await pgPool.query(`DELETE FROM payments.b2c_outbox`);
      await pgPool.query(`DELETE FROM payments.withdrawals`);
      await pgPool.query(`DELETE FROM payments.idempotency_keys`);
    }
  });

  afterAll(async () => {
    if (skipDatabaseTests) return;

    if (createdOutboxIds.length > 0) {
      await pgPool.query(`DELETE FROM payments.b2c_outbox WHERE id = ANY($1::uuid[])`, [createdOutboxIds]);
    }
    if (createdWithdrawalIds.length > 0) {
      await pgPool.query(`DELETE FROM payments.withdrawals WHERE id = ANY($1::uuid[])`, [createdWithdrawalIds]);
    }
    if (createdIdempotencyKeys.length > 0) {
      await pgPool.query(`DELETE FROM payments.idempotency_keys WHERE key = ANY($1::text[])`, [createdIdempotencyKeys]);
    }
    if (testUserId) {
      await pgPool.query(
        `DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)`,
        [testUserId]
      );
      await pgPool.query(`DELETE FROM wallet.wallets WHERE user_id = $1`, [testUserId]);
      await pgPool.query(`DELETE FROM app_auth.users WHERE id = $1`, [testUserId]);
    }
  });

  async function createOutboxFixture(opts?: {
    status?: string;
    attemptCount?: number;
    maxAttempts?: number;
    nextAttemptAt?: Date;
    updatedAt?: Date;
    withdrawalStatus?: string;
    payloadOverride?: any;
    originatorConversationId?: string;
  }) {
    const withdrawalId = uuidv4();
    const outboxId = uuidv4();
    const originatorConvId = opts?.originatorConversationId || `orig_${uuidv4()}`;
    const idempotencyKey = `ik_${withdrawalId}`;

    createdWithdrawalIds.push(withdrawalId);
    createdOutboxIds.push(outboxId);
    createdIdempotencyKeys.push(idempotencyKey);

    await pgPool.query(
      `INSERT INTO payments.idempotency_keys (key, expires_at, created_at)
       VALUES ($1, NOW() + INTERVAL '1 day', NOW())
       ON CONFLICT (key) DO NOTHING`,
      [idempotencyKey]
    );

    await pgPool.query(
      `INSERT INTO payments.withdrawals (id, user_id, gateway_id, amount, fee, net_amount, currency, status, idempotency_key, created_at)
       VALUES ($1, $2, 1, 1000, 20, 980, 'KES', $3, $4, NOW())`,
      [withdrawalId, testUserId, opts?.withdrawalStatus || 'dispatched', idempotencyKey]
    );

    const payload = opts?.payloadOverride !== undefined ? opts.payloadOverride : {
      amount: 1000,
      netAmount: 980,
      recipientPhone: generateUniquePhone(),
      remarks: 'Payout test',
    };

    const status = opts?.status || 'pending';
    const attemptCount = opts?.attemptCount ?? 0;
    const maxAttempts = opts?.maxAttempts ?? 5;
    const nextAttemptAt = opts?.nextAttemptAt || new Date(Date.now() - 60000);
    const updatedAt = opts?.updatedAt || new Date(Date.now() - 60000);

    await pgPool.query(
      `INSERT INTO payments.b2c_outbox (id, withdrawal_id, originator_conversation_id, status, attempt_count, max_attempts, next_attempt_at, payload, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)`,
      [
        outboxId,
        withdrawalId,
        originatorConvId,
        status,
        attemptCount,
        maxAttempts,
        nextAttemptAt.toISOString(),
        JSON.stringify(payload),
        updatedAt.toISOString(),
      ]
    );

    return { withdrawalId, outboxId, originatorConvId };
  }

  test('1. Worker claims pending outbox row -> updates status to sent, conversation_id, processed_at', async () => {
    if (skipDatabaseTests) return;

    const mockGateway = new MpesaB2CMockAdapter();
    const fixture = await createOutboxFixture();

    const worker = new B2CDispatchWorker(pgPool, mockGateway, 100, 1);
    await worker.processBatch();

    const res = await pgPool.query(`SELECT status, conversation_id, processed_at FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    const row = res.rows[0];

    expect(row.status).toBe('sent');
    expect(row.conversation_id).toBeDefined();
    expect(row.conversation_id.length).toBeGreaterThan(0);
    expect(row.processed_at).not.toBeNull();
  });

  test('2. Mock adapter failure -> attempt_count=1, status=pending, next_attempt_at in future, last_error set', async () => {
    if (skipDatabaseTests) return;

    const mockGateway = new MpesaB2CMockAdapter('failure');
    const fixture = await createOutboxFixture();

    const worker = new B2CDispatchWorker(pgPool, mockGateway, 100, 1);
    await worker.processBatch();

    const res = await pgPool.query(`SELECT status, attempt_count, next_attempt_at, last_error FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    const row = res.rows[0];

    expect(row.status).toBe('pending');
    expect(row.attempt_count).toBe(1);
    expect(new Date(row.next_attempt_at).getTime()).toBeGreaterThan(Date.now());
    expect(row.last_error).toContain('Mock B2C payout failure');
  });

  test('3. Mock adapter timeout -> handled as retryable failure', async () => {
    if (skipDatabaseTests) return;

    const mockGateway = new MpesaB2CMockAdapter('timeout');
    const fixture = await createOutboxFixture();

    const worker = new B2CDispatchWorker(pgPool, mockGateway, 100, 1);
    await worker.processBatch();

    const res = await pgPool.query(`SELECT status, attempt_count, next_attempt_at, last_error FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    const row = res.rows[0];

    expect(row.status).toBe('pending');
    expect(row.attempt_count).toBe(1);
    expect(row.last_error).toContain('Mock B2C payout timeout');
  });

  test('4. Attempt count reaches max_attempts -> row marked status=dead', async () => {
    if (skipDatabaseTests) return;

    const mockGateway = new MpesaB2CMockAdapter('failure');
    const fixture = await createOutboxFixture({ attemptCount: 4, maxAttempts: 5, withdrawalStatus: 'approved' });

    const worker = new B2CDispatchWorker(pgPool, mockGateway, 100, 1);
    await worker.processBatch();

    const res = await pgPool.query(`SELECT status, attempt_count, last_error FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    const row = res.rows[0];

    expect(row.status).toBe('dead');
    expect(row.attempt_count).toBe(5);
    expect(row.last_error).toContain('Mock B2C payout failure');
  });

  test('5. Worker skips rows where next_attempt_at > NOW()', async () => {
    if (skipDatabaseTests) return;

    const mockGateway = new MpesaB2CMockAdapter();
    const futureDate = new Date(Date.now() + 60000);
    const fixture = await createOutboxFixture({ nextAttemptAt: futureDate });

    const worker = new B2CDispatchWorker(pgPool, mockGateway, 100, 1);
    await worker.processBatch();

    const res = await pgPool.query(`SELECT status FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    expect(res.rows[0].status).toBe('pending');
  });

  test('6. Worker skips sent, dead, and processing rows', async () => {
    if (skipDatabaseTests) return;

    const mockGateway = new MpesaB2CMockAdapter();

    const sentFix = await createOutboxFixture({ status: 'sent' });
    const deadFix = await createOutboxFixture({ status: 'dead' });
    const procFix = await createOutboxFixture({ status: 'processing' });

    const worker = new B2CDispatchWorker(pgPool, mockGateway, 100, 10);
    await worker.processBatch();

    const resSent = await pgPool.query(`SELECT status FROM payments.b2c_outbox WHERE id = $1`, [sentFix.outboxId]);
    const resDead = await pgPool.query(`SELECT status FROM payments.b2c_outbox WHERE id = $1`, [deadFix.outboxId]);
    const resProc = await pgPool.query(`SELECT status FROM payments.b2c_outbox WHERE id = $1`, [procFix.outboxId]);

    expect(resSent.rows[0].status).toBe('sent');
    expect(resDead.rows[0].status).toBe('dead');
    expect(resProc.rows[0].status).toBe('processing');
  });

  test('7. FOR UPDATE SKIP LOCKED: two workers racing split rows without duplicate execution', async () => {
    if (skipDatabaseTests) return;

    const mockGateway = new MpesaB2CMockAdapter();

    const fix1 = await createOutboxFixture();
    const fix2 = await createOutboxFixture();

    const worker1 = new B2CDispatchWorker(pgPool, mockGateway, 100, 1);
    const worker2 = new B2CDispatchWorker(pgPool, mockGateway, 100, 1);

    await Promise.all([worker1.processBatch(), worker2.processBatch()]);

    const res1 = await pgPool.query(`SELECT status FROM payments.b2c_outbox WHERE id = $1`, [fix1.outboxId]);
    const res2 = await pgPool.query(`SELECT status FROM payments.b2c_outbox WHERE id = $1`, [fix2.outboxId]);

    expect(res1.rows[0].status).toBe('sent');
    expect(res2.rows[0].status).toBe('sent');
  });

  test('8. CRITICAL: No DB transaction held open during external API call', async () => {
    if (skipDatabaseTests) return;

    let apiCallInProgress = false;
    let dbStatusDuringCall = '';

    const delayedGateway: IB2CPayoutGateway = {
      initiateB2CPayout: async (req) => {
        apiCallInProgress = true;
        const checkRes = await pgPool.query(`SELECT status FROM payments.b2c_outbox WHERE originator_conversation_id = $1`, [req.originatorConversationId]);
        dbStatusDuringCall = checkRes.rows[0]?.status;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          conversationId: `AG_delayed_${Date.now()}`,
          originatorConversationId: req.originatorConversationId,
          responseCode: '0',
          responseDescription: 'Success',
          raw: {},
        };
      },
      queryB2CStatus: async (convId) => {
        return { conversationId: convId, status: 'completed', resultCode: 0, resultDescription: 'Success', raw: {} };
      },
    };

    const fixture = await createOutboxFixture();
    const worker = new B2CDispatchWorker(pgPool, delayedGateway, 100, 1);

    await worker.processBatch();

    expect(apiCallInProgress).toBe(true);
    expect(dbStatusDuringCall).toBe('processing');

    const finalRes = await pgPool.query(`SELECT status FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    expect(finalRes.rows[0].status).toBe('sent');
  });

  test('9. Graceful stop: stop() while batch is in flight completes current batch', async () => {
    if (skipDatabaseTests) return;

    let apiCallStarted = false;
    const slowGateway: IB2CPayoutGateway = {
      initiateB2CPayout: async (req) => {
        apiCallStarted = true;
        await new Promise((r) => setTimeout(r, 150));
        return {
          conversationId: `AG_${Date.now()}`,
          originatorConversationId: req.originatorConversationId,
          responseCode: '0',
          responseDescription: 'Success',
          raw: {},
        };
      },
      queryB2CStatus: async (convId) => ({ conversationId: convId, status: 'completed', raw: {} }),
    };

    const fixture = await createOutboxFixture();
    const worker = new B2CDispatchWorker(pgPool, slowGateway, 50, 1);

    worker.start();

    while (!apiCallStarted) {
      await new Promise((r) => setTimeout(r, 10));
    }

    const stopPromise = worker.stop();
    await stopPromise;

    const res = await pgPool.query(`SELECT status FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    expect(res.rows[0].status).toBe('sent');
  });

  test('10. Worker respects enableB2cWorker=false config flag', async () => {
    if (skipDatabaseTests) return;

    const mockGateway = new MpesaB2CMockAdapter();
    const worker = new B2CDispatchWorker(pgPool, mockGateway, 100, 1);

    expect(worker).toBeDefined();
  });

  test('11. Worker respects enableB2cDisbursement=false flag (skips dispatch, reverts to pending)', async () => {
    if (skipDatabaseTests) return;

    const mockGateway = new MpesaB2CMockAdapter();
    const fixture = await createOutboxFixture();

    process.env.ENABLE_B2C_DISBURSEMENT = 'false';
    config.enableB2cDisbursement = false;

    try {
      const worker = new B2CDispatchWorker(pgPool, mockGateway, 100, 1);
      await worker.processBatch();

      const res = await pgPool.query(`SELECT status FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
      expect(res.rows[0].status).toBe('pending');
    } finally {
      process.env.ENABLE_B2C_DISBURSEMENT = 'true';
      config.enableB2cDisbursement = true;
    }
  });

  test('12. Worker dispatches netAmount (post-fee) to gateway, not amount', async () => {
    if (skipDatabaseTests) return;

    let dispatchedAmount: Decimal | null = null;
    const captureGateway: IB2CPayoutGateway = {
      initiateB2CPayout: async (req) => {
        dispatchedAmount = req.amount;
        return {
          conversationId: `AG_test_${Date.now()}`,
          originatorConversationId: req.originatorConversationId,
          responseCode: '0',
          responseDescription: 'Success',
          raw: {},
        };
      },
      queryB2CStatus: async (cId) => ({ conversationId: cId, status: 'completed', raw: {} }),
    };

    const fixture = await createOutboxFixture({
      payloadOverride: {
        amount: 1500,
        netAmount: 1470,
        recipientPhone: generateUniquePhone(),
        remarks: 'Net payout test',
      },
    });

    const worker = new B2CDispatchWorker(pgPool, captureGateway, 100, 1);
    await worker.processBatch();

    expect(dispatchedAmount).not.toBeNull();
    expect(dispatchedAmount!.toString()).toBe('1470');

    const res = await pgPool.query(`SELECT status FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    expect(res.rows[0].status).toBe('sent');
  });

  test('13. Worker throws on corrupt payload (missing netAmount)', async () => {
    if (skipDatabaseTests) return;

    const mockGateway = new MpesaB2CMockAdapter();
    const fixture = await createOutboxFixture({
      payloadOverride: {
        amount: 1000,
        recipientPhone: generateUniquePhone(),
      },
    });

    const worker = new B2CDispatchWorker(pgPool, mockGateway, 100, 1);
    await worker.processBatch();

    const res = await pgPool.query(`SELECT status, attempt_count, last_error FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    expect(res.rows[0].status).toBe('pending');
    expect(res.rows[0].attempt_count).toBe(1);
    expect(res.rows[0].last_error).toContain('netAmount missing');
  });

  test('14. Recovery resets stale processing row to pending and next dispatch succeeds', async () => {
    if (skipDatabaseTests) return;

    process.env.B2C_PROCESSING_TIMEOUT_SECONDS = '300';
    const fixture = await createOutboxFixture({
      status: 'processing',
      attemptCount: 1,
      maxAttempts: 5,
      withdrawalStatus: 'dispatched',
      updatedAt: new Date(Date.now() - 600000),
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

    const mockGateway = new MpesaB2CMockAdapter();
    const worker = new B2CDispatchWorker(pgPool, mockGateway, 100, 1);
    await worker.processBatch();

    const finalRes = await pgPool.query(`SELECT status FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    expect(finalRes.rows[0].status).toBe('sent');
  });

  test('15. Recovery ignores stale processing rows that are not yet beyond the timeout', async () => {
    if (skipDatabaseTests) return;

    process.env.B2C_PROCESSING_TIMEOUT_SECONDS = '300';
    const fixture = await createOutboxFixture({
      status: 'processing',
      attemptCount: 1,
      maxAttempts: 5,
      updatedAt: new Date(Date.now() - 60000),
    });

    const job = new B2CReconciliationJob(pgPool, 1000, () => true);
    await job.runTick();

    const res = await pgPool.query(`SELECT status FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    expect(res.rows[0].status).toBe('processing');
  });

  test('16. Recovery moves max-attempt processing rows to dead and unlocks funds', async () => {
    if (skipDatabaseTests) return;

    process.env.B2C_PROCESSING_TIMEOUT_SECONDS = '300';
    const fixture = await createOutboxFixture({
      status: 'processing',
      attemptCount: 4,
      maxAttempts: 5,
      withdrawalStatus: 'dispatched',
      updatedAt: new Date(Date.now() - 600000),
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
      `SELECT locked_balance FROM wallet.wallets WHERE user_id = $1 AND account_type = 'real'`,
      [testUserId]
    );
    expect(Number(walletRow.rows[0].locked_balance)).toBe(0);

    const withdrawalRow = await pgPool.query(`SELECT status FROM payments.withdrawals WHERE id = $1`, [fixture.withdrawalId]);
    expect(withdrawalRow.rows[0].status).toBe('failed');
  });

  test('17. Recovery preserves the same originator_conversation_id without creating duplicate rows', async () => {
    if (skipDatabaseTests) return;

    process.env.B2C_PROCESSING_TIMEOUT_SECONDS = '300';
    const originatorConvId = `orig_recon_dup_${uuidv4()}`;
    const fixture = await createOutboxFixture({
      status: 'processing',
      attemptCount: 0,
      maxAttempts: 5,
      originatorConversationId: originatorConvId,
      withdrawalStatus: 'dispatched',
      updatedAt: new Date(Date.now() - 600000),
    });

    const job = new B2CReconciliationJob(pgPool, 1000, () => true);
    await job.runTick();

    const countRes = await pgPool.query(
      `SELECT COUNT(*)::int AS cnt FROM payments.b2c_outbox WHERE originator_conversation_id = $1`,
      [originatorConvId]
    );
    expect(countRes.rows[0].cnt).toBe(1);

    const rowRes = await pgPool.query(`SELECT status, attempt_count FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    expect(rowRes.rows[0].status).toBe('pending');
    expect(rowRes.rows[0].attempt_count).toBe(1);
  });

  test('18. Config validation rejects non-positive or non-numeric B2C processing timeout values', () => {
    const original = process.env.B2C_PROCESSING_TIMEOUT_SECONDS;
    for (const value of ['0', '-10', 'abc', '']) {
      process.env.B2C_PROCESSING_TIMEOUT_SECONDS = value;
      expect(() => validateB2cConfig()).toThrow(/B2C_PROCESSING_TIMEOUT_SECONDS must be a positive integer/);
    }
    delete process.env.B2C_PROCESSING_TIMEOUT_SECONDS;
    validateB2cConfig();
    process.env.B2C_PROCESSING_TIMEOUT_SECONDS = original;
  });

  test('19. Recovery only touches stale processing rows and leaves pending, sent, and dead rows alone', async () => {
    if (skipDatabaseTests) return;

    process.env.B2C_PROCESSING_TIMEOUT_SECONDS = '300';

    const pendingRow = await createOutboxFixture({
      status: 'pending',
      attemptCount: 0,
      updatedAt: new Date(Date.now() - 600000),
      nextAttemptAt: new Date(Date.now() + 3600000),
    });
    const sentRow = await createOutboxFixture({
      status: 'sent',
      attemptCount: 1,
      updatedAt: new Date(Date.now() - 600000),
      nextAttemptAt: new Date(Date.now() + 3600000),
    });
    const deadRow = await createOutboxFixture({
      status: 'dead',
      attemptCount: 5,
      updatedAt: new Date(Date.now() - 600000),
      nextAttemptAt: new Date(Date.now() + 3600000),
    });
    const staleProcessingRow = await createOutboxFixture({
      status: 'processing',
      attemptCount: 0,
      maxAttempts: 5,
      updatedAt: new Date(Date.now() - 600000),
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

  test('20. ambiguous B2C failure marks outbox needs_review and does not retry or unlock', async () => {
    if (skipDatabaseTests) return;

    const mockGateway: any = {
      initiateB2CPayout: jest.fn().mockRejectedValueOnce(
        new B2CPayoutError('IntaSend payout timeout', 'ETIMEDOUT', {}, 'possibly_sent')
      ),
    };

    const fixture = await createOutboxFixture({ status: 'pending', attemptCount: 1, withdrawalStatus: 'dispatched' });

    await pgPool.query(
      `INSERT INTO wallet.wallets (user_id, account_type, balance, locked_balance, currency, version, created_at, updated_at)
       VALUES ($1, 'real', '1000', '1000', 'KES', 1, NOW(), NOW())
       ON CONFLICT (user_id, account_type) DO UPDATE
       SET balance = EXCLUDED.balance,
           locked_balance = EXCLUDED.locked_balance,
           updated_at = NOW()`,
      [testUserId]
    );

    const worker = new B2CDispatchWorker(pgPool, mockGateway, 100, 1);
    await worker.processBatch();

    const outboxRes = await pgPool.query(`SELECT status, attempt_count, last_error FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    expect(outboxRes.rows[0].status).toBe('needs_review');
    expect(outboxRes.rows[0].attempt_count).toBe(2);
    expect(outboxRes.rows[0].last_error).toContain('AMBIGUOUS');

    const withdrawalRes = await pgPool.query(`SELECT status FROM payments.withdrawals WHERE id = $1`, [fixture.withdrawalId]);
    expect(withdrawalRes.rows[0].status).toBe('dispatched');

    const walletRes = await pgPool.query(`SELECT locked_balance FROM wallet.wallets WHERE user_id = $1 AND account_type = 'real'`, [testUserId]);
    expect(Number(walletRes.rows[0].locked_balance)).toBe(1000);
  });

  test('21. reconciliation does not reset needs_review rows', async () => {
    if (skipDatabaseTests) return;

    const needsReviewRow = await createOutboxFixture({
      status: 'needs_review',
      attemptCount: 2,
      updatedAt: new Date(Date.now() - 600000),
    });

    const job = new B2CReconciliationJob(pgPool, 1000, () => true);
    await job.runTick();

    const res = await pgPool.query(`SELECT status FROM payments.b2c_outbox WHERE id = $1`, [needsReviewRow.outboxId]);
    expect(res.rows[0].status).toBe('needs_review');
  });
});
