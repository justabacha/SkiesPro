import { v4 as uuidv4 } from 'uuid';
import { pgPool } from '../../src/config/database.js';
import { B2CReconciliationJob } from '../../src/modules/payments/jobs/b2cReconciliation.job.js';
import { logger } from '../../src/shared/middleware/logger.js';

const skipDatabaseTests = process.env.SKIP_DB_TESTS === 'true' || !process.env.DATABASE_URL;

describe('B2C Reconciliation Job Tests (Slice 5A)', () => {
  let testUserId: string;
  let createdWithdrawalIds: string[] = [];
  let createdOutboxIds: string[] = [];
  let createdIdempotencyKeys: string[] = [];

  beforeAll(async () => {
    if (skipDatabaseTests) return;

    const userEmail = `b2c-recon-${Date.now()}@example.com`;
    const uniquePhone = `07${Math.floor(10000000 + Math.random() * 90000000)}`;
    const userRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Recon User', 'active', 'verified', $2) RETURNING id",
      [userEmail, uniquePhone]
    );
    testUserId = userRes.rows[0].id;
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
      await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [testUserId]);
    }
  });

  const createTestWithdrawalAndOutbox = async (
    status: string,
    outboxStatus: string,
    needsManualReview: boolean,
    manualReviewReason: string | null,
    outboxAgeHours: number
  ) => {
    const idempKey = `idemp-${uuidv4()}`;
    await pgPool.query(
      "INSERT INTO payments.idempotency_keys (key, response) VALUES ($1, '{}'::jsonb) ON CONFLICT DO NOTHING",
      [idempKey]
    );
    createdIdempotencyKeys.push(idempKey);

    const wRes = await pgPool.query(
      `INSERT INTO payments.withdrawals (user_id, gateway_id, amount, fee, net_amount, currency, status, idempotency_key)
       VALUES ($1, 1, 1000, 20, 980, 'KES', $2, $3)
       RETURNING id`,
      [testUserId, status, idempKey]
    );
    const withdrawalId = wRes.rows[0].id;
    createdWithdrawalIds.push(withdrawalId);

    const updatedTime = new Date(Date.now() - outboxAgeHours * 60 * 60 * 1000);
    const payload = JSON.stringify({ amount: '1000', netAmount: '980' });
    const oRes = await pgPool.query(
      `INSERT INTO payments.b2c_outbox (withdrawal_id, originator_conversation_id, status, needs_manual_review, manual_review_reason, payload, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $7)
       RETURNING id`,
      [withdrawalId, uuidv4(), outboxStatus, needsManualReview, manualReviewReason, payload, updatedTime]
    );
    const outboxId = oRes.rows[0].id;
    createdOutboxIds.push(outboxId);

    return { withdrawalId, outboxId };
  };

  test('stuck 2h row is flagged for manual review', async () => {
    if (skipDatabaseTests) return;

    const { outboxId } = await createTestWithdrawalAndOutbox('dispatched', 'sent', false, null, 3);

    const job = new B2CReconciliationJob(pgPool, 300000, () => true);
    await job.runTick();

    const res = await pgPool.query('SELECT * FROM payments.b2c_outbox WHERE id = $1', [outboxId]);
    expect(res.rows[0].needs_manual_review).toBe(true);
    expect(res.rows[0].manual_review_reason).toContain('Stuck at 2h threshold');
  });

  test('healthy recent row is NOT flagged', async () => {
    if (skipDatabaseTests) return;

    const { outboxId } = await createTestWithdrawalAndOutbox('dispatched', 'sent', false, null, 0.5);

    const job = new B2CReconciliationJob(pgPool, 300000, () => true);
    await job.runTick();

    const res = await pgPool.query('SELECT * FROM payments.b2c_outbox WHERE id = $1', [outboxId]);
    expect(res.rows[0].needs_manual_review).toBe(false);
    expect(res.rows[0].manual_review_reason).toBeNull();
  });

  test('stuck 24h row previously flagged at 2h is escalated', async () => {
    if (skipDatabaseTests) return;

    const { outboxId } = await createTestWithdrawalAndOutbox(
      'dispatched',
      'sent',
      true,
      'Stuck at 2h threshold; no result callback received',
      25
    );

    const job = new B2CReconciliationJob(pgPool, 300000, () => true);
    await job.runTick();

    const res = await pgPool.query('SELECT * FROM payments.b2c_outbox WHERE id = $1', [outboxId]);
    expect(res.rows[0].needs_manual_review).toBe(true);
    expect(res.rows[0].manual_review_reason).toContain('Stuck at 24h threshold');
  });

  test('recent dead dispatches log error once per tick', async () => {
    if (skipDatabaseTests) return;

    const spyError = jest.spyOn(logger, 'error').mockImplementation(() => logger);

    await createTestWithdrawalAndOutbox('failed', 'dead', false, null, 0.2);

    const job = new B2CReconciliationJob(pgPool, 300000, () => true);
    await job.runTick();

    expect(spyError).toHaveBeenCalledWith(
      'Recent dead B2C dispatches detected',
      expect.objectContaining({ event: 'b2c_dead_dispatches' })
    );

    spyError.mockRestore();
  });

  test('job with isEnabled = false skips tick without modifying rows', async () => {
    if (skipDatabaseTests) return;

    const { outboxId } = await createTestWithdrawalAndOutbox('dispatched', 'sent', false, null, 4);

    const job = new B2CReconciliationJob(pgPool, 300000, () => false);
    await job.runTick();

    const res = await pgPool.query('SELECT * FROM payments.b2c_outbox WHERE id = $1', [outboxId]);
    expect(res.rows[0].needs_manual_review).toBe(false);
  });
});
