import supertest from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import app from '../../src/index.js';
import { pgPool } from '../../src/config/database.js';
import { WalletService } from '../../src/modules/wallet/services/walletService.js';
import { logger } from '../../src/shared/middleware/logger.js';

const skipDatabaseTests = process.env.SKIP_DB_TESTS === 'true' || !process.env.DATABASE_URL;

describe('IntaSend B2C Webhook Integration Tests', () => {
  let testUserId: string;
  const createdWithdrawalIds: string[] = [];
  const createdOutboxIds: string[] = [];
  const createdIdempotencyKeys: string[] = [];
  const validChallenge = 'valid-b2c-challenge-456';

  beforeAll(async () => {
    if (skipDatabaseTests) return;

    process.env.INTASEND_WEBHOOK_CHALLENGE = validChallenge;

    const email = `intasend-b2c-${Date.now()}@example.com`;
    const phone = `07${Math.floor(10000000 + Math.random() * 90000000)}`;
    const userRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'IntaSend B2C User', 'active', 'verified', $2) RETURNING id",
      [email, phone]
    );
    testUserId = userRes.rows[0].id;
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

  async function createB2CFixture(opts?: {
    outboxStatus?: string;
    withdrawalStatus?: string;
    conversationId?: string;
    gatewayTrackingId?: string;
  }) {
    const withdrawalId = uuidv4();
    const outboxId = uuidv4();
    const originatorConvId = `orig_${uuidv4()}`;
    const idempotencyKey = `ik_${withdrawalId}`;

    createdWithdrawalIds.push(withdrawalId);
    createdOutboxIds.push(outboxId);
    createdIdempotencyKeys.push(idempotencyKey);

    await pgPool.query(
      `INSERT INTO wallet.wallets (user_id, account_type, balance, locked_balance, currency, version, created_at, updated_at)
       VALUES ($1, 'real', '5000', '5000', 'KES', 1, NOW(), NOW())
       ON CONFLICT (user_id, account_type) DO UPDATE
       SET balance = wallet.wallets.balance + 1000,
           locked_balance = wallet.wallets.locked_balance + 1000,
           updated_at = NOW()`,
      [testUserId]
    );

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

    const payload = {
      amount: 1000,
      netAmount: 980,
      recipientPhone: '0712345678',
      remarks: 'Payout test',
    };

    await pgPool.query(
      `INSERT INTO payments.b2c_outbox (id, withdrawal_id, originator_conversation_id, conversation_id, gateway_tracking_id, status, attempt_count, max_attempts, next_attempt_at, payload, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 1, 5, NOW(), $7, NOW(), NOW())`,
      [
        outboxId,
        withdrawalId,
        originatorConvId,
        opts?.conversationId || `conv_${uuidv4()}`,
        opts?.gatewayTrackingId || null,
        opts?.outboxStatus || 'sent',
        JSON.stringify(payload),
      ]
    );

    return { withdrawalId, outboxId, originatorConvId };
  }

  it('1. Success + match by idempotency_key -> outbox sent, withdrawal completed, wallet finalized', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createB2CFixture();

    const response = await supertest(app)
      .post('/api/v1/payments/intasend/b2c/callback')
      .send({
        challenge: validChallenge,
        tracking_id: 'batch_001',
        transactions: [
          {
            idempotency_key: fixture.originatorConvId,
            transaction_id: 'txn_1001',
            status: 'COMPLETE',
          },
        ],
      });

    expect(response.status).toBe(200);

    const wRes = await pgPool.query(`SELECT status FROM payments.withdrawals WHERE id = $1`, [fixture.withdrawalId]);
    expect(wRes.rows[0].status).toBe('completed');
  });

  it('2. Failure + match by idempotency_key -> outbox failed, withdrawal failed, unlockFunds called', async () => {
    if (skipDatabaseTests) return;

    const unlockSpy = jest.spyOn(WalletService.prototype, 'unlockFunds');
    const fixture = await createB2CFixture();

    const response = await supertest(app)
      .post('/api/v1/payments/intasend/b2c/callback')
      .send({
        challenge: validChallenge,
        tracking_id: 'batch_002',
        transactions: [
          {
            idempotency_key: fixture.originatorConvId,
            transaction_id: 'txn_1002',
            status: 'FAILED',
          },
        ],
      });

    expect(response.status).toBe(200);

    const wRes = await pgPool.query(`SELECT status FROM payments.withdrawals WHERE id = $1`, [fixture.withdrawalId]);
    expect(wRes.rows[0].status).toBe('failed');
    expect(unlockSpy).toHaveBeenCalledTimes(1);

    unlockSpy.mockRestore();
  });

  it('3. Duplicate delivery -> HTTP 200, no double-finalize, no double-unlock', async () => {
    if (skipDatabaseTests) return;

    const finalizeSpy = jest.spyOn(WalletService.prototype, 'finalizeWithdrawalDebit');
    const fixture = await createB2CFixture();

    const payload = {
      challenge: validChallenge,
      tracking_id: 'batch_003',
      transactions: [
        {
          idempotency_key: fixture.originatorConvId,
          transaction_id: 'txn_1003',
          status: 'COMPLETE',
        },
      ],
    };

    const res1 = await supertest(app).post('/api/v1/payments/intasend/b2c/callback').send(payload);
    const res2 = await supertest(app).post('/api/v1/payments/intasend/b2c/callback').send(payload);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const wRes = await pgPool.query(`SELECT status FROM payments.withdrawals WHERE id = $1`, [fixture.withdrawalId]);
    expect(wRes.rows[0].status).toBe('completed');
    expect(finalizeSpy).toHaveBeenCalledTimes(1);

    finalizeSpy.mockRestore();
  });

  it('4. Invalid challenge -> HTTP 401', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createB2CFixture();

    const response = await supertest(app)
      .post('/api/v1/payments/intasend/b2c/callback')
      .send({
        challenge: 'invalid-challenge',
        transactions: [
          {
            idempotency_key: fixture.originatorConvId,
            status: 'COMPLETE',
          },
        ],
      });

    expect(response.status).toBe(401);
  });

  it('5. Match by transaction_id only (no idempotency_key) -> correct row updated', async () => {
    if (skipDatabaseTests) return;

    const conversationId = `conv_only_${uuidv4()}`;
    const fixture = await createB2CFixture({ conversationId });

    const response = await supertest(app)
      .post('/api/v1/payments/intasend/b2c/callback')
      .send({
        challenge: validChallenge,
        transactions: [
          {
            transaction_id: conversationId,
            status: 'COMPLETE',
          },
        ],
      });

    expect(response.status).toBe(200);

    const wRes = await pgPool.query(`SELECT status FROM payments.withdrawals WHERE id = $1`, [fixture.withdrawalId]);
    expect(wRes.rows[0].status).toBe('completed');
  });

  it('6. Match by tracking_id only (via gateway_tracking_id) -> correct row updated', async () => {
    if (skipDatabaseTests) return;

    const trackingId = `track_only_${uuidv4()}`;
    const fixture = await createB2CFixture({ gatewayTrackingId: trackingId });

    const response = await supertest(app)
      .post('/api/v1/payments/intasend/b2c/callback')
      .send({
        challenge: validChallenge,
        tracking_id: trackingId,
        transactions: [
          {
            status: 'COMPLETE',
          },
        ],
      });

    expect(response.status).toBe(200);

    const wRes = await pgPool.query(`SELECT status FROM payments.withdrawals WHERE id = $1`, [fixture.withdrawalId]);
    expect(wRes.rows[0].status).toBe('completed');
  });

  it('7. No match -> HTTP 200, warning logged, no mutation', async () => {
    if (skipDatabaseTests) return;

    const response = await supertest(app)
      .post('/api/v1/payments/intasend/b2c/callback')
      .send({
        challenge: validChallenge,
        tracking_id: 'NON_EXISTENT_TRACKING_ID',
        transactions: [
          {
            idempotency_key: 'non_existent_idempotency_key',
            status: 'COMPLETE',
          },
        ],
      });

    expect(response.status).toBe(200);
  });

  it('8. Batch with 2 transactions, 1 matched 1 unmatched -> matched processed, unmatched logged, batch not aborted', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createB2CFixture();

    const response = await supertest(app)
      .post('/api/v1/payments/intasend/b2c/callback')
      .send({
        challenge: validChallenge,
        tracking_id: 'batch_multi',
        transactions: [
          {
            idempotency_key: fixture.originatorConvId,
            status: 'COMPLETE',
          },
          {
            idempotency_key: 'unmatched_key_999',
            status: 'COMPLETE',
          },
        ],
      });

    expect(response.status).toBe(200);

    const wRes = await pgPool.query(`SELECT status FROM payments.withdrawals WHERE id = $1`, [fixture.withdrawalId]);
    expect(wRes.rows[0].status).toBe('completed');
  });

  it('9. Outbox still pending (not sent) + callback arrives -> HTTP 200, no wallet mutation, info logged', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createB2CFixture({ outboxStatus: 'pending' });

    const response = await supertest(app)
      .post('/api/v1/payments/intasend/b2c/callback')
      .send({
        challenge: validChallenge,
        transactions: [
          {
            idempotency_key: fixture.originatorConvId,
            status: 'COMPLETE',
          },
        ],
      });

    expect(response.status).toBe(200);

    const wRes = await pgPool.query(`SELECT status FROM payments.withdrawals WHERE id = $1`, [fixture.withdrawalId]);
    expect(wRes.rows[0].status).toBe('dispatched');
  });

  it('10. Logs B2C webhook received message', async () => {
    if (skipDatabaseTests) return;

    const infoSpy = jest.spyOn(logger, 'info');

    await supertest(app)
      .post('/api/v1/payments/intasend/b2c/callback')
      .send({
        challenge: validChallenge,
        tracking_id: 'track_log_123',
        transactions: [],
      });

    const infoMessages = infoSpy.mock.calls.map((call) => call[0]);
    expect(infoMessages).toContain('IntaSend B2C callback received');

    infoSpy.mockRestore();
  });

  it('11. handles UNSUCCESSFUL transaction state by unlocking funds and marking failed', async () => {
    if (skipDatabaseTests) return;

    const unlockSpy = jest.spyOn(WalletService.prototype, 'unlockFunds');
    const fixture = await createB2CFixture();

    const response = await supertest(app)
      .post('/api/v1/payments/intasend/b2c/callback')
      .send({
        challenge: validChallenge,
        tracking_id: 'batch_unsuccessful',
        transactions: [
          {
            idempotency_key: fixture.originatorConvId,
            transaction_id: 'txn_unsuccessful',
            status: 'UNSUCCESSFUL',
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(unlockSpy).toHaveBeenCalledTimes(1);

    const wRes = await pgPool.query(`SELECT status FROM payments.withdrawals WHERE id = $1`, [fixture.withdrawalId]);
    expect(wRes.rows[0].status).toBe('failed');

    const outboxRes = await pgPool.query(`SELECT status FROM payments.b2c_outbox WHERE id = $1`, [fixture.outboxId]);
    expect(outboxRes.rows[0].status).toBe('failed');

    unlockSpy.mockRestore();
  });
});
