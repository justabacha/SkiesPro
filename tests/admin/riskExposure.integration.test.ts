import { pgPool } from '../../src/config/database.js';
import { AdminRepository } from '../../src/modules/admin/repositories/AdminRepository.js';
import { v4 as uuidv4 } from 'uuid';

describe('Risk Exposure & Dashboard Real DB Integration Tests', () => {
  let adminRepo: AdminRepository;
  let testAssetSymbol: string;

  beforeAll(async () => {
    adminRepo = new AdminRepository();
    // Create a real test asset + asset_config
    testAssetSymbol = `TEST-${uuidv4().slice(0, 8)}`;
    await pgPool.query(
      `INSERT INTO trading.assets (symbol, name, asset_type, is_active)
       VALUES ($1, 'Test Asset Display Name', 'forex', true)`,
      [testAssetSymbol]
    );
    await pgPool.query(
      `INSERT INTO trading.asset_config (asset_symbol, payout_rate, min_stake, max_stake_per_trade, min_duration_seconds, max_duration_seconds, is_active)
       VALUES ($1, 0.85, 10, 1000, 60, 3600, true)`,
      [testAssetSymbol]
    );
  });

  afterAll(async () => {
    await pgPool.query('DELETE FROM trading.asset_config WHERE asset_symbol = $1', [testAssetSymbol]);
    await pgPool.query('DELETE FROM trading.assets WHERE symbol = $1', [testAssetSymbol]);
  });

  it('getRiskExposure returns valid shape with all DTO fields', async () => {
    const exposures = await adminRepo.getRiskExposure();
    expect(Array.isArray(exposures)).toBe(true);

    const testRow = exposures.find((e: any) => e.symbol === testAssetSymbol);
    expect(testRow).toBeDefined();

    // Assert EVERY field exists with correct type
    expect(typeof testRow.symbol).toBe('string');
    expect(typeof testRow.display_name).toBe('string');
    expect(testRow.display_name).toBe('Test Asset Display Name'); // proves a.name JOIN worked
    expect(typeof testRow.payout_rate).toBe('number');
    expect(testRow.payout_rate).toBeCloseTo(85, 0); // 0.85 → 85 after SQL conversion
    expect(typeof testRow.min_stake).toBe('number');
    expect(typeof testRow.max_stake).toBe('number');
    expect(typeof testRow.is_active).toBe('boolean');
    expect(typeof testRow.open_call_volume).toBe('number');
    expect(typeof testRow.open_put_volume).toBe('number');
    expect(typeof testRow.net_exposure).toBe('number');
    expect(typeof testRow.exposure).toBe('number');
  });

  it('getRiskDashboard returns all metric fields with correct types', async () => {
    const dashboard = await adminRepo.getRiskDashboard();
    expect(dashboard).toBeDefined();

    // Every field must exist and be a NUMBER (not NaN — use !isNaN)
    const numericFields = [
      'total_open_positions', 'total_payout_exposure_kes', 'platform_win_loss_ratio',
      'daily_volume_kes', 'active_traders_24h', 'high_risk_flagged_users',
      'open_contracts', 'settled_contracts', 'total_exposure'
    ];
    for (const field of numericFields) {
      expect(typeof (dashboard as any)[field]).toBe('number');
      expect(Number.isNaN((dashboard as any)[field])).toBe(false);
    }
  });

  it('getRiskExposure returns [] cleanly when no asset_configs exist', async () => {
    // Temporarily deactivate all assets (safer than DELETE)
    await pgPool.query(`UPDATE trading.asset_config SET is_active = false WHERE asset_symbol = $1`, [testAssetSymbol]);
    const exposures = await adminRepo.getRiskExposure();
    expect(Array.isArray(exposures)).toBe(true);
    await pgPool.query(`UPDATE trading.asset_config SET is_active = true WHERE asset_symbol = $1`, [testAssetSymbol]);
  });
});
