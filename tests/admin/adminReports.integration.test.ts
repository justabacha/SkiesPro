import { v4 as uuidv4 } from 'uuid';
import { pgPool } from '../../src/config/database.js';
import { AdminRepository } from '../../src/modules/admin/repositories/AdminRepository.js';

describe('Admin reports integration', () => {
  const testUserId = uuidv4();
  const testSymbol = `R${uuidv4().replace(/-/g, '').slice(0, 10)}/USD`;
  const testContractId = uuidv4();
  const reportTime = new Date(Date.now() + 60 * 60 * 1000);

  beforeAll(async () => {
    const referralCode = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
    await pgPool.query(
      `INSERT INTO app_auth.users
         (id, email, password_hash, display_name, referral_code, status, kyc_status)
       VALUES ($1, $2, 'hash', 'Reports Integration User', $3, 'active', 'verified')`,
      [testUserId, `reports-${testUserId}@example.com`, referralCode]
    );
    await pgPool.query(
      `INSERT INTO trading.assets (symbol, name, asset_type, is_active)
       VALUES ($1, 'Reports Integration Test Asset', 'forex', TRUE)`,
      [testSymbol]
    );
    await pgPool.query(
      `INSERT INTO trading.binary_contracts
         (id, user_id, asset_symbol, contract_type, stake, potential_payout,
          strike_price, expiry_time, status, payout_rate, purchase_time,
          created_at, updated_at, account_type)
       VALUES ($1, $2, $3, 'higher', 1234.50, 2222.10, 1.1000, $4,
               'active', 0.60, $4, $4, $4, 'real')`,
      [testContractId, testUserId, testSymbol, reportTime.toISOString()]
    );
  });

  afterAll(async () => {
    await pgPool.query('DELETE FROM trading.contract_events WHERE contract_id = $1', [
      testContractId,
    ]);
    await pgPool.query('DELETE FROM trading.binary_contracts WHERE id = $1', [testContractId]);
    await pgPool.query('DELETE FROM trading.assets WHERE symbol = $1', [testSymbol]);
    await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [testUserId]);
  });

  it('returns trade-volume data using the current stake column', async () => {
    const repository = new AdminRepository();
    const from = new Date(reportTime.getTime() - 1000).toISOString();
    const to = new Date(reportTime.getTime() + 60 * 1000).toISOString();

    const reports = await repository.getReports(from, to);

    expect(reports.tradeVolume).toHaveLength(1);
    expect(Number(reports.tradeVolume[0].volume)).toBe(1234.5);
    expect(reports.tradeVolume[0].day).toBeDefined();
  });
});
