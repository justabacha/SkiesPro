import { checkDatabaseConnection, pgPool } from '../src/config/database';

// Skip database tests if DATABASE_URL is not set
const skipDatabaseTests = !process.env.DATABASE_URL;

// Global setup and teardown
beforeAll(async () => {
  if (skipDatabaseTests) {
    console.warn('Skipping database tests - DATABASE_URL not set');
  }
});

afterAll(async () => {
  if (!skipDatabaseTests) {
    await pgPool.end();
  }
});

describe('Database Connection', () => {
  test('should connect to database successfully', async () => {
    if (skipDatabaseTests) return;
    const isConnected = await checkDatabaseConnection();
    expect(isConnected).toBe(true);
  });

  test('should query app_auth schema', async () => {
    if (skipDatabaseTests) return;
    // Use pgPool directly since Supabase PostgREST may not expose custom schemas
    const result = await pgPool.query('SELECT * FROM app_auth.roles LIMIT 1');
    expect(result.rows).toBeDefined();
  });
});

describe('Seed Data Verification', () => {
  test('should have seeded roles', async () => {
    if (skipDatabaseTests) return;
    const result = await pgPool.query('SELECT * FROM app_auth.roles');
    expect(result.rows).toBeDefined();
    expect(result.rows.length).toBeGreaterThan(0);

    // Verify expected roles exist
    const roleNames = result.rows.map((r: any) => r.name);
    expect(roleNames).toContain('admin');
    expect(roleNames).toContain('trader');
    expect(roleNames).toContain('support');
    expect(roleNames).toContain('compliance');
    expect(roleNames).toContain('finance');
  });

  test('should have seeded permissions', async () => {
    if (skipDatabaseTests) return;
    const result = await pgPool.query('SELECT * FROM app_auth.permissions');
    expect(result.rows).toBeDefined();
    expect(result.rows.length).toBeGreaterThan(0);
  });

  test('should have seeded assets', async () => {
    if (skipDatabaseTests) return;
    const result = await pgPool.query('SELECT * FROM trading.assets');
    expect(result.rows).toBeDefined();
    expect(result.rows.length).toBe(5); // EUR/USD, GBP/USD, USD/JPY, Gold, Oil

    // Verify expected assets exist
    const symbols = result.rows.map((a: any) => a.symbol);
    expect(symbols).toContain('EUR/USD');
    expect(symbols).toContain('GBP/USD');
    expect(symbols).toContain('USD/JPY');
    expect(symbols).toContain('XAU/USD');
    expect(symbols).toContain('WTI/USD');
  });

  test('should have seeded asset configurations', async () => {
    if (skipDatabaseTests) return;
    const result = await pgPool.query('SELECT * FROM trading.asset_config');
    expect(result.rows).toBeDefined();
    expect(result.rows.length).toBe(5);
  });

  test('should have seeded payment gateways', async () => {
    if (skipDatabaseTests) return;
    const result = await pgPool.query('SELECT * FROM payments.payment_gateways');
    expect(result.rows).toBeDefined();
    expect(result.rows.length).toBeGreaterThan(0);

    // Verify M-Pesa exists
    const gatewayNames = result.rows.map((g: any) => g.name);
    expect(gatewayNames).toContain('M-Pesa');
  });

  test('should have seeded platform settings', async () => {
    if (skipDatabaseTests) return;
    const result = await pgPool.query('SELECT * FROM config.platform_settings');
    expect(result.rows).toBeDefined();
    expect(result.rows.length).toBeGreaterThan(0);

    // Verify key settings exist
    const keys = result.rows.map((s: any) => s.key);
    expect(keys).toContain('platform.currency');
    expect(keys).toContain('deposit.min_amount');
    expect(keys).toContain('deposit.max_amount');
    expect(keys).toContain('withdrawal.min_amount');
    expect(keys).toContain('withdrawal.max_amount');
    expect(keys).toContain('trade.min_duration_seconds');
    expect(keys).toContain('trade.max_duration_seconds');
    expect(keys).toContain('trade.default_payout_ratio');
    expect(keys).toContain('referral.commission_percentage');
  });

  test('should have seeded feature flags', async () => {
    if (skipDatabaseTests) return;
    const result = await pgPool.query('SELECT * FROM config.feature_flags');
    expect(result.rows).toBeDefined();
    expect(result.rows.length).toBeGreaterThan(0);
  });
});

describe('Schema Verification', () => {
  test('should have all required schemas', async () => {
    if (skipDatabaseTests) return;
    const result = await pgPool.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name IN ('app_auth', 'wallet', 'trading', 'pricing', 'payments',
                            'compliance', 'referral', 'admin', 'config',
                            'notifications', 'events', 'reporting')
    `);
    expect(result.rows).toBeDefined();
    expect(result.rows.length).toBe(12);
  });

  test('should have app_auth schema tables', async () => {
    if (skipDatabaseTests) return;
    const result = await pgPool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'app_auth'
    `);
    expect(result.rows).toBeDefined();
    const tableNames = result.rows.map((r: any) => r.table_name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('sessions');
    expect(tableNames).toContain('mfa_tokens');
    expect(tableNames).toContain('password_reset_tokens');
    expect(tableNames).toContain('roles');
    expect(tableNames).toContain('permissions');
    expect(tableNames).toContain('user_roles');
    expect(tableNames).toContain('role_permissions');
  });

  test('should have wallet schema tables', async () => {
    if (skipDatabaseTests) return;
    const result = await pgPool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'wallet'
    `);
    expect(result.rows).toBeDefined();
    const tableNames = result.rows.map((r: any) => r.table_name);
    expect(tableNames).toContain('wallets');
    expect(tableNames).toContain('ledger_entries');
    expect(tableNames).toContain('wallet_version_log');
  });

  test('should have trading schema tables', async () => {
    if (skipDatabaseTests) return;
    const result = await pgPool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'trading'
    `);
    expect(result.rows).toBeDefined();
    const tableNames = result.rows.map((r: any) => r.table_name);
    expect(tableNames).toContain('assets');
    expect(tableNames).toContain('binary_contracts');
    expect(tableNames).toContain('contract_events');
    expect(tableNames).toContain('asset_config');
  });

  test('should have payments schema tables', async () => {
    if (skipDatabaseTests) return;
    const result = await pgPool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'payments'
    `);
    expect(result.rows).toBeDefined();
    const tableNames = result.rows.map((r: any) => r.table_name);
    expect(tableNames).toContain('deposits');
    expect(tableNames).toContain('withdrawals');
    expect(tableNames).toContain('payment_gateways');
    expect(tableNames).toContain('payment_webhook_logs');
    expect(tableNames).toContain('idempotency_keys');
  });
});
