import supertest from 'supertest';
import app from '../../src/index.js';
import { pgPool } from '../../src/config/database.js';
import { TokenService } from '../../src/modules/auth/services/tokenService.js';
import { WalletService } from '../../src/modules/wallet/services/walletService.js';

const skipDatabaseTests = process.env.SKIP_DB_TESTS === 'true' || !process.env.DATABASE_URL;

function generateUniquePhone(): string {
  const random8 = Math.floor(10000000 + Math.random() * 90000000);
  return `07${random8}`;
}

describe('4-Eyes Reject/Cancel Path Integration Tests (Phase 4)', () => {
  let superAdminToken: string;
  let superAdminMfaToken: string;
  let financeAdminToken: string;
  let financeAdminMfaToken: string;
  let testUserId: string;
  let superAdminId: string;
  let financeAdminId: string;
  let createdActionIds: string[] = [];
  let walletService: WalletService;
  let initialBalance: number;
  let initialLockedBalance: number;

  beforeAll(async () => {
    if (skipDatabaseTests) return;

    walletService = new WalletService();
    const tokenService = new TokenService();

    // 1. Create Super Admin user & role
    const superAdminEmail = `superadmin-reject-${Date.now()}@example.com`;
    const superAdminPhone = generateUniquePhone();
    const saRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Super Admin Reject', 'active', 'verified', $2) RETURNING id",
      [superAdminEmail, superAdminPhone]
    );
    superAdminId = saRes.rows[0].id;

    await pgPool.query(
      "INSERT INTO app_auth.user_roles (user_id, role_id) SELECT $1, id FROM app_auth.roles WHERE name = 'super_admin' ON CONFLICT DO NOTHING",
      [superAdminId]
    );

    const saGen = tokenService.generateAccessToken(superAdminId, 'super_admin', []);
    superAdminToken = saGen.token;
    superAdminMfaToken = tokenService.generateAdminMfaToken(superAdminId, 'super_admin');

    // 2. Create Finance Admin user & role (non-super_admin)
    const financeEmail = `financeadmin-reject-${Date.now()}@example.com`;
    const financePhone = generateUniquePhone();
    const faRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Finance Admin Reject', 'active', 'verified', $2) RETURNING id",
      [financeEmail, financePhone]
    );
    financeAdminId = faRes.rows[0].id;

    await pgPool.query(
      "INSERT INTO app_auth.user_roles (user_id, role_id) SELECT $1, id FROM app_auth.roles WHERE name = 'finance' ON CONFLICT DO NOTHING",
      [financeAdminId]
    );

    const faGen = tokenService.generateAccessToken(financeAdminId, 'finance', []);
    financeAdminToken = faGen.token;
    financeAdminMfaToken = tokenService.generateAdminMfaToken(financeAdminId, 'finance');

    // 3. Create test user & wallet
    const userEmail = `rejectuser-${Date.now()}@example.com`;
    const userPhone = generateUniquePhone();
    const uRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Reject Test User', 'active', 'verified', $2) RETURNING id",
      [userEmail, userPhone]
    );
    testUserId = uRes.rows[0].id;

    const wallet = await walletService.createWallet(testUserId, 'real', 'KES');
    // Set 1000 KES balance in user wallet
    await pgPool.query('UPDATE wallet.wallets SET balance = 1000, locked_balance = 0 WHERE id = $1', [wallet.id]);

    const wRes = await pgPool.query('SELECT balance, locked_balance FROM wallet.wallets WHERE id = $1', [wallet.id]);
    initialBalance = parseFloat(wRes.rows[0].balance);
    initialLockedBalance = parseFloat(wRes.rows[0].locked_balance);
  });

  afterAll(async () => {
    if (skipDatabaseTests) return;

    if (createdActionIds.length > 0) {
      await pgPool.query('DELETE FROM admin.admin_actions WHERE id = ANY($1::uuid[])', [createdActionIds]);
    }
    if (testUserId) {
      await pgPool.query('DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)', [testUserId]);
      await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = $1', [testUserId]);
      try {
        await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [testUserId]);
      } catch (e) {}
    }
    if (superAdminId) {
      await pgPool.query('DELETE FROM app_auth.user_roles WHERE user_id = $1', [superAdminId]);
      try {
        await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [superAdminId]);
      } catch (e) {}
    }
    if (financeAdminId) {
      await pgPool.query('DELETE FROM app_auth.user_roles WHERE user_id = $1', [financeAdminId]);
      try {
        await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [financeAdminId]);
      } catch (e) {}
    }
  });

  async function createPendingAction(): Promise<string> {
    const res = await pgPool.query(
      `INSERT INTO admin.admin_actions (admin_id, action_type, target_user_id, details, requires_approval, status)
       VALUES ($1, 'wallet_adjustment', $2, $3, true, 'pending') RETURNING id`,
      [
        superAdminId,
        testUserId,
        JSON.stringify({ user_id: testUserId, amount: 600, type: 'credit', reason: 'High Value Bonus' }),
      ]
    );
    const id = res.rows[0].id;
    createdActionIds.push(id);
    return id;
  }

  it('Happy Path: Super admin with valid MFA and reason rejects pending action (200)', async () => {
    if (skipDatabaseTests) return;

    const actionId = await createPendingAction();

    const response = await supertest(app)
      .put(`/api/v1/admin/actions/${actionId}/reject`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set('X-Admin-MFA-Token', superAdminMfaToken)
      .send({ reason: 'Compliance risk threshold exceeded', totp_code: superAdminMfaToken });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: 'rejected',
      actionId,
      rejectedBy: superAdminId,
      reason: 'Compliance risk threshold exceeded',
    });

    // Check DB state
    const dbRes = await pgPool.query('SELECT * FROM admin.admin_actions WHERE id = $1', [actionId]);
    expect(dbRes.rows[0].status).toBe('rejected');
    expect(dbRes.rows[0].rejected_by).toBe(superAdminId);
    expect(dbRes.rows[0].rejection_reason).toBe('Compliance risk threshold exceeded');
    expect(dbRes.rows[0].rejected_at).not.toBeNull();
  });

  it('No Wallet Mutation: Rejection does not mutate user wallet balances', async () => {
    if (skipDatabaseTests) return;

    const actionId = await createPendingAction();

    await supertest(app)
      .put(`/api/v1/admin/actions/${actionId}/reject`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set('X-Admin-MFA-Token', superAdminMfaToken)
      .send({ reason: 'Duplicate request cancelled', totp_code: superAdminMfaToken });

    // Verify wallet balance is untouched
    const wRes = await pgPool.query('SELECT balance, locked_balance FROM wallet.wallets WHERE user_id = $1', [testUserId]);
    expect(parseFloat(wRes.rows[0].balance)).toBe(initialBalance);
    expect(parseFloat(wRes.rows[0].locked_balance)).toBe(initialLockedBalance);
  });

  it('Missing Reason: Rejection request without reason returns 400', async () => {
    if (skipDatabaseTests) return;

    const actionId = await createPendingAction();

    const response = await supertest(app)
      .put(`/api/v1/admin/actions/${actionId}/reject`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set('X-Admin-MFA-Token', superAdminMfaToken)
      .send({ totp_code: superAdminMfaToken });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('reason is required');
  });

  it('Bad TOTP returns 400 with INVALID_TOTP code', async () => {
    if (skipDatabaseTests) return;

    const actionId = await createPendingAction();

    const response = await supertest(app)
      .put(`/api/v1/admin/actions/${actionId}/reject`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ reason: 'Bad TOTP test', totp_code: '000000' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_TOTP');

    const dbRes = await pgPool.query('SELECT status FROM admin.admin_actions WHERE id = $1', [actionId]);
    expect(dbRes.rows[0].status).toBe('pending');
  });

  it('Missing TOTP returns 400 with INVALID_TOTP code', async () => {
    if (skipDatabaseTests) return;

    const actionId = await createPendingAction();

    const response = await supertest(app)
      .put(`/api/v1/admin/actions/${actionId}/reject`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ reason: 'Missing TOTP test' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_TOTP');
  });

  it('Session remains valid after bad TOTP submission', async () => {
    if (skipDatabaseTests) return;

    const actionId = await createPendingAction();

    const badRes = await supertest(app)
      .put(`/api/v1/admin/actions/${actionId}/reject`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ reason: 'Bad TOTP', totp_code: '000000' });

    expect(badRes.status).toBe(400);
    expect(badRes.body.code).toBe('INVALID_TOTP');

    const meRes = await supertest(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(meRes.status).toBe(200);
  });

  it('Genuine session error with invalid/expired JWT returns 401', async () => {
    if (skipDatabaseTests) return;

    const actionId = await createPendingAction();

    const response = await supertest(app)
      .put(`/api/v1/admin/actions/${actionId}/reject`)
      .set('Authorization', `Bearer invalid.jwt.token`)
      .send({ reason: 'Expired session', totp_code: '123456' });

    expect(response.status).toBe(401);
  });

  it('Already Resolved (Conflict): Attempting to reject an already approved or rejected action returns 409', async () => {
    if (skipDatabaseTests) return;

    const actionId = await createPendingAction();

    // Reject once
    await supertest(app)
      .put(`/api/v1/admin/actions/${actionId}/reject`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set('X-Admin-MFA-Token', superAdminMfaToken)
      .send({ reason: 'Initial rejection', totp_code: superAdminMfaToken });

    // Attempt to reject again
    const response = await supertest(app)
      .put(`/api/v1/admin/actions/${actionId}/reject`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set('X-Admin-MFA-Token', superAdminMfaToken)
      .send({ reason: 'Second rejection attempt', totp_code: superAdminMfaToken });

    expect(response.status).toBe(409);
    expect(response.body.error).toContain('Cannot reject action');
  });

  it('Unauthorized Role: Non-super_admin admin returns 403', async () => {
    if (skipDatabaseTests) return;

    const actionId = await createPendingAction();

    const response = await supertest(app)
      .put(`/api/v1/admin/actions/${actionId}/reject`)
      .set('Authorization', `Bearer ${financeAdminToken}`)
      .set('X-Admin-MFA-Token', financeAdminMfaToken)
      .send({ reason: 'Unauthorized attempt', totp_code: financeAdminMfaToken });

    expect(response.status).toBe(403);
  });
});
