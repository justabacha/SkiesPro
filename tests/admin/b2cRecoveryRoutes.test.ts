import supertest from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import app from '../../src/index.js';
import { pgPool } from '../../src/config/database.js';
import { TokenService } from '../../src/modules/auth/services/tokenService.js';
import { WalletService } from '../../src/modules/wallet/services/walletService.js';

const skipDatabaseTests = process.env.SKIP_DB_TESTS === 'true' || !process.env.DATABASE_URL;

function generateUniquePhone(): string {
  const random8 = Math.floor(10000000 + Math.random() * 90000000);
  return `07${random8}`;
}

describe('B2C Recovery Admin Routes Integration Tests (Slice 5)', () => {
  let superAdminToken: string;
  let superAdminMfaToken: string;
  let financeAdminToken: string;
  let testUserId: string;
  let superAdminId: string;
  let financeAdminId: string;
  let createdWithdrawalIds: string[] = [];
  let createdOutboxIds: string[] = [];
  let createdIdempotencyKeys: string[] = [];
  let walletService: WalletService;

  beforeAll(async () => {
    if (skipDatabaseTests) return;

    walletService = new WalletService();
    const tokenService = new TokenService();

    // Create Super Admin user & role
    const superAdminEmail = `superadmin-${Date.now()}@example.com`;
    const superAdminPhone = generateUniquePhone();
    const saRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Super Admin', 'active', 'verified', $2) RETURNING id",
      [superAdminEmail, superAdminPhone]
    );
    superAdminId = saRes.rows[0].id;

    // Seed super_admin role
    await pgPool.query(
      "INSERT INTO app_auth.user_roles (user_id, role_id) SELECT $1, id FROM app_auth.roles WHERE name = 'super_admin' ON CONFLICT DO NOTHING",
      [superAdminId]
    );

    const saGen = tokenService.generateAccessToken(superAdminId, 'super_admin', []);
    superAdminToken = saGen.token;
    superAdminMfaToken = tokenService.generateAdminMfaToken(superAdminId, 'super_admin');

    // Create Finance Admin user & role (non-super_admin)
    const financeEmail = `financeadmin-${Date.now()}@example.com`;
    const financePhone = generateUniquePhone();
    const faRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Finance Admin', 'active', 'verified', $2) RETURNING id",
      [financeEmail, financePhone]
    );
    financeAdminId = faRes.rows[0].id;

    await pgPool.query(
      "INSERT INTO app_auth.user_roles (user_id, role_id) SELECT $1, id FROM app_auth.roles WHERE name = 'finance' ON CONFLICT DO NOTHING",
      [financeAdminId]
    );

    const faGen = tokenService.generateAccessToken(financeAdminId, 'finance', []);
    financeAdminToken = faGen.token;

    // Create test user & wallet
    const userEmail = `routeuser-${Date.now()}@example.com`;
    const userPhone = generateUniquePhone();
    const uRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Route User', 'active', 'verified', $2) RETURNING id",
      [userEmail, userPhone]
    );
    testUserId = uRes.rows[0].id;
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
    if (superAdminId) await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [superAdminId]);
    if (financeAdminId) await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [financeAdminId]);
  });

  const seedFailedWithdrawal = async () => {
    await pgPool.query(
      "UPDATE wallet.wallets SET balance = 5000, locked_balance = 0 WHERE user_id = $1 AND account_type = 'real'",
      [testUserId]
    );

    const idempKey = `idemp-${uuidv4()}`;
    await pgPool.query(
      "INSERT INTO payments.idempotency_keys (key, response) VALUES ($1, '{}'::jsonb) ON CONFLICT DO NOTHING",
      [idempKey]
    );
    createdIdempotencyKeys.push(idempKey);

    const wRes = await pgPool.query(
      `INSERT INTO payments.withdrawals (user_id, gateway_id, amount, fee, net_amount, currency, status, idempotency_key)
       VALUES ($1, 1, 1500, 30, 1470, 'KES', 'failed', $2)
       RETURNING id`,
      [testUserId, idempKey]
    );
    const withdrawalId = wRes.rows[0].id;
    createdWithdrawalIds.push(withdrawalId);

    const payload = { amount: '1500', netAmount: '1470', recipientPhone: '254712345678' };
    const oRes = await pgPool.query(
      `INSERT INTO payments.b2c_outbox (withdrawal_id, originator_conversation_id, status, retry_count, payload, created_at, updated_at)
       VALUES ($1, $2, 'failed', 0, $3::jsonb, NOW(), NOW())
       RETURNING id`,
      [withdrawalId, uuidv4(), JSON.stringify(payload)]
    );
    createdOutboxIds.push(oRes.rows[0].id);

    return withdrawalId;
  };

  test('POST /retry unauthenticated returns 401', async () => {
    if (skipDatabaseTests) return;

    const res = await supertest(app).post('/api/v1/admin/withdrawals/some-id/retry');
    expect(res.status).toBe(401);
  });

  test('POST /retry with non-super_admin returns 403', async () => {
    if (skipDatabaseTests) return;

    const withdrawalId = await seedFailedWithdrawal();

    const res = await supertest(app)
      .post(`/api/v1/admin/withdrawals/${withdrawalId}/retry`)
      .set('Authorization', `Bearer ${financeAdminToken}`);

    expect(res.status).toBe(403);
  });

  test('POST /retry with super_admin on failed withdrawal returns 200', async () => {
    if (skipDatabaseTests) return;

    const withdrawalId = await seedFailedWithdrawal();

    const res = await supertest(app)
      .post(`/api/v1/admin/withdrawals/${withdrawalId}/retry`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set('X-Admin-MFA-Token', superAdminMfaToken);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('dispatched');
    expect(res.body.data.retryCount).toBe(1);
  });

  test('POST /force-complete missing mpesaReceipt body returns 400', async () => {
    if (skipDatabaseTests) return;

    const res = await supertest(app)
      .post('/api/v1/admin/withdrawals/some-id/force-complete')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set('X-Admin-MFA-Token', superAdminMfaToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('POST /force-refund missing reason body returns 400', async () => {
    if (skipDatabaseTests) return;

    const res = await supertest(app)
      .post('/api/v1/admin/withdrawals/some-id/force-refund')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set('X-Admin-MFA-Token', superAdminMfaToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
