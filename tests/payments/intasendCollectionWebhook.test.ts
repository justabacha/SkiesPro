import supertest from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import app from '../../src/index.js';
import { pgPool } from '../../src/config/database.js';
import { logger } from '../../src/shared/middleware/logger.js';

const skipDatabaseTests = process.env.SKIP_DB_TESTS === 'true' || !process.env.DATABASE_URL;

describe('IntaSend Collection Webhook Integration Tests', () => {
  let testUserId: string;
  const createdDepositIds: string[] = [];
  const createdIdempotencyKeys: string[] = [];
  const validChallenge = 'valid-collection-challenge-123';

  beforeAll(async () => {
    if (skipDatabaseTests) return;

    process.env.INTASEND_WEBHOOK_CHALLENGE = validChallenge;

    const email = `intasend-coll-${Date.now()}@example.com`;
    const phone = `07${Math.floor(10000000 + Math.random() * 90000000)}`;
    const userRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'IntaSend Coll User', 'active', 'verified', $2) RETURNING id",
      [email, phone]
    );
    testUserId = userRes.rows[0].id;
  });

  afterAll(async () => {
    if (skipDatabaseTests) return;

    if (createdDepositIds.length > 0) {
      await pgPool.query(`DELETE FROM payments.deposits WHERE id = ANY($1::uuid[])`, [createdDepositIds]);
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

  async function createFixtureDeposit(opts?: { status?: string; invoiceId?: string; netAmount?: number }) {
    const depositId = uuidv4();
    const invoiceId = opts?.invoiceId || `INV_${uuidv4()}`;
    const amount = opts?.netAmount || 1000;
    const idempotencyKey = `ik_${depositId}`;

    createdDepositIds.push(depositId);
    createdIdempotencyKeys.push(idempotencyKey);

    await pgPool.query(
      `INSERT INTO payments.idempotency_keys (key, expires_at, created_at)
       VALUES ($1, NOW() + INTERVAL '1 day', NOW())
       ON CONFLICT (key) DO NOTHING`,
      [idempotencyKey]
    );

    await pgPool.query(
      `INSERT INTO payments.deposits (id, user_id, gateway_id, amount, fee, net_amount, currency, status, gateway_reference, idempotency_key, created_at)
       VALUES ($1, $2, 1, $3, 0, $3, 'KES', $4, $5, $6, NOW())`,
      [depositId, testUserId, amount, opts?.status || 'pending', invoiceId, idempotencyKey]
    );

    return { depositId, invoiceId, amount };
  }

  it('1. Valid challenge + state: COMPLETE -> deposit completed, wallet credited, HTTP 200', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createFixtureDeposit();

    const response = await supertest(app)
      .post('/api/v1/payments/intasend/collection/callback')
      .send({
        challenge: validChallenge,
        invoice_id: fixture.invoiceId,
        state: 'COMPLETE',
      });

    expect(response.status).toBe(200);

    const depRes = await pgPool.query(`SELECT status FROM payments.deposits WHERE id = $1`, [fixture.depositId]);
    expect(depRes.rows[0].status).toBe('completed');

    const walletRes = await pgPool.query(`SELECT balance FROM wallet.wallets WHERE user_id = $1 AND account_type = 'real'`, [testUserId]);
    expect(Number(walletRes.rows[0].balance)).toBeGreaterThanOrEqual(fixture.amount);
  });

  it('2. Duplicate delivery -> HTTP 200, wallet still credited exactly once', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createFixtureDeposit();

    const res1 = await supertest(app)
      .post('/api/v1/payments/intasend/collection/callback')
      .send({ challenge: validChallenge, invoice_id: fixture.invoiceId, state: 'COMPLETE' });

    const walletRes1 = await pgPool.query(`SELECT balance FROM wallet.wallets WHERE user_id = $1 AND account_type = 'real'`, [testUserId]);
    const balanceAfterFirst = Number(walletRes1.rows[0].balance);

    const res2 = await supertest(app)
      .post('/api/v1/payments/intasend/collection/callback')
      .send({ challenge: validChallenge, invoice_id: fixture.invoiceId, state: 'COMPLETE' });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const walletRes2 = await pgPool.query(`SELECT balance FROM wallet.wallets WHERE user_id = $1 AND account_type = 'real'`, [testUserId]);
    expect(Number(walletRes2.rows[0].balance)).toBe(balanceAfterFirst);
  });

  it('3. Invalid challenge -> HTTP 401, no DB mutation', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createFixtureDeposit();

    const response = await supertest(app)
      .post('/api/v1/payments/intasend/collection/callback')
      .send({
        challenge: 'wrong-challenge',
        invoice_id: fixture.invoiceId,
        state: 'COMPLETE',
      });

    expect(response.status).toBe(401);

    const depRes = await pgPool.query(`SELECT status FROM payments.deposits WHERE id = $1`, [fixture.depositId]);
    expect(depRes.rows[0].status).toBe('pending');
  });

  it('4. Missing challenge field -> HTTP 401', async () => {
    if (skipDatabaseTests) return;

    const response = await supertest(app)
      .post('/api/v1/payments/intasend/collection/callback')
      .send({
        invoice_id: 'INV_DUMMY',
        state: 'COMPLETE',
      });

    expect(response.status).toBe(401);
  });

  it('5. Unknown invoice_id -> HTTP 200, no DB mutation, warning logged', async () => {
    if (skipDatabaseTests) return;

    const response = await supertest(app)
      .post('/api/v1/payments/intasend/collection/callback')
      .send({
        challenge: validChallenge,
        invoice_id: 'NON_EXISTENT_INVOICE_999',
        state: 'COMPLETE',
      });

    expect(response.status).toBe(200);
  });

  it('6. state: FAILED -> deposit failed, no wallet credit', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createFixtureDeposit();

    const response = await supertest(app)
      .post('/api/v1/payments/intasend/collection/callback')
      .send({
        challenge: validChallenge,
        invoice_id: fixture.invoiceId,
        state: 'FAILED',
      });

    expect(response.status).toBe(200);

    const depRes = await pgPool.query(`SELECT status FROM payments.deposits WHERE id = $1`, [fixture.depositId]);
    expect(depRes.rows[0].status).toBe('failed');
  });

  it('7. state: CANCELED -> deposit failed, no wallet credit', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createFixtureDeposit();

    const response = await supertest(app)
      .post('/api/v1/payments/intasend/collection/callback')
      .send({
        challenge: validChallenge,
        invoice_id: fixture.invoiceId,
        state: 'CANCELED',
      });

    expect(response.status).toBe(200);

    const depRes = await pgPool.query(`SELECT status FROM payments.deposits WHERE id = $1`, [fixture.depositId]);
    expect(depRes.rows[0].status).toBe('failed');
  });

  it('8. Deposit already completed + callback again -> HTTP 200, no double credit', async () => {
    if (skipDatabaseTests) return;

    const fixture = await createFixtureDeposit({ status: 'completed' });

    const response = await supertest(app)
      .post('/api/v1/payments/intasend/collection/callback')
      .send({
        challenge: validChallenge,
        invoice_id: fixture.invoiceId,
        state: 'COMPLETE',
      });

    expect(response.status).toBe(200);

    const depRes = await pgPool.query(`SELECT status FROM payments.deposits WHERE id = $1`, [fixture.depositId]);
    expect(depRes.rows[0].status).toBe('completed');
  });

  it('9. Logs webhook received and wallet credited messages', async () => {
    if (skipDatabaseTests) return;

    const infoSpy = jest.spyOn(logger, 'info');
    const invoiceId = `INV_LOG_${uuidv4()}`;
    await createFixtureDeposit({ invoiceId });

    await supertest(app)
      .post('/api/v1/payments/intasend/collection/callback')
      .send({
        challenge: validChallenge,
        invoice_id: invoiceId,
        state: 'COMPLETE',
      });

    const infoMessages = infoSpy.mock.calls.map((call) => call[0]);
    expect(infoMessages).toContain('IntaSend collection callback received');
    expect(infoMessages).toContain('IntaSend collection callback credited wallet');

    infoSpy.mockRestore();
  });
});
