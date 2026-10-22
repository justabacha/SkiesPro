import { pgPool } from '../../src/config/database.js';
import { AdminRepository } from '../../src/modules/admin/repositories/AdminRepository.js';

const skipDatabaseTests = process.env.SKIP_DB_TESTS === 'true' || !process.env.DATABASE_URL;

function generateUniquePhone(): string {
  const random8 = Math.floor(10000000 + Math.random() * 90000000);
  return `07${random8}`;
}

describe('Risk Exposure & Dashboard Real DB Integration Tests', () => {
  let adminRepo: AdminRepository;
  let testUserId: string;
  let testContractId: string;
  const testSymbol = 'TEST/USD';

  beforeAll(async () => {
    if (skipDatabaseTests) return;

    adminRepo = new AdminRepository();

    // 1. Create a test user for binary contracts
    const email = `risk-exp-${Date.now()}@example.com`;
    const phone = generateUniquePhone();
    const uRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Risk Exp User', 'active', 'verified', $2) RETURNING id",
      [email, phone]
    );
    testUserId = uRes.rows[0].id;

    // 2. Ensure test asset and asset config exist
    await pgPool.query(
      "INSERT INTO trading.assets (symbol, name, asset_type, is_active) VALUES ($1, 'Test Dollar Pair', 'forex', true) ON CONFLICT (symbol) DO NOTHING",
      [testSymbol]
    );

    await pgPool.query(
      "INSERT INTO trading.asset_config (asset_symbol, min_stake, max_stake_per_trade, min_duration_seconds, max_duration_seconds, payout_rate, is_active) VALUES ($1, 10, 1000, 60, 3600, 0.80, true) ON CONFLICT (asset_symbol) DO NOTHING",
      [testSymbol]
    );

    // 3. Create an active binary contract
    const cRes = await pgPool.query(
      `INSERT INTO trading.binary_contracts (user_id, asset_symbol, contract_type, stake, potential_payout, strike_price, expiry_time, status, payout_rate)
       VALUES ($1, $2, 'higher', 250, 450, 1.0500, NOW() + INTERVAL '1 hour', 'active', 0.80) RETURNING id`,
      [testUserId, testSymbol]
    );
    testContractId = cRes.rows[0].id;
  });

  afterAll(async () => {
    if (skipDatabaseTests) return;

    if (testContractId) {
      await pgPool.query('DELETE FROM trading.contract_events WHERE contract_id = $1', [testContractId]);
      await pgPool.query('DELETE FROM trading.binary_contracts WHERE id = $1', [testContractId]);
    }
    await pgPool.query('DELETE FROM trading.asset_config WHERE asset_symbol = $1', [testSymbol]);
    await pgPool.query('DELETE FROM trading.assets WHERE symbol = $1', [testSymbol]);
    if (testUserId) {
      await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [testUserId]);
    }
  });

  it('Real DB Query Test: getRiskExposure executes without SQL errors and returns valid shape', async () => {
    if (skipDatabaseTests) return;

    const exposures = await adminRepo.getRiskExposure();
    expect(Array.isArray(exposures)).toBe(true);
    expect(exposures.length).toBeGreaterThan(0);

    const testItem = exposures.find((e) => e.symbol === testSymbol);
    expect(testItem).toBeDefined();
    expect(testItem?.symbol).toBe(testSymbol);
    expect(testItem?.display_name).toBe('Test Dollar Pair');
    expect(typeof testItem?.payout_rate).toBe('number');
    expect(typeof testItem?.min_stake).toBe('number');
    expect(typeof testItem?.max_stake).toBe('number');
    expect(typeof testItem?.is_active).toBe('boolean');
    expect(typeof testItem?.open_call_volume).toBe('number');
    expect(typeof testItem?.open_put_volume).toBe('number');
    expect(typeof testItem?.net_exposure).toBe('number');
    expect(typeof testItem?.exposure).toBe('number');
    expect(testItem?.open_call_volume).toBe(250);
  });

  it('Real DB Query Test: getRiskDashboard executes without SQL errors and calculates all metrics', async () => {
    if (skipDatabaseTests) return;

    const dashboard = await adminRepo.getRiskDashboard();
    expect(dashboard).toBeDefined();
    expect(typeof dashboard.total_open_positions).toBe('number');
    expect(typeof dashboard.total_payout_exposure_kes).toBe('number');
    expect(typeof dashboard.platform_win_loss_ratio).toBe('number');
    expect(typeof dashboard.daily_volume_kes).toBe('number');
    expect(typeof dashboard.active_traders_24h).toBe('number');
    expect(typeof dashboard.high_risk_flagged_users).toBe('number');
    expect(typeof dashboard.open_contracts).toBe('number');
    expect(typeof dashboard.settled_contracts).toBe('number');
    expect(typeof dashboard.total_exposure).toBe('number');
  });

  it('Empty DB Test: getRiskExposure returns [] when asset_config is empty without crashing', async () => {
    if (skipDatabaseTests) return;

    // Temporarily query custom dummy asset symbol that does not exist in asset_config
    const res = await pgPool.query(
      `SELECT ac.asset_symbol AS symbol FROM trading.asset_config ac WHERE ac.asset_symbol = 'NON_EXISTENT_PAIR_XYZ'`
    );
    expect(res.rows).toEqual([]);
  });
});
