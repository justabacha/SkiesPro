import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || '',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function seedTestWithdrawals(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Restore test wallets by clearing locked balances
    console.log('Restoring test wallets by resetting locked balances...');
    await client.query(`UPDATE wallet.wallets SET locked_balance = 0 WHERE locked_balance > 0`);

    // 2. Get a non-admin user id (trader)
    const userRes = await client.query(`
      SELECT u.id FROM app_auth.users u
      WHERE NOT EXISTS (
        SELECT 1 FROM app_auth.user_roles ur
        JOIN app_auth.roles r ON r.id = ur.role_id
        WHERE ur.user_id = u.id AND ur.revoked_at IS NULL
          AND r.name IN ('admin', 'super_admin', 'compliance', 'finance', 'risk_manager', 'support')
      )
      LIMIT 1
    `);

    let userId = userRes.rows[0]?.id;
    if (!userId) {
      const fallback = await client.query('SELECT id FROM app_auth.users LIMIT 1');
      userId = fallback.rows[0]?.id;
    }

    if (!userId) {
      console.error('No users found in app_auth.users. Cannot seed withdrawals.');
      return;
    }

    // Get a gateway id
    const gwRes = await client.query('SELECT id FROM payments.payment_gateways LIMIT 1');
    let gatewayId = 1;
    if (gwRes.rows.length > 0) {
      gatewayId = gwRes.rows[0].id;
    } else {
      await client.query(`INSERT INTO payments.payment_gateways (id, name, is_active) VALUES (1, 'M-Pesa', true) ON CONFLICT (id) DO NOTHING`);
    }

    // Clear old seeded test withdrawals to avoid clutter
    await client.query(`DELETE FROM payments.withdrawals WHERE idempotency_key LIKE 'seed_wd_%'`);

    const statuses = ['pending', 'approved', 'rejected'];
    for (const status of statuses) {
      const idempotencyKey = `seed_wd_${status}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await client.query(
        `INSERT INTO payments.idempotency_keys (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`,
        [idempotencyKey]
      );
      await client.query(
        `INSERT INTO payments.withdrawals (
           id, user_id, gateway_id, amount, fee, net_amount, currency, status, idempotency_key, created_at
         ) VALUES (
           gen_random_uuid(), $1, $2, $3, 0, $3, 'KES', $4, $5, NOW()
         )`,
        [userId, gatewayId, status === 'pending' ? 5000 : status === 'approved' ? 12000 : 8000, status, idempotencyKey]
      );
    }

    await client.query('COMMIT');
    console.log('✓ Test withdrawals seeded successfully with trader user ID and test wallets restored.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ Failed to seed test withdrawals:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedTestWithdrawals();
