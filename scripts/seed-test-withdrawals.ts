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

    // Get a user id
    const userRes = await client.query('SELECT id FROM app_auth.users LIMIT 1');
    if (userRes.rows.length === 0) {
      console.error('No users found in app_auth.users. Cannot seed withdrawals.');
      return;
    }
    const userId = userRes.rows[0].id;

    // Get a gateway id
    const gwRes = await client.query('SELECT id FROM payments.payment_gateways LIMIT 1');
    let gatewayId = 1;
    if (gwRes.rows.length > 0) {
      gatewayId = gwRes.rows[0].id;
    } else {
      await client.query(`INSERT INTO payments.payment_gateways (id, name, is_active) VALUES (1, 'M-Pesa', true) ON CONFLICT (id) DO NOTHING`);
    }

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
    console.log('✓ Test withdrawals seeded successfully (pending, approved, rejected).');
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
