import supertest from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import app from '../../src/index.js';
import { pgPool } from '../../src/config/database.js';
import { TokenService } from '../../src/modules/auth/services/tokenService.js';
import { AdminRepository } from '../../src/modules/admin/repositories/AdminRepository.js';

const skipDatabaseTests = process.env.SKIP_DB_TESTS === 'true' || !process.env.DATABASE_URL;

function generateUniquePhone(): string {
  const random8 = Math.floor(10000000 + Math.random() * 90000000);
  return `07${random8}`;
}

describe('Risk Dashboard & Asset Config Backend Tests (WP-20 Phase 4)', () => {
  let riskAdminToken: string;
  let riskAdminMfaToken: string;
  let riskAdminId: string;
  let testUserIds: string[] = [];
  let testContractIds: string[] = [];
  let dashboardTestUserId: string;
  let adminRepo: AdminRepository;
  const TEST_SYMBOL = `T${uuidv4().replace(/-/g, '').slice(0, 12)}/CFG`;

  beforeAll(async () => {
    if (skipDatabaseTests) return;

    adminRepo = new AdminRepository();
    const tokenService = new TokenService();

    dashboardTestUserId = await createTestUser();

    // Create dedicated test asset for asset config updates (do NOT mutate production assets like EUR/USD)
    await pgPool.query(
      "INSERT INTO trading.assets (symbol, name, asset_type, is_active) VALUES ($1, 'Test Config Asset', 'forex', true) ON CONFLICT (symbol) DO NOTHING",
      [TEST_SYMBOL]
    );
    await pgPool.query(
      "INSERT INTO trading.asset_config (asset_symbol, payout_rate, min_stake, max_stake_per_trade, min_duration_seconds, max_duration_seconds, is_active) VALUES ($1, 0.60, 100, 5000, 60, 3600, true) ON CONFLICT (asset_symbol) DO NOTHING",
      [TEST_SYMBOL]
    );

    // 1. Create Risk Admin user & role
    const adminEmail = `riskadmin-${Date.now()}@example.com`;
    const adminPhone = generateUniquePhone();
    const aRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Risk Admin Test', 'active', 'verified', $2) RETURNING id",
      [adminEmail, adminPhone]
    );
    riskAdminId = aRes.rows[0].id;

    await pgPool.query(
      "INSERT INTO app_auth.user_roles (user_id, role_id) SELECT $1, id FROM app_auth.roles WHERE name = 'risk_manager' ON CONFLICT DO NOTHING",
      [riskAdminId]
    );

    const tokGen = tokenService.generateAccessToken(riskAdminId, 'risk_manager', []);
    riskAdminToken = tokGen.token;
    riskAdminMfaToken = tokenService.generateAdminMfaToken(riskAdminId, 'risk_manager');
  });

  afterAll(async () => {
    if (skipDatabaseTests) return;

    if (testContractIds.length > 0) {
      await pgPool.query('DELETE FROM trading.contract_events WHERE contract_id = ANY($1::uuid[])', [testContractIds]);
      await pgPool.query('DELETE FROM trading.binary_contracts WHERE id = ANY($1::uuid[])', [testContractIds]);
    }
    if (testUserIds.length > 0) {
      await pgPool.query('DELETE FROM app_auth.user_roles WHERE user_id = ANY($1::uuid[])', [testUserIds]);
      await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = ANY($1::uuid[])', [testUserIds]);
      try {
        await pgPool.query('DELETE FROM app_auth.users WHERE id = ANY($1::uuid[])', [testUserIds]);
      } catch (e) {}
    }
    if (riskAdminId) {
      await pgPool.query('DELETE FROM app_auth.user_roles WHERE user_id = $1', [riskAdminId]);
      try {
        await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [riskAdminId]);
      } catch (e) {}
    }

    // Clean up dedicated test asset
    await pgPool.query('DELETE FROM trading.asset_config WHERE asset_symbol = $1', [TEST_SYMBOL]);
    await pgPool.query('DELETE FROM trading.assets WHERE symbol = $1', [TEST_SYMBOL]);
  });

  async function createTestUser(): Promise<string> {
    const email = `riskuser-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
    const phone = generateUniquePhone();
    const res = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Risk Test User', 'active', 'verified', $2) RETURNING id",
      [email, phone]
    );
    const userId = res.rows[0].id;
    testUserIds.push(userId);
    return userId;
  }

  it('Zero Division: 0 settled contracts returns 0 win ratio without crash', async () => {
    if (skipDatabaseTests) return;

    await pgPool.query('DELETE FROM trading.binary_contracts');
    const res = await adminRepo.getRiskDashboard();
    expect(res.platform_win_loss_ratio).toBe(0);
    expect(typeof res.platform_win_loss_ratio).toBe('number');
    expect(isNaN(res.platform_win_loss_ratio)).toBe(false);
  });

  it('Win Ratio Math: 2 won and 2 lost contracts calculate exactly 50% win ratio', async () => {
    if (skipDatabaseTests) return;

    const uId = dashboardTestUserId;

    // Insert 2 won and 2 lost contracts
    const won1 = await pgPool.query(
      `INSERT INTO trading.binary_contracts (user_id, asset_symbol, contract_type, stake, potential_payout, strike_price, expiry_time, status, payout_rate)
       VALUES ($1, 'EUR/USD', 'higher', 100, 180, 1.1000, NOW() - INTERVAL '1 hour', 'won', 0.80) RETURNING id`,
      [uId]
    );
    const won2 = await pgPool.query(
      `INSERT INTO trading.binary_contracts (user_id, asset_symbol, contract_type, stake, potential_payout, strike_price, expiry_time, status, payout_rate)
       VALUES ($1, 'EUR/USD', 'higher', 100, 180, 1.1000, NOW() - INTERVAL '1 hour', 'won', 0.80) RETURNING id`,
      [uId]
    );
    const lost1 = await pgPool.query(
      `INSERT INTO trading.binary_contracts (user_id, asset_symbol, contract_type, stake, potential_payout, strike_price, expiry_time, status, payout_rate)
       VALUES ($1, 'EUR/USD', 'lower', 100, 180, 1.1000, NOW() - INTERVAL '1 hour', 'lost', 0.80) RETURNING id`,
      [uId]
    );
    const lost2 = await pgPool.query(
      `INSERT INTO trading.binary_contracts (user_id, asset_symbol, contract_type, stake, potential_payout, strike_price, expiry_time, status, payout_rate)
       VALUES ($1, 'EUR/USD', 'lower', 100, 180, 1.1000, NOW() - INTERVAL '1 hour', 'lost', 0.80) RETURNING id`,
      [uId]
    );

    testContractIds.push(won1.rows[0].id, won2.rows[0].id, lost1.rows[0].id, lost2.rows[0].id);

    const dashboard = await adminRepo.getRiskDashboard();
    expect(dashboard.platform_win_loss_ratio).toBe(50);
  });

  it('Active Traders: 3 users created, 2 with 24h contracts returns active_traders_24h = 2', async () => {
    if (skipDatabaseTests) return;

    const u1 = await createTestUser();
    const u2 = await createTestUser();
    await createTestUser(); // No contracts in 24h

    // u1 contract created in last 24h
    const c1 = await pgPool.query(
      `INSERT INTO trading.binary_contracts (user_id, asset_symbol, contract_type, stake, potential_payout, strike_price, expiry_time, status, created_at, payout_rate)
       VALUES ($1, 'BTC/USD', 'higher', 50, 90, 60000, NOW() + INTERVAL '1 hour', 'active', NOW() - INTERVAL '2 hours', 0.80) RETURNING id`,
      [u1]
    );

    // u2 contract created in last 24h
    const c2 = await pgPool.query(
      `INSERT INTO trading.binary_contracts (user_id, asset_symbol, contract_type, stake, potential_payout, strike_price, expiry_time, status, created_at, payout_rate)
       VALUES ($1, 'BTC/USD', 'lower', 50, 90, 60000, NOW() + INTERVAL '1 hour', 'active', NOW() - INTERVAL '5 hours', 0.80) RETURNING id`,
      [u2]
    );

    testContractIds.push(c1.rows[0].id, c2.rows[0].id);

    const response = await supertest(app)
      .get('/api/v1/admin/risk/dashboard')
      .set('Authorization', `Bearer ${riskAdminToken}`)
      .set('X-Admin-MFA-Token', riskAdminMfaToken);

    expect(response.status).toBe(200);
    expect(response.body.data.active_traders_24h).toBeGreaterThanOrEqual(2);
  });

  it('Asset Config Update: Updating max_stake and is_active persists max_stake_per_trade and is_active in DB', async () => {
    if (skipDatabaseTests) return;

    const symbolParam = encodeURIComponent(TEST_SYMBOL);
    const response = await supertest(app)
      .put(`/api/v1/admin/risk/asset-config/${symbolParam}`)
      .set('Authorization', `Bearer ${riskAdminToken}`)
      .set('X-Admin-MFA-Token', riskAdminMfaToken)
      .send({
        payout_rate: 82,
        min_stake: 50,
        max_stake: 5000,
        is_active: false,
      });

    expect(response.status).toBe(200);

    const dbRes = await pgPool.query(
      'SELECT payout_rate, min_stake, max_stake_per_trade, is_active FROM trading.asset_config WHERE asset_symbol = $1',
      [TEST_SYMBOL]
    );

    expect(dbRes.rows[0]).toBeDefined();
    expect(parseFloat(dbRes.rows[0].payout_rate)).toBe(0.82);
    expect(parseFloat(dbRes.rows[0].min_stake)).toBe(50);
    expect(parseFloat(dbRes.rows[0].max_stake_per_trade)).toBe(5000);
    expect(dbRes.rows[0].is_active).toBe(false);
  });
});
